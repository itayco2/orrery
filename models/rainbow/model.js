/* Rainbow model: geometric ray optics through a spherical water drop.
   Shared by all figures. Sets window.Rainbow. No DOM access here.

   Refractive index of water: Daimon & Masumura (2007), Applied Optics 46, 3811,
   four-term Sellmeier fit for distilled water at 20 °C (as tabulated on
   refractiveindex.info, H2O / Daimon-20.0C). Wavelength in micrometres. */
window.Rainbow = (function () {
  "use strict";
  var A = [5.684027565e-1, 1.726177391e-1, 2.086189578e-2, 1.130748688e-1];
  var B = [5.101829712e-3, 1.821153936e-2, 2.620722293e-2, 1.069792721e1];   // µm²
  var PI = Math.PI, DEG = 180 / PI;

  // refractive index of water at wavelength lnm (nanometres)
  function index(lnm) {
    var l2 = (lnm / 1000) * (lnm / 1000), s = 1;
    for (var j = 0; j < 4; j++) s += A[j] * l2 / (l2 - B[j]);
    return Math.sqrt(s);
  }

  // Total deviation (radians) of a ray with impact parameter b (0..1, in drop radii)
  // after k internal reflections: D = 2(i − r) + k(π − 2r).
  function deviation(b, n, k) {
    var i = Math.asin(b), r = Math.asin(b / n);
    return 2 * (i - r) + k * (PI - 2 * r);
  }

  // Angle (radians) between the outgoing ray and the antisolar direction,
  // i.e. how far from the shadow of your head the light appears to come from.
  function skyAngle(D) { return Math.acos(-Math.cos(D)); }

  // The ray of minimum deviation (Descartes ray): cos² i = (n² − 1) / (k(k + 2)).
  function descartes(n, k) {
    var i = Math.acos(Math.sqrt((n * n - 1) / (k * (k + 2))));
    var b = Math.sin(i), D = deviation(b, n, k);
    return { b: b, D: D, theta: skyAngle(D) };
  }

  // Points where the ray meets the drop surface (unit circle, y up, sunlight
  // travelling in +x), entry first, exit last: polar angles π − i − j(π − 2r).
  function path(b, n, k) {
    var i = Math.asin(b), r = Math.asin(b / n), pts = [];
    for (var j = 0; j <= k + 1; j++) {
      var a = PI - i - j * (PI - 2 * r);
      pts.push([Math.cos(a), Math.sin(a)]);
    }
    var D = deviation(b, n, k);
    return { pts: pts, D: D, exitDir: [Math.cos(-D), Math.sin(-D)] };
  }

  // Fresnel weight for unpolarised light: two transmissions and k internal
  // reflections, averaged over the s and p polarisations.
  function fresnel(b, n, k) {
    var ci = Math.sqrt(1 - b * b), sr = b / n, cr = Math.sqrt(1 - sr * sr);
    var rs = (ci - n * cr) / (ci + n * cr), rp = (n * ci - cr) / (n * ci + cr);
    var Rs = rs * rs, Rp = rp * rp;
    return 0.5 * ((1 - Rs) * (1 - Rs) * Math.pow(Rs, k) + (1 - Rp) * (1 - Rp) * Math.pow(Rp, k));
  }

  // CIE 1931 colour-matching functions, multi-lobe Gaussian fit of
  // Wyman, Sloan & Shirley (2013).
  function g(x, mu, s1, s2) { var t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); }
  function xyz(l) {
    return [
      1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
      0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
      1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8)
    ];
  }
  function xyzToLinear(c) {
    return [
      3.2406 * c[0] - 1.5372 * c[1] - 0.4986 * c[2],
      -0.9689 * c[0] + 1.8758 * c[1] + 0.0415 * c[2],
      0.0557 * c[0] - 0.2040 * c[1] + 1.0570 * c[2]
    ];
  }
  function gamma(v) { v = Math.max(0, Math.min(1, v)); return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
  // A displayable sRGB colour for a single wavelength (for drawing rays and bars).
  function cssColour(l) {
    var c = xyzToLinear(xyz(l)), m = Math.max(c[0], c[1], c[2], 1e-6);
    // normalise brightness, keep hue; desaturate slightly so it reads on paper
    var out = c.map(function (v) { return Math.round(255 * gamma(0.12 + 0.88 * Math.max(0, v) / m)); });
    return "rgb(" + out.join(",") + ")";
  }

  // Sky brightness profile: for every angle from the antisolar point (bins of
  // STEP degrees, 0..180), the light per unit solid angle sent back by a cloud
  // of identical drops, for k internal reflections, as linear sRGB.
  // Rays fill the drop's disc uniformly (weight b db for a ring of radius b);
  // the Sun's disc (0.53° across) smooths the result.
  var STEP = 0.1, NB = Math.round(180 / STEP) + 1;
  function skyProfile(k, opts) {
    opts = opts || {};
    var M = opts.rays || 20000, rgb = [new Float32Array(NB), new Float32Array(NB), new Float32Array(NB)];
    for (var l = 400; l <= 700; l += 10) {
      var n = index(l), c = xyzToLinear(xyz(l)), acc = new Float64Array(NB);
      for (var j = 0; j < M; j++) {
        var b = (j + 0.5) / M;
        var th = skyAngle(deviation(b, n, k)) * DEG;
        acc[Math.min(NB - 1, Math.round(th / STEP))] += b * fresnel(b, n, k) / M;
      }
      // smooth with the Sun's disc (radius 0.265°) — a semicircle kernel
      var R = Math.round(0.265 / STEP), ker = [], ks = 0;
      for (var q = -R; q <= R; q++) { var wq = Math.sqrt(Math.max(0, 1 - (q / (R + 0.5)) * (q / (R + 0.5)))); ker.push(wq); ks += wq; }
      for (var p = 0; p < NB; p++) {
        var s = 0;
        for (q = -R; q <= R; q++) { var idx = p + q; if (idx >= 0 && idx < NB) s += acc[idx] * ker[q + R]; }
        s /= ks;
        var sin = Math.sin(Math.max(p, 0.5) * STEP / DEG);
        var v = s / (sin * STEP / DEG);                // per unit solid angle
        for (var ch = 0; ch < 3; ch++) rgb[ch][p] += v * c[ch] / 31;
      }
    }
    return rgb;
  }

  return {
    index: index, deviation: deviation, skyAngle: skyAngle, descartes: descartes,
    path: path, fresnel: fresnel, cssColour: cssColour, gamma: gamma,
    skyProfile: skyProfile, STEP: STEP, DEG: DEG
  };
})();
