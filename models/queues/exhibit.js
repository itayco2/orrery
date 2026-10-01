/* Exhibit script: "Why is the other line always faster?"
   One IIFE per figure; the queueing maths lives in queues-lib.js (window.QLib).
   Times inside the simulations are in minutes. */

/* ---- shared helpers for the animated checkout scenes -------------------- */
var QScene = (function () {
  "use strict";
  // Move a drawn customer towards its target; k sets how brisk the walk is.
  function ease(p, tx, ty, dt, k) {
    if (p.x == null) { p.x = tx; p.y = ty; return; }
    var f = Math.min(1, dt * k);
    p.x += (tx - p.x) * f; p.y += (ty - p.y) * f;
  }
  function dot(ctx, x, y, r, fill, stroke) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Orrery.TAU);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
  }
  function till(ctx, x, y, s, c, busy) {
    ctx.fillStyle = busy ? c.paper3 || c.paper2 : c.paper2;
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.rect(x - s * 0.6, y - s, s * 1.2, s * 2); ctx.fill(); ctx.stroke();
  }
  function minutes(m) {
    if (!isFinite(m)) return "—";
    if (m < 1) return Orrery.fmt.number(m * 60, 0) + " s";
    if (m < 10) return Orrery.fmt.number(m, 1) + " min";
    return Orrery.fmt.number(m, 0) + " min";
  }
  return { ease: ease, dot: dot, till: till, minutes: minutes };
})();

/* ---- Figure 1: one till (M/M/1), animated, with the theory curve --------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("till-canvas");
  if (!canvasEl) return;
  var lam = 48 / 60, mu = 60 / 60;          // per minute
  var SPEED = 1.5, FAST = 20;               // simulated minutes per real second
  var fast = false;
  var seed = 14, r, T, nextArr, serverFree, custs, stat, hist, snap;
  var HIST = 60;                            // minutes of queue-length history drawn   // seed 14: a typical first two hours
  var fastBtn = document.getElementById("till-fast");
  var out = {
    rho: document.getElementById("till-rho"),
    busy: document.getElementById("till-busy"),
    n: document.getElementById("till-n"),
    wait: document.getElementById("till-wait"),
    theory: document.getElementById("till-theory"),
    clock: document.getElementById("till-clock")
  };

  function resetStats() {
    stat = { start: T, n: 0, sum: 0, busyDone: 0 };
    custs.forEach(function (c) { c.waitDone = true; });
  }
  function restart() {
    r = QLib.rng(seed); T = 0; serverFree = 0; custs = []; hist = [];
    nextArr = r.exp(1 / lam);
    resetStats();
    // two hours of history, so the scene starts busy; then stop at a moment with a line
    for (var i = 0; i < 480; i++) advance(0.25);
    for (i = 0; i < 240 && waitingNow() < 3; i++) advance(0.25);
    custs.forEach(function (c) { c.x = null; });
    snap = true;
  }
  function advance(dT) {
    T += dT;
    while (nextArr <= T) {
      var c = { t: nextArr, s: r.exp(1 / mu), waitDone: false, busyDone: false };
      c.start = Math.max(c.t, serverFree);
      c.dep = c.start + c.s;
      serverFree = c.dep;
      custs.push(c);
      nextArr += r.exp(1 / lam);
    }
    for (var i = 0; i < custs.length; i++) {
      var c2 = custs[i];
      if (!c2.waitDone && c2.start <= T) {
        c2.waitDone = true;
        if (c2.t >= stat.start) { stat.n++; stat.sum += c2.start - c2.t; }
      }
      if (!c2.busyDone && c2.dep <= T) {
        c2.busyDone = true;
        stat.busyDone += Math.max(0, c2.dep - Math.max(c2.start, stat.start));
      }
    }
    // forget customers who have walked off
    while (custs.length && custs[0].dep < T - 3 && custs[0].busyDone) custs.shift();
    hist.push([T, waitingNow()]);
    while (hist.length > 2 && hist[1][0] < T - HIST) hist.shift();
  }
  function waitingNow() {
    var n = 0;
    for (var i = 0; i < custs.length; i++) if (custs[i].t <= T && custs[i].start > T) n++;
    return n;
  }
  function busyFraction() {
    var b = stat.busyDone;
    custs.forEach(function (c) {
      if (c.start <= T && c.dep > T) b += T - Math.max(c.start, stat.start);
    });
    var el = T - stat.start;
    return el > 0 ? b / el : 0;
  }

  var lastDt = 0;
  restart();
  var view = Orrery.canvas(canvasEl, draw);

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var narrow = w < 560;
    // scene box and chart box
    var S = narrow ? { x: 0, y: 0, w: w, h: h * 0.45 } : { x: 0, y: 0, w: w * 0.56, h: h };
    var G = narrow ? { x: 0, y: h * 0.47, w: w, h: h * 0.53 } : { x: w * 0.58, y: 0, w: w * 0.42, h: h };
    var rad = Math.max(5.5, Math.min(8, S.h / 40)), gap = rad * 2.6;
    var midY = S.y + S.h * 0.55, tillX = S.x + S.w * 0.72, exitX = S.x + S.w - 10;
    var maxSlots = Math.floor((tillX - 30 - S.x - 20) / gap);

    ctx.font = "12px " + c.sans; ctx.fillStyle = c.ink3; ctx.textAlign = "left";
    ctx.fillText("arrive →", S.x + 6, midY - 22);
    ctx.textAlign = "center";
    ctx.fillText("till", tillX, midY + rad * 2.4 + 16);
    QScene.till(ctx, tillX, midY, rad * 2.4, c, serverFree > T);

    var waiting = 0, hidden = 0;
    for (var i = 0; i < custs.length; i++) {
      var p = custs[i], tx, ty = midY, col = c.ink2, alpha = 1;
      if (p.t > T) continue;
      if (p.start > T) {                     // in line
        waiting++;
        if (waiting > maxSlots) { hidden++; tx = S.x + 12; ty = midY; }
        else tx = tillX - 26 - waiting * gap;
      } else if (p.dep > T) {                // being served
        tx = tillX; ty = midY; col = c.verdigris;
      } else {                               // walking off
        tx = exitX; ty = midY - S.h * 0.3; col = c.ink3;
        alpha = Math.max(0, 1 - (T - p.dep) / 2.5);
      }
      if (p.x == null && !snap) { p.x = S.x + 10; p.y = midY; }
      QScene.ease(p, tx, ty, lastDt, 8);
      if (waiting > maxSlots && p.start > T) continue;
      ctx.globalAlpha = alpha;
      QScene.dot(ctx, p.x, p.y, rad, col);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = c.ink3; ctx.textAlign = "left";
    if (hidden > 0) ctx.fillText("+" + hidden + " more", S.x + 6, midY + 22);
    snap = false;

    // queue length over the last hour of simulated time
    var hx0 = S.x + 36, hx1 = tillX + 20, hy1 = midY + S.h * 0.2, hy0 = S.y + S.h - 22;
    var hmax = 5;
    hist.forEach(function (q) { if (q[1] > hmax) hmax = q[1]; });
    hmax = Math.ceil(hmax / 5) * 5;
    if (hy0 - hy1 > 30) {
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx0, hy0); ctx.lineTo(hx1, hy0); ctx.stroke();
      ctx.beginPath();
      for (var j = 0; j < hist.length; j++) {
        var hx = hx1 - (T - hist[j][0]) / HIST * (hx1 - hx0);
        var hy = hy0 - hist[j][1] / hmax * (hy0 - hy1);
        if (hx < hx0) hx = hx0;
        if (j === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
      }
      ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = c.ink3; ctx.textAlign = "right";
      ctx.fillText(String(hmax), hx0 - 6, hy1 + 4); ctx.fillText("0", hx0 - 6, hy0 + 4);
      ctx.textAlign = "left";
      ctx.fillText("people waiting, last hour: now " + waiting, hx0, hy1 - 8);
    } else {
      ctx.fillText(waiting + " waiting", S.x + 6, S.y + S.h - 10);
    }

    // ---- chart: average wait (in service times) against utilisation ----
    var pad = { l: 40, r: 20, t: 22, b: 34 };
    var X0 = G.x + pad.l, X1 = G.x + G.w - pad.r, Y0 = G.y + G.h - pad.b, Y1 = G.y + pad.t;
    var YMAX = 10;
    function px(rho) { return X0 + rho * (X1 - X0); }
    function py(v) { return Y0 - Math.min(v, YMAX * 1.04) / YMAX * (Y0 - Y1); }
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans;
    ctx.textAlign = "right";
    for (var yv = 0; yv <= YMAX; yv += 2) {
      ctx.beginPath(); ctx.moveTo(X0, py(yv)); ctx.lineTo(X1, py(yv)); ctx.stroke();
      ctx.fillText(String(yv), X0 - 6, py(yv) + 4);
    }
    ctx.textAlign = "center";
    for (var xv = 0; xv <= 1.001; xv += 0.25) ctx.fillText(Math.round(xv * 100) + "%", px(xv), Y0 + 15);
    ctx.fillText("how busy the till is (utilisation)", (X0 + X1) / 2, Y0 + 29);
    ctx.save(); ctx.translate(G.x + 10, (Y0 + Y1) / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("average wait, in service times", 0, 0); ctx.restore();
    ctx.beginPath();
    for (var k = 0; k <= 200; k++) {
      var rr = k / 200 * 0.915;
      var v = rr / (1 - rr);
      if (k === 0) ctx.moveTo(px(rr), py(v)); else ctx.lineTo(px(rr), py(v));
    }
    ctx.strokeStyle = c.brass; ctx.lineWidth = 2; ctx.stroke();
    var rho = lam / mu;
    if (rho < 1) {
      ctx.setLineDash([3, 3]); ctx.strokeStyle = c.ink3; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px(rho), Y0); ctx.lineTo(px(rho), Y1); ctx.stroke(); ctx.setLineDash([]);
    }
    if (stat.n > 0) {
      var meas = stat.sum / stat.n * mu;     // in service times
      var mx = px(Math.min(rho, 1.02));
      var off = meas > YMAX;                 // above the chart: pin at the top and say so
      var my = off ? py(YMAX) : py(meas);
      QScene.dot(ctx, mx, my, 6, c.verdigrisLit || c.verdigris, c.verdigris);
      ctx.fillStyle = c.ink2; ctx.textAlign = mx > (X0 + X1) / 2 ? "right" : "left";
      var lx = mx + (ctx.textAlign === "right" ? -10 : 10);
      if (off) {
        ctx.beginPath(); ctx.moveTo(mx, my - 16); ctx.lineTo(mx - 5, my - 9); ctx.lineTo(mx + 5, my - 9); ctx.closePath();
        ctx.fill();
        ctx.fillText("this run: " + Orrery.fmt.number(meas, 0) + " ↑", lx, my + 4);
        ctx.fillText("off the scale", lx, my + 18);
      } else {
        ctx.fillText("this run", lx, my - 8);
      }
    }
    ctx.fillStyle = c.brass; ctx.textAlign = "left";
    ctx.fillText("theory: ρ/(1−ρ)", X0 + 6, Y1 + 4);
  }

  function readouts() {
    var rho = lam / mu;
    out.rho.textContent = Orrery.fmt.percent(rho, 0);
    out.busy.textContent = Orrery.fmt.percent(busyFraction(), 0);
    out.n.textContent = Orrery.fmt.number(stat.n, 0);
    out.wait.textContent = stat.n ? QScene.minutes(stat.sum / stat.n) : "—";
    out.theory.textContent = rho < 1 ? QScene.minutes(QLib.mm1Wq(lam, mu)) : "grows without limit";
    out.clock.textContent = Orrery.fmt.number((T - stat.start) / 60, 1) + " h";
  }

  function step(dt) {
    lastDt = dt;
    advance(dt * (fast ? FAST : SPEED));
    view.redraw();
    readouts();
  }

  var loop = Orrery.loop(canvasEl, step, { button: document.getElementById("till-play") });

  Orrery.bindRange(document.getElementById("till-lam"), document.getElementById("till-lam-out"), {
    format: function (v) { return Orrery.fmt.number(v, 0) + " per hour"; },
    onInput: function (v) { lam = v / 60; nextArr = T + r.exp(1 / lam); resetStats(); view.redraw(); readouts(); }, init: false
  });
  Orrery.bindRange(document.getElementById("till-mu"), document.getElementById("till-mu-out"), {
    format: function (v) { return Orrery.fmt.number(v, 0) + " per hour (" + QScene.minutes(60 / v) + " each)"; },
    onInput: function (v) { mu = v / 60; resetStats(); view.redraw(); readouts(); }, init: false
  });
  fastBtn.addEventListener("click", function () {
    fast = !fast; fastBtn.setAttribute("aria-pressed", String(fast));
    if (fast && !loop.isPlaying()) loop.play();
  });
  document.getElementById("till-new").addEventListener("click", function () {
    seed = (seed * 16807 + 12345) % 2147483647; restart(); view.redraw(); readouts();
  });
  readouts();
})();

/* ---- Figure 2: the curve rho/(1-rho), scrubbable ------------------------- */
(function () {
  "use strict";
  var svgEl = document.getElementById("curve-svg");
  if (!svgEl) return;
  var NS = "http://www.w3.org/2000/svg";
  var W = 600, H = 340, L = 56, R = 16, TOP = 16, B = 46, YMAX = 25;
  var rho = 0.8;
  function make(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    svgEl.appendChild(e);
    return e;
  }
  function X(r) { return L + r * (W - L - R); }
  function Y(v) { return H - B - Math.min(v, YMAX) / YMAX * (H - B - TOP); }
  function f(r) { return r / (1 - r); }
  svgEl.setAttribute("viewBox", "0 0 " + W + " " + H);
  var lab = { fill: "var(--ink-3)", "font-family": "var(--sans)", "font-size": 13 };
  for (var yv = 0; yv <= YMAX; yv += 5) {
    make("line", { x1: L, x2: W - R, y1: Y(yv), y2: Y(yv), stroke: "var(--rule)" });
    make("text", Object.assign({ x: L - 8, y: Y(yv) + 4, "text-anchor": "end" }, lab), String(yv));
  }
  for (var xv = 0; xv <= 100; xv += 20)
    make("text", Object.assign({ x: X(xv / 100), y: H - B + 18, "text-anchor": "middle" }, lab), xv + "%");
  make("text", Object.assign({ x: (L + W - R) / 2, y: H - 8, "text-anchor": "middle" }, lab), "utilisation: share of time the till is busy");
  make("text", Object.assign({ x: 14, y: (TOP + H - B) / 2, "text-anchor": "middle",
    transform: "rotate(-90 14 " + (TOP + H - B) / 2 + ")" }, lab), "average wait (service times)");
  var d = "";
  for (var k = 0; k <= 400; k++) {
    var rr = k / 400 * 0.965;
    d += (k ? " L " : "M ") + X(rr).toFixed(1) + " " + Y(f(rr)).toFixed(1);
  }
  make("path", { d: d, fill: "none", stroke: "var(--brass)", "stroke-width": 2.5 });
  var dblLine = make("line", { stroke: "var(--verdigris)", "stroke-dasharray": "5 4", "stroke-width": 1.5 });
  var dblDot = make("circle", { r: 5, fill: "var(--verdigris-lit)", stroke: "var(--verdigris)" });
  var dblText = make("text", Object.assign({ "text-anchor": "end" }, lab, { fill: "var(--verdigris)" }), "");
  var vLine = make("line", { stroke: "var(--ink-3)", "stroke-dasharray": "3 3" });
  var hLine = make("line", { stroke: "var(--ink-3)", "stroke-dasharray": "3 3" });
  var dot = make("circle", { r: 9, fill: "var(--brass-lit)", stroke: "var(--brass)", "stroke-width": 2 });
  var out = {
    rho: document.getElementById("curve-rho"),
    spare: document.getElementById("curve-spare"),
    wait: document.getElementById("curve-wait"),
    min: document.getElementById("curve-min"),
    dbl: document.getElementById("curve-dbl")
  };

  function render() {
    var v = f(rho), r2 = 2 * rho / (1 + rho);   // where the wait is twice as long
    dot.setAttribute("cx", X(rho)); dot.setAttribute("cy", Y(v));
    vLine.setAttribute("x1", X(rho)); vLine.setAttribute("x2", X(rho));
    vLine.setAttribute("y1", H - B); vLine.setAttribute("y2", Y(v));
    hLine.setAttribute("x1", L); hLine.setAttribute("x2", X(rho));
    hLine.setAttribute("y1", Y(v)); hLine.setAttribute("y2", Y(v));
    var show = 2 * v <= YMAX;
    [dblLine, dblDot, dblText].forEach(function (e) { e.style.display = show ? "" : "none"; });
    if (show) {
      dblLine.setAttribute("x1", X(rho)); dblLine.setAttribute("y1", Y(v));
      dblLine.setAttribute("x2", X(r2)); dblLine.setAttribute("y2", Y(2 * v));
      dblDot.setAttribute("cx", X(r2)); dblDot.setAttribute("cy", Y(2 * v));
      dblText.setAttribute("x", X(r2) - 12); dblText.setAttribute("y", Y(2 * v) + 4);
      dblText.textContent = "twice the wait";
    }
    out.rho.textContent = Orrery.fmt.percent(rho, 0);
    out.spare.textContent = Orrery.fmt.percent(1 - rho, 0);
    out.wait.textContent = Orrery.fmt.number(v, v < 10 ? 2 : 1);
    out.min.textContent = QScene.minutes(3 * v);
    out.dbl.textContent = Orrery.fmt.percent(r2, 1);
    svgEl.setAttribute("aria-valuenow", Math.round(rho * 100));
    svgEl.setAttribute("aria-valuetext", Math.round(rho * 100) + "% busy: average wait " +
      Orrery.fmt.number(v, 1) + " service times; the wait doubles again at " + Orrery.fmt.percent(r2, 1) + " busy");
  }
  function set(r) { rho = Math.round(Orrery.clamp(r, 0.05, 0.96) * 100) / 100; render(); }
  function fromPointer(p) {
    var b = svgEl.getBoundingClientRect();
    var sx = p.x / b.width * W;
    set((sx - L) / (W - L - R));
  }
  Orrery.drag(svgEl, {
    onStart: fromPointer, onMove: fromPointer,
    onNudge: function (dx, dy) { set(rho + (dx || -dy) / 100); }
  });
  render();
})();

/* ---- Figure 3: three separate lines vs one shared line ------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("lines-canvas");
  if (!canvasEl) return;
  var C = 3, MEAN_S = 3;                     // three tills, 3-minute average service
  var rho = 0.85, lam = C * rho / MEAN_S;    // arrivals per minute
  var SPEED = 2, FAST = 25, fast = false;
  var seed = 1, r, tie, T, nextArr, A, B, stat, smart = false, snap = true;   // seed 1: a typical first four hours
  var fastBtn = document.getElementById("lines-fast");
  function el(id) { return document.getElementById(id); }
  var out = {
    aAvg: el("lines-a-avg"), aMax: el("lines-a-max"), bAvg: el("lines-b-avg"), bMax: el("lines-b-max"),
    n: el("lines-n"), fastest: el("lines-fastest"), theory: el("lines-theory"), clock: el("lines-clock")
  };

  function restart() {
    r = QLib.rng(seed); tie = QLib.rng(seed ^ 0x5bd1e995); T = 0;
    A = { free: [0, 0, 0], people: [] };     // separate lines: a random line (default) or the shortest
    B = { free: [0, 0, 0], people: [] };     // one shared line, next free till
    nextArr = r.exp(1 / lam);
    resetStats();
    advance(240);
    A.people.concat(B.people).forEach(function (p) { p.x = null; });
    snap = true;
  }
  function resetStats() {
    stat = { start: T, a: { n: 0, sum: 0, max: 0 }, b: { n: 0, sum: 0, max: 0 }, queued: 0, fastest: 0 };
    if (A) A.people.concat(B.people).forEach(function (p) { p.counted = true; });
  }
  function inLine(sys, j, t) {
    var n = 0;
    for (var i = sys.people.length - 1; i >= 0; i--) {
      var p = sys.people[i];
      if (p.k === j && p.dep > t) n++;
    }
    return n;
  }
  function arrive(t, s) {
    // separate lines: join the line with the fewest people (ties at random), never switch
    var best = [], bestN = Infinity;
    for (var j = 0; j < C; j++) {
      var n = inLine(A, j, t);
      if (n < bestN) { bestN = n; best = [j]; } else if (n === bestN) best.push(j);
    }
    var pick = tie.next();                   // drawn either way, so both modes see the same customers
    var k = smart ? best[Math.floor(pick * best.length)] : Math.floor(pick * C);
    var start = Math.max(t, A.free[k]);
    var others = Infinity, allBusy = true;
    for (j = 0; j < C; j++) {
      if (A.free[j] <= t) allBusy = false;
      if (j !== k) others = Math.min(others, Math.max(t, A.free[j]));
    }
    if (allBusy && t >= stat.start) {        // a real choice between three occupied lines
      stat.queued++;
      if (start <= others + 1e-9) stat.fastest++;
    }
    A.free[k] = start + s;
    A.people.push({ t: t, start: start, dep: start + s, k: k });
    // shared line: first come, first served by whichever till frees up first
    var m = 0;
    for (j = 1; j < C; j++) if (B.free[j] < B.free[m] - 1e-12) m = j;
    var startB = Math.max(t, B.free[m]);
    B.free[m] = startB + s;
    B.people.push({ t: t, start: startB, dep: startB + s, k: m });
  }
  function tally(sys, st) {
    for (var i = 0; i < sys.people.length; i++) {
      var p = sys.people[i];
      if (!p.counted && p.start <= T) {
        p.counted = true;
        if (p.t >= stat.start) { var w = p.start - p.t; st.n++; st.sum += w; if (w > st.max) st.max = w; }
      }
    }
    while (sys.people.length && sys.people[0].dep < T - 3 && sys.people[0].counted) sys.people.shift();
  }
  function advance(dT) {
    T += dT;
    while (nextArr <= T) { arrive(nextArr, r.exp(MEAN_S)); nextArr += r.exp(1 / lam); }
    tally(A, stat.a); tally(B, stat.b);
  }

  var lastDt = 0;
  restart();
  var view = Orrery.canvas(canvasEl, draw);

  function scene(ctx, c, sys, box, shared, title) {
    var rad = 5, gap = 13;
    var tillX = box.x + box.w - 34, ys = [], i;
    for (i = 0; i < C; i++) ys.push(box.y + box.h * (0.3 + 0.25 * i));
    ctx.fillStyle = c.ink2; ctx.font = "600 13px " + c.sans; ctx.textAlign = "left";
    ctx.fillText(title, box.x + 6, box.y + 16);
    ctx.font = "12px " + c.sans;
    for (i = 0; i < C; i++) QScene.till(ctx, tillX, ys[i], 11, c, sys.free[i] > T);
    var lineY = ys[1], headX = tillX - 44;
    var maxSlots = Math.floor((headX - box.x - 20) / gap);
    var counts = [0, 0, 0], hidden = [0, 0, 0];
    for (i = 0; i < sys.people.length; i++) {
      var p = sys.people[i], tx, ty, col = c.ink2, alpha = 1;
      if (p.t > T) continue;
      var slot = shared ? 0 : p.k, hide = false;
      if (p.start > T) {
        counts[slot]++;
        if (counts[slot] > maxSlots) { hidden[slot]++; hide = true; }
        tx = (shared ? headX : tillX - 22) - (counts[slot] - 1) * gap;
        ty = shared ? lineY : ys[p.k];
      } else if (p.dep > T) { tx = tillX; ty = ys[p.k]; col = c.verdigris; }
      else { tx = box.x + box.w - 4; ty = ys[p.k] - 10; col = c.ink3; alpha = Math.max(0, 1 - (T - p.dep) / 2); }
      if (p.x == null && !snap) { p.x = box.x + 8; p.y = lineY; }
      QScene.ease(p, tx, ty, lastDt, 8);
      if (hide) continue;
      ctx.globalAlpha = alpha; QScene.dot(ctx, p.x, p.y, rad, col); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = c.ink3;
    for (i = 0; i < C; i++) if (hidden[i]) ctx.fillText("+" + hidden[i], box.x + 4, (shared ? lineY : ys[i]) + 16);
  }

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var narrow = w < 560;
    var boxA = narrow ? { x: 0, y: 0, w: w, h: h / 2 - 4 } : { x: 0, y: 0, w: w / 2 - 10, h: h };
    var boxB = narrow ? { x: 0, y: h / 2 + 4, w: w, h: h / 2 - 4 } : { x: w / 2 + 10, y: 0, w: w / 2 - 10, h: h };
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.beginPath();
    if (narrow) { ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); } else { ctx.moveTo(w / 2, 8); ctx.lineTo(w / 2, h - 8); }
    ctx.stroke();
    scene(ctx, c, A, boxA, false, "Three separate lines");
    scene(ctx, c, B, boxB, true, "One shared line");
    snap = false;
  }

  function readouts() {
    var a = stat.a, b = stat.b;
    out.aAvg.textContent = a.n ? QScene.minutes(a.sum / a.n) : "—";
    out.bAvg.textContent = b.n ? QScene.minutes(b.sum / b.n) : "—";
    out.aMax.textContent = a.n ? QScene.minutes(a.max) : "—";
    out.bMax.textContent = b.n ? QScene.minutes(b.max) : "—";
    out.n.textContent = Orrery.fmt.number(b.n, 0);
    out.fastest.textContent = stat.queued ? Orrery.fmt.percent(stat.fastest / stat.queued, 0) +
      " of " + Orrery.fmt.number(stat.queued, 0) : "—";
    out.theory.textContent = QScene.minutes(QLib.mmcWq(C, lam, 1 / MEAN_S));
    out.clock.textContent = Orrery.fmt.number((T - stat.start) / 60, 1) + " h";
  }

  function step(dt) {
    lastDt = dt;
    advance(dt * (fast ? FAST : SPEED));
    view.redraw(); readouts();
  }

  var loop = Orrery.loop(canvasEl, step, { button: el("lines-play") });
  Orrery.bindRange(el("lines-rho"), el("lines-rho-out"), {
    format: function (v) { return Orrery.fmt.number(v, 0) + "% (" + Orrery.fmt.number(v * 0.6, 0) + " customers an hour)"; },
    onInput: function (v) { rho = v / 100; lam = C * rho / MEAN_S; nextArr = T + r.exp(1 / lam); resetStats(); view.redraw(); readouts(); }, init: false
  });
  fastBtn.addEventListener("click", function () {
    fast = !fast; fastBtn.setAttribute("aria-pressed", String(fast));
    if (fast && !loop.isPlaying()) loop.play();
  });
  el("lines-smart").addEventListener("change", function (e) {
    smart = e.target.checked; restart(); view.redraw(); readouts();
  });
  el("lines-new").addEventListener("click", function () {
    seed = (seed * 16807 + 12345) % 2147483647; restart(); view.redraw(); readouts();
  });
  readouts();
})();

/* ---- Figure 4: variability (Kingman) with an instant G/G/1 simulation ---- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("var-canvas");
  if (!canvasEl) return;
  var MEAN_S = 3, rho = 0.8, cs = 1, ca = 1, seed = 11, simW = 0, samples = [];
  function el(id) { return document.getElementById(id); }
  var out = { k: el("var-kingman"), sim: el("var-sim"), mm1: el("var-mm1") };

  // The 200,000-customer run takes a fraction of a second, so while a slider is being dragged
  // the sample strip and Kingman's value update at once and the simulation waits for a pause.
  var simTimer = 0;
  function runSim() {
    simTimer = 0;
    simW = QLib.simGG1({ seed: seed, n: 200000, rho: rho, ca: ca, cs: cs, meanS: MEAN_S });
    out.sim.textContent = QScene.minutes(simW);
    view.redraw();
  }
  function recompute(now) {
    var r = QLib.rng(seed + 1000);
    samples = [];
    for (var i = 0; i < 40; i++) samples.push(r.time(MEAN_S, cs));
    out.k.textContent = QScene.minutes(QLib.kingman(rho, ca, cs, MEAN_S));
    out.mm1.textContent = QScene.minutes(QLib.kingman(rho, 1, 1, MEAN_S));
    clearTimeout(simTimer);
    if (now) { runSim(); return; }
    simW = null; out.sim.textContent = "…";
    simTimer = setTimeout(runSim, 150);
    view.redraw();
  }

  var view = Orrery.canvas(canvasEl, function (ctx, w, h) {
    var c = Orrery.tokens();
    ctx.font = "12px " + c.sans;
    // strip: 40 service times as bars
    var sh = h * 0.28, sx0 = 44, sx1 = w - 12, bw = (sx1 - sx0) / samples.length;
    var smax = 12;                                   // minutes shown at full bar height
    ctx.fillStyle = c.ink2; ctx.textAlign = "left";
    ctx.fillText("40 service times (average 3 min)", sx0, 14);
    ctx.strokeStyle = c.rule; ctx.beginPath(); ctx.moveTo(sx0, sh); ctx.lineTo(sx1, sh); ctx.stroke();
    var meanY = sh - MEAN_S / smax * (sh - 22);
    for (var i = 0; i < samples.length; i++) {
      var bh = Math.min(samples[i], smax) / smax * (sh - 22);
      ctx.fillStyle = c.brassLit; ctx.fillRect(sx0 + i * bw + 1, sh - bh, Math.max(1, bw - 2), bh);
    }
    ctx.setLineDash([4, 3]); ctx.strokeStyle = c.ink2; ctx.beginPath(); ctx.moveTo(sx0, meanY); ctx.lineTo(sx1, meanY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = c.ink3; ctx.textAlign = "right"; ctx.fillText("3 min", sx0 - 4, meanY + 4);

    // chart: wait against utilisation
    var X0 = 44, X1 = w - 20, Y1 = sh + 30, Y0 = h - 36, YMAX = 60;
    function px(r) { return X0 + r * (X1 - X0); }
    function py(v) { return Y0 - Math.min(v, YMAX * 1.05) / YMAX * (Y0 - Y1); }
    ctx.strokeStyle = c.rule; ctx.fillStyle = c.ink3; ctx.textAlign = "right";
    for (var yv = 0; yv <= YMAX; yv += 15) {
      ctx.beginPath(); ctx.moveTo(X0, py(yv)); ctx.lineTo(X1, py(yv)); ctx.stroke();
      ctx.fillText(String(yv), X0 - 4, py(yv) + 4);
    }
    ctx.textAlign = "center";
    for (var xv = 0; xv <= 1.001; xv += 0.25) ctx.fillText(Math.round(xv * 100) + "%", px(xv), Y0 + 15);
    ctx.fillText("utilisation (average wait in minutes, up the side)", (X0 + X1) / 2, Y0 + 29);
    function curve(a, s, col, width, dash) {
      ctx.beginPath();
      for (var k = 0; k <= 200; k++) {
        var rr = k / 200 * 0.975, v = QLib.kingman(rr, a, s, MEAN_S);
        if (k === 0) ctx.moveTo(px(rr), py(v)); else ctx.lineTo(px(rr), py(v));
        if (v > YMAX * 1.05) break;
      }
      ctx.setLineDash(dash || []); ctx.strokeStyle = col; ctx.lineWidth = width; ctx.stroke(); ctx.setLineDash([]);
    }
    curve(1, 1, c.ink3, 1.2, [5, 4]);
    curve(ca, cs, c.brass, 2.5);
    ctx.setLineDash([3, 3]); ctx.strokeStyle = c.ink3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px(rho), Y0); ctx.lineTo(px(rho), Y1); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = "left";
    var legW = Math.max(ctx.measureText("solid: Kingman’s estimate for your settings").width,
      ctx.measureText("dashed: fully random (M/M/1)").width) + 10;
    ctx.globalAlpha = 0.88; ctx.fillStyle = c.paper;  // legend box, so the ρ line passes behind the text
    ctx.fillRect(X0 + 1, Y1 - 12, Math.min(legW, X1 - X0 - 1), 52);
    ctx.globalAlpha = 1; ctx.fillStyle = c.ink3;
    ctx.fillText("dashed: fully random (M/M/1)", X0 + 6, Y1 + 2);
    ctx.fillStyle = c.brass; ctx.fillText("solid: Kingman’s estimate for your settings", X0 + 6, Y1 + 18);
    ctx.fillStyle = c.verdigris; ctx.fillText("dot: simulated", X0 + 6, Y1 + 34);
    if (simW != null) QScene.dot(ctx, px(rho), py(simW), 6, c.verdigrisLit || c.verdigris, c.verdigris);
  });

  Orrery.bindRange(el("var-rho"), el("var-rho-out"), {
    format: function (v) { return Orrery.fmt.number(v, 0) + "%"; },
    onInput: function (v) { rho = v / 100; recompute(); }, init: false
  });
  Orrery.bindRange(el("var-cs"), el("var-cs-out"), {
    format: function (v) { return Orrery.fmt.number(v, 1) + (v === 0 ? " (clockwork)" : v === 1 ? " (random)" : ""); },
    onInput: function (v) { cs = v; recompute(); }, init: false
  });
  Orrery.bindRange(el("var-ca"), el("var-ca-out"), {
    format: function (v) { return Orrery.fmt.number(v, 1) + (v === 0 ? " (on the dot)" : v === 1 ? " (random)" : ""); },
    onInput: function (v) { ca = v; recompute(); }, init: false
  });
  el("var-new").addEventListener("click", function () { seed += 1; recompute(true); });
  rho = +el("var-rho").value / 100; cs = +el("var-cs").value; ca = +el("var-ca").value;
  recompute(true);
})();
