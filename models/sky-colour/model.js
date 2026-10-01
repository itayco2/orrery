/* Model for "Why is the sky blue and the sunset red?"
   Pure functions, no drawing. Wavelengths in nanometres.
   - Rayleigh optical depth of the whole atmosphere at sea level: Hansen & Travis (1974).
   - Relative optical air mass: Kasten & Young (1989).
   - Sunlight: a 5,778 K black body (stated on the page).
   - Colour: CIE 1931 2° colour-matching functions (cmf.js) -> XYZ -> linear sRGB -> gamma. */
window.Sky = (function () {
  "use strict";
  var CMF = window.SKY_CMF;
  var L0 = CMF.start, DL = CMF.step, N = CMF.data.length;
  var WL = [];
  for (var i = 0; i < N; i++) WL.push(L0 + i * DL);

  // Rayleigh optical depth (vertical, sea level, 1013.25 hPa). lambda in nm.
  function tau(lnm) {
    var l = lnm / 1000, l2 = 1 / (l * l), l4 = l2 * l2;
    return 0.008569 * l4 * (1 + 0.0113 * l2 + 0.00013 * l4);
  }

  // Total vertical optical depth with haze: aerosol optical depth beta at 550 nm, falling
  // with wavelength as lambda^-1.3 (Angstrom's typical exponent). Haze is treated as
  // non-absorbing and scattering evenly in all directions, like the air (a simplification).
  function tauTot(lnm, beta) {
    return tau(lnm) + (beta ? beta * Math.pow(lnm / 550, -1.3) : 0);
  }

  // Relative air mass for a Sun at elevation h degrees above the horizon.
  function airMass(hdeg) {
    var h = Math.max(0, hdeg);
    return 1 / (Math.sin(h * Math.PI / 180) + 0.50572 * Math.pow(h + 6.07995, -1.6364));
  }

  // Planck spectral radiance (arbitrary scale) of a black body at T kelvin.
  function planck(lnm, T) {
    var l = lnm * 1e-9, c2 = 1.438777e-2;
    return 1 / (Math.pow(l, 5) * (Math.exp(c2 / (l * T)) - 1));
  }
  var TSUN = 5778;
  var SUN = WL.map(function (l) { return planck(l, TSUN); });
  var sunMax = Math.max.apply(null, SUN);
  SUN = SUN.map(function (v) { return v / sunMax; });

  // Spectrum -> XYZ (array of values on the WL grid).
  function xyz(spec) {
    var X = 0, Y = 0, Z = 0;
    for (var i = 0; i < N; i++) {
      var c = CMF.data[i], s = spec[i];
      X += s * c[0]; Y += s * c[1]; Z += s * c[2];
    }
    return [X * DL, Y * DL, Z * DL];
  }
  function linRGB(c) {
    return [ 3.2406 * c[0] - 1.5372 * c[1] - 0.4986 * c[2],
            -0.9689 * c[0] + 1.8758 * c[1] + 0.0415 * c[2],
             0.0557 * c[0] - 0.2040 * c[1] + 1.0570 * c[2]];
  }
  function gamma(v) {
    v = Math.max(0, Math.min(1, v));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  }
  // White balance: sunlight above the atmosphere is shown as white (the eye adapts to daylight).
  var SUNRGB = linRGB(xyz(SUN));
  var WB = [1 / SUNRGB[0], 1 / SUNRGB[1], 1 / SUNRGB[2]];

  // Colour of a spectrum, brightness normalised (brightest channel = 1).
  // Out-of-gamut colours are desaturated by adding white. Returns {css, rgb, lin}.
  function colour(spec, balanced) {
    var c = linRGB(xyz(spec));
    if (balanced !== false) c = [c[0] * WB[0], c[1] * WB[1], c[2] * WB[2]];
    var mn = Math.min(c[0], c[1], c[2]);
    if (mn < 0) c = c.map(function (v) { return v - mn; });
    var mx = Math.max(c[0], c[1], c[2]) || 1;
    c = c.map(function (v) { return v / mx; });
    var rgb = c.map(function (v) { return Math.round(255 * gamma(v)); });
    return { css: "rgb(" + rgb.join(",") + ")", rgb: rgb, lin: c };
  }
  // Colour of one wavelength (for drawing spectra): its own chromaticity, not white-balanced.
  function wavelengthCss(lnm) {
    var spec = WL.map(function (l) { return Math.exp(-0.5 * Math.pow((l - lnm) / 3, 2)); });
    return colour(spec, false).css;
  }

  // Direct sunlight reaching the ground through air mass m.
  function direct(m, beta) {
    return WL.map(function (l, i) { return SUN[i] * Math.exp(-tauTot(l, beta) * m); });
  }
  // Single-scattered light from the zenith, plane-parallel atmosphere, Sun at air mass m.
  // Light scattered at optical depth t has crossed t*m on the way in and (tau - t) on the way down:
  // L = S * integral_0^tau e^(-t m) e^-(tau - t) dt = S e^-tau (1 - e^(-tau (m-1))) / (m - 1).
  function zenithSky(m, beta) {
    return WL.map(function (l, i) {
      var T = tauTot(l, beta), k = m - 1;
      var f = Math.abs(k) < 1e-6 ? T * Math.exp(-T) : Math.exp(-T) * (1 - Math.exp(-T * k)) / k;
      return SUN[i] * f;
    });
  }
  // Single-scattered light seen looking up at a view air mass mv, Sun at air mass ms (same idea).
  function skyView(ms, mv, beta) {
    return WL.map(function (l, i) {
      var T = tauTot(l, beta), k = ms - mv;
      var f = Math.abs(k) < 1e-6 ? mv * T * Math.exp(-T * mv)
            : mv * Math.exp(-T * mv) * (1 - Math.exp(-T * k)) / k;
      return SUN[i] * f;
    });
  }
  // White-balanced linear sRGB of a spectrum, not normalised (for comparing brightness).
  function linear(spec) {
    var c = linRGB(xyz(spec));
    return [c[0] * WB[0], c[1] * WB[1], c[2] * WB[2]];
  }
  // Linear RGB (any scale) -> CSS colour after scaling by k; negative parts desaturated.
  function cssFromLinear(c, k) {
    var mn = Math.min(c[0], c[1], c[2]);
    if (mn < 0) c = c.map(function (v) { return v - mn; });
    return "rgb(" + c.map(function (v) { return Math.round(255 * gamma(v * k)); }).join(",") + ")";
  }
  // Sunlight scattered with strength proportional to lambda^-n (n = 4: molecules; n = 0: big droplets).
  function scattered(n) {
    return WL.map(function (l, i) { return SUN[i] * Math.pow(550 / l, n); });
  }
  function luminance(spec) { return xyz(spec)[1]; }

  // Chromaticity and dominant wavelength relative to sunlight's white point.
  function chroma(spec) { var c = xyz(spec), s = c[0] + c[1] + c[2]; return [c[0] / s, c[1] / s]; }
  var WHITE = chroma(SUN);
  var LOCUS = WL.map(function (l, i) { var c = CMF.data[i], s = c[0] + c[1] + c[2]; return [c[0] / s, c[1] / s]; });
  function dominant(spec) {
    var p = chroma(spec), dx = p[0] - WHITE[0], dy = p[1] - WHITE[1];
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.004) return null;
    // Cast a ray from the white point through the colour; find where it meets the spectral locus.
    for (var i = 0; i < N - 1 && WL[i] < 700; i++) {
      var ax = LOCUS[i][0] - WHITE[0], ay = LOCUS[i][1] - WHITE[1];
      var bx = LOCUS[i + 1][0] - WHITE[0], by = LOCUS[i + 1][1] - WHITE[1];
      var ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      var t = (ax * ey - ay * ex) / den, u = (ax * dy - ay * dx) / den;
      if (t > 0 && u >= 0 && u <= 1) return { nm: WL[i] + u * DL, purity: 1 / t };
    }
    return null;                                   // a purple: no single wavelength
  }

  return { WL: WL, SUN: SUN, TSUN: TSUN, tau: tau, tauTot: tauTot, airMass: airMass, colour: colour,
           wavelengthCss: wavelengthCss, direct: direct, zenithSky: zenithSky, scattered: scattered,
           luminance: luminance, skyView: skyView, linear: linear, cssFromLinear: cssFromLinear, chroma: chroma, dominant: dominant, xyz: xyz };
})();
