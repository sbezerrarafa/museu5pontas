/* Hero: maquete 3D do forte girando devagar, com água do fosso e partículas */
(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || !window.THREE || !window.buildFort) return;
  const hero = canvas.parentElement;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 23, 38);

  scene.add(new THREE.HemisphereLight(0xfff4de, 0xe6ddc8, 0.75));
  const sun = new THREE.DirectionalLight(0xfff0d8, 0.66);
  sun.position.set(8, 14, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
  scene.add(sun);

  const fort = buildFort();
  scene.add(fort);

  // partículas (poeira dourada no ar)
  const N = 220, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * 6.28, d = 6 + Math.random() * 14;
    pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = Math.random() * 7; pos[i * 3 + 2] = Math.sin(a) * d;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xe8541e, size: 0.06, transparent: true, opacity: 0.55 }));
  scene.add(dust);

  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const wide = w > 860;
    camera.setViewOffset(w, h, wide ? -w * 0.23 : 0, wide ? 0 : -h * 0.22, w, h);
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  // ---- interação: arrastar gira (com inércia), clique dá um impulso, giro de abertura ----
  const AUTO = 0.12;          // rad/s de rotação lenta
  let rot = 0, vel = 7;       // vel inicial = "giradinha" ao carregar
  let drag = false, moved = 0, lastX = 0, lastT = 0, dragV = 0;
  canvas.style.cursor = 'grab';
  canvas.style.touchAction = 'pan-y';   // no celular, rolar a página na vertical continua funcionando
  canvas.addEventListener('pointerdown', e => {
    drag = true; moved = 0; lastX = e.clientX; lastT = performance.now(); dragV = 0;
    canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
    document.getElementById('hero-hint')?.classList.add('hide');
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - lastX, now = performance.now(), dt = Math.max(now - lastT, 1) / 1000;
    rot += dx * 0.008; moved += Math.abs(dx);
    dragV = dx * 0.008 / dt; lastX = e.clientX; lastT = now;
  });
  const end = () => {
    if (!drag) return; drag = false; canvas.style.cursor = 'grab';
    vel = moved < 5 ? 6 : Math.max(-14, Math.min(14, dragV));   // clique simples = giro; arrasto = inércia
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  let mx = 0, my = 0, sc = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
  addEventListener('scroll', () => { sc = Math.min(scrollY / innerHeight, 1.5); });
  let visible = true;
  new IntersectionObserver(([e]) => visible = e.isIntersecting).observe(hero);

  const clock = new THREE.Clock();
  let prevMs = performance.now();
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    const t = clock.getElapsedTime();
    const nowMs = performance.now(), dt = Math.min((nowMs - prevMs) / 1000, 0.05); prevMs = nowMs;
    if (!drag) {
      rot += vel * dt;
      vel += (AUTO - vel) * Math.min(dt * 1.8, 1);   // volta suavemente à rotação lenta
    }
    fort.rotation.y = rot + sc * 1.6;
    fort.userData.flag.rotation.y = Math.sin(t * 3) * 0.35;
    camera.position.x += (mx * 3 - camera.position.x) * 0.04;
    camera.position.y += ((23 + my * 3 - sc * 3) - camera.position.y) * 0.04;
    camera.lookAt(0, 0.5, 0);
    dust.rotation.y = t * 0.02;
    renderer.render(scene, camera);
  })();
})();
