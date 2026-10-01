/* Orrery front door: gallery, latest note (when present), and the emblem.
   Reads globals written by company/tools/publish:
     window.ORRERY_MODELS       (models/manifest.js)
     window.ORRERY_LATEST_NOTE,
     window.ORRERY_WORKSHOP     (an optional script; absent in the public copy)
   Classic script; needs orrery.js loaded first. */
(function () {
  "use strict";

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]);
    }
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  var ORBIT_ICON = '<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="currentColor" ' +
    'stroke-width="1"><circle cx="20" cy="20" r="9"/><circle cx="20" cy="20" r="17"/></g>' +
    '<circle cx="20" cy="20" r="3.5" fill="currentColor"/><circle cx="26.4" cy="13.6" r="1.8" fill="currentColor"/>' +
    '<circle cx="5.4" cy="30" r="2.2" fill="currentColor"/></svg>';

  /* ---- gallery ------------------------------------------------------- */
  function renderGallery() {
    var models = Array.isArray(window.ORRERY_MODELS) ? window.ORRERY_MODELS : [];
    var host = document.getElementById("gallery");
    var count = document.getElementById("exhibit-count");
    if (!host || !models.length) return;          // keep the static empty state
    models = sortModels(models);
    var reviewed = models.filter(function (m) { return reviewState(m) === "reviewed"; }).length;
    count.textContent = (models.length === 1 ? "1 exhibit" : models.length + " exhibits") + " · " +
      reviewed + " reviewed";
    var list = el("ul", { "class": "gallery" });
    models.forEach(function (m, i) {
      var li = el("li");
      var card = el("article", { "class": "card" });
      var thumb = el("div", { "class": "thumb" });
      if (m.thumbnail) {
        thumb.appendChild(el("img", { src: m.thumbnail, alt: "", width: "640", height: "400", loading: i < 6 ? "eager" : "lazy" }));
      } else {
        thumb.className += " placeholder";
        thumb.innerHTML = ORBIT_ICON;
      }
      card.appendChild(thumb);
      var body = el("div", { "class": "body" });
      body.appendChild(el("p", { "class": "field" }, m.field));
      var h = el("h3");
      h.appendChild(el("a", { href: m.url }, m.title));
      body.appendChild(h);
      body.appendChild(el("p", { "class": "question" }, m.question));
      var meta = el("p", { "class": "meta" });
      var r = m.review;
      if (reviewState(m) === "reviewed") {
        meta.appendChild(el("span", { "class": "mark reviewed", title: "Reviewed on " + r.date }, "Reviewed"));
      } else if (r && r.verdict === "needs-work") {
        meta.appendChild(el("span", { "class": "mark needs-work", title: "Reviewed on " + r.date + ": needs work" }, "Needs work"));
      } else {
        meta.appendChild(el("span", { "class": "mark unreviewed" }, "Not yet reviewed"));
      }
      meta.appendChild(el("time", { datetime: m.built, title: formatDate(m.built) }, shortDate(m.built)));
      body.appendChild(meta);
      card.appendChild(body);
      li.appendChild(card);
      list.appendChild(li);
    });
    host.textContent = "";
    var filter = fieldFilter(models, list, count);
    if (filter) host.appendChild(filter);
    host.appendChild(list);
  }

  /* With many exhibits, a row of field buttons narrows the gallery to one field. */
  function fieldFilter(models, list, count) {
    var fields = FIELDS.concat([]);
    models.forEach(function (m) { if (fields.indexOf(m.field) < 0) fields.push(m.field); });
    fields = fields.filter(function (f) { return models.some(function (m) { return m.field === f; }); });
    if (models.length < 6 || fields.length < 3) return null;
    var total = count.textContent;
    var row = el("div", { "class": "field-filter btn-row", role: "group", "aria-label": "Show exhibits by field" });
    var buttons = [];
    function show(field) {
      var shown = 0;
      Array.prototype.forEach.call(list.children, function (li, i) {
        li.hidden = !!field && models[i].field !== field;
        if (!li.hidden) shown++;
      });
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b._field === field)); });
      count.textContent = field ? "Showing " + shown + " of " + models.length + " exhibits" : total;
    }
    [null].concat(fields).forEach(function (f) {
      var n = f ? models.filter(function (m) { return m.field === f; }).length : models.length;
      var b = el("button", { type: "button", "class": "btn", "aria-pressed": String(!f) }, (f || "All") + " ");
      b.appendChild(el("span", { "class": "n" }, String(n)));
      b._field = f;
      b.addEventListener("click", function () { show(f); });
      buttons.push(b);
      row.appendChild(b);
    });
    count.setAttribute("aria-live", "polite");
    return row;
  }

  function reviewState(m) {
    var v = m.review && m.review.verdict;
    return v === "pass" || v === "pass-with-fixes" ? "reviewed" : v === "needs-work" ? "needs-work" : "unreviewed";
  }

  /* Newest first (by the day built); within a day, reviewed exhibits before
     unreviewed ones, then by field and title so the order is stable. Exhibits
     an inspector marked "needs work" go to the end. */
  var FIELDS = ["Astronomy", "Mathematics", "Physics", "Reasoning", "Computing", "Life", "Society"];
  function sortModels(models) {
    var rank = { reviewed: 0, unreviewed: 1, "needs-work": 2 };
    return models.slice().sort(function (a, b) {
      var na = reviewState(a) === "needs-work", nb = reviewState(b) === "needs-work";
      if (na !== nb) return na ? 1 : -1;
      var da = String(a.built || ""), db = String(b.built || "");
      if (da !== db) return da < db ? 1 : -1;
      var ra = rank[reviewState(a)], rb = rank[reviewState(b)];
      if (ra !== rb) return ra - rb;
      var fa = FIELDS.indexOf(a.field), fb = FIELDS.indexOf(b.field);
      if (fa < 0) fa = FIELDS.length; if (fb < 0) fb = FIELDS.length;
      if (fa !== fb) return fa - fb;
      return String(a.title).localeCompare(String(b.title));
    });
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function shortDate(iso) {          // "30 Sep 2026": fits beside the review mark on a card
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return p ? (+p[3]) + "\u00a0" + MONTHS[+p[2] - 1] + "\u00a0" + p[1] : "";
  }

  function formatDate(iso) {
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!p) return "";
    return Orrery.fmt.date(new Date(Date.UTC(+p[1], +p[2] - 1, +p[3])));
  }

  /* ---- latest note and workshop status ------------------------------- */
  function renderLatest() {
    var n = window.ORRERY_LATEST_NOTE, w = window.ORRERY_WORKSHOP;
    var sec = document.getElementById("latest"), box = document.getElementById("latest-note");
    if (!sec || !n) return;
    box.appendChild(el("h3", null, n.title));
    var ex = el("div", { "class": "excerpt" });
    ex.innerHTML = n.html;       // generated by publish: every source character is HTML-escaped
    box.appendChild(ex);
    var p = el("p", { "class": "sans", style: "font-size:.9rem;margin:0" });
    p.appendChild(el("a", { href: n.url }, n.more ? "Read the whole note →" : "Read the note →"));
    box.appendChild(p);
    if (w && w.tasks) {
      var parts = w.status.map(function (s) { return s.count + " " + s.label.toLowerCase(); });
      var st = el("p", { "class": "muted sans", style: "font-size:.85rem;margin-top:1rem" });
      st.appendChild(document.createTextNode("Cycle " + w.cycle + ": " + w.tasks + " tasks — " + parts.join(", ") + ". "));
      st.appendChild(el("a", { href: w.url }, "See them"));
      box.appendChild(st);
    }
    sec.hidden = false;
    var t = document.getElementById("latest-teaser");   // a pointer from the top: on a phone the note is far below
    if (t) {
      t.appendChild(document.createTextNode("Latest from the workshop: "));
      t.appendChild(el("a", { href: "#latest" }, n.cycle ? "the note for cycle\u00a0" + n.cycle : "the latest note"));
      t.appendChild(document.createTextNode(", below the exhibits."));
      t.hidden = false;
    }
  }

  /* ---- emblem: the planets at their real heliocentric longitudes ------
     Keplerian elements and rates per Julian century, J2000 ecliptic,
     from E. M. Standish, "Keplerian Elements for Approximate Positions of
     the Major Planets", JPL Solar System Dynamics, Table 1 (1800–2050).
     [a (au), e, I (deg), L (deg), long. perihelion (deg), long. node (deg)]  */
  var PLANETS = [
    ["Mercury", [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
                [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
    ["Venus",   [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
                [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
    ["Earth",   [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
                [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
    ["Mars",    [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
                [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
    ["Jupiter", [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
                [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
    ["Saturn",  [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
                [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
    ["Uranus",  [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
                [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
    ["Neptune", [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
                [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]]
  ];
  var D2R = Math.PI / 180;

  /* Heliocentric ecliptic longitude (radians) of planet i at time ms (Unix ms). */
  function longitude(i, ms) {
    var el0 = PLANETS[i][1], rate = PLANETS[i][2];
    var T = (ms / 86400000 + 2440587.5 - 2451545.0) / 36525;
    var e = el0[1] + rate[1] * T, I = (el0[2] + rate[2] * T) * D2R;
    var L = el0[3] + rate[3] * T, peri = el0[4] + rate[4] * T, node = el0[5] + rate[5] * T;
    var w = (peri - node) * D2R, O = node * D2R;
    var M = ((L - peri) % 360 + 540) % 360 - 180;   // mean anomaly, -180..180 deg
    M *= D2R;
    var E = M + e * Math.sin(M);
    for (var k = 0; k < 20; k++) {                   // Newton's method on Kepler's equation
      var dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-12) break;
    }
    var xp = Math.cos(E) - e, yp = Math.sqrt(1 - e * e) * Math.sin(E);  // a cancels for the angle
    var cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I);
    var x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
    var y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
    return Math.atan2(y, x);
  }
  window.OrreryEphemeris = { longitude: longitude, names: PLANETS.map(function (p) { return p[0]; }) };

  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function renderEmblem() {
    var fig = document.getElementById("emblem");
    if (!fig) return;
    var now = new Date();
    var today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12);
    var RANGE = 730;                                    // days either side of today
    var radii = [22, 33, 44, 55, 69, 81, 92, 103];      // compressed, not to scale
    var sizes = [2.4, 3.6, 3.8, 3.0, 6.2, 5.4, 4.2, 4.2];

    var s = svg("svg", { viewBox: "-112 -112 224 224", role: "img", "aria-labelledby": "emblem-desc" });
    var desc = svg("title", { id: "emblem-desc" });
    s.appendChild(desc);
    var orbits = svg("g", { fill: "none", stroke: "var(--rule)", "stroke-width": "0.8" });
    radii.forEach(function (r) { orbits.appendChild(svg("circle", { r: r })); });
    s.appendChild(orbits);
    var sun = svg("circle", { r: 9, fill: "var(--brass-lit)" });
    s.appendChild(svg("circle", { r: 13, fill: "var(--brass-lit)", opacity: "0.18" }));
    s.appendChild(sun);
    var arm = svg("line", { x1: 0, y1: 0, stroke: "var(--verdigris-lit)", "stroke-width": "0.8", "stroke-dasharray": "2 2" });
    s.appendChild(arm);
    var dots = PLANETS.map(function (p, i) {
      var c = svg("circle", { r: sizes[i], fill: i === 2 ? "var(--verdigris)" : "var(--ink-2)" });
      var t = svg("title", {}); t.textContent = p[0]; c.appendChild(t);
      s.appendChild(c);
      return c;
    });
    var earthLabel = svg("text", { "font-size": "7.5", fill: "var(--verdigris)", "paint-order": "stroke", stroke: "var(--paper)", "stroke-width": "2.5", "font-family": "var(--sans)", "text-anchor": "middle" });
    earthLabel.textContent = "Earth";
    s.appendChild(earthLabel);
    fig.replaceChild(s, fig.querySelector("svg"));

    var cap = el("figcaption", { "class": "sans muted", style: "font-size:.78rem;line-height:1.45" });
    var dateText = el("strong", { style: "color:var(--ink-2);font-weight:600" });
    cap.appendChild(document.createTextNode("The eight planets on "));
    cap.appendChild(dateText);
    cap.appendChild(document.createTextNode(", seen from above the Sun, at their real directions from it " +
      "(computed from JPL’s approximate orbital elements). Distances and sizes are not to scale."));

    var crank = el("div", { "class": "crank" });
    var id = "emblem-days";
    var lab = el("label", { "for": id }, "Turn the crank");
    var range = el("input", { type: "range", id: id, min: -RANGE, max: RANGE, step: 1, value: 0 });
    var reset = el("button", { type: "button", "class": "btn", style: "min-height:1.9rem;padding:.25em .8em;font-size:.78rem" }, "Today");
    crank.appendChild(lab); crank.appendChild(range); crank.appendChild(reset);
    fig.appendChild(crank);
    fig.appendChild(cap);

    function draw(days) {
      var ms = today + days * 86400000;
      var d = new Date(ms);
      var earthXY = null;
      for (var i = 0; i < PLANETS.length; i++) {
        var th = longitude(i, ms), r = radii[i];
        var x = r * Math.cos(th), y = -r * Math.sin(th);    // counter-clockwise, north up
        dots[i].setAttribute("cx", x.toFixed(2));
        dots[i].setAttribute("cy", y.toFixed(2));
        if (i === 2) earthXY = [x, y, th];
      }
      arm.setAttribute("x2", earthXY[0].toFixed(2));
      arm.setAttribute("y2", earthXY[1].toFixed(2));
      // label just above Earth's dot (below it when Earth is near the top)
      var above = earthXY[1] > -30;
      earthLabel.setAttribute("x", earthXY[0].toFixed(2));
      earthLabel.setAttribute("y", (earthXY[1] + (above ? -7.5 : 12.5)).toFixed(2));
      var label = Orrery.fmt.date(d);
      dateText.textContent = days === 0 ? "today, " + label : label;
      desc.textContent = "A small orrery showing the Sun and the eight planets on " + label +
        ", at their true directions from the Sun; distances not to scale.";
      range.setAttribute("aria-valuetext", label);
      reset.disabled = days === 0;
    }

    var days = 0, daysF = 0;                       // daysF keeps fractions from small drags
    function set(v) {
      daysF = Orrery.clamp(v, -RANGE, RANGE);
      var d = Math.round(daysF);
      range.value = d;
      if (d !== days || v === 0) { days = d; draw(days); }
    }
    range.addEventListener("input", function () { set(+range.value); });
    reset.addEventListener("click", function () { set(0); });

    // Drag around the Sun to turn time: one full turn = one year (Earth follows the pointer).
    var lastAngle = null;
    function angleAt(p) {
      var r = s.getBoundingClientRect();
      return Math.atan2(-(p.y - r.height / 2), p.x - r.width / 2);
    }
    s.style.touchAction = "none";
    s.style.cursor = "grab";
    Orrery.drag(s, {
      onStart: function (p) { lastAngle = angleAt(p); },
      onMove: function (p) {
        var a = angleAt(p), da = a - lastAngle;
        if (da > Math.PI) da -= Orrery.TAU; else if (da < -Math.PI) da += Orrery.TAU;
        lastAngle = a;
        set(daysF + da / Orrery.TAU * 365.25);
      },
      onEnd: function () { lastAngle = null; }
    });
    set(0);
  }

  renderGallery();
  renderLatest();
  renderEmblem();
})();
