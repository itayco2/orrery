/* Exhibit: "Why do bell curves show up everywhere?" (galton)
   One IIFE per figure, using the shared kit (window.Orrery). */

/* ---- shared helpers ------------------------------------------------------ */
var Galton = (function () {
  "use strict";
  // Small fast seeded PRNG (mulberry32) so the default states are reproducible.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Exact binomial probabilities P(K = k), k = 0..n, computed in log space.
  function binomial(n, p) {
    var out = [], lf = [0];
    for (var i = 1; i <= n; i++) lf[i] = lf[i - 1] + Math.log(i);
    for (var k = 0; k <= n; k++) {
      if (p <= 0) { out.push(k === 0 ? 1 : 0); continue; }
      if (p >= 1) { out.push(k === n ? 1 : 0); continue; }
      out.push(Math.exp(lf[n] - lf[k] - lf[n - k] + k * Math.log(p) + (n - k) * Math.log(1 - p)));
    }
    return out;
  }
  function normalPdf(x, mu, sd) {
    var z = (x - mu) / sd;
    return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
  }
  // Standard normal CDF (Abramowitz & Stegun 7.1.26 via erf; |error| < 1.5e-7).
  function normalCdf(z) {
    var x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  }
  function legend(ctx, c, items, x, y) {
    ctx.font = "12px " + c.sans; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (var i = 0; i < items.length; i++) {
      var it = items[i], yy = y + i * 17;
      if (it.kind === "bar") { ctx.fillStyle = it.color; ctx.fillRect(x, yy - 5, 14, 10); }
      else if (it.kind === "dot") { ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(x + 7, yy, 3.5, 0, Orrery.TAU); ctx.fill(); }
      else { ctx.strokeStyle = it.color; ctx.lineWidth = 2; if (it.dash) ctx.setLineDash(it.dash); ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + 14, yy); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = c.ink2; ctx.fillText(it.label, x + 20, yy);
    }
    ctx.textBaseline = "alphabetic";
  }
  return { rng: rng, binomial: binomial, normalPdf: normalPdf, normalCdf: normalCdf, legend: legend };
})();

/* ---- Figure 1: the Galton board ----------------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("board-canvas");
  if (!canvasEl) return;
  var TAU = Orrery.TAU;
  var rand = Galton.rng(1889);
  var rows = 12, p = 0.5, rate = 12;   // rate: balls released per second
  var FALL = 9;                          // rows per second a ball falls
  var bins = [], total = 0, sum = 0, sumSq = 0;
  var flying = [], releaseDebt = 0;
  var showBinom = true, showNormal = true;
  var out = {
    n: document.getElementById("board-count"),
    mean: document.getElementById("board-mean"),
    sd: document.getElementById("board-sd"),
    mid: document.getElementById("board-mid")
  };

  function reset() {
    bins = []; for (var k = 0; k <= rows; k++) bins.push(0);
    total = 0; sum = 0; sumSq = 0; flying = [];
  }
  function land(k) { bins[k]++; total++; sum += k; sumSq += k * k; }
  function dropInstant(m) {
    for (var i = 0; i < m; i++) {
      var k = 0;
      for (var r = 0; r < rows; r++) if (rand() < p) k++;
      land(k);
    }
  }
  function launch() {
    var path = [];
    for (var r = 0; r < rows; r++) path.push(rand() < p ? 1 : 0);
    flying.push({ s: 0, path: path });
  }

  var view = Orrery.canvas(canvasEl, draw);

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var n = rows;
    var dx = Math.min(w / (n + 3), 46);
    var cx = w / 2;
    var top = 18, boardH = h * 0.46, dy = boardH / Math.max(n, 1);
    var binTop = top + boardH + dy * 0.5, base = h - 22;
    var probs = Galton.binomial(n, p);
    var mu = n * p, sd = Math.sqrt(n * p * (1 - p));
    // vertical scale: tallest of observed and expected
    var maxC = 1;
    for (var k = 0; k <= n; k++) maxC = Math.max(maxC, bins[k], total * probs[k]);
    if (showNormal && sd > 0) maxC = Math.max(maxC, total * Galton.normalPdf(mu, mu, sd));
    var scale = (base - binTop - 8) / maxC;
    var dot = Math.max(1.8, Math.min(4, dx * 0.14));

    // funnel
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - dx * 0.9, top - 14); ctx.lineTo(cx - dx * 0.25, top - 2);
    ctx.moveTo(cx + dx * 0.9, top - 14); ctx.lineTo(cx + dx * 0.25, top - 2); ctx.stroke();
    // pegs
    ctx.fillStyle = c.ink3;
    for (var r = 0; r < n; r++) {
      for (var j = 0; j <= r; j++) {
        ctx.beginPath(); ctx.arc(cx + (j - r / 2) * dx, top + (r + 0.5) * dy, dot, 0, TAU); ctx.fill();
      }
    }
    // bin walls and baseline
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath();
    for (k = 0; k <= n + 1; k++) { var bx = cx + (k - 0.5 - n / 2) * dx; ctx.moveTo(bx, binTop); ctx.lineTo(bx, base); }
    ctx.moveTo(cx - (n / 2 + 0.5) * dx - 6, base); ctx.lineTo(cx + (n / 2 + 0.5) * dx + 6, base);
    ctx.stroke();
    // observed counts
    ctx.fillStyle = c.brassLit;
    for (k = 0; k <= n; k++) {
      var bh = bins[k] * scale;
      if (bh > 0) ctx.fillRect(cx + (k - 0.5 - n / 2) * dx + 1.5, base - bh, dx - 3, bh);
    }
    // normal curve
    if (showNormal && sd > 0 && total > 0) {
      ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2; ctx.beginPath();
      var xl = cx - (n / 2 + 0.5) * dx, xr = cx + (n / 2 + 0.5) * dx;
      for (var px = xl; px <= xr; px += 2) {
        var kk = (px - cx) / dx + n / 2;
        var y = base - total * Galton.normalPdf(kk, mu, sd) * scale;
        if (px === xl) ctx.moveTo(px, y); else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
    // exact binomial expectation, as a tick per bin
    if (showBinom && total > 0) {
      ctx.strokeStyle = c.ink; ctx.lineWidth = 2;
      ctx.beginPath();
      for (k = 0; k <= n; k++) {
        var ey = base - total * probs[k] * scale;
        ctx.moveTo(cx + (k - 0.42 - n / 2) * dx, ey); ctx.lineTo(cx + (k + 0.42 - n / 2) * dx, ey);
      }
      ctx.stroke();
    }
    // balls in flight
    ctx.fillStyle = c.brass;
    var br = Math.max(2.5, Math.min(5, dx * 0.16));
    for (var i = 0; i < flying.length; i++) {
      var b = flying[i], s = b.s, ri = Math.floor(s), f = s - ri, kpos = 0;
      for (var q = 0; q < ri && q < n; q++) kpos += b.path[q];
      var x0 = cx + (kpos - ri / 2) * dx, x1 = x0;
      if (ri < n) x1 = cx + (kpos + b.path[ri] - (ri + 1) / 2) * dx;
      var bxp = x0 + (x1 - x0) * f;
      var byp = top + s * dy - Math.sin(f * Math.PI) * dy * 0.25 - br - dot + dy * 0.5;
      ctx.beginPath(); ctx.arc(bxp, byp, br, 0, TAU); ctx.fill();
    }
    // labels
    ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans; ctx.textAlign = "center";
    var every = n > 14 ? 2 : 1;
    for (k = 0; k <= n; k += every) ctx.fillText(String(k), cx + (k - n / 2) * dx, h - 7);
    if (w > 520) {
      ctx.textAlign = "right"; ctx.fillText("bin = number of", w - 10, top + 4);
      ctx.fillText("bounces to the right", w - 10, top + 18);
      Galton.legend(ctx, c, [
        { kind: "bar", color: c.brassLit, label: "balls landed" },
        { kind: "line", color: c.ink, label: "exact binomial" },
        { kind: "line", color: c.verdigris, label: "normal curve" }
      ], 10, top + 4);
    }
    readouts(probs);
  }

  function readouts(probs) {
    var n = rows;
    out.n.textContent = Orrery.fmt.number(total, 0);
    var mu = n * p, sd = Math.sqrt(n * p * (1 - p));
    if (total > 0) {
      var m = sum / total, v = Math.max(0, sumSq / total - m * m);
      out.mean.textContent = Orrery.fmt.number(m, 2) + " (exact " + Orrery.fmt.number(mu, 2) + ")";
      out.sd.textContent = Orrery.fmt.number(Math.sqrt(v), 2) + " (exact " + Orrery.fmt.number(sd, 2) + ")";
    } else {
      out.mean.textContent = "— (exact " + Orrery.fmt.number(mu, 2) + ")";
      out.sd.textContent = "— (exact " + Orrery.fmt.number(sd, 2) + ")";
    }
    var best = 0; for (var k = 1; k <= n; k++) if (probs[k] > probs[best]) best = k;
    out.mid.textContent = "bin " + best + ": " + Orrery.fmt.percent(probs[best], 1);
  }

  function step(dt) {
    releaseDebt += dt * rate;
    while (releaseDebt >= 1) { releaseDebt -= 1; if (flying.length < 400) launch(); }
    for (var i = flying.length - 1; i >= 0; i--) {
      var b = flying[i];
      b.s += dt * FALL;
      if (b.s >= rows) {
        var k = 0; for (var r = 0; r < rows; r++) k += b.path[r];
        land(k); flying.splice(i, 1);
      }
    }
    view.redraw();
  }

  reset(); dropInstant(150);
  var loop = Orrery.loop(canvasEl, step, { button: document.getElementById("board-play"),
    labels: { play: "Release balls", pause: "Pause" } });

  Orrery.bindRange(document.getElementById("board-rows"), document.getElementById("board-rows-out"), {
    format: function (v) { return v + (v === 1 ? " row" : " rows"); },
    onInput: function (v) { if (v !== rows) { rows = v; reset(); dropInstant(150); } view.redraw(); }
  });
  Orrery.bindRange(document.getElementById("board-p"), document.getElementById("board-p-out"), {
    format: function (v) { return Orrery.fmt.percent(v, 0) + " right"; },
    onInput: function (v) { if (v !== p) { p = v; reset(); dropInstant(150); } view.redraw(); }
  });
  Orrery.bindRange(document.getElementById("board-rate"), document.getElementById("board-rate-out"), {
    format: function (v) { return v + " balls/s"; },
    onInput: function (v) { rate = v; }
  });
  document.getElementById("board-drop").addEventListener("click", function () { dropInstant(1000); view.redraw(); });
  document.getElementById("board-reset").addEventListener("click", function () { reset(); view.redraw(); });
  document.getElementById("board-binom").addEventListener("change", function (e) { showBinom = e.target.checked; view.redraw(); });
  document.getElementById("board-normal").addEventListener("change", function (e) { showNormal = e.target.checked; view.redraw(); });
  void loop;
})();

/* ---- Figure 2: add anything up (exact, by convolution) ------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("sum-canvas");
  if (!canvasEl) return;
  // Each effect: probabilities over the values 0..len-1 (value = index + offset).
  var SHAPES = {
    fair:   { name: "fair die",        off: 1, p: [1, 1, 1, 1, 1, 1] },
    lop:    { name: "lopsided die",    off: 1, p: [6, 2, 1, 1, 1, 1] },
    humps:  { name: "two-humped die",  off: 1, p: [8, 1, 1, 1, 1, 8] },
    jack:   { name: "1-in-10 coin",    off: 0, p: [9, 1] }
  };
  var shapeKey = "lop", n = 1;
  var buttons = document.querySelectorAll("#sum-shapes button");
  var out = {
    mean: document.getElementById("sum-mean"), sd: document.getElementById("sum-sd"),
    skew: document.getElementById("sum-skew"), gap: document.getElementById("sum-gap")
  };
  var pmf = [], off = 0, mu = 0, sd = 0, skew = 0, gap = 0, one = null;

  function compute() {
    var s = SHAPES[shapeKey], tot = 0, i, j;
    for (i = 0; i < s.p.length; i++) tot += s.p[i];
    one = s.p.map(function (v) { return v / tot; });
    var m1 = 0, m2 = 0, m3 = 0;
    for (i = 0; i < one.length; i++) m1 += one[i] * i;
    for (i = 0; i < one.length; i++) { var d = i - m1; m2 += one[i] * d * d; m3 += one[i] * d * d * d; }
    var cur = [1];
    for (var t = 0; t < n; t++) {
      var nxt = new Array(cur.length + one.length - 1).fill(0);
      for (i = 0; i < cur.length; i++) for (j = 0; j < one.length; j++) nxt[i + j] += cur[i] * one[j];
      cur = nxt;
    }
    pmf = cur; off = s.off * n;
    mu = n * (m1 + s.off); sd = Math.sqrt(n * m2);
    skew = (m3 / Math.pow(m2, 1.5)) / Math.sqrt(n);
    // largest gap between the exact CDF and the normal CDF, checked on both sides of every
    // jump (the same measure as Figure 3, so the two figures agree)
    var F = 0; gap = 0;
    for (i = 0; i < pmf.length; i++) {
      var Phi = Galton.normalCdf((i + off - mu) / sd);
      gap = Math.max(gap, Math.abs(F - Phi));
      F += pmf[i];
      gap = Math.max(gap, Math.abs(F - Phi));
    }
  }

  compute();
  var view = Orrery.canvas(canvasEl, draw);

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var padL = 12, padR = 12, padT = 14, padB = 26;
    // inset: the single effect
    var insetW = Math.min(150, w * 0.3), insetH = Math.min(70, h * 0.28);
    var ix = w - padR - insetW, iy = padT + 14;
    // x range: whole support, or mean ± 5 sd when that is narrower
    var lo = off, hi = off + pmf.length - 1;
    lo = Math.max(lo, Math.floor(mu - 5 * sd)); hi = Math.min(hi, Math.ceil(mu + 5 * sd));
    if (hi - lo < 6) { lo = Math.max(off, lo - 2); hi = Math.min(off + pmf.length - 1, hi + 2); }
    var span = hi - lo + 1;
    var plotW = w - padL - padR, bw = plotW / span;
    var maxP = 0, i;
    for (i = 0; i < pmf.length; i++) maxP = Math.max(maxP, pmf[i]);
    maxP = Math.max(maxP, Galton.normalPdf(mu, mu, sd));
    var base = h - padB, top = padT + insetH + 24;
    var sc = (base - top) / maxP;
    // bars
    ctx.fillStyle = c.brassLit;
    for (var v = lo; v <= hi; v++) {
      var pv = pmf[v - off] || 0, bh = pv * sc;
      var gapPx = bw > 6 ? Math.min(2, bw * 0.15) : 0;
      ctx.fillRect(padL + (v - lo) * bw + gapPx / 2, base - bh, Math.max(0.6, bw - gapPx), bh);
    }
    // normal curve with the same mean and spread
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2; ctx.beginPath();
    for (var px = 0; px <= plotW; px += 2) {
      var xv = lo - 0.5 + px / bw, y = base - Galton.normalPdf(xv, mu, sd) * sc;
      if (px === 0) ctx.moveTo(padL + px, y); else ctx.lineTo(padL + px, y);
    }
    ctx.stroke();
    // axis
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, base + 0.5); ctx.lineTo(w - padR, base + 0.5); ctx.stroke();
    ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans; ctx.textAlign = "center";
    var stepL = Math.max(1, Math.ceil(span / Math.max(4, Math.floor(plotW / 44))));
    var nice = [1, 2, 5, 10, 20, 25, 50, 100]; for (i = 0; i < nice.length; i++) if (nice[i] >= stepL) { stepL = nice[i]; break; }
    for (v = Math.ceil(lo / stepL) * stepL; v <= hi; v += stepL) ctx.fillText(String(v), padL + (v - lo + 0.5) * bw, h - 8);
    ctx.textAlign = "left"; ctx.fillStyle = c.ink2; ctx.font = "13px " + c.sans;
    ctx.fillText("Sum of " + n + (n === 1 ? " effect" : " effects"), padL, padT + 4);
    // inset
    ctx.strokeStyle = c.rule; ctx.strokeRect(ix - 6, iy - 16, insetW + 6, insetH + 32);
    ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans; ctx.textAlign = "left";
    ctx.fillText(w > 480 ? "one effect: " + SHAPES[shapeKey].name : "one effect", ix, iy - 4);
    var m1 = 0; for (i = 0; i < one.length; i++) m1 = Math.max(m1, one[i]);
    var ibw = insetW / one.length;
    ctx.fillStyle = c.brass;
    for (i = 0; i < one.length; i++) {
      var ih = one[i] / m1 * (insetH - 10);
      ctx.fillRect(ix + i * ibw + 2, iy + insetH - ih, ibw - 4, ih);
    }
    ctx.fillStyle = c.ink3; ctx.textAlign = "center";
    for (i = 0; i < one.length; i++) ctx.fillText(String(i + SHAPES[shapeKey].off), ix + (i + 0.5) * ibw, iy + insetH + 12);
    if (w > 480) Galton.legend(ctx, c, [
      { kind: "bar", color: c.brassLit, label: "exact probability of each sum" },
      { kind: "line", color: c.verdigris, label: "normal curve, same mean and spread" }
    ], padL, padT + 26);
  }

  function update() {
    compute();
    out.mean.textContent = Orrery.fmt.number(mu, 2);
    out.sd.textContent = Orrery.fmt.number(sd, 2);
    out.skew.textContent = Orrery.fmt.number(skew, 3);
    out.gap.textContent = Orrery.fmt.percent(gap, 1);
    canvasEl.setAttribute("aria-label", "Histogram of the exact probabilities for the sum of " + n + " " +
      SHAPES[shapeKey].name + (n === 1 ? "" : "s") + ", with a normal curve of the same mean and spread. Skewness " +
      Orrery.fmt.number(skew, 2) + "; largest gap between the two cumulative curves " + Orrery.fmt.percent(gap, 1) + ".");
    view.redraw();
  }

  Array.prototype.forEach.call(buttons, function (b) {
    b.addEventListener("click", function () {
      shapeKey = b.getAttribute("data-shape");
      Array.prototype.forEach.call(buttons, function (o) { o.setAttribute("aria-pressed", String(o === b)); });
      update();
    });
  });
  Orrery.bindRange(document.getElementById("sum-n"), document.getElementById("sum-n-out"), {
    format: function (v) { return v + (v === 1 ? " effect" : " effects"); },
    onInput: function (v) { n = v; update(); }
  });
})();

/* ---- Figure 4: add or multiply, and heavy tails (sampled) --------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("fail-canvas");
  if (!canvasEl) return;
  var TRIALS = 20000;
  var mode = "mul", n = 20, s = 0.4, logX = false, seed = 7;
  var data = new Float64Array(TRIALS), sorted;
  var stats = {};
  var radios = document.querySelectorAll("input[name=fail-mode]");
  var logBox = document.getElementById("fail-log");
  var out = {
    mean: document.getElementById("fail-mean"), median: document.getElementById("fail-median"),
    skew: document.getElementById("fail-skew"), far: document.getElementById("fail-far")
  };

  function simulate() {
    var rand = Galton.rng(seed), i, j, x;
    for (i = 0; i < TRIALS; i++) {
      if (mode === "add") {
        x = 100; for (j = 0; j < n; j++) x += 100 * s * (2 * rand() - 1);
      } else if (mode === "mul") {
        x = 100; for (j = 0; j < n; j++) x *= 1 + s * (2 * rand() - 1);
      } else {
        // Cauchy effects with the same middle-50% spread as the uniform ones:
        // uniform on [-a, a] has quartiles at ±a/2; Cauchy(γ) has them at ±γ.
        x = 100; for (j = 0; j < n; j++) x += 100 * s * 0.5 * Math.tan(Math.PI * (rand() - 0.5));
      }
      data[i] = (mode === "mul" && logX) ? Math.log10(x) : x;
    }
    sorted = Float64Array.from(data).sort();
    var m = 0; for (i = 0; i < TRIALS; i++) m += data[i]; m /= TRIALS;
    var v = 0, m3 = 0; for (i = 0; i < TRIALS; i++) { var d = data[i] - m; v += d * d; m3 += d * d * d; }
    v /= TRIALS; m3 /= TRIALS;
    stats.mean = m; stats.sd = Math.sqrt(v); stats.skew = m3 / Math.pow(v, 1.5);
    stats.median = 0.5 * (sorted[TRIALS / 2 - 1] + sorted[TRIALS / 2]);
    // reference spread: what the adding version would have (sd of the sum of n uniforms)
    var addSd = 100 * s * Math.sqrt(n / 3);
    stats.ref = (mode === "cauchy") ? addSd : stats.sd;
    var far = 0, ctr = mode === "cauchy" ? 100 : m;
    for (i = 0; i < TRIALS; i++) if (Math.abs(data[i] - ctr) > 4 * stats.ref) far++;
    stats.far = far / TRIALS;
  }
  function q(f) { return sorted[Math.min(TRIALS - 1, Math.max(0, Math.floor(f * TRIALS)))]; }

  simulate();
  var view = Orrery.canvas(canvasEl, draw);

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var padL = 12, padR = 12, padT = 14, padB = 28;
    var lo, hi;
    if (mode === "cauchy") { lo = 100 - 5 * stats.ref; hi = 100 + 5 * stats.ref; }
    else if (mode === "mul" && !logX) { lo = 0; hi = q(0.995); }
    else { lo = q(0.0005); hi = q(0.9995); var padx = (hi - lo) * 0.08; lo -= padx; hi += padx; }
    var NB = Math.max(30, Math.min(90, Math.floor((w - padL - padR) / 7)));
    var counts = new Array(NB).fill(0), bwv = (hi - lo) / NB, offL = 0, offR = 0, i;
    for (i = 0; i < TRIALS; i++) {
      var b = Math.floor((data[i] - lo) / bwv);
      if (b < 0) offL++; else if (b >= NB) offR++; else counts[b]++;
    }
    var plotW = w - padL - padR, base = h - padB, top = padT + (w > 480 ? 66 : 40);
    var dens = counts.map(function (k) { return k / (TRIALS * bwv); });
    var mx = 0; for (i = 0; i < NB; i++) mx = Math.max(mx, dens[i]);
    var curveSd = stats.ref, curveMu = mode === "cauchy" ? 100 : stats.mean;
    mx = Math.max(mx, Galton.normalPdf(curveMu, curveMu, curveSd));
    var sc = (base - top) / mx, bpx = plotW / NB;
    ctx.fillStyle = c.brassLit;
    for (i = 0; i < NB; i++) { var hh = dens[i] * sc; ctx.fillRect(padL + i * bpx + 0.5, base - hh, Math.max(0.5, bpx - 1), hh); }
    // normal curve for comparison
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2; ctx.beginPath();
    for (var px = 0; px <= plotW; px += 2) {
      var xv = lo + px / plotW * (hi - lo), y = base - Galton.normalPdf(xv, curveMu, curveSd) * sc;
      if (px === 0) ctx.moveTo(padL + px, y); else ctx.lineTo(padL + px, y);
    }
    ctx.stroke();
    // mean and median markers
    function mark(xv, col, label, dy) {
      if (xv < lo || xv > hi) return;
      var X = padL + (xv - lo) / (hi - lo) * plotW;
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(X, top - 6); ctx.lineTo(X, base); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.font = "11px " + c.sans; ctx.textAlign = dy < 0 ? "right" : "left";
      ctx.fillText(label, X + (dy < 0 ? -4 : 4), top - 8);
    }
    if (mode !== "cauchy") { var medLeft = stats.median <= stats.mean; mark(stats.median, c.ink2, "median", medLeft ? -1 : 1); mark(stats.mean, c.alarm, "mean", medLeft ? 1 : -1); }
    // axis
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, base + 0.5); ctx.lineTo(w - padR, base + 0.5); ctx.stroke();
    ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans; ctx.textAlign = "center";
    var ticks = [], want = Math.max(3, Math.min(8, Math.floor(plotW / 80)));
    if (mode === "mul" && logX) {
      for (var e = Math.floor(lo) - 1; e <= Math.ceil(hi); e++) [1, 2, 5].forEach(function (m) {
        var tv = Math.log10(m) + e; if (tv >= lo && tv <= hi) ticks.push([tv, Math.pow(10, tv)]);
      });
      if (ticks.length > want + 2) ticks = ticks.filter(function (t) { return Math.abs(t[0] - Math.round(t[0])) < 1e-9; });
    } else {
      var raw = (hi - lo) / want, mag = Math.pow(10, Math.floor(Math.log10(raw))), st = mag;
      [1, 2, 5, 10].forEach(function (m) { if (m * mag <= raw * 1.5) st = m * mag; });
      for (var tv0 = Math.ceil(lo / st) * st; tv0 <= hi; tv0 += st) ticks.push([tv0, tv0]);
    }
    ctx.textAlign = "center";
    ticks.forEach(function (t) {
      var X = padL + (t[0] - lo) / (hi - lo) * plotW;
      if (X < padL + 8 || X > w - padR - 8) return;
      var tvv = Number(t[1].toPrecision(3)); ctx.fillText(Orrery.fmt.number(tvv, tvv < 10 && tvv !== Math.round(tvv) ? 1 : 0), X, h - 9);
      ctx.fillRect(X - 0.5, base, 1, 4);
    });
    ctx.textAlign = "left"; ctx.fillStyle = c.ink2; ctx.font = "13px " + c.sans;
    var title = mode === "add" ? "Final value when " + n + " effects add" :
      mode === "mul" ? "Final value when " + n + " effects multiply" + (logX ? " (log scale)" : "") :
      "Final value when " + n + " heavy-tailed effects add";
    ctx.fillText(title, padL, padT + 4);
    if (offL + offR > 0) {
      ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans; ctx.textAlign = w > 480 ? "right" : "left";
      ctx.fillText(Orrery.fmt.percent((offL + offR) / TRIALS, 1) + " of runs fall off the chart", w > 480 ? w - padR : padL, padT + (w > 480 ? 4 : 20));
    }
    if (w > 480) Galton.legend(ctx, c, [
      { kind: "bar", color: c.brassLit, label: "20,000 simulated runs" },
      { kind: "line", color: c.verdigris, label: mode === "cauchy" ? "bell for the same effects added without heavy tails" : "normal curve, same mean and spread" }
    ], padL, padT + 22);
  }

  function update() {
    simulate();
    var lg = mode === "mul" && logX;
    function f(v) { return lg ? Orrery.fmt.number(Math.pow(10, v), 1) : Orrery.fmt.number(v, 1); }
    var cau = mode === "cauchy";   // a Cauchy has no true mean or skewness: show the sample's value, labelled
    out.mean.textContent = lg ? "—" : cau ? "not defined (this sample: " + f(stats.mean) + ")" : f(stats.mean);
    out.median.textContent = f(stats.median);
    out.skew.textContent = cau ? "not defined (this sample: " + Orrery.fmt.number(stats.skew, 2) + ")" : Orrery.fmt.number(stats.skew, 2);
    out.far.textContent = Orrery.fmt.percent(stats.far, 2);
    logBox.disabled = mode !== "mul";
    canvasEl.setAttribute("aria-label", "Histogram of 20,000 simulated final values (" +
      (mode === "add" ? "effects added" : mode === "mul" ? "effects multiplied" : "heavy-tailed effects added") +
      ", " + n + " effects). Median " + f(stats.median) + ", skewness " + Orrery.fmt.number(stats.skew, 2) +
      ", " + Orrery.fmt.percent(stats.far, 2) + " of runs beyond four standard deviations.");
    view.redraw();
  }

  Array.prototype.forEach.call(radios, function (r) {
    r.addEventListener("change", function () { if (r.checked) { mode = r.value; update(); } });
  });
  logBox.addEventListener("change", function () { logX = logBox.checked; update(); });
  Orrery.bindRange(document.getElementById("fail-n"), document.getElementById("fail-n-out"), {
    format: function (v) { return v + (v === 1 ? " effect" : " effects"); },
    onInput: function (v) { n = v; update(); }
  });
  Orrery.bindRange(document.getElementById("fail-s"), document.getElementById("fail-s-out"), {
    format: function (v) { return "up to ±" + Orrery.fmt.percent(v, 0); },
    onInput: function (v) { s = v; update(); }
  });
  document.getElementById("fail-again").addEventListener("click", function () { seed++; update(); });
})();

/* ---- Figure 3: how fast the gap closes (exact, with the Berry–Esseen ceiling) */
(function () {
  "use strict";
  var canvasEl = document.getElementById("speed-canvas");
  if (!canvasEl) return;
  var NMAX = 200, C_BE = 0.4748;
  var SHAPES = [
    { key: "fair",  name: "Fair die",       p: [1, 1, 1, 1, 1, 1] },
    { key: "lop",   name: "Lopsided die",   p: [6, 2, 1, 1, 1, 1] },
    { key: "humps", name: "Two-humped die", p: [8, 1, 1, 1, 1, 8] },
    { key: "jack",  name: "1-in-10 coin",   p: [9, 1] }
  ];
  // For each shape: exact Kolmogorov distance sup_x |F_n(x) − Φ((x − nμ)/(σ√n))|
  // for n = 1..NMAX (checked on both sides of every jump), and ρ/σ³.
  SHAPES.forEach(function (s) {
    var tot = 0, i, j; for (i = 0; i < s.p.length; i++) tot += s.p[i];
    var one = s.p.map(function (v) { return v / tot; });
    var m = 0, v = 0, r = 0;
    for (i = 0; i < one.length; i++) m += one[i] * i;
    for (i = 0; i < one.length; i++) { var d = Math.abs(i - m); v += one[i] * d * d; r += one[i] * d * d * d; }
    s.ratio = r / Math.pow(v, 1.5);
    s.gap = [NaN];
    var cur = [1];
    for (var n = 1; n <= NMAX; n++) {
      var nxt = new Float64Array(cur.length + one.length - 1);
      for (i = 0; i < cur.length; i++) if (cur[i] > 1e-300) for (j = 0; j < one.length; j++) nxt[i + j] += cur[i] * one[j];
      cur = nxt;
      var mu = n * m, sd = Math.sqrt(n * v), F = 0, g = 0;
      for (i = 0; i < cur.length; i++) {
        var Phi = Galton.normalCdf((i - mu) / sd);
        g = Math.max(g, Math.abs(F - Phi));      // just below the jump at i
        F += cur[i];
        g = Math.max(g, Math.abs(F - Phi));      // at the jump
      }
      s.gap.push(g);
    }
  });
  var COLORS = ["ink", "brass", "verdigris", "alarm"];
  var nSel = 10;
  var outs = SHAPES.map(function (s) { return document.getElementById("speed-" + s.key); });
  var outBound = document.getElementById("speed-bound");
  var outN = document.getElementById("speed-n");
  var geom = null;

  var view = Orrery.canvas(canvasEl, draw);
  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var padL = 46, padR = 14, padT = 14, padB = 30;
    var X = function (n) { return padL + Math.log(n) / Math.log(NMAX) * (w - padL - padR); };
    var yLo = Math.log10(0.002), yHi = Math.log10(1);
    var Y = function (g) { return padT + (yHi - Math.log10(Math.max(g, 0.002))) / (yHi - yLo) * (h - padT - padB); };
    geom = { padL: padL, padR: padR, w: w };
    // grid
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans;
    [0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1].forEach(function (g) {
      ctx.beginPath(); ctx.moveTo(padL, Y(g)); ctx.lineTo(w - padR, Y(g)); ctx.stroke();
      if (h < 300 && [0.005, 0.02, 0.2, 0.5].indexOf(g) >= 0) return;
      ctx.textAlign = "right"; ctx.fillText(Orrery.fmt.percent(g, g < 0.01 ? 1 : 0), padL - 5, Y(g) + 4);
    });
    [1, 2, 5, 10, 20, 50, 100, 200].forEach(function (n) {
      ctx.beginPath(); ctx.moveTo(X(n), padT); ctx.lineTo(X(n), h - padB); ctx.stroke();
      ctx.textAlign = "center"; ctx.fillText(String(n), X(n), h - padB + 15);
    });
    ctx.textAlign = "right"; ctx.fillText("number of effects added, n (log scale)", w - padR, h - 2);
    // selected shape's Berry–Esseen ceiling
    var sel = SHAPES[currentShape()];
    ctx.strokeStyle = c[COLORS[currentShape()]]; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath();
    for (var n = 1; n <= NMAX; n++) {
      var b = C_BE * sel.ratio / Math.sqrt(n);
      if (n === 1) ctx.moveTo(X(n), Y(Math.min(1, b))); else ctx.lineTo(X(n), Y(Math.min(1, b)));
    }
    ctx.stroke(); ctx.setLineDash([]);
    // exact gaps
    SHAPES.forEach(function (s, k) {
      ctx.strokeStyle = c[COLORS[k]]; ctx.lineWidth = k === currentShape() ? 2.5 : 1.3; ctx.beginPath();
      for (var n2 = 1; n2 <= NMAX; n2++) { if (n2 === 1) ctx.moveTo(X(n2), Y(s.gap[n2])); else ctx.lineTo(X(n2), Y(s.gap[n2])); }
      ctx.stroke();
    });
    // cursor
    ctx.strokeStyle = c.ink2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(nSel), padT); ctx.lineTo(X(nSel), h - padB); ctx.stroke();
    SHAPES.forEach(function (s, k) {
      ctx.fillStyle = c[COLORS[k]]; ctx.beginPath(); ctx.arc(X(nSel), Y(s.gap[nSel]), 4, 0, Orrery.TAU); ctx.fill();
    });
    ctx.fillStyle = c.ink2; ctx.textAlign = X(nSel) > w * 0.7 ? "right" : "left";
    ctx.fillText("n = " + nSel, X(nSel) + (X(nSel) > w * 0.7 ? -6 : 6), padT + 12);
    if (w > 480) Galton.legend(ctx, c, SHAPES.map(function (s, k) {
      return { kind: "line", color: c[COLORS[k]], label: s.name };
    }).concat([{ kind: "line", color: c[COLORS[currentShape()]], dash: [5, 4], label: "Berry–Esseen ceiling (selected)" }]), w - padR - 200, padT + 30);
  }
  function currentShape() {
    var sel = document.querySelector("input[name=speed-shape]:checked");
    for (var k = 0; k < SHAPES.length; k++) if (sel && SHAPES[k].key === sel.value) return k;
    return 1;
  }
  function update() {
    nSel = Orrery.clamp(Math.round(nSel), 1, NMAX);
    outN.textContent = String(nSel);
    SHAPES.forEach(function (s, k) { outs[k].textContent = Orrery.fmt.percent(s.gap[nSel], 1); });
    var sel = SHAPES[currentShape()];
    outBound.textContent = Orrery.fmt.percent(Math.min(1, C_BE * sel.ratio / Math.sqrt(nSel)), 1);
    canvasEl.setAttribute("aria-valuenow", nSel);
    canvasEl.setAttribute("aria-valuetext", "n = " + nSel + ". Largest gaps: " + SHAPES.map(function (s) {
      return s.name + " " + Orrery.fmt.percent(s.gap[nSel], 1); }).join(", ") + ".");
    view.redraw();
  }
  function fromX(x) {
    if (!geom) return;
    var t = (x - geom.padL) / (geom.w - geom.padL - geom.padR);
    nSel = Math.exp(Orrery.clamp(t, 0, 1) * Math.log(NMAX)); update();
  }
  Orrery.drag(canvasEl, {
    onStart: function (p) { fromX(p.x); },
    onMove: function (p) { fromX(p.x); },
    onNudge: function (dx, dy) { nSel += (dx || -dy); update(); }
  });
  Array.prototype.forEach.call(document.querySelectorAll("input[name=speed-shape]"), function (r) {
    r.addEventListener("change", update);
  });
  update();
})();
