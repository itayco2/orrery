/* Exhibit script: "Why do two people in 23 probably share a birthday?"
   One IIFE per figure, using the shared kit (window.Orrery). */

/* ---- Shared helpers ------------------------------------------------------ */
var Bday = (function () {
  "use strict";
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];   // 29 February ignored

  // Day of year 0..364 -> "14 March"
  function dateName(day) {
    for (var m = 0; m < 12; m++) {
      if (day < LENGTHS[m]) return (day + 1) + " " + MONTHS[m];
      day -= LENGTHS[m];
    }
    return "?";
  }

  // P(at least one shared value) for n draws from d equally likely values.
  // Exact product for d up to 10^6 (summing log1p for stability), otherwise
  // 1 − exp(−n(n−1)/2d), whose error is about n³/6d², negligible there.
  function pShared(n, d) {
    if (n < 2) return 0;
    if (n > d) return 1;
    if (d <= 1e6) {
      var lq = 0;
      for (var k = 1; k < n; k++) lq += Math.log1p(-k / d);
      return -Math.expm1(lq);
    }
    return -Math.expm1(-n * (n - 1) / (2 * d));
  }

  // Smallest n with P >= 1/2. Exact loop up to d = 10^10; above that the first
  // whole number past the solution of n(n−1)/2d = ln 2 (agrees with the loop; notes).
  function half(d) {
    if (d <= 1e10) {
      var lq = 0, n = 1, target = Math.log(0.5);
      while (true) { lq += Math.log1p(-n / d); n++; if (lq <= target) return { n: n, exact: true }; }
    }
    return { n: Math.ceil(0.5 + Math.sqrt(0.25 + 2 * d * Math.LN2)), exact: false };
  }

  // Small seeded generator (mulberry32) so the opening room is the same for every reader.
  function seeded(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", ".": "·" };
  function sup(s) { return String(s).split("").map(function (ch) { return SUP[ch] || ch; }).join(""); }

  // Plain numbers up to a million, scientific above.
  function big(x) { return x < 1e6 ? Orrery.fmt.number(Math.round(x), 0) : Orrery.fmt.sci(x, 1); }

  return { dateName: dateName, pShared: pShared, half: half, seeded: seeded, sup: sup, big: big, LENGTHS: LENGTHS };
})();

/* ---- Figure 1: fill a room ----------------------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("room-canvas");
  if (!canvasEl) return;
  var TAU = Orrery.TAU, D = 365, MAX = 365;
  var people = [];          // birthdays, day of year 0..364, in order of arrival
  var counts = new Array(D);
  var firstMatch = -1;      // index in people of the first person who matched someone
  var sim = { n: -1, rooms: 0, hits: 0 };
  var history = [];         // room sizes at the first match, from "Add until a match"

  var out = {
    n: document.getElementById("room-n"),
    pairs: document.getElementById("room-pairs"),
    match: document.getElementById("room-match"),
    shared: document.getElementById("room-shared"),
    exact: document.getElementById("room-exact"),
    sim: document.getElementById("room-sim"),
    simNote: document.getElementById("room-sim-note"),
    status: document.getElementById("room-status")
  };

  function reset() { people = []; for (var i = 0; i < D; i++) counts[i] = 0; firstMatch = -1; }
  function add(day) {
    if (people.length >= MAX) return;
    if (counts[day] > 0 && firstMatch < 0) firstMatch = people.length;
    counts[day]++; people.push(day);
  }
  function rnd() { return Math.floor(Math.random() * D); }

  // Opening room: 23 people from a fixed seed, chosen so that it contains a match.
  (function () {
    for (var s = 1; s < 1000; s++) {
      var r = Bday.seeded(s); reset();
      for (var i = 0; i < 23; i++) add(Math.floor(r() * D));
      if (firstMatch >= 0) return;
    }
  })();

  var view = Orrery.canvas(canvasEl, draw);

  function angleOf(day) { return -Math.PI / 2 + TAU * (day + 0.5) / D; }

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 20;
    var R0 = R * 0.74;        // the ring the dots sit on
    // month sectors
    var day = 0;
    ctx.lineWidth = 1;
    for (var m = 0; m < 12; m++) {
      var a0 = angleOf(day) - Math.PI / D, a1 = angleOf(day + Bday.LENGTHS[m]) - Math.PI / D;
      ctx.beginPath(); ctx.arc(cx, cy, R0 - 8, a0, a1);
      ctx.strokeStyle = m % 2 ? c.ink3 : c.rule; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + (R0 - 13) * Math.cos(a0), cy + (R0 - 13) * Math.sin(a0));
      ctx.lineTo(cx + (R0 - 3) * Math.cos(a0), cy + (R0 - 3) * Math.sin(a0));
      ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.stroke();
      var am = (a0 + a1) / 2;
      ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("JFMAMJJASOND"[m], cx + (R0 - 24) * Math.cos(am), cy + (R0 - 24) * Math.sin(am));
      day += Bday.LENGTHS[m];
    }
    // people: stacked outward on their day
    var dotR = Math.max(3, Math.min(5, R0 / 34));
    var step = dotR * 2.3;
    var seen = new Array(D);
    var firstDay = firstMatch >= 0 ? people[firstMatch] : -1;
    for (var i = 0; i < people.length; i++) {
      var d = people[i], k = seen[d] = (seen[d] || 0) + 1;
      var a = angleOf(d), r = R0 + (k - 1) * step;
      var shared = counts[d] > 1;
      if (shared && k === 2) {        // a spoke joining the matched people
        ctx.beginPath(); ctx.moveTo(cx + R0 * Math.cos(a), cy + R0 * Math.sin(a));
        ctx.lineTo(cx + (R0 + (counts[d] - 1) * step) * Math.cos(a), cy + (R0 + (counts[d] - 1) * step) * Math.sin(a));
        ctx.strokeStyle = c.alarm; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), shared ? dotR + 1.2 : dotR, 0, TAU);
      ctx.fillStyle = shared ? c.alarm : c.verdigrisLit; ctx.fill();
      if (!shared) { ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1; ctx.stroke(); }
    }
    // label the first shared day
    if (firstDay >= 0) {
      var af = angleOf(firstDay), rr = R0 + (counts[firstDay] - 1) * step + 14;
      ctx.beginPath(); ctx.arc(cx + R0 * Math.cos(af), cy + R0 * Math.sin(af), dotR + 6, 0, TAU);
      ctx.strokeStyle = c.alarm; ctx.lineWidth = 1.5; ctx.stroke();
      var lx = cx + rr * Math.cos(af), ly = cy + rr * Math.sin(af);
      ctx.font = "600 12px " + c.sans; ctx.fillStyle = c.alarm;
      ctx.textAlign = Math.cos(af) > 0.2 ? "left" : Math.cos(af) < -0.2 ? "right" : "center";
      ctx.textBaseline = Math.sin(af) > 0.2 ? "top" : Math.sin(af) < -0.2 ? "bottom" : "middle";
      lx = Orrery.clamp(lx, 4, w - 4); ly = Orrery.clamp(ly, 12, h - 12);
      ctx.fillText(Bday.dateName(firstDay), lx, ly);
    }
    // centre: the count
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = c.ink; ctx.font = "600 " + Math.round(R0 * 0.32) + "px " + c.sans;
    ctx.fillText(String(people.length), cx, cy + R0 * 0.06);
    ctx.fillStyle = c.ink3; ctx.font = Math.round(Math.max(11, R0 * 0.11)) + "px " + c.sans;
    ctx.fillText(people.length === 1 ? "person" : "people", cx, cy + R0 * 0.24);
  }

  function update(msg) {
    var n = people.length, sharedDays = 0;
    for (var i = 0; i < D; i++) if (counts[i] > 1) sharedDays++;
    out.n.textContent = Orrery.fmt.number(n, 0);
    out.pairs.textContent = Orrery.fmt.number(n * (n - 1) / 2, 0);
    out.match.textContent = firstMatch >= 0 ? "person " + (firstMatch + 1) + " (" + Bday.dateName(people[firstMatch]) + ")" : "none yet";
    out.shared.textContent = Orrery.fmt.number(sharedDays, 0);
    out.exact.textContent = Orrery.fmt.percent(Bday.pShared(n, D), 1);
    if (sim.n !== n) { sim = { n: n, rooms: 0, hits: 0 }; }
    showSim();
    canvasEl.setAttribute("aria-label", "A ring of the 365 days of the year with " + n +
      " birthdays marked. " + (firstMatch >= 0 ? sharedDays + " days are shared; the first match was " +
      Bday.dateName(people[firstMatch]) + "." : "No two people share a birthday yet."));
    if (msg) out.status.textContent = msg;
    view.redraw();
  }

  function showSim() {
    if (!sim.rooms) {
      out.sim.textContent = "—";
      out.simNote.textContent = "Press “Run 1,000 rooms” to test the exact value by brute force.";
      return;
    }
    var p = sim.hits / sim.rooms, se = Math.sqrt(Math.max(p * (1 - p), 1e-12) / sim.rooms);
    out.sim.textContent = Orrery.fmt.percent(p, 1) + " ± " + Orrery.fmt.percent(1.96 * se, 1);
    out.simNote.textContent = Orrery.fmt.number(sim.hits, 0) + " of " + Orrery.fmt.number(sim.rooms, 0) +
      " simulated rooms of " + sim.n + " had a match. The ± is a 95% interval: about 19 runs in 20 " +
      "should land that close to the exact value.";
  }

  function runRooms() {
    var n = people.length, mark = new Int32Array(D), stamp = 0;
    for (var r = 0; r < 1000; r++) {
      stamp++;
      var hit = 0;
      for (var i = 0; i < n; i++) {
        var d = rnd();
        if (mark[d] === stamp) { hit = 1; break; }
        mark[d] = stamp;
      }
      sim.hits += hit;
    }
    sim.rooms += 1000;
    showSim();
  }

  function on(id, fn) { document.getElementById(id).addEventListener("click", fn); }
  on("room-add1", function () { add(rnd()); update(people.length >= MAX ? "The room is full (365 people)." : ""); });
  on("room-add10", function () { for (var i = 0; i < 10; i++) add(rnd()); update(""); });
  on("room-until", function () {
    reset();
    while (firstMatch < 0) add(rnd());
    history.push(firstMatch + 1);
    var sorted = history.slice().sort(function (a, b) { return a - b; }), h = sorted.length;
    var median = h % 2 ? sorted[(h - 1) / 2] : (sorted[h / 2 - 1] + sorted[h / 2]) / 2;
    update("New room: the first shared birthday arrived with person " + (firstMatch + 1) + ". " +
      "Your rooms so far: " + history.slice(-12).join(", ") + (h > 12 ? " …" : "") +
      " (median " + Orrery.fmt.number(median, median % 1 ? 1 : 0) + " of " + h + ").");
  });
  on("room-empty", function () { reset(); update("The room is empty."); });
  on("room-run", runRooms);
  update("");
})();

/* ---- Figure 2: pairs, not people ------------------------------------------ */
(function () {
  "use strict";
  var canvasEl = document.getElementById("pairs-canvas");
  if (!canvasEl) return;
  var TAU = Orrery.TAU, NMAX = 100;
  var n = 23;
  var out = {
    pairs: document.getElementById("pairs-pairs"),
    yours: document.getElementById("pairs-yours"),
    any: document.getElementById("pairs-any"),
    mine: document.getElementById("pairs-mine")
  };
  function pMine(n) { return n < 2 ? 0 : 1 - Math.pow(364 / 365, n - 1); }

  var view = Orrery.canvas(canvasEl, draw);

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var side = w >= 520;
    // layout: chord diagram (left or top) and chart (right or bottom)
    var cs = side ? Math.min(h, w * 0.38) : Math.min(w, h * 0.42);
    var ccx = side ? cs / 2 : w / 2, ccy = side ? h / 2 + 6 : cs / 2 + 8, cr = cs / 2 - 20;
    var gx0 = side ? cs + 52 : 44, gx1 = w - 14, gy0 = side ? 14 : cs + 18, gy1 = h - 30;

    // chord diagram: every pair is a line; pairs involving "you" (top dot) in verdigris
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + TAU * i / n;
      pts.push([ccx + cr * Math.cos(a), ccy + cr * Math.sin(a)]);
    }
    var pairs = n * (n - 1) / 2;
    ctx.lineWidth = 1;
    ctx.globalAlpha = Math.max(0.25, Math.min(0.7, 40 / pairs));
    ctx.strokeStyle = c.brass;
    ctx.beginPath();
    for (i = 1; i < n; i++) for (var j = i + 1; j < n; j++) { ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (i = 1; i < n; i++) { ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[i][0], pts[i][1]); }
    ctx.stroke();
    var pr = Math.max(1.8, Math.min(5, cr * 2.6 / n));
    for (i = 0; i < n; i++) {
      ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], i === 0 ? pr + 2 : pr, 0, TAU);
      ctx.fillStyle = i === 0 ? c.verdigris : c.ink2; ctx.fill();
    }
    ctx.fillStyle = c.verdigris; ctx.font = "600 12px " + c.sans; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("you", pts[0][0], pts[0][1] - pr - 3);

    // chart axes
    function X(v) { return gx0 + (gx1 - gx0) * (v - 1) / (NMAX - 1); }
    function Y(p) { return gy1 - (gy1 - gy0) * p; }
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.font = "11px " + c.sans; ctx.fillStyle = c.ink3;
    ctx.textBaseline = "middle"; ctx.textAlign = "right";
    [0, 0.25, 0.5, 0.75, 1].forEach(function (p) {
      ctx.beginPath(); ctx.moveTo(gx0, Y(p)); ctx.lineTo(gx1, Y(p)); ctx.stroke();
      ctx.fillText(Math.round(p * 100) + "%", gx0 - 5, Y(p));
    });
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    [1, 20, 40, 60, 80, 100].forEach(function (v) { ctx.fillText(String(v), X(v), gy1 + 5); });
    ctx.fillText("people in the room", (gx0 + gx1) / 2, gy1 + 17);
    ctx.setLineDash([3, 3]); ctx.strokeStyle = c.ink3;
    ctx.beginPath(); ctx.moveTo(gx0, Y(0.5)); ctx.lineTo(gx1, Y(0.5)); ctx.stroke(); ctx.setLineDash([]);

    // curves
    function curve(f, col) {
      ctx.beginPath();
      for (var v = 1; v <= NMAX; v++) { if (v === 1) ctx.moveTo(X(v), Y(f(v))); else ctx.lineTo(X(v), Y(f(v))); }
      ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke();
    }
    curve(function (v) { return Bday.pShared(v, 365); }, c.brass);
    curve(pMine, c.verdigris);

    // landmarks 23 and 70
    ctx.font = "11px " + c.sans; ctx.fillStyle = c.ink2; ctx.textBaseline = "bottom";
    [[23, "23: 50.7%"], [70, "70: 99.9%"]].forEach(function (m) {
      var x = X(m[0]), y = Y(Bday.pShared(m[0], 365));
      ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fillStyle = c.brass; ctx.fill();
      ctx.fillStyle = c.ink2; ctx.textAlign = m[0] < 50 ? "right" : "center";
      ctx.fillText(m[1], m[0] < 50 ? x - 6 : x, m[0] < 50 ? y - 4 : y + 16 + 2);
    });

    // current n
    var xn = X(n);
    ctx.strokeStyle = c.ink2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xn, gy0); ctx.lineTo(xn, gy1); ctx.stroke();
    [[Bday.pShared(n, 365), c.brass], [pMine(n), c.verdigris]].forEach(function (q) {
      ctx.beginPath(); ctx.arc(xn, Y(q[0]), 5, 0, TAU); ctx.fillStyle = q[1]; ctx.fill();
      ctx.strokeStyle = c.paper; ctx.lineWidth = 1.5; ctx.stroke();
    });
  }

  Orrery.bindRange(document.getElementById("pairs-n"), document.getElementById("pairs-n-out"), {
    format: function (v) { return v + " people"; },
    onInput: function (v) {
      n = Math.round(v);
      out.pairs.textContent = Orrery.fmt.number(n * (n - 1) / 2, 0);
      out.yours.textContent = Orrery.fmt.number(n - 1, 0);
      out.any.textContent = Orrery.fmt.percent(Bday.pShared(n, 365), 1);
      out.mine.textContent = Orrery.fmt.percent(pMine(n), 1);
      canvasEl.setAttribute("aria-label", n + " people joined by " + (n * (n - 1) / 2) +
        " lines, one per pair; " + (n - 1) + " of them involve you. Chart: chance of any shared birthday " +
        Orrery.fmt.percent(Bday.pShared(n, 365), 1) + ", chance someone shares yours " + Orrery.fmt.percent(pMine(n), 1) + ".");
      view.redraw();
    }
  });
})();

/* ---- Figure 3: any number of days ------------------------------------------ */
(function () {
  "use strict";
  var canvasEl = document.getElementById("days-canvas");
  if (!canvasEl) return;
  var LMAX = 21;                        // x axis: 1 to 10^21 draws
  var d = 365;
  var slider = document.getElementById("days-d");
  var out = {
    d: document.getElementById("days-d-out"),
    bits: document.getElementById("days-bits"),
    half: document.getElementById("days-half"),
    approx: document.getElementById("days-approx"),
    ratio: document.getElementById("days-ratio")
  };

  var view = Orrery.canvas(canvasEl, draw);

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var gx0 = 44, gx1 = w - 14, gy0 = 16, gy1 = h - 32;
    function X(l) { return gx0 + (gx1 - gx0) * l / LMAX; }
    function Y(p) { return gy1 - (gy1 - gy0) * p; }
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.font = "11px " + c.sans; ctx.fillStyle = c.ink3;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    [0, 0.5, 1].forEach(function (p) {
      ctx.beginPath(); ctx.moveTo(gx0, Y(p)); ctx.lineTo(gx1, Y(p)); ctx.stroke();
      ctx.fillText(Math.round(p * 100) + "%", gx0 - 5, Y(p));
    });
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    var stepL = w < 500 ? 6 : 3;
    for (var l = 0; l <= LMAX; l += stepL) {
      ctx.beginPath(); ctx.moveTo(X(l), gy1); ctx.lineTo(X(l), gy1 + 4); ctx.stroke();
      ctx.fillText(l === 0 ? "1" : "10" + Bday.sup(l), X(l), gy1 + 5);
    }
    ctx.fillText("draws (log scale)", (gx0 + gx1) / 2, gy1 + 18);

    function curve(dd, col, width) {
      ctx.beginPath();
      var first = true;
      var lo = Math.max(0, Math.log10(Math.sqrt(dd)) - 2.2), hi = Math.min(LMAX, Math.log10(Math.sqrt(dd)) + 1.4);
      ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(lo), Y(0));
      for (var i = 0; i <= 160; i++) {
        var L = lo + (hi - lo) * i / 160, nn = Math.pow(10, L);
        var p = Bday.pShared(dd <= 1e6 ? Math.floor(nn) : nn, dd);
        ctx.lineTo(X(L), Y(p)); first = false;
      }
      ctx.lineTo(X(LMAX), Y(1));
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.stroke();
    }
    curve(365, c.ink3, 1.2);
    ctx.fillStyle = c.ink3; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    if (Math.abs(Math.log10(d) - Math.log10(365)) > 1.5) ctx.fillText("365 days", X(Math.log10(Bday.half(365).n)) + 6, Y(0.5) - 2);
    curve(d, c.brass, 2.4);

    var hv = Bday.half(d).n, xl = X(Math.log10(hv));
    ctx.setLineDash([3, 3]); ctx.strokeStyle = c.ink2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xl, Y(0.5)); ctx.lineTo(xl, gy1); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(xl, Y(0.5), 5, 0, Orrery.TAU); ctx.fillStyle = c.brass; ctx.fill();
    ctx.strokeStyle = c.paper; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = c.ink; ctx.font = "600 12px " + c.sans;
    ctx.textAlign = xl > (gx0 + gx1) / 2 ? "right" : "left"; ctx.textBaseline = "bottom";
    ctx.fillText("50% at " + Bday.big(hv) + " draws", xl + (xl > (gx0 + gx1) / 2 ? -8 : 8), Y(0.5) - 8);
  }

  function set(dd) {
    d = dd;
    var bits = Math.log2(d), hv = Bday.half(d), ap = Math.sqrt(2 * Math.LN2 * d);
    out.d.textContent = Bday.big(d);
    out.bits.textContent = Orrery.fmt.number(bits, 1) + " bits";
    out.half.textContent = (hv.exact ? "" : "≈ ") + Bday.big(hv.n);
    out.approx.textContent = ap < 1000 ? Orrery.fmt.number(ap, 1) : Bday.big(ap);
    out.ratio.textContent = d >= 1e4 ? "1 in " + Bday.big(d / hv.n) : Orrery.fmt.percent(hv.n / d, 1);
    slider.setAttribute("aria-valuetext", Bday.big(d) + " possible values");
    canvasEl.setAttribute("aria-label", "Chance of a repeat against number of draws, on a log scale, for " +
      Bday.big(d) + " equally likely values. It passes 50% at about " + Bday.big(hv.n) + " draws.");
    view.redraw();
  }

  slider.addEventListener("input", function () {
    var v = parseFloat(slider.value);
    set(v < 6 ? Math.round(Math.pow(10, v)) : Math.pow(10, v));
  });
  Array.prototype.forEach.call(document.querySelectorAll("#fig-days [data-d]"), function (b) {
    b.addEventListener("click", function () {
      var dd = parseFloat(b.getAttribute("data-d"));
      slider.value = Math.log10(dd);
      set(dd);
    });
  });
  set(365);
})();

/* ---- Figure 4: real birthdays are not uniform ------------------------------ */
(function () {
  "use strict";
  var canvasEl = document.getElementById("real-canvas");
  if (!canvasEl || !window.BDAY_RATES) return;
  var REAL = window.BDAY_RATES, D = 365, NMAX = 80;
  var s = 1, n = 23;           // s: 0 = all days equal, 1 = real US rates, >1 exaggerated
  var probs = [];
  var out = {
    uni: document.getElementById("real-uni"),
    with: document.getElementById("real-with"),
    diff: document.getElementById("real-diff"),
    half: document.getElementById("real-half")
  };

  // Day probabilities for the current unevenness: rate = 1 + s·(real − 1), normalised.
  function weights() {
    var w = [], sum = 0, i;
    for (i = 0; i < D; i++) { w.push(Math.max(0, 1 + s * (REAL[i] - 1))); sum += w[i]; }
    for (i = 0; i < D; i++) w[i] /= sum;
    return w;
  }
  // P(all n birthdays differ) = n! · e_n(p_1..p_365), e_n the elementary symmetric polynomial.
  // g[k] = k!·e_k is built up directly so nothing overflows: g[k] += k·p·g[k−1].
  function noMatch(p) {
    var g = [1];
    for (var k = 1; k <= NMAX; k++) g.push(0);
    for (var i = 0; i < D; i++) for (k = NMAX; k >= 1; k--) g[k] += k * p[i] * g[k - 1];
    return g;
  }

  var view = Orrery.canvas(canvasEl, draw);

  function draw(ctx, w, h) {
    var c = Orrery.tokens(), wts = weights();
    var gx0 = 40, gx1 = w - 10, gy0 = 12, gy1 = h - 24, YMAX = 1.5;
    function Y(v) { return gy1 - (gy1 - gy0) * v / YMAX; }
    var bw = (gx1 - gx0) / D;
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.font = "11px " + c.sans; ctx.fillStyle = c.ink3;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    [0, 0.5, 1, 1.5].forEach(function (v) {
      ctx.beginPath(); ctx.moveTo(gx0, Y(v)); ctx.lineTo(gx1, Y(v)); ctx.stroke();
      ctx.fillText("×" + v, gx0 - 5, Y(v));
    });
    ctx.fillStyle = c.brassLit;
    var maxI = 0, minI = 0;
    for (var i = 0; i < D; i++) {
      var v = wts[i] * D;
      if (wts[i] > wts[maxI]) maxI = i;
      if (wts[i] < wts[minI]) minI = i;
      ctx.fillRect(gx0 + i * bw, Y(v), Math.max(1, bw - 0.3), gy1 - Y(v));
    }
    ctx.strokeStyle = c.ink2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(gx0, Y(1)); ctx.lineTo(gx1, Y(1)); ctx.stroke(); ctx.setLineDash([]);
    // month ticks
    ctx.fillStyle = c.ink3; ctx.textAlign = "center"; ctx.textBaseline = "top";
    var day = 0;
    for (var m = 0; m < 12; m++) {
      ctx.fillText("JFMAMJJASOND"[m], gx0 + (day + Bday.LENGTHS[m] / 2) * bw, gy1 + 5);
      day += Bday.LENGTHS[m];
    }
    if (s > 0) {
      ctx.font = "600 11px " + c.sans; ctx.fillStyle = c.ink;
      [[maxI, Y(wts[maxI] * D) - 4, "bottom"], [minI, Y(wts[minI] * D) - 4, "bottom"]].forEach(function (q) {
        var x = gx0 + (q[0] + 0.5) * bw;
        ctx.textAlign = x > w - 90 ? "right" : x < 90 ? "left" : "center"; ctx.textBaseline = q[2];
        ctx.lineWidth = 3; ctx.strokeStyle = c.paper; ctx.lineJoin = "round";
        ctx.strokeText(Bday.dateName(q[0]), x, q[1]);
        ctx.fillText(Bday.dateName(q[0]), x, q[1]);
      });
    }
  }

  function update() {
    var g = noMatch(weights());
    var pu = Bday.pShared(n, D), pw = 1 - g[n], k = 2;
    while (k < NMAX && 1 - g[k] < 0.5) k++;
    out.uni.textContent = Orrery.fmt.percent(pu, 2);
    out.with.textContent = Orrery.fmt.percent(pw, 2);
    out.diff.textContent = Orrery.fmt.signed((pw - pu) * 100, 2) + " percentage points";
    out.half.textContent = k + " people";
    canvasEl.setAttribute("aria-label", "Births per calendar date relative to an average day, " +
      (s === 0 ? "all equal." : "with unevenness " + Orrery.fmt.number(s, 1) + " times the real US pattern.") +
      " Chance of a shared birthday among " + n + ": " + Orrery.fmt.percent(pw, 2) + ".");
    view.redraw();
  }

  Orrery.bindRange(document.getElementById("real-s"), document.getElementById("real-s-out"), {
    format: function (v) { return v === 0 ? "all days equal" : v === 1 ? "real US rates" : "×" + Orrery.fmt.number(v, 1) + " real"; },
    onInput: function (v) { s = v; update(); }, init: false
  });
  Orrery.bindRange(document.getElementById("real-n"), document.getElementById("real-n-out"), {
    format: function (v) { return v + " people"; },
    onInput: function (v) { n = Math.round(v); update(); }, init: false
  });
  update();
})();
