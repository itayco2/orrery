/* Exhibit script: "Why doesn't the Moon fall down?"
   One IIFE per figure. Physics in model.js (window.OrbitModel). */

/* ---- Figure 1: Newton's cannon ------------------------------------------
   Real Earth: GM = 398,600 km³/s², R = 6,371 km. The cannon sits on a
   mountain of adjustable height (to scale; at least 1 km), fires horizontally (east, to the right). No air. Each shot is integrated
   in full when fired, then the ball is animated along it. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("cannon-canvas");
  if (!canvasEl || !window.OrbitModel) return;
  var M = window.OrbitModel, TAU = Orrery.TAU, E = M.EARTH;
  var h0 = 1000, R0 = E.R + h0;              // mountain height and launch radius, km
  var shot = null, old = [], progress = 1, loopObj = null;
  var zoom = [R0, R0], zoomTarget = [R0, R0];   // [extent below the centre, half-width] in km
  var outFall = document.getElementById("cannon-fall"), outDrop = document.getElementById("cannon-drop"),
      outResult = document.getElementById("cannon-result"), outTime = document.getElementById("cannon-time");

  function fire(v) {
    if (shot && shot.v !== v && shot.pts.length > 2) {
      old.push(shot);
      if (old.length > 7) old.shift();
    }
    var el = M.elements(0, R0, v, 0, E.mu);
    var o = { x: 0, y: R0, vx: v, vy: 0, mu: E.mu, n: 2, frac: 0.003, rMin: E.R, rMax: 40 * E.R,
              maxSteps: 60000, recEvery: 2 };
    if (el.bound) o.tMax = el.T;
    shot = v < 0.01 ? { v: v, pts: [[0, R0, 0]], end: "inner", t: 0, el: el } : M.integrate(o);
    shot.v = v; shot.el = el;
    var ext, wid;
    if (shot.end === "inner") { ext = R0; wid = R0; }
    else if (el.bound) { ext = Math.min(el.ra, 4 * E.R); wid = Math.max(R0, Math.min(el.a * Math.sqrt(1 - el.e * el.e), 4 * E.R)); }
    else { ext = 4 * E.R; wid = 3.5 * E.R; }
    zoomTarget = [ext, wid];
    var anim = loopObj && loopObj.isPlaying();
    if (!anim) zoom = zoomTarget.slice();
    progress = anim ? 0 : 1;
    describe();
    view.redraw();
  }

  function describe() {
    var v = shot.v, el = shot.el;
    var g = E.mu / (R0 * R0) * 1000;                       // m/s²
    outFall.textContent = Orrery.fmt.number(g / 2, 1) + " m";
    outDrop.textContent = Orrery.fmt.number(v * v * 1000 / (2 * R0), 1) + " m";   // (v·1 s)²/2R, R = distance from the centre
    var last = shot.pts[shot.pts.length - 1];
    if (shot.end === "inner") {
      var ang = Math.atan2(last[0], last[1]);              // angle round from the cannon
      if (ang < 0) ang += TAU;
      outResult.textContent = "Lands " + Orrery.fmt.number(ang * E.R, 0) + " km away";
      outTime.textContent = shot.t < 120 ? Orrery.fmt.number(shot.t, 0) + " s" : Orrery.fmt.number(shot.t / 60, 0) + " min";
    } else if (el.bound) {
      outResult.textContent = "Orbits; highest point " + Orrery.fmt.number(el.ra - E.R, 0) + " km up";
      outTime.textContent = (el.T < 3 * 3600 ? Orrery.fmt.number(el.T / 60, 0) + " min" :
        Orrery.fmt.number(el.T / 3600, 1) + " h") + " per lap";
    } else {
      outResult.textContent = "Escapes; never comes back";
      outTime.textContent = "—";
    }
    canvasEl.setAttribute("aria-label", "Newton's cannon on the Earth, firing at " +
      Orrery.fmt.number(v, 2) + " km/s. " + outResult.textContent + ".");
  }

  var view = Orrery.canvas(canvasEl, function draw(ctx, w, h) {
    if (!shot) return;
    var c = Orrery.tokens();
    // Zoom so the current path fits: whole Earth for short hops, out to 4 Earth radii for long ellipses.
    if (w < 80 || h < 80) return;
    var sv = Math.min((h - 34) / (R0 + zoom[0]), (w / 2 - 12) / zoom[1]);
    var Rpx = E.R * sv, s = sv;
    var cx = w / 2, cy = (h - 22 - (R0 + zoom[0]) * sv) / 2 + R0 * sv;
    function X(x) { return cx + x * s; }
    function Y(y) { return cy - y * s; }

    // Earth
    ctx.beginPath(); ctx.arc(cx, cy, Rpx, 0, TAU);
    ctx.fillStyle = c.paper3; ctx.fill(); ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = c.ink3; ctx.font = "12px " + c.sans; ctx.textAlign = "center";
    ctx.fillText("Earth", cx, cy + 4);

    function path(p, upto, color, width, alpha) {
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
      for (var i = 0; i < p.pts.length; i++) {
        var q = p.pts[i];
        if (q[2] > upto) break;
        if (i === 0) ctx.moveTo(X(q[0]), Y(q[1])); else ctx.lineTo(X(q[0]), Y(q[1]));
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (var k = 0; k < old.length; k++) path(old[k], Infinity, c.ink3, 1.2, 0.35);
    var tNow = progress * shot.t;
    path(shot, tNow, c.brass, 2.2, 1);

    // ball position at tNow (interpolate)
    var pts = shot.pts, bx = pts[0][0], by = pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      if (pts[i][2] >= tNow) {
        var f = (tNow - pts[i - 1][2]) / Math.max(1e-9, pts[i][2] - pts[i - 1][2]);
        bx = Orrery.lerp(pts[i - 1][0], pts[i][0], f); by = Orrery.lerp(pts[i - 1][1], pts[i][1], f);
        break;
      }
      bx = pts[i][0]; by = pts[i][1];
    }

    // mountain and cannon (drawn, not to scale)
    var mx = cx, my = Y(R0), mh = Math.max(2, (R0 - E.R) * s);
    ctx.beginPath(); ctx.moveTo(mx - mh * 1.6 - 4, cy - Rpx + 2); ctx.lineTo(mx, my); ctx.lineTo(mx + mh * 1.6 + 4, cy - Rpx + 2);
    ctx.closePath(); ctx.fillStyle = c.ink3; ctx.fill();
    ctx.fillStyle = c.ink2; ctx.fillRect(mx - 3, my - 4, 12, 4);

    ctx.beginPath(); ctx.arc(X(bx), Y(by), 5, 0, TAU);
    ctx.fillStyle = c.brassLit; ctx.fill(); ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.fillStyle = c.ink3; ctx.textAlign = "left"; ctx.font = "12px " + c.sans;
    ctx.fillText("Earth, mountain and paths to scale", 10, h - 10);
  });

  function step(dt) {
    if (!shot) return;
    var dz = Math.abs(zoom[0] - zoomTarget[0]) + Math.abs(zoom[1] - zoomTarget[1]);
    if (dz > 1) {
      var f = 1 - Math.exp(-dt * 4);
      zoom[0] += (zoomTarget[0] - zoom[0]) * f; zoom[1] += (zoomTarget[1] - zoom[1]) * f;
      if (progress >= 1) view.redraw();
    }
    if (progress >= 1) return;
    var dur = shot.end === "outer" ? 5 : Math.min(6, Math.max(1.2, 1 + shot.t / 1500));
    progress = Math.min(1, progress + dt / dur);
    view.redraw();
  }
  loopObj = Orrery.loop(canvasEl, step, { button: document.getElementById("cannon-play"),
    labels: { play: "Play", pause: "Pause" },
    onChange: function (p) { if (!p) { progress = 1; zoom = zoomTarget.slice(); view.redraw(); } } });

  var speed = Orrery.bindRange(document.getElementById("cannon-speed"), document.getElementById("cannon-speed-out"), {
    format: function (v) { return Orrery.fmt.number(v, 2) + " km/s"; },
    onInput: function (v) { fire(v); }
  });
  function vc() { return Math.round(Math.sqrt(E.mu / R0) * 100) / 100; }
  function ve() { return Math.round(Math.sqrt(2 * E.mu / R0) * 100) / 100; }
  var circBtn = document.getElementById("cannon-circ"), escBtn = document.getElementById("cannon-esc");
  circBtn.addEventListener("click", function () { speed.set(vc()); });
  escBtn.addEventListener("click", function () { speed.set(ve()); });
  Orrery.bindRange(document.getElementById("cannon-h"), document.getElementById("cannon-h-out"), {
    format: function (v) { return Orrery.fmt.number(v, 0) + " km"; },
    onInput: function (v) {
      h0 = v; R0 = E.R + Math.max(1, v); old = [];
      circBtn.textContent = "Circular speed (" + Orrery.fmt.number(vc(), 2) + " km/s)";
      escBtn.textContent = "Escape speed (" + Orrery.fmt.number(ve(), 2) + " km/s)";
      if (shot) { shot = null; fire(speed.value()); }
    }
  });
  document.getElementById("cannon-clear").addEventListener("click", function () { old = []; view.redraw(); });
  // Default view: a few earlier shots already traced.
  [4, 5.5, 6.3, 6.6].forEach(function (v) { fire(v); });
  fire(speed.value());
})();

/* ---- Figure 2: launch a planet -------------------------------------------
   Sun at the origin, GM = 4π² AU³/yr². The planet starts 1 AU to the right
   of the Sun; the reader drags the tip of its velocity arrow. The orbit is
   the exact conic; equal-time slices come from Kepler's equation. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("planet-canvas");
  if (!canvasEl || !window.OrbitModel) return;
  var M = window.OrbitModel, TAU = Orrery.TAU, mu = M.SUN.mu, KMS = M.KMS_PER_AU_YR;
  var VC = TAU;                                  // circular speed at 1 AU, AU/yr
  var vx = -1.2, vy = 5.2, el = null, t = 0, L = null, dragging = false;
  var NSLICE = 12;
  var out = { v: document.getElementById("planet-v"), e: document.getElementById("planet-e"),
    T: document.getElementById("planet-T"), rp: document.getElementById("planet-rp"),
    ra: document.getElementById("planet-ra") };

  function update() {
    el = M.elements(1, 0, vx, vy, mu);
    t = el.bound ? M.timeOfAngle(el, 0) : 0;
    var sp = Math.hypot(vx, vy);
    out.v.textContent = Orrery.fmt.number(sp * KMS, 1) + " km/s";
    out.e.textContent = Orrery.fmt.number(el.e, 2);
    if (el.bound && el.rp > 0.01) {
      out.T.textContent = Orrery.fmt.number(el.T, el.T < 10 ? 2 : 1) + " years";
      out.rp.textContent = Orrery.fmt.number(el.rp, 2) + " AU";
      out.ra.textContent = Orrery.fmt.number(el.ra, 2) + " AU";
    } else if (el.bound) {
      out.T.textContent = "—"; out.rp.textContent = "hits the Sun"; out.ra.textContent = "—";
    } else {
      out.T.textContent = "never returns"; out.rp.textContent = Orrery.fmt.number(vx > 0 ? 1 : el.rp, 2) + " AU";   // moving outward: the closest point was the launch
      out.ra.textContent = "∞ (escapes)";
    }
    var dir = Math.round(Math.atan2(vy, vx) * 180 / Math.PI);
    canvasEl.setAttribute("aria-valuenow", Orrery.fmt.number(sp * KMS, 1));
    canvasEl.setAttribute("aria-valuetext", "Launch speed " + out.v.textContent + ", direction " + dir +
      " degrees; eccentricity " + out.e.textContent + ", period " + out.T.textContent);
    view.redraw();
  }

  function layout(w, h) {
    var s = Math.min(h * 0.34, w * 0.25);
    return { s: s, sx: w * 0.56, sy: h * 0.5, k: Math.min(w, h) * 0.035 };   // k: px per AU/yr of arrow
  }
  function scr(x, y) { return [L.sx + x * L.s, L.sy - y * L.s]; }

  var view = Orrery.canvas(canvasEl, function draw(ctx, w, h) {
    if (!el) return;
    var c = Orrery.tokens();
    L = layout(w, h);
    var sun = scr(0, 0);

    if (el.bound && el.rp > 0.01) {
      // equal-time slices, alternately shaded
      for (var k = 0; k < NSLICE; k++) {
        ctx.beginPath(); ctx.moveTo(sun[0], sun[1]);
        for (var j = 0; j <= 24; j++) {
          var p = M.positionAt(el, el.T * (k + j / 24) / NSLICE), q = scr(p[0], p[1]);
          ctx.lineTo(q[0], q[1]);
        }
        ctx.closePath();
        ctx.fillStyle = k % 2 ? c.paper3 : c.verdigrisLit;
        ctx.globalAlpha = k % 2 ? 0.9 : 0.28; ctx.fill(); ctx.globalAlpha = 1;
      }
      // the ellipse
      ctx.beginPath();
      for (var i = 0; i <= 240; i++) {
        var pp = M.positionAt(el, el.T * i / 240), qq = scr(pp[0], pp[1]);
        if (i === 0) ctx.moveTo(qq[0], qq[1]); else ctx.lineTo(qq[0], qq[1]);
      }
      ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.5; ctx.stroke();
      // the empty focus, and the major axis
      var a = el.a, ux = Math.cos(el.w), uy = Math.sin(el.w);
      var f2 = scr(-2 * a * el.e * ux, -2 * a * el.e * uy);
      var pe = scr(el.rp * ux, el.rp * uy), ap = scr(-el.ra * ux, -el.ra * uy);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pe[0], pe[1]); ctx.lineTo(ap[0], ap[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(f2[0], f2[1], 4, 0, TAU); ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = c.ink3; ctx.font = "12px " + c.sans; ctx.textAlign = "center";
      if (2 * a * el.e * L.s > 60) ctx.fillText("empty focus", f2[0], f2[1] + 18);
    } else {
      // unbound (or straight into the Sun): integrate the path outwards
      var res = M.integrate({ x: 1, y: 0, vx: vx, vy: vy, mu: mu, n: 2, frac: 0.004, rMin: 0.01,
                              rMax: 12, maxSteps: 20000 });
      ctx.beginPath();
      for (var m = 0; m < res.pts.length; m++) {
        var r2 = scr(res.pts[m][0], res.pts[m][1]);
        if (m === 0) ctx.moveTo(r2[0], r2[1]); else ctx.lineTo(r2[0], r2[1]);
      }
      ctx.strokeStyle = c.alarm; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // the Sun
    ctx.beginPath(); ctx.arc(sun[0], sun[1], 8, 0, TAU); ctx.fillStyle = c.brassLit; ctx.fill();
    ctx.fillStyle = c.ink3; ctx.font = "12px " + c.sans; ctx.textAlign = "center";
    ctx.fillText("Sun", sun[0], sun[1] - 14);

    // the launch point and the velocity arrow
    var p0 = scr(1, 0), tip = [p0[0] + vx * L.k, p0[1] - vy * L.k];
    ctx.strokeStyle = c.brass; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
    var ang = Math.atan2(tip[1] - p0[1], tip[0] - p0[0]);
    ctx.beginPath(); ctx.moveTo(tip[0], tip[1]);
    ctx.lineTo(tip[0] - 10 * Math.cos(ang - 0.4), tip[1] - 10 * Math.sin(ang - 0.4));
    ctx.lineTo(tip[0] - 10 * Math.cos(ang + 0.4), tip[1] - 10 * Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fillStyle = c.brass; ctx.fill();
    ctx.beginPath(); ctx.arc(tip[0], tip[1], dragging ? 11 : 9, 0, TAU);
    ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();

    // the moving planet
    var pl = el.bound && el.rp > 0.01 ? M.positionAt(el, t) : [1, 0], pq = scr(pl[0], pl[1]);
    ctx.beginPath(); ctx.arc(pq[0], pq[1], 6, 0, TAU); ctx.fillStyle = c.verdigris; ctx.fill();
    ctx.fillStyle = c.ink3; ctx.textAlign = "left";
    ctx.fillText("Drag the arrow tip", 10, h - 10);
  });

  Orrery.loop(canvasEl, function (dt) {
    if (!el || !el.bound || el.rp <= 0.01) return;
    t += dt * el.T / 6;                     // every orbit takes 6 s on screen
    view.redraw();
  }, { button: document.getElementById("planet-play"), labels: { play: "Play", pause: "Pause" } });

  function setV(nx, ny) {
    var sp = Math.hypot(nx, ny), max = 2 * VC;
    if (sp > max) { nx *= max / sp; ny *= max / sp; }
    vx = nx; vy = ny; update();
  }
  Orrery.drag(canvasEl, {
    hitTest: function (p) {
      if (!L) return false;
      var p0 = scr(1, 0), tip = [p0[0] + vx * L.k, p0[1] - vy * L.k];
      return Math.hypot(p.x - tip[0], p.y - tip[1]) < 28;
    },
    onStart: function () { dragging = true; view.redraw(); },
    onMove: function (p) { var p0 = scr(1, 0); setV((p.x - p0[0]) / L.k, -(p.y - p0[1]) / L.k); },
    onEnd: function () { dragging = false; view.redraw(); },
    onNudge: function (dx, dy) { setV(vx + dx * 0.05, vy - dy * 0.05); }
  });
  document.getElementById("planet-circ").addEventListener("click", function () { setV(0, VC); });
  document.getElementById("planet-reset").addEventListener("click", function () { setV(-1.2, 5.2); });
  update();
})();

/* ---- Figure 3: what if gravity were different? ---------------------------
   Force ∝ 1/rⁿ, scaled so the circular speed at r = 1 is 1 for every n.
   The planet starts at r = 1 moving sideways at a chosen fraction of that. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("law-canvas");
  if (!canvasEl || !window.OrbitModel) return;
  var M = window.OrbitModel, TAU = Orrery.TAU;
  var n = 2.5, v0 = 0.8, spring = false, res = null, tNow = 0, scale = 1, steps = 0;
  var outAps = document.getElementById("law-aps"), outShift = document.getElementById("law-shift"),
      outLaw = document.getElementById("law-name");
  var springBtn = document.getElementById("law-spring");

  function compute() {
    var nn = spring ? -1 : n;
    res = M.integrate({ x: 1, y: 0, vx: 0, vy: v0, mu: 1, n: nn, frac: 0.004, tMax: 90,
                        rMin: 0.02, rMax: 30, maxSteps: 80000, recEvery: 3 });
    var rmax = 1;
    for (var i = 0; i < res.pts.length; i++) rmax = Math.max(rmax, Math.hypot(res.pts[i][0], res.pts[i][1]));
    scale = Math.min(rmax, 6);
    tNow = 0;
    outLaw.textContent = spring ? "spring: force ∝ r" : "force ∝ 1/r" + (Math.abs(n - 2) < 1e-9 ? "²" : "^" + Orrery.fmt.number(n, 2));
    if (res.end === "inner") {
      outAps.textContent = "—"; outShift.textContent = "spirals into the centre";
    } else if (res.end === "outer") {
      outAps.textContent = "—"; outShift.textContent = "flies away";
    } else if (res.peri.length >= 2) {
      var d = (res.peri[1] - res.peri[0]) * 180 / Math.PI;
      outAps.textContent = Orrery.fmt.number(d, 1) + "°";
      var shift = d - (spring ? 180 : 360);
      outShift.textContent = Math.abs(shift) < 0.5 ? "none: the orbit closes" :
        (shift > 0 ? "moves on " : "falls back ") + Orrery.fmt.number(Math.abs(shift), 0) + "° per lap";
    } else {
      outAps.textContent = "—"; outShift.textContent = "—";
    }
    canvasEl.setAttribute("aria-label", "Orbit under a " + outLaw.textContent + ". Change between closest approaches: " +
      outShift.textContent + ".");
    view.redraw();
  }

  var view = Orrery.canvas(canvasEl, function draw(ctx, w, h) {
    if (!res) return;
    var c = Orrery.tokens();
    var s = Math.min(w, h) * 0.45 / scale, cx = w / 2, cy = h / 2;
    var pts = res.pts;
    // full path, faint
    ctx.strokeStyle = c.ink3; ctx.globalAlpha = 0.45; ctx.lineWidth = 1; ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var X = cx + pts[i][0] * s, Y = cy - pts[i][1] * s;
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
    // recent trail and the planet
    var tEnd = Math.min(tNow, res.t), lo = tEnd - 7, bx = pts[0][0], by = pts[0][1];
    ctx.strokeStyle = c.brass; ctx.lineWidth = 2.2; ctx.beginPath();
    var started = false;
    for (var j = 0; j < pts.length && pts[j][2] <= tEnd; j++) {
      if (pts[j][2] < lo) continue;
      var X2 = cx + pts[j][0] * s, Y2 = cy - pts[j][1] * s;
      if (!started) { ctx.moveTo(X2, Y2); started = true; } else ctx.lineTo(X2, Y2);
      bx = pts[j][0]; by = pts[j][1];
    }
    ctx.stroke();
    // closest approaches so far
    ctx.fillStyle = c.alarm;
    for (var k = 0; k < res.peri.length && k < 60; k++) {
      var a = res.peri[k], rp = res.periR[k];
      ctx.beginPath(); ctx.arc(cx + rp * Math.cos(a) * s, cy - rp * Math.sin(a) * s, 3, 0, TAU); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU); ctx.fillStyle = c.brassLit; ctx.fill();
    ctx.beginPath(); ctx.arc(cx + bx * s, cy - by * s, 5.5, 0, TAU); ctx.fillStyle = c.verdigris; ctx.fill();
    ctx.fillStyle = c.ink3; ctx.font = "12px " + c.sans; ctx.textAlign = "left";
    ctx.fillText("red dots: closest approaches", 10, h - 10);
  });

  Orrery.loop(canvasEl, function (dt) {
    if (!res) return;
    tNow += dt * 6;                                 // ~1 circular orbit per second
    if (tNow > res.t + 6) tNow = 0;
    view.redraw();
  }, { button: document.getElementById("law-play"), labels: { play: "Play", pause: "Pause" },
       onChange: function (p) { if (!p && res) { tNow = res.t; view.redraw(); } } });

  var law = Orrery.bindRange(document.getElementById("law-n"), document.getElementById("law-n-out"), {
    format: function (v) { return "n = " + Orrery.fmt.number(v, 2) + (Math.abs(v - 2) < 1e-9 ? " (Newton)" : ""); },
    onInput: function (v) { n = v; spring = false; springBtn.setAttribute("aria-pressed", "false"); if (res) compute(); }
  });
  Orrery.bindRange(document.getElementById("law-v"), document.getElementById("law-v-out"), {
    format: function (v) { return Orrery.fmt.percent(v, 0); },
    onInput: function (v) { v0 = v; if (res) compute(); }
  });
  document.getElementById("law-newton").addEventListener("click", function () { law.set(2); n = 2; spring = false; springBtn.setAttribute("aria-pressed", "false"); compute(); });
  springBtn.addEventListener("click", function () {
    spring = !spring; springBtn.setAttribute("aria-pressed", String(spring)); compute();
  });
  compute();
  tNow = res.t;
})();

/* ---- Figure 4: Kepler's third law with the real planets -------------------
   Distances and periods from NASA's planetary fact sheet. The line is
   T = a^1.5 (years, AU), i.e. T = 2π√(a³/GM) with the Sun's GM. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("kepler-canvas");
  if (!canvasEl) return;
  var TAU = Orrery.TAU, AU = 149.6, YR = 365.25;
  var PLANETS = [["Mercury", 57.9, 88.0], ["Venus", 108.2, 224.7], ["Earth", 149.6, 365.2], ["Mars", 228.0, 687.0],
    ["Jupiter", 778.5, 4331], ["Saturn", 1432.0, 10747], ["Uranus", 2867.0, 30589], ["Neptune", 4515.0, 59800]];
  var aUser = 2.77, logAxes = true;
  var outT = document.getElementById("kepler-T"), outA3 = document.getElementById("kepler-a3"),
      outT2 = document.getElementById("kepler-T2");

  var view = Orrery.canvas(canvasEl, function draw(ctx, w, h) {
    if (w < 80 || h < 80) return;
    var c = Orrery.tokens();
    var x0 = 48, x1 = w - 14, y0 = h - 34, y1 = 12;
    var aMin = 0.2, aMax = 40, tMin = 0.08, tMax = 300;
    function X(a) { return logAxes ? x0 + (x1 - x0) * Math.log(a / aMin) / Math.log(aMax / aMin) : x0 + (x1 - x0) * a / aMax; }
    function Y(t) { return logAxes ? y0 - (y0 - y1) * Math.log(t / tMin) / Math.log(tMax / tMin) : y0 - (y0 - y1) * t / tMax; }
    ctx.font = "11px " + c.sans; ctx.fillStyle = c.ink3; ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    // grid
    var ax = logAxes ? [0.2, 0.5, 1, 2, 5, 10, 20, 40] : [0, 10, 20, 30, 40];
    var ty = logAxes ? [0.1, 0.3, 1, 3, 10, 30, 100, 300] : [0, 50, 100, 150, 200, 250, 300];
    ctx.textAlign = "center";
    ax.forEach(function (a) { var x = X(Math.max(a, 1e-9)); ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); ctx.fillText(String(a), x, y0 + 14); });
    ctx.textAlign = "right";
    ty.forEach(function (t) { var y = Y(Math.max(t, 1e-9)); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillText(String(t), x0 - 5, y + 4); });
    ctx.textAlign = "center"; ctx.fillText("distance from the Sun, AU", (x0 + x1) / 2, h - 6);
    ctx.save(); ctx.translate(12, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("period, years", 0, 0); ctx.restore();
    // the law
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y1, x1 - x0, y0 - y1); ctx.clip();
    ctx.beginPath();
    for (var i = 0; i <= 200; i++) {
      var a = logAxes ? aMin * Math.pow(aMax / aMin, i / 200) : aMax * i / 200;
      var px = X(Math.max(a, 1e-9)), py = Y(Math.max(Math.pow(a, 1.5), 1e-9));
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = c.brass; ctx.lineWidth = 1.8; ctx.stroke();
    // the planets
    ctx.font = "12px " + c.sans; ctx.textAlign = "left";
    PLANETS.forEach(function (p, k) {
      var a = p[1] / AU, t = p[2] / YR, px = X(a), py = Y(t);
      ctx.beginPath(); ctx.arc(px, py, 4.5, 0, TAU); ctx.fillStyle = c.verdigris; ctx.fill();
      if (logAxes || k >= 4) {
        ctx.fillStyle = c.ink2; ctx.textAlign = k >= 6 ? "right" : "left";
        ctx.fillText(p[0], px + (k >= 6 ? -8 : 8), py + (logAxes ? 12 : 4));
      }
    });
    // the reader's planet
    var tu = Math.pow(aUser, 1.5), ux = X(aUser), uy = Y(tu);
    ctx.setLineDash([3, 3]); ctx.strokeStyle = c.ink3;
    ctx.beginPath(); ctx.moveTo(ux, y0); ctx.lineTo(ux, uy); ctx.lineTo(x0, uy); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(ux, uy, 6, 0, TAU); ctx.fillStyle = c.brassLit; ctx.fill();
    ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  });

  function update() {
    var t = Math.pow(aUser, 1.5);
    outT.textContent = Orrery.fmt.number(t, t < 10 ? 2 : 1) + " years";
    var a3 = aUser * aUser * aUser, dp = a3 < 100 ? 2 : 0;
    outA3.textContent = Orrery.fmt.number(a3, dp);
    outT2.textContent = Orrery.fmt.number(t * t, dp);
    canvasEl.setAttribute("aria-label", "Orbital period against distance from the Sun for the eight planets, " +
      (logAxes ? "on logarithmic axes, where they fall on a straight line" : "on ordinary axes, where they fall on a rising curve") +
      ". A planet at " + Orrery.fmt.number(aUser, 2) + " AU would take " + outT.textContent + ".");
    view.redraw();
  }
  Orrery.bindRange(document.getElementById("kepler-a"), document.getElementById("kepler-a-out"), {
    format: function (v) { return Orrery.fmt.number(Math.pow(10, v), Math.pow(10, v) < 10 ? 2 : 1) + " AU"; },
    onInput: function (v) { aUser = Math.pow(10, v); update(); }
  });
  document.getElementById("kepler-log").addEventListener("change", function (e) { logAxes = e.target.checked; update(); });
})();
