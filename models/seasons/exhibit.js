/* Exhibit script: "Why is summer warm?"
   One IIFE per figure. The physics lives in model.js (window.SeasonsModel);
   this file only draws it. Day numbers d are 0 = 1 January 2026; the model is
   evaluated at noon UTC of that day (t = d + 0.5). */

var Seasons = (function () {
  "use strict";
  var M = window.SeasonsModel;
  var DEG = Math.PI / 180;
  function dayLabel(d) { return Orrery.fmt.date(M.dateOf(d), { year: false }); }
  function latLabel(v) {
    if (Math.abs(v) < 0.01) return "0° (equator)";
    return Orrery.fmt.number(Math.abs(v), Math.abs(v) % 1 ? 1 : 0) + "° " + (v > 0 ? "N" : "S");
  }
  // Light month axis for charts: x(d) maps a day to px.
  function monthAxis(ctx, c, x, yTop, yBase, compact) {
    ctx.font = "11px " + c.sans; ctx.textAlign = "center"; ctx.fillStyle = c.ink3;
    for (var m = 0; m < 12; m++) {
      var xm = x(M.MONTH_START[m]);
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xm, yBase); ctx.lineTo(xm, yBase + 4); ctx.stroke();
      var lab = compact ? M.MONTHS[m].charAt(0) : M.MONTHS[m];
      ctx.fillText(lab, (xm + x(M.MONTH_START[m + 1])) / 2, yBase + 15);
    }
  }
  return { M: M, DEG: DEG, dayLabel: dayLabel, latLabel: latLabel, monthAxis: monthAxis };
})();

/* ---- Figure 1: the orbit to scale, and sunlight through the year ------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("orbit-canvas");
  if (!canvasEl || !window.SeasonsModel) return;
  var M = Seasons.M, TAU = Orrery.TAU;
  var day = 2;
  var slider = document.getElementById("orbit-day");
  var outDist = document.getElementById("orbit-dist"), outSun = document.getElementById("orbit-sun"),
      outPct = document.getElementById("orbit-pct"), outSeason = document.getElementById("orbit-season");

  // Orbit samples, the orbit's centre, and the equinox times (Kepler's second law).
  var pts = [], sunCurve = [];
  for (var i = 0; i <= 365; i++) {
    var o = M.orbit(i * M.YEAR / 365);
    pts.push([o.x, o.y]);
  }
  for (var d = 0; d <= 365; d++) sunCurve.push(M.sunlight(M.orbit(d + 0.5).rAU));
  var phiP = M.PERI_LON_DEG * Seasons.DEG + Math.PI;           // direction of perihelion from the Sun
  var Cx = -M.E * Math.cos(phiP), Cy = -M.E * Math.sin(phiP);  // orbit centre, AU
  var tMar = M.timeOfLongitude(0, 70, 90), tSep = M.timeOfLongitude(Math.PI, 255, 276),
      tMar2 = M.timeOfLongitude(0, 435, 455);
  var halfA = tSep - tMar, halfB = tMar2 - tSep;

  var layout = null;
  var view = Orrery.canvas(canvasEl, draw);

  function computeLayout(w, h) {
    var side = w >= h * 1.25;
    var size = side ? Math.min(h, w * 0.5) : Math.min(w, h * 0.6);
    var L = { side: side, ox: side ? size / 2 : w / 2, oy: size / 2, R: size * 0.38 };
    if (side) { L.cx0 = size + 44; L.cx1 = w - 12; L.cy0 = 24; L.cy1 = h - 34; }
    else { L.cx0 = 44; L.cx1 = w - 12; L.cy0 = size + 18; L.cy1 = h - 30; }
    return L;
  }
  function toScreen(x, y) { return [layout.ox + (x - Cx) * layout.R, layout.oy - (y - Cy) * layout.R]; }

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    layout = computeLayout(w, h);
    var R = layout.R, sun = toScreen(0, 0), o = M.orbit(day + 0.5);

    // equinox and solstice lines through the Sun
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sun[0] - R * 1.12, sun[1]); ctx.lineTo(sun[0] + R * 1.12, sun[1]);
    ctx.moveTo(sun[0], sun[1] - R * 1.12); ctx.lineTo(sun[0], sun[1] + R * 1.12); ctx.stroke();

    // the comparison circle, then the true orbit
    ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.5; ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var p = toScreen(pts[i][0], pts[i][1]);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath(); ctx.stroke();
    var cc = toScreen(Cx, Cy);
    ctx.setLineDash([6, 6]); ctx.strokeStyle = c.verdigris; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cc[0], cc[1], R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);

    // labels for the equinoxes and solstices (Earth's position on those dates)
    ctx.font = "11px " + c.sans; ctx.fillStyle = c.ink3;
    ctx.textAlign = "right"; ctx.fillText("Mar", sun[0] - R * 1.02 - 4, sun[1] - 5);
    ctx.textAlign = "left"; ctx.fillText("Sep", sun[0] + R * 1.02 + 4, sun[1] - 5);
    ctx.textAlign = "center"; ctx.fillText("Jun", sun[0] + 14, sun[1] + R * 1.02 + 14);
    ctx.fillText("Dec", sun[0] + 14, sun[1] - R * 1.02 - 6);
    ctx.fillText("Mar → Sep: " + Orrery.fmt.number(halfA, 1) + " days", sun[0], sun[1] + R * 0.45);
    ctx.fillText("Sep → Mar: " + Orrery.fmt.number(halfB, 1) + " days", sun[0], sun[1] - R * 0.4);

    // Sun (enlarged)
    ctx.beginPath(); ctx.arc(sun[0], sun[1], Math.max(6, R * 0.06), 0, TAU);
    ctx.fillStyle = c.brassLit; ctx.fill(); ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();

    // Earth, the Sun–Earth line, and the direction the north pole leans (fixed in space)
    var e = toScreen(o.x, o.y);
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(sun[0], sun[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); ctx.setLineDash([]);
    var al = Math.max(14, R * 0.14);
    ctx.strokeStyle = c.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(e[0], e[1] - al);
    ctx.moveTo(e[0] - 4, e[1] - al + 5); ctx.lineTo(e[0], e[1] - al); ctx.lineTo(e[0] + 4, e[1] - al + 5); ctx.stroke();
    ctx.beginPath(); ctx.arc(e[0], e[1], Math.max(5, R * 0.045), 0, TAU);
    ctx.fillStyle = c.verdigrisLit; ctx.fill(); ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.5; ctx.stroke();

    // chart: sunlight at the top of the atmosphere, axis from zero
    var x0 = layout.cx0, x1 = layout.cx1, y0 = layout.cy0, y1 = layout.cy1, YMAX = 1500;
    function X(dd) { return x0 + (x1 - x0) * dd / 365; }
    function Y(v) { return y1 - (y1 - y0) * v / YMAX; }
    ctx.font = "11px " + c.sans; ctx.textAlign = "right"; ctx.fillStyle = c.ink3;
    for (var v = 0; v <= YMAX; v += 500) {
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); ctx.stroke();
      ctx.fillText(Orrery.fmt.number(v, 0), x0 - 5, Y(v) + 4);
    }
    ctx.textAlign = "right"; ctx.fillText("W/m², top of atmosphere", x1, y0 - 6);
    Seasons.monthAxis(ctx, c, X, y0, y1, (x1 - x0) < 320);
    ctx.strokeStyle = c.brass; ctx.lineWidth = 2.5; ctx.beginPath();
    for (var dd = 0; dd <= 365; dd++) { if (dd === 0) ctx.moveTo(X(dd), Y(sunCurve[dd])); else ctx.lineTo(X(dd), Y(sunCurve[dd])); }
    ctx.stroke();
    var s = M.sunlight(o.rAU);
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(day + 0.5), y0); ctx.lineTo(X(day + 0.5), y1); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(day + 0.5), Y(s), 5, 0, TAU); ctx.fillStyle = c.verdigrisLit; ctx.fill();
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function update() {
    var o = M.orbit(day + 0.5), s = M.sunlight(o.rAU);
    outDist.textContent = Orrery.fmt.number(o.r / 1e6, 2) + " million km";
    outSun.textContent = Orrery.fmt.number(s, 0) + " W/m²";
    outPct.textContent = Orrery.fmt.signed((s / M.S0 - 1) * 100, 1) + "%";
    var q = Math.floor(o.lambda / (Math.PI / 2)) % 4;
    outSeason.textContent = ["spring / autumn", "summer / winter", "autumn / spring", "winter / summer"][q];
    view.redraw();
  }
  var dayCtl = Orrery.bindRange(slider, document.getElementById("orbit-day-out"), {
    format: function (v) { return Seasons.dayLabel(v); },
    onInput: function (v) { day = v; update(); }
  });
  function setDay(d) { day = ((Math.round(d) % 365) + 365) % 365; dayCtl.set(day); update(); }

  document.getElementById("orbit-peri").addEventListener("click", function () { loop.pause(); setDay(2); });
  document.getElementById("orbit-aph").addEventListener("click", function () { loop.pause(); setDay(186); });

  // Drag Earth round the orbit (anywhere in the orbit panel), or click the chart to pick a date.
  function fromPointer(p) {
    if (!layout) return;
    var inChart = layout.side ? p.x > layout.cx0 - 20 : p.y > layout.cy0 - 10;
    if (inChart) { setDay((p.x - layout.cx0) / (layout.cx1 - layout.cx0) * 365 - 0.5); return; }
    var sun = toScreen(0, 0);
    var helio = Math.atan2(-(p.y - sun[1]), p.x - sun[0]);
    var best = 0, bestErr = 9;
    for (var d = 0; d < 365; d++) {
      var o = M.orbit(d + 0.5), a = Math.atan2(o.y, o.x) - helio;
      var err = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      if (err < bestErr) { bestErr = err; best = d; }
    }
    setDay(best);
  }
  var stage = canvasEl.parentNode;
  Orrery.drag(stage, {
    onStart: function (p) { loop.pause(); fromPointer(p); },
    onMove: fromPointer,
    onNudge: function (dx, dy) { loop.pause(); setDay(day + (dx || -dy)); }
  });
  stage.setAttribute("role", "group");
  stage.setAttribute("aria-label", "Earth's orbit: arrow keys change the date");

  var acc = 0;
  var loop = Orrery.loop(canvasEl, function (dt) {
    acc += dt * 30;                              // 30 days per second: a year in about 12 s
    if (acc >= 1) { var n = Math.floor(acc); acc -= n; setDay(day + n); }
  }, { button: document.getElementById("orbit-play"), autoplay: false });
  update();
})();

/* ---- Figure 2: a beam of sunlight spreading over the ground ------------- */
(function () {
  "use strict";
  var svgEl = document.getElementById("beam-svg");
  if (!svgEl) return;
  var stage = svgEl.parentNode, elev = 62, geom = null;
  var outLen = document.getElementById("beam-len"), outPow = document.getElementById("beam-pow"),
      outPct = document.getElementById("beam-pct");

  function f(n) { return Math.round(n * 10) / 10; }
  function render() {
    var w = stage.clientWidth || 600, h = stage.clientHeight || 300;
    svgEl.setAttribute("viewBox", "0 0 " + w + " " + h);
    var a = elev * Math.PI / 180, sa = Math.sin(a), ca = Math.cos(a);
    var gy = h - 44, gx = w * 0.42;
    var s = Math.min(w * 0.16, h * 0.3);                 // px per metre
    var L = s / sa;                                       // patch length, px
    var pa = gx - L / 2, pb = gx + L / 2;                 // patch ends on the ground
    var r = Math.min((gy - 50) / sa, (w - gx - 30) / Math.max(ca, 1e-6), h * 1.2);
    var ux = ca, uy = -sa;                                // unit vector towards the Sun
    var sunX = gx + ux * r, sunY = gy + uy * r;
    var far = r - 18;
    geom = { gx: gx, gy: gy };
    var parts = [];
    parts.push('<rect x="0" y="' + gy + '" width="' + w + '" height="' + (h - gy) + '" fill="var(--paper-3)"/>');
    parts.push('<line x1="0" y1="' + gy + '" x2="' + w + '" y2="' + gy + '" stroke="var(--ink-3)" stroke-width="1.5"/>');
    // the beam: a parallelogram from the patch towards the Sun
    parts.push('<polygon points="' + [f(pa), gy, f(pb), gy, f(pb + ux * far), f(gy + uy * far), f(pa + ux * far), f(gy + uy * far)].join(" ") +
      '" fill="var(--brass-lit)" fill-opacity="0.35" stroke="var(--brass)" stroke-width="1"/>');
    // a few rays inside the beam
    for (var k = 1; k < 4; k++) {
      var bx = pa + (pb - pa) * k / 4;
      parts.push('<line x1="' + f(bx + ux * far * 0.9) + '" y1="' + f(gy + uy * far * 0.9) + '" x2="' + f(bx) + '" y2="' + gy +
        '" stroke="var(--brass)" stroke-width="1" stroke-dasharray="4 5" opacity="0.7"/>');
    }
    // the 1 m width marker across the beam
    var mx = gx + ux * far * 0.55, my = gy + uy * far * 0.55, nx = -uy, ny = ux;  // normal to the beam
    var hw = s / 2;
    parts.push('<line x1="' + f(mx - nx * hw) + '" y1="' + f(my - ny * hw) + '" x2="' + f(mx + nx * hw) + '" y2="' + f(my + ny * hw) +
      '" stroke="var(--ink)" stroke-width="2"/>');
    parts.push('<text x="' + f(mx + nx * hw + 6) + '" y="' + f(my + ny * hw + 4) + '" font-family="var(--sans)" font-size="13" fill="var(--ink)">1 m</text>');
    // the lit patch
    var pl = Math.max(0, pa), pr = Math.min(w, pb);
    parts.push('<line x1="' + f(pl) + '" y1="' + gy + '" x2="' + f(pr) + '" y2="' + gy + '" stroke="var(--brass)" stroke-width="6"/>');
    var len = 1 / sa;
    parts.push('<text x="' + f(gx) + '" y="' + (gy + 22) + '" text-anchor="middle" font-family="var(--sans)" font-size="13" fill="var(--ink)">lit patch ' +
      Orrery.fmt.number(len, 2) + ' m' + (pb > w || pa < 0 ? ' (runs off the picture)' : '') + '</text>');
    // elevation angle arc at the patch's far end
    var ar = 28, ax = pa + (pb - pa) / 2;
    parts.push('<path d="M ' + f(ax + ar) + ' ' + gy + ' A ' + ar + ' ' + ar + ' 0 0 0 ' + f(ax + ar * ca) + ' ' + f(gy - ar * sa) +
      '" fill="none" stroke="var(--ink-2)" stroke-width="1.5"/>');
    parts.push('<text x="' + f(ax + ar + 6) + '" y="' + (gy - 8) + '" font-family="var(--sans)" font-size="12" fill="var(--ink-2)">' + Math.round(elev) + '°</text>');
    // the Sun (drag handle)
    parts.push('<circle cx="' + f(sunX) + '" cy="' + f(sunY) + '" r="15" fill="var(--brass-lit)" stroke="var(--brass)" stroke-width="2"/>');
    parts.push('<text x="' + f(sunX) + '" y="' + f(sunY - 22) + '" text-anchor="middle" font-family="var(--sans)" font-size="12" fill="var(--ink-3)">drag the Sun</text>');
    svgEl.innerHTML = parts.join("");

    outLen.textContent = Orrery.fmt.number(len, 2) + " m";
    outPow.textContent = Orrery.fmt.number(1000 * sa, 0) + " W/m²";
    outPct.textContent = Orrery.fmt.percent(sa, 0);
  }

  var ctl = Orrery.bindRange(document.getElementById("beam-elev"), document.getElementById("beam-elev-out"), {
    format: function (v) { return Math.round(v) + "°"; },
    onInput: function (v) { elev = v; render(); }
  });
  function setElev(v) { elev = Orrery.clamp(Math.round(v), 2, 90); ctl.set(elev); render(); }
  document.getElementById("beam-june").addEventListener("click", function () { setElev(62); });
  document.getElementById("beam-dec").addEventListener("click", function () { setElev(15); });
  function fromPointer(p) {
    if (!geom) return;
    var dx = p.x - geom.gx, dy = geom.gy - p.y;
    if (dy < 1) dy = 1;
    setElev(dx <= 0 ? 90 : Math.atan2(dy, dx) * 180 / Math.PI);
  }
  Orrery.drag(stage, {
    onStart: fromPointer, onMove: fromPointer,
    onNudge: function (dx, dy) { setElev(elev + (dx ? -dx : -dy)); }
  });
  stage.setAttribute("role", "group");
  stage.setAttribute("aria-label", "Sun's elevation: arrow keys raise or lower the Sun");
  if (window.ResizeObserver) new ResizeObserver(render).observe(stage);
  else window.addEventListener("resize", render);
  render();
})();

/* ---- Figure 3: hours of daylight on a tilted globe ---------------------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("day-canvas");
  if (!canvasEl || !window.SeasonsModel) return;
  var M = Seasons.M, DEG = Seasons.DEG, TAU = Orrery.TAU;
  var lat = 51.5, day = 171;
  var BETA = 18 * DEG;                                  // we look down on the globe from 18° above
  var outLen = document.getElementById("day-len"), outNoon = document.getElementById("day-noon"),
      outDec = document.getElementById("day-dec");
  var view = Orrery.canvas(canvasEl, draw);

  function dec(d) { return M.declination(M.orbit(d + 0.5).lambda); }
  // World: Sun towards −x, the axis in the x–y plane leaning towards the Sun by the declination.
  // Screen projection of a world point: X = x, Y = y cos β − z sin β, depth Z = y sin β + z cos β.
  function project(P) { return [P[0], P[1] * Math.cos(BETA) - P[2] * Math.sin(BETA), P[1] * Math.sin(BETA) + P[2] * Math.cos(BETA)]; }
  function circlePoint(phi, L, de) {
    var n = [-Math.sin(de), Math.cos(de), 0], e1 = [Math.cos(de), Math.sin(de), 0];
    var sp = Math.sin(phi), cp = Math.cos(phi), cl = Math.cos(L), sl = Math.sin(L);
    return [sp * n[0] + cp * cl * e1[0], sp * n[1] + cp * cl * e1[1], cp * sl];
  }

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var side = w >= h * 1.25;
    var gw = side ? Math.min(w * 0.48, h * 1.1) : w, gh = side ? h : h * 0.58;
    var R = Math.min(gw, gh) * 0.36, cx = gw / 2 + (side ? 6 : 12), cy = gh / 2 + 4;
    var de = dec(day), phi = lat * DEG;

    // sunlight arrows on the left
    ctx.strokeStyle = c.brass; ctx.fillStyle = c.brass; ctx.lineWidth = 1.5;
    for (var k = -1; k <= 1; k++) {
      var ay = cy + k * R * 0.55, ax1 = cx - R - 8, ax0 = Math.max(4, cx - R - 40);
      ctx.beginPath(); ctx.moveTo(ax0, ay); ctx.lineTo(ax1, ay); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax1, ay); ctx.lineTo(ax1 - 6, ay - 4); ctx.lineTo(ax1 - 6, ay + 4); ctx.fill();
    }
    ctx.font = "11px " + c.sans; ctx.textAlign = "left"; ctx.fillStyle = c.ink3;
    ctx.fillText("Sun →", Math.max(2, cx - R - 42), cy - R * 0.55 - 8);

    // the globe: day half and night half (the terminator is the vertical line through the centre)
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.fillStyle = c.paper2; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.globalAlpha = 0.28; ctx.fillStyle = c.brassLit; ctx.fillRect(cx - R, cy - R, R, 2 * R);
    ctx.globalAlpha = 0.62; ctx.fillStyle = "#101522"; ctx.fillRect(cx, cy - R, R, 2 * R);
    ctx.globalAlpha = 1; ctx.restore();
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

    function circle(phiC, style) {
      var N = 240, pts = [];
      for (var i = 0; i <= N; i++) {
        var P = circlePoint(phiC, TAU * i / N, de), q = project(P);
        pts.push({ x: cx + R * q[0], y: cy - R * q[1], front: q[2] >= 0, lit: P[0] <= 0 });
      }
      // stroke runs of segments that share a style (back/front, day/night) as one path
      var j = 1;
      while (j <= N) {
        var f = pts[j - 1].front && pts[j].front, l = pts[j - 1].lit && pts[j].lit;
        ctx.beginPath(); ctx.moveTo(pts[j - 1].x, pts[j - 1].y);
        while (j <= N && (pts[j - 1].front && pts[j].front) === f && (pts[j - 1].lit && pts[j].lit) === l) {
          ctx.lineTo(pts[j].x, pts[j].y); j++;
        }
        style(ctx, f, l); ctx.lineCap = "round"; ctx.stroke();
      }
      ctx.lineCap = "butt"; ctx.globalAlpha = 1;
    }
    // reference circles: equator, tropics, polar circles
    [0, 23.44, -23.44, 66.56, -66.56].forEach(function (g) {
      circle(g * DEG, function (ctx, front) {
        ctx.setLineDash(front ? [] : [2, 4]);
        ctx.strokeStyle = g === 0 ? c.ink3 : c.rule; ctx.lineWidth = front ? 1 : 0.8;
      });
    });
    // the axis
    var np = project([-Math.sin(de), Math.cos(de), 0]);
    ctx.setLineDash([]); ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - R * 1.2 * np[0], cy + R * 1.2 * np[1]); ctx.lineTo(cx + R * 1.2 * np[0], cy - R * 1.2 * np[1]); ctx.stroke();
    ctx.fillStyle = c.ink2; ctx.textAlign = "center";
    ctx.fillText("N", cx + R * 1.32 * np[0], cy - R * 1.32 * np[1] + 4);
    // the chosen latitude: brass by day, dark by night; faint where it is behind the globe
    circle(phi, function (ctx, front, lit) {
      ctx.setLineDash(front ? [] : [3, 4]);
      ctx.lineWidth = front ? 4 : 2;
      ctx.strokeStyle = lit ? c.brass : c.ink;
      ctx.globalAlpha = front ? 1 : 0.5;
    });
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.fillStyle = c.ink3; ctx.textAlign = "center";
    ctx.fillText("day", cx - R * 0.5, cy + R + 16); ctx.fillText("night", cx + R * 0.5, cy + R + 16);

    // chart: day length through the year at this latitude
    var x0 = side ? gw + 40 : 40, x1 = w - 12, y0 = side ? 22 : gh + 26, y1 = h - 30;
    function X(d) { return x0 + (x1 - x0) * d / 365; }
    function Y(v) { return y1 - (y1 - y0) * v / 24; }
    ctx.font = "11px " + c.sans; ctx.textAlign = "right"; ctx.fillStyle = c.ink3;
    [0, 6, 12, 18, 24].forEach(function (v) {
      ctx.strokeStyle = v === 12 ? c.ink3 : c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); ctx.stroke();
      ctx.fillText(v + " h", x0 - 5, Y(v) + 4);
    });
    Seasons.monthAxis(ctx, c, X, y0, y1, (x1 - x0) < 320);
    ctx.strokeStyle = c.brass; ctx.lineWidth = 2.5; ctx.beginPath();
    for (var d = 0; d <= 365; d++) {
      var v = M.dayLengthHours(phi, dec(Math.min(d, 364.5)));
      if (d === 0) ctx.moveTo(X(d), Y(v)); else ctx.lineTo(X(d), Y(v));
    }
    ctx.stroke();
    var cur = M.dayLengthHours(phi, de);
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(day + 0.5), y0); ctx.lineTo(X(day + 0.5), y1); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(day + 0.5), Y(cur), 5, 0, TAU); ctx.fillStyle = c.verdigrisLit; ctx.fill();
    ctx.strokeStyle = c.verdigris; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = "left"; ctx.fillStyle = c.ink3;
    ctx.fillText("hours of daylight", x0 + 4, y0 - 6);
  }

  function update() {
    var de = dec(day), phi = lat * DEG;
    var len = M.dayLengthHours(phi, de);
    outLen.textContent = len >= 24 ? "24 h (the Sun never sets)" : len <= 0 ? "0 h (the Sun never rises)" : Orrery.fmt.duration(len);
    var ne = M.noonElevation(phi, de) / DEG;
    outNoon.textContent = ne < 0 ? "below the horizon" : Orrery.fmt.number(ne, 1) + "°";
    outDec.textContent = Seasons.latLabel(Math.round(de / DEG * 10) / 10);
    view.redraw();
  }
  Orrery.bindRange(document.getElementById("day-lat"), document.getElementById("day-lat-out"), {
    format: Seasons.latLabel, onInput: function (v) { lat = v; update(); }
  });
  Orrery.bindRange(document.getElementById("day-date"), document.getElementById("day-date-out"), {
    format: Seasons.dayLabel, onInput: function (v) { day = v; update(); }
  });
})();

/* ---- Figure 4: a year of sunlight, with each cause switched off --------- */
(function () {
  "use strict";
  var canvasEl = document.getElementById("year-canvas");
  if (!canvasEl || !window.SeasonsModel) return;
  var M = Seasons.M, DEG = Seasons.DEG;
  var lat = 40, tilt = 23.44, showNoTilt = true, showCirc = false;
  var real = [], noTilt = [], circ = [];
  var out = { max: document.getElementById("year-max"), min: document.getElementById("year-min"),
              swing: document.getElementById("year-swing"), nt: document.getElementById("year-swing-nt") };
  var view = Orrery.canvas(canvasEl, draw);

  function extent(a) {
    var lo = 0, hi = 0;
    for (var i = 1; i < a.length; i++) { if (a[i] < a[lo]) lo = i; if (a[i] > a[hi]) hi = i; }
    return { lo: lo, hi: hi };
  }
  function compute() {
    var phi = lat * DEG;
    for (var d = 0; d < 365; d++) {
      real[d] = M.dailyInsolation(phi, d + 0.5, { tiltDeg: tilt });
      noTilt[d] = M.dailyInsolation(phi, d + 0.5, { tiltDeg: 0 });
      circ[d] = M.dailyInsolation(phi, d + 0.5, { tiltDeg: tilt, circular: true });
    }
    var x = extent(real), y = extent(noTilt);
    function wm(v) { return Orrery.fmt.number(v, 0) + " W/m²"; }
    out.max.textContent = wm(real[x.hi]) + " (" + Seasons.dayLabel(x.hi) + ")";
    out.min.textContent = wm(real[x.lo]) + " (" + Seasons.dayLabel(x.lo) + ")";
    out.swing.textContent = wm(real[x.hi] - real[x.lo]);
    out.nt.textContent = wm(noTilt[y.hi] - noTilt[y.lo]);
    view.redraw();
  }

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var x0 = 46, x1 = w - 12, y0 = 40, y1 = h - 30;
    var top = 0;
    for (var i = 0; i < 365; i++) top = Math.max(top, real[i] || 0, showNoTilt ? noTilt[i] : 0, showCirc ? circ[i] : 0);
    var YMAX = Math.max(600, Math.ceil(top / 100) * 100), stepV = YMAX > 800 ? 200 : 100;
    function X(d) { return x0 + (x1 - x0) * d / 365; }
    function Y(v) { return y1 - (y1 - y0) * v / YMAX; }
    ctx.font = "11px " + Orrery.tokens().sans; ctx.textAlign = "right"; ctx.fillStyle = c.ink3;
    for (var v = 0; v <= YMAX; v += stepV) {
      ctx.strokeStyle = c.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); ctx.stroke();
      ctx.fillText(Orrery.fmt.number(v, 0), x0 - 5, Y(v) + 4);
    }
    Seasons.monthAxis(ctx, c, X, y0, y1, (x1 - x0) < 320);
    // solstices (2026: 21 June, 21 December)
    ctx.strokeStyle = c.ink3; ctx.setLineDash([2, 3]);
    [171.35, 354.87].forEach(function (d) { ctx.beginPath(); ctx.moveTo(X(d), y0); ctx.lineTo(X(d), y1); ctx.stroke(); });
    ctx.setLineDash([]);
    function line(a, color, width, dash) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (var d = 0; d < 365; d++) { if (d === 0) ctx.moveTo(X(d + 0.5), Y(a[d])); else ctx.lineTo(X(d + 0.5), Y(a[d])); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (showNoTilt) line(noTilt, c.ink2, 2, [6, 4]);
    if (showCirc) line(circ, c.verdigris, 2, [2, 3]);
    line(real, c.brass, 2.5);
    // legend
    var lx = x0 + 6, ly = 14;
    ctx.textAlign = "left"; ctx.font = "12px " + c.sans;
    function key(label, color, dash) {
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.moveTo(lx, ly - 4); ctx.lineTo(lx + 20, ly - 4); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.ink2; ctx.fillText(label, lx + 25, ly);
      lx += 25 + ctx.measureText(label).width + 16;
      if (lx > x1 - 110) { lx = x0 + 6; ly += 16; }
    }
    key("Earth, " + Seasons.latLabel(lat), c.brass);
    if (showNoTilt) key("no tilt", c.ink2, [6, 4]);
    if (showCirc) key("circular orbit", c.verdigris, [2, 3]);
    ctx.fillStyle = c.ink3; ctx.textAlign = "right"; ctx.font = "11px " + c.sans;
    ctx.fillText("W/m², daily average", x1, y0 - 6);
  }

  var latCtl = Orrery.bindRange(document.getElementById("year-lat"), document.getElementById("year-lat-out"), {
    format: Seasons.latLabel, onInput: function (v) { lat = v; compute(); }
  });
  Orrery.bindRange(document.getElementById("year-tilt"), document.getElementById("year-tilt-out"), {
    format: function (v) { return Orrery.fmt.number(v, 2) + "°"; }, onInput: function (v) { tilt = v; compute(); }
  });
  document.getElementById("year-notilt").addEventListener("change", function (e) { showNoTilt = e.target.checked; view.redraw(); });
  document.getElementById("year-circ").addEventListener("change", function (e) { showCirc = e.target.checked; view.redraw(); });
  document.getElementById("year-flip").addEventListener("click", function () { latCtl.set(-lat); });
  compute();
})();

/* ---- Figure 2: the tilt that doesn't turn ------------------------------
   An oblique view of the orbit. Earth's axis is the fixed vector
   n = (0, sin ε, cos ε) in ecliptic coordinates (x towards the Sun's position
   seen from Earth at the March equinox's opposite; y so that the axis leans
   towards the Sun at the June solstice), whatever the date. */
(function () {
  "use strict";
  var canvasEl = document.getElementById("tilt-canvas");
  if (!canvasEl || !window.SeasonsModel) return;
  var M = Seasons.M, DEG = Seasons.DEG, TAU = Orrery.TAU;
  var GAMMA = 24 * DEG;                                  // we look at the orbit from 24° above its plane
  var EPS = M.TILT_DEG * DEG, AXIS = [0, Math.sin(EPS), Math.cos(EPS)];
  var day = 171, L = null;
  var outLean = document.getElementById("tilt-lean"), outDec = document.getElementById("tilt-dec");
  var view = Orrery.canvas(canvasEl, draw);

  // view coordinates: X right, Y up, Z towards the viewer. The solstice line (ecliptic y) runs
  // left to right, so June is on the left and December on the right; March is at the back.
  function toView(P) {
    var u = [P[1], -P[0], P[2]];
    return [u[0], u[2] * Math.cos(GAMMA) + u[1] * Math.sin(GAMMA), -u[1] * Math.cos(GAMMA) + u[2] * Math.sin(GAMMA)];
  }
  function pos(d) { var o = M.orbit(d + 0.5); return [o.x, o.y, 0]; }

  function globe(ctx, c, P, r, alpha, label) {
    if (alpha <= 0) {                               // today's Earth sits here: keep just the label
      var p0 = toView(P);
      ctx.fillStyle = c.ink3; ctx.font = "11px " + c.sans; ctx.textAlign = "center";
      ctx.fillText(label, L.cx + L.R * p0[0], L.cy - L.R * p0[1] + r / 0.7 + 26);
      return;
    }
    var q = toView(P), sx = L.cx + L.R * q[0], sy = L.cy - L.R * q[1];
    var len = Math.hypot(P[0], P[1]), s = toView([-P[0] / len, -P[1] / len, 0]);   // unit vector to the Sun
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fillStyle = c.paper2; ctx.fill();
    ctx.globalAlpha = alpha * 0.62; ctx.fillStyle = "#101522"; ctx.fill(); ctx.globalAlpha = alpha;
    // lit part: half the disc towards the Sun, bounded by the projected terminator (an ellipse)
    ctx.translate(sx, sy); ctx.rotate(Math.atan2(-s[1], s[0]));
    ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    var rx = Math.max(0.01, r * Math.abs(s[2]));
    if (s[2] >= 0) ctx.ellipse(0, 0, rx, r, 0, Math.PI / 2, 3 * Math.PI / 2, false);
    else ctx.ellipse(0, 0, rx, r, 0, Math.PI / 2, -Math.PI / 2, true);
    ctx.fillStyle = c.paper2; ctx.fill(); ctx.globalAlpha = alpha * 0.45; ctx.fillStyle = c.brassLit; ctx.fill();
    ctx.restore();
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.stroke();
    var a = toView(AXIS), k = r * 1.55;
    ctx.beginPath(); ctx.moveTo(sx - k * a[0], sy + k * a[1]); ctx.lineTo(sx + k * a[0], sy - k * a[1]);
    ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = c.ink; ctx.font = "11px " + c.sans; ctx.textAlign = "center";
    ctx.fillText("N", sx + (k + 7) * a[0], sy - (k + 7) * a[1] + 3);
    if (label) { ctx.fillStyle = c.ink3; ctx.fillText(label, sx, sy + r + 26); }
    ctx.restore();
  }

  function draw(ctx, w, h) {
    var c = Orrery.tokens();
    var R = Math.min(w * 0.4, (h - 70) / (2 * Math.sin(GAMMA) + 0.25));
    L = { cx: w / 2, cy: h / 2 + 6, R: R };
    var gr = Math.max(12, R * 0.11);
    // the orbit
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 1.2; ctx.beginPath();
    for (var d = 0; d <= 365; d++) {
      var q = toView(pos(d % 365));
      if (d === 0) ctx.moveTo(L.cx + R * q[0], L.cy - R * q[1]); else ctx.lineTo(L.cx + R * q[0], L.cy - R * q[1]);
    }
    ctx.stroke();
    // items sorted far to near: four faint Earths at the solstices and equinoxes, the Sun, and today's Earth
    var items = [];
    [[78.6, "Mar"], [171.35, "Jun"], [265.0, "Sep"], [354.9, "Dec"]].forEach(function (m) {
      var gap = Math.abs(day + 0.5 - m[0]); gap = Math.min(gap, 365 - gap);
      items.push({ P: pos(m[0]), r: gr * 0.7, a: gap < 12 ? 0 : 0.6, label: m[1] });
    });
    items.push({ sun: true, P: [0, 0, 0] });
    items.push({ P: pos(day), r: gr, a: 1, label: "", now: true });
    items.sort(function (A, B) { return toView(A.P)[2] - toView(B.P)[2]; });
    items.forEach(function (it) {
      if (it.sun) {
        ctx.beginPath(); ctx.arc(L.cx, L.cy, Math.max(10, R * 0.09), 0, TAU);
        ctx.fillStyle = c.brassLit; ctx.fill(); ctx.strokeStyle = c.brass; ctx.lineWidth = 1.5; ctx.stroke();
      } else globe(ctx, c, it.P, it.r, it.a, it.label);
    });
  }

  function update() {
    var de = M.declination(M.orbit(day + 0.5).lambda) / DEG;
    outLean.textContent = Math.abs(de) < 0.5 ? "neither (equinox)" : de > 0 ? "the northern hemisphere" : "the southern hemisphere";
    outDec.textContent = Seasons.latLabel(Math.round(de * 10) / 10);
    view.redraw();
  }
  var ctl = Orrery.bindRange(document.getElementById("tilt-day"), document.getElementById("tilt-day-out"), {
    format: Seasons.dayLabel, onInput: function (v) { day = v; update(); }
  });
  function setDay(d) { day = ((Math.round(d) % 365) + 365) % 365; ctl.set(day); }
  function fromPointer(p) {
    if (!L) return;
    var best = 0, bestD = 1e9;
    for (var d = 0; d < 365; d++) {
      var q = toView(pos(d)), dx = L.cx + L.R * q[0] - p.x, dy = L.cy - L.R * q[1] - p.y;
      if (dx * dx + dy * dy < bestD) { bestD = dx * dx + dy * dy; best = d; }
    }
    setDay(best);
  }
  var stage = canvasEl.parentNode;
  Orrery.drag(stage, {
    onStart: function (p) { loop.pause(); fromPointer(p); }, onMove: fromPointer,
    onNudge: function (dx, dy) { loop.pause(); setDay(day + (dx || -dy)); }
  });
  stage.setAttribute("role", "group");
  stage.setAttribute("aria-label", "Earth's position in its orbit: arrow keys change the date");
  var acc = 0;
  var loop = Orrery.loop(canvasEl, function (dt) {
    acc += dt * 30;
    if (acc >= 1) { var n = Math.floor(acc); acc -= n; setDay(day + n); }
  }, { button: document.getElementById("tilt-play"), autoplay: false });
  update();
})();
