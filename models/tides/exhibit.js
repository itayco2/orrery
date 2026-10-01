/* Tides exhibit: "Why are there two tides a day?"
   One IIFE per figure. Numbers and checks: company/work/tides/notes.md.
   Physical constants (SI). */
var TIDES = (function () {
  "use strict";
  var R = 6.371e6;                 // Earth's mean radius, m
  var GM_MOON = 4.9028e12;         // m^3/s^2
  var GM_SUN = 1.32712e20;         // m^3/s^2
  var D_MOON = 3.844e8;            // mean Earth–Moon distance, m (60.3 Earth radii)
  var D_SUN = 1.496e11;            // 1 au, m
  var M_RATIO_MOON = 7.342e22 / 5.972e24;   // Moon mass / Earth mass
  var M_RATIO_SUN = 1.989e30 / 5.972e24;
  // Equilibrium-tide height scale (rigid Earth): h = A · (3cos²θ − 1)/2
  var A_MOON = M_RATIO_MOON * Math.pow(R / D_MOON, 3) * R;   // 0.357 m
  var A_SUN = M_RATIO_SUN * Math.pow(R / D_SUN, 3) * R;      // 0.164 m
  function P2(c) { return (3 * c * c - 1) / 2; }
  return {
    R: R, GM_MOON: GM_MOON, GM_SUN: GM_SUN, D_MOON: D_MOON, D_SUN: D_SUN,
    A_MOON: A_MOON, A_SUN: A_SUN, P2: P2,
    SIDEREAL_DAY_H: 23.9345, SIDEREAL_MONTH_H: 27.3217 * 24, SYNODIC_MONTH_D: 29.5306
  };
})();

/* Small local helpers (not in the kit). */
function tidesArrow(ctx, x0, y0, x1, y1, head) {
  var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  if (L < 2) return;
  var hl = Math.min(head, L * 0.45), ux = dx / L, uy = dy / L;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - hl * ux + hl * 0.5 * uy, y1 - hl * uy - hl * 0.5 * ux);
  ctx.lineTo(x1 - hl * ux - hl * 0.5 * uy, y1 - hl * uy + hl * 0.5 * ux);
  ctx.closePath(); ctx.fill();
}
function tidesSci(v, digits) {           // 1.10 × 10⁻⁶
  if (v === 0) return "0";
  var e = Math.floor(Math.log(Math.abs(v)) / Math.LN10), m = v / Math.pow(10, e);
  if (Math.abs(m) >= 9.995) { m /= 10; e += 1; }
  var sup = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  var es = String(e).replace(/[-0-9]/g, function (ch) { return sup[ch]; });
  return m.toFixed(digits) + " × 10" + es;
}

/* ---- Figure 1: the stretch -------------------------------------------------
   Exact pull of the Moon at 16 points on Earth's surface, optionally minus the
   pull at Earth's centre. Moon distance by slider or by dragging the Moon. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("stretch-canvas");
  if (!canvasEl) return;
  var T = TIDES, TAU = Orrery.TAU;
  var DMIN = 20, DMAX = 120;            // Earth radii
  var d = 60.3;                          // Earth radii
  var tidal = false;
  var geom = null;
  var input = document.getElementById("stretch-dist");
  var out = document.getElementById("stretch-dist-out");
  var oPull = document.getElementById("stretch-pull");
  var oTide = document.getElementById("stretch-tide");
  var oPullX = document.getElementById("stretch-pull-x");
  var oTideX = document.getElementById("stretch-tide-x");
  var oNear = document.getElementById("stretch-near");
  var mag = document.getElementById("stretch-mag");

  // acceleration toward the Moon at point (x, y) [m], Moon at (D, 0)
  function acc(x, y, D) {
    var dx = D - x, dy = -y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
    var k = T.GM_MOON / (r2 * r);
    return [k * dx, k * dy];
  }
  function nearTidal(Dm) { return T.GM_MOON / Math.pow(Dm - T.R, 2) - T.GM_MOON / (Dm * Dm); }

  function xOfD(dist, g) {          // log scale from Earth's edge to the right margin
    var f = Math.log(dist / DMIN) / Math.log(DMAX / DMIN);
    return g.x0 + f * (g.x1 - g.x0);
  }
  function dOfX(x, g) {
    var f = Orrery.clamp((x - g.x0) / (g.x1 - g.x0), 0, 1);
    return DMIN * Math.pow(DMAX / DMIN, f);
  }

  var view = Orrery.canvas(canvasEl, function (ctx, w, h) {
    var c = Orrery.tokens();
    var rE = Math.min(h * 0.27, w * 0.14);
    var cx = Math.max(rE * 2.0, w * 0.24), cy = h / 2;
    var g = geom = { cx: cx, cy: cy, rE: rE, x0: cx + rE * 2.1, x1: w - Math.max(18, rE * 0.35) };
    var D = d * T.R;
    var ac = acc(0, 0, D), acMag = Math.sqrt(ac[0] * ac[0] + ac[1] * ac[1]);
    var L = rE * 0.75;                               // drawn length of the centre pull
    var nearT = nearTidal(D);
    var tScale = (rE * 0.85) / nearT;                 // px per (m/s²) for tidal arrows

    // distance axis
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(g.x1, cy); ctx.stroke();
    ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans; ctx.textAlign = "center";
    var ticks = (g.x1 - g.x0) > 260 ? [20, 30, 60, 120] : [20, 60, 120];
    var ty = cy + rE * 1.15;
    ticks.forEach(function (v) {
      var x = xOfD(v, g);
      ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x, ty + 5); ctx.stroke();
      ctx.textAlign = v === 120 ? "right" : (v === 20 ? "left" : "center");
      ctx.fillText(String(v), v === 120 ? x + 4 : (v === 20 ? x - 4 : x), ty + 18);
    });
    ctx.textAlign = "right";
    ctx.fillText("Distance in Earth radii (squeezed scale)", g.x1 + 4, Math.min(h - 8, ty + 36));

    // Earth
    ctx.beginPath(); ctx.arc(cx, cy, rE, 0, TAU);
    ctx.fillStyle = c.paper3 || c.paper2; ctx.fill();
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.5; ctx.stroke();

    // arrows at 16 surface points, plus the centre
    ctx.lineWidth = 2;
    for (var i = 0; i <= 16; i++) {
      var ang = i * TAU / 16, ux = i < 16 ? Math.cos(ang) : 0, uy = i < 16 ? Math.sin(ang) : 0;
      var a = acc(ux * T.R, uy * T.R, D);
      var vx, vy;
      if (tidal) { vx = (a[0] - ac[0]) * tScale; vy = (a[1] - ac[1]) * tScale; }
      else { vx = a[0] / acMag * L; vy = a[1] / acMag * L; }
      var px = cx + ux * rE, py = cy - uy * rE;
      if (i === 16) { ctx.strokeStyle = c.ink3; ctx.fillStyle = c.ink3; }
      else { ctx.strokeStyle = c.brass; ctx.fillStyle = c.brass; }
      if (i === 16 && tidal) { ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill(); continue; }
      tidesArrow(ctx, px, py, px + vx, py - vy, 7);
    }

    // Moon
    var mx = xOfD(d, g), mr = Math.max(7, rE * 0.27);
    ctx.beginPath(); ctx.arc(mx, cy, mr, 0, TAU);
    ctx.fillStyle = c.ink3; ctx.fill();
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = c.ink2; ctx.textAlign = "center"; ctx.font = "12px " + c.sans;
    ctx.fillText("Moon", mx, cy - mr - 8);
    ctx.fillText(tidal ? "Pull minus the pull at the centre" : "The Moon’s pull", cx, Math.max(14, cy - rE * 1.75));

    // readouts
    var pull0 = T.GM_MOON / (T.D_MOON * T.D_MOON), tide0 = nearTidal(T.D_MOON);
    oPull.textContent = tidesSci(acMag, 2) + " m/s²";
    oTide.textContent = tidesSci(nearT, 2) + " m/s²";
    oPullX.textContent = "×" + Orrery.fmt.number(acMag / pull0, 2);
    oTideX.textContent = "×" + Orrery.fmt.number(nearT / tide0, 2);
    var nearPull = T.GM_MOON / Math.pow(D - T.R, 2);
    oNear.textContent = Orrery.fmt.percent(nearPull / acMag - 1, 1);
    mag.textContent = tidal
      ? "Tidal arrows are drawn " + Orrery.fmt.number(tScale * acMag / L, 0) + " times larger than the pull arrows."
      : "All arrows are drawn to the same scale.";
  });

  var range = Orrery.bindRange(input, out, {
    format: function (v) { return Orrery.fmt.number(v, 1) + " Earth radii (" + Orrery.fmt.number(v * 6371 / 1000, 0) + " thousand km)"; },
    onInput: function (v) { d = v; view.redraw(); }
  });

  document.getElementById("stretch-tidal").addEventListener("change", function (e) {
    tidal = e.target.checked; view.redraw();
  });

  Orrery.drag(canvasEl, {
    onStart: function (p) {
      if (!geom || p.x < geom.x0 - geom.rE * 0.5) return false;
      range.set(Math.round(dOfX(p.x, geom) * 10) / 10);
    },
    onMove: function (p) { range.set(Math.round(dOfX(p.x, geom) * 10) / 10); }
  });
})();

/* ---- Figure 2: two bulges, one turning Earth -------------------------------
   Seen from above the North Pole. Equilibrium lunar tide at a point on the
   equator: h = A·P2(cos θ), θ = angle between the point and the Moon.
   Earth turns once per sidereal day; the Moon goes round once per sidereal
   month (unless held still). High tides are found exactly where θ crosses kπ. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("turn-canvas");
  if (!canvasEl) return;
  var T = TIDES, TAU = Orrery.TAU;
  var WIN = 50;                                 // hours of history shown
  var wE = TAU / T.SIDEREAL_DAY_H, wM = TAU / T.SIDEREAL_MONTH_H;
  var t = 0, earthA = -Math.PI / 2, moonA = 0;  // radians
  var hold = false, speed = 3;                  // model hours per second
  var samples = [], highs = [], rhythmFrom = -Infinity;
  var oTime = document.getElementById("turn-time");
  var oLevel = document.getElementById("turn-level");
  var oGap = document.getElementById("turn-gap");

  function level(theta) { return T.A_MOON * T.P2(Math.cos(theta)); }
  // history before t = 0 with the Moon orbiting
  (function prefill() {
    var rel = wE - wM, th0 = earthA - moonA;
    for (var s = -WIN - 1; s <= 0; s += 0.1) samples.push([s, level(th0 + rel * s)]);
    var kLo = Math.ceil((th0 + rel * (-WIN - 1)) / Math.PI), kHi = Math.floor(th0 / Math.PI);
    for (var k = kLo; k <= kHi; k++) highs.push((k * Math.PI - th0) / rel);
  })();

  function fmtHM(hours) {
    var m = Math.round(hours * 60), hh = Math.floor(m / 60);
    return hh + " h " + (m - hh * 60) + " min";
  }

  var view = Orrery.canvas(canvasEl, function (ctx, w, h) {
    var c = Orrery.tokens();
    var narrow = w < 560;
    var ex, ey, rE, px0, px1, py0, py1;
    if (narrow) {
      rE = Math.min(w * 0.2, h * 0.17); ex = w / 2; ey = rE * 1.75 + 6;
      px0 = 54; px1 = w - 12; py0 = ey + rE * 2.3; py1 = h - 26;
    } else {
      rE = Math.min(h * 0.26, w * 0.12); ex = rE * 1.9; ey = h / 2;
      px0 = ex + rE * 3.4 + 40; px1 = w - 14; py0 = 20; py1 = h - 30;
    }
    var thetaNow = earthA - moonA;

    // Moon (not to scale) on a small orbit circle
    var orbR = rE * 1.6, mx = ex + orbR * Math.cos(moonA), my = ey - orbR * Math.sin(moonA);
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(ex, ey, orbR, 0, TAU); ctx.stroke(); ctx.setLineDash([]);

    // water: exaggerated equilibrium shape
    var K = 0.2 / T.A_MOON;                   // 0.36 m drawn as 0.2 Earth radii — hugely exaggerated
    ctx.beginPath();
    for (var i = 0; i <= 120; i++) {
      var a = i * TAU / 120, r = rE * (1.06 + K * level(a - moonA) * 0.5);
      var x = ex + r * Math.cos(a), y = ey - r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = c.verdigrisLit; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.2; ctx.stroke();
    // Earth
    ctx.beginPath(); ctx.arc(ex, ey, rE, 0, TAU); ctx.fillStyle = c.paper2; ctx.fill();
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.stroke();
    // a meridian line to show the turning
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + rE * Math.cos(earthA), ey - rE * Math.sin(earthA));
    ctx.strokeStyle = c.rule; ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, TAU); ctx.fillStyle = c.ink3; ctx.fill();
    // coast marker
    var cr = rE * (1.06 + K * level(thetaNow) * 0.5);
    var cxm = ex + cr * Math.cos(earthA), cym = ey - cr * Math.sin(earthA);
    ctx.beginPath(); ctx.arc(cxm, cym, 6, 0, TAU); ctx.fillStyle = c.brassLit; ctx.fill();
    ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(mx, my, Math.max(6, rE * 0.2), 0, TAU); ctx.fillStyle = c.ink3; ctx.fill();
    ctx.fillStyle = c.ink2; ctx.font = "12px " + c.sans; ctx.textAlign = "center";
    ctx.fillText("Moon", mx, my - Math.max(6, rE * 0.2) - 6);
    ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans;
    ctx.fillText("Bulges exaggerated", ex, Math.min(ey + orbR + 18, narrow ? py0 - 18 : h - 8));

    // plot: level at the marker over the last WIN hours
    var hMax = 0.4, hMin = -0.22;
    function X(s) { return px1 - (t - s) / WIN * (px1 - px0); }
    function Y(v) { return py1 - (v - hMin) / (hMax - hMin) * (py1 - py0); }
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px0, Y(0)); ctx.lineTo(px1, Y(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px0, py1); ctx.stroke();
    ctx.fillStyle = c.ink3; ctx.textAlign = "right"; ctx.font = "11px " + c.sans;
    [[0.3, "+30 cm"], [0, "0"], [-0.15, "−15 cm"]].forEach(function (q) {
      ctx.fillText(q[1], px0 - 4, Y(q[0]) + 4);
    });
    ctx.textAlign = "right"; ctx.fillText("now", px1, py1 + 16);
    ctx.textAlign = "left"; ctx.fillText(WIN + " h ago", px0, py1 + 16);
    for (var hh = Math.ceil((t - WIN) / 12) * 12; hh <= t; hh += 12) {   // 12 h grid
      ctx.beginPath(); ctx.moveTo(X(hh), py1); ctx.lineTo(X(hh), py1 - 4); ctx.stroke();
    }
    ctx.beginPath();
    var started = false;
    for (var j = 0; j < samples.length; j++) {
      if (samples[j][0] < t - WIN) continue;
      var sx = X(samples[j][0]), sy = Y(samples[j][1]);
      if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2; ctx.stroke();
    // high-tide marks and the last interval
    var shown = highs.filter(function (s) { return s >= t - WIN; });
    ctx.fillStyle = c.brass; ctx.strokeStyle = c.brass; ctx.lineWidth = 1;
    shown.forEach(function (s) { ctx.beginPath(); ctx.arc(X(s), Y(T.A_MOON), 3.5, 0, TAU); ctx.fill(); });
    if (shown.length >= 2) {
      var a1 = shown[shown.length - 2], a2 = shown[shown.length - 1], yb = Y(T.A_MOON) - 10;
      ctx.beginPath(); ctx.moveTo(X(a1), yb); ctx.lineTo(X(a2), yb); ctx.stroke();
      ctx.textAlign = "center"; ctx.fillStyle = c.ink2; ctx.font = "12px " + c.sans;
      var lx = Orrery.clamp((X(a1) + X(a2)) / 2, px0 + 40, px1 - 40);
      ctx.fillText(fmtHM(a2 - a1), lx, yb - 5);
    }
    ctx.beginPath(); ctx.arc(px1, Y(level(thetaNow)), 4, 0, TAU); ctx.fillStyle = c.brassLit; ctx.fill();

    oTime.textContent = fmtHM(t);
    oLevel.textContent = Orrery.fmt.signed(level(thetaNow) * 100, 0) + " cm";
    var fresh = highs.filter(function (s) { return s >= rhythmFrom; });
    var last = fresh.length >= 2 ? fresh[fresh.length - 1] - fresh[fresh.length - 2] : NaN;
    oGap.textContent = isFinite(last) ? fmtHM(last) : "waiting for two high tides";
  });

  function advance(dh) {
    var th1 = earthA - moonA;
    var rel = wE - (hold ? 0 : wM);
    var th2 = th1 + rel * dh;
    for (var k = Math.floor(th1 / Math.PI) + 1; k * Math.PI <= th2; k++) {
      highs.push(t + (k * Math.PI - th1) / rel);
    }
    t += dh; earthA += wE * dh; if (!hold) moonA += wM * dh;
    samples.push([t, level(earthA - moonA)]);
    while (samples.length > 2 && samples[1][0] < t - WIN - 1) samples.shift();
    while (highs.length > 8) highs.shift();
  }

  function step(dt) {
    var dh = dt * speed, n = Math.max(1, Math.ceil(dh / 0.05));
    for (var i = 0; i < n; i++) advance(dh / n);
    view.redraw();
  }

  Orrery.loop(canvasEl, step, { button: document.getElementById("turn-play"), autoplay: true });
  Orrery.bindRange(document.getElementById("turn-speed"), document.getElementById("turn-speed-out"), {
    format: function (v) { return Orrery.fmt.number(v, 0) + " h per second"; },
    onInput: function (v) { speed = v; }
  });
  document.getElementById("turn-hold").addEventListener("change", function (e) {
    hold = e.target.checked;
    rhythmFrom = t;                          // new rhythm: time the next two high tides afresh
    view.redraw();
  });
  document.getElementById("turn-step").addEventListener("click", function () {
    for (var i = 0; i < 20; i++) advance(0.05);
    view.redraw();
  });
})();

/* ---- Figure 3: Sun and Moon ------------------------------------------------
   Equilibrium tides from both, added. The Sun is off to the left; the Moon's
   position is set by the days since new moon. Range = max − min of the summed
   height around the equator (sampled at 1° steps). */
(function () {
  "use strict";
  var canvasEl = document.getElementById("sun-canvas");
  if (!canvasEl) return;
  var T = TIDES, TAU = Orrery.TAU;
  var days = 7.4;
  var geom = null;
  var oPhase = document.getElementById("sun-phase");
  var oRange = document.getElementById("sun-range");
  var oRel = document.getElementById("sun-rel");

  function moonAngle(dd) { return Math.PI + TAU * dd / T.SYNODIC_MONTH_D; }
  function heightAt(a, ma) { return T.A_MOON * T.P2(Math.cos(a - ma)) + T.A_SUN * T.P2(Math.cos(a - Math.PI)); }
  function rangeFor(dd) {
    var ma = moonAngle(dd), lo = Infinity, hi = -Infinity;
    for (var i = 0; i < 360; i++) {
      var v = heightAt(i * TAU / 360, ma);
      if (v < lo) lo = v; if (v > hi) hi = v;
    }
    return hi - lo;
  }
  var SPRING = rangeFor(0), NEAP = rangeFor(T.SYNODIC_MONTH_D / 4);

  function phaseName(dd) {
    var f = dd / T.SYNODIC_MONTH_D;
    var names = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon",
                 "Waning gibbous", "Last quarter", "Waning crescent"];
    return names[Math.round(f * 8) % 8];
  }

  var view = Orrery.canvas(canvasEl, function (ctx, w, h) {
    var c = Orrery.tokens();
    var narrow = w < 560;
    var ex, ey, rE, px0, px1, py0, py1;
    if (narrow) {
      rE = Math.min(w * 0.16, h * 0.13); ex = w / 2 + rE * 0.4; ey = rE * 2.5 + 8;
      px0 = 54; px1 = w - 12; py0 = ey + rE * 3.1; py1 = h - 28;
    } else {
      rE = Math.min(h * 0.17, w * 0.09); ex = rE * 3.6; ey = h / 2;
      px0 = ex + rE * 3.3 + 40; px1 = w - 14; py0 = 20; py1 = h - 30;
    }
    var orbR = rE * 2.3, ma = moonAngle(days);
    geom = { ex: ex, ey: ey, orbR: orbR };

    // sunlight from the left
    ctx.fillStyle = c.brass; ctx.strokeStyle = c.brass; ctx.lineWidth = 1.2;
    for (var k = -1; k <= 1; k++) {
      var yy = ey + k * rE * 0.9;
      tidesArrow(ctx, 6, yy, Math.max(20, ex - orbR - 14), yy, 6);
    }
    ctx.font = "11px " + c.sans; ctx.textAlign = "left";
    ctx.fillText("Sunlight", 6, ey - rE * 0.9 - 8);

    ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(ex, ey, orbR, 0, TAU); ctx.stroke(); ctx.setLineDash([]);

    var K = 0.13 / T.A_MOON;
    function outline(fn) {
      ctx.beginPath();
      for (var i = 0; i <= 120; i++) {
        var a = i * TAU / 120, r = rE * (1.08 + K * fn(a));
        var x = ex + r * Math.cos(a), y = ey - r * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    outline(function (a) { return heightAt(a, ma); });
    ctx.fillStyle = c.verdigrisLit; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([4, 3]); ctx.lineWidth = 1.2;
    outline(function (a) { return T.A_SUN * T.P2(Math.cos(a - Math.PI)); });
    ctx.strokeStyle = c.brass; ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(ex, ey, rE, 0, TAU); ctx.fillStyle = c.paper2; ctx.fill();
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.stroke();

    // Moon with its lit half facing the Sun (left)
    var mx = ex + orbR * Math.cos(ma), my = ey - orbR * Math.sin(ma), mr = Math.max(7, rE * 0.28);
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fillStyle = c.ink3; ctx.fill();
    ctx.beginPath(); ctx.arc(mx, my, mr, Math.PI / 2, 3 * Math.PI / 2); ctx.closePath();
    ctx.fillStyle = c.brassLit; ctx.fill();
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.strokeStyle = c.ink2; ctx.stroke();

    // plot: range around the equator over one lunar month
    var vMax = 0.85, vMin = 0;
    function X(dd) { return px0 + dd / T.SYNODIC_MONTH_D * (px1 - px0); }
    function Y(v) { return py1 - (v - vMin) / (vMax - vMin) * (py1 - py0); }
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px0, py1); ctx.lineTo(px1, py1); ctx.stroke();
    ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans; ctx.textAlign = "right";
    [0, 0.25, 0.5, 0.75].forEach(function (v) {
      ctx.fillText(Math.round(v * 100) + " cm", px0 - 4, Y(v) + 4);
      ctx.beginPath(); ctx.moveTo(px0, Y(v)); ctx.lineTo(px0 + 4, Y(v)); ctx.stroke();
    });
    ctx.textAlign = "center";
    [[0, "new"], [7.38, "1st qtr"], [14.77, "full"], [22.15, "last qtr"], [29.53, "new"]].forEach(function (q) {
      ctx.fillText(q[1], Orrery.clamp(X(q[0]), px0 + 12, px1 - 12), py1 + 15);
    });
    // Moon-only level for comparison
    ctx.setLineDash([4, 3]); ctx.strokeStyle = c.ink3;
    ctx.beginPath(); ctx.moveTo(px0, Y(1.5 * T.A_MOON)); ctx.lineTo(px1, Y(1.5 * T.A_MOON)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "left"; ctx.fillText("Moon alone", px0 + 6, Y(1.5 * T.A_MOON) - 4);
    ctx.beginPath();
    for (var s = 0; s <= 120; s++) {
      var dd = s / 120 * T.SYNODIC_MONTH_D, x = X(dd), y = Y(rangeFor(dd));
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2; ctx.stroke();
    var rNow = rangeFor(days);
    ctx.beginPath(); ctx.arc(X(days), Y(rNow), 5, 0, TAU); ctx.fillStyle = c.brassLit; ctx.fill();
    ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = c.ink2; ctx.textAlign = "center"; ctx.font = "12px " + c.sans;
    ctx.fillText("Tidal range over a lunar month", (px0 + px1) / 2, py0 - 4 < 12 ? 12 : py0 - 4);

    oPhase.textContent = phaseName(days);
    oRange.textContent = Orrery.fmt.number(rNow * 100, 0) + " cm";
    oRel.textContent = Orrery.fmt.percent(rNow / SPRING, 0) + " of spring";
  });

  var range = Orrery.bindRange(document.getElementById("sun-days"), document.getElementById("sun-days-out"), {
    format: function (v) { return Orrery.fmt.number(v, 1) + " days"; },
    onInput: function (v) { days = v; view.redraw(); }
  });

  function setFromPointer(p) {
    if (!geom) return;
    var a = Math.atan2(-(p.y - geom.ey), p.x - geom.ex);
    var dd = ((a - Math.PI) / TAU % 1 + 1) % 1 * T.SYNODIC_MONTH_D;
    range.set(Math.round(dd * 10) / 10);
  }
  Orrery.drag(canvasEl, {
    onStart: function (p) {
      if (!geom) return false;
      var dx = p.x - geom.ex, dy = p.y - geom.ey, r = Math.sqrt(dx * dx + dy * dy);
      if (r > geom.orbR * 1.6) return false;
      setFromPointer(p);
    },
    onMove: setFromPointer
  });

  var playBtn = document.getElementById("sun-play");
  var acc = days;                          // un-rounded animation clock
  Orrery.loop(canvasEl, function (dt) {
    if (Math.abs(acc - days) > 0.2) acc = days;   // the reader moved the slider
    acc = (acc + dt * 2) % T.SYNODIC_MONTH_D;
    range.set(Math.round(acc * 10) / 10);
  }, { button: playBtn, autoplay: false, labels: { play: "Run the month", pause: "Pause" } });
})();
