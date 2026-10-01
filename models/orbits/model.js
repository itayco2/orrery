/* Orbits exhibit: the physics, with no drawing. Sets window.OrbitModel.
   Units are whatever the caller uses consistently (km and s for the Earth,
   AU and years for the Sun, dimensionless for Figure 3).

   Force law: acceleration = −mu · r^(−n) along r̂  (n = 2 is Newton's gravity,
   n = −1 is a spring). Integrator: velocity Verlet (kick–drift–kick). The step
   is a fixed fraction of the local dynamical time, r^((n+1)/2)/√mu, so it
   shrinks automatically near close approach. */
window.OrbitModel = (function () {
  "use strict";
  var TAU = 2 * Math.PI;

  function accel(x, y, mu, n) {
    var r2 = x * x + y * y, r = Math.sqrt(r2);
    var f = -mu * Math.pow(r, -n - 1);
    return [f * x, f * y];
  }
  function potential(r, mu, n) {
    if (Math.abs(n - 1) < 1e-9) return mu * Math.log(r);
    return -mu * Math.pow(r, 1 - n) / (n - 1);
  }
  function energy(s, mu, n) {
    var r = Math.hypot(s[0], s[1]);
    return 0.5 * (s[2] * s[2] + s[3] * s[3]) + potential(r, mu, n);
  }

  /* integrate({x, y, vx, vy, mu, n, frac, tMax, rMin, rMax, maxSteps})
     -> { pts: [[x, y, t], …], end: "time" | "inner" | "outer" | "steps",
          t, E0, E1, L0, L1, peri: [unwrapped angles of successive closest approaches] } */
  function integrate(o) {
    var mu = o.mu, n = o.n === undefined ? 2 : o.n, frac = o.frac || 0.002;
    var x = o.x, y = o.y, vx = o.vx, vy = o.vy, t = 0;
    var maxSteps = o.maxSteps || 200000;
    var a = accel(x, y, mu, n);
    var pts = [[x, y, 0]], end = "steps", peri = [], periR = [];
    var E0 = energy([x, y, vx, vy], mu, n), L0 = x * vy - y * vx;
    var theta = Math.atan2(y, x), thetaPrev = theta, rBefore = Infinity, sinceRec = 0, recEvery = o.recEvery || 1;
    for (var i = 0; i < maxSteps; i++) {
      var r = Math.hypot(x, y);
      var dt = frac * Math.pow(r, (n + 1) / 2) / Math.sqrt(mu);
      if (o.dtMax && dt > o.dtMax) dt = o.dtMax;
      if (o.tMax && t + dt > o.tMax) dt = o.tMax - t;
      vx += 0.5 * dt * a[0]; vy += 0.5 * dt * a[1];
      var x1 = x + dt * vx, y1 = y + dt * vy;
      a = accel(x1, y1, mu, n);
      vx += 0.5 * dt * a[0]; vy += 0.5 * dt * a[1];
      t += dt;
      var r1 = Math.hypot(x1, y1);
      if (o.rMin && r1 < o.rMin) {           // hit the ground: interpolate to the surface
        var f = (r - o.rMin) / Math.max(1e-12, r - r1);
        x = x + f * (x1 - x); y = y + f * (y1 - y); t = t - dt + f * dt;
        pts.push([x, y, t]); end = "inner"; break;
      }
      // a local minimum of r (one step back) marks a closest approach
      theta += Math.atan2(x * y1 - y * x1, x * x1 + y * y1);   // unwrapped angle swept
      if (r < rBefore && r <= r1) { peri.push(thetaPrev); periR.push(r); }
      thetaPrev = theta;
      rBefore = r;
      x = x1; y = y1;
      if (++sinceRec >= recEvery) { pts.push([x, y, t]); sinceRec = 0; }
      if (o.rMax && r1 > o.rMax) { pts.push([x, y, t]); end = "outer"; break; }
      if (o.tMax && t >= o.tMax - 1e-12) { pts.push([x, y, t]); end = "time"; break; }
    }
    return { pts: pts, end: end, t: t, E0: E0, E1: energy([x, y, vx, vy], mu, n),
             L0: L0, L1: x * vy - y * vx, peri: peri, periR: periR };
  }

  /* Conic elements from a position and velocity under inverse-square gravity. */
  function elements(x, y, vx, vy, mu) {
    var r = Math.hypot(x, y), v2 = vx * vx + vy * vy, rv = x * vx + y * vy;
    var h = x * vy - y * vx;
    var ex = ((v2 - mu / r) * x - rv * vx) / mu, ey = ((v2 - mu / r) * y - rv * vy) / mu;
    var e = Math.hypot(ex, ey), E = v2 / 2 - mu / r;
    var el = { h: h, e: e, ex: ex, ey: ey, energy: E, p: h * h / mu, w: Math.atan2(ey, ex),
               bound: E < 0 };
    el.rp = el.p / (1 + e);
    if (E < 0) {
      el.a = -mu / (2 * E);
      el.ra = el.a * (1 + e);
      el.T = TAU * Math.sqrt(el.a * el.a * el.a / mu);
    }
    return el;
  }

  /* Position at time t after periapsis on a bound orbit (Kepler's equation). */
  function positionAt(el, t) {
    var M = TAU * t / el.T, e = el.e;
    M = ((M % TAU) + TAU) % TAU;
    var E = e < 0.8 ? M : Math.PI;
    for (var k = 0; k < 50; k++) {
      var d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= d;
      if (Math.abs(d) < 1e-13) break;
    }
    var nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    var r = el.a * (1 - e * Math.cos(E));
    var ang = el.w + (el.h >= 0 ? nu : -nu);
    return [r * Math.cos(ang), r * Math.sin(ang)];
  }
  /* Time since periapsis of a point at angle `ang` on a bound orbit. */
  function timeOfAngle(el, ang) {
    var nu = (ang - el.w) * (el.h >= 0 ? 1 : -1), e = el.e;
    var E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
    var M = E - e * Math.sin(E);
    return ((M / TAU) % 1 + 1) % 1 * el.T;
  }

  return { TAU: TAU, integrate: integrate, elements: elements, positionAt: positionAt,
           timeOfAngle: timeOfAngle, energy: energy,
           EARTH: { mu: 398600.4418, R: 6371.0 },          // km³/s², km (NASA Earth fact sheet)
           SUN: { mu: 4 * Math.PI * Math.PI },             // AU³/yr² (so 1 AU ↔ 1 year)
           KMS_PER_AU_YR: 149597870.7 / (365.25 * 86400) }; // 1 AU/yr = 4.74 km/s
})();
