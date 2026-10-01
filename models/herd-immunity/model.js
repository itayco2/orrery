/* Herd immunity: the numerical model, kept free of any drawing so it can be
   checked on its own.
   Sets window.HerdModel (or module.exports under node, for the checks). */
(function (root) {
  "use strict";

  // Small seeded random number generator (mulberry32): same seed, same outbreak.
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

  // Poisson-distributed count with the given mean (Knuth's method; fine for means ≤ 30).
  function poisson(mean, r) {
    var L = Math.exp(-mean), k = 0, p = 1;
    do { k++; p *= r(); } while (p > L);
    return k - 1;
  }

  /* A branching process. Each case meets Poisson(R0) people; each of them is
     immune with probability `immune`, otherwise becomes a new case.
     Returns generations of nodes {parent, immune}; generation 0 is the first case.
     Stops growing a generation beyond `cap` nodes (only the drawing is affected). */
  function chains(R0, immune, seed, gens, cap) {
    var r = rng(seed), out = [[{ parent: -1, immune: false }]];
    var counts = [{ cases: 1, immune: 0 }];
    for (var g = 1; g <= gens; g++) {
      var prev = out[g - 1], cur = [], c = 0, im = 0;
      for (var i = 0; i < prev.length; i++) {
        if (prev[i].immune) continue;
        var k = poisson(R0, r);
        for (var j = 0; j < k; j++) {
          var isImmune = r() < immune;
          if (isImmune) im++; else c++;
          if (cur.length < cap) cur.push({ parent: i, immune: isImmune });
        }
      }
      out.push(cur);
      counts.push({ cases: c, immune: im, truncated: c + im > cur.length });
    }
    return { gens: out, counts: counts };
  }

  /* Chance that the chain started by one case eventually dies out, when each
     case causes Poisson(Re) new cases: the smallest root of q = exp(−Re(1 − q)). */
  function extinction(Re) {
    if (Re <= 1) return 1;
    var q = 0;
    for (var i = 0; i < 2000; i++) {
      var nq = Math.exp(-Re * (1 - q));
      if (Math.abs(nq - q) < 1e-13) { q = nq; break; }
      q = nq;
    }
    return q;
  }

  /* SIR with a vaccinated (fully immune) share v, as fractions of the population.
     dS/dt = −β S I, dI/dt = β S I − γ I, dR/dt = γ I, with β = R0·γ.
     Classic RK4 with a fixed step dt (days). Returns sampled arrays and summary. */
  function sir(R0, v, opts) {
    opts = opts || {};
    var gamma = 1 / (opts.infectiousDays || 7);
    var beta = R0 * gamma;
    var dt = opts.dt || 0.05;
    var i0 = opts.i0 || 1e-4;
    var tMax = opts.tMax || 2000;
    var S = Math.max(0, 1 - v - i0), I = i0, R = 0, t = 0;
    var ts = [0], Ss = [S], Is = [I], Rs = [R];
    var peakI = I, peakT = 0, peakS = S;
    var every = Math.max(1, Math.round(0.5 / dt)), n = 0;
    function f(s, i) { var inf = beta * s * i; return [-inf, inf - gamma * i]; }
    while (t < tMax) {
      var k1 = f(S, I);
      var k2 = f(S + dt / 2 * k1[0], I + dt / 2 * k1[1]);
      var k3 = f(S + dt / 2 * k2[0], I + dt / 2 * k2[1]);
      var k4 = f(S + dt * k3[0], I + dt * k3[1]);
      var dS = dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      var dI = dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      var Sp = S, dIp = beta * S * I - gamma * I;
      S += dS; I += dI; R -= dS + dI; t += dt; n++;
      if (I > peakI) peakI = I;
      // The peak is where dI/dt changes sign: interpolate within the step.
      var dIn = beta * S * I - gamma * I;
      if (dIp > 0 && dIn <= 0) {
        var frac = dIp / (dIp - dIn);
        peakT = t - dt + frac * dt; peakS = Sp + frac * (S - Sp);
      }
      if (n % every === 0) { ts.push(t); Ss.push(S); Is.push(I); Rs.push(R); }
      if (I < i0 * 0.01 && t > peakT) break;
    }
    return { t: ts, S: Ss, I: Is, R: Rs, peakI: peakI, peakT: peakT, peakS: peakS,
             finalS: S, everInfected: 1 - v - S, end: t, S0: 1 - v - i0 };
  }

  /* Final size: the share a of the whole population ever infected, when a share
     s0 starts susceptible (the rest immune) and the first cases are negligibly few:
     a = s0·(1 − e^(−R0·a)). Bisection on the non-zero root. With s0 = 1 this is
     z = 1 − e^(−R0·z). */
  function finalSize(R0, s0) {
    if (s0 === undefined) s0 = 1;
    if (R0 * s0 <= 1) return 0;
    var lo = 1e-12, hi = s0;
    for (var i = 0; i < 200; i++) {
      var mid = (lo + hi) / 2;
      var g = s0 * (1 - Math.exp(-R0 * mid)) - mid;
      if (g > 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function threshold(R0) { return R0 <= 1 ? 0 : 1 - 1 / R0; }

  var api = { rng: rng, poisson: poisson, chains: chains, extinction: extinction,
              sir: sir, finalSize: finalSize, threshold: threshold };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HerdModel = api;
})(this);
