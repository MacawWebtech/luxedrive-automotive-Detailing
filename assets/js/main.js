// =========================================
// LuxeDrive Auto Studio — Core interactions
// =========================================

// ---- Theme ----
(function initTheme(){
  const stored = localStorage.getItem('luxedrive-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'dark'); // dark is brand default
  document.documentElement.setAttribute('data-theme', theme);
  // Match the toggle icon to the restored theme
  document.querySelectorAll('[data-theme-toggle] .bi').forEach(icon=>{
    icon.className = theme === 'dark' ? 'bi bi-moon-stars' : 'bi bi-sun';
  });
})();

function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('luxedrive-theme', next);
  document.querySelectorAll('[data-theme-toggle] .bi').forEach(icon=>{
    icon.className = next === 'dark' ? 'bi bi-moon-stars' : 'bi bi-sun';
  });
}

// ---- RTL ----
function toggleDir(){
  const isRTL = document.documentElement.getAttribute('dir') === 'rtl';
  const next = isRTL ? 'ltr' : 'rtl';
  document.documentElement.setAttribute('dir', next);
  localStorage.setItem('luxedrive-dir', next);
}
(function initDir(){
  const stored = localStorage.getItem('luxedrive-dir');
  if(stored) document.documentElement.setAttribute('dir', stored);
})();

// ---- Sticky header ----
const header = document.querySelector('.site-header');
function onScrollHeader(){
  if(!header) return;
  header.classList.toggle('is-scrolled', window.scrollY > 40);
}
window.addEventListener('scroll', onScrollHeader, {passive:true});
onScrollHeader();

// ---- Offcanvas nav ----
const navToggle = document.querySelector('.nav-toggle');
const offcanvas = document.querySelector('.offcanvas-nav');
const offcanvasClose = document.querySelector('.offcanvas-close');
function openOffcanvas(){ offcanvas?.classList.add('is-open'); document.body.style.overflow='hidden'; }
function closeOffcanvas(){ offcanvas?.classList.remove('is-open'); document.body.style.overflow=''; }
navToggle?.addEventListener('click', openOffcanvas);
offcanvasClose?.addEventListener('click', closeOffcanvas);
offcanvas?.querySelectorAll('a').forEach(a=>a.addEventListener('click', closeOffcanvas));

// ---- Theme / dir toggle buttons ----
document.querySelectorAll('[data-theme-toggle]').forEach(btn=>btn.addEventListener('click', toggleTheme));
document.querySelectorAll('[data-dir-toggle]').forEach(btn=>btn.addEventListener('click', toggleDir));

// ---- Scroll indicator ----
document.querySelectorAll('[data-scroll-next]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const target = document.querySelector(btn.dataset.scrollNext);
    target?.scrollIntoView({behavior:'smooth'});
  });
});

// ---- Scroll reveal ----
const revealEls = document.querySelectorAll('[data-reveal]');
if('IntersectionObserver' in window && revealEls.length){
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, {threshold:.15});
  revealEls.forEach(el=>io.observe(el));
} else {
  revealEls.forEach(el=>el.classList.add('is-visible'));
}

// ---- Counter animation ----
const counters = document.querySelectorAll('[data-counter]');
if(counters.length && 'IntersectionObserver' in window){
  const counterIO = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseFloat(el.dataset.counter);
      const suffix = el.dataset.suffix || '';
      const duration = 1600;
      const start = performance.now();
      function tick(now){
        const p = Math.min((now-start)/duration, 1);
        const eased = 1 - Math.pow(1-p, 3);
        el.textContent = Math.round(target*eased).toLocaleString() + suffix;
        if(p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      counterIO.unobserve(el);
    });
  }, {threshold:.4});
  counters.forEach(el=>counterIO.observe(el));
}

// ---- Hero video cursor-scrub ----
// Moving the cursor horizontally over the hero seeks the video's playback
// position instead of letting it autoplay — the "animation" is the scrub itself.
(function initHeroScrub(){
  const video = document.getElementById('heroVideo');
  if(!video) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches; // touch devices
  if(reduceMotion || isCoarsePointer){
    return; // fall back to the static poster frame — no scrub binding
  }

  const SENSITIVITY = 0.8;
  let previousX = null;
  let targetTime = 0;
  let isSeeking = false;

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function requestSeek(){
    if(!Number.isFinite(video.duration) || video.duration <= 0) return;
    const nextTime = clamp(targetTime, 0, video.duration);
    if(Math.abs(video.currentTime - nextTime) < 0.01){ isSeeking = false; return; }
    isSeeking = true;
    video.currentTime = nextTime;
  }

  video.addEventListener('loadedmetadata', () => { targetTime = video.currentTime; });
  video.addEventListener('seeked', () => {
    isSeeking = false;
    if(Math.abs(video.currentTime - targetTime) > 0.01) requestSeek();
  });

  const heroEl = video.closest('.hero') || window;
  heroEl.addEventListener('mousemove', (event) => {
    if(!Number.isFinite(video.duration) || video.duration <= 0){
      previousX = event.clientX;
      return;
    }
    if(previousX === null){
      previousX = event.clientX;
      targetTime = video.currentTime;
      return;
    }
    const delta = event.clientX - previousX;
    previousX = event.clientX;
    const timeOffset = (delta / window.innerWidth) * SENSITIVITY * video.duration;
    targetTime = clamp(targetTime + timeOffset, 0, video.duration);
    if(!isSeeking) requestSeek();
  });

  document.documentElement.addEventListener('mouseleave', () => { previousX = null; });
})();

// ---- Before / After slider ----
document.querySelectorAll('.ba-wrap').forEach(wrap=>{
  const after = wrap.querySelector('.ba-after');
  const handle = wrap.querySelector('.ba-handle');
  const range = wrap.querySelector('.ba-range');
  function setPos(pct){
    pct = Math.max(0, Math.min(100, pct));
    after.style.clipPath = `inset(0 0 0 ${pct}%)`;
    handle.style.left = pct + '%';
  }
  range?.addEventListener('input', e=> setPos(e.target.value));
  let dragging = false;
  wrap.addEventListener('pointerdown', ()=> dragging = true);
  window.addEventListener('pointerup', ()=> dragging = false);
  wrap.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const rect = wrap.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setPos(pct);
    if(range) range.value = pct;
  });
  handle?.addEventListener('keydown', e=>{
    const current = parseFloat(handle.style.left) || 50;
    if(e.key === 'ArrowLeft'){ setPos(current-5); if(range) range.value=current-5; }
    if(e.key === 'ArrowRight'){ setPos(current+5); if(range) range.value=current+5; }
  });
});

// ---- Process accordion ----
document.querySelectorAll('.process-item').forEach(item=>{
  item.querySelector('.process-head')?.addEventListener('click', ()=>{
    const wasOpen = item.classList.contains('is-open');
    item.parentElement.querySelectorAll('.process-item').forEach(i=>i.classList.remove('is-open'));
    if(!wasOpen) item.classList.add('is-open');
  });
});

// ---- Gallery filter ----
const filterBtns = document.querySelectorAll('.gallery-filters button');
const galleryItems = document.querySelectorAll('.gallery-item');
filterBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    filterBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.filter;
    galleryItems.forEach(item=>{
      const show = cat === 'all' || item.dataset.category === cat;
      item.hidden = !show;
    });
    document.querySelectorAll('.gallery-grid').forEach(g=>g.classList.toggle('is-filtered', cat !== 'all'));
  });
});

// ---- FAQ accordion (Bootstrap handles collapse; this just moves the icon) ----
document.querySelectorAll('.accordion-button').forEach(btn=>{
  btn.addEventListener('click', function(){
    setTimeout(()=>{
      document.querySelectorAll('.accordion-button').forEach(b=>{
        const icon = b.querySelector('.acc-icon');
        if(icon) icon.className = b.classList.contains('collapsed') ? 'bi bi-plus acc-icon' : 'bi bi-dash acc-icon';
      });
    }, 10);
  });
});

// ---- Simple form validation ----
document.querySelectorAll('form[data-validate]').forEach(form=>{
  form.addEventListener('submit', function(e){
    e.preventDefault();
    let valid = true;
    form.querySelectorAll('[required]').forEach(input=>{
      const field = input.closest('.field');
      if(!input.value.trim()){
        valid = false;
        field?.classList.add('has-error');
      } else {
        field?.classList.remove('has-error');
      }
      if(input.type === 'email' && input.value && !/^\S+@\S+\.\S+$/.test(input.value)){
        valid = false;
        field?.classList.add('has-error');
      }
    });
    const successEl = form.parentElement.querySelector('.form-success');
    if(valid){
      form.hidden = true;
      if(successEl) successEl.classList.add('is-visible');
    }
  });
});

/* Home 2 gallery: bay-door panels */
(function(){
  var bays=document.querySelectorAll('.h2-bay');
  if(!bays.length) return;
  var hoverable=window.matchMedia('(hover:hover) and (min-width:761px)');
  function open(b){bays.forEach(function(x){var on=x===b;x.classList.toggle('is-open',on);x.setAttribute('aria-expanded',on);});}
  bays.forEach(function(b){
    b.addEventListener('click',function(){open(b);});
    b.addEventListener('focus',function(){open(b);});
    b.addEventListener('mouseenter',function(){if(hoverable.matches) open(b);});
  });
})();
