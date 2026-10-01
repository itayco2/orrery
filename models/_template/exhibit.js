/* Exhibit script for the template: "Why does a turning wheel make a wave?"
   Pattern to copy: one IIFE per figure, each finding its own elements by id
   and using the shared kit (window.Orrery, from ../../assets/orrery.js). */

/* ---- Figure 1: a turning wheel and the wave its height traces ------------
   Uses Orrery.canvas (HiDPI + resize), Orrery.loop (play/pause, pauses off
   screen, respects reduced motion), Orrery.bindRange, Orrery.fmt, tokens. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("wheel-canvas");
  if (!canvasEl) return;
  var TAU = Orrery.TAU;
  var WINDOW = 6;                 // seconds of history shown in the trace
  var speed = 0.25;               // turns per second
  var angle = 0;                  // radians
  var clock = 0;                  // seconds of model time
  var samples = [];               // [time, angle] pairs, oldest first
  var showTrace = true;
  var outAngle = document.getElementById("wheel-angle");
  var outHeight = document.getElementById("wheel-height");
  var outPeriod = document.getElementById("wheel-period");
  var outYear = document.getElementById("wheel-year");
  var YEAR = 365.25 * 24 * 3600;  // seconds in a (Julian) year

  // Start with a few seconds of history so the default view already shows a wave.
  for (var t = -WINDOW; t <= 0; t += 1 / 30) samples.push([t, TAU * speed * t]);

  var view = Orrery.canvas(canvasEl, draw);

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var R = h * 0.36, cx = R + Math.max(16, h * 0.12), cy = h / 2;
    var x0 = cx + R + Math.max(20, w * 0.04), x1 = w - 16;
    var pxPerSec = (x1 - x0) / WINDOW;

    // axis of the trace
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(x1, cy); ctx.stroke();

    // the wheel
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.strokeStyle = c.ink3; ctx.lineWidth = 1.5; ctx.stroke();
    for (var k = 0; k < 6; k++) {         // spokes, so you can see it turn
      var a = angle + k * TAU / 6;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(a), cy - R * Math.sin(a));
      ctx.strokeStyle = c.rule; ctx.stroke();
    }
    var px = cx + R * Math.cos(angle), py = cy - R * Math.sin(angle);

    // the trace: newest sample at x0, older ones further right
    if (showTrace && samples.length > 1) {
      ctx.beginPath();
      for (var i = samples.length - 1; i >= 0; i--) {
        var x = x0 + (clock - samples[i][0]) * pxPerSec;
        var y = cy - R * Math.sin(samples[i][1]);
        if (i === samples.length - 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        if (x > x1) break;
      }
      ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2; ctx.stroke();
    }

    // a level line from the dot to the start of the trace
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x0, py);
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath(); ctx.arc(x0, py, 3.5, 0, TAU); ctx.fillStyle = c.verdigris; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fillStyle = c.ink3; ctx.fill();
    ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fillStyle = c.brassLit; ctx.fill();
    ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.fillStyle = c.ink3;
    ctx.font = "12px " + c.sans;
    ctx.textAlign = "right";
    ctx.fillText("now", x0 + 26, h - 10);
    ctx.fillText(WINDOW + " s ago", x1, h - 10);

    var deg = ((angle * 180 / Math.PI) % 360 + 360) % 360;
    outAngle.textContent = Orrery.fmt.number(deg, 0) + "°";
    outHeight.textContent = Orrery.fmt.number(Math.sin(angle), 2);
  }

  function step(dt) {
    clock += dt;
    angle += TAU * speed * dt;
    samples.push([clock, angle]);
    while (samples.length > 2 && clock - samples[1][0] > WINDOW + 1) samples.shift();
    view.redraw();
  }

  Orrery.loop(canvasEl, step, { button: document.getElementById("wheel-play") });

  Orrery.bindRange(document.getElementById("wheel-speed"), document.getElementById("wheel-speed-out"), {
    format: function (v) { return Orrery.fmt.number(v, 2) + " turns/s"; },
    onInput: function (v) {
      speed = v;
      outPeriod.textContent = Orrery.fmt.number(1 / v, 1) + " s";
      outYear.textContent = Orrery.fmt.sci(v * YEAR, 1);     // e.g. "7.9 × 10⁶"
      view.redraw();
    }
  });

  document.getElementById("wheel-trace").addEventListener("change", function (e) {
    showTrace = e.target.checked;
    view.redraw();
  });
})();

/* ---- Figure 2: drag a point around a circle ------------------------------
   Uses Orrery.drag (pointer + keyboard nudging) on an SVG with role="slider". */
(function () {
  "use strict";
  var svgEl = document.getElementById("circle-svg");
  if (!svgEl) return;
  var NS = "http://www.w3.org/2000/svg";
  var theta = 40;                                  // degrees
  function make(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    svgEl.appendChild(e);
    return e;
  }
  make("line", { x1: -1.25, y1: 0, x2: 1.25, y2: 0, stroke: "var(--rule)", "stroke-width": 0.012 });
  make("line", { x1: 0, y1: -1.25, x2: 0, y2: 1.25, stroke: "var(--rule)", "stroke-width": 0.012 });
  make("circle", { r: 1, fill: "none", stroke: "var(--ink-3)", "stroke-width": 0.015 });
  var arc = make("path", { fill: "none", stroke: "var(--brass)", "stroke-width": 0.015 });
  var radius = make("line", { x1: 0, y1: 0, stroke: "var(--ink-2)", "stroke-width": 0.015 });
  var sinLine = make("line", { stroke: "var(--verdigris)", "stroke-width": 0.02, "stroke-dasharray": "0.05 0.04" });
  var cosLine = make("line", { stroke: "var(--brass)", "stroke-width": 0.02, "stroke-dasharray": "0.05 0.04" });
  var dot = make("circle", { r: 0.075, fill: "var(--brass-lit)", stroke: "var(--brass)", "stroke-width": 0.015 });
  var outA = document.getElementById("circle-angle");
  var outC = document.getElementById("circle-cos");
  var outS = document.getElementById("circle-sin");
  var unit = "deg";                                // radio group: "deg" or "rad"
  Array.prototype.forEach.call(document.querySelectorAll('input[name="circle-unit"]'), function (r) {
    r.addEventListener("change", function () { if (r.checked) { unit = r.value; render(); } });
  });

  function render() {
    var r = theta * Math.PI / 180, x = Math.cos(r), y = -Math.sin(r);
    dot.setAttribute("cx", x); dot.setAttribute("cy", y);
    radius.setAttribute("x2", x); radius.setAttribute("y2", y);
    sinLine.setAttribute("x1", x); sinLine.setAttribute("y1", 0); sinLine.setAttribute("x2", x); sinLine.setAttribute("y2", y);
    cosLine.setAttribute("x1", 0); cosLine.setAttribute("y1", y); cosLine.setAttribute("x2", x); cosLine.setAttribute("y2", y);
    var ar = 0.25, large = theta > 180 ? 1 : 0;
    arc.setAttribute("d", "M " + ar + " 0 A " + ar + " " + ar + " 0 " + large + " 0 " +
      (ar * Math.cos(r)) + " " + (-ar * Math.sin(r)));
    outA.textContent = unit === "rad" ? Orrery.fmt.number(r, 2) + " rad" : Orrery.fmt.number(theta, 0) + "°";
    outC.textContent = Orrery.fmt.number(Math.cos(r), 2);
    outS.textContent = Orrery.fmt.number(Math.sin(r), 2);
    svgEl.setAttribute("aria-valuenow", Math.round(theta));
    svgEl.setAttribute("aria-valuetext", Math.round(theta) + " degrees; cosine " +
      Orrery.fmt.number(Math.cos(r), 2) + ", sine " + Orrery.fmt.number(Math.sin(r), 2));
  }

  function setFromPointer(p) {
    var b = svgEl.getBoundingClientRect();
    var a = Math.atan2(-(p.y - b.height / 2), p.x - b.width / 2) * 180 / Math.PI;
    theta = Math.round((a + 360) % 360);
    render();
  }

  Orrery.drag(svgEl, {
    onStart: setFromPointer,
    onMove: setFromPointer,
    onNudge: function (dx, dy) {                 // right/up = anticlockwise
      theta = ((theta + (dx || -dy)) % 360 + 360) % 360;
      render();
    }
  });
  render();
})();
