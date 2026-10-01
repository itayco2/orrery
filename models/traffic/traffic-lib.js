/* Nagel–Schreckenberg traffic model on a ring road (Nagel & Schreckenberg 1992).
   One cell = 7.5 m, one step = 1 s, top speed VMAX = 5 cells/step = 135 km/h.
   Classic script: defines window.Traffic. Used by exhibit.js and by the node checks. */
(function (root) {
  "use strict";
  var VMAX = 5, CELL_M = 7.5, STEP_S = 1;

  // Small seeded random generator (mulberry32) so runs are repeatable.
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

  // Cars are kept in ring order: car i+1 (mod n) is the car ahead of car i.
  function Ring(L, n, p, seed) {
    this.L = L; this.p = p; this.random = rng(seed || 1);
    this.pos = []; this.vel = []; this.prev = []; this.id = []; this.hold = [];
    this.nextId = 0; this.time = 0;
    this.setCount(n, true);
  }
  Ring.prototype.gap = function (i) {
    var n = this.pos.length;
    if (n === 1) return this.L - 1;
    var ahead = this.pos[(i + 1) % n];
    return ((ahead - this.pos[i] - 1) % this.L + this.L) % this.L;
  };
  // Place n cars evenly, all at rest (fresh start), or add/remove cars keeping the rest.
  Ring.prototype.setCount = function (n, fresh) {
    n = Math.max(0, Math.min(this.L, Math.round(n)));
    var i;
    if (fresh) {
      this.pos = []; this.vel = []; this.id = []; this.hold = [];
      for (i = 0; i < n; i++) {
        this.pos.push(Math.floor(i * this.L / n)); this.vel.push(0);
        this.id.push(this.nextId++); this.hold.push(0);
      }
    } else {
      while (this.pos.length > n) {          // remove a random car
        var k = Math.floor(this.random() * this.pos.length);
        this.pos.splice(k, 1); this.vel.splice(k, 1); this.id.splice(k, 1); this.hold.splice(k, 1);
      }
      while (this.pos.length < n) {          // add a car, at rest, in the middle of the biggest gap
        var best = -1, bestGap = -1;
        for (i = 0; i < this.pos.length; i++) { var g = this.gap(i); if (g > bestGap) { bestGap = g; best = i; } }
        if (best < 0) { this.pos.push(0); this.vel.push(0); this.id.push(this.nextId++); this.hold.push(0); continue; }
        if (bestGap < 1) break;
        var at = (this.pos[best] + 1 + Math.floor(bestGap / 2)) % this.L;
        this.pos.splice(best + 1, 0, at); this.vel.splice(best + 1, 0, 0);
        this.id.splice(best + 1, 0, this.nextId++); this.hold.splice(best + 1, 0, 0);
      }
    }
    this.prev = this.pos.slice();
  };
  // One time step: the four rules, applied to every car at once.
  Ring.prototype.step = function () {
    var n = this.pos.length, L = this.L, i, v, newV = new Array(n);
    for (i = 0; i < n; i++) {
      v = Math.min(this.vel[i] + 1, VMAX);               // 1. accelerate
      v = Math.min(v, this.gap(i));                      // 2. brake to the gap
      if (v > 0 && this.random() < this.p) v -= 1;       // 3. dawdle with probability p
      if (this.hold[i] > 0) { v = 0; this.hold[i]--; }   // (a reader-ordered stop)
      newV[i] = v;
    }
    this.prev = this.pos.slice();
    for (i = 0; i < n; i++) {                            // 4. move
      this.vel[i] = newV[i];
      this.pos[i] = (this.pos[i] + newV[i]) % L;
    }
    this.time++;
  };
  Ring.prototype.brake = function (i, steps) { if (i >= 0 && i < this.hold.length) this.hold[i] = steps || 1; };
  Ring.prototype.meanSpeed = function () {               // cells per step
    var s = 0, n = this.vel.length; for (var i = 0; i < n; i++) s += this.vel[i];
    return n ? s / n : 0;
  };
  Ring.prototype.stopped = function () {
    var c = 0; for (var i = 0; i < this.vel.length; i++) if (this.vel[i] === 0) c++; return c;
  };
  Ring.prototype.nearest = function (cell) {             // index of the car nearest a cell
    var best = -1, bd = Infinity;
    for (var i = 0; i < this.pos.length; i++) {
      var d = Math.abs(this.pos[i] - cell); d = Math.min(d, this.L - d);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  // Flow (cars per step passing a point) against density (cars per cell), measured.
  // Flow on a ring = density × mean speed, averaged over `meas` steps after `warm` steps.
  function fundamental(p, opts) {
    opts = opts || {};
    var L = opts.L || 400, warm = opts.warm || 300, meas = opts.meas || 400;
    var out = [], dens = opts.densities;
    if (!dens) { dens = []; for (var r = 0.01; r < 0.905; r += 0.01) dens.push(Math.round(r * 100) / 100); }
    for (var k = 0; k < dens.length; k++) {
      var n = Math.max(1, Math.round(dens[k] * L));
      var ring = new Ring(L, n, p, 1000 + k);
      for (var t = 0; t < warm; t++) ring.step();
      var sum = 0;
      for (t = 0; t < meas; t++) { ring.step(); sum += ring.meanSpeed(); }
      out.push({ rho: n / L, flow: (n / L) * sum / meas });
    }
    return out;
  }

  var units = {
    kmhPerCell: CELL_M / STEP_S * 3.6,                   // 27 km/h per cell/step
    carsPerKm: function (rho) { return rho * 1000 / CELL_M; },
    carsPerHour: function (flow) { return flow * 3600 / STEP_S; }
  };

  var api = { VMAX: VMAX, CELL_M: CELL_M, STEP_S: STEP_S, Ring: Ring, fundamental: fundamental, units: units, rng: rng };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Traffic = api;
})(this);
