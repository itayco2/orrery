/* Exhibit script: "How does a machine learn from examples?"
   One IIFE per figure; model maths in nn.js (global NN). */

/* ---- Shared helpers -------------------------------------------------------- */
var NNView = (function () {
  "use strict";
  var probe = document.createElement("canvas").getContext("2d");
  // Any CSS colour → [r, g, b]
  function rgb(css) {
    probe.fillStyle = "#000"; probe.fillStyle = css;
    var s = probe.fillStyle;
    if (s.charAt(0) === "#") return [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16)];
    var m = s.match(/[\d.]+/g) || [0, 0, 0];
    return [+m[0], +m[1], +m[2]];
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  // Paint p(x, y) ∈ [0, 1] over the square [−1, 1]² as a soft two-colour map.
  var off = document.createElement("canvas"), N = 64;
  off.width = off.height = N;
  var offCtx = off.getContext("2d"), img = offCtx.createImageData(N, N);
  function heat(ctx, box, probFn, c) {
    var paper = rgb(c.paper), c0 = rgb(c.brassLit), c1 = rgb(c.verdigrisLit), d = img.data;
    for (var j = 0; j < N; j++) {
      var y = 1 - 2 * (j + 0.5) / N;
      for (var i = 0; i < N; i++) {
        var x = -1 + 2 * (i + 0.5) / N, p = probFn(x, y);
        var col = p >= 0.5 ? mix(paper, c1, 0.15 + 0.6 * (p - 0.5) * 2) : mix(paper, c0, 0.15 + 0.6 * (0.5 - p) * 2);
        var k = 4 * (j * N + i);
        d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
      }
    }
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, box.x, box.y, box.s, box.s);
  }
  // Square plotting box centred in a canvas of w × h
  function box(w, h, pad) {
    var s = Math.min(w, h) - 2 * pad;
    return { x: (w - s) / 2, y: (h - s) / 2, s: s,
             px: function (x) { return (w - s) / 2 + (x + 1) / 2 * s; },
             py: function (y) { return (h - s) / 2 + (1 - y) / 2 * s; } };
  }
  function points(ctx, b, pts, c, wrongFn) {
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], X = b.px(p.x), Y = b.py(p.y), r = Math.max(3.5, b.s / 70);
      ctx.beginPath();
      if (p.label) ctx.arc(X, Y, r, 0, Orrery.TAU);
      else ctx.rect(X - r * 0.9, Y - r * 0.9, r * 1.8, r * 1.8);   // squares vs circles, not colour alone
      ctx.fillStyle = p.label ? c.verdigris : c.brass; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = c.paper; ctx.stroke();
      if (wrongFn && wrongFn(p)) {
        ctx.beginPath(); ctx.arc(X, Y, r + 3.5, 0, Orrery.TAU);
        ctx.strokeStyle = c.alarm; ctx.lineWidth = 2; ctx.stroke();
      }
    }
  }
  function frame(ctx, b, c) {
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.s - 1, b.s - 1);
  }
  return { rgb: rgb, heat: heat, box: box, points: points, frame: frame };
})();

/* ---- Figure 1: one neuron is a line --------------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("neuron-canvas");
  if (!canvasEl) return;
  var pts = NN.dataset("blobs", 30, 11);
  var w1 = 1.5, w2 = -0.5, b = 0.4;
  var lastBox = null, handles = [], grab = null;   // for dragging the line
  var outWrong = document.getElementById("neuron-wrong"),
      outLoss = document.getElementById("neuron-loss"),
      outEq = document.getElementById("neuron-eq");

  var view = Orrery.canvas(canvasEl, function (ctx, w, h) {
    var c = Orrery.tokens(), bx = NNView.box(w, h, 8);
    NNView.heat(ctx, bx, function (x, y) { return NN.sigmoid(w1 * x + w2 * y + b); }, c);
    NNView.frame(ctx, bx, c);
    // the line w1 x + w2 y + b = 0, clipped to the box
    ctx.save(); ctx.beginPath(); ctx.rect(bx.x, bx.y, bx.s, bx.s); ctx.clip();
    ctx.beginPath();
    if (Math.abs(w2) > Math.abs(w1)) {
      ctx.moveTo(bx.px(-1.2), bx.py(-(w1 * -1.2 + b) / w2));
      ctx.lineTo(bx.px(1.2), bx.py(-(w1 * 1.2 + b) / w2));
    } else if (Math.abs(w1) > 1e-9) {
      ctx.moveTo(bx.px(-(w2 * -1.2 + b) / w1), bx.py(-1.2));
      ctx.lineTo(bx.px(-(w2 * 1.2 + b) / w1), bx.py(1.2));
    }
    ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    NNView.points(ctx, bx, pts, c, function (p) { return ((w1 * p.x + w2 * p.y + b) > 0 ? 1 : 0) !== p.label; });
    lastBox = bx;
    // while turning, keep the handles under the pivot and the pointer
    handles = grab && grab.cur ? (grab.handle ? [grab.pivot, grab.cur] : [grab.cur, grab.pivot]) : lineHandles();
    for (var k = 0; k < handles.length; k++) {
      ctx.beginPath(); ctx.arc(bx.px(handles[k].x), bx.py(handles[k].y), 7, 0, Orrery.TAU);
      ctx.fillStyle = c.paper; ctx.fill(); ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.stroke();
    }
  });

  /* Direct manipulation: drag a handle to turn the line about the other handle,
     or drag the line itself to slide it. The sliders are the keyboard route. */
  function lineHandles() {               // two points on the line, if it crosses the square
    var n2 = w1 * w1 + w2 * w2;
    if (n2 < 1e-6) return [];
    var n = Math.sqrt(n2), fx = -b * w1 / n2, fy = -b * w2 / n2, dx = -w2 / n, dy = w1 / n;
    var out = [];
    [-0.55, 0.55].forEach(function (t) {
      var x = fx + t * dx, y = fy + t * dy;
      if (Math.abs(x) <= 0.95 && Math.abs(y) <= 0.95) out.push({ x: x, y: y });
    });
    return out.length === 2 ? out : [];
  }
  function toModel(p) {
    var bx = lastBox;
    return { x: (p.x - bx.x) / bx.s * 2 - 1, y: 1 - (p.y - bx.y) / bx.s * 2 };
  }
  function distPx(a, p) { return Math.hypot(lastBox.px(a.x) - p.x, lastBox.py(a.y) - p.y); }
  function nearLine(p) {
    var n = Math.hypot(w1, w2); if (n < 1e-6) return false;
    var m = toModel(p);
    return Math.abs(w1 * m.x + w2 * m.y + b) / n * lastBox.s / 2 < 18;
  }
  function hit(p) {
    if (!lastBox) return null;
    for (var k = 0; k < handles.length; k++) if (distPx(handles[k], p) < 20) return { handle: k };
    return nearLine(p) ? { slide: true } : null;
  }
  function syncSliders() { s1.set(w1, false); s2.set(w2, false); s3.set(b, false); update(); }
  Orrery.drag(canvasEl.parentNode, {
    hitTest: function (p) { return hit(p) !== null; },
    onStart: function (p) { grab = hit(p); if (!grab) return false;
      if (grab.handle !== undefined) grab.pivot = handles[1 - grab.handle]; },
    onMove: function (p) {
      var m = toModel(p);
      m.x = Orrery.clamp(m.x, -1, 1); m.y = Orrery.clamp(m.y, -1, 1);
      if (grab.slide) {                   // keep the tilt, move the line under the pointer
        b = -(w1 * m.x + w2 * m.y);
      } else {                            // the line through the pivot and the pointer
        var q = grab.pivot, ex = m.x - q.x, ey = m.y - q.y, len = Math.hypot(ex, ey);
        if (len < 0.05) return;
        grab.cur = { x: m.x, y: m.y };
        var mag = Math.hypot(w1, w2), nx = -ey / len, ny = ex / len;
        if (nx * w1 + ny * w2 < 0) { nx = -nx; ny = -ny; }   // keep which side is "circle"
        w1 = mag * nx; w2 = mag * ny; b = -(w1 * q.x + w2 * q.y);
      }
      w1 = Orrery.clamp(w1, -6, 6); w2 = Orrery.clamp(w2, -6, 6); b = Orrery.clamp(b, -3, 3);
      syncSliders();
    },
    onEnd: function () { grab = null; view.redraw(); }
  });

  function update() {
    var s = NN.neuronStats(pts, w1, w2, b);
    outWrong.textContent = s.wrong + " of " + pts.length;
    outLoss.textContent = Orrery.fmt.number(s.loss, 3);
    outEq.textContent = Orrery.fmt.number(w1, 1) + "·x₁ " + (w2 < 0 ? "− " : "+ ") + Orrery.fmt.number(Math.abs(w2), 1) +
      "·x₂ " + (b < 0 ? "− " : "+ ") + Orrery.fmt.number(Math.abs(b), 1) + " = 0";
    view.redraw();
  }
  var f1 = function (v) { return Orrery.fmt.number(v, 1); };
  var s1 = Orrery.bindRange(document.getElementById("neuron-w1"), document.getElementById("neuron-w1-out"),
    { format: f1, onInput: function (v) { w1 = v; update(); } });
  var s2 = Orrery.bindRange(document.getElementById("neuron-w2"), document.getElementById("neuron-w2-out"),
    { format: f1, onInput: function (v) { w2 = v; update(); } });
  var s3 = Orrery.bindRange(document.getElementById("neuron-b"), document.getElementById("neuron-b-out"),
    { format: f1, onInput: function (v) { b = v; update(); } });
  document.getElementById("neuron-reset").addEventListener("click", function () {
    s1.set(1.5); s2.set(-0.5); s3.set(0.4); w1 = 1.5; w2 = -0.5; b = 0.4; update();
  });
  update();
})();

/* ---- Figure 2: downhill on L(w) = (w − 3)² --------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("down-canvas");
  if (!canvasEl) return;
  var W0 = -1, TARGET = 3, LIM = 1e6;
  var w = W0, rate = 0.1, steps = 0, trail = [W0], acc = 0;
  var outW = document.getElementById("down-w"), outL = document.getElementById("down-loss"),
      outS = document.getElementById("down-slope"), outN = document.getElementById("down-steps"),
      outState = document.getElementById("down-state");
  function L(v) { return (v - TARGET) * (v - TARGET); }
  function slope(v) { return 2 * (v - TARGET); }

  var view = Orrery.canvas(canvasEl, function (ctx, cw, ch) {
    var c = Orrery.tokens(), padL = 40, padR = 12, padT = 12, padB = 30;
    var xmin = -3, xmax = 9, ymax = 40;
    function X(v) { return padL + (v - xmin) / (xmax - xmin) * (cw - padL - padR); }
    function Y(l) { return padT + (1 - l / ymax) * (ch - padT - padB); }
    ctx.font = "12px " + c.sans; ctx.fillStyle = c.ink3; ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    // axes and ticks
    ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(cw - padR, Y(0)); ctx.moveTo(padL, padT); ctx.lineTo(padL, Y(0)); ctx.stroke();
    ctx.textAlign = "center";
    for (var t = -2; t <= 8; t += 2) ctx.fillText(String(t).replace("-", "−"), X(t), Y(0) + 16);
    ctx.fillText("weight w", (padL + cw - padR) / 2, ch - 2);
    ctx.textAlign = "right";
    for (var l = 0; l <= 40; l += 10) ctx.fillText(String(l), padL - 6, Y(l) + 4);
    // the loss curve
    ctx.beginPath();
    for (var i = 0; i <= 200; i++) {
      var v = xmin + (xmax - xmin) * i / 200, yy = Y(Math.min(L(v), ymax * 1.2));
      if (i) ctx.lineTo(X(v), yy); else ctx.moveTo(X(v), yy);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, cw - padL - padR, ch - padT - padB); ctx.clip();
    ctx.beginPath();
    for (i = 0; i <= 200; i++) {
      v = xmin + (xmax - xmin) * i / 200;
      if (i) ctx.lineTo(X(v), Y(L(v))); else ctx.moveTo(X(v), Y(L(v)));
    }
    ctx.strokeStyle = c.ink2 || c.ink; ctx.lineWidth = 2; ctx.stroke();
    // trail of steps
    ctx.beginPath();
    for (i = 0; i < trail.length; i++) {
      var tx = X(Math.max(xmin - 1, Math.min(xmax + 1, trail[i]))), ty = Y(Math.min(L(trail[i]), ymax * 2));
      if (i) ctx.lineTo(tx, ty); else ctx.moveTo(tx, ty);
    }
    ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
    for (i = 0; i < trail.length - 1; i++) {
      ctx.beginPath(); ctx.arc(X(trail[i]), Y(L(trail[i])), 2.5, 0, Orrery.TAU); ctx.fillStyle = c.brass; ctx.fill();
    }
    // tangent at the current point: the slope the step follows
    if (Math.abs(w) < 50) {
      var s = slope(w), dx = 1.2;
      ctx.beginPath(); ctx.moveTo(X(w - dx), Y(L(w) - s * dx)); ctx.lineTo(X(w + dx), Y(L(w) + s * dx));
      ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(X(w), Y(L(w)), 7, 0, Orrery.TAU); ctx.fillStyle = c.brassLit; ctx.fill();
      ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
    if (L(w) > ymax || Math.abs(w) >= 50) {
      ctx.fillStyle = c.alarm; ctx.textAlign = "center"; ctx.font = "600 13px " + c.sans;
      ctx.fillText(w > TARGET ? "off the chart →" : "← off the chart", (padL + cw - padR) / 2, padT + 14);
    }
  });

  function readouts() {
    var big = Math.abs(w) > 1e4;
    outW.textContent = big ? Orrery.fmt.sci(w, 1) : Orrery.fmt.number(w, 3);
    outL.textContent = big ? Orrery.fmt.sci(L(w), 1) : Orrery.fmt.number(L(w), 3);
    outS.textContent = big ? Orrery.fmt.sci(slope(w), 1) : Orrery.fmt.number(slope(w), 3);
    outN.textContent = String(steps);
    var f = 1 - 2 * rate, msg;
    if (Math.abs(w) >= LIM) msg = "Diverged: each step lands further away.";
    else if (L(w) < 1e-6) msg = "Converged: at the bottom (w = 3).";
    else if (f > 0) msg = "Creeping downhill from one side.";
    else if (f > -1) msg = "Overshooting, but each swing is smaller.";
    else if (f === -1) msg = "Bouncing between two points forever.";
    else msg = "Overshooting more each time: diverging.";
    outState.textContent = msg;
  }
  function step() {
    if (Math.abs(w) >= LIM) return;
    w = w - rate * slope(w);
    steps++; trail.push(w); if (trail.length > 60) trail.shift();
    readouts(); view.redraw();
  }
  function reset() { w = W0; steps = 0; trail = [W0]; acc = 0; readouts(); view.redraw(); }

  var rateEl = document.getElementById("down-rate");
  // slider positions pick from a list, so the special values 0.5 and 1 are exact
  var RATES = [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1, 1.05, 1.1];
  function toRate(u) { return RATES[u]; }
  Orrery.bindRange(rateEl, document.getElementById("down-rate-out"), {
    format: function (u) { return Orrery.fmt.number(toRate(u), 2); },
    onInput: function (u) { rate = toRate(u); readouts(); } });
  document.getElementById("down-step").addEventListener("click", step);
  document.getElementById("down-reset").addEventListener("click", reset);
  var loop = Orrery.loop(document.getElementById("fig-down"), function (dt) {
    acc += dt;
    if (acc >= 0.35) { acc = 0; step(); }
  }, { button: document.getElementById("down-play"), autoplay: false, labels: { play: "Play", pause: "Pause" } });
  // a few steps already taken, so the default view shows the walk
  for (var k = 0; k < 6; k++) step();
  readouts();
})();

/* ---- Figure 3: a tiny network learns --------------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("net-canvas");
  if (!canvasEl) return;
  var lossEl = document.getElementById("net-loss-canvas");
  var N_PTS = 120, EPOCHS_PER_FRAME = 6, MAX_HIST = 400;
  var dataName = "xor", H = 4, seed = 1, rate = 0.5;
  var pts = NN.dataset(dataName, N_PTS, 7), net = NN.makeNet(H, seed), epoch = 0, hist = [],
      last = NN.netLossGrad(net, pts);
  var outEpoch = document.getElementById("net-epoch"), outLoss = document.getElementById("net-loss"),
      outWrong = document.getElementById("net-wrong"), outSeed = document.getElementById("net-seed"),
      outParams = document.getElementById("net-params");

  function reset() {
    pts = NN.dataset(dataName, N_PTS, 7);
    net = NN.makeNet(H, seed);
    epoch = 0; hist = [];
    last = NN.netLossGrad(net, pts); hist.push(last.loss);
    show();
  }
  var histEvery = 1;                    // record the loss every histEvery steps (doubles as it fills)
  function train(n) {
    for (var i = 0; i < n; i++) {
      NN.netStep(net, last.grad, rate);
      epoch++;
      last = NN.netLossGrad(net, pts);
      if (!isFinite(last.loss)) break;
      if (epoch % histEvery === 0) hist.push(last.loss);
    }
    if (hist.length > MAX_HIST) {        // halve the resolution when full
      var h2 = []; for (var k = 0; k < hist.length; k += 2) h2.push(hist[k]);
      hist = h2; histEvery *= 2;
    }
  }

  var view = Orrery.canvas(canvasEl, function (ctx, w, h) {
    var c = Orrery.tokens(), bx = NNView.box(w, h, 8);
    NNView.heat(ctx, bx, function (x, y) { return NN.sigmoid(NN.netZ(net, x, y)); }, c);
    NNView.frame(ctx, bx, c);
    NNView.points(ctx, bx, pts, c, function (p) { return ((NN.netZ(net, p.x, p.y) > 0) ? 1 : 0) !== p.label; });
  });
  var lossView = Orrery.canvas(lossEl, function (ctx, w, h) {
    var c = Orrery.tokens(), padL = 40, padR = 10, padT = 10, padB = 22, ymax = 1;
    for (var i = 0; i < hist.length; i++) ymax = Math.max(ymax, Math.min(hist[i], 3));
    function X(i) { return padL + i / Math.max(1, hist.length - 1) * (w - padL - padR); }
    function Y(l) { return padT + (1 - Math.min(l, ymax) / ymax) * (h - padT - padB); }
    ctx.font = "12px " + c.sans; ctx.fillStyle = c.ink3; ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(Orrery.fmt.number(ymax, 1), padL - 5, padT + 9); ctx.fillText("0", padL - 5, Y(0) + 4);
    // ln 2: the loss of a network that always says "50–50"
    ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(padL, Y(Math.LN2)); ctx.lineTo(w - padR, Y(Math.LN2)); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = "left"; ctx.fillText("coin-flip guess (0.69)", padL + 4, Y(Math.LN2) - 4);
    ctx.textAlign = "center"; ctx.fillText("training steps →", (padL + w - padR) / 2, h - 5);
    ctx.beginPath();
    for (i = 0; i < hist.length; i++) { if (i) ctx.lineTo(X(i), Y(hist[i])); else ctx.moveTo(X(i), Y(hist[i])); }
    ctx.strokeStyle = c.brass; ctx.lineWidth = 2; ctx.stroke();
  });

  function show() {
    outEpoch.textContent = Orrery.fmt.number(epoch, 0);
    outLoss.textContent = isFinite(last.loss) ? Orrery.fmt.number(last.loss, 3) : "—";
    outWrong.textContent = last.wrong + " of " + pts.length;
    outSeed.textContent = String(seed);
    outParams.textContent = String(4 * H + 1);
    view.redraw(); lossView.redraw();
  }

  var loop = Orrery.loop(document.getElementById("fig-net"), function () {
    train(EPOCHS_PER_FRAME); show();
  }, { button: document.getElementById("net-play"), autoplay: true, labels: { play: "Train", pause: "Pause" } });

  document.getElementById("net-step").addEventListener("click", function () { train(100); show(); });
  document.getElementById("net-reset").addEventListener("click", function () { histEvery = 1; reset(); });
  document.getElementById("net-new").addEventListener("click", function () { seed++; histEvery = 1; reset(); });
  Orrery.bindRange(document.getElementById("net-hidden"), document.getElementById("net-hidden-out"), {
    format: function (v) { return v + (v === 1 ? " unit" : " units"); },
    onInput: function (v) { if (v !== H || !net) { H = v; histEvery = 1; reset(); } }, init: false });
  var RATES = [0.01, 0.03, 0.1, 0.3, 0.5, 1, 2, 4, 8, 16];
  function toRate(u) { return RATES[u]; }
  Orrery.bindRange(document.getElementById("net-rate"), document.getElementById("net-rate-out"), {
    format: function (u) { return Orrery.fmt.number(toRate(u), 2); },
    onInput: function (u) { rate = toRate(u); } });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="net-data"]'), function (r) {
    r.addEventListener("change", function () { if (r.checked) { dataName = r.value; histEvery = 1; reset(); } });
  });
  reset();
})();

/* ---- Figure 4: memorising versus learning ---------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("fit-canvas");
  if (!canvasEl) return;
  var chartEl = document.getElementById("fit-chart");
  var N_TRAIN = 30, N_FRESH = 400, FLIP = 0.1, RATE = 1, MAX_STEPS = 40000, MAX_HIST = 400;
  var SIZES = [2, 4, 8, 16, 32];
  // labels flipped at random for 10% of points: noise, like mislabelled data
  function noisy(n, seed) {
    var r = NN.rng(seed + 999);
    return NN.dataset("circle", n, seed).map(function (p) {
      return { x: p.x, y: p.y, label: r() < FLIP ? 1 - p.label : p.label };
    });
  }
  var train = noisy(N_TRAIN, 21), fresh = noisy(N_FRESH, 22);
  var H = 16, net = NN.makeNet(H, 1), steps = 0, hist = [], best = null, showFresh = false;
  var outSteps = document.getElementById("fit-steps"), outTrain = document.getElementById("fit-train"),
      outFresh = document.getElementById("fit-fresh"), outBest = document.getElementById("fit-best");

  function wrong(pts) {
    var w = 0;
    for (var i = 0; i < pts.length; i++) if ((NN.netZ(net, pts[i].x, pts[i].y) > 0 ? 1 : 0) !== pts[i].label) w++;
    return w;
  }
  function record() {
    var a = wrong(train) / N_TRAIN, b = wrong(fresh) / N_FRESH;
    hist.push([a, b, steps]);
    if (!best || b < best.err) best = { err: b, step: steps };
    if (hist.length > MAX_HIST) { var h2 = []; for (var k = 0; k < hist.length; k += 2) h2.push(hist[k]); hist = h2; }
  }
  function reset() {
    net = NN.makeNet(H, 1); steps = 0; hist = []; best = null; record(); show();
  }
  record();
  function trainSome(n) {
    for (var i = 0; i < n; i++) { NN.netStep(net, NN.netLossGrad(net, train).grad, RATE); steps++; }
    record();
  }

  var view = Orrery.canvas(canvasEl, function (ctx, w, h) {
    var c = Orrery.tokens(), bx = NNView.box(w, h, 8);
    NNView.heat(ctx, bx, function (x, y) { return NN.sigmoid(NN.netZ(net, x, y)); }, c);
    NNView.frame(ctx, bx, c);
    if (showFresh) {
      ctx.globalAlpha = 0.55;
      for (var i = 0; i < fresh.length; i++) {
        var p = fresh[i];
        ctx.beginPath(); ctx.arc(bx.px(p.x), bx.py(p.y), 2.2, 0, Orrery.TAU);
        ctx.fillStyle = p.label ? c.verdigris : c.brass; ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    NNView.points(ctx, bx, train, c, function (p) { return ((NN.netZ(net, p.x, p.y) > 0) ? 1 : 0) !== p.label; });
  });
  var chart = Orrery.canvas(chartEl, function (ctx, w, h) {
    var c = Orrery.tokens(), padL = 40, padR = 14, padT = 10, padB = 36, ymax = 0.6;
    // steps on a logarithmic axis, so the first few hundred steps aren't squeezed into a corner
    var LMAX = Math.log(1 + MAX_STEPS);
    function X(i) { return padL + Math.log(1 + hist[i][2]) / LMAX * (w - padL - padR); }
    function Xs(st) { return padL + Math.log(1 + st) / LMAX * (w - padL - padR); }
    function Y(v) { return padT + (1 - Math.min(v, ymax) / ymax) * (h - padT - padB); }
    ctx.font = "12px " + c.sans; ctx.fillStyle = c.ink3; ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke();
    ctx.textAlign = "right";
    [0, 0.2, 0.4, 0.6].forEach(function (v) { ctx.fillText(Math.round(v * 100) + "%", padL - 5, Y(v) + 4); });
    ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(padL, Y(FLIP)); ctx.lineTo(w - padR, Y(FLIP)); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = "right"; ctx.fillText("noise floor (10%)", w - padR, Y(FLIP) + 13);
    ctx.textAlign = "center";
    [1, 10, 100, 1000, 10000].forEach(function (st) {
      ctx.fillText(Orrery.fmt.number(st, 0), Xs(st), Y(0) + 14);
      ctx.beginPath(); ctx.moveTo(Xs(st), Y(0)); ctx.lineTo(Xs(st), Y(0) + 3); ctx.stroke();
    });
    ctx.fillText("training steps (each mark is 10× the last) →", (padL + w - padR) / 2, h - 4);
    [[0, c.brass], [1, c.verdigris]].forEach(function (s) {
      ctx.beginPath();
      for (var i = 0; i < hist.length; i++) { var y = Y(hist[i][s[0]]); if (i) ctx.lineTo(X(i), y); else ctx.moveTo(X(i), y); }
      ctx.strokeStyle = s[1]; ctx.lineWidth = 2; ctx.setLineDash(s[0] ? [] : [6, 3]); ctx.stroke(); ctx.setLineDash([]);
    });
  });

  function show() {
    var last = hist[hist.length - 1];
    outSteps.textContent = Orrery.fmt.number(steps, 0);
    outTrain.textContent = Math.round(last[0] * N_TRAIN) + " of " + N_TRAIN + " (" + Orrery.fmt.percent(last[0], 0) + ")";
    outFresh.textContent = Orrery.fmt.percent(last[1], 0);
    outBest.textContent = Orrery.fmt.percent(best.err, 0) + " at step " + Orrery.fmt.number(best.step, 0);
    view.redraw(); chart.redraw();
  }

  Orrery.loop(document.getElementById("fig-fit"), function () {
    // start slowly, then speed up, so the early part is watchable
    if (steps < MAX_STEPS) { trainSome(Math.min(40, Math.max(1, Math.floor(steps / 100)), MAX_STEPS - steps)); show(); }
  }, { button: document.getElementById("fit-play"), autoplay: true, labels: { play: "Train", pause: "Pause" } });
  document.getElementById("fit-reset").addEventListener("click", reset);
  document.getElementById("fit-fresh-toggle").addEventListener("change", function (e) { showFresh = e.target.checked; view.redraw(); });
  Orrery.bindRange(document.getElementById("fit-hidden"), document.getElementById("fit-hidden-out"), {
    format: function (u) { return SIZES[u] + " units"; },
    onInput: function (u) { if (SIZES[u] !== H) { H = SIZES[u]; reset(); } }, init: false });
  show();
})();
