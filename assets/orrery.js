/* ==========================================================================
   Orrery — shared helpers for exhibits and site pages.       window.Orrery
   Classic script (no modules), no dependencies, no network.
   API: the comments below, and models/_template/ for a working example.

   Orrery.canvas(canvas, draw)        HiDPI canvas that redraws on resize
   Orrery.loop(el, step, opts)        animation loop; pauses off-screen, when
                                      the tab is hidden, and (by default) under
                                      prefers-reduced-motion until asked
   Orrery.bindRange(input, out, opts) slider <-> readout (+ aria-valuetext)
   Orrery.drag(el, opts)              pointer drag (mouse/touch/pen) plus
                                      arrow-key nudging for keyboard users
   Orrery.fmt.*                       number / unit / percent / date formatting
   Orrery.tokens(), onThemeChange(fn) theme colours for canvas drawing
   Orrery.reducedMotion()             current prefers-reduced-motion state
   Orrery.clamp, lerp, TAU            small maths helpers
   ========================================================================== */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var mqDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function reducedMotion() { return !!(mqReduce && mqReduce.matches); }

  function listen(mq, fn) {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener("change", fn); else if (mq.addListener) mq.addListener(fn);
  }

  /* ------------------------------------------------------------------------
     Orrery.canvas(canvas, draw) -> { ctx, width, height, dpr, redraw(), destroy() }

     Sizes the canvas's backing store to its CSS box × devicePixelRatio and
     scales the context, so you draw in CSS pixels. Calls draw(ctx, width,
     height) now, on every resize and on light/dark change. Give the canvas
     its size with CSS (e.g. inside .fig .stage, which has an aspect ratio).
     ------------------------------------------------------------------------ */
  function canvas(el, draw) {
    var ctx = el.getContext("2d");
    var state = { ctx: ctx, width: 0, height: 0, dpr: 1, canvas: el };
    function resize() {
      var r = el.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
      var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (w !== state.width || h !== state.height || dpr !== state.dpr) {
        state.width = w; state.height = h; state.dpr = dpr;
        el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
      }
      redraw();
    }
    function redraw() {
      if (!draw) return;
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.clearRect(0, 0, state.width, state.height);
      draw(ctx, state.width, state.height);
    }
    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(el); }
    else window.addEventListener("resize", resize);
    var offTheme = onThemeChange(redraw);
    state.redraw = redraw;
    state.resize = resize;
    state.destroy = function () { if (ro) ro.disconnect(); else window.removeEventListener("resize", resize); offTheme(); };
    resize();
    return state;
  }

  /* ------------------------------------------------------------------------
     Orrery.loop(el, step, opts) -> { play(), pause(), toggle(), isPlaying() }

     Calls step(dt, t) once per animation frame, dt in seconds (capped at
     0.1 s so a stalled tab doesn't jump), t = total running seconds.
     Frames only run while `el` is on screen, the tab is visible, and the
     loop is playing. It never runs just to keep the loop alive: nothing
     burns CPU off-screen.

     opts.autoplay  (default true)  start playing at once — except when the
                    reader prefers reduced motion, then wait for play().
     opts.button    a <button> to make a play/pause toggle: its text and
                    aria-pressed are kept in sync ("Play" / "Pause").
     opts.labels    { play: "Play", pause: "Pause" } button text.
     opts.onChange  function(playing) called when play state changes.
     ------------------------------------------------------------------------ */
  function loop(el, step, opts) {
    opts = opts || {};
    var labels = opts.labels || { play: "Play", pause: "Pause" };
    var playing = opts.autoplay === false ? false : !reducedMotion();
    var visible = true, raf = 0, last = 0, total = 0;

    function frame(now) {
      raf = 0;
      if (!running()) return;
      var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now; total += dt;
      step(dt, total);
      raf = requestAnimationFrame(frame);
    }
    function running() { return playing && visible && !document.hidden; }
    function kick() {
      if (running() && !raf) { last = 0; raf = requestAnimationFrame(frame); }
      if (!running() && raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    function sync() {
      if (opts.button) {
        opts.button.textContent = playing ? labels.pause : labels.play;
        opts.button.setAttribute("aria-pressed", playing ? "true" : "false");
      }
      if (opts.onChange) opts.onChange(playing);
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting; kick();
      }, { rootMargin: "100px" }).observe(el);
    }
    document.addEventListener("visibilitychange", kick);
    var api = {
      play: function () { playing = true; sync(); kick(); },
      pause: function () { playing = false; sync(); kick(); },
      toggle: function () { if (playing) api.pause(); else api.play(); },
      isPlaying: function () { return playing; }
    };
    if (opts.button) opts.button.addEventListener("click", api.toggle);
    sync(); kick();
    return api;
  }

  /* ------------------------------------------------------------------------
     Orrery.bindRange(input, output, opts) -> { value(), set(v, fire) }

     Keeps an <output>/readout element (or null) showing the slider's value,
     sets aria-valuetext to the same words, and calls opts.onInput(value)
     on every change (and once immediately unless opts.init === false).
     opts.format(value) -> string   default: Orrery.fmt.number with the
                                    slider's step precision.
     Values are numbers, not strings.
     ------------------------------------------------------------------------ */
  function bindRange(input, output, opts) {
    opts = opts || {};
    var stepStr = String(input.step || "1");
    var digits = stepStr.indexOf(".") >= 0 ? stepStr.split(".")[1].length : 0;
    var format = opts.format || function (v) { return fmt.number(v, digits); };
    function update(fire) {
      var v = parseFloat(input.value);
      var text = format(v);
      if (output) output.textContent = text;
      input.setAttribute("aria-valuetext", text);
      if (fire !== false && opts.onInput) opts.onInput(v);
    }
    input.addEventListener("input", function () { update(true); });
    update(opts.init !== false);
    return {
      value: function () { return parseFloat(input.value); },
      set: function (v, fire) { input.value = v; update(fire !== false); }
    };
  }

  /* ------------------------------------------------------------------------
     Orrery.drag(el, opts) -> { destroy() }

     Pointer dragging for mouse, touch and pen, plus keyboard nudging.
     Positions are in CSS pixels relative to el's top-left corner.

     opts.onStart(p, event)   p = { x, y }; return false to ignore this drag
     opts.onMove(p, event)    p = { x, y, dx, dy } (dx/dy since last move)
     opts.onEnd(p, event)
     opts.onNudge(dx, dy, event)  arrow keys: dx/dy are -1, 0 or 1, times 10
                              with Shift. If given, el becomes focusable
                              (tabindex=0) and arrow keys don't scroll.
     opts.hitTest(p) -> bool  optional: only start drags where this is true
                              (the cursor shows "grab" there).
     Set touch-action: none on el (as .fig .stage does) so drags don't scroll.
     ------------------------------------------------------------------------ */
  function drag(el, opts) {
    opts = opts || {};
    var active = null, lastP = null;
    function pos(e) {
      var r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function down(e) {
      if (active !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
      var p = pos(e);
      if (opts.hitTest && !opts.hitTest(p)) return;
      if (opts.onStart && opts.onStart(p, e) === false) return;
      active = e.pointerId; lastP = p;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      el.classList.add("dragging");
      e.preventDefault();
    }
    function move(e) {
      if (active === null) {
        if (opts.hitTest && e.pointerType === "mouse") el.style.cursor = opts.hitTest(pos(e)) ? "grab" : "";
        return;
      }
      if (e.pointerId !== active) return;
      var p = pos(e);
      p.dx = p.x - lastP.x; p.dy = p.y - lastP.y; lastP = p;
      if (opts.onMove) opts.onMove(p, e);
      e.preventDefault();
    }
    function up(e) {
      if (e.pointerId !== active) return;
      active = null;
      el.classList.remove("dragging");
      if (opts.onEnd) opts.onEnd(pos(e), e);
    }
    function key(e) {
      var k = e.key, m = e.shiftKey ? 10 : 1, dx = 0, dy = 0;
      if (k === "ArrowLeft") dx = -m; else if (k === "ArrowRight") dx = m;
      else if (k === "ArrowUp") dy = -m; else if (k === "ArrowDown") dy = m;
      else return;
      e.preventDefault();
      opts.onNudge(dx, dy, e);
    }
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    if (opts.onNudge) {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
      el.addEventListener("keydown", key);
    }
    return {
      destroy: function () {
        el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
        el.removeEventListener("keydown", key);
      }
    };
  }

  /* ------------------------------------------------------------------------
     Orrery.fmt — formatting that reads well in prose and readouts.
       number(x, digits)        12 345.6 → "12,345.6"; negatives use "−"
       unit(x, unit, digits)    "147.1 million km" style: number + nbsp + unit
       percent(fraction, digits) 0.0902 → "9.0%"
       signed(x, digits)        "+1.5" / "−1.5" / "0"
       date(d, opts)            Date → "30 September 2026" (UTC)
       duration(hours)          7.5 → "7 h 30 min"
       sci(x, digits, opts)     6.1e16 → "6.1 × 10¹⁶", 2.3e-10 → "2.3 × 10⁻¹⁰" (digits after
                                the point, default 1). Between 0.001 and a million: a plain
                                number with the same significant figures (12,346 · 3.5 ·
                                0.012). opts {min, max} move that range ({max: 0}: always
                                scientific); {html: true} gives "10<sup>16</sup>" instead of
                                superscript characters (use with innerHTML).
     ------------------------------------------------------------------------ */
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November", "December"];
  var SUPERSCRIPT = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
                      "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  var fmt = {
    number: function (x, digits) {
      if (x === null || x === undefined || isNaN(x)) return "–";
      if (!isFinite(x)) return x > 0 ? "∞" : "−∞";
      digits = digits === undefined ? 0 : digits;
      var s = Math.abs(x).toFixed(digits);
      if (Number(s) === 0) x = 0;                       // no "−0"
      var parts = s.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return (x < 0 ? "−" : "") + parts.join(".");
    },
    unit: function (x, unit, digits) { return fmt.number(x, digits) + " " + unit; },
    percent: function (f, digits) { return fmt.number(f * 100, digits === undefined ? 0 : digits) + "%"; },
    signed: function (x, digits) {
      var s = fmt.number(x, digits);
      return (s !== "0" && s.charAt(0) !== "−" && !/^0\.?0*$/.test(s)) ? "+" + s : s;
    },
    date: function (d, opts) {
      opts = opts || {};
      var s = d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
      return opts.year === false ? s : s + " " + d.getUTCFullYear();
    },
    duration: function (hours) {
      var m = Math.round(hours * 60), h = Math.floor(m / 60);
      m -= h * 60;
      return h + " h" + (m ? " " + m + " min" : "");
    },
    sci: function (x, digits, opts) {
      opts = opts || {};
      digits = digits === undefined ? 1 : digits;
      if (x === null || x === undefined || isNaN(x) || !isFinite(x) || x === 0) return fmt.number(x, 0);
      var a = Math.abs(x);
      var lo = opts.min === undefined ? 1e-3 : opts.min, hi = opts.max === undefined ? 1e6 : opts.max;
      var e = Math.floor(Math.log10(a));
      var d = Math.max(0, digits - e);
      if (a >= lo && Number(a.toFixed(d)) < hi) {       // plain, digits + 1 significant figures
        if (d > 0 && Number(a.toFixed(d)) >= Math.pow(10, e + 1)) d -= 1;   // 9.96 -> "10", not "10.0"
        return fmt.number(x, d);
      }
      var p = Math.pow(10, digits);
      var m = Math.round(a / Math.pow(10, e) * p + 1e-9) / p;           // 4.35 -> 4.4
      if (m >= 10) { m /= 10; e += 1; }                 // 9.96e16 -> 1.0 × 10¹⁷
      var exp = opts.html ? "<sup>" + (e < 0 ? "−" : "") + Math.abs(e) + "</sup>"
                          : String(e).replace(/[-0-9]/g, function (c) { return SUPERSCRIPT[c]; });
      return (x < 0 ? "−" : "") + m.toFixed(digits) + " × 10" + exp;
    }
  };

  /* ------------------------------------------------------------------------
     Orrery.tokens() -> { paper, paper2, paper3, ink, ink2, ink3, rule, brass,
                          brassLit, verdigris, verdigrisLit, alarm, focus,
                          sans, serif, mono }
     The current theme's colours and font stacks, read from orrery.css, for
     drawing on canvas. Orrery.onThemeChange(fn) calls fn when the reader's
     light/dark preference changes (Orrery.canvas redraws automatically);
     it returns a function that removes the listener.
     ------------------------------------------------------------------------ */
  var TOKEN_NAMES = { paper: "--paper", paper2: "--paper-2", paper3: "--paper-3", ink: "--ink",
    ink2: "--ink-2", ink3: "--ink-3", rule: "--rule", brass: "--brass", brassLit: "--brass-lit",
    verdigris: "--verdigris", verdigrisLit: "--verdigris-lit", alarm: "--alarm", focus: "--focus",
    sans: "--sans", serif: "--serif", mono: "--mono" };
  function tokens() {
    var cs = getComputedStyle(document.documentElement), out = {};
    for (var k in TOKEN_NAMES) out[k] = cs.getPropertyValue(TOKEN_NAMES[k]).trim();
    return out;
  }
  var themeFns = [];
  listen(mqDark, function () { themeFns.slice().forEach(function (f) { f(); }); });
  function onThemeChange(fn) {
    themeFns.push(fn);
    return function () { var i = themeFns.indexOf(fn); if (i >= 0) themeFns.splice(i, 1); };
  }

  /* Site nicety: opening a link to #some-id that is (inside) a <details>
     opens it, so a link can point straight at a collapsed section. */
  function openFromHash() {
    if (!location.hash || location.hash.length < 2) return;
    var el;
    try { el = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) { return; }
    for (var n = el; n; n = n.parentElement) if (n.tagName === "DETAILS") n.open = true;
    if (el && el.scrollIntoView) el.scrollIntoView();
  }
  window.addEventListener("hashchange", openFromHash);

  function ready() { openFromHash(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();

  window.Orrery = {
    version: "1.0",
    TAU: TAU, clamp: clamp, lerp: lerp,
    reducedMotion: reducedMotion,
    canvas: canvas, loop: loop, bindRange: bindRange, drag: drag,
    fmt: fmt, tokens: tokens, onThemeChange: onThemeChange
  };
})();
