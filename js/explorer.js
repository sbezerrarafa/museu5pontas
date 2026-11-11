/* Explorador 3D: orbitar a maquete, clicar nos pontos de interesse, ligar ao tour 360° */
(function () {
  const canvas = document.getElementById('fort-canvas');
  if (!canvas || !window.THREE || !window.buildFort) return;
  const box = canvas.parentElement;
  const labelsEl = document.getElementById('fort-labels');
  const panel = { name: document.getElementById('spot-name'), text: document.getElementById('spot-text'), go: document.getElementById('spot-tour'), list: document.getElementById('spot-list') };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, LOWPOWER ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xf1e6d0);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf1e6d0, 45, 90);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xfff4de, 0xe6ddc8, 0.75));
  const sun = new THREE.DirectionalLight(0xfff0d8, 0.66);
  sun.position.set(8, 14, 6); sun.castShadow = true; sun.shadow.mapSize.set(LOWPOWER ? 1024 : 2048, LOWPOWER ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
  scene.add(sun);

  const fort = buildFort();
  scene.add(fort);
  const spots = fort.userData.spots;

  // câmera orbital manual (alvo, ângulos, distância), com suavização
  const target = new THREE.Vector3(0, 0.5, 0), goalTarget = target.clone();
  let theta = 0.5, phi = 1.0, dist = 38;
  let gTheta = theta, gPhi = phi, gDist = dist;
  function setFromPos(arr) {
    const p = new THREE.Vector3(...arr).sub(goalTarget);
    gDist = p.length(); gPhi = Math.acos(p.y / gDist); gTheta = Math.atan2(p.x, p.z);
    // menor caminho angular
    while (gTheta - theta > Math.PI) gTheta -= Math.PI * 2;
    while (gTheta - theta < -Math.PI) gTheta += Math.PI * 2;
  }

  // toque: 1 dedo gira na horizontal (a rolagem vertical da página continua livre), 2 dedos = pinça de zoom.
  // mouse: arrastar gira nos dois eixos; roda dá zoom.
  const touch = matchMedia('(pointer:coarse)').matches;
  canvas.style.touchAction = touch ? 'pan-y' : 'none';
  const ptrs = new Map(); let drag = false, auto = true, idle = 0, pinch0 = 0, dist0 = 0;
  const zoom = f => { gDist = Math.max(10, Math.min(55, gDist * f)); };
  canvas.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, e); drag = true; auto = false; canvas.setPointerCapture(e.pointerId);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); dist0 = gDist; }
  });
  const up = e => { ptrs.delete(e.pointerId); if (!ptrs.size) { drag = false; idle = 0; } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointermove', e => {
    const prev = ptrs.get(e.pointerId); if (!prev) return;
    ptrs.set(e.pointerId, e);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch0) gDist = Math.max(10, Math.min(55, dist0 * pinch0 / d)); return;
    }
    gTheta -= (e.clientX - prev.clientX) * 0.007;
    if (!touch) gPhi = Math.max(0.25, Math.min(1.45, gPhi - (e.clientY - prev.clientY) * 0.007));
  });
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(1 + e.deltaY * 0.01); }, { passive: false });
  document.getElementById('fort-zoom-in').onclick = () => { zoom(0.8); auto = false; };
  document.getElementById('fort-zoom-out').onclick = () => { zoom(1.25); auto = false; };
  document.getElementById('fort-tilt').onclick = () => { gPhi = gPhi > 0.8 ? 0.45 : 1.1; auto = false; };

  // marcadores HTML
  let current = null;
  const tourBtn = panel.go;
  const buttons = spots.map((s, i) => {
    const b = document.createElement('button');
    b.className = 'hotspot'; b.innerHTML = `<i>${i + 1}</i><span>${s.name}</span>`;
    b.onclick = () => select(i);
    labelsEl.appendChild(b);
    const li = document.createElement('button');
    li.textContent = `${i + 1}. ${s.name}`; li.onclick = () => select(i);
    panel.list.appendChild(li);
    return { b, li };
  });

  function select(i) {
    current = i; const s = spots[i];
    buttons.forEach((o, j) => { o.b.classList.toggle('on', j === i); o.li.classList.toggle('on', j === i); });
    panel.name.textContent = s.name; panel.text.textContent = s.text;
    tourBtn.hidden = false;
    goalTarget.set(s.pos.x * 0.6, 0.5, s.pos.z * 0.6);
    setFromPos(s.cam);
    auto = false;
  }
  tourBtn.onclick = () => {
    if (current === null) return;
    document.dispatchEvent(new CustomEvent('tour-goto', { detail: spots[current].room }));
    document.getElementById('tour').scrollIntoView({ behavior: 'smooth' });
  };
  document.getElementById('fort-reset').onclick = () => {
    current = null; goalTarget.set(0, 0.5, 0); gTheta = theta + 0; gPhi = 1.0; gDist = 38; auto = true;
    buttons.forEach(o => { o.b.classList.remove('on'); o.li.classList.remove('on'); });
    panel.name.textContent = 'Explore o forte'; panel.text.textContent = 'Arraste para girar, use a roda para aproximar e clique nos pontos numerados.';
    tourBtn.hidden = true;
  };

  function resize() {
    const w = box.clientWidth, h = box.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  let visible = false;
  new IntersectionObserver(([e]) => visible = e.isIntersecting).observe(box);

  const v = new THREE.Vector3();
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    if (!drag) { idle++; if (idle > 400 && current === null) auto = true; }
    if (auto) gTheta += 0.0025;
    theta += (gTheta - theta) * 0.07; phi += (gPhi - phi) * 0.07; dist += (gDist - dist) * 0.07;
    target.lerp(goalTarget, 0.07);
    camera.position.set(
      target.x + dist * Math.sin(phi) * Math.sin(theta),
      target.y + dist * Math.cos(phi),
      target.z + dist * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(target);
    fort.userData.flag.rotation.y = Math.sin(performance.now() / 350) * 0.35;
    renderer.render(scene, camera);

    // posiciona rótulos
    const w = box.clientWidth, h = box.clientHeight;
    spots.forEach((s, i) => {
      v.copy(s.pos).project(camera);
      const o = buttons[i].b;
      const vis = v.z < 1;
      o.style.display = vis ? '' : 'none';
      o.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-14px,-14px)`;
    });
  })();
})();
