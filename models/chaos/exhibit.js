/* Exhibit script: "Why can't we forecast the weather a month ahead?"
   Physics lives in model.js (window.DP). One IIFE per figure. */

/* ---- shared helpers ------------------------------------------------------ */
var Chaos = (function () {
  "use strict";
  var D = Math.PI / 180;
  var SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
  function sup(n) { return String(n).split("").map(function (c) { return SUP[c] || c; }).join(""); }
  function pow10(k) { return "10" + sup("-" + k); }         // k = 6 -> "10⁻⁶"
  function sci(x, digits) {                                   // 2.3e-10 -> "2.3 × 10⁻¹⁰"
    if (x === 0) return "0";
    var e = Math.floor(Math.log10(Math.abs(x))), m = x / Math.pow(10, e);
    if (e >= -2 && e <= 3) return Orrery.fmt.number(x, Math.max(0, digits - e));
    return Orrery.fmt.number(m, digits) + " × 10" + sup(e);
  }
  function deg(rad) {                                         // angle in (−180°, 180°]
    return Orrery.fmt.number(DP.wrap(rad) / D, 0) + "°";
  }
  // Pendulum geometry on a canvas w × h: pivot in the middle, 2 m reach each way.
  function geom(w, h) {
    var reach = DP.P.L1 + DP.P.L2;
    return { cx: w / 2, cy: h / 2, s: Math.min(w, h) / (2 * reach + 0.35) };
  }
  function bobs(g, st) {
    var x1 = g.cx + g.s * DP.P.L1 * Math.sin(st[0]), y1 = g.cy + g.s * DP.P.L1 * Math.cos(st[0]);
    var x2 = x1 + g.s * DP.P.L2 * Math.sin(st[1]), y2 = y1 + g.s * DP.P.L2 * Math.cos(st[1]);
    return [x1, y1, x2, y2];
  }
  function drawPendulum(ctx, g, st, rodColor, bobFill, bobStroke, r) {
    var b = bobs(g, st);
    ctx.strokeStyle = rodColor; ctx.lineWidth = Math.max(1.5, r * 0.3); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(b[0], b[1]); ctx.lineTo(b[2], b[3]); ctx.stroke();
    ctx.fillStyle = bobFill;
    ctx.beginPath(); ctx.arc(b[0], b[1], r, 0, Orrery.TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(b[2], b[3], r, 0, Orrery.TAU); ctx.fill();
    if (bobStroke) {
      ctx.strokeStyle = bobStroke; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b[0], b[1], r, 0, Orrery.TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(b[2], b[3], r, 0, Orrery.TAU); ctx.stroke();
    }
    return b;
  }
  function drawPivot(ctx, g, c) {
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.s * (DP.P.L1 + DP.P.L2), 0, Orrery.TAU); ctx.stroke();
    ctx.fillStyle = c.ink3;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, 4, 0, Orrery.TAU); ctx.fill();
  }
  function dark() { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
  var BIG = [143 * D, 86 * D, 0, 0], SMALL = [10 * D, 10 * D, 0, 0];
  return { D: D, sup: sup, pow10: pow10, sci: sci, deg: deg, geom: geom, bobs: bobs,
           drawPendulum: drawPendulum, drawPivot: drawPivot, dark: dark, BIG: BIG, SMALL: SMALL };
})();

/* ---- Figure 1: one double pendulum, drag to set the start ----------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("pend-canvas");
  if (!canvasEl) return;
  var D = Chaos.D, DT = DP.DT;
  var start = Chaos.BIG.slice(), s = start.slice(), t = 0, acc = 0, E0 = DP.energy(s);
  var trail = [], TRAIL_MAX = 300, trailClock = 0;         // lower-bob positions (metres), every 10 ms
  var grabbed = 0;                                          // 0 none, 1 upper, 2 lower
  var outT = document.getElementById("pend-t"), outA = document.getElementById("pend-th1"),
      outB = document.getElementById("pend-th2"), outE = document.getElementById("pend-e");

  var view = Orrery.canvas(canvasEl, draw);

  function pushTrail() {
    var x = DP.P.L1 * Math.sin(s[0]) + DP.P.L2 * Math.sin(s[1]);
    var y = DP.P.L1 * Math.cos(s[0]) + DP.P.L2 * Math.cos(s[1]);
    trail.push(x, y);
    if (trail.length > 2 * TRAIL_MAX) trail.splice(0, trail.length - 2 * TRAIL_MAX);
  }

  function draw(ctx, w, h) {
    var c = Orrery.tokens(), g = Chaos.geom(w, h);
    Chaos.drawPivot(ctx, g, c);
    var n = trail.length / 2;
    if (n > 1) {
      ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.strokeStyle = c.verdigris;
      for (var i = 1; i < n; i++) {
        ctx.globalAlpha = 0.08 + 0.8 * i / n;
        ctx.beginPath();
        ctx.moveTo(g.cx + g.s * trail[2 * i - 2], g.cy + g.s * trail[2 * i - 1]);
        ctx.lineTo(g.cx + g.s * trail[2 * i], g.cy + g.s * trail[2 * i + 1]);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    Chaos.drawPendulum(ctx, g, s, c.ink2, c.brassLit, c.brass, Math.max(7, g.s * 0.09));
    if (t === 0 && !grabbed) {
      ctx.fillStyle = c.ink3; ctx.font = "13px " + c.sans; ctx.textAlign = "left";
      ctx.fillText("Drag a weight", 10, 20);
    }
    outT.textContent = Orrery.fmt.number(t, 1) + " s";
    outA.textContent = Chaos.deg(s[0]);
    outB.textContent = Chaos.deg(s[1]);
    outE.textContent = E0 > 1e-9 ? Chaos.sci(Math.abs(DP.energy(s) - E0) / E0, 1) : "—";
  }

  function restart() {
    s = start.slice(); t = 0; acc = 0; E0 = DP.energy(s); trail = []; trailClock = 0;
    pushTrail(); view.redraw();
  }

  function step(dt) {
    if (grabbed) return;
    acc += dt;
    while (acc >= DT) {
      DP.rk4(s, DT); t += DT; acc -= DT; trailClock += DT;
      if (trailClock >= 0.01) { trailClock -= 0.01; pushTrail(); }
    }
    view.redraw();
  }

  var loop = Orrery.loop(canvasEl, step, { button: document.getElementById("pend-play") });

  var r1, r2;
  function setStart(a1, a2, fromSliders) {
    start = [a1, a2, 0, 0];
    if (!fromSliders) {
      r1.set(Math.round(DP.wrap(a1) / D), false);
      r2.set(Math.round(DP.wrap(a2) / D), false);
    }
    restart();
  }
  function fmtDeg(v) { return Orrery.fmt.number(v, 0) + "°"; }
  r1 = Orrery.bindRange(document.getElementById("pend-a1"), document.getElementById("pend-a1-out"), {
    format: fmtDeg, init: false,
    onInput: function (v) { setStart(v * D, start[1], true); } });
  r2 = Orrery.bindRange(document.getElementById("pend-a2"), document.getElementById("pend-a2-out"), {
    format: fmtDeg, init: false,
    onInput: function (v) { setStart(start[0], v * D, true); } });

  document.getElementById("pend-restart").addEventListener("click", restart);
  document.getElementById("pend-small").addEventListener("click", function () {
    setStart(Chaos.SMALL[0], Chaos.SMALL[1]); loop.play(); });
  document.getElementById("pend-big").addEventListener("click", function () {
    setStart(Chaos.BIG[0], Chaos.BIG[1]); loop.play(); });

  function angleFrom(p, ox, oy) { return Math.atan2(p.x - ox, p.y - oy); }
  Orrery.drag(canvasEl, {
    hitTest: function (p) {
      var r = canvasEl.getBoundingClientRect(), g = Chaos.geom(r.width, r.height), b = Chaos.bobs(g, s);
      var tol = Math.max(22, g.s * 0.16);
      return Math.hypot(p.x - b[2], p.y - b[3]) < tol || Math.hypot(p.x - b[0], p.y - b[1]) < tol;
    },
    onStart: function (p) {
      var r = canvasEl.getBoundingClientRect(), g = Chaos.geom(r.width, r.height), b = Chaos.bobs(g, s);
      grabbed = Math.hypot(p.x - b[2], p.y - b[3]) <= Math.hypot(p.x - b[0], p.y - b[1]) ? 2 : 1;
      this.onMove(p);
    },
    onMove: function (p) {
      var r = canvasEl.getBoundingClientRect(), g = Chaos.geom(r.width, r.height), b = Chaos.bobs(g, s);
      if (grabbed === 1) setStart(angleFrom(p, g.cx, g.cy), s[1]);
      else if (grabbed === 2) setStart(s[0], angleFrom(p, b[0], b[1]));
    },
    onEnd: function () { grabbed = 0; restart(); loop.play(); },
    onNudge: function (dx, dy) {                    // ←/→ upper rod, ↑/↓ lower rod, 1° a press
      setStart(start[0] + dx * D, start[1] - dy * D);
    }
  });
  canvasEl.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown");
  restart();
})();

/* ---- Figure 2: twenty twins ------------------------------------------------ */
(function () {
  "use strict";
  var canvasEl = document.getElementById("twins-canvas");
  if (!canvasEl) return;
  var D = Chaos.D, DT = DP.DT, N = 20, APART = 5 * D;
  var delta = 1e-6, P = [], t = 0, acc = 0, apartAt = null;
  var outT = document.getElementById("twins-t"), outS = document.getElementById("twins-spread"),
      outA = document.getElementById("twins-apart");
  var view = null;

  function spread() {                                // widest lower-rod angle from pendulum 0
    var m = 0;
    for (var i = 1; i < N; i++) m = Math.max(m, Math.abs(DP.wrap(P[i][1] - P[0][1])));
    return m;
  }
  function colour(i, alpha) {
    var hue = 200 - 190 * i / (N - 1);             // blue → orange-red
    return "hsla(" + hue.toFixed(0) + "," + (Chaos.dark() ? "70%,62%" : "70%,37%") + "," + alpha + ")";
  }
  function draw(ctx, w, h) {
    var c = Orrery.tokens(), g = Chaos.geom(w, h), r = Math.max(4, g.s * 0.055);
    Chaos.drawPivot(ctx, g, c);
    for (var i = N - 1; i >= 0; i--) Chaos.drawPendulum(ctx, g, P[i], colour(i, 0.55), colour(i, 0.9), null, r);
    var sp = spread();
    outT.textContent = Orrery.fmt.number(t, 1) + " s";
    outS.textContent = sp < 0.01 * D ? Chaos.sci(sp / D, 1) + "°" : Orrery.fmt.number(sp / D, sp < D ? 2 : 0) + "°";
    outA.textContent = apartAt === null ? "not yet" : "at " + Orrery.fmt.number(apartAt, 1) + " s";
  }
  function restart() {
    P = [];
    for (var i = 0; i < N; i++) { var st = Chaos.BIG.slice(); st[0] += i * delta; P.push(st); }
    t = 0; acc = 0; apartAt = null; if (view) view.redraw();
  }
  function step(dt) {
    acc += dt;
    while (acc >= DT) {
      for (var i = 0; i < N; i++) DP.rk4(P[i], DT);
      t += DT; acc -= DT;
      if (apartAt === null && spread() > APART) apartAt = t;
    }
    view.redraw();
  }
  restart();
  view = Orrery.canvas(canvasEl, draw);
  var loop = Orrery.loop(canvasEl, step, { button: document.getElementById("twins-play"), autoplay: false });
  document.getElementById("twins-restart").addEventListener("click", function () { restart(); loop.play(); });
  Orrery.bindRange(document.getElementById("twins-k"), document.getElementById("twins-k-out"), {
    format: function (k) { return Chaos.pow10(k) + " rad"; },
    onInput: function (k) { delta = Math.pow(10, -k); restart(); }
  });
})();

/* ---- Figure 3: the forecast horizon --------------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("horizon-canvas");
  if (!canvasEl) return;
  var KS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], T = 40, TOL = 0.5;
  var YMIN = -13, YMAX = 1;                         // log10 of separation (rad)
  var runs = {}, which = "big", sel = 6;
  var outTime = document.getElementById("hz-time"), outGain = document.getElementById("hz-gain");
  var table = document.getElementById("hz-table");
  var headRow = table.tHead.rows[0], bodyRow = table.tBodies[0].rows[0], cells = [];
  KS.forEach(function (k) {
    var th = document.createElement("th"); th.scope = "col"; th.textContent = Chaos.pow10(k); headRow.appendChild(th);
    var td = document.createElement("td"); bodyRow.appendChild(td); cells.push(td);
  });

  // The twin runs (10 pairs × 40 s at 1 ms) are integrated lazily: only once the figure
  // comes near the screen, a few milliseconds per frame, so page load never stalls.
  var started = false, pending = false;
  function compute(name) {
    if (runs[name]) return runs[name];
    var st = name === "big" ? Chaos.BIG : Chaos.SMALL, out = {};
    KS.forEach(function (k) { out[k] = DP.twinJob(st, Math.pow(10, -k), T, DP.DT, 0.05, TOL); });
    return (runs[name] = out);
  }
  function allDone(data) { return KS.every(function (k) { return data[k].done; }); }
  function work() {
    pending = false;
    var data = compute(which), t0 = performance.now();
    var order = [sel].concat(KS.filter(function (k) { return k !== sel; }));
    for (var i = 0; i < order.length && performance.now() - t0 < 8; i++) {
      var job = data[order[i]];
      while (!job.done && performance.now() - t0 < 8) job.advance(10);
    }
    view.redraw();
    if (!allDone(data)) schedule();
  }
  function schedule() {
    if (!started || pending) return;
    pending = true;
    requestAnimationFrame(work);
  }
  function start() { if (!started) { started = true; schedule(); } }

  var pad = { l: 52, r: 12, t: 12, b: 34 };
  function frame(w, h) {
    var l = w < 480 ? 48 : pad.l;
    return { x0: l, x1: w - pad.r, y0: pad.t, y1: h - pad.b };
  }
  function X(f, time) { return f.x0 + (f.x1 - f.x0) * time / T; }
  function Y(f, lg) { return f.y1 - (f.y1 - f.y0) * (lg - YMIN) / (YMAX - YMIN); }

  function draw(ctx, w, h) {
    var c = Orrery.tokens(), f = frame(w, h), data = compute(which), small = w < 480;
    ctx.font = (small ? 10 : 12) + "px " + c.sans;
    // grid
    ctx.lineWidth = 1; ctx.strokeStyle = c.rule; ctx.fillStyle = c.ink3;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (var e = YMIN + 1; e <= YMAX; e++) {
      var y = Y(f, e);
      ctx.beginPath(); ctx.moveTo(f.x0, y); ctx.lineTo(f.x1, y); ctx.stroke();
      if ((e - YMAX) % (small ? 3 : 2) === 0) ctx.fillText(e === 0 ? "1" : "10" + Chaos.sup(e), f.x0 - 5, y);
    }
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (var s = 0; s <= T; s += 5) {
      var x = X(f, s);
      ctx.beginPath(); ctx.moveTo(x, f.y0); ctx.lineTo(x, f.y1); ctx.stroke();
      ctx.fillText(String(s), x, f.y1 + 4);
    }
    ctx.fillText("time (s)", (f.x0 + f.x1) / 2, f.y1 + (small ? 16 : 18));
    ctx.save(); ctx.translate(small ? 9 : 12, (f.y0 + f.y1) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "middle"; ctx.fillText("gap (rad)", 0, 0); ctx.restore();
    // failure line
    var yt = Y(f, Math.log10(TOL));
    ctx.setLineDash([6, 4]); ctx.strokeStyle = c.alarm; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(f.x0, yt); ctx.lineTo(f.x1, yt); ctx.stroke(); ctx.setLineDash([]);
    // curves, selected last
    ctx.save(); ctx.beginPath(); ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0); ctx.clip();
    KS.concat([sel]).forEach(function (k, idx) {
      var isSel = idx === KS.length, run = data[k];
      if (k === sel && !isSel) return;
      ctx.beginPath();
      for (var i = 0; i < run.filled; i++) {
        var lg = Math.log10(Math.max(run.sep[i], 1e-16));
        var px = X(f, i * run.every), py = Y(f, lg);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = isSel ? c.brass : c.ink3; ctx.globalAlpha = isSel ? 1 : 0.35;
      ctx.lineWidth = isSel ? 2.5 : 1.2; ctx.stroke(); ctx.globalAlpha = 1;
    });
    ctx.restore();
    var lab = "forecast fails (0.5 rad)", lw = ctx.measureText(lab).width, lh = small ? 14 : 17;
    ctx.fillStyle = c.paper; ctx.globalAlpha = 0.9;
    ctx.fillRect(f.x1 - lw - 10, yt + 3, lw + 8, lh); ctx.globalAlpha = 1;
    ctx.fillStyle = c.alarm; ctx.textAlign = "right"; ctx.textBaseline = "top";
    ctx.fillText(lab, f.x1 - 6, yt + 5);
    var r = data[sel];
    if (!allDone(data)) {
      ctx.fillStyle = c.ink3; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(started ? "computing…" : "", f.x0 + 6, f.y0 + 4);
    }
    if (r.horizon !== null) {
      var hx = X(f, r.horizon);
      ctx.fillStyle = c.brass; ctx.beginPath(); ctx.arc(hx, yt, 5, 0, Orrery.TAU); ctx.fill();
      ctx.strokeStyle = c.brass; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(hx, yt); ctx.lineTo(hx, f.y1); ctx.stroke(); ctx.setLineDash([]);
    }
    updateText(data);
  }

  function updateText(data) {
    var r = data[sel], xs = [], ys = [];
    outTime.textContent = r.horizon !== null ? Orrery.fmt.number(r.horizon, 1) + " s" :
      r.done ? "more than " + T + " s" : "computing…";
    KS.forEach(function (k, i) {
      var h = data[k].horizon;
      cells[i].textContent = h !== null ? Orrery.fmt.number(h, 1) : data[k].done ? "> " + T : "…";
      cells[i].className = k === sel ? "sel" : "";
      if (h !== null) { xs.push(k); ys.push(h); }
    });
    if (!allDone(data)) {
      outGain.textContent = "computing…";
    } else if (xs.length >= 3) {                           // least-squares slope: seconds per factor of 10
      var n = xs.length, mx = 0, my = 0, sxy = 0, sxx = 0, i;
      for (i = 0; i < n; i++) { mx += xs[i] / n; my += ys[i] / n; }
      for (i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
      outGain.textContent = "+" + Orrery.fmt.number(sxy / sxx, 1) + " s";
    } else {
      outGain.textContent = "no failure within " + T + " s";
    }
  }

  var view = Orrery.canvas(canvasEl, draw);
  var range = Orrery.bindRange(document.getElementById("hz-k"), document.getElementById("hz-k-out"), {
    format: function (k) { return Chaos.pow10(k) + " rad"; },
    onInput: function (k) { sel = k; view.redraw(); if (started) schedule(); }
  });
  document.getElementById("hz-start").addEventListener("change", function (e) {
    which = e.target.value; start(); schedule(); view.redraw();
  });
  // Tap or drag on the plot: pick the curve closest to the pointer.
  function pick(p) {
    var rect = canvasEl.getBoundingClientRect(), f = frame(rect.width, rect.height), data = compute(which);
    var i = Math.round(Orrery.clamp((p.x - f.x0) / (f.x1 - f.x0), 0, 1) * T / 0.05);
    var best = sel, bestD = Infinity;
    KS.forEach(function (k) {
      if (i >= data[k].filled) return;
      var d = Math.abs(Y(f, Math.log10(Math.max(data[k].sep[i], 1e-16))) - p.y);
      if (d < bestD) { bestD = d; best = k; }
    });
    if (best !== sel) range.set(best);
  }
  Orrery.drag(canvasEl, { onStart: function (p) { start(); pick(p); }, onMove: pick });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); start(); }
    }, { rootMargin: "800px 0px" });
    io.observe(canvasEl);
  } else {
    start();
  }
})();

/* ---- Figure 4: Lorenz's 1963 convection model, two twins ------------------
   dx/dt = σ(y − x), dy/dt = x(ρ − z) − y, dz/dt = xy − βz with Lorenz's values
   σ = 10, ρ = 28, β = 8/3. RK4 at a fixed step of 0.005 time units. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("lorenz-canvas");
  if (!canvasEl) return;
  var SIG = 10, RHO = 28, BETA = 8 / 3, H = 0.005, SPEED = 0.6, APART = 5, TRAIL = 700;
  var a, b, ta = [], tb = [], t = 0, acc = 0, delta = 1e-5, apartAt = null;
  var outT = document.getElementById("lz-t"), outD = document.getElementById("lz-d"),
      outA = document.getElementById("lz-apart");
  var k1 = [0, 0, 0], k2 = [0, 0, 0], k3 = [0, 0, 0], k4 = [0, 0, 0], tmp = [0, 0, 0];
  function f(s, o) { o[0] = SIG * (s[1] - s[0]); o[1] = s[0] * (RHO - s[2]) - s[1]; o[2] = s[0] * s[1] - BETA * s[2]; }
  function rk4(s) {
    var i; f(s, k1);
    for (i = 0; i < 3; i++) tmp[i] = s[i] + 0.5 * H * k1[i]; f(tmp, k2);
    for (i = 0; i < 3; i++) tmp[i] = s[i] + 0.5 * H * k2[i]; f(tmp, k3);
    for (i = 0; i < 3; i++) tmp[i] = s[i] + H * k3[i]; f(tmp, k4);
    for (i = 0; i < 3; i++) s[i] += H / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  function dist() { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  function restart() {
    a = [1, 1, 20]; b = [1 + delta, 1, 20]; ta = [a[0], a[2]]; tb = [b[0], b[2]];
    t = 0; acc = 0; apartAt = null;
    if (view) view.redraw();
  }
  function trailPath(ctx, tr, X, Y) {
    ctx.beginPath();
    for (var i = 0; i < tr.length; i += 2) { if (i === 0) ctx.moveTo(X(tr[i]), Y(tr[i + 1])); else ctx.lineTo(X(tr[i]), Y(tr[i + 1])); }
    ctx.stroke();
  }
  var bg = (function () {                     // a faint map of the attractor, drawn behind
    var s = [1, 1, 20], out = [];
    for (var i = 0; i < 8000; i++) { rk4(s); if (i % 2 === 0) out.push(s[0], s[2]); }
    return out;
  })();
  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var sc = Math.min(w / 50, h / 52), cx = w / 2, z0 = h / 2 + 25 * sc;   // x in −25…25, z in 0…50
    function X(x) { return cx + x * sc; }
    function Y(z) { return z0 - z * sc; }
    ctx.lineWidth = 1; ctx.strokeStyle = c.rule; trailPath(ctx, bg, X, Y);
    ctx.lineWidth = 1.4; ctx.lineJoin = "round";
    ctx.strokeStyle = c.brass; ctx.globalAlpha = 0.85; trailPath(ctx, ta, X, Y);
    ctx.strokeStyle = c.verdigris; ctx.globalAlpha = 0.85; trailPath(ctx, tb, X, Y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.brassLit; ctx.strokeStyle = c.brass;
    ctx.beginPath(); ctx.arc(X(a[0]), Y(a[2]), 6, 0, Orrery.TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.verdigrisLit || c.verdigris; ctx.strokeStyle = c.verdigris;
    ctx.beginPath(); ctx.arc(X(b[0]), Y(b[2]), 6, 0, Orrery.TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.ink3; ctx.font = "12px " + c.sans; ctx.textAlign = "left";
    ctx.fillText("x (sideways) against z (up)", 8, h - 8);
    outT.textContent = Orrery.fmt.number(t, 1);
    var d = dist();
    outD.textContent = d < 0.01 ? Chaos.sci(d, 1) : Orrery.fmt.number(d, 2);
    outA.textContent = apartAt === null ? "not yet" : "at t = " + Orrery.fmt.number(apartAt, 1);
  }
  function step(dt) {
    acc += dt * SPEED;
    while (acc >= H) {
      rk4(a); rk4(b); t += H; acc -= H;
      ta.push(a[0], a[2]); tb.push(b[0], b[2]);
      if (apartAt === null && dist() > APART) apartAt = t;
    }
    if (ta.length > 2 * TRAIL) { ta.splice(0, ta.length - 2 * TRAIL); tb.splice(0, tb.length - 2 * TRAIL); }
    view.redraw();
  }
  var view = null;
  restart();
  view = Orrery.canvas(canvasEl, draw);
  var loop = Orrery.loop(canvasEl, step, { button: document.getElementById("lz-play"), autoplay: false });
  document.getElementById("lz-restart").addEventListener("click", function () { restart(); loop.play(); });
  Orrery.bindRange(document.getElementById("lz-k"), document.getElementById("lz-k-out"), {
    format: function (k) { return Chaos.pow10(k); },
    onInput: function (k) { delta = Math.pow(10, -k); restart(); }
  });
})();
