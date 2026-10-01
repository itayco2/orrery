/* "Why does the Moon have phases?" — figures.
   Shared drawing helpers first, then one IIFE per figure. Angles in degrees
   unless a name ends in "Rad". Elongation E: angle Sun–Earth–Moon measured
   eastward along the orbit, 0 = new moon, 90 = first quarter, 180 = full. */
var MoonDraw = (function () {
  "use strict";
  var RAD = Math.PI / 180, TAU = Math.PI * 2;
  var SYNODIC = 29.530589;

  function norm(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function fraction(E) { return (1 - Math.cos(E * RAD)) / 2; }
  // Percent lit; within half a percent of new or full it keeps two decimals, so a Moon a
  // couple of hours short of full reads "99.99%" and not a rounded "100%".
  function litText(f) {
    var p = f * 100;
    if (p >= 99.995) return "100%";
    if (p <= 0.005) return "0%";
    if (p > 99.5 || p < 0.5) return Orrery.fmt.number(p, 2) + "%";
    return Orrery.fmt.number(p, 0) + "%";
  }

  function phaseName(E) {
    E = norm(E);
    if (E < 6 || E > 354) return "New moon";
    if (Math.abs(E - 90) < 6) return "First quarter";
    if (Math.abs(E - 180) < 6) return "Full moon";
    if (Math.abs(E - 270) < 6) return "Last quarter";
    if (E < 90) return "Waxing crescent";
    if (E < 180) return "Waxing gibbous";
    if (E < 270) return "Waning gibbous";
    return "Waning crescent";
  }

  // Colours for the Moon, from the page's theme.
  function moonColours(c) {
    // night side: in light mode paper-3 is paler than the gold lit side, so use dark ink instead
    var light = parseInt(c.paper.slice(1, 3), 16) > 128;
    return { lit: c.brassLit, dark: light ? c.ink2 : c.paper3, edge: c.ink3 };
  }

  /* The Moon's disc as seen from Earth's northern hemisphere (north up):
     waxing = lit on the right. The lit region is bounded by the limb on the
     sunward side and by the terminator, which we see as half an ellipse. */
  function phaseDisc(ctx, cx, cy, r, E, c) {
    E = norm(E);
    var col = moonColours(c);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = col.dark; ctx.fill();
    var s = E <= 180 ? 1 : -1, k = s * Math.cos(E * RAD), n = 48, i, y, w;
    ctx.beginPath();
    for (i = 0; i <= n; i++) {                       // sunward limb, top to bottom
      y = -r + 2 * r * i / n; w = Math.sqrt(Math.max(0, r * r - y * y));
      if (i === 0) ctx.moveTo(cx + s * w, cy + y); else ctx.lineTo(cx + s * w, cy + y);
    }
    for (i = n; i >= 0; i--) {                       // terminator, bottom to top
      y = -r + 2 * r * i / n; w = Math.sqrt(Math.max(0, r * r - y * y));
      ctx.lineTo(cx + k * w, cy + y);
    }
    ctx.closePath(); ctx.fillStyle = col.lit; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
    ctx.strokeStyle = col.edge; ctx.lineWidth = 1; ctx.stroke();
  }

  /* Top view: Sun far to the left, Earth at (ex, ey), Moon on a circle of
     radius ro. Returns the Moon's screen position. */
  function topView(ctx, x0, y0, S, E, c, opts) {
    opts = opts || {};
    var ex = x0 + S / 2, ey = y0 + S / 2, ro = S * 0.34, re = S * 0.075, rm = S * 0.05;
    var col = moonColours(c);
    // sunlight
    ctx.strokeStyle = c.brass; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
    for (var j = -3; j <= 3; j++) {
      var yy = ey + j * S * 0.14;
      ctx.beginPath(); ctx.moveTo(x0 + 4, yy); ctx.lineTo(x0 + S * 0.1, yy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 + S * 0.1, yy); ctx.lineTo(x0 + S * 0.1 - 5, yy - 3);
      ctx.lineTo(x0 + S * 0.1 - 5, yy + 3); ctx.closePath(); ctx.fillStyle = c.brass; ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.ink3; ctx.font = "12px " + c.sans; ctx.textAlign = "left";
    ctx.fillText("sunlight", x0 + 4, y0 + 14);

    if (opts.shadow) {                                // Earth's shadow, pointing away from the Sun
      // umbra narrows to a point 1.38 million km behind Earth: 3.6 × the Moon's distance
      var apex = ex + ro * 3.6, x1 = x0 + S;
      var wEnd = re * (1 - (x1 - ex) / (apex - ex));
      ctx.beginPath();
      ctx.moveTo(ex, ey - re); ctx.lineTo(x1, ey - wEnd); ctx.lineTo(x1, ey + wEnd); ctx.lineTo(ex, ey + re);
      ctx.closePath(); ctx.fillStyle = c.ink; ctx.globalAlpha = 0.16; ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = c.ink3; ctx.textAlign = "right";
      ctx.fillText("Earth’s shadow", x1 - 4, ey - wEnd - 6);
    }

    // Moon's orbit
    ctx.beginPath(); ctx.arc(ex, ey, ro, 0, TAU);
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);

    // Earth, day side toward the Sun
    ctx.beginPath(); ctx.arc(ex, ey, re, 0, TAU); ctx.fillStyle = c.paper3; ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, re, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
    ctx.fillStyle = c.verdigrisLit; ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, re, 0, TAU); ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.2; ctx.stroke();

    // Moon: position and lit half (always the half facing the Sun, on the left)
    var mx = ex - ro * Math.cos(E * RAD), my = ey + ro * Math.sin(E * RAD);
    if (opts.sightLine !== false) {
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(mx, my);
      ctx.strokeStyle = c.ink3; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.beginPath(); ctx.arc(mx, my, rm, 0, TAU); ctx.fillStyle = col.dark; ctx.fill();
    ctx.beginPath(); ctx.arc(mx, my, rm, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
    ctx.fillStyle = col.lit; ctx.fill();
    ctx.beginPath(); ctx.arc(mx, my, rm, 0, TAU); ctx.strokeStyle = col.edge; ctx.lineWidth = 1; ctx.stroke();
    if (opts.facing !== false) {                      // the half that faces Earth
      var a = Math.atan2(ey - my, ex - mx);
      ctx.beginPath(); ctx.arc(mx, my, rm + 3.5, a - Math.PI / 2, a + Math.PI / 2);
      ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2.5; ctx.stroke();
    }
    return { ex: ex, ey: ey, ro: ro, mx: mx, my: my, rm: rm };
  }

  // Elongation from a pointer position relative to Earth's centre
  function angleFrom(p, ex, ey) { return norm(Math.atan2(p.y - ey, -(p.x - ex)) / RAD); }

  // Split a canvas into a square top-view panel and a sky panel (side by side or stacked)
  function layout(w, h) {
    if (w >= h * 1.3) {
      var S = Math.min(h, w * 0.55);
      return { S: S, tx: 0, ty: (h - S) / 2, sx: S, sy: 0, sw: w - S, sh: h };
    }
    var S2 = Math.min(w, h * 0.58);
    return { S: S2, tx: (w - S2) / 2, ty: 0, sx: 0, sy: S2, sw: w, sh: h - S2 };
  }

  return { RAD: RAD, TAU: TAU, SYNODIC: SYNODIC, norm: norm, fraction: fraction, litText: litText, phaseName: phaseName,
           phaseDisc: phaseDisc, topView: topView, angleFrom: angleFrom, layout: layout };
})();

/* ---- Figure 1: drag the Moon round its orbit; see its phase from Earth ---- */
(function () {
  "use strict";
  var el = document.getElementById("phase-canvas");
  if (!el) return;
  var D = MoonDraw, E = 50, geo = null, lay = null;
  var out = {
    name: document.getElementById("phase-name"), days: document.getElementById("phase-days"),
    elong: document.getElementById("phase-elong"), frac: document.getElementById("phase-frac")
  };

  var view = Orrery.canvas(el, function (ctx, w, h) {
    if (w < 40 || h < 40) return;
    var c = Orrery.tokens();
    lay = D.layout(w, h);
    geo = D.topView(ctx, lay.tx, lay.ty, lay.S, E, c, {});
    // sky panel
    var r = Math.min(lay.sw, lay.sh) * 0.28, cx = lay.sx + lay.sw / 2, cy = lay.sy + lay.sh / 2 + 4;
    ctx.fillStyle = c.paper2; ctx.fillRect(lay.sx + 8, lay.sy + 8, lay.sw - 16, lay.sh - 16);
    ctx.fillStyle = c.ink3; ctx.font = "12px " + c.sans; ctx.textAlign = "center";
    ctx.fillText("The Moon seen from Earth", cx, lay.sy + 28);
    D.phaseDisc(ctx, cx, cy, r, E, c);
    ctx.fillStyle = c.ink; ctx.font = "600 15px " + c.sans;
    ctx.fillText(D.phaseName(E), cx, cy + r + 26);
  });

  function update() {
    var f = D.fraction(E);
    out.name.textContent = D.phaseName(E);
    out.days.textContent = Orrery.fmt.number(E / 360 * D.SYNODIC, 1) + " days";
    out.elong.textContent = Orrery.fmt.number(E, 0) + "°";
    out.frac.textContent = D.litText(f);
    el.setAttribute("aria-valuenow", Math.round(E));
    el.setAttribute("aria-valuetext", D.phaseName(E) + ", " + D.litText(f) + " lit, " +
      Orrery.fmt.number(E / 360 * D.SYNODIC, 1) + " days after new moon");
    view.redraw();
  }
  function fromPointer(p) { if (!geo) return; E = D.angleFrom(p, geo.ex, geo.ey); update(); }
  Orrery.drag(el, {
    hitTest: function (p) { return lay && p.x >= lay.tx && p.x <= lay.tx + lay.S && p.y >= lay.ty && p.y <= lay.ty + lay.S; },
    onStart: fromPointer, onMove: fromPointer,
    onNudge: function (dx, dy) { E = D.norm(E + (dx || -dy) * 2); update(); }
  });
  var loop = Orrery.loop(el, function (dt) { E = D.norm(E + dt * 360 / 12); update(); },
    { button: document.getElementById("phase-play"), autoplay: false });
  update();
})();

/* ---- Figure 2: the shadow test ------------------------------------------- */
(function () {
  "use strict";
  var el = document.getElementById("shadow-canvas");
  if (!el) return;
  var D = MoonDraw, E = 150, geo = null, lay = null;
  // Angular sizes seen from Earth's centre, mean distances (degrees)
  var MOON_SD = 0.259, UMBRA = 0.70, PENUMBRA = 1.25;
  var out = {
    gap: document.getElementById("shadow-gap"), state: document.getElementById("shadow-state"),
    name: document.getElementById("shadow-name")
  };
  function gap() { return Math.abs(D.norm(E - 180 + 180) - 180); }   // |E − 180|
  function status() {
    var g = gap();
    if (g + MOON_SD <= UMBRA) return "Entirely in the umbra: total eclipse";
    if (g - MOON_SD < UMBRA) return "Partly in the umbra: partial eclipse";
    if (g - MOON_SD < PENUMBRA) return "In the penumbra only: faint dimming";
    return "Not touched by Earth’s shadow";
  }

  var view = Orrery.canvas(el, function (ctx, w, h) {
    if (w < 40 || h < 40) return;
    var c = Orrery.tokens();
    lay = D.layout(w, h);
    geo = D.topView(ctx, lay.tx, lay.ty, lay.S, E, c, { shadow: true });
    if (gap() - MOON_SD < UMBRA) {                                  // Moon (partly) in the umbra: darken it
      ctx.beginPath(); ctx.arc(geo.mx, geo.my, geo.rm, 0, D.TAU);
      ctx.fillStyle = gap() + MOON_SD <= UMBRA ? "rgba(92,28,14,0.85)" : "rgba(92,28,14,0.45)"; ctx.fill();
    }
    var x0 = lay.sx + 8, y0 = lay.sy + 8, pw = lay.sw - 16, ph = lay.sh - 16;
    ctx.fillStyle = c.paper2; ctx.fillRect(x0, y0, pw, ph);
    var cx = x0 + pw / 2, cy = y0 + ph / 2 + 6;
    var scale = Math.min(pw / 7.5, ph / 4.6);                       // pixels per degree
    var d = D.norm(E - 180 + 180) - 180;                            // Moon east (+) of the shadow's centre
    var sx = cx + d * scale;                                        // east is to the left on the sky
    var r = MOON_SD * scale;
    ctx.fillStyle = c.ink3; ctx.font = "12px " + c.sans; ctx.textAlign = "center";
    ctx.fillText(pw > 360 ? "The Moon seen from Earth, with Earth’s shadow drawn in" : "Moon and Earth’s shadow, from Earth", cx, y0 + 18);

    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0 + 24, pw, ph - 24); ctx.clip();
    D.phaseDisc(ctx, cx, cy, r, E, c);
    var near = Math.abs(sx - cx) < pw / 2 + PENUMBRA * scale + 4;
    // shadow on the Moon (clipped to the disc); skipped when far off the panel
    if (near) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, D.TAU); ctx.clip();
    ctx.beginPath(); ctx.arc(sx, cy, PENUMBRA * scale, 0, D.TAU);
    ctx.fillStyle = "rgba(20,16,12,0.28)"; ctx.fill();
    ctx.beginPath(); ctx.arc(sx, cy, UMBRA * scale, 0, D.TAU);
    ctx.fillStyle = "rgba(92,28,14,0.82)"; ctx.fill();
    ctx.restore();
    // outlines of the shadow, which you can't see against the sky
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.strokeStyle = c.ink3;
    ctx.beginPath(); ctx.arc(sx, cy, UMBRA * scale, 0, D.TAU); ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(sx, cy, PENUMBRA * scale, 0, D.TAU); ctx.stroke();
    ctx.globalAlpha = 1; ctx.setLineDash([]);
    {
      ctx.fillStyle = c.ink3; ctx.textAlign = "center";
      ctx.fillText("umbra", sx, cy - UMBRA * scale - 4);
      ctx.fillText("penumbra", sx, cy - PENUMBRA * scale - 4);
    }
    }
    ctx.restore();
    if (Math.abs(d) * scale > pw / 2 + PENUMBRA * scale) {         // shadow off the panel: point to it
      var left = d < 0, ax = left ? x0 + 14 : x0 + pw - 14;
      ctx.fillStyle = c.ink2; ctx.textAlign = left ? "left" : "right";
      ctx.font = "13px " + c.sans;
      ctx.fillText((left ? "← " : "") + "Earth’s shadow is " + Math.round(Math.abs(d)) + "° away" + (left ? "" : " →"),
        ax, y0 + ph - 12);
    }
  });

  function update() {
    var g = gap();
    out.gap.textContent = Orrery.fmt.number(g, g < 10 ? 1 : 0) + "°";
    out.state.textContent = status();
    out.name.textContent = D.phaseName(E) + ", " + D.litText(D.fraction(E)) + " lit";
    el.setAttribute("aria-valuenow", Math.round(E * 2) / 2);
    el.setAttribute("aria-valuetext", D.phaseName(E) + "; " + Orrery.fmt.number(g, 1) +
      " degrees from the centre of Earth's shadow; " + status());
    view.redraw();
  }
  function fromPointer(p) { if (!geo) return; E = D.angleFrom(p, geo.ex, geo.ey); update(); }
  Orrery.drag(el, {
    hitTest: function (p) { return lay && p.x >= lay.tx && p.x <= lay.tx + lay.S && p.y >= lay.ty && p.y <= lay.ty + lay.S; },
    onStart: fromPointer, onMove: fromPointer,
    onNudge: function (dx, dy) { E = D.norm(E + (dx || -dy) * 0.5); update(); }
  });
  [["shadow-go-new", 0], ["shadow-go-q1", 90], ["shadow-go-before", 179], ["shadow-go-full", 180]].forEach(function (b) {
    var btn = document.getElementById(b[0]);
    if (btn) btn.addEventListener("click", function () { E = b[1]; update(); });
  });
  update();
})();

/* ---- Figure 3: eclipse seasons, from a real ephemeris --------------------- */
(function () {
  "use strict";
  var orbitEl = document.getElementById("season-orbit"), chartEl = document.getElementById("season-chart");
  if (!orbitEl || !chartEl || !window.MoonSky) return;
  var D = MoonDraw, S = window.MoonSky, RAD = D.RAD;
  var SEASON = 18;                   // Sun within this many degrees of a node: eclipses possible
  var LIMIT = 1.5;                   // rough |latitude| limit for an eclipse of some kind (degrees)
  var yearSel = document.getElementById("season-year"), slider = document.getElementById("season-day");
  var out = {
    day: document.getElementById("season-day-out"), date: document.getElementById("season-date"),
    phase: document.getElementById("season-phase"), lat: document.getElementById("season-lat"),
    node: document.getElementById("season-node"), list: document.getElementById("season-list"),
    listYear: document.getElementById("season-list-year")
  };
  var year = 2026, day = 0, d0 = 0, nDays = 365, events = [], curve = [];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function shortDate(dt) { return dt.getUTCDate() + " " + MONTHS[dt.getUTCMonth()]; }
  function nodeGap(s) {              // Sun's angular distance from the nearer node
    var a = Math.abs(D.norm(s.sunLon - s.node + 180) - 180);
    return Math.min(a, 180 - a);
  }

  function setYear(y) {
    year = y;
    d0 = S.dayOf(new Date(Date.UTC(y, 0, 1)));
    nDays = Math.round(S.dayOf(new Date(Date.UTC(y + 1, 0, 1))) - d0);
    slider.max = nDays - 1;
    events = S.syzygies(d0, d0 + nDays);
    curve = [];
    for (var t = 0; t <= nDays; t += 0.25) {
      var s = S.at(d0 + t);
      curve.push([t, s.moonLat, nodeGap(s) < SEASON]);
    }
    // text list of eclipses (real text, for everyone)
    out.listYear.textContent = y;
    out.list.textContent = "";
    events.filter(function (e) { return e.type; }).forEach(function (e) {
      var li = document.createElement("li");
      var desc = e.type.charAt(0).toUpperCase() + e.type.slice(1) + " eclipse";
      li.textContent = shortDate(e.date) + " " + y + ": " + desc +
        (e.full && e.mag > 0 ? " (umbral magnitude " + Orrery.fmt.number(e.mag, 2) + ")" : "");
      out.list.appendChild(li);
    });
  }

  var orbitView = Orrery.canvas(orbitEl, function (ctx, w, h) {
    if (w < 40 || h < 40) return;
    var c = Orrery.tokens(), s = S.at(d0 + day);
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.34, rMoon = Math.min(w, h) * 0.12;
    // Earth's orbit and the Sun
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, D.TAU); ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.06, 0, D.TAU); ctx.fillStyle = c.brassLit; ctx.fill();
    ctx.strokeStyle = c.brass; ctx.stroke();
    // Earth: heliocentric longitude = Sun's geocentric longitude + 180°
    var le = (s.sunLon + 180) * RAD, ex = cx + R * Math.cos(le), ey = cy - R * Math.sin(le);
    var season = nodeGap(s) < SEASON;
    // Moon's orbit around Earth (size exaggerated); north half solid, south half dashed
    var n = s.node * RAD;
    ctx.lineWidth = 1.6; ctx.strokeStyle = c.brass;
    ctx.beginPath(); ctx.arc(ex, ey, rMoon, -n - Math.PI, -n); ctx.stroke();        // ascending → descending (north)
    ctx.setLineDash([3, 3]); ctx.strokeStyle = c.ink3;
    ctx.beginPath(); ctx.arc(ex, ey, rMoon, -n, -n + Math.PI); ctx.stroke(); ctx.setLineDash([]);
    // line of nodes
    var nx = Math.cos(n), ny = -Math.sin(n), L = rMoon * 1.5;
    ctx.beginPath(); ctx.moveTo(ex - nx * L, ey - ny * L); ctx.lineTo(ex + nx * L, ey + ny * L);
    ctx.strokeStyle = season ? c.alarm : c.verdigris; ctx.lineWidth = season ? 2.2 : 1.4; ctx.stroke();
    ctx.fillStyle = season ? c.alarm : c.verdigris;
    ctx.beginPath(); ctx.arc(ex + nx * rMoon, ey + ny * rMoon, 3.5, 0, D.TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(ex - nx * rMoon, ey - ny * rMoon, 3.5, 0, D.TAU); ctx.fill();
    // Earth
    ctx.beginPath(); ctx.arc(ex, ey, 6, 0, D.TAU); ctx.fillStyle = c.verdigrisLit; ctx.fill();
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.2; ctx.stroke();
    // Moon
    var lm = s.moonLon * RAD, mx = ex + rMoon * Math.cos(lm), my = ey - rMoon * Math.sin(lm);
    ctx.beginPath(); ctx.arc(mx, my, 4.5, 0, D.TAU); ctx.fillStyle = s.moonLat >= 0 ? c.ink2 : c.paper;
    ctx.fill(); ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = season ? c.alarm : c.ink3; ctx.font = "12px " + c.sans; ctx.textAlign = "center";
    ctx.fillText(season ? "Eclipse season: nodes line up with the Sun" : "Nodes point away from the Sun", cx, h - 8);
    ctx.fillStyle = c.ink3; ctx.fillText("Sun", cx, cy + Math.min(w, h) * 0.06 + 14);
  });

  var chartBox = null;
  var chartView = Orrery.canvas(chartEl, function (ctx, w, h) {
    if (w < 40 || h < 40) return;
    var c = Orrery.tokens();
    var L = 36, Rm = 10, T = 12, B = 24, pw = w - L - Rm, ph = h - T - B, YMAX = 6;
    chartBox = { L: L, pw: pw };
    function X(t) { return L + pw * t / nDays; }
    function Y(b) { return T + ph / 2 - (b / YMAX) * ph / 2; }
    // eclipse seasons
    ctx.fillStyle = c.alarm; ctx.globalAlpha = 0.08;
    var start = null;
    for (var i = 0; i < curve.length; i++) {
      if (curve[i][2] && start === null) start = curve[i][0];
      if ((!curve[i][2] || i === curve.length - 1) && start !== null) {
        ctx.fillRect(X(start), T, X(curve[i][0]) - X(start), ph); start = null;
      }
    }
    ctx.globalAlpha = 1;
    // band where eclipses can happen
    ctx.fillStyle = c.ink; ctx.globalAlpha = 0.07;
    ctx.fillRect(L, Y(LIMIT), pw, Y(-LIMIT) - Y(LIMIT)); ctx.globalAlpha = 1;
    // axes
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, Y(0)); ctx.lineTo(L + pw, Y(0)); ctx.stroke();
    ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans; ctx.textAlign = "right";
    [-5, 0, 5].forEach(function (b) { ctx.fillText((b > 0 ? "+" : b < 0 ? "−" : "") + Math.abs(b) + "°", L - 5, Y(b) + 4); });
    ctx.textAlign = "center";
    for (var m = 0; m < 12; m++) {
      var t = (Date.UTC(year, m, 1) - Date.UTC(year, 0, 1)) / 86400000;
      ctx.beginPath(); ctx.moveTo(X(t), T + ph); ctx.lineTo(X(t), T + ph + 4); ctx.stroke();
      if (pw > 420 || m % 2 === 0) ctx.fillText(MONTHS[m], X(t + 15), h - 6);
    }
    // the Moon's latitude, continuously
    ctx.beginPath();
    curve.forEach(function (p, k) { if (k) ctx.lineTo(X(p[0]), Y(p[1])); else ctx.moveTo(X(p[0]), Y(p[1])); });
    ctx.strokeStyle = c.ink3; ctx.globalAlpha = 0.45; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    // new and full moons
    events.forEach(function (e) {
      var x = X(e.d - d0), y = Y(e.lat);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, D.TAU);
      if (e.full) { ctx.fillStyle = c.brassLit; ctx.fill(); ctx.strokeStyle = c.brass; }
      else { ctx.fillStyle = c.paper; ctx.fill(); ctx.strokeStyle = c.ink2; }
      ctx.lineWidth = 1.3; ctx.stroke();
      if (e.type) {
        ctx.beginPath(); ctx.arc(x, y, 8, 0, D.TAU); ctx.strokeStyle = c.alarm; ctx.lineWidth = 1.5; ctx.stroke();
      }
    });
    // today marker
    ctx.strokeStyle = c.focus || c.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(day), T); ctx.lineTo(X(day), T + ph); ctx.stroke();
  });

  function update() {
    var s = S.at(d0 + day), dt = S.dateOf(d0 + day);
    var txt = shortDate(dt) + " " + year;
    out.day.textContent = txt;
    slider.setAttribute("aria-valuetext", txt);
    out.date.textContent = txt;
    out.phase.textContent = D.phaseName(s.elong);
    out.lat.textContent = Orrery.fmt.number(Math.abs(s.moonLat), 1) + "° " + (s.moonLat >= 0 ? "north" : "south");
    out.node.textContent = Orrery.fmt.number(nodeGap(s), 0) + "°" + (nodeGap(s) < SEASON ? " (eclipse season)" : "");
    chartEl.setAttribute("aria-valuenow", Math.round(day));
    chartEl.setAttribute("aria-valuetext", txt);
    orbitView.redraw(); chartView.redraw();
  }

  yearSel.addEventListener("change", function () {
    setYear(parseInt(yearSel.value, 10));
    day = Math.min(day, nDays - 1); slider.value = day; update();
  });
  slider.addEventListener("input", function () { day = parseFloat(slider.value); update(); });
  function fromPointer(p) {
    if (!chartBox) return;
    day = Orrery.clamp((p.x - chartBox.L) / chartBox.pw * nDays, 0, nDays - 1);
    slider.value = day; update();
  }
  Orrery.drag(chartEl, {
    onStart: fromPointer, onMove: fromPointer,
    onNudge: function (dx, dy) { day = Orrery.clamp(day + (dx || -dy), 0, nDays - 1); slider.value = day; update(); }
  });
  Orrery.loop(chartEl, function (dt) {
    day += dt * 12; if (day > nDays - 1) day = 0;
    slider.value = day; update();
  }, { button: document.getElementById("season-play"), autoplay: false });

  setYear(2026);
  day = 45; slider.value = day;    // mid-February: the first eclipse season of 2026
  update();
})();

/* ---- Figure 4: the same face ----------------------------------------------- */
(function () {
  "use strict";
  var el = document.getElementById("face-canvas");
  if (!el) return;
  var D = MoonDraw, RAD = D.RAD, SIDEREAL = 27.321661;
  var theta = 0, spin = 1;          // orbit angle (degrees from start); rotations per orbit
  var out = {
    days: document.getElementById("face-days"), lon: document.getElementById("face-lon"),
    near: document.getElementById("face-near")
  };
  // Large dark plains ("maria") and far-side features: [longitude, latitude, angular radius], degrees
  var MARIA = [[-57, 18, 17], [-15, 33, 10], [17, 28, 8], [31, 8, 9], [59, 17, 5], [51, -8, 7],
               [-17, -21, 7], [-39, -24, 4], [35, -15, 4], [5, 57, 4], [-95, -20, 4]];
  var FAR = [[147, 27, 3], [129, -20, 2], [-169, -53, 16]];
  function subEarth() { return D.norm(theta - spin * theta + 180) - 180; }

  function drawSphere(ctx, cx, cy, r, lon0, c) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, D.TAU); ctx.fillStyle = c.brassLit; ctx.fill();
    function blob(f, fill) {
      var pts = [], vis = 0;
      for (var k = 0; k < 40; k++) {
        var a = k / 40 * D.TAU;
        var lat = f[1] + f[2] * Math.sin(a), lon = f[0] + f[2] * Math.cos(a) / Math.max(0.2, Math.cos(f[1] * RAD));
        var cl = Math.cos(lat * RAD), x = cl * Math.sin((lon - lon0) * RAD), y = Math.sin(lat * RAD),
            z = cl * Math.cos((lon - lon0) * RAD);
        if (z > 0) vis++; else { var q = Math.sqrt(x * x + y * y) || 1; x /= q; y /= q; }
        pts.push([cx + r * x, cy - r * y]);
      }
      if (!vis) return;
      ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    }
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, D.TAU); ctx.clip();
    ctx.globalAlpha = 0.55; MARIA.forEach(function (f) { blob(f, c.ink3); });
    FAR.forEach(function (f) { blob(f, c.ink3); });
    ctx.globalAlpha = 1; ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, D.TAU); ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.stroke();
  }

  var lay = null, geo = null;
  var view = Orrery.canvas(el, function (ctx, w, h) {
    if (w < 40 || h < 40) return;
    var c = Orrery.tokens();
    lay = D.layout(w, h);
    var S = lay.S, ex = lay.tx + S / 2, ey = lay.ty + S / 2, ro = S * 0.34, rm = S * 0.085;
    geo = { ex: ex, ey: ey };
    ctx.beginPath(); ctx.arc(ex, ey, ro, 0, D.TAU); ctx.strokeStyle = c.rule; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(ex, ey, S * 0.07, 0, D.TAU); ctx.fillStyle = c.verdigrisLit; ctx.fill();
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = c.ink3; ctx.font = "12px " + c.sans; ctx.textAlign = "center";
    ctx.fillText("Earth", ex, ey + 4);
    // Moon, seen from above: the start-of-month near side is the half toward angle (180° + spin·θ)
    var t = theta * RAD, mx = ex + ro * Math.cos(t), my = ey - ro * Math.sin(t);
    var face = (180 + spin * theta) * RAD;          // direction of the original sub-Earth point
    ctx.beginPath(); ctx.arc(mx, my, rm, 0, D.TAU); ctx.fillStyle = c.paper3; ctx.fill();
    ctx.beginPath(); ctx.arc(mx, my, rm, -face - Math.PI / 2, -face + Math.PI / 2); ctx.closePath();
    ctx.fillStyle = c.verdigrisLit; ctx.fill();
    ctx.beginPath(); ctx.arc(mx, my, rm, 0, D.TAU); ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.stroke();
    // a marker on the Moon's surface: the point that faced Earth at the start
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + rm * Math.cos(face), my - rm * Math.sin(face));
    ctx.strokeStyle = c.alarm; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(mx + rm * Math.cos(face), my - rm * Math.sin(face), 3, 0, D.TAU); ctx.fillStyle = c.alarm; ctx.fill();
    // view from Earth
    var x0 = lay.sx + 8, y0 = lay.sy + 8, pw = lay.sw - 16, ph = lay.sh - 16;
    ctx.fillStyle = c.paper2; ctx.fillRect(x0, y0, pw, ph);
    var r = Math.min(pw, ph) * 0.3, cx = x0 + pw / 2, cy = y0 + ph / 2 + 4;
    ctx.fillStyle = c.ink3; ctx.textAlign = "center";
    ctx.fillText("What Earth sees (shadows ignored)", cx, y0 + 20);
    drawSphere(ctx, cx, cy, r, subEarth(), c);
    // the red marker, if it is on the visible side
    var dl = (0 - subEarth()) * RAD;
    if (Math.cos(dl) > 0) {
      ctx.beginPath(); ctx.arc(cx + r * Math.sin(dl), cy, 4, 0, D.TAU); ctx.fillStyle = c.alarm; ctx.fill();
    }
  });

  function update() {
    var lon = subEarth(), near = 1 - Math.abs(lon) / 180;
    out.days.textContent = Orrery.fmt.number(D.norm(theta) / 360 * SIDEREAL, 1) + " days";
    out.lon.textContent = Orrery.fmt.number(Math.abs(lon), 0) + "°" + (Math.round(lon) === 0 ? "" : lon > 0 ? " east" : " west");
    out.near.textContent = Orrery.fmt.percent(near, 0);
    el.setAttribute("aria-valuenow", Math.round(D.norm(theta)));
    el.setAttribute("aria-valuetext", Orrery.fmt.number(D.norm(theta) / 360 * SIDEREAL, 1) + " days into the orbit; " +
      Math.round(near * 100) + "% of the original near side is facing Earth");
    view.redraw();
  }
  function fromPointer(p) {
    if (!geo) return;
    var a = D.norm(Math.atan2(-(p.y - geo.ey), p.x - geo.ex) / RAD), prev = D.norm(theta);
    var da = D.norm(a - prev + 180) - 180;            // keep theta continuous
    theta += da; update();
  }
  Orrery.drag(el, {
    hitTest: function (p) { return lay && p.x >= lay.tx && p.x <= lay.tx + lay.S && p.y >= lay.ty && p.y <= lay.ty + lay.S; },
    onStart: fromPointer, onMove: fromPointer,
    onNudge: function (dx, dy) { theta += (dx || -dy) * 2; update(); }
  });
  Orrery.bindRange(document.getElementById("face-spin"), document.getElementById("face-spin-out"), {
    format: function (v) { return Orrery.fmt.number(v, 2) + (v === 1 ? " (tidally locked)" : v === 0 ? " (no spin)" : ""); },
    onInput: function (v) { spin = v; update(); }
  });
  Orrery.loop(el, function (dt) { theta += dt * 30; update(); },
    { button: document.getElementById("face-play") });
  update();
})();
