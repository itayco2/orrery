/* Exhibit script: "How can two strangers agree on a secret in public?"
   One IIFE per figure. Shared helpers (modular arithmetic) in KX below. */

var KX = (function () {
  "use strict";
  // Square-and-multiply. All numbers here are < 64, so products stay far below 2^53.
  function powmod(g, x, p) {
    var r = 1, b = g % p;
    while (x > 0) {
      if (x & 1) r = (r * b) % p;
      b = (b * b) % p;
      x = Math.floor(x / 2);
    }
    return r;
  }
  // Multiplicative order of g modulo prime p: smallest k > 0 with g^k = 1.
  function order(g, p) {
    var v = g % p, k = 1;
    while (v !== 1 && k < p) { v = (v * g) % p; k++; }
    return k;
  }
  function smallestGenerator(p) {
    for (var g = 2; g < p; g++) if (order(g, p) === p - 1) return g;
    return 2;
  }
  function isPrime(n) {
    if (n < 2) return false;
    for (var d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
  }
  return { powmod: powmod, order: order, smallestGenerator: smallestGenerator, isPrime: isPrime };
})();

/* ---- Figure 1: mixing paint ------------------------------------------------
   Pigments are modelled as reflectances in linear RGB; mixing in parts w_i
   takes the weighted geometric mean (absorbances add, roughly as in
   Beer–Lambert for dyes). Equal parts of the same three paints give the same
   result whatever the order: that is the whole point. */
(function () {
  "use strict";
  var svg = document.getElementById("paint-svg");
  if (!svg) return;
  var NS = "http://www.w3.org/2000/svg";
  var PUBLIC = [1.0, 0.86, 0.12];               // sRGB 0..1: a warm yellow

  function toLin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function toS(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  function hsl(h, s, l) {
    function f(n) {
      var k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    }
    return [f(0), f(8), f(4)];
  }
  function mix(paints, parts) {                   // paints: sRGB triples
    var out = [0, 0, 0], tot = 0, i, k;
    for (i = 0; i < parts.length; i++) tot += parts[i];
    for (k = 0; k < 3; k++) {
      var s = 0;
      for (i = 0; i < paints.length; i++) s += parts[i] / tot * Math.log(Math.max(0.02, toLin(paints[i][k])));
      out[k] = toS(Math.exp(s));
    }
    return out;
  }
  function hex(c) {
    return "#" + c.map(function (v) {
      var n = Math.round(Orrery.clamp(v, 0, 1) * 255);
      return (n < 16 ? "0" : "") + n.toString(16);
    }).join("");
  }
  function hueName(h) {
    var names = [[15, "red"], [40, "orange"], [65, "yellow"], [160, "green"], [195, "turquoise"],
      [250, "blue"], [285, "violet"], [330, "magenta"], [361, "red"]];
    for (var i = 0; i < names.length; i++) if (h < names[i][0]) return names[i][1];
    return "red";
  }

  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    svg.appendChild(e);
    return e;
  }
  function label(x, y, t, cls) {
    return el("text", { x: x, y: y, "text-anchor": "middle", "class": "pl " + (cls || "") }, t);
  }
  // Layout (viewBox 800 x 400)
  el("rect", { x: 270, y: 8, width: 260, height: 384, rx: 14, "class": "pub-band" });
  label(400, 34, "PUBLIC · Eve sees", "pl-head");
  label(120, 34, "ALICE", "pl-head");
  label(680, 34, "BOB", "pl-head");

  function pot(x, y, r) { return el("circle", { cx: x, cy: y, r: r, "class": "pot" }); }
  function arrow(x1, y1, x2, y2) {
    el("line", { x1: x1, y1: y1, x2: x2, y2: y2, "class": "arr", "marker-end": "url(#kx-head)" });
  }
  var defs = el("defs", {});
  var m = document.createElementNS(NS, "marker");
  m.setAttribute("id", "kx-head"); m.setAttribute("viewBox", "0 0 10 10"); m.setAttribute("refX", "9");
  m.setAttribute("refY", "5"); m.setAttribute("markerWidth", "7"); m.setAttribute("markerHeight", "7");
  m.setAttribute("orient", "auto-start-reverse");
  var mp = document.createElementNS(NS, "path"); mp.setAttribute("d", "M0 0 L10 5 L0 10 z"); mp.setAttribute("class", "arr-head");
  m.appendChild(mp); defs.appendChild(m);

  // arrows first so pots sit on top
  arrow(400, 105, 175, 170); arrow(400, 105, 625, 170);   // yellow to both sides
  arrow(120, 108, 120, 166); arrow(680, 108, 680, 166);   // secrets into own mixes
  arrow(165, 205, 345, 205); arrow(635, 205, 455, 205);   // send mixes to public
  arrow(360, 235, 640, 300); arrow(440, 235, 160, 300);   // pots arrive at the other side
  arrow(345, 245, 390, 300); arrow(455, 245, 410, 300);   // Eve pours both together
  arrow(70, 90, 70, 300); arrow(730, 90, 730, 300);       // own secret again

  var potPub = pot(400, 78, 30);
  var potA = pot(120, 78, 30), potB = pot(680, 78, 30);
  var mixA = pot(120, 205, 34), mixB = pot(680, 205, 34);
  var sentA = pot(375, 205, 28), sentB = pot(425, 205, 28);
  var finA = pot(120, 332, 40), finB = pot(680, 332, 40), eve = pot(400, 332, 34);
  label(400, 128, "yellow");
  label(120, 128, "secret");
  label(680, 128, "secret");
  label(120, 258, "yellow + secret");
  label(680, 258, "yellow + secret");
  label(215, 360, "+ own secret", "pl-small");
  label(585, 360, "+ own secret", "pl-small");
  label(400, 385, "Eve’s guess");
  var tickA = label(120, 392, "", "pl-key"), tickB = label(680, 392, "", "pl-key");

  var outAlice = document.getElementById("paint-alice");
  var outBob = document.getElementById("paint-bob");
  var outEve = document.getElementById("paint-eve");
  var desc = document.getElementById("paint-desc");
  var hA = 350, hB = 200;

  function render() {
    var A = hsl(hA, 0.85, 0.48), B = hsl(hB, 0.85, 0.48);
    var mA = mix([PUBLIC, A], [1, 1]), mB = mix([PUBLIC, B], [1, 1]);
    var fA = mix([PUBLIC, B, A], [1, 1, 1]);              // Alice: Bob's pot + her secret
    var fB = mix([PUBLIC, A, B], [1, 1, 1]);              // Bob: Alice's pot + his secret
    var fE = mix([PUBLIC, A, B], [2, 1, 1]);              // Eve: both pots poured together
    potPub.setAttribute("fill", hex(PUBLIC));
    potA.setAttribute("fill", hex(A)); potB.setAttribute("fill", hex(B));
    mixA.setAttribute("fill", hex(mA)); sentA.setAttribute("fill", hex(mA));
    mixB.setAttribute("fill", hex(mB)); sentB.setAttribute("fill", hex(mB));
    finA.setAttribute("fill", hex(fA)); finB.setAttribute("fill", hex(fB));
    eve.setAttribute("fill", hex(fE));
    var same = hex(fA) === hex(fB);
    tickA.textContent = tickB.textContent = same ? "shared secret ✓" : "";
    outAlice.textContent = hex(fA);
    outBob.textContent = hex(fB);
    outEve.textContent = hex(fE) + " (wrong)";
    desc.textContent = "Alice's secret is " + hueName(hA) + ", Bob's is " + hueName(hB) +
      ". The public pots are " + hex(mA) + " and " + hex(mB) + ". Alice and Bob both end with " +
      hex(fA) + (same ? "" : " and " + hex(fB)) + "; Eve's mixture of the two public pots is " + hex(fE) + ", a different colour.";
  }

  Orrery.bindRange(document.getElementById("paint-a"), document.getElementById("paint-a-out"), {
    format: function (v) { return hueName(v) + " · " + v + "°"; },
    onInput: function (v) { hA = v; render(); }
  });
  Orrery.bindRange(document.getElementById("paint-b"), document.getElementById("paint-b-out"), {
    format: function (v) { return hueName(v) + " · " + v + "°"; },
    onInput: function (v) { hB = v; render(); }
  });
})();

/* ---- Figure 2: powers of g on a clock of p hours --------------------------- */
(function () {
  "use strict";
  var svg = document.getElementById("clock-svg");
  if (!svg) return;
  var NS = "http://www.w3.org/2000/svg";
  var PRIMES = [5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53];
  var R = 92;
  var p = 23, g = 5, x = 6;
  var inP = document.getElementById("clock-p"), inG = document.getElementById("clock-g"), inX = document.getElementById("clock-x");
  var outVal = document.getElementById("clock-val"), outOrder = document.getElementById("clock-order");
  var outSeq = document.getElementById("clock-seq"), outGen = document.getElementById("clock-gen");
  var desc = document.getElementById("clock-desc");
  inP.max = PRIMES.length - 1;

  function pos(h, r) {
    var a = h / p * Orrery.TAU - Math.PI / 2;
    return [r * Math.cos(a), r * Math.sin(a)];
  }
  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    svg.appendChild(e);
    return e;
  }

  function render() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    el("circle", { r: R, "class": "clk-face" });
    var visited = {}, v = 1, seq = [], i;
    for (i = 1; i <= x; i++) { v = (v * g) % p; seq.push(v); visited[v] = i; }
    var cur = seq[seq.length - 1];
    // hops: from g^(k-1) to g^k, starting at g^0 = 1
    var prev = 1;
    for (i = 0; i < seq.length; i++) {
      var a = pos(prev, R), b = pos(seq[i], R);
      var last = i === seq.length - 1;
      el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1],
        "class": last ? "clk-hop last" : "clk-hop",
        "stroke-opacity": last ? 1 : 0.25 + 0.5 * (i + 1) / seq.length });
      prev = seq[i];
    }
    var fs = p <= 23 ? 10 : p <= 37 ? 8 : 6.5;
    for (var h = 0; h < p; h++) {
      var q = pos(h, R), t = pos(h, R + 11);
      el("circle", { cx: q[0], cy: q[1], r: h === cur ? 5 : visited[h] ? 2.8 : 1.8,
        "class": h === cur ? "clk-dot cur" : visited[h] ? "clk-dot seen" : "clk-dot" });
      el("text", { x: t[0], y: t[1] + fs * 0.35, "text-anchor": "middle", "font-size": fs,
        "class": h === cur ? "clk-num cur" : "clk-num" }, String(h));
    }
    var c = pos(cur, R - 8);
    el("line", { x1: 0, y1: 0, x2: c[0], y2: c[1], "class": "clk-hand" });
    el("circle", { r: 3.5, "class": "clk-hub" });

    var ord = KX.order(g, p);
    outVal.textContent = g + "^" + x + " mod " + p + " = " + cur;
    outOrder.textContent = ord + " of " + (p - 1);
    outSeq.textContent = seq.join(", ");
    if (ord === p - 1) {
      outGen.textContent = "✓ " + g + " is a generator: its powers visit every non-zero hour.";
      outGen.className = "gen-mark sans yes";
    } else {
      outGen.textContent = "✗ " + g + " is not a generator: its powers repeat after " + ord +
        " steps and reach only " + ord + " of the " + (p - 1) + " non-zero hours.";
      outGen.className = "gen-mark sans no";
    }
    desc.textContent = "A clock with " + p + " hours. Powers of " + g + " for x from 1 to " + x +
      " land on hours " + seq.join(", ") + ". The hand points to " + cur + ".";
  }

  var bx;
  var bg = Orrery.bindRange(inG, document.getElementById("clock-g-out"), {
    onInput: function (v) { g = v; render(); }, init: false
  });
  bx = Orrery.bindRange(inX, document.getElementById("clock-x-out"), {
    onInput: function (v) { x = v; render(); }, init: false
  });
  Orrery.bindRange(inP, document.getElementById("clock-p-out"), {
    format: function (i) { return PRIMES[i] + " hours"; },
    onInput: function (i) {
      p = PRIMES[i];
      inG.max = p - 1; inX.max = p - 1;
      bg.set(Math.min(g, p - 1)); bx.set(Math.min(x, p - 1));
      g = bg.value(); x = bx.value();
      render();
    }
  });
})();

/* ---- Figure 3: the exchange, and Eve's search ------------------------------ */
(function () {
  "use strict";
  var canvas = document.getElementById("dh-canvas");
  if (!canvas) return;
  var PRIMES = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61];
  var p = 23, g = 5, a = 6, b = 15, A, B;
  var tried = 0, found = 0, acc = 0;              // Eve's progress
  var RATE = 6;                                    // tries per second
  var $ = function (id) { return document.getElementById(id); };
  var inA = $("dh-a"), inB = $("dh-b"), inP = $("dh-p");
  inP.max = PRIMES.length - 1;

  function compute() {
    g = KX.smallestGenerator(p);
    A = KX.powmod(g, a, p); B = KX.powmod(g, b, p);
    var sa = KX.powmod(B, a, p), sb = KX.powmod(A, b, p);
    $("dh-a-v").textContent = a; $("dh-b-v").textContent = b;
    $("dh-A").textContent = A; $("dh-B").textContent = B;
    $("dh-A2").textContent = A; $("dh-B2").textContent = B;
    $("dh-p-v").textContent = p; $("dh-g-v").textContent = g;
    $("dh-sa").textContent = sa; $("dh-sb").textContent = sb;
    $("dh-match").textContent = sa === sb ? "Alice’s key = Bob’s key = " + sa + " ✓" : "Keys differ!";
    resetEve();
  }
  function resetEve() {
    tried = 0; found = 0; acc = 0;
    if (loop) loop.pause();
    status();
  }
  function status() {
    $("dh-tries").textContent = tried;
    var s;
    if (found) {
      var key = KX.powmod(B, found, p);
      s = "found x = " + found + " (g^" + found + " mod " + p + " = " + A + "), so the key is B^" + found + " mod " + p + " = " + key;
    } else if (tried) s = "trying… x = " + tried + " gives " + KX.powmod(g, tried, p);
    else s = "waiting";
    $("dh-status").textContent = s;
    view.redraw();
  }

  var view = Orrery.canvas(canvas, function (ctx, w, h) {
    var c = Orrery.tokens(), n = p - 1;
    var cols = w < 500 ? Math.min(n, 8) : n, rows = Math.ceil(n / cols);
    var pad = 6, cw = (w - 2 * pad) / cols, ch = Math.min(44, (h - 2 * pad) / rows);
    var y0 = (h - ch * rows) / 2;
    ctx.font = Math.min(13, cw * 0.42) + "px " + c.mono;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (var x = 1; x <= n; x++) {
      var i = x - 1, cx = pad + (i % cols) * cw, cy = y0 + Math.floor(i / cols) * ch;
      var done = x <= tried, hit = found && x === found;
      ctx.fillStyle = hit ? c.alarm : done ? c.paper3 : c.paper2;
      ctx.fillRect(cx + 1, cy + 1, cw - 2, ch - 2);
      ctx.strokeStyle = x === tried && !found ? c.brass : c.rule;
      ctx.lineWidth = x === tried && !found ? 2 : 1;
      ctx.strokeRect(cx + 1.5, cy + 1.5, cw - 3, ch - 3);
      ctx.fillStyle = hit ? c.paper : done ? c.ink : c.ink3;
      ctx.fillText(done ? String(KX.powmod(g, x, p)) : (cw > 46 ? "x=" : "") + x, cx + cw / 2, cy + ch / 2);
    }
  });

  var loop = Orrery.loop(canvas, function (dt) {
    acc += dt * RATE;
    while (acc >= 1 && !found) {
      acc -= 1; tried++;
      if (KX.powmod(g, tried, p) === A) { found = tried; loop.pause(); }
    }
    status();
  }, { autoplay: false });

  $("dh-eve").addEventListener("click", function () {
    if (found) resetEve();
    loop.play();
  });
  $("dh-reset").addEventListener("click", resetEve);

  var ba, bb;
  ba = Orrery.bindRange(inA, $("dh-a-out"), { onInput: function (v) { a = v; compute(); }, init: false });
  bb = Orrery.bindRange(inB, $("dh-b-out"), { onInput: function (v) { b = v; compute(); }, init: false });
  Orrery.bindRange(inP, $("dh-p-out"), {
    format: function (i) { return String(PRIMES[i]); },
    onInput: function (i) {
      p = PRIMES[i];
      inA.max = p - 2; inB.max = p - 2;
      ba.set(Math.min(a, p - 2)); bb.set(Math.min(b, p - 2));
      a = ba.value(); b = bb.value();
      compute();
    }
  });
})();

/* ---- Figure 4: work against the size of p --------------------------------- */
(function () {
  "use strict";
  var canvas = document.getElementById("bits-canvas");
  if (!canvas) return;
  var n = 64;
  var LOG2 = Math.log10(2);
  var MAXEXP = 700;                         // right edge of the log axis: 10^700
  var AGE_S = 4.35e17;                      // age of the universe, seconds (13.8 billion years)
  var $ = function (id) { return document.getElementById(id); };

  function sci(log10v) {                    // number given by its log10 -> HTML text
    if (log10v < 6) return Orrery.fmt.number(Math.round(Math.pow(10, log10v)), 0);
    var e = Math.floor(log10v), m = Math.pow(10, log10v - e);
    if (m >= 9.95) { m = 1; e += 1; }
    return Orrery.fmt.number(m, 1) + " × 10<sup>" + e + "</sup>";
  }
  function timeText(log10s) {
    if (log10s < -3) return "under a millisecond";
    var s = Math.pow(10, log10s);
    if (log10s < 2) return Orrery.fmt.number(s, s < 10 ? 2 : 0) + " s";
    if (log10s < 5) return Orrery.fmt.number(s / 60, 0) + " minutes";
    if (log10s < 7.5) return Orrery.fmt.number(s / 86400, 0) + " days";
    var yrs = log10s - Math.log10(3.156e7);
    if (log10s < Math.log10(AGE_S)) return sci(yrs) + " years";
    return sci(log10s - Math.log10(AGE_S)) + " × the age of the universe";
  }

  var view = Orrery.canvas(canvas, function (ctx, w, h) {
    var c = Orrery.tokens();
    var left = Math.min(90, w * 0.22), right = w - 26, top = 14, bh = Math.min(34, h * 0.22);
    function X(l) { return left + (right - left) * Orrery.clamp(l / MAXEXP, 0, 1); }
    ctx.font = "12px " + c.sans; ctx.textBaseline = "middle";
    // grid every 10^100
    for (var k = 0; k <= MAXEXP; k += 100) {
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(k), top); ctx.lineTo(X(k), h - 26); ctx.stroke();
      ctx.fillStyle = c.ink3; ctx.textAlign = "center";
      if (k > 0 && (w > 480 || k % 200 === 0)) ctx.fillText("10^" + k, X(k), h - 12);
    }
    var la = Math.log10(2 * n), le = n * LOG2;
    var rows = [["Alice", la, c.verdigris], ["Eve", le, c.alarm]];
    for (var i = 0; i < 2; i++) {
      var y = top + 8 + i * (bh + 14);
      ctx.fillStyle = c.ink2; ctx.textAlign = "right";
      ctx.fillText(rows[i][0], left - 8, y + bh / 2);
      ctx.fillStyle = rows[i][2];
      ctx.fillRect(X(0), y, Math.max(2, X(rows[i][1]) - X(0)), bh);
    }
    // a reference mark: atoms in the observable universe ~ 10^80
    var ra = X(80);
    ctx.setLineDash([3, 3]); ctx.strokeStyle = c.ink3;
    ctx.beginPath(); ctx.moveTo(ra, top); ctx.lineTo(ra, top + 2 * bh + 30); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = c.ink3; ctx.textAlign = "left";
    if (w > 420) ctx.fillText("≈ atoms in the observable universe (10^80)", ra + 4, top + 2 * bh + 36);
  });

  Orrery.bindRange($("bits-n"), $("bits-n-out"), {
    format: function (v) { return v + " bits"; },
    onInput: function (v) {
      n = v;
      $("bits-alice").textContent = "about " + Orrery.fmt.number(2 * n, 0);
      $("bits-eve").innerHTML = sci(n * LOG2);
      $("bits-time").innerHTML = timeText(n * LOG2 - 9);
      view.redraw();
    }
  });
})();

/* ---- Figure 5: man in the middle ------------------------------------------ */
(function () {
  "use strict";
  var on = document.getElementById("mitm-on");
  if (!on) return;
  var sign = document.getElementById("mitm-sign");
  var p = 23, g = 5, a = 6, b = 15, e = 9;
  var A = KX.powmod(g, a, p), B = KX.powmod(g, b, p);
  var $ = function (id) { return document.getElementById(id); };

  function render() {
    var E = KX.powmod(g, e, p), wire, verdict, ka, kb, ra, rb;
    if (!on.checked) {
      ra = "B = " + B + (sign.checked ? ", signed by Bob ✓" : "");
      rb = "A = " + A;
      ka = KX.powmod(B, a, p); kb = KX.powmod(A, b, p);
      wire = "A = " + A + " and B = " + B + " pass through untouched. Eve can only listen.";
      verdict = "Alice and Bob share key " + ka + "; Eve cannot compute it.";
    } else if (!sign.checked) {
      ra = "E = " + E + " (thinks it is Bob’s)";
      rb = "E = " + E + " (thinks it is Alice’s)";
      ka = KX.powmod(E, a, p); kb = KX.powmod(E, b, p);
      wire = "Eve catches A = " + A + " and B = " + B + " and sends E = " + E + " to each side instead.";
      verdict = "Alice’s key " + ka + " = Eve’s A^e mod 23 = " + KX.powmod(A, e, p) +
        ". Bob’s key " + kb + " = Eve’s B^e mod 23 = " + KX.powmod(B, e, p) +
        ". Eve holds both keys and can read and re-encrypt everything; neither side notices.";
    } else {
      ra = "E = " + E + ", but the signature is not Bob’s ✗";
      rb = "E = " + E + " (thinks it is Alice’s)";
      ka = "none"; kb = KX.powmod(E, b, p);
      wire = "Eve swaps in E = " + E + ", but she cannot produce Bob’s signature on it.";
      verdict = "Alice’s check fails, so she abandons the connection instead of talking to Eve.";
    }
    $("mitm-ra").textContent = ra; $("mitm-rb").textContent = rb;
    $("mitm-ka").textContent = ka; $("mitm-kb").textContent = kb;
    $("mitm-wire").textContent = wire; $("mitm-verdict").textContent = verdict;
  }
  Orrery.bindRange($("mitm-e"), $("mitm-e-out"), { onInput: function (v) { e = v; render(); } });
  on.addEventListener("change", render);
  sign.addEventListener("change", render);
})();
