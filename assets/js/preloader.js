/* =========================================================
   LuxeDrive Auto Studio — Preloader
   ---------------------------------------------------------
   Tracks real progress (fonts + above-the-fold images), then
   lifts the panel and hands over to motion.js so the hero
   intro plays as the page is revealed.

   Hand-off contract:
     window.LuxePreloader.done      → true once the exit starts
     'luxedrive:preloaded' event    → fired on document at that moment
   motion.js waits for these before playing its intro timeline.

   Settings (edit below):
     MIN_TIME   minimum time on screen, so it never just flashes
     MAX_TIME   hard cap — the page is revealed by then no matter
                what is still downloading
     ONCE_PER_SESSION  true = show only on the first page of a visit
========================================================= */
(function () {
  'use strict';

  var MIN_TIME = 900;
  var MAX_TIME = 4000;
  var ONCE_PER_SESSION = false;

  var root = document.documentElement;
  var el = document.querySelector('.preloader');
  var api = window.LuxePreloader = { done: false };

  function announce() {
    if (api.done) return;
    api.done = true;
    root.classList.remove('pl-active');
    root.removeAttribute('aria-busy');
    try { document.dispatchEvent(new CustomEvent('luxedrive:preloaded')); } catch (e) {}
  }

  // Head bootstrap didn't activate it (no-JS fallback timed out, or skipped) → nothing to do.
  if (!el || !root.classList.contains('pl-active')) { announce(); if (el) el.remove(); return; }

  if (ONCE_PER_SESSION) {
    var seen = false;
    try { seen = sessionStorage.getItem('luxedrive-preloaded') === '1'; sessionStorage.setItem('luxedrive-preloaded', '1'); } catch (e) {}
    if (seen) { announce(); el.remove(); return; }
  }

  root.setAttribute('aria-busy', 'true');

  var bar = el.querySelector('.preloader-bar span');
  var count = el.querySelector('.preloader-count');
  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var now = function () { return window.performance && performance.now ? performance.now() : Date.now(); };

  /* ---- Progress sources ---- */
  var total = 1, loaded = 0; // 1 = fonts
  function tick() { loaded++; }

  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(tick, tick); } else { tick(); }

  // Eager images only — lazy ones don't block the reveal.
  Array.prototype.forEach.call(document.images, function (img) {
    if (img.loading === 'lazy' || img.closest('.preloader')) return;
    total++;
    if (img.complete) { tick(); return; }
    img.addEventListener('load', tick, { once: true });
    img.addEventListener('error', tick, { once: true });
  });

  var pageLoaded = document.readyState === 'complete';
  if (!pageLoaded) window.addEventListener('load', function () { pageLoaded = true; }, { once: true });

  /* ---- Render loop ---- */
  var shown = 0, finished = false;
  function frame() {
    var t = now();
    var ready = (pageLoaded || loaded >= total) && t >= MIN_TIME;
    var timedOut = t >= MAX_TIME;
    // Real progress, but never quite 100 until we're actually done.
    var target = (ready || timedOut) ? 1 : Math.min(loaded / total, 0.94);
    // Keep the bar moving a little even while waiting on one large file.
    target = Math.max(target, Math.min(t / MAX_TIME, 0.9));
    shown += (target - shown) * (REDUCE ? 1 : 0.14);
    if (target === 1 && shown > 0.995) shown = 1;

    if (bar) bar.style.transform = 'scaleX(' + shown.toFixed(4) + ')';
    if (count) count.textContent = String(Math.round(shown * 100)).padStart(2, '0');

    if (shown === 1 && !finished) { finished = true; leave(); return; }
    requestAnimationFrame(frame);
  }

  function leave() {
    announce();
    el.classList.add('is-leaving');
    var removed = false;
    function cleanup() {
      if (removed) return;
      removed = true;
      el.remove();
      // Scrollbar came back, so layout width changed: re-measure scroll animations.
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }
    el.addEventListener('transitionend', function (e) { if (e.target === el) cleanup(); });
    setTimeout(cleanup, 1800); // safety net if transitionend never fires
  }

  requestAnimationFrame(frame);

  // Coming back via the back/forward cache: never show a stale loader.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && el.isConnected) { finished = true; announce(); el.remove(); }
  });
})();
