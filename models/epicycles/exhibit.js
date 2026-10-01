/* Exhibit: "Can circles draw anything?" (epicycles)
   One IIFE per figure, using the shared kit (window.Orrery). */

/* ---- Shared helpers ------------------------------------------------------ */
var Epi = (function () {
  "use strict";
  var TAU = Math.PI * 2;
  // Resample a closed polyline (array of [x, y]) to m points evenly spaced by arc length.
  function resample(pts, m) {
    var n = pts.length, cum = [0], i;
    for (i = 1; i <= n; i++) {
      var a = pts[i - 1], b = pts[i % n];
      cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    var total = cum[n], out = [], seg = 0;
    if (total <= 0) return null;
    for (var k = 0; k < m; k++) {
      var s = total * k / m;
      while (seg < n - 1 && cum[seg + 1] < s) seg++;
      var p = pts[seg], q = pts[(seg + 1) % n], len = cum[seg + 1] - cum[seg];
      var f = len > 0 ? (s - cum[seg]) / len : 0;
      out.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
    }
    return out;
  }
  // Centre on the bounding box and scale so the larger half-extent is 1.
  function normalise(pts) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(function (p) {
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    });
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, s = Math.max(x1 - x0, y1 - y0) / 2 || 1;
    return pts.map(function (p) { return [(p[0] - cx) / s, (p[1] - cy) / s]; });
  }
  // Discrete Fourier transform of m complex points z_j = x_j + i y_j.
  // Returns [{k, re, im, r, phase}] for k = -m/2 .. m/2-1, c_k = (1/m) sum z_j e^{-2 pi i k j / m}.
  function dft(pts) {
    var m = pts.length, out = [];
    for (var k = -Math.floor(m / 2); k < Math.ceil(m / 2); k++) {
      var re = 0, im = 0;
      for (var j = 0; j < m; j++) {
        var a = -TAU * k * j / m, c = Math.cos(a), s = Math.sin(a);
        re += pts[j][0] * c - pts[j][1] * s;
        im += pts[j][0] * s + pts[j][1] * c;
      }
      re /= m; im /= m;
      out.push({ k: k, re: re, im: im, r: Math.hypot(re, im), phase: Math.atan2(im, re) });
    }
    return out;
  }
  return { TAU: TAU, resample: resample, normalise: normalise, dft: dft };
})();

/* ---- Figure 1: an arrow on an arrow, and retrograde motion ---------------
   Earth at the centre. Big arrow (deferent) length 1, one turn per 686.98 days
   (Mars's mean motion). Small arrow (epicycle) length b, turning k times as fast.
   Defaults b = 1/1.524, k = 686.98/365.256: exactly Mars and Earth on circles. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("retro-canvas");
  if (!canvasEl) return;
  var TAU = Epi.TAU;
  var P1 = 686.98;                         // days per turn of the big arrow
  var w1 = TAU / P1;                       // rad/day
  var b = 1 / 1.524, k = 686.98 / 365.256;
  var DAYS_PER_SEC = 70;
  var TRAIL_DAYS = 1600, SKY_DAYS = 300, DT = 2;   // days
  var t = 0, th1 = 0, th2 = 0;
  var trail = [];                          // {t, x, y, lam, back}
  var out = {
    day: document.getElementById("retro-day"),
    dir: document.getElementById("retro-dir"),
    moving: document.getElementById("retro-moving"),
    loop: document.getElementById("retro-loop"),
    every: document.getElementById("retro-every")
  };

  function w2() { return k * w1; }
  function rate(psi) {                     // d(direction)/dt numerator, sign = forward/backward
    return w1 + b * b * w2() + b * (w1 + w2()) * Math.cos(psi);
  }
  function sample() {
    var x = Math.cos(th1) + b * Math.cos(th2), y = Math.sin(th1) + b * Math.sin(th2);
    trail.push({ t: t, x: x, y: y, lam: Math.atan2(y, x), back: rate(th2 - th1) < 0 });
    while (trail.length > 2 && t - trail[0].t > TRAIL_DAYS) trail.shift();
  }
  function advance(days) {
    t += days; th1 += w1 * days; th2 += w2() * days;
  }

  // Start 20 days after an opposition (small arrow pointing back at Earth), with history.
  (function init() {
    var start = -TRAIL_DAYS;
    th1 = w1 * start;
    th2 = Math.PI + (w2() - w1) * 20 + w2() * start;   // psi = pi at t = -20
    t = start;
    while (t < 0) { sample(); advance(DT); }
    t = 0; sample();
  })();

  // Length and angular size of each backward stretch, for the current b and k.
  function loopStats() {
    var rel = w2() - w1;
    if (b <= 0 || Math.abs(rel) < 1e-9) return null;
    var num = w1 + b * b * w2(), den = b * (w1 + w2());
    var c = -num / den;                    // backward while cos(psi) < c
    if (c <= -1) return { none: true, every: TAU / Math.abs(rel) };
    var a0 = Math.acos(Math.min(1, c)), n = 2000, arc = 0;
    for (var i = 0; i < n; i++) {
      var psi = a0 + (TAU - 2 * a0) * (i + 0.5) / n;
      var z2 = 1 + b * b + 2 * b * Math.cos(psi);
      arc += rate(psi) / z2 * ((TAU - 2 * a0) / n) / Math.abs(rel);
    }
    return { days: (TAU - 2 * a0) / Math.abs(rel), deg: Math.abs(arc) * 180 / Math.PI, every: TAU / Math.abs(rel) };
  }
  function updateStats() {
    var s = loopStats();
    if (!s) { out.loop.textContent = "none"; out.every.textContent = "—"; return; }
    out.every.textContent = Orrery.fmt.number(s.every, 0) + " days";
    out.loop.textContent = s.none ? "none" :
      Orrery.fmt.number(s.days, 0) + " days, " + Orrery.fmt.number(s.deg, 1) + "°";
  }

  var view = Orrery.canvas(canvasEl, function (ctx, w, h) {
    if (w < 80 || h < 80) return;          // not laid out yet
    var c = Orrery.tokens();
    var cx = w / 2, cy = h / 2;
    var ringR = Math.min(w, h) / 2 - 14;
    var S = (ringR - 18) / 2;              // px per unit (max reach 1 + 1 = 2)
    function X(x) { return cx + x * S; }
    function Y(y) { return cy - y * S; }
    var cur = trail[trail.length - 1];

    // sky ring with a tick every 30 degrees
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, TAU); ctx.stroke();
    for (var d = 0; d < 360; d += 30) {
      var a = d * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx + (ringR - 5) * Math.cos(a), cy - (ringR - 5) * Math.sin(a));
      ctx.lineTo(cx + (ringR + 5) * Math.cos(a), cy - (ringR + 5) * Math.sin(a));
      ctx.stroke();
    }
    // deferent circle
    ctx.strokeStyle = c.rule; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, S, 0, TAU); ctx.stroke(); ctx.setLineDash([]);

    // path traced by the planet
    ctx.lineWidth = 1.5;
    for (var i = 1; i < trail.length; i++) {
      var p = trail[i - 1], q = trail[i];
      var age = (t - q.t) / TRAIL_DAYS;
      ctx.globalAlpha = 0.25 + 0.75 * (1 - age);
      ctx.strokeStyle = q.back ? c.alarm : c.verdigris;
      ctx.beginPath(); ctx.moveTo(X(p.x), Y(p.y)); ctx.lineTo(X(q.x), Y(q.y)); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // where the planet appears on the sky ring: recent history as marks
    for (i = 0; i < trail.length; i++) {
      var s = trail[i];
      if (t - s.t > SKY_DAYS) continue;
      var r0 = ringR - 4, r1 = ringR + 4;
      ctx.strokeStyle = s.back ? c.alarm : c.brass;
      ctx.globalAlpha = 0.3 + 0.7 * (1 - (t - s.t) / SKY_DAYS);
      ctx.lineWidth = s.back ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(cx + r0 * Math.cos(s.lam), cy - r0 * Math.sin(s.lam));
      ctx.lineTo(cx + r1 * Math.cos(s.lam), cy - r1 * Math.sin(s.lam));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // line of sight from Earth through the planet to the sky
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + ringR * Math.cos(cur.lam), cy - ringR * Math.sin(cur.lam)); ctx.stroke();
    ctx.setLineDash([]);

    // the two arrows
    var ex = Math.cos(th1), ey = Math.sin(th1);
    arrow(ctx, X(0), Y(0), X(ex), Y(ey), c.ink2, 2.5);
    if (b > 0) {
      ctx.strokeStyle = c.ink3; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(X(ex), Y(ey), b * S, 0, TAU); ctx.stroke();
      arrow(ctx, X(ex), Y(ey), X(cur.x), Y(cur.y), c.brass, 2);
    }
    // Earth and planet
    ctx.fillStyle = c.verdigrisLit || c.verdigris;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = cur.back ? c.alarm : c.brassLit;
    ctx.beginPath(); ctx.arc(X(cur.x), Y(cur.y), 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = c.brass; ctx.stroke();

    ctx.fillStyle = c.ink2; ctx.font = "12px " + c.sans; ctx.textAlign = "left";
    ctx.textAlign = "right"; ctx.fillText("Earth", cx - 9, cy + 18); ctx.textAlign = "left";
    ctx.fillText("planet", X(cur.x) + 9, Y(cur.y) + 16);
    ctx.fillStyle = c.ink3; ctx.textAlign = "right";
    ctx.fillText("sky", w - 4, 14);

    // readouts
    out.day.textContent = "day " + Orrery.fmt.number(t, 0);
    var deg = ((cur.lam * 180 / Math.PI) % 360 + 360) % 360;
    out.dir.textContent = Orrery.fmt.number(deg, 0) + "°";
    out.moving.textContent = cur.back ? "backward (retrograde)" : "forward";
    out.moving.style.color = cur.back ? "var(--alarm)" : "";
  });

  function arrow(ctx, x0, y0, x1, y1, col, lw) {
    var a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0), hl = Math.min(9, L * 0.35);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - hl * 0.8 * Math.cos(a), y1 - hl * 0.8 * Math.sin(a)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - hl * Math.cos(a - 0.4), y1 - hl * Math.sin(a - 0.4));
    ctx.lineTo(x1 - hl * Math.cos(a + 0.4), y1 - hl * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
  }

  var acc = 0;
  Orrery.loop(canvasEl, function (dt) {
    acc += dt * DAYS_PER_SEC;
    while (acc >= DT) { advance(DT); sample(); acc -= DT; }
    view.redraw();
  }, { button: document.getElementById("retro-play") });

  // Recompute the recent path as if the arrows had always had the current settings.
  function rebuildTrail() {
    var T = t, A = th1, B = th2;
    trail = [];
    for (var d = TRAIL_DAYS; d >= 0; d -= DT) {
      t = T - d; th1 = A - w1 * d; th2 = B - w2() * d; sample();
    }
    t = T; th1 = A; th2 = B;
  }
  Orrery.bindRange(document.getElementById("retro-b"), document.getElementById("retro-b-out"), {
    format: function (v) { return Orrery.fmt.number(v, 2) + "×"; },
    onInput: function (v) {
      if (Math.abs(v - b) < 0.005) { updateStats(); return; }
      b = v; rebuildTrail(); updateStats(); view.redraw();
    }
  });
  Orrery.bindRange(document.getElementById("retro-k"), document.getElementById("retro-k-out"), {
    format: function (v) { return Orrery.fmt.number(v, 2) + "×"; },
    onInput: function (v) {
      if (Math.abs(v - k) < 0.005) { updateStats(); return; }
      k = v; rebuildTrail(); updateStats(); view.redraw();
    }
  });
  document.getElementById("retro-mars").addEventListener("click", function () {
    var bi = document.getElementById("retro-b"), ki = document.getElementById("retro-k");
    bi.value = 0.66; ki.value = 1.88;
    bi.dispatchEvent(new Event("input")); ki.dispatchEvent(new Event("input"));
    b = 1 / 1.524; k = 686.98 / 365.256; rebuildTrail(); updateStats(); view.redraw();
  });
  updateStats();
})();

/* ---- Figure 2: a square wave from circles --------------------------------
   Circle n (n = 1, 3, 5, ...) has radius 4/(pi n) and turns n times as fast.
   The height of the chain's tip is the Fourier partial sum of a square wave
   that switches between +1 and -1. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("sq-canvas");
  if (!canvasEl) return;
  var TAU = Epi.TAU;
  var N = 4, angle = 0.6, SPEED = 0.2;     // circles; radians; turns per second
  var input = document.getElementById("sq-n");
  var outPeak = document.getElementById("sq-peak");
  var outOver = document.getElementById("sq-over");
  var outFreq = document.getElementById("sq-top");

  function partial(th) {
    var s = 0;
    for (var j = 0; j < N; j++) { var n = 2 * j + 1; s += Math.sin(n * th) / n; }
    return 4 / Math.PI * s;
  }
  function stats() {
    var best = -Infinity;                 // highest point of the partial sum on (0, pi)
    for (var i = 1; i < 4000; i++) best = Math.max(best, partial(Math.PI * i / 4000));
    outPeak.textContent = Orrery.fmt.number(best, 3);
    outOver.textContent = Orrery.fmt.percent((best - 1) / 2, 2);
    outFreq.textContent = Orrery.fmt.number(2 * N - 1, 0) + "×";
  }

  var view = Orrery.canvas(canvasEl, function (ctx, w, h) {
    if (w < 80 || h < 30) return;
    var c = Orrery.tokens();
    var R = h * 0.3, cy = h / 2, cx = R * 1.35 + 12;
    var x0 = cx + R * 1.45 + 10, x1 = w - 10;
    var perPx = TAU * 1.5 / Math.max(1, x1 - x0);   // show 1.5 turns of history

    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - R * 1.3, cy); ctx.lineTo(x1, cy); ctx.stroke();

    // chain of circles
    var x = cx, y = cy;
    for (var j = 0; j < N; j++) {
      var n = 2 * j + 1, r = R * 4 / (Math.PI * n);
      ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.globalAlpha = j < 12 ? 0.8 : 0.35;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      var nx = x + r * Math.cos(n * angle), ny = y - r * Math.sin(n * angle);
      ctx.globalAlpha = 1; ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
      x = nx; y = ny;
    }
    ctx.globalAlpha = 1;

    // the ideal square wave (faint) and the circles' version
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1.5; ctx.beginPath();
    for (var px = x0; px <= x1; px += 1) {
      var th = angle - (px - x0) * perPx;
      var sq = Math.sin(th) >= 0 ? 1 : -1;
      if (px === x0) ctx.moveTo(px, cy - R * sq); else ctx.lineTo(px, cy - R * sq);
    }
    ctx.stroke();
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2; ctx.beginPath();
    for (px = x0; px <= x1; px += 1) {
      var v = partial(angle - (px - x0) * perPx);
      if (px === x0) ctx.moveTo(px, cy - R * v); else ctx.lineTo(px, cy - R * v);
    }
    ctx.stroke();

    ctx.setLineDash([4, 4]); ctx.strokeStyle = c.ink3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x0, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = c.brassLit; ctx.strokeStyle = c.brass;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); ctx.stroke();

    ctx.fillStyle = c.ink3; ctx.font = "12px " + c.sans; ctx.textAlign = "right";
    ctx.fillText("+1", x1, cy - R - 8);
    ctx.fillText("−1", x1, cy + R + 18);
  });

  Orrery.loop(canvasEl, function (dt) {
    angle = (angle + TAU * SPEED * dt) % TAU;
    view.redraw();
  }, { button: document.getElementById("sq-play") });

  var range = Orrery.bindRange(input, document.getElementById("sq-n-out"), {
    format: function (v) { return v === 1 ? "1 circle" : v + " circles"; },
    onInput: function (v) { N = Math.round(v); stats(); view.redraw(); }
  });
  document.getElementById("sq-add").addEventListener("click", function () {
    range.set(N >= 50 ? 1 : N + 1);
    N = Math.round(range.value()); stats(); view.redraw();
  });
})();

/* ---- Figure 3: draw your own ---------------------------------------------
   The shape is resampled to M points evenly spaced along its length, turned
   into M rotating arrows by the discrete Fourier transform, and redrawn using
   the largest ones. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("draw-canvas");
  if (!canvasEl) return;
  var TAU = Epi.TAU, M = 256, CURVE = 512, PERIOD = 12;   // seconds per full drawing
  var shape = null, coeffs = [], N = 12, phase = 0, curve = [];
  var drawing = null;                                     // points being drawn, in shape units
  var tf = { cx: 0, cy: 0, s: 1 };
  var outErr = document.getElementById("draw-err");
  var outShare = document.getElementById("draw-share");
  var recipe = document.getElementById("draw-recipe");
  var status = document.getElementById("draw-status");

  var PRESETS = {
    heart: function (u) {
      var s = Math.sin(u);
      return [16 * s * s * s, 13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)];
    },
    star: poly(function () {
      var p = [];
      for (var i = 0; i < 10; i++) {
        var a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.4 : 1;
        p.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      return p;
    }()),
    square: poly([[-1, -1], [1, -1], [1, 1], [-1, 1]]),
    eight: function (u) { return [Math.sin(u), Math.sin(u) * Math.cos(u)]; }
  };
  function poly(corners) { return { corners: corners }; }
  function presetPoints(name) {
    var p = PRESETS[name];
    if (p.corners) return p.corners;
    var pts = [];
    for (var i = 0; i < 1000; i++) pts.push(p(TAU * i / 1000));
    return pts;
  }

  function setShape(pts, label) {
    var r = Epi.resample(pts, M);
    if (!r) return;
    shape = Epi.normalise(r);
    var all = Epi.dft(shape);
    var dc = all.filter(function (q) { return q.k === 0; })[0];
    var rest = all.filter(function (q) { return q.k !== 0; });
    rest.sort(function (a, b) { return b.r - a.r; });
    coeffs = [dc].concat(rest);
    phase = 0.6;
    status.textContent = "Showing: " + label + ".";
    rebuild();
  }
  // Point on the partial sum with the centre term plus the n largest circles.
  function evalAt(u, n) {
    var x = 0, y = 0;
    for (var i = 0; i <= n && i < coeffs.length; i++) {
      var q = coeffs[i], a = q.phase + TAU * q.k * u;
      x += q.r * Math.cos(a); y += q.r * Math.sin(a);
    }
    return [x, y];
  }
  function rebuild() {
    curve = [];
    for (var i = 0; i <= CURVE; i++) curve.push(evalAt(i / CURVE, N));
    // average gap between the circles' drawing and the shape, at matching points
    var err = 0;
    for (var j = 0; j < M; j++) {
      var e = evalAt(j / M, N);
      err += Math.hypot(e[0] - shape[j][0], e[1] - shape[j][1]);
    }
    outErr.textContent = Orrery.fmt.percent(err / M / 2, 1);
    // share of the shape's "energy" (sum of squared radii, centre excluded) in the circles used
    var tot = 0, used = 0;
    for (var k = 1; k < coeffs.length; k++) { tot += coeffs[k].r * coeffs[k].r; if (k <= N) used += coeffs[k].r * coeffs[k].r; }
    outShare.textContent = Orrery.fmt.percent(tot ? used / tot : 1, 1);
    // the recipe: largest circles first
    var rows = "";
    for (var m = 1; m <= Math.min(8, coeffs.length - 1); m++) {
      var q = coeffs[m], deg = Math.round(((q.phase * 180 / Math.PI) % 360 + 360) % 360) % 360;
      rows += "<tr" + (m > N ? ' class="unused"' : "") + "><td>" + m + "</td><td>" +
        Orrery.fmt.signed(q.k, 0) + "</td><td>" + Orrery.fmt.number(q.r / 2 * 100, 1) +
        "%</td><td>" + Orrery.fmt.number(deg, 0) + "°</td></tr>";
    }
    recipe.innerHTML = rows;
    view.redraw();
  }

  var view = Orrery.canvas(canvasEl, function (ctx, w, h) {
    if (w < 40 || h < 40) return;
    var c = Orrery.tokens();
    tf.cx = w / 2; tf.cy = h / 2; tf.s = Math.min(w, h) * 0.4;
    function X(x) { return tf.cx + x * tf.s; }
    function Y(y) { return tf.cy - y * tf.s; }
    var i;
    if (drawing) {
      ctx.strokeStyle = c.brass; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.beginPath();
      for (i = 0; i < drawing.length; i++) {
        if (i === 0) ctx.moveTo(X(drawing[i][0]), Y(drawing[i][1])); else ctx.lineTo(X(drawing[i][0]), Y(drawing[i][1]));
      }
      ctx.stroke();
      return;
    }
    if (!shape) return;
    // the original shape
    ctx.strokeStyle = c.rule; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.beginPath();
    for (i = 0; i <= M; i++) {
      var p = shape[i % M];
      if (i === 0) ctx.moveTo(X(p[0]), Y(p[1])); else ctx.lineTo(X(p[0]), Y(p[1]));
    }
    ctx.stroke();
    // the full path of the circles (faint), then the part drawn so far this turn
    ctx.strokeStyle = c.verdigris; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.5; ctx.beginPath();
    for (i = 0; i <= CURVE; i++) {
      if (i === 0) ctx.moveTo(X(curve[i][0]), Y(curve[i][1])); else ctx.lineTo(X(curve[i][0]), Y(curve[i][1]));
    }
    ctx.stroke(); ctx.globalAlpha = 1;
    var upto = Math.floor(phase * CURVE);
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (i = 0; i <= upto; i++) {
      if (i === 0) ctx.moveTo(X(curve[i][0]), Y(curve[i][1])); else ctx.lineTo(X(curve[i][0]), Y(curve[i][1]));
    }
    var tip = evalAt(phase, N);
    ctx.lineTo(X(tip[0]), Y(tip[1])); ctx.stroke();
    // the chain of arrows and circles
    var x = coeffs[0].re, y = coeffs[0].im;
    for (i = 1; i <= N && i < coeffs.length; i++) {
      var q = coeffs[i], a = q.phase + TAU * q.k * phase;
      var nx = x + q.r * Math.cos(a), ny = y + q.r * Math.sin(a), rp = q.r * tf.s;
      if (rp > 1.5) {
        ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.globalAlpha = i <= 10 ? 0.7 : 0.3;
        ctx.beginPath(); ctx.arc(X(x), Y(y), rp, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = c.ink2; ctx.lineWidth = i <= 10 ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(nx), Y(ny)); ctx.stroke();
      x = nx; y = ny;
    }
    ctx.fillStyle = c.brassLit; ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(X(x), Y(y), 4.5, 0, TAU); ctx.fill(); ctx.stroke();
  });

  var loop = Orrery.loop(canvasEl, function (dt) {
    phase = (phase + dt / PERIOD) % 1;
    view.redraw();
  }, { button: document.getElementById("draw-play") });

  function toShape(p) { return [(p.x - tf.cx) / tf.s, -(p.y - tf.cy) / tf.s]; }
  Orrery.drag(canvasEl.parentNode, {
    onStart: function (p) { drawing = [toShape(p)]; status.textContent = "Drawing…"; view.redraw(); },
    onMove: function (p) {
      if (!drawing) return;
      var q = toShape(p), last = drawing[drawing.length - 1];
      if (Math.hypot(q[0] - last[0], q[1] - last[1]) * tf.s > 1.5) drawing.push(q);
      view.redraw();
    },
    onEnd: function () {
      var d = drawing; drawing = null;
      var len = 0;
      if (d) for (var i = 1; i < d.length; i++) len += Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]);
      if (!d || d.length < 8 || len * tf.s < 60) {
        status.textContent = "That was too short to use — draw a bigger loop.";
        view.redraw(); return;
      }
      setShape(d, "your drawing");
      if (!Orrery.reducedMotion()) loop.play();
    }
  });

  Orrery.bindRange(document.getElementById("draw-n"), document.getElementById("draw-n-out"), {
    format: function (v) { return v === 1 ? "1 circle" : v + " circles"; },
    onInput: function (v) { N = Math.round(v); if (shape) rebuild(); }
  });
  var names = { heart: "a heart", star: "a star", square: "a square", eight: "a figure eight" };
  Array.prototype.forEach.call(document.querySelectorAll("[data-preset]"), function (btn) {
    btn.addEventListener("click", function () {
      var name = btn.getAttribute("data-preset");
      setShape(presetPoints(name), names[name]);
    });
  });
  setShape(presetPoints("heart"), "a heart");
})();
