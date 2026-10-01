/* Exhibit: How does a scratched CD still play?  (error-correction)
   Shared model first (picture, Hamming(7,4), random numbers), then one IIFE per figure. */

/* ---- Shared model --------------------------------------------------------- */
var EC = (function () {
  "use strict";
  var W = 32, H = 20, N = W * H;              // picture: 640 pixels = 640 data bits

  // A small picture (a smiling face), 1 = ink.
  var picture = new Uint8Array(N);
  var ART = [
    "................................",
    "...........##########...........",
    "........####........####........",
    "......###..............###......",
    ".....##..................##.....",
    "....##....................##....",
    "...##......###....###......##...",
    "...#.......###....###.......#...",
    "..##.......###....###.......##..",
    "..#..........................#..",
    "..#..........................#..",
    "..##.....#............#.....##..",
    "...#......#..........#......#...",
    "...##......##......##......##...",
    "....##.......######.......##....",
    ".....##..................##.....",
    "......###..............###......",
    "........####........####........",
    "...........##########...........",
    "................................"
  ];
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) picture[y * W + x] = ART[y][x] === "#" ? 1 : 0;

  // Hamming(7,4). Codeword bit k (0..6) sits at position k+1:
  //   positions 1..7 = p1 p2 d1 p3 d2 d3 d4.  Parity bit p_i checks the positions whose
  //   binary number has bit i set, so the failed checks spell out the position of a single error.
  function encode(d1, d2, d3, d4) {
    var p1 = d1 ^ d2 ^ d4, p2 = d1 ^ d3 ^ d4, p3 = d2 ^ d3 ^ d4;
    return [p1, p2, d1, p3, d2, d3, d4];
  }
  function syndrome(c) {             // 0 = all checks pass, else the position (1..7) to flip
    var s1 = c[0] ^ c[2] ^ c[4] ^ c[6];
    var s2 = c[1] ^ c[2] ^ c[5] ^ c[6];
    var s3 = c[3] ^ c[4] ^ c[5] ^ c[6];
    return s1 | (s2 << 1) | (s3 << 2);
  }
  function decode(c) {               // returns the four data bits after correcting
    var s = syndrome(c), r = c.slice();
    if (s) r[s - 1] ^= 1;
    return [r[2], r[4], r[5], r[6]];
  }
  // All the picture's codewords, flattened: 160 × 7 = 1120 bits.
  var codeBits = new Uint8Array(N / 4 * 7);
  for (var k = 0; k < N / 4; k++) {
    var cw = encode(picture[4 * k], picture[4 * k + 1], picture[4 * k + 2], picture[4 * k + 3]);
    for (var j = 0; j < 7; j++) codeBits[7 * k + j] = cw[j];
  }
  function decodeAll(bits) {         // 1120 received bits -> 640 pixels
    var out = new Uint8Array(N);
    for (var k = 0; k < N / 4; k++) {
      var d = decode(Array.prototype.slice.call(bits, 7 * k, 7 * k + 7));
      out[4 * k] = d[0]; out[4 * k + 1] = d[1]; out[4 * k + 2] = d[2]; out[4 * k + 3] = d[3];
    }
    return out;
  }

  // Small seeded random number generator (mulberry32), so results are repeatable.
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Draw a W×H picture into a box; pixels that differ from the original are drawn in red.
  function drawPicture(ctx, bits, x0, y0, cell, c) {
    ctx.fillStyle = c.paper2 || c.paper;
    ctx.fillRect(x0, y0, W * cell, H * cell);
    for (var i = 0; i < N; i++) {
      var x = x0 + (i % W) * cell, y = y0 + Math.floor(i / W) * cell;
      var wrong = bits[i] !== picture[i];
      if (wrong) {
        ctx.fillStyle = c.alarm;
        ctx.fillRect(x, y, cell, cell);
      } else if (bits[i]) {
        ctx.fillStyle = c.ink;
        ctx.fillRect(x, y, cell, cell);
      }
    }
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 0.5, y0 - 0.5, W * cell + 1, H * cell + 1);
  }
  function countWrong(bits) {
    var n = 0;
    for (var i = 0; i < N; i++) if (bits[i] !== picture[i]) n++;
    return n;
  }

  return { W: W, H: H, N: N, picture: picture, encode: encode, syndrome: syndrome, decode: decode,
           codeBits: codeBits, decodeAll: decodeAll, rng: rng, drawPicture: drawPicture,
           countWrong: countWrong };
})();

/* ---- Figure 1: a noisy channel ------------------------------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("noise-canvas");
  if (!canvasEl) return;
  var N = EC.N, p = 0.05, seed = 7;
  var uPlain, uTriple, uHam;          // one uniform random number per transmitted bit
  function reseed() {
    var r = EC.rng(seed);
    uPlain = new Float64Array(N); uTriple = new Float64Array(3 * N); uHam = new Float64Array(EC.codeBits.length);
    for (var i = 0; i < N; i++) uPlain[i] = r();
    for (i = 0; i < 3 * N; i++) uTriple[i] = r();
    for (i = 0; i < uHam.length; i++) uHam[i] = r();
  }
  reseed();

  var plain, triple, ham;
  function transmit() {
    var pic = EC.picture, i;
    plain = new Uint8Array(N); triple = new Uint8Array(N);
    for (i = 0; i < N; i++) {
      plain[i] = pic[i] ^ (uPlain[i] < p ? 1 : 0);
      var votes = 0;
      for (var k = 0; k < 3; k++) votes += pic[i] ^ (uTriple[3 * i + k] < p ? 1 : 0);
      triple[i] = votes >= 2 ? 1 : 0;
    }
    var rx = new Uint8Array(EC.codeBits.length);
    for (i = 0; i < rx.length; i++) rx[i] = EC.codeBits[i] ^ (uHam[i] < p ? 1 : 0);
    ham = EC.decodeAll(rx);
    document.getElementById("noise-plain").textContent = EC.countWrong(plain) + " wrong · 640 bits sent";
    document.getElementById("noise-triple").textContent = EC.countWrong(triple) + " wrong · 1,920 bits sent";
    document.getElementById("noise-ham").textContent = EC.countWrong(ham) + " wrong · 1,120 bits sent";
    view.redraw();
  }

  var view = Orrery.canvas(canvasEl, function (ctx, w, h) {
    if (!plain) return;
    var c = Orrery.tokens();
    var panels = [["Original", EC.picture], ["No protection", plain],
                  ["Send three times, vote", triple], ["Hamming(7,4)", ham]];
    var cols = w < 560 ? 2 : 4, rows = 4 / cols, gap = 14, labelH = 20;
    var cell = Math.floor(Math.min((w - gap * (cols - 1)) / cols / EC.W,
                                   (h - rows * labelH - gap * (rows - 1)) / rows / EC.H) * 2) / 2;
    var pw = cell * EC.W, ph = cell * EC.H;
    var totalW = cols * pw + (cols - 1) * gap, ox = (w - totalW) / 2;
    ctx.font = "13px " + c.sans; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    panels.forEach(function (pn, k) {
      var col = k % cols, row = Math.floor(k / cols);
      var x = Math.round(ox + col * (pw + gap)), y = Math.round(row * (ph + labelH + gap) + labelH);
      ctx.fillStyle = c.ink2; ctx.fillText(pn[0], x, y - 6);
      EC.drawPicture(ctx, pn[1], x, y, cell, c);
    });
  });

  Orrery.bindRange(document.getElementById("noise-p"), document.getElementById("noise-p-out"), {
    format: function (v) { return Orrery.fmt.number(v, 1) + "%"; },
    onInput: function (v) { p = v / 100; transmit(); }, init: true
  });
  document.getElementById("noise-again").addEventListener("click", function () {
    seed = (seed * 9301 + 49297) % 233280; reseed(); transmit();
  });
})();

/* ---- Figure 2: Hamming(7,4) in three circles ------------------------------ */
(function () {
  "use strict";
  var svg = document.getElementById("venn-svg");
  if (!svg) return;
  var NS = "http://www.w3.org/2000/svg";
  var NAMES = ["p1", "p2", "d1", "p3", "d2", "d3", "d4"];        // positions 1..7
  // where each bit sits in the diagram (A = top left, B = top right, C = bottom)
  var POS = [[78, 78], [222, 78], [150, 70], [150, 202], [110, 146], [190, 146], [150, 128]];
  var CIRCLES = [{ name: "A", cx: 115, cy: 100, lx: 40, ly: 40 },
                 { name: "B", cx: 185, cy: 100, lx: 260, ly: 40 },
                 { name: "C", cx: 150, cy: 162, lx: 236, ly: 236 }];
  // which codeword positions each circle checks: A = p1 d1 d2 d4, B = p2 d1 d3 d4, C = p3 d2 d3 d4
  var MEMBERS = [[0, 2, 4, 6], [1, 2, 5, 6], [3, 4, 5, 6]];
  var data = [1, 0, 1, 1];
  var sent = EC.encode.apply(null, data);
  var recv = sent.slice();
  recv[5] ^= 1;                          // start with d3 already hit

  var circleEls = CIRCLES.map(function (ci) {
    var g = document.createElementNS(NS, "g");
    var c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", ci.cx); c.setAttribute("cy", ci.cy); c.setAttribute("r", 70);
    c.setAttribute("class", "venn-circle");
    var t = document.createElementNS(NS, "text");
    t.setAttribute("x", ci.lx); t.setAttribute("y", ci.ly); t.setAttribute("class", "venn-label");
    t.textContent = ci.name;
    g.appendChild(c); g.appendChild(t); svg.appendChild(g);
    return { circle: c, label: t };
  });
  var bitEls = NAMES.map(function (name, k) {
    var g = document.createElementNS(NS, "g");
    g.setAttribute("class", "venn-bit " + (name[0] === "p" ? "is-parity" : "is-data"));
    g.setAttribute("tabindex", "0"); g.setAttribute("role", "button");
    g.setAttribute("transform", "translate(" + POS[k][0] + "," + POS[k][1] + ")");
    var ring = document.createElementNS(NS, "circle"); ring.setAttribute("r", 19); ring.setAttribute("class", "ring");
    var disc = document.createElementNS(NS, "circle"); disc.setAttribute("r", 14); disc.setAttribute("class", "disc");
    var val = document.createElementNS(NS, "text"); val.setAttribute("class", "val"); val.setAttribute("y", 5);
    var lab = document.createElementNS(NS, "text"); lab.setAttribute("class", "name"); lab.setAttribute("y", 30);
    if (name === "p3") { lab.setAttribute("x", 32); lab.setAttribute("y", 5); }
    lab.textContent = name;
    g.appendChild(ring); g.appendChild(disc); g.appendChild(val); g.appendChild(lab);
    function flip() { recv[k] ^= 1; update(); }
    g.addEventListener("click", flip);
    g.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); }
    });
    svg.appendChild(g);
    return { g: g, val: val };
  });

  var outStatus = document.getElementById("venn-status");
  var outSent = document.getElementById("venn-sent");
  var outRecv = document.getElementById("venn-recv");
  var outDec = document.getElementById("venn-dec");
  var fixBtn = document.getElementById("venn-fix");

  function str(bits) { return bits.join(""); }
  function dataOf(c) { return [c[2], c[4], c[5], c[6]]; }

  function update() {
    var s = EC.syndrome(recv);
    var nWrong = 0;
    for (var k = 0; k < 7; k++) nWrong += recv[k] !== sent[k] ? 1 : 0;
    var failing = MEMBERS.map(function (m) {
      return (recv[m[0]] ^ recv[m[1]] ^ recv[m[2]] ^ recv[m[3]]) === 1;
    });
    circleEls.forEach(function (ce, i) {
      ce.circle.classList.toggle("fail", failing[i]);
      ce.label.classList.toggle("fail", failing[i]);
    });
    bitEls.forEach(function (be, k) {
      be.val.textContent = recv[k];
      be.g.classList.toggle("flipped", recv[k] !== sent[k]);
      be.g.classList.toggle("suspect", s === k + 1);
      be.g.setAttribute("aria-label", NAMES[k] + " = " + recv[k] +
        (recv[k] !== sent[k] ? ", damaged" : "") + (s === k + 1 ? ", the decoder's suspect" : "") +
        ". Press to flip.");
    });
    var decoded = EC.decode(recv);
    outSent.textContent = str(dataOf(sent));
    outRecv.textContent = str(dataOf(recv));
    outDec.textContent = str(decoded);
    var fails = ["A", "B", "C"].filter(function (n, i) { return failing[i]; });
    var msg;
    if (!s) {
      msg = nWrong === 0
        ? "All three circles have an even number of 1s. Nothing to fix. Click any bit to damage it."
        : "All three circles pass — yet " + nWrong + " bits are wrong. This many errors can turn one codeword into another valid one, and nothing looks amiss.";
    } else {
      var where = fails.length === 3 ? "in all three circles" : (fails.length === 1 ? "only in circle " + fails[0] : "in " + fails.join(" and ") + " but not " + ["A", "B", "C"].filter(function (n, i) { return !failing[i]; })[0]);
      msg = "Circle" + (fails.length > 1 ? "s " : " ") + fails.join(" and ") + (fails.length > 1 ? " fail" : " fails") +
        ". The one bit that sits " + where + " is " + NAMES[s - 1] + ", so the decoder will flip " + NAMES[s - 1] + ".";
      if (nWrong === 1) msg += " That is the right bit.";
      else if (nWrong >= 2) msg += " But " + nWrong + " bits are damaged: flipping " + NAMES[s - 1] +
        (recv[s - 1] !== sent[s - 1] ? " fixes one of them and leaves the rest." : " adds a third error. The code is confidently wrong.");
    }
    outStatus.textContent = msg;
    fixBtn.disabled = !s;
  }

  fixBtn.addEventListener("click", function () {
    var s = EC.syndrome(recv);
    if (s) { recv[s - 1] ^= 1; update(); }
  });
  document.getElementById("venn-new").addEventListener("click", function () {
    var old = str(data);
    do { for (var i = 0; i < 4; i++) data[i] = Math.random() < 0.5 ? 1 : 0; } while (str(data) === old);
    sent = EC.encode.apply(null, data); recv = sent.slice(); update();
  });
  document.getElementById("venn-reset").addEventListener("click", function () {
    recv = sent.slice(); update();
  });
  update();
})();

/* ---- Figure 3: scratch the disc ------------------------------------------- */
(function () {
  "use strict";
  var stripEl = document.getElementById("scratch-strip");
  var picEl = document.getElementById("scratch-pics");
  if (!stripEl) return;
  var NBITS = EC.codeBits.length, NCW = NBITS / 7;      // 1120 bits, 160 codewords
  var COLS = 56, ROWS = NBITS / COLS;                    // track drawn as 20 rows of 56 bits
  var DEPTHS = [1, 2, 4, 5, 8, 10, 16, 20, 32, 40, 80, 160]; // divisors of 160
  var depth = 1, len = 24, start = 500;

  // storage slot of bit j of codeword k with block interleaving of depth D
  function slotOf(k, j, D) {
    var b = Math.floor(k / D), i = k % D;
    return b * 7 * D + j * D + i;
  }
  var stored, owner, received, decoded, hitCount;
  function compute() {
    stored = new Uint8Array(NBITS); owner = new Int16Array(NBITS);
    for (var k = 0; k < NCW; k++) for (var j = 0; j < 7; j++) {
      var s = slotOf(k, j, depth);
      stored[s] = EC.codeBits[7 * k + j]; owner[s] = k;
    }
    start = Orrery.clamp(start, 0, NBITS - len);
    var readBack = stored.slice();
    hitCount = new Uint8Array(NCW);
    for (var t = start; t < start + len; t++) { readBack[t] ^= 1; hitCount[owner[t]]++; }
    // de-interleave, then decode
    received = new Uint8Array(NBITS);
    for (k = 0; k < NCW; k++) for (j = 0; j < 7; j++) received[7 * k + j] = readBack[slotOf(k, j, depth)];
    var raw = new Uint8Array(EC.N);
    for (k = 0; k < NCW; k++) { raw[4 * k] = received[7 * k + 2]; raw[4 * k + 1] = received[7 * k + 4];
      raw[4 * k + 2] = received[7 * k + 5]; raw[4 * k + 3] = received[7 * k + 6]; }
    decoded = EC.decodeAll(received);
    var multi = 0, single = 0;
    for (k = 0; k < NCW; k++) { if (hitCount[k] >= 2) multi++; else if (hitCount[k] === 1) single++; }
    var wrong = EC.countWrong(decoded);
    document.getElementById("scratch-single").textContent = single;
    document.getElementById("scratch-multi").textContent = multi;
    document.getElementById("scratch-wrong").textContent = wrong;
    document.getElementById("scratch-max").textContent = depth + (depth === 1 ? " bit" : " bits");
    document.getElementById("scratch-buffer").textContent = Orrery.fmt.number(7 * depth, 0) + " bits";
    stripEl.setAttribute("aria-valuenow", start);
    stripEl.setAttribute("aria-valuetext", "Scratch covers stored bits " + (start + 1) + " to " + (start + len) +
      "; " + wrong + " pixels wrong after correction");
    raw.wrong = EC.countWrong(raw);
    lastRaw = raw;
    stripView.redraw(); picView.redraw();
  }
  var lastRaw;

  var stripView = Orrery.canvas(stripEl, function (ctx, w, h) {
    if (!stored) return;
    var c = Orrery.tokens();
    var cell = Math.min(w / COLS, h / ROWS), ox = (w - cell * COLS) / 2, oy = (h - cell * ROWS) / 2;
    var g = cell > 6 ? 1 : 0.5;
    for (var s = 0; s < NBITS; s++) {
      var x = ox + (s % COLS) * cell, y = oy + Math.floor(s / COLS) * cell;
      var inScratch = s >= start && s < start + len;
      var bad = hitCount[owner[s]] >= 2;
      if (inScratch) ctx.fillStyle = c.alarm;
      else if (bad) ctx.fillStyle = stored[s] ? c.brass : c.brassLit;
      else ctx.fillStyle = stored[s] ? c.ink2 : c.paper3;
      if (bad && !inScratch) ctx.globalAlpha = stored[s] ? 1 : 0.55;
      ctx.fillRect(x + g / 2, y + g / 2, cell - g, cell - g);
      ctx.globalAlpha = 1;
    }
  });
  var picView = Orrery.canvas(picEl, function (ctx, w, h) {
    if (!decoded) return;
    var c = Orrery.tokens();
    var gap = 16, labelH = 20;
    var cell = Math.floor(Math.min((w - gap) / 2 / EC.W, (h - labelH) / EC.H) * 2) / 2;
    var pw = cell * EC.W, ox = Math.round((w - 2 * pw - gap) / 2);
    ctx.font = "13px " + c.sans; ctx.textAlign = "left"; ctx.fillStyle = c.ink2;
    var narrow = w < 560;
    ctx.fillText(narrow ? "As read" : "As read (before correction)", ox, labelH - 6);
    ctx.fillText(narrow ? "Corrected" : "After Hamming correction", ox + pw + gap, labelH - 6);
    EC.drawPicture(ctx, lastRaw, ox, labelH, cell, c);
    EC.drawPicture(ctx, decoded, ox + pw + gap, labelH, cell, c);
  });

  function slotAt(p) {
    var w = stripEl.clientWidth, h = stripEl.clientHeight;
    var cell = Math.min(w / COLS, h / ROWS), ox = (w - cell * COLS) / 2, oy = (h - cell * ROWS) / 2;
    var col = Orrery.clamp(Math.floor((p.x - ox) / cell), 0, COLS - 1);
    var row = Orrery.clamp(Math.floor((p.y - oy) / cell), 0, ROWS - 1);
    return row * COLS + col;
  }
  Orrery.drag(stripEl, {
    onStart: function (p) { start = slotAt(p) - Math.floor(len / 2); compute(); },
    onMove: function (p) { start = slotAt(p) - Math.floor(len / 2); compute(); },
    onNudge: function (dx, dy) { start += dx + dy * COLS; compute(); }
  });

  Orrery.bindRange(document.getElementById("scratch-len"), document.getElementById("scratch-len-out"), {
    format: function (v) { return v + " bits"; },
    onInput: function (v) { len = v; compute(); }, init: false
  });
  Orrery.bindRange(document.getElementById("scratch-depth"), document.getElementById("scratch-depth-out"), {
    format: function (v) { var d = DEPTHS[v]; return d === 1 ? "1 (none)" : d + " codewords"; },
    onInput: function (v) { depth = DEPTHS[v]; compute(); }, init: true
  });
})();

/* ---- Figure 4: a scratch on a real CD ------------------------------------- */
(function () {
  "use strict";
  var el = document.getElementById("cd-canvas");
  if (!el) return;
  var SPAN = 12;                       // mm of track shown
  var CORRECT = 2.5, CONCEAL = 7.5;    // mm: CIRC corrects ≈4,000 bits, conceals ≈12,000 bits
  var len = 4;
  var outTime = document.getElementById("cd-time");
  var outFrames = document.getElementById("cd-frames");
  var outResult = document.getElementById("cd-result");
  var slider = document.getElementById("cd-len");

  // pseudo-random pit pattern, fixed
  var r = EC.rng(11), pits = [];
  for (var row = 0; row < 3; row++) {
    var x = 0;
    while (x < SPAN) { var l = 0.00085 + r() * 0.00265; pits.push([row, x, l * 1000 * 60]); x += (l * 1000 * 60) + 0.05 + r() * 0.15; }
  }

  var view = Orrery.canvas(el, function (ctx, w, h) {
    var c = Orrery.tokens();
    var m = 14, x0 = m, x1 = w - m, sx = (x1 - x0) / SPAN;
    var top = 26, bandH = Math.max(36, h * 0.42);
    // zone bands
    [[0, CORRECT, c.verdigrisLit || c.verdigris], [CORRECT, CONCEAL, c.brassLit], [CONCEAL, SPAN, c.alarm]].forEach(function (z) {
      ctx.globalAlpha = 0.22; ctx.fillStyle = z[2];
      ctx.fillRect(x0 + z[0] * sx, top, (z[1] - z[0]) * sx, bandH);
    });
    ctx.globalAlpha = 1;
    // three turns of track with pits (schematic: not to scale)
    var rowH = bandH / 3;
    pits.forEach(function (p) {
      var px = x0 + p[1] * sx, pw = Math.max(2, p[2] * sx);
      if (p[1] > SPAN) return;
      ctx.fillStyle = c.ink3;
      ctx.fillRect(px, top + p[0] * rowH + rowH * 0.38, Math.min(pw, x1 - px), rowH * 0.24);
    });
    // the scratch, along the middle turn
    var sw = Math.min(len, SPAN) * sx;
    ctx.fillStyle = c.ink;
    ctx.beginPath();
    var yA = top + rowH * 0.9, yB = top + rowH * 2.1;
    ctx.moveTo(x0, yA);
    for (var k = 0; k <= 24; k++) ctx.lineTo(x0 + sw * k / 24, yA + ((k % 2) ? 2 : -2));
    for (k = 24; k >= 0; k--) ctx.lineTo(x0 + sw * k / 24, yB + ((k % 2) ? -2 : 2));
    ctx.closePath(); ctx.fill();
    // handle at the end of the scratch
    ctx.beginPath(); ctx.arc(x0 + sw, top + bandH / 2, 8, 0, Orrery.TAU);
    ctx.fillStyle = c.brassLit; ctx.fill(); ctx.strokeStyle = c.brass; ctx.lineWidth = 2; ctx.stroke();
    // scale and zone labels
    ctx.font = "12px " + c.sans; ctx.fillStyle = c.ink2; ctx.textAlign = "center";
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1;
    for (var mm = 0; mm <= SPAN; mm++) {
      var tx = x0 + mm * sx;
      ctx.beginPath(); ctx.moveTo(tx, top + bandH); ctx.lineTo(tx, top + bandH + (mm % 5 ? 4 : 8)); ctx.stroke();
      if (mm % 2 === 0) ctx.fillText(mm + (mm === SPAN ? " mm" : ""), Math.min(tx, x1 - 14), top + bandH + 21);
    }
    var narrow = w < 560;
    ctx.textAlign = "left";
    ctx.fillText(narrow ? "corrected" : "corrected exactly", x0 + 2, top - 8);
    ctx.fillText(narrow ? "concealed" : "concealed by interpolation", x0 + CORRECT * sx + 2, top - 8);
    ctx.fillText("audible", x0 + CONCEAL * sx + 2, top - 8);
  });

  function update() {
    var t12 = len / 1.2, t14 = len / 1.4;               // ms, since mm ÷ (m/s) = ms
    outTime.textContent = Orrery.fmt.number(t14, 1) + "–" + Orrery.fmt.number(t12, 1) + " ms";
    outFrames.textContent = Orrery.fmt.number(44.1 * t14, 0) + "–" + Orrery.fmt.number(44.1 * t12, 0);
    outResult.textContent = len <= CORRECT ? "Corrected exactly" :
      (len <= CONCEAL ? "Concealed: missing samples guessed from neighbours" : "Too long: you may hear a click, a skip or a brief silence");
    el.setAttribute("aria-valuenow", len);
    el.setAttribute("aria-valuetext", Orrery.fmt.number(len, 1) + " mm: " + outResult.textContent);
    view.redraw();
  }
  var bound = Orrery.bindRange(slider, document.getElementById("cd-len-out"), {
    format: function (v) { return Orrery.fmt.number(v, 1) + " mm"; },
    onInput: function (v) { len = v; update(); }, init: true
  });
  function fromX(p) {
    var w = el.clientWidth, sx = (w - 28) / SPAN;
    bound.set(Math.round(Orrery.clamp((p.x - 14) / sx, 0.1, 10) * 10) / 10);
    len = bound.value(); update();
  }
  Orrery.drag(el, {
    onStart: fromX, onMove: fromX,
    onNudge: function (dx, dy) { bound.set(Orrery.clamp(len + 0.1 * (dx - dy), 0.1, 10)); len = bound.value(); update(); }
  });
})();
