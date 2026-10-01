/* Exhibit script for "Does a better gene always win?" — one IIFE per figure.
   The model (haploid Wright–Fisher) is in model.js as window.SelModel. */

/* Shared drawing helpers */
var SelDraw = (function () {
  "use strict";
  function axisText(ctx, c, txt, x, y, align, base) {
    ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans;
    ctx.textAlign = align || "center"; ctx.textBaseline = base || "top";
    ctx.fillText(txt, x, y);
  }
  function frame(ctx, c, x0, y0, x1, y1) {
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
  }
  // Split a canvas into two panels: side by side when wide, stacked when narrow.
  function panels(w, h, leftShare) {
    if (w >= 560) {
      var lw = Math.round(w * leftShare);
      return { stacked: false, a: { x: 0, y: 0, w: lw, h: h }, b: { x: lw, y: 0, w: w - lw, h: h } };
    }
    var ah = Math.round(h * 0.5);
    return { stacked: true, a: { x: 0, y: 0, w: w, h: ah }, b: { x: 0, y: ah, w: w, h: h - ah } };
  }
  var SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  // small numbers as "4.6 × 10⁻⁷"
  function sci(x) {
    var parts = x.toExponential(1).split("e");
    return parts[0] + " × 10" + String(Number(parts[1])).replace(/./g, function (ch) { return SUP[ch] || ch; });
  }
  function pct(p) {
    if (p === 0) return "0%";
    if (p < 0.0001) return sci(p);
    var d = p < 0.001 ? 3 : p < 0.01 ? 2 : 1;
    return Orrery.fmt.percent(p, d);
  }
  return { axisText: axisText, frame: frame, panels: panels, pct: pct, sci: sci };
})();

/* ---- Figure 1: drift alone ----------------------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("drift-canvas");
  if (!canvasEl) return;
  var M = window.SelModel, D = SelDraw;
  var POPS = 8, N = 50, r = M.rng(20261001);
  var pop1, counts, hist, gen, acc, done;
  var outGen = document.getElementById("drift-gen");
  var outDone = document.getElementById("drift-done");
  var outTh = document.getElementById("drift-theory");

  function reset() {
    pop1 = new Uint8Array(N);
    for (var i = 0; i < N; i++) pop1[i] = i < N / 2 ? 1 : 0;
    // shuffle so the colours start mixed
    for (i = N - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = pop1[i]; pop1[i] = pop1[j]; pop1[j] = t; }
    counts = []; hist = [];
    for (var k = 0; k < POPS; k++) { counts.push(N / 2); hist.push([0.5]); }
    gen = 0; acc = 0; done = 0;
    outTh.textContent = "about " + Orrery.fmt.number(1.386 * N, 0) + " generations";
  }

  function stepGen() {
    // population 1: every individual picks a random parent from the last generation
    var next = new Uint8Array(N), g = 0;
    for (var i = 0; i < N; i++) { next[i] = pop1[Math.floor(r() * N)]; g += next[i]; }
    pop1 = next; counts[0] = g;
    for (var k = 1; k < POPS; k++) counts[k] = M.nextCount(counts[k], N, 0, r);
    done = 0;
    for (k = 0; k < POPS; k++) {
      hist[k].push(counts[k] / N);
      if (counts[k] === 0 || counts[k] === N) done++;
    }
    gen++;
  }

  reset();
  var view = Orrery.canvas(canvasEl, draw);

  function draw(ctx, w, h) {
    var c = Orrery.tokens(), P = D.panels(w, h, 0.36);
    // dots
    var a = P.a, pad = 12, side = Math.min(a.w, a.h) - 2 * pad;
    var cols = Math.ceil(Math.sqrt(N)), rows = Math.ceil(N / cols), cell = side / cols;
    var ox = a.x + (a.w - cell * cols) / 2, oy = a.y + (a.h - cell * rows) / 2;
    for (var i = 0; i < N; i++) {
      var cx = ox + (i % cols + 0.5) * cell, cy = oy + (Math.floor(i / cols) + 0.5) * cell;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.5, cell * 0.38), 0, Orrery.TAU);
      ctx.fillStyle = pop1[i] ? c.brassLit : c.verdigrisLit; ctx.fill();
    }
    // frequency plot
    var b = P.b, x0 = b.x + 40, x1 = b.x + b.w - 10, y0 = b.y + 12, y1 = b.y + b.h - 26;
    var gmax = Math.max(Math.ceil(3 * N / 50) * 50, Math.ceil(gen / 50) * 50, 50);
    D.frame(ctx, c, x0, y0, x1, y1);
    ctx.strokeStyle = c.rule; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(x0, (y0 + y1) / 2); ctx.lineTo(x1, (y0 + y1) / 2); ctx.stroke();
    ctx.setLineDash([]);
    D.axisText(ctx, c, "100%", x0 - 5, y0, "right", "middle");
    D.axisText(ctx, c, "50%", x0 - 5, (y0 + y1) / 2, "right", "middle");
    D.axisText(ctx, c, "0%", x0 - 5, y1, "right", "middle");
    D.axisText(ctx, c, "0", x0, y1 + 6);
    D.axisText(ctx, c, Orrery.fmt.number(gmax, 0) + " generations", x1, y1 + 6, "right");
    D.axisText(ctx, c, "share of gold", x0 + 6, y0, "left");
    for (var k = POPS - 1; k >= 0; k--) {
      var hk = hist[k];
      ctx.beginPath();
      for (var g = 0; g < hk.length; g++) {
        var x = x0 + (x1 - x0) * g / gmax, y = y1 - (y1 - y0) * hk[g];
        if (g === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = k === 0 ? c.brass : c.ink3;
      ctx.globalAlpha = k === 0 ? 1 : 0.55;
      ctx.lineWidth = k === 0 ? 2.5 : 1.2; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    outGen.textContent = Orrery.fmt.number(gen, 0);
    outDone.textContent = done + " of " + POPS;
  }

  function step(dt) {
    if (done === POPS) return;
    acc += dt * Math.max(5, N / 8);           // generations per second
    var n = Math.floor(acc);
    if (n < 1) return;
    acc -= n;
    for (var i = 0; i < n && done < POPS; i++) stepGen();
    view.redraw();
  }

  function prerun() { for (var i = 0; i < Math.round(0.6 * N) && done < POPS; i++) stepGen(); }
  Orrery.loop(canvasEl, step, { button: document.getElementById("drift-play") });
  Orrery.bindRange(document.getElementById("drift-n"), document.getElementById("drift-n-out"), {
    format: function (v) { return Orrery.fmt.number(v, 0); },
    onInput: function (v) { N = v; reset(); view.redraw(); }
  });
  document.getElementById("drift-reset").addEventListener("click", function () { reset(); view.redraw(); });
  prerun(); view.redraw();     // default view: drift already under way
})();

/* ---- Figure 2: one copy of a better variant, 1,000 times ----------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("fix-canvas");
  if (!canvasEl) return;
  var M = window.SelModel, D = SelDraw;
  var N = 1000, REPS = 1000, r = M.rng(4242);
  var s = 0.02, runS = 0.02;
  var counts, trajs, alive, gen, target, running = false;
  var nLost = 0, nFixed = 0, points = [];
  var out = {
    gen: document.getElementById("fix-gen"), lost: document.getElementById("fix-lost"),
    alive: document.getElementById("fix-alive"), fixed: document.getElementById("fix-fixed"),
    th: document.getElementById("fix-theory")
  };
  var runBtn = document.getElementById("fix-run");

  function start() {
    runS = s;
    counts = new Int32Array(REPS); trajs = []; alive = REPS;
    for (var i = 0; i < REPS; i++) { counts[i] = 1; trajs.push([1]); }
    gen = 0; target = 0; nLost = 0; nFixed = 0; running = true;
  }
  function advance() {
    for (var i = 0; i < REPS; i++) {
      var c = counts[i];
      if (c === 0 || c === N) continue;
      c = M.nextCount(c, N, runS, r);
      counts[i] = c; trajs[i].push(c);
      if (c === 0) { nLost++; alive--; } else if (c === N) { nFixed++; alive--; }
    }
    gen++;
    if (alive === 0) finish();
  }
  function finish() {
    running = false;
    points.push({ s: runS, f: nFixed / REPS, n: REPS });
  }

  var view = Orrery.canvas(canvasEl, draw);
  function LX(g) { return Math.log(g + 1) / Math.LN10; }

  function draw(ctx, w, h) {
    var c = Orrery.tokens(), P = D.panels(w, h, 0.58);
    // left: trajectories, log-log
    var a = P.a, x0 = a.x + 44, x1 = a.x + a.w - 14, y0 = a.y + 14, y1 = a.y + a.h - 28;
    var gx = Math.max(3, Math.ceil(LX(Math.max(gen, 1000))));   // decades shown
    var fx = function (g) { return x0 + (x1 - x0) * LX(g) / gx; };
    var ybot = y1, ytop = y0, yOne = y1 - 6;
    var fy = function (cnt) { return cnt <= 0 ? ybot : yOne - (yOne - ytop) * Math.log(cnt) / Math.log(N); };
    D.frame(ctx, c, x0, y0, x1, y1);
    [1, 10, 100, 1000].forEach(function (v) { D.axisText(ctx, c, Orrery.fmt.number(v, 0), x0 - 5, fy(v), "right", "middle"); });
    for (var d = 0; d <= gx; d++) {
      var gv = d === 0 ? 0 : Math.pow(10, d);
      D.axisText(ctx, c, Orrery.fmt.number(gv, 0), fx(gv), y1 + 6, d === 0 ? "left" : d === gx ? "right" : "center");
    }
    D.axisText(ctx, c, "copies", x0 + 6, y0, "left");
    D.axisText(ctx, c, "generation", (x0 + x1) / 2, y1 + 6 + 12);
    if (trajs) {
      var lost = new Path2D(), live = new Path2D(), won = new Path2D();
      for (var i = 0; i < REPS; i++) {
        var t = trajs[i], last = t[t.length - 1];
        var path = last === 0 ? lost : last === N ? won : live;
        path.moveTo(fx(0), fy(t[0]));
        var step = Math.max(1, Math.floor(t.length / 400));
        for (var g = 1; g < t.length; g += step) path.lineTo(fx(g), fy(t[g]));
        path.lineTo(fx(t.length - 1), fy(last));
      }
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.18; ctx.strokeStyle = c.ink3; ctx.stroke(lost);
      ctx.globalAlpha = 0.8; ctx.strokeStyle = c.brass; ctx.lineWidth = 1.2; ctx.stroke(live);
      ctx.globalAlpha = 1; ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.6; ctx.stroke(won);
    }
    // right: fraction fixed against s
    var b = P.b, bx0 = b.x + 46, bx1 = b.x + b.w - 12, by0 = b.y + 18, by1 = b.y + b.h - 28;
    var SMAX = 0.1, PMAX = 0.2;
    var bx = function (sv) { return bx0 + (bx1 - bx0) * sv / SMAX; };
    var by = function (pv) { return by1 - (by1 - by0) * Math.min(pv, PMAX) / PMAX; };
    D.frame(ctx, c, bx0, by0, bx1, by1);
    [0, 0.05, 0.1, 0.15, 0.2].forEach(function (v) { D.axisText(ctx, c, Math.round(v * 100) + "%", bx0 - 5, by(v), "right", "middle"); });
    [0, 0.05, 0.1].forEach(function (v) { D.axisText(ctx, c, Math.round(v * 100) + "%", bx(v), by1 + 6, v === 0 ? "left" : v === 0.1 ? "right" : "center"); });
    D.axisText(ctx, c, "advantage s", (bx0 + bx1) / 2, by1 + 18);
    D.axisText(ctx, c, "fraction fixed", bx0 + 6, by0 - 14, "left");
    // 2s line
    ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
    ctx.strokeStyle = c.ink3; ctx.beginPath(); ctx.moveTo(bx(0), by(0)); ctx.lineTo(bx(0.1), by(0.2)); ctx.stroke();
    ctx.strokeStyle = c.alarm; ctx.beginPath(); ctx.moveTo(bx(0), by(1 / N)); ctx.lineTo(bx(SMAX), by(1 / N)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = c.brass; ctx.lineWidth = 2; ctx.beginPath();
    for (var k = 0; k <= 100; k++) { var sv = SMAX * k / 100, X = bx(sv), Y = by(M.pFix(N, sv)); if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
    ctx.stroke();
    // current s marker
    ctx.strokeStyle = c.rule; ctx.beginPath(); ctx.moveTo(bx(s), by0); ctx.lineTo(bx(s), by1); ctx.stroke();
    points.forEach(function (p) {
      var se = Math.sqrt(Math.max(p.f * (1 - p.f), 1 / p.n) / p.n);
      ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx(p.s), by(Math.max(0, p.f - 2 * se))); ctx.lineTo(bx(p.s), by(p.f + 2 * se)); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx(p.s), by(p.f), 4, 0, Orrery.TAU); ctx.fillStyle = c.verdigris; ctx.fill();
    });
    // readouts
    out.gen.textContent = Orrery.fmt.number(gen || 0, 0);
    out.lost.textContent = Orrery.fmt.number(nLost, 0);
    out.alive.textContent = Orrery.fmt.number(trajs ? alive : 0, 0);
    out.fixed.textContent = Orrery.fmt.number(nFixed, 0) + (trajs && !running ? " (" + Orrery.fmt.percent(nFixed / REPS, 1) + ")" : "");
  }

  function step(dt) {
    if (!running) return;
    target += dt * Math.max(4, target * 0.9);     // speeds up as generations pass (log time axis)
    var n = 0;
    while (running && gen < target && n < 400) { advance(); n++; }
    view.redraw();
    if (!running) loop.pause();
  }

  var loop = Orrery.loop(canvasEl, step, { autoplay: false });
  runBtn.addEventListener("click", function () {
    start();
    if (Orrery.reducedMotion()) { while (running) advance(); view.redraw(); return; }
    loop.play();
  });
  document.getElementById("fix-clear").addEventListener("click", function () { points = []; view.redraw(); });
  Orrery.bindRange(document.getElementById("fix-s"), document.getElementById("fix-s-out"), {
    format: function (v) { return Orrery.fmt.percent(v, 1); },
    onInput: function (v) { s = v; out.th.textContent = D.pct(M.pFix(N, v)); view.redraw(); }
  });
  // default state: one finished run at s = 2%, already on the chart
  start(); while (running) advance();
  view.redraw();
})();

/* ---- Figure 3: chance against selection ---------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("map-canvas");
  if (!canvasEl) return;
  var M = window.SelModel, D = SelDraw;
  var N = 100, s = -0.001, sim = null, r = M.rng(777);
  var out = {
    ns: document.getElementById("map-ns"), p: document.getElementById("map-p"),
    neu: document.getElementById("map-neutral"), ratio: document.getElementById("map-ratio"),
    sim: document.getElementById("map-simout"), verdict: document.getElementById("map-verdict")
  };
  var XMAX = Math.asinh(500), YMIN = -4, YMAX = Math.log10(2000);

  var view = Orrery.canvas(canvasEl, draw);

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var x0 = 62, x1 = w - 14, y0 = 14, y1 = h - 34;
    var fx = function (ns) { return x0 + (x1 - x0) * (Math.asinh(ns) + XMAX) / (2 * XMAX); };
    var fy = function (ratio) {
      var l = ratio > 0 ? Math.log10(ratio) : YMIN;
      l = Math.max(YMIN, Math.min(YMAX, l));
      return y1 - (y1 - y0) * (l - YMIN) / (YMAX - YMIN);
    };
    // drift band
    ctx.fillStyle = c.paper3; ctx.fillRect(fx(-1), y0, fx(1) - fx(-1), y1 - y0);
    var narrow = w < 560;
    D.axisText(ctx, c, "drift", (fx(-1) + fx(1)) / 2, y0 + 4);
    D.axisText(ctx, c, narrow ? "removed" : "selection removes it", (x0 + fx(-1)) / 2, y0 + 4);
    D.axisText(ctx, c, narrow ? "spreads" : "selection spreads it", (fx(1) + x1) / 2, y0 + 4);
    D.frame(ctx, c, x0, y0, x1, y1);
    [-100, -10, -1, 0, 1, 10, 100].forEach(function (v) {
      D.axisText(ctx, c, Orrery.fmt.number(v, 0), fx(v), y1 + 6);
      ctx.strokeStyle = c.rule; ctx.beginPath(); ctx.moveTo(fx(v), y1); ctx.lineTo(fx(v), y1 + 4); ctx.stroke();
    });
    D.axisText(ctx, c, "N·s", (x0 + x1) / 2, y1 + 19);
    [0.0001, 0.01, 1, 100].forEach(function (v) {
      D.axisText(ctx, c, v >= 1 ? Orrery.fmt.number(v, 0) + "×" : v + "×", x0 - 5, fy(v), "right", "middle");
    });
    // neutral line
    ctx.setLineDash([5, 4]); ctx.strokeStyle = c.alarm; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0, fy(1)); ctx.lineTo(x1, fy(1)); ctx.stroke(); ctx.setLineDash([]);
    D.axisText(ctx, c, "neutral", x1 - 4, fy(1) - 15, "right");
    // curve for this N
    ctx.strokeStyle = c.brass; ctx.lineWidth = 2; ctx.beginPath();
    var started = false;
    for (var k = 0; k <= 300; k++) {
      var u = -XMAX + 2 * XMAX * k / 300, ns = Math.sinh(u), sv = ns / N;
      if (sv < -0.5 || sv > 1) { started = false; continue; }
      var X = fx(ns), Y = fy(N * M.pFix(N, sv));
      if (started) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      started = true;
    }
    ctx.stroke();
    // marker
    var p = M.pFix(N, s), mx = fx(N * s), my = fy(N * p);
    ctx.beginPath(); ctx.arc(mx, my, 7, 0, Orrery.TAU); ctx.fillStyle = c.brassLit; ctx.fill();
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.stroke();
    if (sim && sim.N === N && sim.s === s && sim.f > 0) {
      ctx.beginPath(); ctx.arc(mx, fy(N * sim.f), 4, 0, Orrery.TAU); ctx.fillStyle = c.verdigris; ctx.fill();
    }
  }

  function update() {
    var p = M.pFix(N, s), ns = N * s;
    out.ns.textContent = Orrery.fmt.number(ns, Math.abs(ns) < 10 ? 2 : 0);
    out.p.textContent = D.pct(p);
    out.neu.textContent = D.pct(1 / N);
    var ratio = p * N;
    out.ratio.textContent = (ratio >= 0.01 ? Orrery.fmt.number(ratio, ratio < 10 ? 2 : 0) : ratio === 0 ? "0" : D.sci(ratio)) + " ×";
    out.verdict.textContent = Math.abs(ns) < 1
      ? "Drift dominates: |N·s| < 1, so this variant fares roughly as a neutral one would."
      : ns > 0 ? "Selection dominates: the variant is " + Orrery.fmt.number(ratio, 0) + " times as likely to win as a neutral one."
               : "Selection dominates: the harmful variant is almost always removed.";
    if (!(sim && sim.N === N && sim.s === s)) out.sim.textContent = "not run";
    view.redraw();
  }

  document.getElementById("map-sim").addEventListener("click", function () {
    var reps = 4000, f = 0;
    for (var i = 0; i < reps; i++) if (M.runOne(N, s, r, false, 2e5).fixed) f++;
    sim = { N: N, s: s, f: f / reps };
    out.sim.textContent = Orrery.fmt.number(f, 0) + " of 4,000 (" + D.pct(f / reps) + ")";
    view.redraw();
  });
  Orrery.bindRange(document.getElementById("map-n"), document.getElementById("map-n-out"), {
    format: function (v) { return Orrery.fmt.number(Math.round(Math.pow(10, v)), 0); },
    onInput: function (v) { N = Math.round(Math.pow(10, v)); update(); }
  });
  Orrery.bindRange(document.getElementById("map-s"), document.getElementById("map-s-out"), {
    format: function (v) { return Orrery.fmt.percent(v, 2); },
    onInput: function (v) { s = v; update(); }
  });
})();
