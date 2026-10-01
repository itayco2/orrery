/* Seasons model: Earth's orbit (a Kepler ellipse) and sunlight at the top of
   the atmosphere. Classic script; sets window.SeasonsModel (or module.exports
   under node, for the checks in company/work/seasons/check-model.js).

   Time t is in days since 2026-01-01 00:00 UTC.
   Angles in radians unless a name ends in Deg. */
(function (root) {
  "use strict";
  var DEG = Math.PI / 180;

  var M = {
    A_KM: 149.598e6,          // semi-major axis = 1 astronomical unit (IAU: 149,597,870.7 km)
    E: 0.0167,                // eccentricity of Earth's orbit (NASA fact sheet 0.0167)
    S0: 1361,                 // total solar irradiance at 1 AU, W/m² (Kopp & Lean 2011)
    TILT_DEG: 23.44,          // obliquity, 2026 mean value 23.436°
    YEAR: 365.2596,           // anomalistic year (perihelion to perihelion), days
    PERI_LON_DEG: 283.02,     // the Sun's apparent longitude at perihelion: 180° + Earth–Moon
                              // barycentre's longitude of perihelion (JPL: 102.94° + 0.32°/century)
    T_PERI: 2.380             // perihelion of the smooth (Earth–Moon barycentre) orbit,
                              // 2026-01-03 09:07 UTC, fitted so the model's equinoxes and solstices
                              // match USNO 2026 to < 0.5 h. Earth's own centre, tugged by the Moon,
                              // was closest at 17:15 UTC (USNO). See company/work/seasons/notes.md
  };

  // Mean anomaly → eccentric anomaly by Newton's method (converges in a few steps for e ≈ 0.017).
  function eccentricAnomaly(Mean, e) {
    var E = Mean + e * Math.sin(Mean);
    for (var i = 0; i < 8; i++) {
      var dE = (E - e * Math.sin(E) - Mean) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-13) break;
    }
    return E;
  }

  // Orbit state at time t (days). opts.circular → e = 0.
  // Returns { nu: true anomaly (from perihelion), r: distance in km, rAU, lambda: Sun's apparent
  //           ecliptic longitude (0 at March equinox), x, y: Earth's heliocentric position in AU
  //           in ecliptic coordinates (x toward the March-equinox direction as seen from the Sun is −) }
  function orbit(t, opts) {
    var e = opts && opts.circular ? 0 : M.E;
    var Mean = 2 * Math.PI * (t - M.T_PERI) / M.YEAR;
    var E = eccentricAnomaly(Mean, e);
    var nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    var rAU = 1 - e * Math.cos(E);
    var lambda = nu + M.PERI_LON_DEG * DEG;               // Sun as seen from Earth
    lambda = ((lambda % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    var helio = lambda + Math.PI;                           // Earth as seen from the Sun
    return { nu: nu, r: rAU * M.A_KM, rAU: rAU, lambda: lambda,
             x: rAU * Math.cos(helio), y: rAU * Math.sin(helio) };
  }

  // Solar declination (latitude where the Sun is overhead at noon), radians.
  function declination(lambda, tiltDeg) {
    var eps = (tiltDeg === undefined ? M.TILT_DEG : tiltDeg) * DEG;
    return Math.asin(Math.sin(eps) * Math.sin(lambda));
  }

  // Sunrise hour angle h0 (radians, 0..π) for latitude phi and declination dec.
  // Geometric: the Sun's centre on a flat horizon, no refraction.
  function sunriseHourAngle(phi, dec) {
    var c = -Math.tan(phi) * Math.tan(dec);
    if (!isFinite(c)) c = (phi * dec > 0) ? -1 : (phi * dec < 0 ? 1 : 0);
    if (c >= 1) return 0;          // polar night
    if (c <= -1) return Math.PI;   // polar day
    return Math.acos(c);
  }

  function dayLengthHours(phi, dec) { return 24 * sunriseHourAngle(phi, dec) / Math.PI; }

  // Sun's elevation at local solar noon, radians (can be negative in polar night).
  function noonElevation(phi, dec) { return Math.PI / 2 - Math.abs(phi - dec); }

  // Daily-mean insolation at the top of the atmosphere, W/m², at latitude phi (radians) on day t.
  // opts: { tiltDeg, circular }.
  function dailyInsolation(phi, t, opts) {
    opts = opts || {};
    var o = orbit(t, opts);
    var dec = declination(o.lambda, opts.tiltDeg);
    var h0 = sunriseHourAngle(phi, dec);
    var q = (M.S0 / Math.PI) / (o.rAU * o.rAU) *
      (h0 * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(h0));
    return Math.max(0, q);
  }

  // Irradiance on a surface facing the Sun at the top of the atmosphere, W/m².
  function sunlight(rAU) { return M.S0 / (rAU * rAU); }

  // Find the time (days) in [t0, t1] when the Sun's longitude crosses target (radians), by bisection.
  function timeOfLongitude(target, t0, t1, opts) {
    function f(t) {
      var d = orbit(t, opts).lambda - target;
      return Math.atan2(Math.sin(d), Math.cos(d));
    }
    var a = t0, b = t1, fa = f(a);
    for (var i = 0; i < 80; i++) {
      var m = (a + b) / 2, fm = f(m);
      if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else b = m;
    }
    return (a + b) / 2;
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];   // 2026, not leap
  // Day number (0 = 1 Jan) → Date (UTC, 2026).
  function dateOf(t) { return new Date(Date.UTC(2026, 0, 1) + t * 86400000); }

  M.DEG = DEG;
  M.eccentricAnomaly = eccentricAnomaly;
  M.orbit = orbit;
  M.declination = declination;
  M.sunriseHourAngle = sunriseHourAngle;
  M.dayLengthHours = dayLengthHours;
  M.noonElevation = noonElevation;
  M.dailyInsolation = dailyInsolation;
  M.sunlight = sunlight;
  M.timeOfLongitude = timeOfLongitude;
  M.MONTHS = MONTHS;
  M.MONTH_START = MONTH_START;
  M.dateOf = dateOf;

  if (typeof module !== "undefined" && module.exports) module.exports = M;
  else root.SeasonsModel = M;
})(this);
