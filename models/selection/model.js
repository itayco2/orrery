/* Haploid Wright–Fisher model with selection, shared by the figures.
   Sets window.SelModel (classic script; also loadable in node for checks). */
(function (root) {
  "use strict";

  // Small, fast seeded random number generator (mulberry32).
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normal(r) {
    var u = 1 - r(), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Binomial(n, p): exact inversion when the expected count of the rarer outcome
  // is small (where getting it right matters most), normal approximation otherwise.
  function binomial(n, p, r) {
    if (p <= 0) return 0;
    if (p >= 1) return n;
    var flip = p > 0.5, q = flip ? 1 - p : p;
    var k;
    if (n * q < 25) {
      // inversion: walk up the cumulative distribution
      var u = r(), f = Math.pow(1 - q, n), c = f, ratio = q / (1 - q);
      k = 0;
      while (u > c && k < n) { f *= ratio * (n - k) / (k + 1); k++; c += f; }
    } else {
      k = Math.round(n * q + Math.sqrt(n * q * (1 - q)) * normal(r));
      if (k < 0) k = 0; if (k > n) k = n;
    }
    return flip ? n - k : k;
  }

  // One generation: selection changes the expected share, then N offspring are drawn.
  function nextCount(count, N, s, r) {
    var p = count / N;
    var pSel = p * (1 + s) / (1 + p * s);
    return binomial(N, pSel, r);
  }

  // Diffusion approximation (Kimura 1962), haploid, starting from one copy.
  function pFix(N, s) {
    if (Math.abs(N * s) < 1e-9) return 1 / N;
    var num = -Math.expm1(-2 * s), den = -Math.expm1(-2 * N * s);
    if (!isFinite(den)) {        // very harmful: e^(-2Ns) overflows; use the log form
      return Math.exp(Math.log(Math.abs(num)) + 2 * N * s);
    }
    return num / den;
  }

  // Run one population from one copy until the variant is lost (0) or fixed (N).
  // If keep is true, returns the whole trajectory of counts.
  function runOne(N, s, r, keep, maxGen) {
    var c = 1, g = 0, traj = keep ? [1] : null;
    maxGen = maxGen || 1e7;
    while (c > 0 && c < N && g < maxGen) {
      c = nextCount(c, N, s, r); g++;
      if (keep) traj.push(c);
    }
    return { fixed: c === N, gens: g, traj: traj };
  }

  root.SelModel = { rng: rng, binomial: binomial, nextCount: nextCount, pFix: pFix, runOne: runOne };
})(typeof window !== "undefined" ? window : globalThis);
