/* Low-precision Sun and Moon positions and an eclipse finder.
   Truncated series from J. Meeus, "Astronomical Algorithms" (2nd ed.), ch. 25 and 47:
   the largest periodic terms only, good to a few tenths of a degree, which is enough to
   tell which new and full moons fall near a node. Angles in degrees, d = days since
   J2000.0 (2000 Jan 1, 12:00 TT, treated as UT here). Sets window.MoonSky. */
(function () {
  "use strict";
  var R = Math.PI / 180;
  function sin(x) { return Math.sin(x * R); }
  function cos(x) { return Math.cos(x * R); }
  function norm(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function wrap180(x) { x = norm(x); return x > 180 ? x - 360 : x; }

  function at(d) {
    var M = 357.5291 + 0.98560028 * d;            // Sun's mean anomaly
    var L0 = 280.4665 + 0.98564736 * d;           // Sun's mean longitude
    var sunLon = norm(L0 + 1.9146 * sin(M) + 0.0200 * sin(2 * M));
    var sunDist = 1.00014 - 0.01671 * cos(M) - 0.00014 * cos(2 * M);   // AU
    var Lm = 218.3165 + 13.17639648 * d;          // Moon's mean longitude
    var D = 297.8502 + 12.19074912 * d;           // mean elongation
    var Mm = 134.9634 + 13.06499295 * d;          // Moon's mean anomaly
    var F = 93.2721 + 13.22935024 * d;            // argument of latitude
    var node = norm(125.0445 - 0.0529538 * d);    // mean ascending node
    var moonLon = norm(Lm + 6.2888 * sin(Mm) + 1.2740 * sin(2 * D - Mm) + 0.6583 * sin(2 * D) +
      0.2136 * sin(2 * Mm) - 0.1851 * sin(M) - 0.1143 * sin(2 * F) + 0.0588 * sin(2 * D - 2 * Mm) +
      0.0572 * sin(2 * D - M - Mm) + 0.0533 * sin(2 * D + Mm) + 0.0459 * sin(2 * D - M) +
      0.0410 * sin(Mm - M) - 0.0348 * sin(D) - 0.0305 * sin(M + Mm));
    var moonLat = 5.1282 * sin(F) + 0.2806 * sin(Mm + F) + 0.2777 * sin(Mm - F) +
      0.1732 * sin(2 * D - F) + 0.0554 * sin(2 * D - Mm + F) + 0.0463 * sin(2 * D - Mm - F) +
      0.0326 * sin(2 * D + F) + 0.0172 * sin(2 * Mm + F);
    // Moon's horizontal parallax (deg); distance = Earth radius / sin(parallax)
    var par = 0.9508 + 0.0518 * cos(Mm) + 0.0095 * cos(2 * D - Mm) + 0.0078 * cos(2 * D) + 0.0028 * cos(2 * Mm);
    return { sunLon: sunLon, sunDist: sunDist, moonLon: moonLon, moonLat: moonLat, node: node,
             parallax: par, elong: norm(moonLon - sunLon) };
  }

  // day number d from a JS Date (UTC)
  function dayOf(date) { return (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000; }
  function dateOf(d) { return new Date(Date.UTC(2000, 0, 1, 12) + d * 86400000); }

  // instant near d at which elongation = target (0 new, 180 full): Newton steps
  function syzygy(d, target) {
    for (var k = 0; k < 8; k++) {
      var e = wrap180(at(d).elong - target);
      d -= e / 12.19;                              // ~12.19° per day
      if (Math.abs(e) < 1e-5) break;
    }
    return d;
  }

  // Classify the eclipse (if any) at a syzygy, from the geometry of the shadow cones.
  function classify(d, isFull) {
    var s = at(d);
    var pm = s.parallax, ps = 0.00244 / s.sunDist;
    var sunSD = 0.2666 / s.sunDist, moonSD = 0.2725 * pm;
    var gap = Math.abs(s.moonLat) * 0.995;        // closest approach (path tilted ~5.7°)
    var ev = { d: d, date: dateOf(d), full: isFull, lat: s.moonLat, gap: gap, type: null, mag: null };
    if (isFull) {
      var umbra = 1.02 * (pm + ps - sunSD), pen = 1.02 * (pm + ps + sunSD);
      ev.umbra = umbra; ev.penumbra = pen; ev.moonSD = moonSD;
      var umag = (umbra + moonSD - gap) / (2 * moonSD);
      if (gap + moonSD < umbra) ev.type = "total lunar";
      else if (gap - moonSD < umbra) ev.type = "partial lunar";
      else if (gap - moonSD < pen) ev.type = "penumbral lunar";
      ev.mag = umag;
      ev.limit = pen + moonSD;
    } else {
      var lim = pm - ps + sunSD + moonSD;
      ev.limit = lim;
      if (gap < pm - ps) ev.type = moonSD > sunSD ? "total solar" : "annular solar";
      else if (gap < lim) ev.type = "partial solar";
    }
    return ev;
  }

  // Every new and full moon between two day numbers, each classified.
  function syzygies(d0, d1) {
    var out = [], d = d0 - 16;
    var e0 = at(d).elong;
    // walk in 1-day steps and catch crossings of 0° and 180°
    for (; d < d1 + 1; d += 1) {
      var e1 = at(d + 1).elong;
      if (e1 < e0) out.push(classify(syzygy(d + 1, 0), false));               // wrapped past 360
      else if (e0 < 180 && e1 >= 180) out.push(classify(syzygy(d + 1, 180), true));
      e0 = e1;
    }
    return out.filter(function (x) { return x.d >= d0 && x.d < d1; });
  }

  window.MoonSky = { at: at, dayOf: dayOf, dateOf: dateOf, syzygies: syzygies,
                     norm: norm, wrap180: wrap180 };
})();
