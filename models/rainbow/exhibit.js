/* Exhibit script: "Why is a rainbow round?"
   Model in model.js (window.Rainbow). One IIFE per figure. */

/* Shared drawing helpers */
var RB = (function () {
  "use strict";
  // Layout for figures that put a drop beside a plot: side by side when wide,
  // stacked when narrow.
  function split(w, h) {
    if (w >= 520) return { drop: { x: 0, y: 0, w: w * 0.46, h: h }, plot: { x: w * 0.5, y: 0, w: w * 0.5, h: h } };
    return { drop: { x: 0, y: 0, w: w, h: h * 0.5 }, plot: { x: 0, y: h * 0.52, w: w, h: h * 0.48 } };
  }
  // Drop geometry inside a box: centre and radius, leaving room for rays.
  function dropGeom(box) {
    var R = Math.min(box.w * 0.3, box.h * 0.32);
    return { cx: box.x + box.w * 0.6, cy: box.y + box.h * 0.4, R: R };
  }
  function drawDrop(ctx, g, c) {
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, Orrery.TAU);
    ctx.fillStyle = c.paper2 || c.paper; ctx.fill();
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // Draw one ray's full path; returns the exit point in canvas px.
  function drawRay(ctx, g, b, n, k, colour, width, x0, outLen) {
    var p = Rainbow.path(b, n, k), P = p.pts;
    function X(q) { return g.cx + g.R * q[0]; }
    function Y(q) { return g.cy - g.R * q[1]; }
    ctx.beginPath();
    ctx.moveTo(x0, Y(P[0])); ctx.lineTo(X(P[0]), Y(P[0]));
    for (var j = 1; j < P.length; j++) ctx.lineTo(X(P[j]), Y(P[j]));
    var e = P[P.length - 1];
    ctx.lineTo(X(e) + outLen * p.exitDir[0], Y(e) - outLen * p.exitDir[1]);
    ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke();
    return { x: X(e), y: Y(e), dir: p.exitDir, D: p.D };
  }
  function axes(ctx, r, c) {
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r.l, r.t); ctx.lineTo(r.l, r.b); ctx.lineTo(r.r, r.b); ctx.stroke();
  }
  return { split: split, dropGeom: dropGeom, drawDrop: drawDrop, drawRay: drawRay, axes: axes };
})();

/* ---- Figure 1: one ray through one drop ---------------------------------- */
(function () {
  "use strict";
  var cv = document.getElementById("one-canvas");
  if (!cv) return;
  var DEG = Rainbow.DEG, LAMBDA = 589, n = Rainbow.index(LAMBDA);
  var best = Rainbow.descartes(n, 1);
  var b = 0.6;
  var outD = document.getElementById("one-dev"), outT = document.getElementById("one-theta"),
      outI = document.getElementById("one-i"), slider = document.getElementById("one-b"),
      sliderOut = document.getElementById("one-b-out");
  var layout, plotR, geom;

  var view = Orrery.canvas(cv, function (ctx, w, h) {
    var c = Orrery.tokens();
    layout = RB.split(w, h);
    geom = RB.dropGeom(layout.drop);
    var small = w < 520;
    ctx.font = (small ? 11 : 12) + "px " + c.sans;

    // Sunlight label and faint parallel rays
    ctx.fillStyle = c.ink3; ctx.textAlign = "left";
    ctx.fillText("sunlight →", layout.drop.x + 6, Math.max(12, geom.cy - geom.R - 10));
    RB.drawDrop(ctx, geom, c);
    // the Descartes ray, faint
    RB.drawRay(ctx, geom, best.b, n, 1, c.rule, 1.2, layout.drop.x, geom.R * 1.6);
    // the reader's ray
    var ex = RB.drawRay(ctx, geom, b, n, 1, c.brass, 2.2, layout.drop.x, geom.R * 1.6);
    // reference line back toward the Sun from the exit point, and the angle between them
    ctx.setLineDash([4, 4]); ctx.strokeStyle = c.ink3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ex.x, ex.y); ctx.lineTo(ex.x - geom.R * 1.2, ex.y); ctx.stroke();
    ctx.setLineDash([]);
    var th = Rainbow.skyAngle(ex.D), ar = geom.R * 0.55;
    ctx.beginPath(); ctx.arc(ex.x, ex.y, ar, Math.PI, Math.PI + th, false);
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = c.verdigris; ctx.textAlign = "right";
    ctx.fillText(Orrery.fmt.number(th * DEG, 1) + "°", ex.x - ar - 4, ex.y + 14);
    // entry point handle
    var P0 = Rainbow.path(b, n, 1).pts[0];
    ctx.beginPath(); ctx.arc(geom.cx + geom.R * P0[0], geom.cy - geom.R * P0[1], 6, 0, Orrery.TAU);
    ctx.fillStyle = c.brassLit; ctx.fill(); ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();

    // Plot: deviation against impact parameter
    var P = layout.plot, pad = small ? 44 : 50;
    plotR = { l: P.x + pad, r: P.x + P.w - 12, t: P.y + 14, b: P.y + P.h - (small ? 30 : 36) };
    var D0 = 130, D1 = 180;
    function px(bb) { return plotR.l + bb * (plotR.r - plotR.l); }
    function py(D) { return plotR.b - (D - D0) / (D1 - D0) * (plotR.b - plotR.t); }
    RB.axes(ctx, plotR, c);
    ctx.fillStyle = c.ink3; ctx.textAlign = "right";
    [130, 140, 150, 160, 170, 180].forEach(function (D) {
      ctx.fillText(D + "°", plotR.l - 4, py(D) + 4);
      ctx.strokeStyle = c.rule; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(plotR.l, py(D)); ctx.lineTo(plotR.r, py(D)); ctx.stroke(); ctx.globalAlpha = 1;
    });
    ctx.textAlign = "center";
    [0, 0.25, 0.5, 0.75, 1].forEach(function (bb) { ctx.fillText(Orrery.fmt.number(bb, 2), px(bb), plotR.b + 14); });
    ctx.fillText("where the ray enters (0 = centre, 1 = edge)", (plotR.l + plotR.r) / 2, plotR.b + (small ? 27 : 30));
    ctx.save(); ctx.translate(P.x + 9, (plotR.t + plotR.b) / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("deviation", 0, 0); ctx.restore();
    // curve
    ctx.beginPath();
    for (var j = 0; j <= 300; j++) {
      var bb = j / 300 * 0.9999, D = Rainbow.deviation(bb, n, 1) * DEG;
      if (j === 0) ctx.moveTo(px(bb), py(D)); else ctx.lineTo(px(bb), py(D));
    }
    ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.5; ctx.stroke();
    // minimum
    ctx.beginPath(); ctx.arc(px(best.b), py(best.D * DEG), 4, 0, Orrery.TAU); ctx.fillStyle = c.verdigris; ctx.fill();
    ctx.fillStyle = c.verdigris; ctx.textAlign = "center";
    ctx.fillText("minimum " + Orrery.fmt.number(best.D * DEG, 1) + "°", px(best.b) - (small ? 30 : 10), py(best.D * DEG) + 18);
    // reader's ray
    var Dr = Rainbow.deviation(b, n, 1) * DEG;
    ctx.beginPath(); ctx.arc(px(b), py(Dr), 6, 0, Orrery.TAU);
    ctx.fillStyle = c.brassLit; ctx.fill(); ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();
  });

  function update() {
    var D = Rainbow.deviation(b, n, 1) * DEG;
    outD.textContent = Orrery.fmt.number(D, 1) + "°";
    outT.textContent = Orrery.fmt.number(180 - D, 1) + "°";
    outI.textContent = Orrery.fmt.number(Math.asin(b) * DEG, 1) + "°";
    cv.setAttribute("aria-valuenow", Math.round(b * 100));
    cv.setAttribute("aria-valuetext", "enters at " + Orrery.fmt.number(b, 2) + " of the radius; deviation " +
      Orrery.fmt.number(D, 1) + " degrees");
    view.redraw();
  }
  var range = Orrery.bindRange(slider, sliderOut, {
    format: function (v) { return Orrery.fmt.number(v, 2); },
    onInput: function (v) { b = v; update(); }
  });
  function setB(v) { b = Orrery.clamp(v, 0, 0.99); range.set(Math.round(b * 100) / 100); update(); }
  function fromPointer(p) {
    if (!layout) return;
    var inPlot = p.x >= layout.plot.x && p.y >= layout.plot.y;
    if (inPlot && plotR) setB((p.x - plotR.l) / (plotR.r - plotR.l));
    else setB((geom.cy - p.y) / geom.R);
  }
  Orrery.drag(cv, {
    onStart: fromPointer, onMove: fromPointer,
    onNudge: function (dx, dy) { setB(b + 0.01 * (dx || -dy)); }
  });
  update();
})();

/* ---- Figure 2: a whole beam, and where the light goes -------------------- */
(function () {
  "use strict";
  var cv = document.getElementById("beam-canvas");
  if (!cv) return;
  var DEG = Rainbow.DEG, lambda = 650, both = false;
  var BIN = 0.5, NBIN = 120, RAYS = 4000;          // 0..60°, half-degree bins
  var outPeak = document.getElementById("beam-peak"), outN = document.getElementById("beam-n"),
      outShare = document.getElementById("beam-share");

  function histogram(l) {
    var n = Rainbow.index(l), hst = new Float64Array(NBIN);
    for (var j = 0; j < RAYS; j++) {
      var b = (j + 0.5) / RAYS, th = Rainbow.skyAngle(Rainbow.deviation(b, n, 1)) * DEG;
      var k = Math.floor(th / BIN); if (k >= 0 && k < NBIN) hst[k] += 1;
    }
    return hst;
  }
  var cache = {};
  function hist(l) { return cache[l] || (cache[l] = histogram(l)); }

  var view = Orrery.canvas(cv, function (ctx, w, h) {
    var c = Orrery.tokens(), L = RB.split(w, h), g = RB.dropGeom(L.drop), small = w < 520;
    ctx.font = (small ? 11 : 12) + "px " + c.sans;
    RB.drawDrop(ctx, g, c);
    var ls = both ? [700, 400] : [lambda];
    ls.forEach(function (l) {
      var n = Rainbow.index(l), col = Rainbow.cssColour(l);
      ctx.globalAlpha = both ? 0.55 : 0.5;
      for (var j = 0; j < 24; j++) RB.drawRay(ctx, g, (j + 0.5) / 24, n, 1, col, 1, L.drop.x, g.R * 1.7);
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = c.ink3; ctx.textAlign = "left";
    ctx.fillText("sunlight →", L.drop.x + 6, Math.max(12, g.cy - g.R - 10));

    // histogram
    var P = L.plot, pad = small ? 30 : 40;
    var r = { l: P.x + pad, r: P.x + P.w - 10, t: P.y + 14, b: P.y + P.h - (small ? 30 : 36) };
    RB.axes(ctx, r, c);
    var max = 0;
    ls.forEach(function (l) { var hs = hist(l); for (var k = 0; k < NBIN; k++) max = Math.max(max, hs[k]); });
    var bw = (r.r - r.l) / NBIN;
    ls.forEach(function (l, idx) {
      var hs = hist(l), col = Rainbow.cssColour(l);
      ctx.fillStyle = col; ctx.globalAlpha = both ? 0.7 : 0.9;
      for (var k = 0; k < NBIN; k++) {
        var hh = hs[k] / max * (r.b - r.t);
        ctx.fillRect(r.l + k * bw, r.b - hh, Math.max(1, bw - 0.5), hh);
      }
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = c.ink3; ctx.textAlign = "center";
    for (var a = 0; a <= 60; a += 10) ctx.fillText(a + "°", r.l + a / BIN * bw, r.b + 14);
    ctx.fillText("angle from the antisolar point", (r.l + r.r) / 2, r.b + (small ? 27 : 30));
    ctx.save(); ctx.translate(P.x + 10, (r.t + r.b) / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("rays per ½°", 0, 0); ctx.restore();
    var edge = Rainbow.descartes(Rainbow.index(both ? 700 : lambda), 1).theta * DEG;
    ctx.textAlign = "left"; ctx.fillStyle = c.ink3;
    // the label sits right of the edge; take the first wording that fits before the plot's right side
    var lx = r.l + edge / BIN * bw + 6, avail = r.r - lx + 4;
    var words = [["no rays beyond the edge"], ["no rays", "beyond the edge"], ["no rays", "out here"], ["no rays"]], pick = words[words.length - 1];
    for (var q = 0; q < words.length; q++) {
      var wd = 0; words[q].forEach(function (t) { wd = Math.max(wd, ctx.measureText(t).width); });
      if (wd <= avail) { pick = words[q]; break; }
    }
    pick.forEach(function (t, i) { ctx.fillText(t, lx, r.t + 12 + i * 15); });
  });

  function update() {
    var n = Rainbow.index(lambda), d = Rainbow.descartes(n, 1), hs = hist(lambda);
    var peak = d.theta * DEG, near = 0;
    for (var k = 0; k < NBIN; k++) { var mid = (k + 0.5) * BIN; if (mid > peak - 1 && mid <= peak) near += hs[k]; }
    outPeak.textContent = Orrery.fmt.number(peak, 2) + "°";
    outN.textContent = Orrery.fmt.number(n, 4);
    outShare.textContent = Orrery.fmt.percent(near / RAYS, 0);
    view.redraw();
  }
  Orrery.bindRange(document.getElementById("beam-l"), document.getElementById("beam-l-out"), {
    format: function (v) { return Math.round(v) + " nm"; },
    onInput: function (v) { lambda = Math.round(v); update(); }
  });
  document.getElementById("beam-both").addEventListener("change", function (e) { both = e.target.checked; view.redraw(); });
  update();
})();

/* ---- Figure 3: the sky, as you see it with your back to the Sun ---------- */
(function () {
  "use strict";
  var cv = document.getElementById("sky-canvas");
  if (!cv) return;
  var DEG = Rainbow.DEG, sunEl = 20, showSecond = false;
  var prim = Rainbow.skyProfile(1), sec = Rainbow.skyProfile(2), STEP = Rainbow.STEP;
  var outTop = document.getElementById("sky-top"), outArc = document.getElementById("sky-arc");
  var EXPOSE = 6;                       // display exposure for the scattered light
  var img = null, imgKey = "";

  // Stereographic projection centred on the horizon, straight away from the Sun.
  // It keeps circles on the sky circular and the horizon straight.
  // Direction: x right, y up, z ahead. Plane coords (u, v) = 2(x, y)/(1 + z).
  var U = 1.45;                           // half-width of the view in plane units
  function render(W, H) {
    var key = W + "x" + H + ":" + sunEl + ":" + showSecond;
    if (key === imgKey) return img;
    var off = document.createElement("canvas"); off.width = W; off.height = H;
    var g = off.getContext("2d"), id = g.createImageData(W, H), d = id.data;
    var s = W / (2 * U), v0 = H * 0.72;   // horizon row
    var se = sunEl / DEG, ax = 0, ay = -Math.sin(se), az = Math.cos(se);   // antisolar direction
    for (var py = 0; py < H; py++) {
      for (var px = 0; px < W; px++) {
        var u = (px + 0.5 - W / 2) / s, v = (v0 - py - 0.5) / s, q = u * u + v * v;
        var x = 4 * u / (4 + q), y = 4 * v / (4 + q), z = (4 - q) / (4 + q);
        var o = 4 * (py * W + px), r, gg, bb;
        if (y < 0) {                       // ground
          r = 0.10; gg = 0.13; bb = 0.09;
          var t = Math.min(1, -y * 3); r += 0.06 * (1 - t); gg += 0.07 * (1 - t); bb += 0.05 * (1 - t);
        } else {                           // sky: a grey rain-cloud backdrop
          r = 0.20 + 0.06 * y; gg = 0.22 + 0.06 * y; bb = 0.27 + 0.05 * y;
          var cosA = Math.max(-1, Math.min(1, ax * x + ay * y + az * z));
          var th = Math.acos(cosA) * DEG, k = Math.round(th / STEP);
          r += EXPOSE * Math.max(0, prim[0][k]); gg += EXPOSE * Math.max(0, prim[1][k]); bb += EXPOSE * Math.max(0, prim[2][k]);
          if (showSecond) { r += EXPOSE * Math.max(0, sec[0][k]); gg += EXPOSE * Math.max(0, sec[1][k]); bb += EXPOSE * Math.max(0, sec[2][k]); }
        }
        d[o] = 255 * Rainbow.gamma(r); d[o + 1] = 255 * Rainbow.gamma(gg); d[o + 2] = 255 * Rainbow.gamma(bb); d[o + 3] = 255;
      }
    }
    g.putImageData(id, 0, 0);
    img = { canvas: off, s: s, v0: v0 }; imgKey = key;
    return img;
  }
  function project(x, y, z, s, W, v0) { return [W / 2 + s * 2 * x / (1 + z), v0 - s * 2 * y / (1 + z)]; }

  var view = Orrery.canvas(cv, function (ctx, w, h) {
    var c = Orrery.tokens(), scale = Math.min(2, window.devicePixelRatio || 1) * 0.75;
    var W = Math.max(120, Math.round(w * scale)), H = Math.max(60, Math.round(h * scale));
    var im = render(W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(im.canvas, 0, 0, w, h);
    var s = im.s / scale, v0 = im.v0 / scale, small = w < 520;
    ctx.font = (small ? 11 : 12) + "px " + c.sans;
    // antisolar point (shadow of your head)
    var se = sunEl / DEG, A = project(0, -Math.sin(se), Math.cos(se), s, w, v0);
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(A[0] - 6, A[1]); ctx.lineTo(A[0] + 6, A[1]); ctx.moveTo(A[0], A[1] - 6); ctx.lineTo(A[0], A[1] + 6); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.textAlign = "center";
    if (A[1] < h - 8) ctx.fillText("shadow of your head", A[0], Math.min(h - 6, A[1] + 18));
    // horizon label and elevation ticks
    ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("horizon", 6, v0 - 5);
    [20, 40].forEach(function (e) {
      var p = project(0, Math.sin(e / DEG), Math.cos(e / DEG), s, w, v0);
      if (p[1] > 10) { ctx.fillText(e + "° up", 6, p[1] + 4); ctx.fillRect(0, p[1], 4, 1); }
    });
  });

  function update() {
    var top = 42.0 - sunEl;                // using the bow's middle (≈ 589 nm)
    var bow = Rainbow.descartes(Rainbow.index(589), 1).theta * DEG;
    top = bow - sunEl;
    outTop.textContent = top > 0 ? Orrery.fmt.number(top, 1) + "° above the horizon" : "below the horizon";
    // fraction of the circle above the horizon: the circle of radius ρ around a point
    // δ below the horizon; points with elevation > 0 satisfy cos φ > tan δ cot ρ… solved numerically.
    var above = 0, N = 720, se = sunEl / DEG, rho = bow / DEG;
    for (var j = 0; j < N; j++) {
      var phi = (j + 0.5) / N * Orrery.TAU;
      // elevation of a point ρ from the antisolar point (at elevation −se), position angle φ from "up"
      var sinEl = Math.sin(-se) * Math.cos(rho) + Math.cos(se) * Math.sin(rho) * Math.cos(phi);
      if (sinEl > 0) above++;
    }
    outArc.textContent = Orrery.fmt.percent(above / N, 0);
    cv.setAttribute("aria-label", "The sky opposite the Sun, with the Sun " + sunEl + " degrees up. " +
      (top > 0 ? "A rainbow arc rises " + Orrery.fmt.number(top, 1) + " degrees above the horizon; " +
      Orrery.fmt.percent(above / N, 0) + " of its circle is above the ground." : "The whole rainbow circle is below the horizon, so there is no bow."));
    view.redraw();
  }
  Orrery.bindRange(document.getElementById("sky-sun"), document.getElementById("sky-sun-out"), {
    format: function (v) { return Math.round(v) + "°"; },
    onInput: function (v) { sunEl = Math.round(v); update(); }
  });
  document.getElementById("sky-second").addEventListener("change", function (e) { showSecond = e.target.checked; update(); });
  update();
})();

/* ---- Figure (side view): the cone, and why your friend sees other drops --- */
(function () {
  "use strict";
  var cv = document.getElementById("cone-canvas");
  if (!cv) return;
  var DEG = Rainbow.DEG, sunEl = 20, you = 8, FRIEND = 4, EYE = 1.7;
  var X0 = 0, X1 = 60, Y1 = 28;                    // world, metres
  // Fixed "random" raindrops (simple LCG so the picture is the same every time).
  var drops = [], seed = 12345;
  function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
  for (var j = 0; j < 2600; j++) drops.push([24 + 36 * rnd(), 0.3 + (Y1 - 1) * rnd()]);
  // wavelength for each angle inside the bow's colour band (from the model)
  var table = [];
  for (var l = 400; l <= 700; l += 5) table.push([Rainbow.descartes(Rainbow.index(l), 1).theta * DEG, l]);
  var LO = table[0][0], HI = table[table.length - 1][0];
  function lambdaAt(th) {
    for (var k = 1; k < table.length; k++) if (th <= table[k][0])
      return table[k - 1][1] + (th - table[k - 1][0]) / (table[k][0] - table[k - 1][0]) * 5;
    return 700;
  }
  // which drops send this eye a colour of the primary bow?
  function lit(ex) {
    var se = sunEl / DEG, ax = Math.cos(se), ay = -Math.sin(se), out = [];
    for (var k = 0; k < drops.length; k++) {
      var dx = drops[k][0] - ex, dy = drops[k][1] - EYE, L = Math.hypot(dx, dy);
      var th = Math.acos(Math.max(-1, Math.min(1, (dx * ax + dy * ay) / L))) * DEG;
      if (th >= LO && th <= HI) out.push([k, lambdaAt(th)]);
    }
    return out;
  }
  var outYou = document.getElementById("cone-you"), outFr = document.getElementById("cone-friend"),
      outBoth = document.getElementById("cone-both");
  var sc, ox, oy;

  var view = Orrery.canvas(cv, function (ctx, w, h) {
    var c = Orrery.tokens(), small = w < 520;
    sc = Math.min(w / (X1 - X0), (h - 18) / Y1); ox = 0; oy = h - 18;
    function X(x) { return ox + x * sc; } function Y(y) { return oy - y * sc; }
    ctx.font = (small ? 11 : 12) + "px " + c.sans;
    // ground
    ctx.fillStyle = c.paper3 || c.rule; ctx.fillRect(0, oy, w, h - oy);
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    // sunlight arrows, coming down from behind (left) at the Sun's height
    var se = sunEl / DEG;
    ctx.strokeStyle = c.brass; ctx.fillStyle = c.brass; ctx.lineWidth = 1.2;
    for (var a = 0; a < 3; a++) {
      var sx = X(1 + a * 4), sy = Y(Y1 - 2 - a * 1.5), L = 5 * sc;
      var tx = sx + L * Math.cos(se), ty = sy + L * Math.sin(se);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx, ty);
      ctx.lineTo(tx - 7 * Math.cos(se - 0.4), ty - 7 * Math.sin(se - 0.4));
      ctx.lineTo(tx - 7 * Math.cos(se + 0.4), ty - 7 * Math.sin(se + 0.4)); ctx.closePath(); ctx.fill();
    }
    ctx.textAlign = "left"; ctx.fillText("sunlight", X(1), Y(Y1 - 2) - 6);
    // rain
    ctx.fillStyle = c.ink3; ctx.globalAlpha = 0.35;
    for (var k = 0; k < drops.length; k++) ctx.fillRect(X(drops[k][0]) - 0.75, Y(drops[k][1]) - 0.75, 1.5, 1.5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.ink3; ctx.textAlign = "right"; ctx.fillText("rain", w - 6, Y(Y1) + 14);

    function person(px, col, label, mine) {
      var ex = X(px), ey = Y(EYE), axd = Math.cos(se), ayd = Math.sin(se);
      // antisolar line (down into the ground) and the two edges of the cone in this plane
      ctx.setLineDash([3, 4]); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.globalAlpha = mine ? 0.9 : 0.5;
      ctx.beginPath(); ctx.moveTo(ex, ey);
      var tg = EYE / Math.max(0.05, Math.tan(se));
      ctx.lineTo(X(px + Math.min(60, tg)), Y(Math.max(0, EYE - Math.min(60, tg) * Math.tan(se)))); ctx.stroke();
      var up = (42 - sunEl) / DEG, R = 70 * sc;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + R * Math.cos(up), ey - R * Math.sin(up)); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      // body
      var hh = EYE * sc;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex, oy); ctx.lineTo(ex, ey + hh * 0.25); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex, ey + hh * 0.12, Math.max(3, hh * 0.13), 0, Orrery.TAU); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = col; ctx.textAlign = "center"; ctx.fillText(label, ex, oy + 13);
    }
    var mine = lit(you), theirs = lit(you - FRIEND);
    person(you - FRIEND, c.verdigris, "friend", false);
    person(you, c.brass, "you", true);
    // drops lit for the friend: rings; for you: filled in the colour they send you
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.5;
    theirs.forEach(function (d) { var p = drops[d[0]]; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 4, 0, Orrery.TAU); ctx.stroke(); });
    mine.forEach(function (d) {
      var p = drops[d[0]];
      ctx.strokeStyle = Rainbow.cssColour(d[1]); ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(p[0]), Y(p[1])); ctx.lineTo(X(you), Y(EYE)); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 3.5, 0, Orrery.TAU); ctx.fillStyle = Rainbow.cssColour(d[1]); ctx.fill();
    });
    // readouts
    var set = {}, both = 0;
    mine.forEach(function (d) { set[d[0]] = 1; });
    theirs.forEach(function (d) { if (set[d[0]]) both++; });
    outYou.textContent = String(mine.length); outFr.textContent = String(theirs.length); outBoth.textContent = String(both);
  });

  function setYou(v) {
    you = Orrery.clamp(v, FRIEND + 1, 20);
    cv.setAttribute("aria-valuenow", Math.round(you));
    cv.setAttribute("aria-valuetext", "you stand " + Math.round(you) + " metres from the left edge");
    view.redraw();
  }
  Orrery.drag(cv, {
    onStart: function (p) { if (sc) setYou(p.x / sc); },
    onMove: function (p) { if (sc) setYou(p.x / sc); },
    onNudge: function (dx, dy) { setYou(you + (dx || -dy) * 0.5); }
  });
  Orrery.bindRange(document.getElementById("cone-sun"), document.getElementById("cone-sun-out"), {
    format: function (v) { return Math.round(v) + "°"; },
    onInput: function (v) { sunEl = Math.round(v); view.redraw(); }
  });
  setYou(you);
})();
