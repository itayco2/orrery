/* Double pendulum model for the "chaos" exhibit. Classic script; sets window.DP.
   Point masses on rigid massless rods, no friction. State s = [θ1, θ2, ω1, ω2]
   (angles from the downward vertical, radians; angular velocities rad/s).
   Equations of motion as in myPhysicsLab (E. Neumann), integrated with RK4. */
(function (root) {
  "use strict";
  var P = { L1: 1, L2: 1, m1: 1, m2: 1, g: 9.81 };   // metres, kilograms, m/s²

  function deriv(s, out) {
    var t1 = s[0], t2 = s[1], w1 = s[2], w2 = s[3];
    var L1 = P.L1, L2 = P.L2, m1 = P.m1, m2 = P.m2, g = P.g;
    var d = t1 - t2, sd = Math.sin(d), cd = Math.cos(d);
    var den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
    out[0] = w1;
    out[1] = w2;
    out[2] = (-g * (2 * m1 + m2) * Math.sin(t1) - m2 * g * Math.sin(t1 - 2 * t2) -
              2 * sd * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * cd)) / (L1 * den);
    out[3] = (2 * sd * (w1 * w1 * L1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1) +
              w2 * w2 * L2 * m2 * cd)) / (L2 * den);
  }

  var k1 = [0, 0, 0, 0], k2 = [0, 0, 0, 0], k3 = [0, 0, 0, 0], k4 = [0, 0, 0, 0], tmp = [0, 0, 0, 0];
  // One classical Runge–Kutta step of size h, in place.
  function rk4(s, h) {
    var i;
    deriv(s, k1);
    for (i = 0; i < 4; i++) tmp[i] = s[i] + 0.5 * h * k1[i];
    deriv(tmp, k2);
    for (i = 0; i < 4; i++) tmp[i] = s[i] + 0.5 * h * k2[i];
    deriv(tmp, k3);
    for (i = 0; i < 4; i++) tmp[i] = s[i] + h * k3[i];
    deriv(tmp, k4);
    for (i = 0; i < 4; i++) s[i] += h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }

  // Total energy in joules, zero with both rods hanging straight down.
  function energy(s) {
    var t1 = s[0], t2 = s[1], w1 = s[2], w2 = s[3];
    var L1 = P.L1, L2 = P.L2, m1 = P.m1, m2 = P.m2, g = P.g;
    var V = -(m1 + m2) * g * L1 * Math.cos(t1) - m2 * g * L2 * Math.cos(t2) + (m1 + m2) * g * L1 + m2 * g * L2;
    var T = 0.5 * m1 * L1 * L1 * w1 * w1 +
            0.5 * m2 * (L1 * L1 * w1 * w1 + L2 * L2 * w2 * w2 + 2 * L1 * L2 * w1 * w2 * Math.cos(t1 - t2));
    return T + V;
  }

  function wrap(a) {             // angle difference into (−π, π]
    a = a % (2 * Math.PI);
    if (a > Math.PI) a -= 2 * Math.PI;
    if (a <= -Math.PI) a += 2 * Math.PI;
    return a;
  }

  // How far apart two pendulums are: distance between their angle pairs, radians.
  function separation(a, b) {
    var d1 = wrap(a[0] - b[0]), d2 = wrap(a[1] - b[1]);
    return Math.sqrt(d1 * d1 + d2 * d2);
  }

  // Run a pendulum and a twin whose upper rod starts delta radians further round,
  // for T seconds at step dt. Returns the separation sampled every `every` seconds
  // and the first time it exceeds `tol` (null if it never does).
  // twinJob does the same work resumably: job.advance(n) integrates up to n more
  // samples and returns true when the run is complete; job.filled counts samples so far.
  function twinJob(start, delta, T, dt, every, tol) {
    var a = start.slice(), b = start.slice();
    b[0] += delta;
    var n = Math.round(T / every), per = Math.round(every / dt);
    var job = { sep: new Float64Array(n + 1), horizon: null, every: every, filled: 1, done: false };
    job.sep[0] = separation(a, b);
    job.advance = function (count) {
      var stop = Math.min(n, job.filled - 1 + count);
      for (var i = job.filled; i <= stop; i++) {
        for (var j = 0; j < per; j++) {
          rk4(a, dt); rk4(b, dt);
          if (job.horizon === null && separation(a, b) > tol) job.horizon = ((i - 1) * per + j + 1) * dt;
        }
        job.sep[i] = separation(a, b);
      }
      job.filled = stop + 1;
      job.done = job.filled > n;
      return job.done;
    };
    return job;
  }

  function twinRun(start, delta, T, dt, every, tol) {
    var job = twinJob(start, delta, T, dt, every, tol);
    job.advance(Infinity);
    return { sep: job.sep, horizon: job.horizon, every: job.every };
  }

  root.DP = { twinRun: twinRun, twinJob: twinJob, P: P, deriv: deriv, rk4: rk4, energy: energy, wrap: wrap, separation: separation, DT: 0.001 };
})(typeof window !== "undefined" ? window : globalThis);
