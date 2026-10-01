/* Exhibit script for "Why is the sky blue and the sunset red?"
   One IIFE per figure; the physics is in model.js (window.Sky). */

/* Shared helpers */
var SkyUI = (function () {
  "use strict";
  var S = window.Sky;
  var colCache = {};
  function wl(l) {                       // CSS colour of a wavelength, cached per nm
    var k = Math.round(l);
    if (!colCache[k]) colCache[k] = S.wavelengthCss(k);
    return colCache[k];
  }
  function name(spec) {                  // plain-language name of a spectrum's colour
    var d = S.dominant(spec);
    if (!d || d.purity < 0.06) return "white";
    var n = d.nm, base = n < 445 ? "violet" : n < 492 ? "blue" : n < 510 ? "blue-green" :
      n < 560 ? "green" : n < 575 ? "yellow-green" : n < 585 ? "yellow" : n < 605 ? "orange" : "red";
    if (d.purity < 0.2) return "nearly white, a little " + base;
    if (d.purity < 0.45) return "pale " + base;
    return base;
  }
  return { wl: wl, name: name };
})();

/* ---- Figure 1: grains of light crossing a box of air ---------------------- */
(function () {
  "use strict";
  var S = window.Sky, F = Orrery.fmt;
  var canvasEl = document.getElementById("scatter-canvas");
  var curveEl = document.getElementById("curve-canvas");
  if (!canvasEl || !curveEl) return;
  var T450 = S.tau(450), T700 = S.tau(700);
  var BOX_DEPTH = 0.8;                   // optical depth of the box at 450 nm
  var CROSS = 2.2;                       // seconds for a grain to cross the box
  var white = true, lambda = 450;
  var grains = [], spawnAcc = 0, seed = 7;
  function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // sample wavelengths 400-700 nm in proportion to sunlight
  var cdf = [], tot = 0, sampWL = [];
  S.WL.forEach(function (l, i) { if (l >= 400 && l <= 700) { tot += S.SUN[i]; cdf.push(tot); sampWL.push(l); } });
  function sampleWL() {
    if (!white) return lambda;
    var r = rand() * tot;
    for (var i = 0; i < cdf.length; i++) if (r <= cdf[i]) return sampWL[i] + (rand() - 0.5) * 5;
    return 700;
  }
  var molecules = [];
  for (var m = 0; m < 70; m++) molecules.push([rand(), rand()]);

  var geom = { w: 400, h: 300 };
  function box() {
    var w = geom.w, h = geom.h;
    return { x0: w * 0.1, x1: w * 0.9, y0: h * 0.2, y1: h * 0.84 };
  }

  function step(dt) {
    var b = box(), speed = (b.x1 - b.x0) / CROSS, ym = (b.y0 + b.y1) / 2, bh = (b.y1 - b.y0) * 0.07;
    spawnAcc += dt * 70;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      grains.push({ x: 0, y: ym + (rand() * 2 - 1) * bh, vx: speed, vy: 0, l: sampleWL(), s: false });
    }
    var keep = [];
    for (var i = 0; i < grains.length; i++) {
      var g = grains[i];
      if (!g.s && g.x > b.x0 && g.x < b.x1) {
        var rate = BOX_DEPTH * (S.tau(g.l) / T450) / CROSS;
        if (rand() < 1 - Math.exp(-rate * dt)) {
          var a = rand() * Orrery.TAU;
          g.vx = speed * Math.cos(a); g.vy = speed * Math.sin(a); g.s = true;
        }
      }
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (g.x > -5 && g.x < geom.w + 5 && g.y > -5 && g.y < geom.h + 5) keep.push(g);
    }
    grains = keep.length > 900 ? keep.slice(keep.length - 900) : keep;
    view.redraw();
  }

  function draw(ctx, w, h) {
    geom.w = w; geom.h = h;
    var c = Orrery.tokens(), b = box();
    ctx.fillStyle = "#0e1220";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
    ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    molecules.forEach(function (p) {
      ctx.beginPath(); ctx.arc(b.x0 + p[0] * (b.x1 - b.x0), b.y0 + p[1] * (b.y1 - b.y0), 1.4, 0, Orrery.TAU); ctx.fill();
    });
    for (var i = 0; i < grains.length; i++) {
      var g = grains[i];
      ctx.fillStyle = SkyUI.wl(g.l);
      ctx.beginPath(); ctx.arc(g.x, g.y, g.s ? 2.4 : 2, 0, Orrery.TAU); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "12px " + c.sans;
    ctx.textAlign = "left"; ctx.fillText(white ? "white light in" : "light in", 6, b.y0 - 8);
    ctx.textAlign = "right"; ctx.fillText("through", w - 6, b.y0 - 8);
    ctx.textAlign = "center"; ctx.fillText("air (molecules shown as dots)", w / 2, h - 8);
  }
  var view = Orrery.canvas(canvasEl, draw);
  for (var k = 0; k < 120; k++) step(1 / 30);      // start with the box already full of light

  function drawCurve(ctx, w, h) {
    var c = Orrery.tokens();
    var ml = 34, mr = 10, mt = 14, mb = 34;
    var L0 = 380, L1 = 750, YMAX = 13;
    function X(l) { return ml + (l - L0) / (L1 - L0) * (w - ml - mr); }
    function Y(v) { return h - mb - v / YMAX * (h - mt - mb); }
    for (var l = L0; l < L1; l += 2) {
      var v = S.tau(l + 1) / T700;
      ctx.fillStyle = l <= 700 ? SkyUI.wl(l + 1) : c.paper3;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(X(l), Y(v), X(l + 2) - X(l) + 0.5, Y(0) - Y(v));
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    for (l = L0; l <= L1; l += 2) { var y = Y(S.tau(l) / T700); if (l === L0) ctx.moveTo(X(l), y); else ctx.lineTo(X(l), y); }
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ml, Y(0)); ctx.lineTo(w - mr, Y(0)); ctx.moveTo(ml, Y(0)); ctx.lineTo(ml, mt); ctx.stroke();
    ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans; ctx.textAlign = "center";
    [400, 500, 600, 700].forEach(function (t) { ctx.fillText(t, X(t), Y(0) + 13); });
    ctx.fillText("wavelength (nm)", (ml + w - mr) / 2, h - 6);
    ctx.textAlign = "right";
    [0, 5, 10].forEach(function (t) { ctx.fillText(t, ml - 5, Y(t) + 4); });
    ctx.textAlign = "left"; ctx.fillText("scattering, × red", ml + 6, mt + 4);
    if (!white) {
      var lv = S.tau(lambda) / T700;
      ctx.strokeStyle = c.ink; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(X(lambda), Y(0)); ctx.lineTo(X(lambda), Y(lv)); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(X(lambda), Y(lv), 5, 0, Orrery.TAU);
      ctx.fillStyle = c.paper; ctx.fill(); ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = c.ink; ctx.textAlign = X(lambda) > w * 0.6 ? "right" : "left";
      ctx.fillText("× " + F.number(lv, 1), X(lambda) + (ctx.textAlign === "left" ? 8 : -8), Y(lv) - 8);
    }
  }
  var curve = Orrery.canvas(curveEl, drawCurve);

  // Swatches: white light through the box (same optical depth as the animation).
  var thru = S.WL.map(function (l, i) { return S.SUN[i] * Math.exp(-BOX_DEPTH * S.tau(l) / T450); });
  var scat = S.WL.map(function (l, i) { return S.SUN[i] * (1 - Math.exp(-BOX_DEPTH * S.tau(l) / T450)); });
  document.getElementById("sc-sw-thru").style.background = S.colour(thru).css;
  document.getElementById("sc-sw-scat").style.background = S.colour(scat).css;
  document.getElementById("sc-sw-thru-t").textContent = SkyUI.name(thru);
  document.getElementById("sc-sw-scat-t").textContent = SkyUI.name(scat);

  var outRel = document.getElementById("sc-rel"), outAtm = document.getElementById("sc-atm");
  var whiteBox = document.getElementById("sc-white");
  function update() {
    outRel.textContent = "× " + F.number(S.tau(lambda) / T700, 1);
    outAtm.textContent = F.percent(1 - Math.exp(-S.tau(lambda)), 0);
    curve.redraw(); view.redraw();
  }
  var slider = Orrery.bindRange(document.getElementById("sc-wl"), document.getElementById("sc-wl-out"), {
    format: function (v) { return F.number(v, 0) + " nm"; },
    onInput: function (v) {
      lambda = v;
      if (white && slider) { white = false; whiteBox.checked = false; }
      update();
    }
  });
  whiteBox.addEventListener("change", function () { white = whiteBox.checked; update(); });
  update();
  Orrery.loop(canvasEl, step, { button: document.getElementById("sc-play") });
})();

/* ---- Figure 2: the Sun's path through the air ------------------------------ */
(function () {
  "use strict";
  var S = window.Sky, F = Orrery.fmt;
  var canvasEl = document.getElementById("sunset-canvas");
  if (!canvasEl) return;
  var elev = 5, beta = 0;
  var L = {};                              // layout, filled by draw
  var outAM = document.getElementById("ss-am"), out450 = document.getElementById("ss-t450"),
      out700 = document.getElementById("ss-t700"), outLum = document.getElementById("ss-lum"),
      swSun = document.getElementById("ss-sw-sun"), swSky = document.getElementById("ss-sw-sky");
  var LUM0 = S.luminance(S.SUN);
  var ROWS = 40;

  function panelElev(t) { return 90 * t * t; }          // t in [0,1] from horizon up
  function panelT(e) { return Math.sqrt(Math.max(0, e) / 90); }

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var wide = w > h * 1.25;
    var dx0, dy0, dw, dh, px0, py0, pw, ph;
    if (wide) { dx0 = 0; dy0 = 0; dw = w * 0.55; dh = h; px0 = w * 0.58; py0 = 8; pw = w * 0.42 - 8; ph = h - 16; }
    else { dx0 = 0; dy0 = 0; dw = w; dh = h * 0.5; px0 = 8; py0 = h * 0.52; pw = w - 16; ph = h * 0.48 - 8; }
    var m = S.airMass(elev), dir = S.direct(m, beta), sunCss = S.colour(dir).css;
    var hr = elev * Math.PI / 180;

    // --- diagram ---
    ctx.save();
    ctx.beginPath(); ctx.rect(dx0, dy0, dw, dh); ctx.clip();
    var R = dw * 1.3, Ha = R * 0.08;
    var ox = dx0 + dw * 0.66, oy = dy0 + dh * 0.68;
    var ecx = ox, ecy = oy + R;
    ctx.beginPath(); ctx.arc(ecx, ecy, R + Ha, 0, Orrery.TAU);
    ctx.fillStyle = "rgba(90,140,230,0.18)"; ctx.fill();
    ctx.beginPath(); ctx.arc(ecx, ecy, R, 0, Orrery.TAU);
    ctx.fillStyle = c.paper3; ctx.fill(); ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.stroke();
    // ray: from the top of the atmosphere to the observer
    var ux = -Math.cos(hr), uy = -Math.sin(hr);        // toward the Sun (screen coords, y down)
    // intersection of observer + s*u with outer circle
    var fx = ox - ecx, fy = oy - ecy, bq = fx * ux + fy * uy, cq = fx * fx + fy * fy - (R + Ha) * (R + Ha);
    var s = -bq + Math.sqrt(bq * bq - cq);
    var ex = ox + s * ux, ey = oy + s * uy;
    var Rs = Math.min(dw * 0.6, dh * 0.62);
    var sx = ox + Rs * ux, sy = oy + Rs * uy;
    ctx.strokeStyle = c.ink3; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineCap = "round";
    ctx.strokeStyle = c.ink; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ox, oy); ctx.stroke();
    var grad = ctx.createLinearGradient(ex, ey, ox, oy);
    grad.addColorStop(0, "#ffffff"); grad.addColorStop(1, sunCss);
    ctx.strokeStyle = grad; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ox, oy); ctx.stroke();
    ctx.lineCap = "butt";
    // observer
    ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Orrery.TAU); ctx.fill();
    // Sun
    ctx.beginPath(); ctx.arc(sx, sy, 13, 0, Orrery.TAU);
    ctx.fillStyle = sunCss; ctx.fill(); ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = c.ink2; ctx.font = "12px " + c.sans; ctx.textAlign = "center";
    ctx.fillText("you", ox, oy + 18);
    ctx.fillText("Sun", sx, sy - 19 > dy0 + 12 ? sy - 19 : sy + 30);
    ctx.textAlign = "left"; ctx.fillStyle = c.ink3;
    ctx.fillText("atmosphere (thickness exaggerated)", dx0 + 8, dy0 + dh - 10);
    ctx.restore();

    // --- the view: sky gradient, Sun, ground ---
    var hy = py0 + ph * 0.86;                // horizon line
    // Each row: its own colour, with brightness differences compressed (as the eye does).
    var lins = [], Ys = [], mx = 0;
    for (var i = 0; i < ROWS; i++) {
      var e = Math.max(4, panelElev((i + 0.5) / ROWS));
      var lin = S.linear(S.skyView(m, S.airMass(e), beta));
      var Yr = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
      lins.push(lin); Ys.push(Yr); mx = Math.max(mx, Yr);
    }
    var rowH = (hy - py0) / ROWS;
    for (i = 0; i < ROWS; i++) {
      var li = lins[i], top = Math.max(li[0], li[1], li[2]);
      ctx.fillStyle = S.cssFromLinear(li, Math.pow(Ys[i] / mx, 0.35) / top);
      ctx.fillRect(px0, hy - (i + 1) * rowH, pw, rowH + 0.6);
    }
    var sunY = hy - panelT(elev) * (hy - py0), sunX = px0 + pw * 0.35;
    var g2 = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 34);
    g2.addColorStop(0, sunCss); g2.addColorStop(0.3, sunCss); g2.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save(); ctx.beginPath(); ctx.rect(px0, py0, pw, hy - py0); ctx.clip();
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(sunX, sunY, 34, 0, Orrery.TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#2b2a24"; ctx.fillRect(px0, hy, pw, py0 + ph - hy);
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.strokeRect(px0 + 0.5, py0 + 0.5, pw - 1, ph - 1);
    ctx.fillStyle = "#fff"; ctx.font = "11px " + c.sans; ctx.textAlign = "right";
    ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 3;    // keeps the labels readable on pale sky
    [10, 30, 60].forEach(function (a) {
      var y = hy - panelT(a) * (hy - py0);
      ctx.fillText(a + "°", px0 + pw - 16, y + 4);
      ctx.fillRect(px0 + pw - 12, y, 7, 1);
    });
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
    ctx.textAlign = "left"; ctx.fillText("what you see", px0 + 6, py0 + ph - 7);
    L = { wide: wide, ox: ox, oy: oy, dx1: dx0 + dw, dy1: dy0 + dh, px0: px0, py0: py0, hy: hy };
  }
  var view = Orrery.canvas(canvasEl, draw);

  var range;
  function setElev(v) {
    elev = Orrery.clamp(Math.round(v * 2) / 2, 0, 90);
    if (range && range.value() !== elev) range.set(elev); else update();
  }
  function update() {
    var m = S.airMass(elev), dir = S.direct(m, beta);
    outAM.textContent = F.number(m, m < 10 ? 2 : 1);
    out450.textContent = pct(Math.exp(-S.tauTot(450, beta) * m));
    out700.textContent = pct(Math.exp(-S.tauTot(700, beta) * m));
    outLum.textContent = pct(S.luminance(dir) / LUM0);
    swSun.style.background = S.colour(dir).css;
    swSky.style.background = S.colour(S.zenithSky(m, beta)).css;
    var txt = F.number(elev, 1) + " degrees; air mass " + F.number(m, 1) + "; the Sun looks " + SkyUI.name(dir);
    canvasEl.setAttribute("aria-valuenow", elev);
    canvasEl.setAttribute("aria-valuetext", txt);
    view.redraw();
  }
  function pct(f) {
    if (f >= 0.1) return F.percent(f, 0);
    if (f >= 0.001) return F.percent(f, 1);
    if (f >= 0.00001) return F.percent(f, 3);
    return "less than 0.001%";
  }
  Orrery.bindRange(document.getElementById("ss-haze"), document.getElementById("ss-haze-out"), {
    format: function (v) { return F.number(v, 2); },
    onInput: function (v) { beta = v; update(); }
  });
  range = Orrery.bindRange(document.getElementById("ss-elev"), document.getElementById("ss-elev-out"), {
    format: function (v) { return F.number(v, 1) + "°"; },
    onInput: function (v) { elev = v; update(); }
  });

  function fromPointer(p) {
    if (p.x < L.dx1 && p.y < L.dy1 && (L.wide || p.y < L.py0)) {
      var a = Math.atan2(L.oy - p.y, L.ox - p.x) * 180 / Math.PI;   // left = 0°, up = 90°
      if (a < -45) a = 90; setElev(Orrery.clamp(a, 0, 90));
    } else if (p.x >= L.px0 && p.y >= L.py0) {
      var t = Orrery.clamp((L.hy - p.y) / (L.hy - L.py0), 0, 1);
      setElev(90 * t * t);
    }
  }
  Orrery.drag(canvasEl, {
    onStart: fromPointer, onMove: fromPointer,
    onNudge: function (dx, dy) { setElev(elev + (dy !== 0 ? -dy : dx) * 0.5); }
  });
})();

/* ---- Figure 3: why not violet? ------------------------------------------- */
(function () {
  "use strict";
  var S = window.Sky, F = Orrery.fmt;
  var canvasEl = document.getElementById("violet-canvas");
  if (!canvasEl) return;
  var n = 4, compare = false;
  var CMF = window.SKY_CMF;
  var outShare = document.getElementById("vi-share"), outDom = document.getElementById("vi-dom"),
      outPur = document.getElementById("vi-pur"), sw = document.getElementById("vi-sky"),
      vBox = document.getElementById("vi-violet-box");
  document.getElementById("vi-violet").style.background = S.wavelengthCss(410);
  var L0 = 380, L1 = 720;

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var ml = 12, mr = 12, mt = 16, mb = 34;
    function X(l) { return ml + (l - L0) / (L1 - L0) * (w - ml - mr); }
    function Y(v) { return h - mb - v / 1.1 * (h - mt - mb); }
    var spec = S.scattered(n), mx = 0, smx = 0, i, l;
    S.WL.forEach(function (l, i) { if (l <= L1) { mx = Math.max(mx, spec[i]); smx = Math.max(smx, S.SUN[i]); } });
    // filled scattered spectrum, one bar per 5 nm
    for (i = 0; i < S.WL.length && S.WL[i] < L1; i++) {
      l = S.WL[i]; var v = spec[i] / mx;
      ctx.fillStyle = SkyUI.wl(l + 2.5); ctx.globalAlpha = 0.8;
      ctx.fillRect(X(l), Y(v), X(l + 5) - X(l) + 0.5, Y(0) - Y(v));
    }
    ctx.globalAlpha = 1;
    // sunlight, dashed
    ctx.beginPath();
    S.WL.forEach(function (l, i) { if (l > L1) return; var y = Y(S.SUN[i] / smx); if (i === 0) ctx.moveTo(X(l), y); else ctx.lineTo(X(l), y); });
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    // colour-matching functions, scaled so z-bar's peak is 1
    var cols = ["#d0453a", "#2f9a4a", "#3b6fd6"], labels = ["x̄", "ȳ", "z̄"];
    for (var k = 0; k < 3; k++) {
      ctx.beginPath(); var best = 0, bl = 0;
      for (i = 0; i < CMF.data.length; i++) {
        l = CMF.start + i * CMF.step; if (l > L1) break;
        var y = Y(CMF.data[i][k] / 1.7721);
        if (CMF.data[i][k] > best) { best = CMF.data[i][k]; bl = l; }
        if (i === 0) ctx.moveTo(X(l), y); else ctx.lineTo(X(l), y);
      }
      ctx.strokeStyle = cols[k]; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = cols[k]; ctx.font = "bold 13px " + c.sans; ctx.textAlign = "center";
      ctx.fillText(labels[k], X(bl), Y(best / 1.7721) - 6);
    }
    if (compare) {
      ctx.strokeStyle = S.wavelengthCss(410); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X(410), Y(0)); ctx.lineTo(X(410), Y(1.05)); ctx.stroke();
      ctx.fillStyle = c.ink2; ctx.font = "11px " + c.sans; ctx.textAlign = "left";
      ctx.fillText("410 nm", X(410) + 5, Y(1.02));
    }
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ml, Y(0)); ctx.lineTo(w - mr, Y(0)); ctx.stroke();
    ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans; ctx.textAlign = "center";
    [400, 450, 500, 550, 600, 650, 700].forEach(function (t) { ctx.fillText(t, X(t), Y(0) + 13); });
    ctx.fillText("wavelength (nm)", w / 2, h - 6);
    ctx.textAlign = "right"; ctx.fillStyle = c.ink2;
    ctx.fillText("- - sunlight", w - mr, mt + 2);
  }
  var view = Orrery.canvas(canvasEl, draw);

  function update() {
    var spec = S.scattered(n), below = 0, all = 0;
    S.WL.forEach(function (l, i) { all += spec[i]; if (l < 450) below += spec[i]; });
    outShare.textContent = F.percent(below / all, 0);
    var d = S.dominant(spec);
    if (!d || d.purity < 0.01) { outDom.textContent = "none (white)"; outPur.textContent = "0%"; }
    else {
      outDom.textContent = F.number(d.nm, 0) + " nm (" + SkyUI.name(spec).replace(/^(pale |nearly white, a little )/, "") + ")";
      outPur.textContent = F.percent(d.purity, 0);
    }
    sw.style.background = S.colour(spec).css;
    vBox.hidden = !compare;
    view.redraw();
  }
  Orrery.bindRange(document.getElementById("vi-n"), document.getElementById("vi-n-out"), {
    format: function (v) { return F.number(v, 1); },
    onInput: function (v) { n = v; update(); }
  });
  document.getElementById("vi-cmp").addEventListener("change", function (e) { compare = e.target.checked; update(); });
  update();
})();
