/* "How many people need to be immune?" — figures.
   The numbers come from model.js (window.HerdModel); this file only draws.
   One IIFE per figure, as in the kit template. */

/* Small shared helpers ---------------------------------------------------- */
var HerdUI = (function () {
  "use strict";
  function pct(x, d) { return Orrery.fmt.percent(x, d === undefined ? 0 : d); }
  // A plot frame: maps data to pixels inside margins.
  function frame(w, h, m, x0, x1, y0, y1, logx) {
    var fx = logx ? function (v) { return Math.log(v); } : function (v) { return v; };
    var a = fx(x0), b = fx(x1);
    return {
      l: m.l, r: w - m.r, t: m.t, b: h - m.b,
      x: function (v) { return m.l + (fx(v) - a) / (b - a) * (w - m.l - m.r); },
      y: function (v) { return h - m.b - (v - y0) / (y1 - y0) * (h - m.t - m.b); },
      inv: function (px) {
        var u = a + (px - m.l) / (w - m.l - m.r) * (b - a);
        return logx ? Math.exp(u) : u;
      }
    };
  }
  function yAxisPercent(ctx, F, c, ticks) {
    ctx.font = "11px " + c.sans; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ticks.forEach(function (v) {
      var y = F.y(v);
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(F.l, y); ctx.lineTo(F.r, y); ctx.stroke();
      ctx.fillStyle = c.ink3; ctx.fillText(Math.round(v * 100) + "%", F.l - 5, y);
    });
  }
  function curve(ctx, F, fn, x0, x1, n, logx) {
    ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var v = logx ? x0 * Math.pow(x1 / x0, i / n) : x0 + (x1 - x0) * i / n;
      var px = F.x(v), py = F.y(fn(v));
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
  }
  function label(ctx, text, x, y, color, align, base, font) {
    ctx.font = font; ctx.textAlign = align || "left"; ctx.textBaseline = base || "alphabetic";
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  // A small key drawn in a corner: items [{text, color, dash, width}], right-aligned block.
  function key(ctx, c, items, xRight, yBottom) {
    ctx.font = "12px " + c.sans;
    var tw = 0;
    items.forEach(function (it) { tw = Math.max(tw, ctx.measureText(it.text).width); });
    var x = xRight - tw - 30, y = yBottom - (items.length - 1) * 18;
    ctx.globalAlpha = 0.85; ctx.fillStyle = c.paper;
    ctx.fillRect(x - 6, y - 16, tw + 40, items.length * 18 + 6); ctx.globalAlpha = 1;
    items.forEach(function (it, i) {
      var yy = y + i * 18;
      ctx.setLineDash(it.dash || []); ctx.strokeStyle = it.color; ctx.lineWidth = it.width || 2;
      ctx.beginPath(); ctx.moveTo(x, yy - 4); ctx.lineTo(x + 22, yy - 4); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, it.text, x + 28, yy, it.color, "left", "alphabetic", "12px " + c.sans);
    });
  }
  return { pct: pct, frame: frame, yAxisPercent: yAxisPercent, curve: curve, label: label, key: key };
})();

/* ---- Figure 1: chains of infection ---------------------------------------
   A branching process: each case meets Poisson(R0) people; each is immune with
   probability p. Generations are columns, left to right. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("chain-canvas");
  if (!canvasEl) return;
  var M = window.HerdModel, UI = HerdUI;
  var GENS = 6, CAP = 400;
  var R0 = 3, immune = 0.3, seed = 4, tree = null;
  var out = {
    re: document.getElementById("chain-re"),
    thr: document.getElementById("chain-thr"),
    cases: document.getElementById("chain-cases"),
    big: document.getElementById("chain-big"),
    verdict: document.getElementById("chain-verdict")
  };

  function rebuild() {
    tree = M.chains(R0, immune, seed, GENS, CAP);
    var Re = R0 * (1 - immune), total = 0, perGen = [];
    tree.counts.forEach(function (c) { total += c.cases; perGen.push(c.cases); });
    out.re.textContent = Orrery.fmt.number(Re, 2);
    out.thr.textContent = R0 <= 1 ? "0% (R0 ≤ 1)" : UI.pct(M.threshold(R0), 0);
    out.cases.textContent = Orrery.fmt.number(total, 0);
    var big = 1 - M.extinction(Re);
    out.big.textContent = big > 0.995 && big < 1 ? "over 99%" : UI.pct(big, 0);
    out.verdict.textContent = Re < 1
      ? "Effective R is below 1: every chain dies out sooner or later."
      : (Re === 1 ? "Effective R is exactly 1: a knife edge — chains wander and eventually die out, slowly."
        : (1 - M.extinction(Re) > 0.95
          ? "Effective R is above 1: almost every chain takes off and keeps growing."
          : "Effective R is above 1: some chains still fizzle by chance, but the rest grow and grow."));
    canvasEl.setAttribute("aria-label", "Branching tree of infection over " + GENS +
      " generations. Cases per generation: " + perGen.join(", ") + ". Grey dots are immune people who were exposed but did not catch it.");
    view.redraw();
  }

  var view = Orrery.canvas(canvasEl, function draw(ctx, w, h) {
    if (!tree) return;
    var c = Orrery.tokens();
    var top = 26, bottom = 30, pad = 8;
    var colW = (w - 2 * pad) / (GENS + 1);
    var avail = h - top - bottom;
    var pos = [];                                  // pixel y of each node, per generation
    tree.gens.forEach(function (nodes, g) {
      var n = nodes.length, ys = [];
      for (var i = 0; i < n; i++) ys.push(n === 1 ? top + avail / 2 : top + (i + 0.5) * avail / n);
      pos.push(ys);
    });
    function X(g) { return pad + (g + 0.5) * colW; }

    // column labels
    for (var g = 0; g <= GENS; g++) {
      UI.label(ctx, g === 0 ? "first case" : "gen " + g, X(g), 15, c.ink3, "center", "alphabetic", "11px " + c.sans);
      var cnt = tree.counts[g];
      UI.label(ctx, Orrery.fmt.number(cnt.cases, 0) + (cnt.truncated ? "+" : ""), X(g), h - 10, cnt.cases ? c.alarm : c.ink3,
        "center", "alphabetic", "600 " + (w < 500 ? 10 : 12) + "px " + c.mono);
    }
    // links
    for (g = 1; g <= GENS; g++) {
      var nodes = tree.gens[g];
      ctx.lineWidth = nodes.length > 60 ? 0.5 : 1;
      for (var i = 0; i < nodes.length; i++) {
        ctx.strokeStyle = nodes[i].immune ? c.rule : c.ink3;
        ctx.globalAlpha = nodes[i].immune ? 0.8 : 0.45;
        ctx.beginPath();
        ctx.moveTo(X(g - 1), pos[g - 1][nodes[i].parent]);
        ctx.lineTo(X(g), pos[g][i]);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // nodes
    for (g = 0; g <= GENS; g++) {
      nodes = tree.gens[g];
      var r = Orrery.clamp(avail / Math.max(1, nodes.length) * 0.42, 1.2, 7);
      for (i = 0; i < nodes.length; i++) {
        ctx.beginPath(); ctx.arc(X(g), pos[g][i], r, 0, Orrery.TAU);
        if (nodes[i].immune) {
          ctx.fillStyle = c.paper3; ctx.fill();
          if (r > 2) { ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.stroke(); }
        } else { ctx.fillStyle = c.alarm; ctx.fill(); }
      }
      if (!nodes.length && g > 0 && tree.gens[g - 1].length === 0) continue;
    }
    // the chain died out: say so
    for (g = 1; g <= GENS; g++) {
      if (tree.counts[g].cases === 0) {
        UI.label(ctx, "chain ended", X(g) + (g < GENS ? colW / 2 : 0), top + avail / 2, c.ink3,
          g < GENS ? "center" : "right", "middle", "italic 12px " + c.sans);
        break;
      }
    }
  });

  Orrery.bindRange(document.getElementById("chain-r0"), document.getElementById("chain-r0-out"), {
    format: function (v) { return Orrery.fmt.number(v, 1); },
    onInput: function (v) { R0 = v; rebuild(); }
  });
  Orrery.bindRange(document.getElementById("chain-imm"), document.getElementById("chain-imm-out"), {
    format: function (v) { return v + "%"; },
    onInput: function (v) { immune = v / 100; rebuild(); }
  });
  document.getElementById("chain-new").addEventListener("click", function () { seed += 1; rebuild(); });
  rebuild();
})();

/* ---- Figure 2: an epidemic curve (SIR) -----------------------------------
   S, I, R as shares of the population; a share v vaccinated beforehand. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("sir-canvas");
  if (!canvasEl) return;
  var M = window.HerdModel, UI = HerdUI;
  var R0 = 3, v = 0, run = null;
  var o = {
    re: document.getElementById("sir-re"), peak: document.getElementById("sir-peak"),
    day: document.getElementById("sir-day"), speak: document.getElementById("sir-speak"),
    inv: document.getElementById("sir-inv"), ever: document.getElementById("sir-ever")
  };

  function rebuild() {
    run = M.sir(R0, v, { dt: 0.05, i0: 1e-4, infectiousDays: 7, tMax: 1500 });
    var Re0 = R0 * run.S0, growing = Re0 > 1;
    o.re.textContent = Orrery.fmt.number(Re0, 2);
    o.peak.textContent = growing ? UI.pct(run.peakI, 1) : "no rise";
    o.day.textContent = growing ? "day " + Math.round(run.peakT) : "—";
    o.speak.textContent = growing ? UI.pct(run.peakS, 1) : "—";
    o.inv.textContent = R0 <= 1 ? "n/a (R0 ≤ 1)" : UI.pct(1 / R0, 1);
    o.ever.textContent = UI.pct(run.everInfected, 1);
    canvasEl.setAttribute("aria-label", "Epidemic curves over time for R0 " + Orrery.fmt.number(R0, 1) +
      " with " + Math.round(v * 100) + "% vaccinated. " + (growing
        ? "Infections peak at " + UI.pct(run.peakI, 1) + " of people on day " + Math.round(run.peakT) +
          ", when the susceptible share is " + UI.pct(run.peakS, 1) + ", equal to 1/R0. "
        : "Infections only fall: the susceptible share starts below 1/R0. ") +
      UI.pct(run.everInfected, 1) + " of people are infected in total.");
    view.redraw();
  }

  var view = Orrery.canvas(canvasEl, function draw(ctx, w, h) {
    if (!run) return;
    var c = Orrery.tokens();
    var tEnd = Math.max(60, Math.ceil(run.end / 30) * 30);
    var F = UI.frame(w, h, { l: 40, r: 12, t: 12, b: 28 }, 0, tEnd, 0, 1);
    // vaccinated band
    if (v > 0) {
      ctx.fillStyle = c.paper3; ctx.fillRect(F.l, F.y(1), F.r - F.l, F.y(1 - v) - F.y(1));
    }
    UI.yAxisPercent(ctx, F, c, [0, 0.25, 0.5, 0.75, 1]);
    if (v > 0.06) UI.label(ctx, "vaccinated beforehand", F.r - 6, F.y(1) + 14, c.ink2, "right", "alphabetic", "12px " + c.sans);
    // day ticks
    var step = tEnd <= 120 ? 30 : tEnd <= 360 ? 60 : tEnd <= 720 ? 120 : 300;
    for (var d = 0; d <= tEnd; d += step) {
      UI.label(ctx, d === 0 ? "day 0" : String(d), F.x(d), h - 9, c.ink3, d === 0 ? "left" : "center", "alphabetic", "11px " + c.sans);
    }
    // threshold line S = 1/R0
    var yT = F.y(1 / R0);
    if (R0 >= 1) {
    ctx.setLineDash([5, 4]); ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(F.l, yT); ctx.lineTo(F.r, yT); ctx.stroke(); ctx.setLineDash([]);
    UI.label(ctx, "susceptible = 1/R0", F.r - 4, yT - 5, c.verdigris, "right", "alphabetic", "12px " + c.sans);
    }
    // curves
    function line(arr, col, width) {
      ctx.beginPath();
      for (var i = 0; i < run.t.length; i++) {
        var px = F.x(run.t[i]), py = F.y(arr[i]);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.lineTo(F.r, F.y(arr[arr.length - 1]));
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.stroke();
    }
    line(run.R, c.brass, 2);
    line(run.S, c.verdigris, 2.5);
    line(run.I, c.alarm, 2.5);
    // the peak
    if (R0 * run.S0 > 1) {
      var xp = F.x(run.peakT);
      ctx.setLineDash([2, 3]); ctx.strokeStyle = c.ink3; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xp, F.t); ctx.lineTo(xp, F.b); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(xp, F.y(run.peakS), 5, 0, Orrery.TAU);
      ctx.fillStyle = c.paper; ctx.fill(); ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(xp, F.y(run.peakI), 4, 0, Orrery.TAU); ctx.fillStyle = c.alarm; ctx.fill();
      UI.label(ctx, "peak, day " + Math.round(run.peakT), xp + 5, F.t + 12, c.ink2, "left", "alphabetic", "12px " + c.sans);
    }
  });

  Orrery.bindRange(document.getElementById("sir-r0"), document.getElementById("sir-r0-out"), {
    format: function (x) { return Orrery.fmt.number(x, 1); },
    onInput: function (x) { R0 = x; rebuild(); }
  });
  Orrery.bindRange(document.getElementById("sir-vac"), document.getElementById("sir-vac-out"), {
    format: function (x) { return x + "%"; },
    onInput: function (x) { v = x / 100; rebuild(); }
  });
  rebuild();
})();

/* ---- Figure 3: overshoot -------------------------------------------------
   Final size z = 1 − e^(−R0 z) against the threshold 1 − 1/R0; drag the cursor. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("over-canvas");
  if (!canvasEl) return;
  var stage = canvasEl.parentNode;
  var M = window.HerdModel, UI = HerdUI;
  var X0 = 1, X1 = 6, R0 = 2, F = null;
  var o = { r0: document.getElementById("over-r0"), thr: document.getElementById("over-thr"),
            fin: document.getElementById("over-fin"), gap: document.getElementById("over-gap") };

  function update() {
    R0 = Math.round(Orrery.clamp(R0, 1.01, X1) * 100) / 100;
    var t = M.threshold(R0), z = M.finalSize(R0);
    o.r0.textContent = Orrery.fmt.number(R0, 2);
    o.thr.textContent = UI.pct(t, 1); o.fin.textContent = UI.pct(z, 1); o.gap.textContent = UI.pct(z - t, 1);
    stage.setAttribute("aria-valuenow", R0.toFixed(2));
    stage.setAttribute("aria-valuetext", "R0 " + Orrery.fmt.number(R0, 2) + ": threshold " + UI.pct(t, 1) +
      ", final share infected " + UI.pct(z, 1) + ", overshoot " + UI.pct(z - t, 1));
    view.redraw();
  }

  var view = Orrery.canvas(canvasEl, function draw(ctx, w, h) {
    var c = Orrery.tokens();
    F = UI.frame(w, h, { l: 40, r: 14, t: 14, b: 30 }, X0, X1, 0, 1);
    UI.yAxisPercent(ctx, F, c, [0, 0.25, 0.5, 0.75, 1]);
    for (var k = 1; k <= X1; k++) UI.label(ctx, k === 1 ? "R0 = 1" : String(k), F.x(k), h - 10, c.ink3, k === 1 ? "left" : "center", "alphabetic", "11px " + c.sans);
    // shaded overshoot between the curves
    ctx.beginPath();
    var n = 200, i, x;
    for (i = 0; i <= n; i++) { x = X0 + (X1 - X0) * i / n; ctx[i ? "lineTo" : "moveTo"](F.x(x), F.y(M.finalSize(x))); }
    for (i = n; i >= 0; i--) { x = X0 + (X1 - X0) * i / n; ctx.lineTo(F.x(x), F.y(M.threshold(x))); }
    ctx.closePath(); ctx.globalAlpha = 0.28; ctx.fillStyle = c.brassLit; ctx.fill(); ctx.globalAlpha = 1;
    UI.curve(ctx, F, M.threshold, X0, X1, n); ctx.setLineDash([6, 4]); ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    UI.curve(ctx, F, M.finalSize, X0, X1, n); ctx.strokeStyle = c.alarm; ctx.lineWidth = 2.5; ctx.stroke();
    UI.key(ctx, c, [{ text: "ever infected, no vaccine", color: c.alarm, width: 2.5 },
                    { text: "threshold 1 − 1/R0", color: c.verdigris, dash: [6, 4] }], F.r - 6, F.b - 12);
    // cursor
    var px = F.x(R0), yt = F.y(M.threshold(R0)), yz = F.y(M.finalSize(R0));
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, F.t); ctx.lineTo(px, F.b); ctx.stroke();
    ctx.strokeStyle = c.brass; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(px, yt); ctx.lineTo(px, yz); ctx.stroke();
    ctx.beginPath(); ctx.arc(px, yt, 5, 0, Orrery.TAU); ctx.fillStyle = c.verdigris; ctx.fill();
    ctx.beginPath(); ctx.arc(px, yz, 5, 0, Orrery.TAU); ctx.fillStyle = c.alarm; ctx.fill();
    ctx.beginPath(); ctx.arc(px, F.b, 8, 0, Orrery.TAU); ctx.fillStyle = c.brassLit; ctx.fill();
    ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();
    UI.label(ctx, "overshoot", px + (px > F.r - 90 ? -8 : 8), (yt + yz) / 2 + 4, c.brass,
      px > F.r - 90 ? "right" : "left", "alphabetic", "600 12px " + c.sans);
  });

  function fromPointer(p) { if (F) { R0 = F.inv(p.x); update(); } }
  Orrery.drag(stage, {
    onStart: fromPointer, onMove: fromPointer,
    onNudge: function (dx, dy) { R0 += 0.05 * (dx || -dy); update(); }
  });
  update();
})();

/* ---- Figure 4: the threshold, vaccine efficacy and real diseases ----------
   Needed coverage = (1 − 1/R0) / efficacy, for an all-or-nothing vaccine. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("cov-canvas");
  if (!canvasEl) return;
  var M = window.HerdModel, UI = HerdUI;
  var X0 = 1, X1 = 25, R0 = 15, E = 0.97;
  // Ranges from the sources (see the page): Biggerstaff et al. 2014 (IQRs), Guerra et al. 2017.
  var DISEASES = [
    { name: "seasonal flu", lo: 1.19, hi: 1.37 },
    { name: "1918 flu", lo: 1.47, hi: 2.27 },
    { name: "measles (often cited)", lo: 12, hi: 18 }
  ];
  var o = { thr: document.getElementById("cov-thr"), need: document.getElementById("cov-need"),
            max: document.getElementById("cov-max") };

  function update() {
    var t = M.threshold(R0), need = t / E;
    o.thr.textContent = UI.pct(t, 1);
    o.need.textContent = need > 1 ? "over 100%: impossible" : UI.pct(need, 1);
    o.max.textContent = E >= 1 ? "any" : Orrery.fmt.number(1 / (1 - E), 1);
    canvasEl.setAttribute("aria-label", "Herd immunity threshold and required vaccine coverage against R0 on a logarithmic scale from 1 to 25, with ranges for seasonal flu (about 1.2 to 1.4), 1918 flu (about 1.5 to 2.3) and measles (often cited as 12 to 18). At R0 " +
      Orrery.fmt.number(R0, 1) + " the threshold is " + UI.pct(t, 1) + "; with a vaccine " + Math.round(E * 100) +
      "% effective, coverage needed is " + (need > 1 ? "over 100%, which is impossible" : UI.pct(need, 1)) + ".");
    view.redraw();
  }

  var view = Orrery.canvas(canvasEl, function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var strip = 3 * 17 + 8;
    var F = UI.frame(w, h, { l: 40, r: 14, t: 14, b: 26 + strip }, X0, X1, 0, 1, true);
    UI.yAxisPercent(ctx, F, c, [0, 0.25, 0.5, 0.75, 1]);
    (w < 520 ? [1, 3, 5, 10, 15, 25] : [1, 2, 3, 5, 10, 15, 20, 25]).forEach(function (k) {
      UI.label(ctx, k === 1 ? "R0 = 1" : String(k), F.x(k), F.b + 16, c.ink3, k === 1 ? "left" : "center", "alphabetic", "11px " + c.sans);
    });
    // disease ranges, below the axis
    DISEASES.forEach(function (d, i) {
      var y = F.b + 26 + i * 17, x0 = F.x(d.lo), x1 = F.x(d.hi);
      ctx.fillStyle = c.brassLit; ctx.globalAlpha = 0.55;
      ctx.fillRect(x0, y, Math.max(3, x1 - x0), 10); ctx.globalAlpha = 1;
      var right = x1 + 6 + 140 < w;
      UI.label(ctx, d.name, right ? x1 + 6 : x0 - 6, y + 9, c.ink2, right ? "left" : "right", "alphabetic", "11px " + c.sans);
    });
    // curves
    UI.curve(ctx, F, M.threshold, X0, X1, 300, true);
    ctx.setLineDash([6, 4]); ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    var cut = E >= 1 ? X1 : Math.min(X1, 1 / (1 - E));
    UI.curve(ctx, F, function (x) { return M.threshold(x) / E; }, X0, cut, 300, true);
    ctx.strokeStyle = c.brass; ctx.lineWidth = 2.5; ctx.stroke();
    if (cut < X1) {
      ctx.fillStyle = c.alarm; ctx.globalAlpha = 0.10;
      ctx.fillRect(F.x(cut), F.t, F.r - F.x(cut), F.b - F.t); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(F.x(cut), F.y(1), 4, 0, Orrery.TAU); ctx.fillStyle = c.alarm; ctx.fill();
      if (F.r - F.x(cut) > 70)
        UI.label(ctx, "out of reach", (F.x(cut) + F.r) / 2, F.y(0.5), c.alarm, "center", "middle", "12px " + c.sans);
    }
    UI.key(ctx, c, [{ text: "coverage needed", color: c.brass, width: 2.5 },
                    { text: "threshold 1 − 1/R0", color: c.verdigris, dash: [6, 4] }], F.r - 6, F.b - 12);
    // cursor
    var px = F.x(R0);
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, F.t); ctx.lineTo(px, F.b); ctx.stroke();
    ctx.beginPath(); ctx.arc(px, F.y(M.threshold(R0)), 5, 0, Orrery.TAU); ctx.fillStyle = c.verdigris; ctx.fill();
    var need = M.threshold(R0) / E;
    if (need <= 1) { ctx.beginPath(); ctx.arc(px, F.y(need), 5, 0, Orrery.TAU); ctx.fillStyle = c.brass; ctx.fill(); }
  });

  Orrery.bindRange(document.getElementById("cov-r0"), document.getElementById("cov-r0-out"), {
    format: function (x) { return Orrery.fmt.number(x, 1); },
    onInput: function (x) { R0 = x; update(); }
  });
  Orrery.bindRange(document.getElementById("cov-eff"), document.getElementById("cov-eff-out"), {
    format: function (x) { return x + "%"; },
    onInput: function (x) { E = x / 100; update(); }
  });
  update();
})();
