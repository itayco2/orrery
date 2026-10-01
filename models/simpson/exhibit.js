/* Exhibit script: "Better in every group, worse overall?" (Simpson's paradox).
   One IIFE per figure. Colours: A / open surgery = brass, B / PCNL = verdigris. */

/* Shared: kidney-stone data, Charig et al. 1986 via Julious & Mullee 1994. */
var SIMPSON_STONES = {
  open: { name: "Open surgery", small: [81, 87], large: [192, 263] },
  pcnl: { name: "PCNL", small: [234, 270], large: [55, 80] }
};

/* ---- Figure 1: make the paradox happen ---------------------------------- */
(function () {
  "use strict";
  var cv = document.getElementById("mix-canvas");
  if (!cv) return;
  var s = {};
  var ids = ["aE", "aH", "aPE", "aPH", "bE", "bH", "bPE", "bPH"];
  var verdict = document.getElementById("mix-verdict");
  var pct = function (x) { return Orrery.fmt.number(x, 0) + "%"; };

  function model() {
    var aN = s.aE + s.aH, bN = s.bE + s.bH;
    return {
      a: { e: s.aPE, h: s.aPH, all: (s.aE * s.aPE + s.aH * s.aPH) / aN, nE: s.aE, nH: s.aH, n: aN },
      b: { e: s.bPE, h: s.bPH, all: (s.bE * s.bPE + s.bH * s.bPH) / bN, nE: s.bE, nH: s.bH, n: bN }
    };
  }
  function sign(x) { return Math.abs(x) < 1e-9 ? 0 : (x > 0 ? 1 : -1); }

  function updateText(m) {
    document.getElementById("mix-a-all").textContent = Orrery.fmt.number(m.a.all, 1) + "% of " + m.a.n;
    document.getElementById("mix-b-all").textContent = Orrery.fmt.number(m.b.all, 1) + "% of " + m.b.n;
    document.getElementById("mix-a-share").textContent = Orrery.fmt.percent(m.a.nH / m.a.n, 0);
    document.getElementById("mix-b-share").textContent = Orrery.fmt.percent(m.b.nH / m.b.n, 0);
    var dE = sign(m.a.e - m.b.e), dH = sign(m.a.h - m.b.h), dAll = sign(Math.round(m.a.all * 10) - Math.round(m.b.all * 10));
    var txt, paradox = false;
    var groups = "easy cases (" + pct(m.a.e) + " vs " + pct(m.b.e) + ") and hard cases (" + pct(m.a.h) + " vs " + pct(m.b.h) + ")";
    var overall = "(" + Orrery.fmt.number(m.a.all, 1) + "% vs " + Orrery.fmt.number(m.b.all, 1) + "%)";
    if (dE !== 0 && dE === dH && dAll === -dE) {
      paradox = true;
      var w = dE > 0 ? "A" : "B", l = dE > 0 ? "B" : "A";
      txt = "<strong>Paradox.</strong> " + w + " beats " + l + " among " + groups +
        ", yet " + l + " does better overall " + overall + ".";
    } else if (dE !== 0 && dE === dH && dAll === dE) {
      txt = "No reversal: " + (dE > 0 ? "A" : "B") + " does better in both groups and overall " + overall + ".";
    } else if (dE !== 0 && dE === dH) {
      txt = "Nearly: " + (dE > 0 ? "A" : "B") + " does better in both groups, and overall the two are tied " + overall + ".";
    } else if ((dE === 0) !== (dH === 0)) {
      var w2 = (dE || dH) > 0 ? "A" : "B", l2 = w2 === "A" ? "B" : "A";
      txt = w2 + " does better in one group and ties the other: " + groups + ". So " + l2 +
        " is not better in any group. Overall " + overall + (dAll === -(dE || dH)
          ? ": " + l2 + " still comes out ahead, the same reversal in a weaker form." : ".");
    } else if (dE === 0 && dH === 0) {
      txt = "A and B have the same success rate in each group, so neither is better. Overall " + overall + ".";
    } else {
      txt = "No single winner within groups: A vs B among " + groups + ". With the groups disagreeing, there is nothing for the overall rate to reverse. Overall " + overall + ".";
    }
    verdict.innerHTML = txt;
    verdict.classList.toggle("paradox", paradox);
  }

  var view = Orrery.canvas(cv, function (ctx, w, h) {
    var c = Orrery.tokens(), m = model();
    if (w < 60 || h < 60) { updateText(m); return; }
    var narrow = w < 480;
    var padL = narrow ? 40 : 44, padR = 8, top = 22, bot = narrow ? 44 : 46;
    var plotH = h - top - bot, x0 = padL, x1 = w - padR;
    function Y(p) { return top + plotH * (1 - p / 100); }
    ctx.font = (narrow ? 11 : 12) + "px " + c.sans;
    ctx.textBaseline = "middle"; ctx.textAlign = "right";
    for (var g = 0; g <= 100; g += 25) {
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, Y(g) + 0.5); ctx.lineTo(x1, Y(g) + 0.5); ctx.stroke();
      ctx.fillStyle = c.ink3; ctx.fillText(g + "%", x0 - 6, Y(g));
    }
    var groups = [["Easy cases", m.a.e, m.b.e, m.a.nE, m.b.nE], ["Hard cases", m.a.h, m.b.h, m.a.nH, m.b.nH],
                  ["Overall", m.a.all, m.b.all, m.a.n, m.b.n]];
    var gw = (x1 - x0) / 3;
    groups.forEach(function (gr, i) {
      var gx = x0 + gw * i, bw = Math.min(gw * 0.3, 70), gap = Math.min(gw * 0.06, 12);
      var cx = gx + gw / 2;
      if (i === 2) {
        ctx.strokeStyle = c.ink3; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(gx + 0.5, top - 10); ctx.lineTo(gx + 0.5, h - bot + 4); ctx.stroke(); ctx.setLineDash([]);
      }
      [[gr[1], gr[3], c.brassLit, c.brass, "A"], [gr[2], gr[4], c.verdigrisLit, c.verdigris, "B"]].forEach(function (b, j) {
        var bx = j === 0 ? cx - gap / 2 - bw : cx + gap / 2;
        var y = Y(b[0]);
        ctx.fillStyle = b[2]; ctx.fillRect(bx, y, bw, Y(0) - y);
        ctx.strokeStyle = b[3]; ctx.lineWidth = 1.5; ctx.strokeRect(bx + 0.75, y + 0.75, bw - 1.5, Y(0) - y - 1.5);
        ctx.fillStyle = c.ink; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.font = "600 " + (narrow ? 11 : 13) + "px " + c.sans;
        ctx.fillText(Orrery.fmt.number(b[0], i === 2 ? 1 : 0) + "%", bx + bw / 2, y - 3);
        ctx.font = (narrow ? 10 : 12) + "px " + c.sans; ctx.fillStyle = c.ink3; ctx.textBaseline = "top";
        ctx.fillText(b[4] + (narrow ? "" : " · ") + (narrow ? "" : "n=" + b[1]), bx + bw / 2, Y(0) + 4);
        if (narrow) ctx.fillText(String(b[1]), bx + bw / 2, Y(0) + 16);
      });
      ctx.fillStyle = c.ink2; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.font = "600 " + (narrow ? 11 : 13) + "px " + c.sans;
      ctx.fillText(gr[0], cx, h - 2);
    });
    updateText(m);
  });

  ids.forEach(function (id) {
    var isRate = id.length === 3;
    Orrery.bindRange(document.getElementById(id), document.getElementById(id + "-out"), {
      format: function (v) { return isRate ? v + "%" : v + " patients"; },
      onInput: function (v) { s[id] = v; if (Object.keys(s).length === ids.length) view.redraw(); }
    });
  });
  view.redraw();
})();

/* ---- Figure 2: the kidney-stone patients, overall or by size ------------ */
(function () {
  "use strict";
  var cv = document.getElementById("stones-canvas");
  if (!cv) return;
  var D = SIMPSON_STONES;
  var split = false;
  var bAll = document.getElementById("stones-all"), bSplit = document.getElementById("stones-split");
  var verdict = document.getElementById("stones-verdict");
  var table = document.getElementById("stones-table");
  var ROWS = 10;

  function blocks(t) {
    var d = D[t];
    if (!split) return [{ label: "All patients", k: d.small[0] + d.large[0], n: d.small[1] + d.large[1] }];
    return [{ label: "Small stones", k: d.small[0], n: d.small[1] }, { label: "Large stones", k: d.large[0], n: d.large[1] }];
  }

  var view = Orrery.canvas(cv, function (ctx, w, h) {
    var c = Orrery.tokens(), narrow = w < 480;
    var GAPCOLS = 2.5, maxCols = 36 + GAPCOLS;          // widest row: open surgery split, 9 + 27 columns
    var labelW = narrow ? 0 : 104;
    var cell = Math.min((w - labelW - 8) / maxCols, (h - 8) / (2 * ROWS + (narrow ? (split ? 10.8 : 8) : 6)));
    if (!(cell > 1)) return;                              // canvas not laid out yet
    var r = cell * 0.36;
    var rowH = ROWS * cell + cell * (narrow ? (split ? 5.4 : 4) : 3);
    ["open", "pcnl"].forEach(function (t, ti) {
      var fill = t === "open" ? c.brassLit : c.verdigrisLit, line = t === "open" ? c.brass : c.verdigris;
      var y0 = 4 + ti * rowH + cell * (narrow ? (split ? 4.4 : 3) : 2);
      var x = labelW + 4;
      ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
      if (!narrow) {
        ctx.font = "600 13px " + c.sans; ctx.fillStyle = c.ink2;
        ctx.fillText(D[t].name, 0, y0 + ROWS * cell / 2 + 4);
      }
      blocks(t).forEach(function (b) {
        var cols = Math.ceil(b.n / ROWS);
        ctx.font = (narrow ? "600 10px " : "600 12px ") + c.sans; ctx.fillStyle = c.ink;
        var lab = (narrow ? (split ? "" : D[t].name + " · ") : "") + (split ? b.label.replace(" stones", "") + ": " : "") +
          b.k + "/" + b.n + " = " + Orrery.fmt.number(100 * b.k / b.n, 0) + "%";
        if (narrow && split && b.label === "Small stones") lab = D[t].name + " · " + lab;
        if (narrow && split) {          // three short lines: treatment, block, count
          if (b.label === "Small stones") ctx.fillText(D[t].name, labelW + 4, y0 - cell * 3.3);
          ctx.fillText(b.label.replace(" stones", ""), x, y0 - cell * 2);
          ctx.fillText(b.k + "/" + b.n + " = " + Orrery.fmt.number(100 * b.k / b.n, 0) + "%", x, y0 - cell * 0.7);
        } else ctx.fillText(lab, x, y0 - cell * 0.7);
        for (var i = 0; i < b.n; i++) {
          var cx = x + Math.floor(i / ROWS) * cell + cell / 2, cy = y0 + (i % ROWS) * cell + cell / 2;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Orrery.TAU);
          if (i < b.k) { ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.stroke(); }
          else { ctx.strokeStyle = c.alarm; ctx.lineWidth = 1.2; ctx.stroke(); }
        }
        x += (cols + GAPCOLS) * cell;
      });
    });
  });

  function set(v) {
    split = v;
    bAll.setAttribute("aria-pressed", String(!v));
    bSplit.setAttribute("aria-pressed", String(v));
    var tds = table.querySelectorAll("tbody td");
    for (var i = 0; i < tds.length; i++) {
      var isAll = i % 3 === 2;
      tds[i].className = (isAll !== v) ? "hi" : "dim";
    }
    verdict.innerHTML = v
      ? "By stone size, <strong>open surgery</strong> does better for small stones (93% vs 87%) <em>and</em> for large stones (73% vs 69%)."
      : "Overall, <strong>PCNL</strong> does better: 289 of 350 (83%) against 273 of 350 (78%) for open surgery.";
    view.redraw();
  }
  bAll.addEventListener("click", function () { set(false); });
  bSplit.addEventListener("click", function () { set(true); });
  set(false);
})();

/* ---- Figure 3: an overall rate is a weighted average --------------------- */
(function () {
  "use strict";
  var cv = document.getElementById("weights-canvas");
  if (!cv) return;
  var D = SIMPSON_STONES;
  var rate = {
    open: [D.open.small[0] / D.open.small[1], D.open.large[0] / D.open.large[1]],
    pcnl: [D.pcnl.small[0] / D.pcnl.small[1], D.pcnl.large[0] / D.pcnl.large[1]]
  };
  var REAL = { open: D.open.large[1] / (D.open.small[1] + D.open.large[1]),     // 263/350
               pcnl: D.pcnl.large[1] / (D.pcnl.small[1] + D.pcnl.large[1]) };   // 80/350
  var POOLED = (D.open.large[1] + D.pcnl.large[1]) / 700;                          // 343/700
  var w = { open: REAL.open, pcnl: REAL.pcnl };
  var YMIN = 0.6, YMAX = 1.0;
  var geom = null;
  var outs = { open: document.getElementById("w-open-all"), pcnl: document.getElementById("w-pcnl-all") };
  function overall(t) { return (1 - w[t]) * rate[t][0] + w[t] * rate[t][1]; }

  var view = Orrery.canvas(cv, function (ctx, W, H) {
    var c = Orrery.tokens(), narrow = W < 480;
    if (W < 60 || H < 60) { updateText(); return; }
    var padL = narrow ? 50 : 60, padR = narrow ? 12 : 20, top = 16, bot = narrow ? 52 : 48;
    var x0 = padL, x1 = W - padR, y0 = top, y1 = H - bot;
    function X(f) { return x0 + (x1 - x0) * f; }
    function Y(p) { return y1 - (y1 - y0) * (p - YMIN) / (YMAX - YMIN); }
    geom = { X: X, Y: Y, x0: x0, x1: x1 };
    ctx.font = (narrow ? 11 : 12) + "px " + c.sans;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (var g = 0.6; g <= 1.0001; g += 0.1) {
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, Math.round(Y(g)) + 0.5); ctx.lineTo(x1, Math.round(Y(g)) + 0.5); ctx.stroke();
      ctx.fillStyle = c.ink3; ctx.fillText(Math.round(g * 100) + "%", x0 - 6, Y(g));
    }
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      ctx.fillStyle = c.ink3; ctx.fillText(Math.round(f * 100) + "%", X(f), y1 + 6);
    });
    ctx.fillStyle = c.ink2; ctx.textBaseline = "bottom";
    ctx.fillText(narrow ? "share with large stones →" : "share of the treatment’s patients with large stones →", (x0 + x1) / 2, H - 2);
    ctx.save(); ctx.translate(10, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "middle"; ctx.fillText("success rate", 0, 0); ctx.restore();

    ["pcnl", "open"].forEach(function (t) {
      var col = t === "open" ? c.brass : c.verdigris, fill = t === "open" ? c.brassLit : c.verdigrisLit;
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(X(0), Y(rate[t][0])); ctx.lineTo(X(1), Y(rate[t][1])); ctx.stroke();
      // end labels
      ctx.font = "600 " + (narrow ? 11 : 12) + "px " + c.sans; ctx.fillStyle = col; ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      var ly = Y(rate[t][0]) + (t === "open" ? -11 : 11);
      ctx.fillText(D[t].name + " · small " + Orrery.fmt.number(rate[t][0] * 100, 1) + "%", X(0) + 6, ly);
      ctx.textAlign = "right";
      var ry = Y(rate[t][1]) + (t === "open" ? -11 : 11);
      ctx.fillText("large " + Orrery.fmt.number(rate[t][1] * 100, 1) + "%", X(1) - 4, ry);
      // the overall dot
      var px = X(w[t]), py = Y(overall(t));
      ctx.setLineDash([3, 3]); ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x0, py); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(px, py, 8, 0, Orrery.TAU); ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = c.ink; ctx.font = "600 " + (narrow ? 12 : 13) + "px " + c.sans;
      ctx.textAlign = w[t] > 0.6 ? "right" : "left"; ctx.textBaseline = "middle";
      var ox = w[t] > 0.6 ? -13 : 13;
      ctx.fillText(Orrery.fmt.number(overall(t) * 100, 1) + "%", px + ox, py + (t === "open" ? -14 : 14));
    });
    updateText();
  });

  function updateText() {
    outs.open.textContent = Orrery.fmt.number(overall("open") * 100, 1) + "%";
    outs.pcnl.textContent = Orrery.fmt.number(overall("pcnl") * 100, 1) + "%";
    var d = Math.round(overall("open") * 1000) - Math.round(overall("pcnl") * 1000);
    document.getElementById("w-winner").textContent = d > 0 ? "Open surgery" : d < 0 ? "PCNL" : "Tie";
  }

  var ranges = {};
  ["open", "pcnl"].forEach(function (t) {
    ranges[t] = Orrery.bindRange(document.getElementById("w-" + t), document.getElementById("w-" + t + "-out"), {
      format: function (v) { return v + "%"; },
      onInput: function (v) { w[t] = v / 100; view.redraw(); },
      init: false
    });
  });
  function setBoth(a, b) {
    w.open = a; w.pcnl = b;
    ranges.open.set(Math.round(a * 100)); ranges.pcnl.set(Math.round(b * 100));
    w.open = a; w.pcnl = b;            // keep the exact real shares, not the rounded slider values
    view.redraw();
  }
  document.getElementById("w-real").addEventListener("click", function () { setBoth(REAL.open, REAL.pcnl); });
  document.getElementById("w-same").addEventListener("click", function () { setBoth(POOLED, POOLED); });

  var dragging = null;
  Orrery.drag(cv.parentNode, {
    hitTest: function (p) {
      if (!geom) return false;
      var best = null, bd = 24 * 24;
      ["open", "pcnl"].forEach(function (t) {
        var dx = p.x - geom.X(w[t]), dy = p.y - geom.Y(overall(t)), d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = t; }
      });
      dragging = best;
      return best !== null;
    },
    onMove: function (p) {
      if (!dragging) return;
      var f = Orrery.clamp((p.x - geom.x0) / (geom.x1 - geom.x0), 0, 1);
      w[dragging] = f;
      ranges[dragging].set(Math.round(f * 100));
      w[dragging] = f;
      view.redraw();
    },
    onEnd: function () { dragging = null; }
  });
  setBoth(REAL.open, REAL.pcnl);
})();

/* ---- Figure 4: which number to trust? Two causal stories ----------------- */
(function () {
  "use strict";
  var svg = document.getElementById("cause-svg");
  if (!svg) return;
  var NS = "http://www.w3.org/2000/svg";
  var bConf = document.getElementById("cause-conf"), bMed = document.getElementById("cause-med");
  var desc = document.getElementById("cause-desc");
  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    svg.appendChild(e);
    return e;
  }
  var N = { g: [300, 50], t: [115, 248], o: [485, 248] };
  var STORIES = {
    conf: {
      group: ["Stone size", "(before treatment)"], t: "Treatment", o: "Success",
      arrows: [["g", "t", true], ["g", "o", true], ["t", "o", false]],
      label: ["back door:", "case mix"], bottom: "the effect we want",
      text: "<strong>Compare within groups.</strong> Stone size affects both which treatment a patient gets and whether it works. The overall comparison mixes in that back-door path, so it partly measures who got the large stones. Within each size, that path is blocked: open surgery does better."
    },
    med: {
      group: ["Blood pressure", "(after treatment)"], t: "Drug", o: "Recovery",
      arrows: [["t", "g", true], ["g", "o", true], ["t", "o", false]],
      label: ["part of how", "the drug works"], bottom: "the rest of the effect",
      text: "<strong>Use the overall number.</strong> Here the drug changes blood pressure, and that change is part of how it helps. Splitting patients by their blood pressure after treatment would block the very path through which the drug works, and hide part of its effect. (A made-up illustration, after Pearl.)"
    }
  };
  var HW = 108, HH = 36;                                 // node half-width / half-height
  function arrow(a, b, hot) {
    var p = N[a], q = N[b], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.sqrt(dx * dx + dy * dy);
    var ux = dx / L, uy = dy / L;
    var edge = Math.min(Math.abs(ux) > 1e-6 ? HW / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-6 ? HH / Math.abs(uy) : 1e9);
    var x1 = p[0] + ux * (edge + 4), y1 = p[1] + uy * (edge + 4), x2 = q[0] - ux * (edge + 4), y2 = q[1] - uy * (edge + 4);
    var col = hot ? "var(--alarm)" : "var(--ink-2)";
    el("line", { x1: x1, y1: y1, x2: x2 - ux * 10, y2: y2 - uy * 10, stroke: col, "stroke-width": hot ? 4 : 3 });
    var hx = x2, hy = y2, s = 14, nx = -uy, ny = ux;
    el("path", { d: "M" + hx + " " + hy + " L" + (hx - ux * s * 1.4 + nx * s * 0.6) + " " + (hy - uy * s * 1.4 + ny * s * 0.6) +
      " L" + (hx - ux * s * 1.4 - nx * s * 0.6) + " " + (hy - uy * s * 1.4 - ny * s * 0.6) + " Z", fill: col });
  }
  function node(k, lines, fill, stroke) {
    var p = N[k];
    el("rect", { x: p[0] - HW, y: p[1] - HH, width: 2 * HW, height: 2 * HH, rx: HH, fill: fill, stroke: stroke, "stroke-width": 2 });
    el("text", { x: p[0], y: p[1] + (lines[1] ? -2 : 8), "text-anchor": "middle", "font-size": 23, "font-weight": 650, fill: "var(--ink)" }, lines[0]);
    if (lines[1]) el("text", { x: p[0], y: p[1] + 21, "text-anchor": "middle", "font-size": 16, fill: "var(--ink-2)" }, lines[1]);
  }
  function render(k) {
    var st = STORIES[k];
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    st.arrows.forEach(function (a) { arrow(a[0], a[1], a[2]); });
    st.label.forEach(function (line, i) {
      el("text", { x: 300, y: 168 + i * 22, "text-anchor": "middle", "font-size": 18, "font-weight": 600, fill: "var(--alarm)" }, line);
    });
    el("text", { x: 300, y: 300, "text-anchor": "middle", "font-size": 17, fill: "var(--ink-2)" }, st.bottom);
    node("g", st.group, "var(--paper-3)", "var(--ink-3)");
    node("t", [st.t], "var(--brass-lit)", "var(--brass)");
    node("o", [st.o], "var(--verdigris-lit)", "var(--verdigris)");
    desc.innerHTML = st.text;
    bConf.setAttribute("aria-pressed", String(k === "conf"));
    bMed.setAttribute("aria-pressed", String(k === "med"));
  }
  bConf.addEventListener("click", function () { render("conf"); });
  bMed.addEventListener("click", function () { render("med"); });
  render("conf");
})();
