/* Planet positions from JPL's approximate Keplerian elements.
   Source: E. M. Standish, "Keplerian Elements for Approximate Positions of the
   Major Planets", JPL Solar System Dynamics, Table 1 (valid 1800–2050), mean
   ecliptic and equinox of J2000. https://ssd.jpl.nasa.gov/planets/approx_pos.html
   Elements and the Kepler solver are copied from the front-door emblem
   (view/assets/home.js); this version also returns distances and 3-D positions.
   "Earth" is really the Earth–Moon barycentre (as in Standish's table).
   Time: UTC is used for TDB (they differ by about a minute; negligible here).
   Classic script: sets window.Ephem (and module.exports under Node, for tests). */
(function (root) {
  "use strict";
  // [a (au), e, I (deg), L (deg), long. perihelion (deg), long. node (deg)], then rates per Julian century
  var PLANETS = [
    ["Mercury", [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
                [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
    ["Venus",   [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
                [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
    ["Earth",   [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
                [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
    ["Mars",    [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
                [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
    ["Jupiter", [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
                [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
    ["Saturn",  [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
                [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
    ["Uranus",  [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
                [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
    ["Neptune", [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
                [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]]
  ];
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  var AU_KM = 149597870.7;
  var DAY = 86400000;
  var MIN_MS = Date.UTC(1800, 0, 1), MAX_MS = Date.UTC(2050, 11, 31);

  function centuries(ms) { return (ms / DAY + 2440587.5 - 2451545.0) / 36525; }

  /* Elements of planet i at time ms (Unix ms). */
  function elements(i, ms) {
    var el0 = PLANETS[i][1], rate = PLANETS[i][2], T = centuries(ms);
    return {
      a: el0[0] + rate[0] * T, e: el0[1] + rate[1] * T, I: (el0[2] + rate[2] * T) * D2R,
      L: el0[3] + rate[3] * T, peri: el0[4] + rate[4] * T, node: el0[5] + rate[5] * T
    };
  }

  /* Position in the orbit plane at eccentric anomaly E -> ecliptic x, y, z (au). */
  function toEcliptic(k, E) {
    var xp = k.a * (Math.cos(E) - k.e), yp = k.a * Math.sqrt(1 - k.e * k.e) * Math.sin(E);
    var w = (k.peri - k.node) * D2R, O = k.node * D2R;
    var cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(k.I), sI = Math.sin(k.I);
    return {
      x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
      y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
      z: (sw * sI) * xp + (cw * sI) * yp
    };
  }

  /* Heliocentric position of planet i at time ms: {x, y, z, r (au), lon (deg 0..360)}. */
  function position(i, ms) {
    var k = elements(i, ms);
    var M = ((k.L - k.peri) % 360 + 540) % 360 - 180;   // mean anomaly, -180..180 deg
    M *= D2R;
    var E = M + k.e * Math.sin(M);
    for (var n = 0; n < 20; n++) {                    // Newton's method on Kepler's equation
      var dE = (E - k.e * Math.sin(E) - M) / (1 - k.e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-12) break;
    }
    var p = toEcliptic(k, E);
    p.r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    p.lon = (Math.atan2(p.y, p.x) * R2D + 360) % 360;
    return p;
  }

  /* n points around the orbit of planet i at time ms (for drawing), [{x,y,z}, ...]. */
  function orbit(i, ms, n) {
    var k = elements(i, ms), pts = [];
    for (var j = 0; j <= n; j++) pts.push(toEcliptic(k, j / n * 2 * Math.PI));
    return pts;
  }

  /* As seen from Earth: {lon (deg, geocentric ecliptic longitude), dist (au),
     elong (deg, signed: + east of the Sun = evening sky, − west = morning sky)}. */
  function geocentric(i, ms) {
    var p = position(i, ms), e = position(2, ms);
    var dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z;
    var lon = (Math.atan2(dy, dx) * R2D + 360) % 360;
    var sunLon = (e.lon + 180) % 360;
    var el = ((lon - sunLon) % 360 + 540) % 360 - 180;
    return { lon: lon, dist: Math.sqrt(dx * dx + dy * dy + dz * dz), elong: el, sunLon: sunLon };
  }

  /* Sidereal period of planet i in days, from the mean-longitude rate. */
  function periodDays(i) { return 36525 * 360 / PLANETS[i][2][3]; }

  var api = {
    names: PLANETS.map(function (p) { return p[0]; }),
    position: position, orbit: orbit, periodDays: periodDays, geocentric: geocentric, elements: elements,
    AU_KM: AU_KM, DAY: DAY, MIN_MS: MIN_MS, MAX_MS: MAX_MS
  };
  root.Ephem = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
