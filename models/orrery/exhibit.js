/* Exhibit: "Where are the planets tonight?"
   One IIFE per figure. Positions come from window.Ephem (ephemeris.js, JPL
   approximate Keplerian elements); drawing and controls use window.Orrery. */

/* ---- shared helpers ------------------------------------------------------ */
var OrreryPlanets = (function () {
  "use strict";
  // colour token per planet (Orrery.tokens() key) and a CSS variable for swatches
  var COLOR = ["ink3", "brass", "verdigris", "alarm", "brass", "brass", "verdigris", "verdigris"];
  var CSSVAR = { ink3: "--ink-3", brass: "--brass", verdigris: "--verdigris", alarm: "--alarm" };
  var SIZE = [3, 4.5, 4.5, 3.5, 7, 6, 5, 5];           // drawn radius, px (not to scale)
  var DAY = Ephem.DAY, MIN = Ephem.MIN_MS, MAX = Ephem.MAX_MS;
  var MAXDAY = Math.round((MAX - MIN) / DAY);
  function clampT(t) { return Orrery.clamp(t, MIN, MAX + DAY / 2); }
  function wrap180(x) { return ((x % 360) + 540) % 360 - 180; }
  function dateOf(t) { return Orrery.fmt.date(new Date(t)); }

  /* A date slider (day index since 1 Jan 1800) bound to a time t in ms. */
  function dateSlider(input, output, onChange) {
    input.max = MAXDAY;
    input.addEventListener("input", function () { onChange(MIN + (+input.value) * DAY + DAY / 2); });
    return function show(t) {
      var d = Math.round((t - MIN - DAY / 2) / DAY);
      input.value = Orrery.clamp(d, 0, MAXDAY);
      var s = dateOf(t);
      output.textContent = s;
      input.setAttribute("aria-valuetext", s);
    };
  }

  /* Next time Earth and planet i line up on the same side of the Sun after t
     (opposition for outer planets, inferior conjunction for inner ones). */
  function nextAlignment(i, t) {
    var inner = i < 2;
    function side(tt) { return Ephem.geocentric(i, tt).elong; }
    function hit(a, b) {
      if (Math.sign(a) === Math.sign(b)) return false;
      return inner ? Math.abs(a) < 90 && Math.abs(b) < 90 : Math.abs(a) > 90 && Math.abs(b) > 90;
    }
    var prev = side(t), step = DAY / 2;
    for (var tt = t + step; tt < MAX; tt += step) {
      var cur = side(tt);
      if (hit(prev, cur) && (!inner || Ephem.geocentric(i, tt).dist < 1)) {
        var lo = tt - step, hi = tt, vlo = prev;
        for (var k = 0; k < 20; k++) {                  // bisect to well under a minute
          var mid = (lo + hi) / 2, vm = side(mid);
          if (hit(vlo, vm)) hi = mid; else { lo = mid; vlo = vm; }
        }
        return hi;
      }
      prev = cur;
    }
    return null;
  }

  /* Greedy label placement for canvas text drawn with textBaseline "middle".
     block() marks rectangles (dots, ticks, other text, sampled lines) to avoid; place()
     tries candidate offsets {dx, dy, align} in order and keeps the first that stays inside
     `bounds` and overlaps nothing, otherwise the one with the least weighted overlap. */
  function labeller(ctx, bounds, lineH) {
    var boxes = [];
    function rect(text, x, y, align) {
      var tw = ctx.measureText(text).width;
      var left = align === "left" ? x : align === "right" ? x - tw : x - tw / 2;
      return { x: left - 1, y: y - lineH / 2, w: tw + 2, h: lineH };
    }
    function inter(a, b) {
      var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      var h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return w > 0 && h > 0 ? w * h : 0;
    }
    function cost(r) {
      var c = 5 * (r.w * r.h - inter(r, bounds));
      for (var i = 0; i < boxes.length; i++) c += boxes[i].k * inter(r, boxes[i]);
      return c;
    }
    return {
      block: function (x, y, w, h, k) { boxes.push({ x: x, y: y, w: w, h: h, k: k === undefined ? 1 : k }); },
      dot: function (x, y, r, k) { this.block(x - r, y - r, 2 * r, 2 * r, k); },
      text: function (text, x, y, align, k) { var r = rect(text, x, y, align); this.block(r.x, r.y, r.w, r.h, k); },
      line: function (xa, ya, xb, yb, k) {                 // a line as a row of small squares
        var n = Math.ceil(Math.sqrt((xb - xa) * (xb - xa) + (yb - ya) * (yb - ya)) / 4);
        for (var i = 0; i <= n; i++) this.dot(xa + (xb - xa) * i / n, ya + (yb - ya) * i / n, 1.5, k === undefined ? 0.3 : k);
      },
      place: function (text, x, y, cands) {
        var best = null, bestC = Infinity;
        for (var i = 0; i < cands.length; i++) {
          var cd = cands[i], r = rect(text, x + cd.dx, y + cd.dy, cd.align), c = cost(r);
          if (c < bestC - 0.5) { bestC = c; best = { x: x + cd.dx, y: y + cd.dy, align: cd.align, r: r }; }
          if (c < 0.5) break;
        }
        boxes.push({ x: best.r.x, y: best.r.y, w: best.r.w, h: best.r.h, k: 1 });
        return best;
      }
    };
  }
  /* Candidate offsets round a point: first along the unit vector (ux, uy), then the
     eight compass directions, then the same again further out. */
  function around(ux, uy, off) {
    function al(dx) { return dx > 0.5 ? "left" : dx < -0.5 ? "right" : "center"; }
    var list = [], dirs = [[ux, uy], [0, -1], [0, 1], [1, 0], [-1, 0], [0.71, -0.71], [-0.71, -0.71], [0.71, 0.71], [-0.71, 0.71]];
    [1, 1.9].forEach(function (m) {
      dirs.forEach(function (d) {
        var dy = d[1] * off * m;
        if (Math.abs(d[0]) < 0.5) dy += (d[1] < 0 ? -4 : 4);   // clear the text's half-height above/below
        list.push({ dx: d[0] * off * m, dy: dy, align: al(d[0]) });
      });
    });
    return list;
  }

  return { COLOR: COLOR, CSSVAR: CSSVAR, SIZE: SIZE, DAY: DAY, MIN: MIN, MAX: MAX,
    clampT: clampT, wrap180: wrap180, dateOf: dateOf, dateSlider: dateSlider, nextAlignment: nextAlignment,
    labeller: labeller, around: around };
})();

/* ---- Figure 1: the solar system from above, at any date ------------------ */
(function () {
  "use strict";
  var cv = document.getElementById("top-canvas");
  if (!cv) return;
  var P = OrreryPlanets, TAU = Orrery.TAU, DAY = P.DAY;
  var t = P.clampT(Date.now());
  var scaleMode = "sqrt";
  var speed = 30.44;                                   // days per second
  var tbody = document.getElementById("top-table");
  var cells = [];

  Ephem.names.forEach(function (name, i) {
    var tr = document.createElement("tr");
    var th = document.createElement("th");
    th.scope = "row";
    var sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = "var(" + P.CSSVAR[P.COLOR[i]] + ")";
    th.appendChild(sw);
    th.appendChild(document.createTextNode(name));
    tr.appendChild(th);
    var c = [];
    for (var k = 0; k < 3; k++) {
      var td = document.createElement("td");
      if (k < 2) td.className = "num";
      if (k === 1 && i !== 2) {
        td.appendChild(document.createElement("span"));
        var km = document.createElement("span"); km.className = "km"; td.appendChild(km);
      }
      tr.appendChild(td); c.push(td);
    }
    tbody.appendChild(tr);
    cells.push(c);
  });

  function skyText(el) {
    var a = Math.abs(el), deg = Math.round(a) + "°";
    if (a < 15) return { text: "lost in the Sun’s glare (" + deg + " from it)", glare: true };
    if (a > 150) return { text: "up most of the night, opposite the Sun (" + deg + ")" };
    return { text: (el > 0 ? "evening sky, " : "morning sky, ") + deg + (el > 0 ? " east" : " west") + " of the Sun" };
  }

  function updateTable() {
    for (var i = 0; i < 8; i++) {
      var c = cells[i];
      if (i === 2) {
        c[0].textContent = Orrery.fmt.number(Ephem.position(2, t).r, 3) + " au";
        c[1].textContent = "—";
        c[2].textContent = "you are here";
        continue;
      }
      var p = Ephem.position(i, t), g = Ephem.geocentric(i, t);
      c[0].textContent = Orrery.fmt.number(p.r, p.r < 2 ? 3 : 2) + " au";
      c[1].firstChild.textContent = Orrery.fmt.number(g.dist, g.dist < 2 ? 3 : 2) + " au";
      c[1].lastChild.textContent = " · " + Orrery.fmt.number(g.dist * Ephem.AU_KM / 1e6, 0) + " million km";
      var s = skyText(g.elong);
      c[2].textContent = s.text;
      c[2].className = s.glare ? "glare" : "";
    }
  }

  function geom(w, h) {
    var R = Math.min(w, h) / 2 - 20;
    return { cx: w / 2, cy: h / 2, R: R };
  }
  function mapR(r, R) {
    if (scaleMode === "sqrt") return R * Math.sqrt(r / 31);
    if (scaleMode === "true") return R * r / 31;
    return R * r / 1.72;
  }
  function toScreen(p, g) {
    var r = Math.sqrt(p.x * p.x + p.y * p.y) || 1e-9, s = mapR(r, g.R) / r;
    return { x: g.cx + p.x * s, y: g.cy - p.y * s };
  }

  var view = Orrery.canvas(cv, function draw(ctx, w, h) {
    if (w < 80 || h < 80) return;
    var c = Orrery.tokens(), g = geom(w, h);
    ctx.font = "12px " + c.sans;
    // the ecliptic longitude scale around the edge
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R + 6, 0, TAU); ctx.stroke();
    for (var d = 0; d < 360; d += 10) {
      var a = d * Math.PI / 180, len = d % 90 === 0 ? 8 : 4;
      ctx.beginPath();
      ctx.moveTo(g.cx + (g.R + 6) * Math.cos(a), g.cy - (g.R + 6) * Math.sin(a));
      ctx.lineTo(g.cx + (g.R + 6 - len) * Math.cos(a), g.cy - (g.R + 6 - len) * Math.sin(a));
      ctx.stroke();
    }
    ctx.fillStyle = c.ink3; ctx.textAlign = "right"; ctx.textBaseline = "top";
    ctx.fillText("0°", g.cx + g.R - 6, g.cy + 6);
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("90°", g.cx, g.cy - g.R + 6);
    ctx.textBaseline = "bottom";
    ctx.fillText("270°", g.cx, g.cy + g.R - 4);
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("180°", g.cx - g.R + 6, g.cy);

    // orbits
    var n = scaleMode === "inner" ? 4 : 8;
    for (var i = 0; i < n; i++) {
      var pts = Ephem.orbit(i, t, 180);
      ctx.beginPath();
      for (var k = 0; k < pts.length; k++) {
        var s = toScreen(pts[k], g);
        if (k === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
      }
      ctx.strokeStyle = i === 2 ? c.verdigrisLit : c.rule; ctx.lineWidth = i === 2 ? 1.3 : 1;
      ctx.stroke();
    }
    // Sun
    ctx.beginPath(); ctx.arc(g.cx, g.cy, 12, 0, TAU); ctx.fillStyle = c.brassLit; ctx.globalAlpha = 0.25; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, 7, 0, TAU); ctx.fill();

    // planets: dots first, then labels placed so that none covers another label or dot
    ctx.font = "12px " + c.sans; ctx.textBaseline = "middle";
    var L = P.labeller(ctx, { x: 2, y: 2, w: w - 4, h: h - 4 }, 14), qs = [];
    L.dot(g.cx, g.cy, 9);
    L.block(4, 4, 130, 20);                           // the date, top left
    L.text("0°", g.cx + g.R - 6, g.cy + 12, "right"); L.text("90°", g.cx, g.cy - g.R + 12, "center");
    L.text("270°", g.cx, g.cy + g.R - 10, "center"); L.text("180°", g.cx - g.R + 6, g.cy, "left");
    for (i = 0; i < 8; i++) {
      var p = Ephem.position(i, t);
      var col = c[P.COLOR[i]];
      if (i >= n) {                                   // off the inner view: mark direction at the edge
        var ang = Math.atan2(p.y, p.x), ex = g.cx + (g.R - 2) * Math.cos(ang), ey = g.cy - (g.R - 2) * Math.sin(ang);
        ctx.beginPath(); ctx.arc(ex, ey, 3, 0, TAU); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans;
        ctx.textAlign = Math.cos(ang) > 0.3 ? "right" : Math.cos(ang) < -0.3 ? "left" : "center";
        ctx.fillText(Ephem.names[i], ex - Math.cos(ang) * 12, ey + Math.sin(ang) * 12);
        L.text(Ephem.names[i], ex - Math.cos(ang) * 12, ey + Math.sin(ang) * 12, ctx.textAlign);
        ctx.font = "12px " + c.sans;
        continue;
      }
      var q = toScreen(p, g);
      ctx.beginPath(); ctx.arc(q.x, q.y, P.SIZE[i], 0, TAU); ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = c.paper; ctx.lineWidth = 1; ctx.stroke();
      L.dot(q.x, q.y, P.SIZE[i] + 1);
      qs[i] = q;
    }
    // labels, Earth first, then outward from the Sun; preferred spot is pushed outward from the Sun
    [2, 0, 1, 3, 4, 5, 6, 7].forEach(function (i) {
      var q = qs[i];
      if (!q) return;
      var ux = q.x - g.cx, uy = q.y - g.cy, ul = Math.sqrt(ux * ux + uy * uy) || 1;
      var spot = L.place(Ephem.names[i], q.x, q.y, P.around(ux / ul, uy / ul, P.SIZE[i] + 5));
      ctx.textAlign = spot.align;
      ctx.lineWidth = 3; ctx.strokeStyle = c.paper; ctx.strokeText(Ephem.names[i], spot.x, spot.y);
      ctx.fillStyle = i === 2 ? c.verdigris : c.ink2; ctx.fillText(Ephem.names[i], spot.x, spot.y);
    });
    // scale bar for the true-scale views
    if (scaleMode !== "sqrt") {
      var bar = scaleMode === "true" ? 5 : 0.5, bl = mapR(bar, g.R);
      ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(8, h - 10); ctx.lineTo(8 + bl, h - 10);
      ctx.moveTo(8, h - 14); ctx.lineTo(8, h - 6); ctx.moveTo(8 + bl, h - 14); ctx.lineTo(8 + bl, h - 6); ctx.stroke();
      ctx.fillStyle = c.ink2; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.font = "11px " + c.sans;
      ctx.fillText(bar + " au" + (scaleMode === "inner" ? " · outer planets marked at the edge" : ""), 8, h - 16);
    }
    // date, top left
    ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = "600 13px " + c.sans; ctx.fillStyle = c.ink2;
    ctx.fillText(P.dateOf(t), 8, 8);
  });

  var showDate = P.dateSlider(document.getElementById("top-date"), document.getElementById("top-date-out"), function (v) { set(v); });
  var todayBtn = document.getElementById("top-today");
  var lastTable = 0;
  function set(v, fromLoop) {
    t = P.clampT(v);
    showDate(t);
    var now = performance.now();
    if (!fromLoop || now - lastTable > 120) { updateTable(); lastTable = now; }
    view.redraw();
  }

  var loop = Orrery.loop(cv, function (dt) {
    var nt = t + dt * speed * DAY;
    if (nt >= P.MAX) { set(P.MAX); loop.pause(); return; }
    set(nt, true);
  }, { button: document.getElementById("top-play"), autoplay: false,
       onChange: function (playing) { if (!playing) updateTable(); } });

  todayBtn.addEventListener("click", function () { set(Date.now()); });
  document.getElementById("top-speed").addEventListener("change", function (e) { speed = +e.target.value; });
  document.getElementById("top-scale").addEventListener("change", function (e) { scaleMode = e.target.value; view.redraw(); });

  // Drag round the Sun: one full turn = one year (Earth follows the pointer).
  var lastAngle = null;
  function angleAt(p) {
    var r = cv.getBoundingClientRect();
    return Math.atan2(-(p.y - r.height / 2), p.x - r.width / 2);
  }
  cv.style.cursor = "grab";
  Orrery.drag(cv, {
    onStart: function (p) { lastAngle = angleAt(p); },
    onMove: function (p) {
      var a = angleAt(p), da = a - lastAngle;
      if (da > Math.PI) da -= TAU; else if (da < -Math.PI) da += TAU;
      lastAngle = a;
      set(t + da / TAU * 365.25 * DAY, true);
    },
    onEnd: function () { lastAngle = null; updateTable(); }
  });
  set(t);
})();

/* ---- Figure 2: the view from Earth; direction against time ---------------- */
(function () {
  "use strict";
  var cv = document.getElementById("sky-canvas");
  if (!cv) return;
  var P = OrreryPlanets, TAU = Orrery.TAU, DAY = P.DAY;
  var t = P.clampT(Date.now());
  var planet = 3;
  var HALFS = [80, 320, 0, 260, 365, 365, 365, 365];    // days either side of t in the plot, per planet
  var HALF = HALFS[planet];
  var SPEED = 25;                                        // days per second when playing
  var out = {
    lon: document.getElementById("sky-lon"), rate: document.getElementById("sky-rate"),
    dist: document.getElementById("sky-dist"), elong: document.getElementById("sky-elong")
  };
  var nextBtn = document.getElementById("sky-next");
  var plotBox = null;                                    // for dragging: plot width in px

  function layout(w, h) {
    if (w / h > 1.3) return { top: [0, 0, h, h], plot: [h + 8, 0, w - h - 8, h] };
    var th = Math.round(h * 0.5);
    return { top: [0, 0, w, th], plot: [0, th + 4, w, h - th - 4] };
  }

  function drawTop(ctx, c, box) {
    var cx = box[0] + box[2] / 2, cy = box[1] + box[3] / 2;
    var Rp = Math.max(Math.min(box[2], box[3]) / 2 - 12, 10);
    var k = Ephem.elements(planet, t);
    var far = Math.max(k.a * (1 + k.e), 1.02);
    var sc = Rp * 0.8 / far;
    // the distant stars
    ctx.setLineDash([1.5, 4]); ctx.strokeStyle = c.ink3; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = "11px " + c.sans; ctx.fillStyle = c.ink3; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("distant stars", box[0] + 4, box[1] + 2);
    [2, planet].forEach(function (i) {
      var pts = Ephem.orbit(i, t, 160);
      ctx.beginPath();
      pts.forEach(function (p, j) { var x = cx + p.x * sc, y = cy - p.y * sc; if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.strokeStyle = i === 2 ? c.verdigrisLit : c.rule; ctx.lineWidth = 1; ctx.stroke();
    });
    var e = Ephem.position(2, t), p = Ephem.position(planet, t);
    var ex = e.x * sc, ey = e.y * sc, dx = (p.x - e.x), dy = (p.y - e.y), dl = Math.sqrt(dx * dx + dy * dy);
    dx /= dl; dy /= dl;
    var b = ex * dx + ey * dy, s = -b + Math.sqrt(b * b - (ex * ex + ey * ey) + Rp * Rp);
    var sx = cx + ex + dx * s, sy = cy - (ey + dy * s);
    ctx.setLineDash([5, 4]); ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(cx + ex, cy - ey); ctx.lineTo(sx, sy); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, TAU); ctx.fillStyle = c.verdigris; ctx.fill();
    // Sun, Earth, planet
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fillStyle = c.brassLit; ctx.fill();
    ctx.beginPath(); ctx.arc(cx + ex, cy - ey, 4.5, 0, TAU); ctx.fillStyle = c.verdigris; ctx.fill();
    var px = cx + p.x * sc, py = cy - p.y * sc;
    ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fillStyle = c[P.COLOR[planet]]; ctx.fill();
    ctx.strokeStyle = c.paper; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = "12px " + c.sans; ctx.textBaseline = "middle";
    // labels keep off the line of sight (which runs straight out through both at opposition)
    var L = P.labeller(ctx, { x: box[0] + 2, y: box[1] + 2, w: box[2] - 4, h: box[3] - 4 }, 14);
    L.line(cx + ex, cy - ey, sx, sy, 1);
    L.dot(cx, cy, 7); L.dot(cx + ex, cy - ey, 5.5); L.dot(px, py, 6); L.dot(sx, sy, 5.5);
    L.text("distant stars", box[0] + 4, box[1] + 9, "left");
    function label(text, x, y, col) {
      var ux = x - cx, uy = y - cy, ul = Math.sqrt(ux * ux + uy * uy);
      var spot = ul < 2 ? L.place(text, x, y, P.around(0.71, -0.71, 10)) : L.place(text, x, y, P.around(ux / ul, uy / ul, 10));
      ctx.textAlign = spot.align;
      ctx.lineWidth = 3; ctx.strokeStyle = c.paper; ctx.strokeText(text, spot.x, spot.y);
      ctx.fillStyle = col; ctx.fillText(text, spot.x, spot.y);
    }
    label("Earth", cx + ex, cy - ey, c.verdigris);
    label(Ephem.names[planet], px, py, c.ink);
  }

  function niceStep(span, target) {
    var steps = [1, 2, 5, 10, 15, 20, 30, 45, 60, 90];
    for (var i = 0; i < steps.length; i++) if (span / steps[i] <= target) return steps[i];
    return 90;
  }

  function drawPlot(ctx, c, box) {
    var ml = 48, mr = 10, mt = 20, mb = 22;
    var x0 = box[0] + ml, x1 = box[0] + box[2] - mr, y0 = box[1] + mt, y1 = box[1] + box[3] - mb;
    plotBox = { w: x1 - x0 };
    var N = 366, lons = [], times = [], elong = [], dist = [];
    var prev = null, acc = 0;
    for (var k = 0; k < N; k++) {
      var tt = t + (-HALF + 2 * HALF * k / (N - 1)) * DAY;
      var g = Ephem.geocentric(planet, tt);
      if (prev === null) acc = g.lon; else acc += P.wrap180(g.lon - prev);
      prev = g.lon;
      lons.push(acc); times.push(tt); elong.push(g.elong); dist.push(g.dist);
    }
    var lo = Math.min.apply(null, lons), hi = Math.max.apply(null, lons);
    var span = Math.max(hi - lo, 10), mid = (hi + lo) / 2;
    lo = mid - span * 0.55; hi = mid + span * 0.55;
    function X(k) { return x0 + (x1 - x0) * k / (N - 1); }
    function Y(v) { return y1 - (y1 - y0) * (v - lo) / (hi - lo); }

    ctx.font = "11px " + c.sans; ctx.fillStyle = c.ink3; ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    // horizontal grid: longitude
    var st = niceStep(hi - lo, 6);
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (var v = Math.ceil(lo / st) * st; v <= hi; v += st) {
      var y = Y(v);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillText(Math.round(((v % 360) + 360) % 360) + "°", x0 - 5, y);
    }
    // vertical grid: 1 January of each year
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    var yA = new Date(times[0]).getUTCFullYear(), yB = new Date(times[N - 1]).getUTCFullYear();
    for (var yr = yA; yr <= yB; yr++) {
      var ty = Date.UTC(yr, 0, 1);
      if (ty < times[0] || ty > times[N - 1]) continue;
      var xx = x0 + (x1 - x0) * (ty - times[0]) / (times[N - 1] - times[0]);
      ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y1); ctx.stroke();
      var yw = ctx.measureText(String(yr)).width;           // keep the year inside the plot
      ctx.textAlign = xx + 3 + yw > x1 ? "right" : "left";
      ctx.fillText(String(yr), ctx.textAlign === "right" ? xx - 3 : xx + 3, y1 + 5);
    }
    // axis title, written up the left edge so the row above the plot is free for event labels
    ctx.save(); ctx.translate(box[0] + 7, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("direction (east →)", 0, 0); ctx.restore();

    // alignments (opposition / inferior conjunction)
    var inner = planet < 2;
    ctx.textAlign = "center";
    for (k = 1; k < N; k++) {
      if (Math.sign(elong[k]) === Math.sign(elong[k - 1])) continue;
      var isAlign = inner ? (Math.abs(elong[k]) < 90 && dist[k] < 1) : Math.abs(elong[k]) > 90;
      if (!isAlign) continue;
      var ax = X(k - 0.5);
      ctx.setLineDash([3, 3]); ctx.strokeStyle = c.brass;
      ctx.beginPath(); ctx.moveTo(ax, y0); ctx.lineTo(ax, y1); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.brass;
      var lab = inner ? "inferior conj." : "opposition";
      var tw = ctx.measureText(lab).width / 2;
      ctx.textBaseline = "top";
      ctx.fillText(lab, Orrery.clamp(ax, x0 + tw, x1 - tw), box[1] + 4);
    }

    // the curve: past solid, future faint; retrograde thick
    var nowK = (N - 1) / 2;
    for (k = 1; k < N; k++) {
      var retro = lons[k] < lons[k - 1];
      ctx.globalAlpha = k - 1 < nowK ? 1 : 0.4;
      ctx.strokeStyle = retro ? c.alarm : c.ink2;
      ctx.lineWidth = retro ? 3.5 : 1.8;
      ctx.beginPath(); ctx.moveTo(X(k - 1), Y(lons[k - 1])); ctx.lineTo(X(k), Y(lons[k])); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // now
    var nx = X(nowK), ny = Y((lons[182] + lons[183]) / 2);
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(nx, y0); ctx.lineTo(nx, y1); ctx.stroke();
    ctx.beginPath(); ctx.arc(nx, ny, 5, 0, TAU); ctx.fillStyle = c.verdigris; ctx.fill();
    ctx.strokeStyle = c.paper; ctx.stroke();
    ctx.font = "600 12px " + c.sans; ctx.fillStyle = c.ink2; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText(P.dateOf(t), Orrery.clamp(nx, x0 + 50, x1 - 50), y1 - 3);
  }

  var view = Orrery.canvas(cv, function (ctx, w, h) {
    if (w < 80 || h < 80) return;
    var c = Orrery.tokens(), L = layout(w, h);
    drawTop(ctx, c, L.top);
    drawPlot(ctx, c, L.plot);
  });

  function updateReadouts() {
    var g = Ephem.geocentric(planet, t);
    var rate = P.wrap180(Ephem.geocentric(planet, t + DAY / 2).lon - Ephem.geocentric(planet, t - DAY / 2).lon);
    out.lon.textContent = Orrery.fmt.number(g.lon, 1) + "°";
    out.rate.textContent = (rate >= 0 ? "eastward (normal), " : "westward (retrograde), ") +
      Orrery.fmt.number(Math.abs(rate), 2) + "° per day";
    out.dist.textContent = Orrery.fmt.number(g.dist, 3) + " au (" + Orrery.fmt.number(g.dist * Ephem.AU_KM / 1e6, 0) + " million km)";
    var a = Math.abs(g.elong);
    out.elong.textContent = Orrery.fmt.number(a, 0) + "° " + (g.elong >= 0 ? "east" : "west") +
      (a < 15 ? " (in the Sun’s glare)" : a > 150 ? " (up most of the night)" : g.elong >= 0 ? " (evening sky)" : " (morning sky)");
  }

  var showDate = P.dateSlider(document.getElementById("sky-date"), document.getElementById("sky-date-out"), function (v) { set(v); });
  var lastR = 0;
  function set(v, fromLoop) {
    t = P.clampT(v);
    showDate(t);
    var now = performance.now();
    if (!fromLoop || now - lastR > 100) { updateReadouts(); lastR = now; }
    view.redraw();
  }

  var loop = Orrery.loop(cv, function (dt) {
    var nt = t + dt * SPEED * DAY;
    if (nt >= P.MAX) { set(P.MAX); loop.pause(); return; }
    set(nt, true);
  }, { button: document.getElementById("sky-play"), autoplay: false,
       onChange: function (playing) { if (!playing) updateReadouts(); } });

  document.getElementById("sky-today").addEventListener("click", function () { set(Date.now()); });
  document.getElementById("sky-planet").addEventListener("change", function (e) {
    planet = +e.target.value;
    HALF = HALFS[planet];
    nextBtn.textContent = planet < 2 ? "Next inferior conjunction" : "Next opposition";
    set(t);
  });
  nextBtn.addEventListener("click", function () {
    var n = P.nextAlignment(planet, t + DAY);
    if (n !== null) set(n);
  });

  cv.style.cursor = "ew-resize";
  Orrery.drag(cv, {
    onMove: function (p) {
      var days = plotBox ? p.dx * (2 * HALF) / plotBox.w : p.dx;
      set(t + days * DAY, true);
    },
    onEnd: function () { updateReadouts(); }
  });
  set(t);
})();

/* ---- Figure 3: Kepler's third law on log-log axes ------------------------- */
(function () {
  "use strict";
  var cv = document.getElementById("kepler-canvas");
  if (!cv) return;
  var P = OrreryPlanets, TAU = Orrery.TAU;
  var AMIN = 0.2, AMAX = 60, TMIN = 0.08, TMAX = 600;
  var a = 2.8;                                           // au: the asteroid belt
  var J2000 = Date.UTC(2000, 0, 1, 12);
  var data = Ephem.names.map(function (n, i) {
    return { name: n, a: Ephem.elements(i, J2000).a, T: Ephem.periodDays(i) / 365.25 };
  });
  var out = { a: document.getElementById("kep-a"), t: document.getElementById("kep-t"),
    v: document.getElementById("kep-v"), syn: document.getElementById("kep-syn") };
  var box = null;

  // the table under the figure
  var tb = document.getElementById("kepler-table");
  data.forEach(function (d) {
    var tr = document.createElement("tr");
    [d.name, Orrery.fmt.number(d.a, 3), Orrery.fmt.number(d.T, d.T < 10 ? 3 : 2),
     Orrery.fmt.number(d.T * d.T / (d.a * d.a * d.a), 3)].forEach(function (s, k) {
      var cell = document.createElement(k === 0 ? "th" : "td");
      if (k === 0) cell.scope = "row"; else cell.className = "num";
      cell.textContent = s; tr.appendChild(cell);
    });
    tb.appendChild(tr);
  });

  function lg(x) { return Math.log(x) / Math.LN10; }

  var view = Orrery.canvas(cv, function (ctx, w, h) {
    if (w < 80 || h < 80) return;
    var c = Orrery.tokens();
    var ml = 50, mr = 14, mt = 12, mb = 40;
    var x0 = ml, x1 = w - mr, y0 = mt, y1 = h - mb;
    box = { x0: x0, x1: x1 };
    function X(v) { return x0 + (x1 - x0) * (lg(v) - lg(AMIN)) / (lg(AMAX) - lg(AMIN)); }
    function Y(v) { return y1 - (y1 - y0) * (lg(v) - lg(TMIN)) / (lg(TMAX) - lg(TMIN)); }
    ctx.font = "11px " + c.sans; ctx.lineWidth = 1;
    // grid
    [0.2, 0.5, 1, 2, 5, 10, 20, 50].forEach(function (v) {
      ctx.strokeStyle = c.rule; ctx.beginPath(); ctx.moveTo(X(v), y0); ctx.lineTo(X(v), y1); ctx.stroke();
      ctx.fillStyle = c.ink3; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(String(v), X(v), y1 + 4);
    });
    [0.1, 0.3, 1, 3, 10, 30, 100, 300].forEach(function (v) {
      ctx.strokeStyle = c.rule; ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); ctx.stroke();
      ctx.fillStyle = c.ink3; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(String(v), x0 - 5, Y(v));
    });
    ctx.fillStyle = c.ink2; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("distance from the Sun, a (au)", (x0 + x1) / 2, h - 2);
    ctx.save(); ctx.translate(12, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "middle"; ctx.fillText("year, T (Earth years)", 0, 0); ctx.restore();
    // the law
    ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(AMIN), Y(Math.pow(AMIN, 1.5))); ctx.lineTo(X(AMAX), Y(Math.pow(AMAX, 1.5))); ctx.stroke();
    // planets and the imaginary one: labels stay inside the plot (clear of the tick labels),
    // off the line and off each other
    ctx.font = "12px " + c.sans; ctx.textBaseline = "middle";
    var L = P.labeller(ctx, { x: x0 + 1, y: y0, w: x1 - x0 - 1, h: y1 - y0 - 1 }, 14);
    L.line(X(AMIN), Y(Math.pow(AMIN, 1.5)), X(AMAX), Y(Math.pow(AMAX, 1.5)));
    var T = Math.pow(a, 1.5), hx = X(a), hy = Y(T);
    L.dot(hx, hy, 10, 2);
    L.line(hx, y1, hx, hy, 0.3); L.line(hx, hy, x0, hy, 0.3);
    var spots = data.map(function (d, i) {
      var x = X(d.a), y = Y(d.T);
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fillStyle = c[P.COLOR[i]]; ctx.fill();
      L.dot(x, y, 5.5, 2);
      return { x: x, y: y };
    });
    // the imaginary planet
    ctx.setLineDash([3, 3]); ctx.strokeStyle = c.ink3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx, y1); ctx.lineTo(hx, hy); ctx.lineTo(x0, hy); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(hx, hy - 9); ctx.lineTo(hx + 9, hy); ctx.lineTo(hx, hy + 9); ctx.lineTo(hx - 9, hy); ctx.closePath();
    ctx.fillStyle = c.paper; ctx.fill(); ctx.strokeStyle = c.brass; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.font = "600 12px " + c.sans;
    var lab = "your planet", hs = L.place(lab, hx, hy, [{ dx: 12, dy: 11, align: "left" }, { dx: -12, dy: -11, align: "right" },
      { dx: 13, dy: 0, align: "left" }, { dx: -13, dy: 0, align: "right" }, { dx: 12, dy: -13, align: "left" },
      { dx: -12, dy: 13, align: "right" }, { dx: 0, dy: -18, align: "center" }, { dx: 0, dy: 18, align: "center" }]);
    ctx.textAlign = hs.align; ctx.lineWidth = 3; ctx.strokeStyle = c.paper; ctx.strokeText(lab, hs.x, hs.y);
    ctx.fillStyle = c.brass; ctx.fillText(lab, hs.x, hs.y);
    ctx.font = "12px " + c.sans;
    data.forEach(function (d, i) {                     // upper left of the dot, else lower right, …
      var x = spots[i].x, y = spots[i].y;
      var sp = L.place(d.name, x, y, [{ dx: -6, dy: -11, align: "right" }, { dx: 6, dy: 11, align: "left" },
        { dx: -9, dy: 0, align: "right" }, { dx: 9, dy: 0, align: "left" }].concat(P.around(-0.71, -0.71, 12)));
      ctx.textAlign = sp.align;
      ctx.lineWidth = 3; ctx.strokeStyle = c.paper; ctx.strokeText(d.name, sp.x, sp.y);
      ctx.fillStyle = c.ink2; ctx.fillText(d.name, sp.x, sp.y);
    });
  });

  function update() {
    var T = Math.pow(a, 1.5);
    out.a.textContent = Orrery.fmt.number(a, a < 10 ? 2 : 1) + " au (" + Orrery.fmt.number(a * Ephem.AU_KM / 1e6, 0) + " million km)";
    out.t.textContent = Orrery.fmt.number(T, T < 10 ? 2 : 1) + " years (" + Orrery.fmt.number(T * 365.25, 0) + " days)";
    out.v.textContent = Orrery.fmt.number(29.78 / Math.sqrt(a), 1) + " km/s";
    var f = Math.abs(1 - 1 / T);
    if (f < 0.002) out.syn.textContent = "almost never: it keeps pace with Earth";
    else {
      var S = 1 / f;
      out.syn.textContent = Orrery.fmt.number(S, S < 10 ? 2 : 1) + " years (" + Orrery.fmt.number(S * 365.25, 0) + " days)" +
        (T < 1 ? ", or rather it laps Earth" : "");
    }
    cv.setAttribute("aria-valuenow", a.toFixed(2));
    cv.setAttribute("aria-valuetext", Orrery.fmt.number(a, 2) + " au from the Sun; its year is " +
      Orrery.fmt.number(T, 2) + " Earth years");
    view.redraw();
  }
  function setA(v) { a = Orrery.clamp(v, AMIN, AMAX); update(); }
  function aAt(px) {
    if (!box) return a;
    var f = (px - box.x0) / (box.x1 - box.x0);
    return Math.pow(10, lg(AMIN) + f * (lg(AMAX) - lg(AMIN)));
  }
  Orrery.drag(cv, {
    onStart: function (p) { setA(aAt(p.x)); },
    onMove: function (p) { setA(aAt(p.x)); },
    onNudge: function (dx, dy) { setA(a * Math.pow(10, 0.01 * (dx || -dy))); }
  });
  cv.addEventListener("keydown", function (e) {
    if (e.key === "Home") { setA(AMIN); e.preventDefault(); }
    else if (e.key === "End") { setA(AMAX); e.preventDefault(); }
  });
  cv.style.cursor = "ew-resize";
  update();
})();
