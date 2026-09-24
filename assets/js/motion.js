/* =========================================================
   LuxeDrive — Motion layer
   GSAP + ScrollTrigger for scroll-linked animation,
   Lenis for inertial wheel scrolling on desktop.

   Progressive enhancement: if the libraries fail to load, or the
   visitor prefers reduced motion, only the scroll progress bar and
   back-to-top button are added and the site behaves as before.
========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var mq = function (q) { return window.matchMedia(q).matches; };
  var REDUCE = mq('(prefers-reduced-motion: reduce)');
  var FINE = mq('(hover: hover) and (pointer: fine)');
  var RTL = function () { return root.getAttribute('dir') === 'rtl'; };
  // Only genuinely constrained devices lose the heavy layer.
  var LITE = !!((navigator.connection && navigator.connection.saveData) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 2));
  // The <head> guard times out after 2.5s; if we arrive later, skip the intro.
  var INTRO = root.classList.contains('motion-pending');
  var release = function () { root.classList.remove('motion-pending'); };

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var mk = function (tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; };

  var lenis = null;

  /* ---------------------------------------------------------
     1. Always on: scroll progress + back to top
  --------------------------------------------------------- */
  function scrollToY(target) {
    if (lenis) { lenis.scrollTo(target, { duration: 1.6 }); return; }
    var y = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: y, behavior: REDUCE ? 'auto' : 'smooth' });
  }

  (function progressAndTop() {
    var bar = mk('div', 'm-progress');
    bar.setAttribute('aria-hidden', 'true');
    var R = 25, C = 2 * Math.PI * R;
    var top = mk('button', 'm-top');
    top.type = 'button';
    top.setAttribute('aria-label', 'Back to top');
    top.innerHTML =
      '<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="m-top-track" cx="26" cy="26" r="' + R + '"/>' +
      '<circle class="m-top-ring" cx="26" cy="26" r="' + R + '" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '"/></svg>' +
      '<i class="bi bi-arrow-up" aria-hidden="true"></i>';
    document.body.appendChild(bar);
    document.body.appendChild(top);
    var ring = top.querySelector('.m-top-ring');

    var ticking = false;
    function update() {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
      bar.style.transform = 'scaleX(' + p + ')';
      ring.style.strokeDashoffset = String(C * (1 - p));
      top.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.7);
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();

    top.addEventListener('click', function () {
      scrollToY(0);
      var first = $('.site-header a, .site-header button');
      if (first) first.focus({ preventScroll: true });
    });
  })();

  /* ---------------------------------------------------------
     2. Bail out cleanly when motion isn't wanted or available
  --------------------------------------------------------- */
  if (REDUCE || !window.gsap || !window.ScrollTrigger) { release(); return; }

  var gsap = window.gsap, ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  ST.config({ ignoreMobileResize: true });
  root.classList.add('has-motion');

  /* ---------------------------------------------------------
     3. Smooth scroll (desktop wheel only — touch stays native)
  --------------------------------------------------------- */
  if (window.Lenis && FINE && !LITE) {
    lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);

    // In-page scrolling goes through Lenis so it glides instead of fighting it.
    document.addEventListener('click', function (e) {
      var nextBtn = e.target.closest('[data-scroll-next]');
      var link = e.target.closest('a[href^="#"]');
      var sel = nextBtn ? nextBtn.getAttribute('data-scroll-next') :
        (link && !link.classList.contains('skip-link') ? link.getAttribute('href') : null);
      if (!sel || sel === '#') return;
      var target;
      try { target = document.querySelector(sel); } catch (err) { return; }
      if (!target) return;
      e.preventDefault();
      e.stopPropagation(); // capture phase: main.js's scrollIntoView never runs
      lenis.scrollTo(target, { duration: 1.4 });
    }, true);
  }
  var SCRUB = lenis ? true : 0.6; // Lenis already smooths; otherwise ease the scrub itself

  var hidden = new Set(); // elements we hid, so nothing can be left invisible

  try { init(); } catch (err) {
    // Never leave content hidden: undo everything and fall back to the static site.
    if (window.console) console.error('[motion] disabled after error:', err);
    ST.getAll().forEach(function (t) { t.kill(); });
    hidden.forEach(function (el) { gsap.set(el._mWords || el, { clearProps: 'all' }); });
    gsap.set(document.querySelectorAll('.m-clip,.m-move,.m-word,[data-reveal] *,.site-header,.hero-media,.hero-content *,.h2-hero *'), { clearProps: 'all' });
    root.classList.remove('has-motion');
    release();
  }

  function init() {
  /* ---------------------------------------------------------
     4. Helpers
  --------------------------------------------------------- */
  function markHidden(els) { els.forEach(function (el) { hidden.add(el); }); }
  function shown(els) { els.forEach(function (el) { hidden.delete(el); }); }
  function isPast(el) { return el.getBoundingClientRect().bottom < 0; }

  // Split a heading into masked words; <br> becomes line groups.
  function splitWords(el) {
    if (el._mWords) return el._mWords;
    var nodes = Array.prototype.slice.call(el.childNodes);
    var hasBr = nodes.some(function (n) { return n.nodeName === 'BR'; });
    if (hasBr) {
      var clone = el.cloneNode(true);
      $$('br', clone).forEach(function (b) { b.replaceWith(' '); });
      el.setAttribute('aria-label', clone.textContent.replace(/\s+/g, ' ').trim());
    }
    var frag = document.createDocumentFragment();
    var line = hasBr ? frag.appendChild(mk('span', 'm-line')) : null;
    var lineIdx = 0, words = [];
    var put = function (n) { (line || frag).appendChild(n); };
    var addWord = function (content) {
      var m = mk('span', 'm-mask'), w = mk('span', 'm-word');
      if (typeof content === 'string') w.textContent = content; else w.appendChild(content);
      m.appendChild(w); put(m); w._line = lineIdx; words.push(w);
    };
    nodes.forEach(function (n) {
      if (n.nodeName === 'BR') {
        if (hasBr) { line = frag.appendChild(mk('span', 'm-line')); lineIdx++; }
        return;
      }
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) put(document.createTextNode(' '));
          else addWord(part);
        });
      } else if (n.nodeType === 1) {
        addWord(n);
      }
    });
    el.textContent = '';
    el.appendChild(frag);
    if (hasBr) $$('.m-line', el).forEach(function (l) { l.setAttribute('aria-hidden', 'true'); });
    el.setAttribute('data-m-split', '');
    el._mWords = words;
    return words;
  }

  var wordStagger = function (i, t) { return (t._line || 0) * 0.1 + i * 0.032; };

  // Wrap an image so the frame (clip) and the picture (move) animate independently.
  function wrapImg(img) {
    var existing = img.closest('.m-clip');
    if (existing) return existing;
    var clip = mk('span', 'm-clip'), move = mk('span', 'm-move');
    img.parentNode.insertBefore(clip, img);
    move.appendChild(img);
    clip.appendChild(move);
    return clip;
  }

  var CLIP_FROM = {
    bottom: 'inset(100% 0% 0% 0%)',
    left: 'inset(0% 100% 0% 0%)',
    right: 'inset(0% 0% 0% 100%)'
  };
  var CLIP_OPEN = 'inset(0% 0% 0% 0%)';

  function prepImg(clip, from) {
    if (isPast(clip)) return false;
    gsap.set(clip, { clipPath: CLIP_FROM[from || 'bottom'], scale: 0.92, transformOrigin: '50% 100%' });
    gsap.set(clip.firstElementChild, { scale: 1.32 });
    markHidden([clip]);
    return true;
  }
  function playImg(clip, delay, endScale) {
    shown([clip]);
    gsap.to(clip, { clipPath: CLIP_OPEN, scale: 1, duration: 1.5, delay: delay || 0, ease: 'expo.inOut', clearProps: 'clipPath,transform' });
    gsap.to(clip.firstElementChild, { scale: endScale || 1, duration: 2, delay: (delay || 0) + 0.1, ease: 'expo.out' });
  }

  function withNoTransition(targets) {
    return {
      onStart: function () { targets.forEach(function (t) { t.classList.add('m-animating'); }); },
      onComplete: function () { targets.forEach(function (t) { t.classList.remove('m-animating'); }); }
    };
  }

  var HERO_SEL = '.hero,.h2-hero,.sd-hero,.bd-hero,.cs-hero,.err-hero,[class^="page-hero"],[class*=" page-hero"]';
  var CARD_SEL = '.testimonial-card,.svc-dir-card,.promise-card,.team-card,.blog-card';
  var CARD_IMG_SEL = '.svc-dir-card img,.blog-card img,.team-card img';

  /* ---------------------------------------------------------
     5. Header entrance + mobile menu choreography
  --------------------------------------------------------- */
  var header = $('.site-header');
  var introTl = gsap.timeline({ delay: 0.1 });
  // Hold the intro behind the preloader; play it as the panel lifts.
  if (root.classList.contains('pl-active') && !(window.LuxePreloader && window.LuxePreloader.done)) {
    introTl.pause();
    document.addEventListener('luxedrive:preloaded', function () { introTl.play(); }, { once: true });
  }
  if (header && INTRO) {
    introTl.from(header, { yPercent: -100, duration: 1.3, ease: 'expo.out', clearProps: 'transform' }, 0);
  }

  var offcanvas = $('.offcanvas-nav');
  if (offcanvas) {
    offcanvas.setAttribute('data-lenis-prevent', '');
    var ocLinks = $$('a', offcanvas);
    new MutationObserver(function () {
      var open = offcanvas.classList.contains('is-open');
      if (open) {
        if (lenis) lenis.stop();
        gsap.fromTo(ocLinks, { y: 46, opacity: 0 }, {
          y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.05, delay: 0.2,
          overwrite: true, clearProps: 'transform,opacity'
        });
      } else if (lenis) {
        lenis.start();
      }
    }).observe(offcanvas, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---------------------------------------------------------
     6. Hero intros (one orchestrated moment per page)
  --------------------------------------------------------- */
  function heroCopyIntro(content, at) {
    if (!content) return;
    var h1 = $('h1', content);
    var words = h1 ? splitWords(h1) : [];
    var others = Array.prototype.slice.call(content.children).filter(function (c) { return c !== h1 && !c.contains(h1); });
    if (!INTRO) return;
    if (others.length) {
      introTl.from(others, { y: 30, opacity: 0, duration: 1.3, stagger: 0.09, ease: 'expo.out', clearProps: 'transform,opacity' }, at + 0.15);
    }
    if (words.length) {
      introTl.from(words, { yPercent: 118, rotate: 4, transformOrigin: '0% 100%', duration: 1.4, ease: 'expo.out', stagger: wordStagger }, at);
    }
  }

  // Home — full-bleed video hero
  var hero = $('.hero');
  if (hero) {
    var heroMedia = $('.hero-media', hero);
    heroCopyIntro($('.hero-content', hero), 0.25);
    if (INTRO && heroMedia) introTl.from(heroMedia, { scale: 1.18, duration: 2.6, ease: 'power3.out', clearProps: 'transform' }, 0);
    var ind = $('.scroll-indicator', hero);
    if (INTRO && ind) introTl.from(ind.children, { opacity: 0, y: 12, duration: 1, stagger: 0.1, clearProps: 'transform,opacity' }, 1.1);
  }

  // Home 2 — split hero
  var h2hero = $('.h2-hero');
  if (h2hero) {
    heroCopyIntro($('.h2-hero-copy', h2hero), 0.35);
    var h2media = $('.h2-hero-media', h2hero);
    var h2vid = h2media && $('video,img', h2media);
    if (INTRO && h2media) {
      introTl.fromTo(h2media, { clipPath: RTL() ? CLIP_FROM.left : CLIP_FROM.right }, { clipPath: CLIP_OPEN, duration: 1.7, ease: 'expo.inOut', clearProps: 'clipPath' }, 0.05);
      if (h2vid) introTl.from(h2vid, { scale: 1.3, duration: 2.4, ease: 'expo.out' }, 0.1);
    }
  }

  // Inner page heroes
  $$('[class^="page-hero"],[class*=" page-hero"]').forEach(function (ph) {
    heroCopyIntro($(':scope > .container-wide', ph), 0.2);
  });
  ['.sd-hero .sd-hero-content', '.bd-hero .bd-hero-content', '.cs-hero .cs-content', '.err-hero .err-content'].forEach(function (s) {
    var c = $(s);
    if (c) heroCopyIntro(c, 0.2);
  });
  $$('.cs-hero > img,.err-hero > img').forEach(function (img) {
    if (INTRO) introTl.from(img, { scale: 1.2, duration: 2.4, ease: 'power3.out', clearProps: 'transform' }, 0);
  });

  /* ---------------------------------------------------------
     7. Split-word headings (section titles)
  --------------------------------------------------------- */
  $$('main .display-2, main .display-3').forEach(function (h) {
    if (h.closest(HERO_SEL) || h.closest('.bay-info')) return;
    var words = splitWords(h);
    if (!words.length || isPast(h)) return;
    gsap.set(words, { yPercent: 118, rotate: 3, transformOrigin: '0% 100%' });
    markHidden([h]);
    ST.create({
      trigger: h, start: 'top 88%', once: true,
      onEnter: function () {
        shown([h]);
        gsap.to(words, { yPercent: 0, rotate: 0, duration: 1.25, ease: 'expo.out', stagger: wordStagger });
      }
    });
  });

  /* ---------------------------------------------------------
     8. Images: clip-path reveals
  --------------------------------------------------------- */
  // Card images reveal as their card lands
  $$(CARD_IMG_SEL).forEach(function (img) {
    var clip = wrapImg(img);
    if (prepImg(clip, 'bottom')) {
      ST.create({ trigger: clip, start: 'top 90%', once: true, onEnter: function () { playImg(clip, 0.15, 1); } });
    }
  });

  // Gallery tiles reveal in a staggered cascade; parallax layer added later
  var galleryClips = $$('.gallery-item > img').map(function (img) { return wrapImg(img); });
  var galleryToReveal = galleryClips.filter(function (c) { return prepImg(c, 'bottom'); });
  if (galleryToReveal.length) {
    ST.batch(galleryToReveal, {
      start: 'top 92%', once: true, interval: 0.12,
      onEnter: function (batch) { batch.forEach(function (c, i) { playImg(c, i * 0.13, 1.12); }); }
    });
  }

  // Home 2 studio bays open like doors, one after another
  var bays = $$('.h2-bay').filter(function (b) { return !isPast(b); });
  if (bays.length) {
    gsap.set(bays, { clipPath: CLIP_FROM.bottom });
    markHidden(bays);
    ST.batch(bays, {
      start: 'top 90%', once: true,
      onEnter: function (batch) {
        shown(batch);
        gsap.to(batch, { clipPath: CLIP_OPEN, duration: 1.4, ease: 'expo.inOut', stagger: 0.12, clearProps: 'clipPath' });
      }
    });
  }

  // Blog feature: the frame opens, the photo settles
  var feature = $('.blog-featured');
  if (feature && !isPast(feature)) {
    gsap.set(feature, { clipPath: 'inset(12% 6% 12% 6%)' });
    markHidden([feature]);
    ST.create({
      trigger: feature, start: 'top 85%', once: true,
      onEnter: function () {
        shown([feature]);
        gsap.to(feature, { clipPath: CLIP_OPEN, duration: 1.6, ease: 'expo.inOut', clearProps: 'clipPath' });
      }
    });
  }

  /* ---------------------------------------------------------
     9. Cards: staggered 3D entrance
  --------------------------------------------------------- */
  var cards = $$(CARD_SEL).filter(function (c) { return !isPast(c); });
  if (cards.length) {
    gsap.set(cards, { y: 70, rotationX: -14, transformPerspective: 1100, transformOrigin: '50% 0%', opacity: 0 });
    markHidden(cards);
    ST.batch(cards, {
      start: 'top 90%', once: true, interval: 0.1,
      onEnter: function (batch) {
        shown(batch);
        gsap.to(batch, Object.assign({
          y: 0, rotationX: 0, opacity: 1, duration: 1.35, ease: 'expo.out', stagger: 0.12,
          overwrite: 'auto', clearProps: 'transform,opacity'
        }, withNoTransition(batch)));
      }
    });
  }

  /* ---------------------------------------------------------
     10. Everything else marked data-reveal, plus list-like rows
  --------------------------------------------------------- */
  var SPECIAL = '.ceramic-feature,.testimonial-track,.h2-bays,.blog-featured';
  var SKIP = CARD_SEL + ',.gallery-item,.m-clip,[data-m-split],.svc-bg,.h2-bay';
  var FLAT = 'ul,ol,.intro-stats,.hero-cta-row';

  function collect(el, depth) {
    var out = [];
    Array.prototype.slice.call(el.children).forEach(function (child) {
      if (child.matches(SKIP)) return;
      if (depth < 3 && (child.matches(FLAT) || child.querySelector(SKIP + ',' + FLAT))) {
        out = out.concat(collect(child, depth + 1));
      } else {
        out.push(child);
      }
    });
    return out;
  }

  var generic = new Set();
  $$('[data-reveal]').forEach(function (el) {
    if (el.matches(SPECIAL) || el.matches('[data-m-split]') || el.closest(HERO_SEL)) return;
    var t = collect(el, 0);
    if (!t.length && !el.matches(SKIP)) t = [el];
    t.forEach(function (x) { generic.add(x); });
  });
  $$('.pricing-row,.tl-row,.accordion-item,.benefit-item,.included-list li,.info-list li,.sidebar-block,.summary-row,.tech-specs li').forEach(function (el) {
    if (!el.closest(HERO_SEL)) generic.add(el);
  });
  // The ceramic pin choreographs its own specs on wide screens
  var ceramic = $('.ceramic-feature');
  var ceramicSpecs = ceramic ? $$('.tech-specs li', ceramic) : [];
  var ceramicPinned = !!ceramic && mq('(min-width:1025px)') && !LITE;
  if (ceramic) {
    var cLabel = $('.ceramic-copy > .label', ceramic);
    if (cLabel) generic.add(cLabel);
    if (ceramicPinned) ceramicSpecs.forEach(function (li) { generic.delete(li); });
    var cBtn = $('.ceramic-copy > .btn', ceramic);
    if (cBtn && !ceramicPinned) generic.add(cBtn);
  }

  var genericList = Array.from(generic).filter(function (el) { return !isPast(el); });
  if (genericList.length) {
    genericList.forEach(function (el) {
      var sideways = el.matches('.aftercare-list > li,.tl-row');
      var dir = RTL() ? -1 : 1;
      if (el.matches('.tech-specs li')) {
        gsap.set(el, { clipPath: RTL() ? CLIP_FROM.right : CLIP_FROM.left });
      } else {
        gsap.set(el, sideways ? { x: 56 * dir, opacity: 0 } : { y: 46, opacity: 0 });
      }
    });
    markHidden(genericList);
    ST.batch(genericList, {
      start: 'top 90%', once: true, interval: 0.1, batchMax: 8,
      onEnter: function (batch) {
        shown(batch);
        gsap.to(batch, Object.assign({
          x: 0, y: 0, opacity: 1, clipPath: CLIP_OPEN, duration: 1.25, ease: 'expo.out', stagger: 0.085,
          overwrite: 'auto', clearProps: 'transform,opacity,clipPath'
        }, withNoTransition(batch)));
      }
    });
  }

  /* ---------------------------------------------------------
     11. Breakpoint-aware layer: parallax, pinning, drift
         (gsap.matchMedia reverts all of this cleanly on resize)
  --------------------------------------------------------- */
  // All start states are set; lift the guard before scroll tweens read computed styles.
  release();

  var interactive = { tilt: false }; // read by pointer handlers below
  var mm = gsap.matchMedia();

  mm.add({ desk: '(min-width: 901px)', wide: '(min-width: 1025px)', mob: '(max-width: 900px)' }, function (ctx) {
    var c = ctx.conditions;
    var rich = c.desk && !LITE;
    interactive.tilt = rich && FINE;

    /* --- Home hero: layered exit --- */
    if (hero) {
      var content = $('.hero-content', hero), media = $('.hero-media', hero);
      var tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: SCRUB } });
      if (rich) {
        tl.fromTo(media, { yPercent: 0, scale: 1 }, { yPercent: 28, scale: 1.1, ease: 'none', immediateRender: false }, 0)
          .fromTo(content, { y: 0, scale: 1, opacity: 1 }, { y: function () { return -window.innerHeight * 0.2; }, scale: 0.95, opacity: 0, transformOrigin: '0% 100%', ease: 'none', immediateRender: false }, 0)
          .to($$('.hero-tags span', hero), { x: function (i) { return (RTL() ? 1 : -1) * (i + 1) * 26; }, ease: 'none' }, 0)
          .fromTo($('.scroll-indicator', hero), { y: 0, opacity: 1 }, { y: -60, opacity: 0, ease: 'none', immediateRender: false }, 0);
      } else {
        tl.fromTo(content, { y: 0, opacity: 1 }, { y: -60, opacity: 0.1, ease: 'none', immediateRender: false }, 0);
      }
    }

    /* --- Home 2 hero: copy lifts away faster than the film --- */
    if (h2hero && rich) {
      var copy = $('.h2-hero-copy', h2hero), vid = $('.h2-hero-media video, .h2-hero-media img', h2hero);
      gsap.timeline({ scrollTrigger: { trigger: h2hero, start: 'top top', end: 'bottom top', scrub: SCRUB } })
        .fromTo(copy, { y: 0, scale: 1, opacity: 1 }, { y: -140, scale: 0.95, opacity: 0.15, transformOrigin: '0% 50%', ease: 'none', immediateRender: false }, 0)
        .to(vid, { yPercent: 14, ease: 'none' }, 0);
    }

    /* --- Background-image parallax on hero/CTA pseudo layers --- */
    if (rich) {
      $$('[class^="page-hero"],[class*=" page-hero"],[class^="cta-strip"],[class*=" cta-strip"]').forEach(function (el) {
        var bg = getComputedStyle(el, '::before').backgroundImage;
        if (!bg || bg.indexOf('url(') === -1) return;
        el.classList.add('m-bg-par');
        var atTop = el.getBoundingClientRect().top < window.innerHeight;
        gsap.fromTo(el, { '--m-bg-y': atTop ? '0%' : '-7%' }, {
          '--m-bg-y': atTop ? '14%' : '7%', ease: 'none',
          scrollTrigger: { trigger: el, start: atTop ? 'top top' : 'top bottom', end: 'bottom top', scrub: SCRUB }
        });
      });
      $$('[class^="page-hero"] > .container-wide,[class*=" page-hero"] > .container-wide,.sd-hero-content,.bd-hero-content').forEach(function (el) {
        gsap.fromTo(el, { y: 0, opacity: 1 }, { y: -70, opacity: 0.2, ease: 'none', immediateRender: false, scrollTrigger: { trigger: el.parentElement, start: 'top top', end: 'bottom top', scrub: SCRUB } });
      });
      $$('.sd-hero > img,.bd-hero > img,.blog-featured > img').forEach(function (img) {
        var isTop = img.parentElement.getBoundingClientRect().top < window.innerHeight;
        gsap.fromTo(img, { yPercent: isTop ? 0 : -7, scale: 1.16 }, {
          yPercent: isTop ? 14 : 7, ease: 'none',
          scrollTrigger: { trigger: img.parentElement, start: isTop ? 'top top' : 'top bottom', end: 'bottom top', scrub: SCRUB }
        });
      });
    }

    /* --- Gallery: slow inner parallax, wide tiles drift sideways, tiles ease back on exit --- */
    if (rich) {
      galleryClips.forEach(function (clip) {
        var item = clip.parentElement;
        var wide = item.classList.contains('wide');
        var move = clip.firstElementChild;
        gsap.fromTo(move, wide ? { xPercent: RTL() ? 4 : -4 } : { yPercent: -5 }, {
          xPercent: wide ? (RTL() ? -4 : 4) : 0, yPercent: wide ? 0 : 5, ease: 'none',
          scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: SCRUB }
        });
        gsap.fromTo(clip, { scale: 1 }, {
          scale: 0.93, transformOrigin: '50% 0%', ease: 'none', immediateRender: false,
          scrollTrigger: { trigger: item, start: 'bottom 35%', end: 'bottom top', scrub: SCRUB }
        });
      });
    }

    /* --- Text and supporting blocks at different speeds --- */
    if (rich) {
      [['.intro-stats', 70], ['.aftercare-list', 50], ['.testimonial-track', 36]].forEach(function (pair) {
        $$(pair[0]).forEach(function (el) {
          gsap.fromTo(el, { yPercent: 0, y: pair[1] }, {
            y: -pair[1], ease: 'none',
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: SCRUB }
          });
        });
      });

      // Large statement lines drift apart as they pass
      $$('#intro .display-2 .m-line').forEach(function (line, i) {
        var s = (i % 2 ? 1 : -1) * (RTL() ? -1 : 1);
        line.closest('section').classList.add('m-clip-x');
        gsap.fromTo(line, { x: -34 * s }, { x: 34 * s, ease: 'none', scrollTrigger: { trigger: line, start: 'top bottom', end: 'bottom top', scrub: SCRUB } });
      });
      // CTA headlines slide against the scroll
      $$('.cta-title').forEach(function (t) {
        t.closest('section').classList.add('m-clip-x');
        var d = RTL() ? -1 : 1;
        gsap.fromTo(t, { xPercent: 7 * d }, { xPercent: -3 * d, ease: 'none', scrollTrigger: { trigger: t.closest('section'), start: 'top bottom', end: 'bottom top', scrub: SCRUB } });
      });
    }

    /* --- Ceramic feature: pinned while the specs light up one by one --- */
    if (ceramic) {
      var cImg = $('.ceramic-media img', ceramic);
      var cClip = cImg ? wrapImg(cImg) : null;
      var cMove = cClip ? cClip.firstElementChild : null;
      var cBtn2 = $('.ceramic-copy > .btn', ceramic);

      if (c.wide && !LITE && cClip) {
        // Frame wipes open as the section rises into view
        gsap.fromTo(cClip, { clipPath: RTL() ? CLIP_FROM.right : CLIP_FROM.left }, {
          clipPath: CLIP_OPEN, ease: 'none',
          scrollTrigger: { trigger: ceramic, start: 'top bottom', end: 'top top', scrub: SCRUB }
        });
        gsap.fromTo(cMove, { scale: 1.35 }, {
          scale: 1.12, ease: 'none',
          scrollTrigger: { trigger: ceramic, start: 'top bottom', end: 'top top', scrub: SCRUB }
        });
        var pin = gsap.timeline({
          scrollTrigger: { trigger: ceramic, start: 'top top', end: '+=90%', pin: true, scrub: SCRUB, anticipatePin: 1 }
        });
        pin.fromTo(ceramicSpecs, { opacity: 0.12, x: RTL() ? -40 : 40 }, { opacity: 1, x: 0, duration: 0.6, stagger: 0.4, ease: 'power2.out' }, 0.1);
        if (cBtn2) pin.fromTo(cBtn2, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '>-0.15');
        pin.to(cMove, { scale: 1, xPercent: RTL() ? 4 : -4, duration: pin.duration() + 0.2, ease: 'none' }, 0);
      } else if (cClip && !isPast(cClip)) {
        gsap.set(cClip, { clipPath: CLIP_FROM.bottom });
        gsap.set(cMove, { scale: 1.3 });
        ST.create({
          trigger: cClip, start: 'top 85%', once: true,
          onEnter: function () {
            gsap.to(cClip, { clipPath: CLIP_OPEN, duration: 1.5, ease: 'expo.inOut' });
            gsap.to(cMove, { scale: 1, duration: 2, ease: 'expo.out' });
          }
        });
      }
    }

    /* --- Home 2 story: sticky frame swaps images as each chapter arrives --- */
    var story = $('.h2-sticky-section');
    if (story && c.desk) {
      var sMedia = $('.h2-sticky-media', story);
      var panels = $$('.h2-panel-item', story);
      var base = sMedia && $('img', sMedia);
      if (base && panels.length > 1) {
        // Chapter images: Protection (film being fitted), Perfection (finished car under studio light)
        var extra = ['assets/images/ppf.jpg', 'assets/images/Paint Correction.jpg'];
        var stack = mk('div', 'm-story-stack');
        sMedia.insertBefore(stack, base);
        stack.appendChild(base);
        var frames = [base];
        extra.slice(0, panels.length - 1).forEach(function (src) {
          var im = mk('img');
          im.src = src; im.alt = ''; im.setAttribute('aria-hidden', 'true'); im.decoding = 'async';
          stack.appendChild(im);
          frames.push(im);
        });
        var bar = mk('span', 'm-story-bar');
        sMedia.appendChild(bar);

        gsap.set(frames.slice(1), { clipPath: CLIP_FROM.bottom, scale: 1.2 });
        gsap.set(panels.slice(1), { opacity: 0.28 });

        var active = 0;
        var show = function (i) {
          if (i === active) return;
          frames.forEach(function (f, j) {
            if (j === 0) return;
            var on = j <= i;
            gsap.to(f, { clipPath: on ? CLIP_OPEN : CLIP_FROM.bottom, scale: on ? 1 : 1.2, duration: 1.3, ease: 'expo.inOut', overwrite: true });
          });
          panels.forEach(function (p, j) { gsap.to(p, { opacity: j === i ? 1 : 0.28, duration: 0.8, ease: 'power2.out', overwrite: 'auto' }); });
          active = i;
        };
        panels.forEach(function (p, i) {
          ST.create({
            trigger: p, start: 'top 60%', end: 'bottom 40%',
            onEnter: function () { show(i); }, onEnterBack: function () { show(i); }
          });
        });
        gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: story, start: 'top top', end: 'bottom bottom', scrub: SCRUB } });

        return function () {
          // Restore original markup when leaving the desktop layout
          sMedia.insertBefore(base, stack);
          stack.remove(); bar.remove();
          gsap.set(panels, { clearProps: 'opacity' });
        };
      }
    }
  });

  /* ---------------------------------------------------------
     12. Pointer layer: tilt, magnetic, cursor (desktop only)
  --------------------------------------------------------- */
  if (FINE && !LITE) {
    // Subtle 3D tilt on cards
    $$(CARD_SEL).forEach(function (card) {
      card.classList.add('m-tilt');
      var rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' });
      var ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
      card.addEventListener('pointerenter', function () {
        if (!interactive.tilt || hidden.has(card)) return;
        gsap.set(card, { transformPerspective: 900 });
        gsap.to(card, { y: -6, scale: 1.012, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
      });
      card.addEventListener('pointermove', function (e) {
        if (!interactive.tilt || hidden.has(card)) return;
        var r = card.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 7);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 7);
      });
      card.addEventListener('pointerleave', function () {
        rx(0); ry(0);
        gsap.to(card, { y: 0, scale: 1, duration: 0.9, ease: 'power3.out', overwrite: 'auto' });
      });
    });

    // Magnetic buttons
    $$('.btn-primary, .header-actions .icon-btn, .scroll-indicator, .m-top, .social-row .icon-btn').forEach(function (el) {
      if (el.closest('.offcanvas-nav')) return;
      el.classList.add('is-magnetic');
      var strength = el.classList.contains('btn') ? 0.22 : 0.35;
      var xTo = gsap.quickTo(el, 'x', { duration: 0.55, ease: 'power3' });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.55, ease: 'power3' });
      el.addEventListener('pointermove', function (e) {
        if (window.innerWidth < 1025) return;
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      });
      el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });

    // Cursor follower
    var ring = mk('div', 'm-cursor'), dot = mk('div', 'm-cursor-dot');
    ring.setAttribute('aria-hidden', 'true'); dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ring); document.body.appendChild(dot);
    var rX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
    var rY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
    var dX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
    var dY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    var HOVER = 'a,button,[role="button"],input,select,textarea,label,.gallery-item,.h2-bay,.svc-row,.process-head';
    var setActive = function (on) { ring.classList.toggle('is-active', on); dot.classList.toggle('is-active', on); };

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || window.innerWidth < 1025) { setActive(false); return; }
      rX(e.clientX); rY(e.clientY); dX(e.clientX); dY(e.clientY);
      setActive(true);
    }, { passive: true });
    document.addEventListener('pointerover', function (e) {
      var t = e.target;
      ring.classList.toggle('is-hover', !!(t.closest && t.closest(HOVER)));
      ring.classList.toggle('is-scrub', !!(t.closest && t.closest('.hero-video')));
    });
    document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) setActive(false); });
  }

  /* ---------------------------------------------------------
     13. Keep triggers accurate as the layout changes
  --------------------------------------------------------- */
  // Accordions, gallery filters and late-loading media change page height.
  var lastH = document.body.scrollHeight, rTimer;
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      clearTimeout(rTimer);
      rTimer = setTimeout(function () {
        var h = document.body.scrollHeight;
        if (Math.abs(h - lastH) > 2) { ST.refresh(); lastH = document.body.scrollHeight; }
      }, 180);
    }).observe(document.body);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); lastH = document.body.scrollHeight; });

  // Failsafe: anything we hid that is already above the viewport is shown instantly.
  function sweep() {
    hidden.forEach(function (el) {
      if (isPast(el)) {
        var words = el._mWords;
        gsap.set(words || el, { clearProps: 'all' });
        if (!words) gsap.set($$('.m-move', el), { scale: 1 });
        hidden.delete(el);
      }
    });
  }
  window.addEventListener('load', function () { ST.refresh(); sweep(); });
  ST.addEventListener('refresh', sweep);

  release();
  } // init
})();
