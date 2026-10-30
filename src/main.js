import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const isDesktop = () => window.matchMedia('(min-width: 901px)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- smooth scroll ---------------- */
const lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: !reduced });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();

$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  const target = id === '#top' ? 0 : $(id);
  if (target === null) return;
  e.preventDefault();
  closeMenu();
  lenis.scrollTo(target, { offset: 0, duration: 1.6 });
}));
// pin spacers change the page height; keep Lenis' scroll limit in sync
ScrollTrigger.addEventListener('refresh', () => lenis.resize());

/* ---------------- hero WebGL ---------------- */
// three.js is the heaviest dependency, so it loads as its own chunk while the loader runs
let gl = null;
const glReady = import('./hero-gl.js')
  .then(({ createHeroGL }) => { gl = createHeroGL($('#gl'), { mobile: !isDesktop() }); })
  .catch((err) => console.warn('WebGL unavailable', err));

/* ---------------- loader ---------------- */
const STATUS = ['Collecting PET waste', 'Loading catalyst', 'Depolymerizing', 'Filtering solids', 'W2V™ Monomer ready'];
function runLoader() {
  return new Promise((resolve) => {
    const countEl = $('#loaderCount');
    const statusEl = $('#loaderStatus');
    const ring = $('.loader__ring-fill');
    const imgs = $$('img').filter((i) => i.loading !== 'lazy');
    let loaded = 0;
    const total = imgs.length + 2;
    const bump = () => { loaded++; };
    imgs.forEach((i) => (i.complete ? bump() : (i.addEventListener('load', bump, { once: true }), i.addEventListener('error', bump, { once: true }))));
    document.fonts.ready.then(bump);
    glReady.then(bump);

    const state = { v: 0 };
    const start = performance.now();
    const MIN = reduced ? 300 : 2400;
    function frame(now) {
      const real = loaded / total;
      const timeCap = Math.min(1, (now - start) / MIN);
      const target = Math.min(real, timeCap) * 100;
      state.v += (target - state.v) * 0.08;
      if (target === 100 && state.v > 99.5) state.v = 100;
      const v = Math.floor(state.v);
      countEl.textContent = String(v).padStart(3, '0');
      ring.style.strokeDashoffset = 327 - (327 * state.v) / 100;
      statusEl.textContent = STATUS[Math.min(STATUS.length - 1, Math.floor((state.v / 100) * STATUS.length))];
      if (state.v >= 100) return resolve();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

function revealSite() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.inOut' } });
  tl.to('.loader__center, .loader__status, .loader__formula', { opacity: 0, y: -20, duration: 0.5, ease: 'power2.in' })
    .to('.loader__count', { yPercent: 100, duration: 0.7, ease: 'power3.in' }, '<')
    .to('.loader__curtain', { yPercent: -100, duration: 0.9 }, '-=0.2')
    .set('.loader', { background: 'transparent' })
    .to('.loader__curtain', { yPercent: -200, duration: 0.9 })
    .add(() => {
      $('#loader').remove();
      document.body.classList.remove('is-loading');
      lenis.start();
      ScrollTrigger.refresh();
    })
    .add(heroIntro(), '-=0.75');
}

function heroIntro() {
  const tl = gsap.timeline();
  tl.from('[data-hero-line]', { yPercent: 115, rotate: 4, duration: 1.4, stagger: 0.12, ease: 'expo.out' })
    .from('.hero__eyebrow', { opacity: 0, y: 20, duration: 1, ease: 'expo.out' }, 0.1)
    .from('[data-hero-fade]', { opacity: 0, y: 30, duration: 1.2, stagger: 0.1, ease: 'expo.out' }, 0.35)
    .from('.nav > *', { opacity: 0, y: -20, duration: 1, stagger: 0.06, ease: 'expo.out' }, 0.2);
  if (gl) tl.to(gl.uniforms.uIntro, { value: 1, duration: 3.2, ease: 'power3.out' }, 0);
  return tl;
}

/* ---------------- hero scroll morph ---------------- */
function heroScroll() {
  const hud = $('#hudState');
  // one timeline on the pinned trigger: separate triggers on a pinned element get pushed past the pin
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#hero', start: 'top top', end: '+=160%', pin: true, scrub: 1,
      onUpdate: (self) => {
        const p = self.progress;
        if (gl) gl.uniforms.uProgress.value = Math.min(1, p / 0.8);
        const label = p < 0.15 ? 'Mixed PET waste' : p < 0.68 ? 'Depolymerizing…' : 'W2V™ Monomer · BHET';
        if (hud && hud.textContent !== label) { hud.textContent = label; hud.classList.toggle('is-clean', p >= 0.68); }
      },
    },
  });
  tl.to('.hero__scroll', { opacity: 0, duration: 0.08 }, 0)
    .to('.hero__bottom, .hero__top', { opacity: 0, y: -60, duration: 0.3 }, 0)
    .to('.hero__title', { opacity: 0, yPercent: -25, filter: 'blur(8px)', duration: 0.45 }, 0.05)
    .fromTo('.hero__final', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.2 }, 0.72)
    .to({}, { duration: 0.08 });
}

/* ---------------- nav ---------------- */
const nav = $('#nav');
let lastY = 0;
lenis.on('scroll', ({ scroll }) => {
  nav.classList.toggle('is-scrolled', scroll > 40);
  if (!document.body.classList.contains('menu-open')) nav.classList.toggle('is-hidden', scroll > lastY && scroll > 600);
  lastY = scroll;
});

const burger = $('#burger');
const menu = $('#menu');
function closeMenu() {
  if (!menu.classList.contains('is-open')) return;
  menu.classList.remove('is-open');
  document.body.classList.remove('menu-open');
  burger.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-hidden', 'true');
  menu.inert = true;
  lenis.start();
  burger.focus();
}
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
burger.addEventListener('click', () => {
  if (menu.classList.contains('is-open')) return closeMenu();
  menu.classList.add('is-open');
  document.body.classList.add('menu-open');
  burger.setAttribute('aria-expanded', 'true');
  menu.setAttribute('aria-hidden', 'false');
  menu.inert = false;
  lenis.stop();
  setTimeout(() => $('a', menu).focus({ preventScroll: true }), 300);
});

/* ---------------- cursor + magnetic ---------------- */
if (finePointer) {
  const cursor = $('.cursor');
  const dot = $('.cursor__dot');
  const ring = $('.cursor__ring');
  const label = $('.cursor__label');
  const pos = { x: innerWidth / 2, y: innerHeight / 2 }, rp = { ...pos };
  window.addEventListener('pointermove', (e) => { pos.x = e.clientX; pos.y = e.clientY; });
  gsap.ticker.add(() => {
    rp.x += (pos.x - rp.x) * 0.18; rp.y += (pos.y - rp.y) * 0.18;
    dot.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    ring.style.transform = `translate(${rp.x}px, ${rp.y}px)`;
  });
  document.addEventListener('pointerover', (e) => {
    const labelled = e.target.closest('[data-cursor]');
    const hov = e.target.closest('a, button, [data-hover]');
    cursor.classList.toggle('is-label', !!labelled);
    cursor.classList.toggle('is-hover', !labelled && !!hov);
    if (labelled) label.textContent = labelled.dataset.cursor;
  });

  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.3);
      yTo((e.clientY - r.top - r.height / 2) * 0.4);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });

  $$('[data-tilt]').forEach((el) => {
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      ry((px - 0.5) * 10);
      rx((0.5 - py) * 8);
      el.style.setProperty('--gx', `${px * 100}%`);
      el.style.setProperty('--gy', `${py * 100}%`);
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });

  const blob = $('#ctaBlob');
  const cta = $('.cta');
  const bx = gsap.quickTo(blob, 'left', { duration: 1.2, ease: 'power3.out' });
  const by = gsap.quickTo(blob, 'top', { duration: 1.2, ease: 'power3.out' });
  cta.addEventListener('pointermove', (e) => { const r = cta.getBoundingClientRect(); bx(e.clientX - r.left); by(e.clientY - r.top); });
}

/* ---------------- text splitting ---------------- */
function splitChars(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="line" style="display:inline-block;vertical-align:top"><span class="line__in" style="display:inline-block">${[...w].map((c) => `<span class="ch" style="display:inline-block">${c}</span>`).join('')}</span></span>`).join(' ');
  el.setAttribute('aria-label', words.join(' '));
}
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
}

/* ---------------- scroll animations ---------------- */
function scrollAnims() {
  $$('[data-split]').forEach((el) => {
    splitChars(el);
    gsap.from($$('.ch', el), { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.018, scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  $$('[data-rise]').forEach((el) => {
    gsap.from(el, { yPercent: 110, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });

  $$('[data-words]').forEach((el) => {
    splitWords(el);
    gsap.to($$('.w', el), { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true } });
    gsap.from($$('.w', el), { color: '#C8FF2E', stagger: 0.1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 60%', end: 'bottom 25%', scrub: true } });
  });

  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
  });
  gsap.set('[data-reveal]', { opacity: 0 });

  $$('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.to(o, { v: end, duration: 2, ease: 'power3.out', onUpdate: () => { el.textContent = o.v.toFixed(dec); } }),
    });
  });

  $$('.bar').forEach((b) => ScrollTrigger.create({ trigger: b, start: 'top 90%', once: true, onEnter: () => b.classList.add('is-in') }));

  // footer mark
  gsap.from('.footer__mark span', { yPercent: 100, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: '.footer__mark', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  gsap.from('.footer__mark .slash', { rotate: -180, ease: 'none', scrollTrigger: { trigger: '.footer__mark', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  // section image parallax
  $$('.card__img').forEach((img) => gsap.fromTo(img, { yPercent: 20 }, { yPercent: -10, ease: 'none', scrollTrigger: { trigger: img.closest('.card'), start: 'top bottom', end: 'bottom top', scrub: true } }));
}

/* ---------------- process: horizontal ---------------- */
function processScroll() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    const track = $('#processTrack');
    const dist = () => track.scrollWidth - window.innerWidth;
    const bar = $('#processBar');
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.process', start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 1, invalidateOnRefresh: true,
        onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
      },
    });
    $$('.step__media img').forEach((img) => gsap.fromTo(img, { xPercent: 6 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: img, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } }));
    $$('.step').forEach((s) => gsap.from(s, { rotate: 3, y: 60, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: s, containerAnimation: tween, start: 'left 105%', end: 'left 60%', scrub: true } }));
  });
}

/* ---------------- touch / small-screen motion ---------------- */
function mobileMotion() {
  const mm = gsap.matchMedia();
  mm.add('(max-width: 900px)', () => {
    // process: sticky stacking cards; each card sinks back as the next slides over it
    const steps = $$('.step');
    steps.forEach((s, i) => {
      s.style.top = `${84 + i * 12}px`;
      const next = steps[i + 1];
      if (!next) return;
      gsap.to(s, {
        scale: 0.9, filter: 'brightness(0.45)', transformOrigin: 'center top', ease: 'none',
        scrollTrigger: { trigger: next, start: 'top bottom', end: `top ${84 + (i + 1) * 12}px`, scrub: true },
      });
    });

    // image wipes
    $$('.step__media').forEach((m) => gsap.fromTo(m, { clipPath: 'inset(0 0 100% 0 round 14px)' }, { clipPath: 'inset(0 0 0% 0 round 14px)', duration: 1.3, ease: 'expo.inOut', scrollTrigger: { trigger: m, start: 'top 88%' } }));

    // audience cards flip up into place
    $$('.card').forEach((c) => gsap.from(c, { rotateX: -28, y: 90, opacity: 0, transformOrigin: '50% 0%', duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: c, start: 'top 90%' } }));

    return () => steps.forEach((s) => { s.style.top = ''; });
  });

  // carpet results pop in
  gsap.from('.result', { scale: 0.82, y: 30, opacity: 0, duration: 0.9, ease: 'back.out(1.8)', stagger: 0.08, scrollTrigger: { trigger: '.results', start: 'top 85%' } });

  // news images wipe in on every screen size
  $$('.ncard__img').forEach((m) => gsap.fromTo(m, { clipPath: 'inset(100% 0 0 0 round 14px)' }, { clipPath: 'inset(0% 0 0 0 round 14px)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: m, start: 'top 90%' } }));

  // marquee leans into the scroll
  const track = $('.marquee__track');
  const skewTo = gsap.quickTo(track, 'skewX', { duration: 0.5, ease: 'power3.out' });
  lenis.on('scroll', ({ velocity }) => skewTo(gsap.utils.clamp(-14, 14, -velocity * 0.6)));

  // tap ripple on buttons (touch)
  if (!finePointer) {
    $$('.btn').forEach((b) => b.addEventListener('pointerdown', (e) => {
      const r = b.getBoundingClientRect();
      const dot = document.createElement('i');
      dot.className = 'ripple';
      dot.style.left = `${e.clientX - r.left}px`;
      dot.style.top = `${e.clientY - r.top}px`;
      b.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());
    }));
  }
}

/* ---------------- carpet story ---------------- */
function carpetStory() {
  const frames = $$('.cframe');
  const items = $$('.cstory__steps li');
  const dial = $('#cDial');
  let current = 0;
  const setActive = (i) => {
    if (i === current) return;
    current = i;
    items.forEach((li, k) => li.classList.toggle('is-active', k === i));
    dial.textContent = String(i + 1).padStart(2, '0');
  };

  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#cstory', start: 'top top', end: '+=260%', pin: '.cstory__pin', scrub: 1,
        onUpdate: (self) => setActive(Math.min(3, Math.floor(self.progress * 4 * 0.999))),
      },
    });
    frames.forEach((f, i) => {
      if (i === 0) { tl.to($('img', f), { scale: 1, duration: 1, ease: 'none' }, 0); return; }
      tl.to(f, { clipPath: 'inset(0% 0 0 0)', duration: 1, ease: 'power2.inOut' }, i - 0.25)
        .to($('img', f), { scale: 1, duration: 1.25, ease: 'none' }, i - 0.25);
    });
    return () => { gsap.set(frames.slice(1), { clipPath: 'inset(100% 0 0 0)' }); };
  });
  mm.add('(max-width: 900px)', () => {
    // on small screens: auto-cycle the frames while the story is on screen; the timer bar drives the cycle
    const bar = $('#cTimer');
    let tw = null;
    const show = (i) => {
      setActive(i);
      frames.forEach((f, k) => {
        gsap.to(f, { clipPath: k <= i ? 'inset(0% 0 0 0)' : 'inset(100% 0 0 0)', duration: 0.9, ease: 'expo.inOut' });
        if (k === i) gsap.fromTo($('img', f), { scale: 1.25 }, { scale: 1.05, duration: 2.6, ease: 'power2.out' });
      });
    };
    const cycle = (i) => {
      tw?.kill();
      show(i);
      tw = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 2.6, ease: 'none', onComplete: () => cycle((i + 1) % 4) });
    };
    const st = ScrollTrigger.create({
      trigger: '#cstory', start: 'top 70%', end: 'bottom 30%',
      onToggle: (self) => { if (self.isActive) cycle(current); else tw?.kill(); },
    });
    const onTap = (i) => () => cycle(i);
    const handlers = items.map((li, i) => { const h = onTap(i); li.addEventListener('click', h); return h; });
    return () => { tw?.kill(); st.kill(); items.forEach((li, i) => li.removeEventListener('click', handlers[i])); };
  });

  // scale-up line
  const steps = $('.scale__steps');
  const lis = $$('li', steps);
  gsap.to('#scaleFill', {
    scaleX: 1, ease: 'none',
    scrollTrigger: {
      trigger: '.scale', start: 'top 75%', end: 'bottom 55%', scrub: true,
      onUpdate: (self) => {
        steps.style.setProperty('--p', self.progress.toFixed(3)); // vertical fill on mobile
        lis.forEach((li, i) => li.classList.toggle('is-lit', self.progress >= i / (lis.length - 1) - 0.02));
      },
    },
  });
}

/* ---------------- plants viz ---------------- */
function plantsViz() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = $('#plantsSvg');
  const lines = $('.pv-lines', svg), sources = $('.pv-sources', svg);
  const names = ['Film', 'Bottles', 'Carpet', 'Textiles', 'Labels', 'Fiber', 'Scrap', 'Ocean'];
  const paths = [];
  names.forEach((n, i) => {
    const a = (i / names.length) * Math.PI * 2 - Math.PI / 2 + (i % 2 ? 0.18 : -0.1);
    const r = i % 2 ? 210 : 140;
    const x = 250 + Math.cos(a) * r, y = 250 + Math.sin(a) * r;
    const cx = 250 + Math.cos(a + 0.5) * r * 0.55, cy = 250 + Math.sin(a + 0.5) * r * 0.55;
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', `M${x},${y} Q${cx},${cy} 250,250`);
    lines.appendChild(p);
    const len = p.getTotalLength();
    p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'pv-src');
    g.innerHTML = `<circle cx="${x}" cy="${y}" r="7"/><text x="${x}" y="${y + (y > 250 ? 24 : -14)}" text-anchor="middle">${n}</text>`;
    sources.appendChild(g);
    const pk = document.createElementNS(NS, 'circle');
    pk.setAttribute('r', '3'); pk.setAttribute('class', 'pv-packet');
    lines.appendChild(pk);
    paths.push({ p, len, pk, t: Math.random(), speed: 0.12 + Math.random() * 0.1 });
  });

  gsap.to($$('path', lines), { strokeDashoffset: 0, duration: 1.6, stagger: 0.08, ease: 'power3.inOut', scrollTrigger: { trigger: svg, start: 'top 75%' } });
  gsap.from($$('.pv-src', sources), { scale: 0, transformOrigin: 'center', opacity: 0, duration: 0.8, stagger: 0.06, ease: 'back.out(2)', scrollTrigger: { trigger: svg, start: 'top 75%' } });
  gsap.from('.pv-rings circle', { scale: 0.4, opacity: 0, transformOrigin: '250px 250px', duration: 1.4, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: svg, start: 'top 80%' } });

  let on = false;
  ScrollTrigger.create({ trigger: svg, start: 'top bottom', end: 'bottom top', onToggle: (s) => { on = s.isActive; } });
  gsap.ticker.add((_, dt) => {
    if (!on) return;
    paths.forEach((o) => {
      o.t = (o.t + (dt / 1000) * o.speed) % 1;
      const pt = o.p.getPointAtLength(o.t * o.len);
      o.pk.setAttribute('cx', pt.x); o.pk.setAttribute('cy', pt.y);
      o.pk.setAttribute('opacity', Math.sin(o.t * Math.PI).toFixed(2));
    });
  });
}

/* ---------------- boot ---------------- */
heroScroll();
processScroll();
scrollAnims();
carpetStory();
plantsViz();
mobileMotion();

runLoader().then(revealSite);
window.addEventListener('load', () => ScrollTrigger.refresh());
