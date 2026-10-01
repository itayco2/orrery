/* queues-lib.js — random numbers, queueing formulas and small simulators for
   the "queues" exhibit. Classic script: defines window.QLib (and module.exports
   under node, so the checks in company/work/queues/ can run the same code). */
(function (root) {
  "use strict";

  // Seeded PRNG (mulberry32): same seed, same customers.
  function rng(seed) {
    var a = seed >>> 0;
    function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    // exponential with the given mean
    function exp(mean) { return -mean * Math.log(1 - next()); }
    function normal() {
      var u = 1 - next(), v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    // gamma(shape k, scale 1), Marsaglia & Tsang (2000)
    function gamma1(k) {
      if (k < 1) return gamma1(k + 1) * Math.pow(1 - next(), 1 / k);
      var d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
      for (;;) {
        var x, v;
        do { x = normal(); v = 1 + c * x; } while (v <= 0);
        v = v * v * v;
        var u = 1 - next();
        if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
      }
    }
    // a positive random time with the given mean and coefficient of variation
    // (CV = standard deviation / mean). CV 0 = clockwork, CV 1 = exponential.
    function time(mean, cv) {
      if (cv < 1e-6) return mean;
      if (Math.abs(cv - 1) < 1e-9) return exp(mean);
      var k = 1 / (cv * cv);
      return gamma1(k) * mean / k;
    }
    return { next: next, exp: exp, time: time };
  }

  // M/M/1: average wait in line (not counting service), same time unit as 1/mu.
  function mm1Wq(lambda, mu) {
    if (lambda >= mu) return Infinity;
    return (lambda / mu) / (mu - lambda);
  }

  // Erlang C: probability an arrival has to wait, c servers, offered load a = lambda/mu.
  function erlangC(c, a) {
    var rho = a / c;
    if (rho >= 1) return 1;
    var term = 1, sum = 1;                    // a^0/0!
    for (var k = 1; k < c; k++) { term *= a / k; sum += term; }
    var top = term * a / c / (1 - rho);       // a^c / c! / (1 - rho)
    return top / (sum + top);
  }
  function mmcWq(c, lambda, mu) {
    if (lambda >= c * mu) return Infinity;
    return erlangC(c, lambda / mu) / (c * mu - lambda);
  }

  // Kingman (1961): G/G/1 wait in line ≈ rho/(1-rho) · (ca² + cs²)/2 · E[S]
  function kingman(rho, ca, cs, meanS) {
    if (rho >= 1) return Infinity;
    return rho / (1 - rho) * (ca * ca + cs * cs) / 2 * meanS;
  }

  // G/G/1 by Lindley's recursion: W(n+1) = max(0, W(n) + S(n) − A(n+1)).
  // Returns the mean wait in line over n customers, after a warm-up.
  function simGG1(opts) {
    var r = rng(opts.seed), n = opts.n, warm = opts.warm || Math.floor(n / 10);
    var meanS = opts.meanS, meanA = meanS / opts.rho;
    var w = 0, sum = 0, count = 0;
    for (var i = 0; i < n + warm; i++) {
      var s = r.time(meanS, opts.cs), a = r.time(meanA, opts.ca);
      if (i >= warm) { sum += w; count++; }
      w = Math.max(0, w + s - a);
    }
    return sum / count;
  }

  var QLib = { rng: rng, mm1Wq: mm1Wq, erlangC: erlangC, mmcWq: mmcWq, kingman: kingman, simGG1: simGG1 };
  root.QLib = QLib;
  if (typeof module !== "undefined" && module.exports) module.exports = QLib;
})(typeof window !== "undefined" ? window : this);
