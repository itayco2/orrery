/* Model maths for "How does a machine learn from examples?"
   Plain functions on a global NN, so the page and a Node gradient check
   run exactly the same code. */
(function (root) {
  "use strict";

  // Small seeded random generator (mulberry32): the same seed gives the same numbers.
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
  function gauss(r) {               // Box–Muller, standard normal
    var u = 1 - r(), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function sigmoid(z) {
    if (z >= 0) return 1 / (1 + Math.exp(-z));
    var e = Math.exp(z); return e / (1 + e);
  }
  // Cross-entropy for one example: −[y ln p + (1−y) ln(1−p)], written in z for stability.
  function xent(z, y) {
    // ln(1+e^z) − y z, computed without overflow
    var sp = z > 0 ? z + Math.log1p(Math.exp(-z)) : Math.log1p(Math.exp(z));
    return sp - y * z;
  }

  /* ---- Datasets: points in [−1, 1]², labels 0 or 1 ---------------------- */
  function clip(v) { return Math.max(-0.98, Math.min(0.98, v)); }
  function dataset(name, n, seed) {
    var r = rng(seed), pts = [], i;
    for (i = 0; i < n; i++) {
      var x, y, lab;
      if (name === "blobs") {
        lab = i % 2;
        var c = lab ? 0.32 : -0.32;
        x = c + 0.27 * gauss(r); y = c + 0.27 * gauss(r);
      } else if (name === "xor") {
        var q = i % 4, sx = q & 1 ? 1 : -1, sy = q & 2 ? 1 : -1;
        x = sx * 0.5 + 0.17 * gauss(r); y = sy * 0.5 + 0.17 * gauss(r);
        lab = sx * sy > 0 ? 1 : 0;
      } else if (name === "circle") {
        lab = i % 2;
        var ang = 2 * Math.PI * r();
        var rad = lab ? 0.42 * Math.sqrt(r()) : 0.62 + 0.32 * r();
        x = rad * Math.cos(ang); y = rad * Math.sin(ang);
      } else {                        // two moons
        lab = i % 2;
        var t = Math.PI * r(), mx, my;
        if (lab) { mx = Math.cos(t); my = Math.sin(t); }
        else { mx = 1 - Math.cos(t); my = 0.5 - Math.sin(t); }
        x = (mx - 0.5) / 1.6 + 0.06 * gauss(r);
        y = (my - 0.25) / 1.6 + 0.06 * gauss(r);
      }
      pts.push({ x: clip(x), y: clip(y), label: lab });
    }
    return pts;
  }

  /* ---- One neuron ------------------------------------------------------- */
  function neuronStats(pts, w1, w2, b) {
    var loss = 0, wrong = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], z = w1 * p.x + w2 * p.y + b;
      loss += xent(z, p.label);
      if ((z > 0 ? 1 : 0) !== p.label) wrong++;
    }
    return { loss: loss / pts.length, wrong: wrong };
  }

  /* ---- A network with one hidden layer: 2 → H (tanh) → 1 (sigmoid) -------
     Parameters: W1[j] = [w_j1, w_j2], b1[j], W2[j], b2.                     */
  function makeNet(H, seed) {
    var r = rng(seed), net = { H: H, W1: [], b1: [], W2: [], b2: 0 };
    for (var j = 0; j < H; j++) {
      net.W1.push([2 * (2 * r() - 1), 2 * (2 * r() - 1)]);
      net.b1.push(0.5 * (2 * r() - 1));
      net.W2.push(2 * r() - 1);
    }
    return net;
  }
  function netZ(net, x, y, h) {      // output pre-activation; fills h[] if given
    var z = net.b2;
    for (var j = 0; j < net.H; j++) {
      var a = Math.tanh(net.W1[j][0] * x + net.W1[j][1] * y + net.b1[j]);
      if (h) h[j] = a;
      z += net.W2[j] * a;
    }
    return z;
  }
  // Average cross-entropy and its gradient over all points, by backpropagation.
  function netLossGrad(net, pts) {
    var H = net.H, g = { W1: [], b1: [], W2: [], b2: 0 }, h = new Array(H), loss = 0, wrong = 0, j;
    for (j = 0; j < H; j++) { g.W1.push([0, 0]); g.b1.push(0); g.W2.push(0); }
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], z = netZ(net, p.x, p.y, h);
      loss += xent(z, p.label);
      if ((z > 0 ? 1 : 0) !== p.label) wrong++;
      var dz = sigmoid(z) - p.label;           // ∂loss/∂z for sigmoid + cross-entropy
      g.b2 += dz;
      for (j = 0; j < H; j++) {
        g.W2[j] += dz * h[j];
        var da = dz * net.W2[j] * (1 - h[j] * h[j]);   // back through tanh
        g.W1[j][0] += da * p.x; g.W1[j][1] += da * p.y; g.b1[j] += da;
      }
    }
    var n = pts.length;
    g.b2 /= n;
    for (j = 0; j < H; j++) { g.W2[j] /= n; g.W1[j][0] /= n; g.W1[j][1] /= n; g.b1[j] /= n; }
    return { loss: loss / n, wrong: wrong, grad: g };
  }
  function netStep(net, g, rate) {
    net.b2 -= rate * g.b2;
    for (var j = 0; j < net.H; j++) {
      net.W2[j] -= rate * g.W2[j];
      net.W1[j][0] -= rate * g.W1[j][0]; net.W1[j][1] -= rate * g.W1[j][1];
      net.b1[j] -= rate * g.b1[j];
    }
  }

  root.NN = { rng: rng, gauss: gauss, sigmoid: sigmoid, xent: xent, dataset: dataset,
              neuronStats: neuronStats, makeNet: makeNet, netZ: netZ,
              netLossGrad: netLossGrad, netStep: netStep };
})(typeof window !== "undefined" ? window : this);
