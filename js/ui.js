/* UI: nav, reveal on scroll, contadores, tilt 3D nos cards */
(function () {
  const nav = document.getElementById('nav');
  // menu do celular
  const burger = document.getElementById('burger');
  burger.addEventListener('click', () => { const o = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : ''; });
  nav.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); document.body.style.overflow = ''; }));
  const onScroll = () => nav.classList.toggle('solid', scrollY > 40);
  addEventListener('scroll', onScroll); onScroll();

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    e.target.querySelectorAll('[data-count]').forEach(count);
  }), { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (i % 3) * 90 + 'ms';
    io.observe(el);
  });

  function count(el) {
    const end = +el.dataset.count, t0 = performance.now(), dur = 1600;
    (function step(t) {
      const p = Math.min((t - t0) / dur, 1), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
      el.textContent = end >= 10000 ? v.toLocaleString('pt-BR') : v;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  document.querySelectorAll('.tilt').forEach(el => {
    el.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;   // sem inclinação em toque (atrapalha a rolagem)
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transition = 'transform .08s';
      el.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-4px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transition = 'transform .5s'; el.style.transform = '';
    });
  });
})();
