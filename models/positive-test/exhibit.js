/* Exhibit script: "You tested positive. Now what?"
   One IIFE per figure, plus a small shared helper (PT) for the town of dots.
   All counts are *expected* counts, rounded to whole people; all percentages
   are computed exactly from the rates (not from the rounded counts). */

/* ---- Shared: the model and the town renderer ----------------------------- */
var PT = (function () {
  "use strict";
  var N = 10000;

  // Seeded generator so the town looks the same on every visit (mulberry32).
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffled(n, seed) {
    var r = rng(seed), a = new Array(n), i;
    for (i = 0; i < n; i++) a[i] = i;
    for (i = n - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // rank[i]: who becomes sick first as prevalence rises (sick if rank < nSick).
  // order: the order in which the test "catches" people, so raising a rate
  // only ever adds people to a group; nobody reshuffles.
  var perm = shuffled(N, 20260930), rank = new Array(N);
  for (var i = 0; i < N; i++) rank[perm[i]] = i;
  var order = shuffled(N, 314159);

  // Exact Bayes, with prevalence p, sensitivity se, specificity sp (all 0..1).
  function bayes(p, se, sp) {
    var tp = p * se, fp = (1 - p) * (1 - sp), fn = p * (1 - se), tn = (1 - p) * sp;
    return {
      ppv: tp / (tp + fp),                    // P(sick | positive)
      falseReassure: fn / (fn + tn),          // P(sick | negative)
      pos: tp + fp
    };
  }

  // Whole-person counts for a town of N and flags per person.
  function town(p, se, sp) {
    var nSick = Math.round(N * p);
    var TP = Math.round(nSick * se);
    var FP = Math.round((N - nSick) * (1 - sp));
    var sick = new Uint8Array(N), pos = new Uint8Array(N), k, a = 0, b = 0;
    for (k = 0; k < N; k++) sick[k] = rank[k] < nSick ? 1 : 0;
    for (k = 0; k < N; k++) {
      var id = order[k];
      if (sick[id]) { if (a < TP) { pos[id] = 1; } a++; }
      else { if (b < FP) { pos[id] = 1; } b++; }
    }
    return { N: N, nSick: nSick, nHealthy: N - nSick, TP: TP, FN: nSick - TP, FP: FP, TN: N - nSick - FP,
             sick: sick, pos: pos };
  }

  // Grid geometry: landscape 125 x 80, portrait 80 x 125.
  // pad: optional margin (px) kept clear around the grid.
  function grid(w, h, pad) {
    pad = pad || 0;
    var best = 0, cols = 100, opts = [125, 100, 80], iw = w - 2 * pad, ih = h - 2 * pad;
    for (var k = 0; k < 3; k++) {
      var cs = Math.min(iw / opts[k], ih / (N / opts[k]));
      if (cs > best) { best = cs; cols = opts[k]; }
    }
    var rows = N / cols, cell = best;
    return { cols: cols, rows: rows, cell: cell, x0: (w - cell * cols) / 2, y0: (h - cell * rows) / 2 };
  }
  // Outer radius of the ring around a picked person, for a given cell size.
  function ringR(s) { return Math.max(13, s * 2.3); }

  // Draw the town. shown(i) says whether person i's result is visible yet.
  // roomForRing: inset the grid so a ring around an edge person is not clipped by the stage.
  function drawTown(ctx, w, h, T, shown, picked, roomForRing) {
    var g = grid(w, h);
    if (roomForRing) {
      // the ring scales with the cell, so shrink in two passes; the second is within a pixel
      g = grid(w, h, ringR(g.cell) - g.cell / 2 + 2);
      g = grid(w, h, ringR(g.cell) - g.cell / 2 + 2);
    }
    var c = Orrery.tokens(), s = g.cell, i;
    var rBase = Math.max(0.6, s * 0.22), rBig = Math.max(1.3, s * 0.46);
    // Pass 1: the faint crowd (healthy and not shown positive)
    ctx.fillStyle = c.ink3; ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (i = 0; i < T.N; i++) {
      if (T.sick[i] || (T.pos[i] && shown(i))) continue;
      var x = g.x0 + (i % g.cols + 0.5) * s, y = g.y0 + (Math.floor(i / g.cols) + 0.5) * s;
      ctx.moveTo(x + rBase, y); ctx.arc(x, y, rBase, 0, Orrery.TAU);
    }
    ctx.fill(); ctx.globalAlpha = 1;
    // Pass 2: healthy people who tested positive (false positives)
    ctx.fillStyle = c.brassLit; ctx.strokeStyle = c.brass; ctx.lineWidth = Math.max(0.6, s * 0.1);
    ctx.beginPath();
    for (i = 0; i < T.N; i++) {
      if (T.sick[i] || !T.pos[i] || !shown(i)) continue;
      var x2 = g.x0 + (i % g.cols + 0.5) * s, y2 = g.y0 + (Math.floor(i / g.cols) + 0.5) * s;
      ctx.moveTo(x2 + rBig, y2); ctx.arc(x2, y2, rBig, 0, Orrery.TAU);
    }
    ctx.fill(); ctx.stroke();
    // Pass 3: sick people: filled red if caught (shown positive), hollow otherwise
    for (i = 0; i < T.N; i++) {
      if (!T.sick[i]) continue;
      var x3 = g.x0 + (i % g.cols + 0.5) * s, y3 = g.y0 + (Math.floor(i / g.cols) + 0.5) * s;
      ctx.beginPath(); ctx.arc(x3, y3, rBig, 0, Orrery.TAU);
      ctx.strokeStyle = c.alarm; ctx.lineWidth = Math.max(1, s * 0.16);
      if (T.pos[i] && shown(i)) { ctx.fillStyle = c.alarm; ctx.fill(); }
      ctx.stroke();
    }
    if (picked >= 0) {
      var xp = g.x0 + (picked % g.cols + 0.5) * s, yp = g.y0 + (Math.floor(picked / g.cols) + 0.5) * s;
      ctx.beginPath(); ctx.arc(xp, yp, Math.max(9, s * 1.6), 0, Orrery.TAU);
      ctx.strokeStyle = c.ink; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(xp, yp, ringR(s), 0, Orrery.TAU);
      ctx.strokeStyle = c.focus; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  function n(x) { return Orrery.fmt.number(x, 0); }
  function pct(x) {
    if (!isFinite(x)) return "—";
    if (x > 0 && x < 0.000005) return "under 0.001%";
    if (x < 1 && x >= 0.999995) return "over 99.999%";
    var d = x < 0.00099 ? 3 : x < 0.0099 ? 2 : 1;
    if (x > 0.999 && x < 1) return Orrery.fmt.percent(x, 3);
    if (x > 0.99 && x < 1) return Orrery.fmt.percent(x, 2);
    return Orrery.fmt.percent(x, d);
  }
  // "1 in 1,000" style description of a prevalence
  function oneIn(p) {
    var k = 1 / p;
    if (k >= 1.95) {
      var r = k >= 100 ? Math.round(k / 10) * 10 : k >= 20 ? Math.round(k) : Math.round(k * 10) / 10;
      return "1 in " + Orrery.fmt.number(r, r % 1 ? 1 : 0);
    }
    return Orrery.fmt.percent(p, 0);
  }
  return { N: N, bayes: bayes, town: town, drawTown: drawTown, grid: grid, rng: rng, n: n, pct: pct, oneIn: oneIn };
})();

/* ---- Figure 1: a town of 10,000 ----------------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("town-canvas");
  if (!canvasEl) return;
  var T = PT.town(0.001, 0.99, 0.99);
  var reveal = 1;                 // fraction of positives shown (animation)
  var revealAt = new Float32Array(T.N), r = PT.rng(7), i;
  for (i = 0; i < T.N; i++) revealAt[i] = r();
  var positives = [];
  for (i = 0; i < T.N; i++) if (T.pos[i]) positives.push(i);
  var picked = -1, draws = 0, drawsSick = 0, pickR = PT.rng(99);
  var outPick = document.getElementById("town-pick-out");
  var outTally = document.getElementById("town-tally");
  var btnTest = document.getElementById("town-test");
  var btnPick = document.getElementById("town-pick");

  var view = Orrery.canvas(canvasEl, function (ctx, w, h) {
    PT.drawTown(ctx, w, h, T, function (k) { return revealAt[k] <= reveal; }, picked, true);
  });

  var loop = Orrery.loop(canvasEl, function (dt) {
    reveal = Math.min(1, reveal + dt / 2.5);
    view.redraw();
    if (reveal >= 1) { loop.pause(); btnTest.disabled = false; btnPick.disabled = false; }
  }, { autoplay: false });

  btnTest.addEventListener("click", function () {
    picked = -1; outPick.textContent = "Nobody picked yet.";
    if (Orrery.reducedMotion()) { reveal = 1; view.redraw(); return; }
    reveal = 0; btnPick.disabled = true; view.redraw(); loop.play();
  });

  btnPick.addEventListener("click", function () {
    reveal = 1;
    picked = positives[Math.floor(pickR() * positives.length)];
    draws++;
    if (T.sick[picked]) drawsSick++;
    outPick.textContent = T.sick[picked]
      ? "This person tested positive and is sick."
      : "This person tested positive but is healthy — a false positive.";
    outTally.textContent = PT.n(drawsSick) + " sick out of " + PT.n(draws) + " picked";
    view.redraw();
  });

  document.getElementById("town-sick").textContent = PT.n(T.nSick);
  document.getElementById("town-pos").textContent = PT.n(T.TP + T.FP);
  document.getElementById("town-tp").textContent = PT.n(T.TP);
  document.getElementById("town-ppv").textContent = PT.pct(PT.bayes(0.001, 0.99, 0.99).ppv);
})();

/* ---- Figure 2: three dials and the natural-frequency tree ---------------- */
(function () {
  "use strict";
  var townEl = document.getElementById("dials-town");
  var treeEl = document.getElementById("dials-tree");
  if (!townEl || !treeEl) return;
  var p = 0.001, se = 0.99, sp = 0.99, T = PT.town(p, se, sp);
  var townView = Orrery.canvas(townEl, function (ctx, w, h) {
    PT.drawTown(ctx, w, h, T, function () { return true; }, -1);
  });
  var treeView = Orrery.canvas(treeEl, drawTree);

  function box(ctx, x, y, bw, bh, lines, fill, stroke, c, big) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - bw / 2, y, bw, bh, 5); else ctx.rect(x - bw / 2, y, bw, bh);
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = c.ink; ctx.font = "600 " + big + "px " + c.mono;
    ctx.fillText(lines[0], x, y + bh * 0.36);
    ctx.fillStyle = c.ink2; ctx.font = Math.round(big * 0.8) + "px " + c.sans;
    ctx.fillText(lines[1], x, y + bh * 0.72);
  }
  function edge(ctx, x1, y1, x2, y2, label, c, fs) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1.2; ctx.stroke();
    if (label) {
      ctx.fillStyle = c.ink3; ctx.font = fs + "px " + c.sans;
      ctx.textAlign = x2 < x1 ? "right" : "left"; ctx.textBaseline = "middle";
      ctx.fillText(label, (x1 + x2) / 2 + (x2 < x1 ? -6 : 6), (y1 + y2) / 2);
    }
  }
  function drawTree(ctx, w, h) {
    var c = Orrery.tokens();
    var narrow = w < 520, big = narrow ? 13 : 15, fs = narrow ? 10.5 : 12.5;
    var bh = narrow ? 40 : 46, r2 = Math.min(h * 0.76 - 4, h - bh - 36), rows = [6, Math.min(h * 0.38, (6 + bh + r2 - bh) / 2), r2];
    var bw0 = Math.min(150, w * 0.4), bw1 = Math.min(150, w * 0.36), bw2 = Math.min(130, w / 4 - 6);
    var xs1 = [w * 0.25, w * 0.75], xs2 = [w * 0.125, w * 0.375, w * 0.625, w * 0.875];
    edge(ctx, w / 2, rows[0] + bh, xs1[0], rows[1], narrow ? "" : "have it", c, fs);
    edge(ctx, w / 2, rows[0] + bh, xs1[1], rows[1], narrow ? "" : "don’t", c, fs);
    edge(ctx, xs1[0], rows[1] + bh, xs2[0], rows[2], "", c, fs);
    edge(ctx, xs1[0], rows[1] + bh, xs2[1], rows[2], "", c, fs);
    edge(ctx, xs1[1], rows[1] + bh, xs2[2], rows[2], "", c, fs);
    edge(ctx, xs1[1], rows[1] + bh, xs2[3], rows[2], "", c, fs);
    box(ctx, w / 2, rows[0], bw0, bh, [PT.n(T.N), "people"], c.paper, c.ink3, c, big);
    box(ctx, xs1[0], rows[1], bw1, bh, [PT.n(T.nSick), "sick"], c.paper, c.alarm, c, big);
    box(ctx, xs1[1], rows[1], bw1, bh, [PT.n(T.nHealthy), "healthy"], c.paper, c.ink3, c, big);
    box(ctx, xs2[0], rows[2], bw2, bh, [PT.n(T.TP), narrow ? "positive" : "test positive"], c.paper, c.alarm, c, big);
    box(ctx, xs2[1], rows[2], bw2, bh, [PT.n(T.FN), narrow ? "negative" : "test negative"], c.paper, c.rule, c, big);
    box(ctx, xs2[2], rows[2], bw2, bh, [PT.n(T.FP), narrow ? "positive" : "test positive"], c.paper, c.brass, c, big);
    box(ctx, xs2[3], rows[2], bw2, bh, [PT.n(T.TN), narrow ? "negative" : "test negative"], c.paper, c.rule, c, big);
    // bracket joining the two positive boxes
    var yb = rows[2] + bh + 10;
    ctx.beginPath(); ctx.moveTo(xs2[0], yb - 4); ctx.lineTo(xs2[0], yb); ctx.lineTo(xs2[2], yb); ctx.lineTo(xs2[2], yb - 4);
    ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = c.ink; ctx.font = "600 " + fs + "px " + c.sans; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("all positives: " + PT.n(T.TP + T.FP) + ", of whom " + PT.n(T.TP) + " are sick", (xs2[0] + xs2[2]) / 2, yb + 3);
  }

  var out = {
    ppv: document.getElementById("dials-ppv"), npv: document.getElementById("dials-npv"),
    tp: document.getElementById("dials-tp"), fp: document.getElementById("dials-fp")
  };
  function update() {
    T = PT.town(p, se, sp);
    var B = PT.bayes(p, se, sp);
    out.ppv.textContent = PT.pct(B.ppv);
    out.npv.textContent = PT.pct(B.falseReassure);
    out.tp.textContent = PT.n(T.TP);
    out.fp.textContent = PT.n(T.FP);
    treeEl.setAttribute("aria-label", "Tree: of " + PT.n(T.N) + " people, " + PT.n(T.nSick) + " are sick and " +
      PT.n(T.nHealthy) + " healthy. Of the sick, " + PT.n(T.TP) + " test positive and " + PT.n(T.FN) +
      " negative. Of the healthy, " + PT.n(T.FP) + " test positive and " + PT.n(T.TN) + " negative.");
    townEl.setAttribute("aria-label", "A town of " + PT.n(T.N) + " people, one dot each: " + PT.n(T.nSick) + " sick (red; " +
      PT.n(T.TP) + " of them test positive) and " + PT.n(T.FP) + " healthy people who test positive anyway (gold). Of everyone who tests positive, " +
      PT.pct(B.ppv) + " are sick.");
    townView.redraw(); treeView.redraw();
  }

  Orrery.bindRange(document.getElementById("dials-prev"), document.getElementById("dials-prev-out"), {
    format: function (v) { var q = Math.pow(10, v); return PT.oneIn(q) + " (" + PT.pct(q) + ")"; },
    onInput: function (v) { p = Math.pow(10, v); update(); }, init: false
  });
  Orrery.bindRange(document.getElementById("dials-sens"), document.getElementById("dials-sens-out"), {
    format: function (v) { return Orrery.fmt.number(v, 1) + "%"; },
    onInput: function (v) { se = v / 100; update(); }, init: false
  });
  Orrery.bindRange(document.getElementById("dials-spec"), document.getElementById("dials-spec-out"), {
    format: function (v) { return Orrery.fmt.number(v, 1) + "%"; },
    onInput: function (v) { sp = v / 100; update(); }, init: false
  });
  document.getElementById("dials-reset").addEventListener("click", function () {
    var ids = { "dials-prev": -3, "dials-sens": 99, "dials-spec": 99 };
    for (var id in ids) {
      var el = document.getElementById(id);
      el.value = ids[id];
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  update();
})();

/* ---- Figure 3: who gets tested (prior vs. predictive value) -------------- */
(function () {
  "use strict";
  var el = document.getElementById("prior-canvas");
  if (!el) return;
  var se = 0.99, sp = 0.99;
  var LMIN = -4, LMAX = Math.log10(0.9);
  var lp = -3;                               // log10 prevalence
  var pad = { l: 46, r: 14, t: 14, b: 40 };
  var outs = {
    prior: document.getElementById("prior-p"), ppv: document.getElementById("prior-ppv"),
    neg: document.getElementById("prior-neg")
  };
  var view = Orrery.canvas(el, draw);
  function X(l, w) { return pad.l + (l - LMIN) / (LMAX - LMIN) * (w - pad.l - pad.r); }
  function Y(v, h) { return pad.t + (1 - v) * (h - pad.t - pad.b); }
  function draw(ctx, w, h) {
    var c = Orrery.tokens(), l, k;
    ctx.font = "11.5px " + c.sans; ctx.fillStyle = c.ink3; ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    // y grid
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (k = 0; k <= 4; k++) {
      var yy = Y(k / 4, h);
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
      ctx.fillText((k * 25) + "%", pad.l - 6, yy);
    }
    // x ticks
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    var ticks = [[-4, "1 in 10,000"], [-3, "1 in 1,000"], [-2, "1 in 100"], [-1, "1 in 10"], [Math.log10(0.5), "1 in 2"]];
    var narrow = w < 480;
    for (k = 0; k < ticks.length; k++) {
      var xx = X(ticks[k][0], w);
      ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, h - pad.b); ctx.stroke();
      var lab = narrow ? ticks[k][1].replace("1 in ", "1/") : ticks[k][1];
      if (k === 0) ctx.textAlign = "left"; else if (k === ticks.length - 1) ctx.textAlign = "right"; else ctx.textAlign = "center";
      ctx.fillText(lab, k === 0 ? xx - 4 : xx, h - pad.b + 6);
    }
    ctx.textAlign = "center";
    ctx.fillText("how common the disease is among the people tested (log scale)", (pad.l + w - pad.r) / 2, h - pad.b + 22);
    // curves
    function curve(f, col, wdt) {
      ctx.beginPath();
      for (l = LMIN; l <= LMAX + 1e-9; l += (LMAX - LMIN) / 200) {
        var v = f(PT.bayes(Math.pow(10, l), se, sp));
        if (l === LMIN) ctx.moveTo(X(l, w), Y(v, h)); else ctx.lineTo(X(l, w), Y(v, h));
      }
      ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.stroke();
    }
    curve(function (b) { return b.ppv; }, c.alarm, 2.5);
    curve(function (b) { return b.falseReassure; }, c.verdigris, 2);
    ctx.font = "12px " + c.sans; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillStyle = c.alarm; ctx.fillText("sick, given a positive", X(-3.95, w), Y(0.94, h) + 12);
    ctx.fillStyle = c.verdigris; ctx.fillText("sick, given a negative", X(-1.55, w), Y(0.04, h) - 2);
    // marker
    var B = PT.bayes(Math.pow(10, lp), se, sp), mx = X(lp, w), my = Y(B.ppv, h);
    ctx.setLineDash([4, 4]); ctx.strokeStyle = c.ink3;
    ctx.beginPath(); ctx.moveTo(mx, h - pad.b); ctx.lineTo(mx, my); ctx.lineTo(pad.l, my); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(mx, my, 8, 0, Orrery.TAU);
    ctx.fillStyle = c.brassLit; ctx.fill(); ctx.strokeStyle = c.brass; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(mx, Y(B.falseReassure, h), 4.5, 0, Orrery.TAU);
    ctx.fillStyle = c.verdigris; ctx.fill();
  }
  function update() {
    var p = Math.pow(10, lp), B = PT.bayes(p, se, sp);
    outs.prior.textContent = PT.oneIn(p) + " (" + PT.pct(p) + ")";
    outs.ppv.textContent = PT.pct(B.ppv);
    outs.neg.textContent = PT.pct(B.falseReassure);
    el.setAttribute("aria-valuenow", lp.toFixed(2));
    el.setAttribute("aria-valuetext", "Prior " + PT.oneIn(p) + "; chance of disease after a positive " +
      PT.pct(B.ppv) + ", after a negative " + PT.pct(B.falseReassure));
    view.redraw();
  }
  function setL(l) { lp = Orrery.clamp(l, LMIN, LMAX); update(); }
  Orrery.drag(el, {
    onStart: function (pt) { setL(LMIN + (pt.x - pad.l) / (view.width - pad.l - pad.r) * (LMAX - LMIN)); },
    onMove: function (pt) { setL(LMIN + (pt.x - pad.l) / (view.width - pad.l - pad.r) * (LMAX - LMIN)); },
    onNudge: function (dx, dy) { setL(lp + 0.05 * (dx || -dy)); }
  });
  var presets = document.querySelectorAll("[data-prior]");
  for (var i = 0; i < presets.length; i++) {
    presets[i].addEventListener("click", function (e) { setL(Math.log10(parseFloat(e.currentTarget.getAttribute("data-prior")))); });
  }
  update();
})();

/* ---- Figure 4: test again (odds form) ------------------------------------ */
(function () {
  "use strict";
  var el = document.getElementById("again-canvas");
  if (!el) return;
  var se = 0.99, sp = 0.99, LR = se / (1 - sp);
  var prior = 0.001, nPos = 2, indep = true;
  var LMIN = -4, LMAX = 4;                    // log10 odds shown
  var view = Orrery.canvas(el, draw);
  var outs = {
    list: document.getElementById("again-steps"), final: document.getElementById("again-final"),
    count: document.getElementById("again-count")
  };
  function steps() {
    var o = prior / (1 - prior), s = [o];
    for (var k = 1; k <= nPos; k++) { if (indep || k === 1) o *= LR; s.push(o); }
    return s;
  }
  function oddsText(o) {
    if (o >= 1) return Orrery.fmt.number(o, o < 10 ? 1 : 0) + " to 1";
    var inv = 1 / o;
    return "1 to " + Orrery.fmt.number(inv, inv < 10 ? 1 : 0);
  }
  function draw(ctx, w, h) {
    var c = Orrery.tokens(), s = steps(), k;
    var x0 = 16, x1 = w - 16, ay = h * 0.6;
    function X(o) { return x0 + (Orrery.clamp(Math.log10(o), LMIN, LMAX) - LMIN) / (LMAX - LMIN) * (x1 - x0); }
    // axis with probability labels
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0, ay); ctx.lineTo(x1, ay); ctx.stroke();
    ctx.fillStyle = c.ink3; ctx.font = "11.5px " + c.sans; ctx.textAlign = "center"; ctx.textBaseline = "top";
    var narrow = w < 480;
    var probs = narrow ? [0.0001, 0.01, 0.5, 0.99, 0.9999] : [0.0001, 0.001, 0.01, 0.1, 0.5, 0.9, 0.99, 0.999, 0.9999];
    for (k = 0; k < probs.length; k++) {
      var xp = X(probs[k] / (1 - probs[k]));
      ctx.beginPath(); ctx.moveTo(xp, ay - 4); ctx.lineTo(xp, ay + 4); ctx.stroke();
      ctx.textAlign = k === 0 ? "left" : k === probs.length - 1 ? "right" : "center";
      ctx.fillText(Orrery.fmt.number(probs[k] * 100, probs[k] < 0.001 || probs[k] > 0.999 ? 2 : probs[k] < 0.01 || probs[k] > 0.99 ? 1 : 0) + "%", xp + (k === 0 ? -4 : k === probs.length - 1 ? 4 : 0), ay + 8);
    }
    ctx.textAlign = "center";
    ctx.fillText(narrow ? "chance of disease (log-odds scale)" : "chance of having the disease (spaced by odds, log scale)", (x0 + x1) / 2, ay + 26);
    // hops
    for (k = 1; k < s.length; k++) {
      var xa = X(s[k - 1]), xb = X(s[k]);
      var lift = Math.min(18 + 8 * k, ay * 0.3);
      ctx.beginPath(); ctx.moveTo(xa, ay - 10);
      if (xb - xa > 1) ctx.bezierCurveTo(xa, ay - 10 - lift * 2, xb, ay - 10 - lift * 2, xb, ay - 10);
      else { ctx.arc(xa, ay - 10 - 12, 12, Math.PI / 2, Math.PI / 2 + Orrery.TAU * 0.95); }
      ctx.strokeStyle = c.brass; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = c.brass; ctx.font = "600 12px " + c.sans; ctx.textBaseline = "bottom";
      ctx.fillText(xb - xa > 1 ? "×" + Orrery.fmt.number(LR, 0) : "×1 (same error)", (xa + xb) / 2, ay - 10 - lift * 1.5 - 2);
    }
    for (k = 0; k < s.length; k++) {
      ctx.beginPath(); ctx.arc(X(s[k]), ay, k === s.length - 1 ? 8 : 5.5, 0, Orrery.TAU);
      ctx.fillStyle = k === 0 ? c.paper : k === s.length - 1 ? c.alarm : c.brassLit;
      ctx.fill(); ctx.strokeStyle = k === 0 ? c.ink2 : c.brass; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = c.ink2; ctx.font = "12px " + c.sans; ctx.textBaseline = "top";
    ctx.fillText("before testing", X(s[0]), ay + 44);
  }
  function update() {
    var s = steps(), html = "";
    for (var k = 0; k < s.length; k++) {
      var pr = s[k] / (1 + s[k]);
      html += "<li>" + (k === 0 ? "Before any test" : "After positive #" + k) + ": odds " + oddsText(s[k]) +
        " → <strong>" + PT.pct(pr) + "</strong></li>";
    }
    outs.list.innerHTML = html;
    var last = s[s.length - 1];
    outs.final.textContent = PT.pct(last / (1 + last));
    outs.count.textContent = nPos;
    outs.count.nextSibling.textContent = nPos === 1 ? " positive" : " positives";
    var spoken = [];
    for (var j = 0; j < outs.list.children.length; j++) spoken.push(outs.list.children[j].textContent);
    el.setAttribute("aria-label", "Odds scale. " + spoken.join("; ") + ".");
    view.redraw();
  }
  Orrery.bindRange(document.getElementById("again-n"), document.getElementById("again-n-out"), {
    format: function (v) { return v === 1 ? "1 positive" : Orrery.fmt.number(v, 0) + " positives"; },
    onInput: function (v) { nPos = v; update(); }, init: false
  });
  Orrery.bindRange(document.getElementById("again-prior"), document.getElementById("again-prior-out"), {
    format: function (v) { var q = Math.pow(10, v); return PT.oneIn(q) + " (" + PT.pct(q) + ")"; },
    onInput: function (v) { prior = Math.pow(10, v); update(); }, init: false
  });
  document.getElementById("again-indep").addEventListener("change", function (e) { indep = e.target.checked; update(); });
  update();
})();
