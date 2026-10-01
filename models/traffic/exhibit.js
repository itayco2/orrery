/* Exhibit: Where do traffic jams come from when nothing's wrong?
   Model in traffic-lib.js (window.Traffic). One IIFE per figure. */

var TRAFFIC_COLOURS = ["#c8322b", "#e07b2a", "#d9a83a", "#9cae45", "#4c9e6b", "#2a8a96"]; // speed 0..5

/* ---- Figure 1: the ring road ------------------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("ring-canvas");
  if (!canvasEl) return;
  var U = Traffic.units, L = 120, STEPS_PER_S = 5;
  var ring = new Traffic.Ring(L, 24, 0.2, 2026);
  var acc = 0, frac = 0, speedHist = [];
  var out = {
    dens: document.getElementById("ring-dens"), speed: document.getElementById("ring-speed"),
    flow: document.getElementById("ring-flow"), stopped: document.getElementById("ring-stopped")
  };

  var view = Orrery.canvas(canvasEl, draw);

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.40;
    if (R < 30) return;
    var lane = Math.max(10, R * 0.09);
    ctx.lineWidth = lane + 6; ctx.strokeStyle = c.paper3 || c.rule;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Orrery.TAU); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = c.rule;
    ctx.beginPath(); ctx.arc(cx, cy, R - lane / 2 - 3, 0, Orrery.TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R + lane / 2 + 3, 0, Orrery.TAU); ctx.stroke();
    var cellAng = Orrery.TAU / L;
    for (var i = 0; i < ring.pos.length; i++) {
      var from = ring.prev[i], v = ring.vel[i];
      var x = from + v * frac;                         // smooth motion between steps
      var a = -Math.PI / 2 - (x + 0.5) * cellAng;      // anticlockwise from the top
      ctx.save();
      ctx.translate(cx + R * Math.cos(a), cy + R * Math.sin(a));
      ctx.rotate(a - Math.PI / 2);
      var len = Math.max(3, R * cellAng * 0.85), wid = lane * 0.9;
      ctx.fillStyle = TRAFFIC_COLOURS[v];
      ctx.fillRect(-len / 2, -wid / 2, len, wid);
      ctx.restore();
    }
    ctx.fillStyle = c.ink3; ctx.font = (R < 130 ? "12px " : "13px ") + c.sans; ctx.textAlign = "center";
    ctx.fillText("900 m ring", cx, cy - 18);
    ctx.fillText(R < 160 ? "anticlockwise" : "traffic runs anticlockwise", cx, cy);
    ctx.fillText("t = " + ring.time + " s", cx, cy + 18);
  }

  function readouts() {
    var n = ring.pos.length;
    var mean = speedHist.length ? speedHist.reduce(function (a, b) { return a + b; }, 0) / speedHist.length : ring.meanSpeed();
    out.dens.textContent = Orrery.fmt.number(U.carsPerKm(n / L), 0) + " cars/km";
    out.speed.textContent = Orrery.fmt.number(mean * U.kmhPerCell, 0) + " km/h";
    out.flow.textContent = Orrery.fmt.number(Math.round(U.carsPerHour(n / L * mean) / 10) * 10, 0) + " cars/h";
    out.stopped.textContent = ring.stopped() + " of " + n;
  }
  function step() {
    ring.step();
    speedHist.push(ring.meanSpeed()); if (speedHist.length > 60) speedHist.shift();
  }
  var loop = Orrery.loop(canvasEl.closest("figure"), function (dt) {
    acc += dt * STEPS_PER_S;
    while (acc >= 1) { step(); acc -= 1; }
    frac = acc;
    view.redraw(); readouts();
  }, { button: document.getElementById("ring-play"), autoplay: true });

  Orrery.bindRange(document.getElementById("ring-n"), document.getElementById("ring-n-out"), {
    format: function (v) { return String(v); },
    onInput: function (v) { if (v !== ring.pos.length) { ring.setCount(v, false); speedHist = []; frac = 0; acc = 0; view.redraw(); readouts(); } }
  });
  Orrery.bindRange(document.getElementById("ring-p"), document.getElementById("ring-p-out"), {
    format: function (v) { return Orrery.fmt.number(v, 2); },
    onInput: function (v) { ring.p = v; }
  });
  document.getElementById("ring-reset").addEventListener("click", function () {
    ring.setCount(ring.pos.length, true); ring.time = 0; speedHist = []; frac = 0; acc = 0;
    view.redraw(); readouts();
  });
  // Start a few seconds in, so even the first frame shows cars moving off.
  for (var k = 0; k < (Orrery.reducedMotion() ? 60 : 8); k++) step();
  readouts();
})();

/* ---- Figure 2: space-time diagram ------------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("st-canvas");
  if (!canvasEl) return;
  var U = Traffic.units, L = 200, STEPS_PER_S = 8, MAXROWS = 400;
  var ring = new Traffic.Ring(L, 40, 0.2, 7);
  var rows = [];          // each: {pos: [], vel: [], track: cell of the tracked car or -1}
  var trackId = ring.id[0];
  var acc = 0;
  var out = { dens: document.getElementById("st-dens"), stopped: document.getElementById("st-stopped"), time: document.getElementById("st-time") };

  function record() {
    var t = -1, k = ring.id.indexOf(trackId);
    if (k < 0) { trackId = ring.id[0]; k = 0; }
    if (ring.pos.length) t = ring.pos[k];
    rows.push({ pos: ring.pos.slice(), vel: ring.vel.slice(), track: t, brake: ring._braked || -1 });
    ring._braked = -1;
    if (rows.length > MAXROWS) rows.shift();
  }
  function step() { ring.step(); record(); }
  // Begin with a couple of minutes already run, so the default view shows stripes.
  for (var k = 0; k < 150; k++) step();

  var view = Orrery.canvas(canvasEl, draw);
  var geom = { left: 0, cw: 1, rh: 3, top: 0, w: 1, h: 1 };

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var padL = 8, padR = 8, padT = 22, padB = 8;
    var cw = (w - padL - padR) / L, rh = Math.max(2, cw);
    var nrows = Math.max(0, Math.min(rows.length, Math.floor((h - padT - padB) / rh)));
    geom = { left: padL, cw: cw, rh: rh, top: padT, w: w, h: h };
    ctx.fillStyle = c.ink3; ctx.font = "12px " + c.sans; ctx.textAlign = "left";
    var narrow = w < 600;
    ctx.fillText(narrow ? "position →" : "position →  (direction of traffic, 1.5 km)", padL, 14);
    ctx.textAlign = "right"; ctx.fillText(narrow ? "time ↓" : "time ↓  (newest at the bottom)", w - padR, 14);
    var y0 = h - padB - nrows * rh;
    var dot = Math.max(1.5, cw * 0.9);
    for (var r = 0; r < nrows; r++) {
      var row = rows[rows.length - nrows + r], y = y0 + r * rh;
      for (var i = 0; i < row.pos.length; i++) {
        ctx.fillStyle = TRAFFIC_COLOURS[row.vel[i]];
        ctx.fillRect(padL + row.pos[i] * cw + (cw - dot) / 2, y, dot, rh);
      }
    }
    // the tracked car: a dark line, broken where it wraps round
    ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.beginPath();
    var last = null;
    for (r = 0; r < nrows; r++) {
      var rw = rows[rows.length - nrows + r];
      if (rw.track < 0) { last = null; continue; }
      var x = padL + (rw.track + 0.5) * cw, yy = y0 + (r + 0.5) * rh;
      if (last === null || rw.track < last) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      last = rw.track;
    }
    ctx.stroke();
    // brake markers
    for (r = 0; r < nrows; r++) {
      var b = rows[rows.length - nrows + r].brake;
      if (b >= 0) {
        ctx.beginPath(); ctx.arc(padL + (b + 0.5) * cw, y0 + (r + 0.5) * rh, 7, 0, Orrery.TAU);
        ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  }
  function readouts() {
    out.dens.textContent = Orrery.fmt.number(U.carsPerKm(ring.pos.length / L), 0) + " cars/km";
    out.stopped.textContent = ring.stopped() + " of " + ring.pos.length;
    out.time.textContent = Orrery.fmt.number(ring.time, 0) + " s";
  }
  function brakeAt(cell) {
    var i = ring.nearest(cell);
    if (i < 0) return;
    ring.brake(i, 2); ring._braked = ring.pos[i];
    if (!loop.isPlaying()) { step(); step(); view.redraw(); readouts(); }
  }

  var loop = Orrery.loop(canvasEl.closest("figure"), function (dt) {
    acc += dt * STEPS_PER_S;
    while (acc >= 1) { step(); acc -= 1; }
    view.redraw(); readouts();
  }, { button: document.getElementById("st-play"), autoplay: true });

  canvasEl.addEventListener("click", function (e) {
    var rect = canvasEl.getBoundingClientRect();
    var cell = Math.floor((e.clientX - rect.left - geom.left) / geom.cw);
    brakeAt(Orrery.clamp(cell, 0, L - 1));
  });
  document.getElementById("st-brake").addEventListener("click", function () {
    var i = Math.floor(ring.random() * ring.pos.length);
    if (ring.pos.length) brakeAt(ring.pos[i]);
  });
  Orrery.bindRange(document.getElementById("st-n"), document.getElementById("st-n-out"), {
    format: function (v) { return String(v); },
    onInput: function (v) { if (v !== ring.pos.length) { ring.setCount(v, false); view.redraw(); readouts(); } }
  });
  Orrery.bindRange(document.getElementById("st-p"), document.getElementById("st-p-out"), {
    format: function (v) { return Orrery.fmt.number(v, 2); },
    onInput: function (v) { ring.p = v; }
  });
  readouts();
})();

/* ---- Figure 3: the fundamental diagram -------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("fd-canvas");
  if (!canvasEl) return;
  var U = Traffic.units, RHO_MAX = 0.6, FLOW_MAX = 3200;   // axes: cells⁻¹ and cars/h
  var dens = []; for (var r = 0.01; r <= RHO_MAX + 1e-9; r += 0.01) dens.push(Math.round(r * 100) / 100);
  var p = 0.25, data = [], kmMark = 27;
  var out = { flow: document.getElementById("fd-flow"), speed: document.getElementById("fd-speed"),
              peak: document.getElementById("fd-peak"), crit: document.getElementById("fd-crit") };

  // Measure the curve a few densities per frame, so the page never stalls.
  var job = 0;
  function compute() {
    var my = ++job, k = 0, next = [];
    function chunk() {
      if (my !== job) return;
      var t0 = Date.now();
      while (k < dens.length && Date.now() - t0 < 12) {
        next.push(Traffic.fundamental(p, { L: 500, warm: 300, meas: 600, densities: [dens[k]] })[0]);
        k++;
      }
      data = next.slice();
      if (view) { view.redraw(); readouts(); }
      if (k < dens.length) requestAnimationFrame(chunk);
    }
    data = [];
    chunk();
  }
  var view = null;

  function done() { return data.length === dens.length; }
  function flowAt(rho) {      // linear interpolation of the measured curve (cars per step)
    if (rho <= data[0].rho) return data[0].flow * rho / data[0].rho;
    for (var i = 1; i < data.length; i++) {
      if (rho <= data[i].rho) {
        var a = data[i - 1], b = data[i], t = (rho - a.rho) / (b.rho - a.rho);
        return a.flow + t * (b.flow - a.flow);
      }
    }
    return data[data.length - 1].flow;
  }

  view = Orrery.canvas(canvasEl, draw);
  compute();
  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var padL = w < 500 ? 56 : 60, padR = 14, padT = 14, padB = 42;
    if (w < padL + 40 || h < padT + padB + 20) return;
    var X = function (rho) { return padL + (U.carsPerKm(rho) / U.carsPerKm(RHO_MAX)) * (w - padL - padR); };
    var Y = function (q) { return h - padB - (U.carsPerHour(q) / FLOW_MAX) * (h - padT - padB); };
    ctx.font = "12px " + c.sans; ctx.fillStyle = c.ink3; ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    // grid + ticks
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (var f = 0; f <= 3000; f += 1000) {
      var y = Y(f / 3600); ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(Orrery.fmt.number(f, 0), padL - 6, y);
    }
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (var k = 0; k <= 80; k += 20) {
      var x = padL + (k / U.carsPerKm(RHO_MAX)) * (w - padL - padR);
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke();
      ctx.fillText(String(k), x, h - padB + 5);
    }
    ctx.fillText("density (cars per km of lane)", padL + (w - padL - padR) / 2, h - 18);
    ctx.save(); ctx.translate(10, padT + (h - padT - padB) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "middle"; ctx.fillText("flow (cars per hour)", 0, 0); ctx.restore();
    // exact p = 0 line: min(5ρ, 1 − ρ)
    ctx.setLineDash([5, 4]); ctx.strokeStyle = c.ink3; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1 / 6), Y(5 / 6)); ctx.lineTo(X(RHO_MAX), Y(1 - RHO_MAX)); ctx.stroke();
    ctx.setLineDash([]);
    // measured points
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2; ctx.beginPath();
    data.forEach(function (d, i) { if (i) ctx.lineTo(X(d.rho), Y(d.flow)); else ctx.moveTo(X(d.rho), Y(d.flow)); });
    ctx.stroke();
    ctx.fillStyle = c.verdigris;
    data.forEach(function (d) { ctx.beginPath(); ctx.arc(X(d.rho), Y(d.flow), 2.5, 0, Orrery.TAU); ctx.fill(); });
    // label for dashed line
    ctx.fillStyle = c.ink3; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText("no dawdling (p = 0)", X(1 / 6) + 8, Y(5 / 6) + 2);
    // the chosen density
    if (!done()) return;
    var rho = kmMark * Traffic.CELL_M / 1000, q = flowAt(rho);
    ctx.strokeStyle = c.brass; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(X(rho), h - padB); ctx.lineTo(X(rho), Y(q)); ctx.lineTo(padL, Y(q)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(X(rho), Y(q), 7, 0, Orrery.TAU); ctx.lineWidth = 2.5; ctx.stroke();
  }
  function readouts() {
    if (!done()) {
      out.flow.textContent = out.speed.textContent = out.peak.textContent = out.crit.textContent = "measuring…";
      return;
    }
    var rho = kmMark * Traffic.CELL_M / 1000, q = flowAt(rho);
    var best = data.reduce(function (a, b) { return b.flow > a.flow ? b : a; });
    out.flow.textContent = Orrery.fmt.number(Math.round(U.carsPerHour(q) / 10) * 10, 0) + " cars/h";
    out.speed.textContent = Orrery.fmt.number(q / rho * U.kmhPerCell, 0) + " km/h";
    out.peak.textContent = Orrery.fmt.number(Math.round(U.carsPerHour(best.flow) / 10) * 10, 0) + " cars/h";
    out.crit.textContent = Orrery.fmt.number(U.carsPerKm(best.rho), 0) + " cars/km";
  }
  Orrery.bindRange(document.getElementById("fd-rho"), document.getElementById("fd-rho-out"), {
    format: function (v) { return v + " cars/km"; },
    onInput: function (v) { kmMark = v; view.redraw(); readouts(); }
  });
  Orrery.bindRange(document.getElementById("fd-p"), document.getElementById("fd-p-out"), {
    format: function (v) { return Orrery.fmt.number(v, 2); },
    onInput: function (v) {
      if (v === p) return;
      p = v;
      compute();
    }
  });
  readouts();
})();
