/* Visita caminhável.
   - Com vídeo 360° (equirretangular) gravado andando por um percurso: o tempo do vídeo = posição
     no percurso. Segurar "Andar" (ou W / ↑) reproduz o vídeo; S / ↓ volta; arrastar olha ao redor.
   - Sem vídeo: simulação em primeira pessoa dentro da maquete 3D, com os mesmos controles.
   Controles: Andar ▲ / W / ↑ · Voltar ▼ / S / ↓ · arrastar = olhar · minimapa clicável. */
(function () {
  const canvas = document.getElementById('tour-canvas');
  if (!canvas || !window.THREE || !window.buildFort) return;
  const box = document.getElementById('tour-box');
  const $ = id => document.getElementById(id);

  // ====== CONFIGURAÇÃO ======
  const VIDEO_SOURCES = ['video/tour360.mp4'];   // coloque aqui o vídeo 360° real (2:1) do percurso
  const SIM_SPEED = 1.3;                         // unidades/s na simulação
  // p = posição no percurso (0..1). Em vídeo real: p = tempo / duração. look = direção do olhar (graus, mundo)
  const ROOMS = [
    { name: 'Portal e pátio', p: 0.40, look: -90, yaw: 0, text: 'O pátio de pedra, com o mastro da bandeira, depois do portal de entrada.' },
    { name: 'Ala leste', p: 0.58, look: 0, yaw: 0, text: 'A ala de telhado de barro com as exposições de fotografia e cartografia.' },
    { name: 'Ala norte', p: 0.80, look: -90, yaw: 0, text: 'A ala dos fundos: salas de exposição e apoio ao acervo.' },
    { name: 'Muralhas e baluartes', p: 0.97, look: 135, yaw: 0, text: 'As muralhas caiadas e os baluartes que protegiam o forte.' },
  ];

  const fortRoot = buildFort();
  const plan = fortRoot.userData.plan;
  const curve = new THREE.CatmullRomCurve3(fortRoot.userData.walk.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.3);
  const pathLen = curve.getLength();

  // ---- renderer / cenas ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 400);

  // cena de vídeo 360°
  const vScene = new THREE.Scene();
  const vGeo = new THREE.SphereGeometry(500, 64, 40); vGeo.scale(-1, 1, 1);
  const vMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  vScene.add(new THREE.Mesh(vGeo, vMat));

  // cena de simulação (maquete em primeira pessoa)
  const sScene = new THREE.Scene();
  sScene.background = new THREE.Color(0xbfd8ea);
  sScene.fog = new THREE.Fog(0xcfe2ee, 22, 70);
  sScene.add(new THREE.HemisphereLight(0xdcecff, 0xb7a98a, 0.55));
  const sun = new THREE.DirectionalLight(0xfff0d8, 0.8);
  sun.position.set(8, 14, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 45 });
  sScene.add(sun);
  const far = new THREE.Mesh(new THREE.CircleGeometry(200, 48), new THREE.MeshStandardMaterial({ color: 0x6b9a3a, roughness: 1 }));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.05; sScene.add(far);
  sScene.add(fortRoot);

  // ---- estado ----
  let mode = null, video = null;
  let p = 0, lon = 0, lat = 0, head = -90, walk = 0, auto = false, drag = false, idleLook = 0, phase = 0;
  const label = $('tour-source'), seek = $('seek'), playBtn = $('btn-play'), caption = $('tour-caption'), hint = $('drag-hint');
  const hideHint = () => hint.classList.add('hide');
  const deg = r => r * 180 / Math.PI;
  const norm = a => ((a + 540) % 360) - 180;
  const tangentLon = pp => { const t = curve.getTangentAt(Math.min(Math.max(pp, 0), 1)); return deg(Math.atan2(t.z, t.x)); };

  function useSim() {
    mode = 'sim'; head = tangentLon(p);
    label.textContent = 'Simulação 3D · sem vídeo 360° ainda';
  }
  function tryVideo(i) {
    if (i >= VIDEO_SOURCES.length) return useSim();
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous'; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = VIDEO_SOURCES[i];
    v.addEventListener('error', () => tryVideo(i + 1), { once: true });
    v.addEventListener('loadeddata', () => {
      video = v; mode = 'video';
      const t = new THREE.VideoTexture(v); t.encoding = THREE.sRGBEncoding;
      vMat.map = t; vMat.color.set(0xffffff); vMat.needsUpdate = true;
      label.textContent = 'Tour 360° em vídeo';
    }, { once: true });
    v.load();
  }
  useSim();            // começa já com a simulação; troca para vídeo se ele carregar
  tryVideo(0);

  // ---- salas ----
  const roomsEl = $('rooms');
  ROOMS.forEach((r, i) => {
    const b = document.createElement('button'); b.textContent = `${i + 1}. ${r.name}`;
    b.onclick = () => goRoom(i); roomsEl.appendChild(b);
  });
  function setP(np) {
    p = Math.min(Math.max(np, 0), 1);
    if (mode === 'video' && video && video.duration) video.currentTime = p * video.duration;
  }
  function goRoom(i) {
    const r = ROOMS[i]; if (!r) return;
    [...roomsEl.children].forEach((c, j) => c.classList.toggle('on', j === i));
    setP(r.p); auto = false; walk = 0; hideHint();
    if (mode === 'sim') { head = tangentLon(p); lon = norm(r.look - head); } else { lon = r.yaw; }
    lat = 0; if (video) video.pause();
  }
  document.addEventListener('tour-goto', e => goRoom(e.detail));

  // ---- controles de caminhada ----
  const hold = (el, dir) => {
    const on = e => { e.preventDefault(); walk = dir; auto = false; hideHint(); };
    const off = () => { if (walk === dir) walk = 0; };
    el.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, off));
  };
  hold($('btn-walk'), 1); hold($('btn-back'), -1);
  playBtn.onclick = () => { auto = !auto; walk = 0; if (auto && p >= 1) setP(0); hideHint(); };
  seek.oninput = () => { setP(seek.value / 1000); walk = 0; auto = false; };
  $('btn-full').onclick = () => { document.fullscreenElement ? document.exitFullscreen() : box.requestFullscreen && box.requestFullscreen(); };

  let hover = false;
  box.addEventListener('pointerenter', () => hover = true); box.addEventListener('pointerleave', () => hover = false);
  const keyDir = k => (k === 'w' || k === 'W' || k === 'ArrowUp') ? 1 : (k === 's' || k === 'S' || k === 'ArrowDown') ? -1 : 0;
  addEventListener('keydown', e => {
    const d = keyDir(e.key); if (!d || !(hover || document.fullscreenElement)) return;
    e.preventDefault(); walk = d; auto = false; hideHint();
  });
  addEventListener('keyup', e => { if (keyDir(e.key) === walk) walk = 0; });

  // ---- olhar (arrastar) ----
  let px = 0, py = 0;
  canvas.addEventListener('pointerdown', e => { drag = true; px = e.clientX; py = e.clientY; idleLook = 0; hideHint(); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => drag = false);
  canvas.addEventListener('pointermove', e => {
    if (!drag) return; const k = camera.fov / 600;
    lon -= (e.clientX - px) * k; lat = Math.max(-80, Math.min(80, lat + (e.clientY - py) * k)); px = e.clientX; py = e.clientY;
  });
  canvas.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.shiftKey) return;           // sem Ctrl/Shift a roda continua rolando a página
    e.preventDefault(); camera.fov = Math.max(35, Math.min(100, camera.fov + e.deltaY * 0.05)); camera.updateProjectionMatrix();
  }, { passive: false });

  // giroscópio
  let gyro = false, g0 = null;
  $('btn-gyro').onclick = async () => {
    if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) {
      try { if (await DeviceOrientationEvent.requestPermission() !== 'granted') return; } catch (e) { return; }
    }
    gyro = !gyro; g0 = null; hideHint();
  };
  addEventListener('deviceorientation', e => {
    if (!gyro || e.alpha == null) return;
    if (g0 === null) g0 = e.alpha - lon;
    lon = e.alpha - g0; lat = Math.max(-80, Math.min(80, e.beta - 90));
  });

  // ---- minimapa ----
  const mm = $('minimap'), mg = mm.getContext('2d'), MS = 190, DPR = Math.min(devicePixelRatio, 2);
  mm.width = mm.height = MS * DPR; mg.scale(DPR, DPR);
  const SC = MS / 23, CX = MS / 2, CY = MS / 2;
  const mx = x => CX + x * SC, my = z => CY + z * SC;
  const samples = Array.from({ length: 240 }, (_, i) => curve.getPointAt(i / 239));
  function drawMini(pos, ang) {
    mg.clearRect(0, 0, MS, MS);
    mg.fillStyle = '#efe6d2'; mg.fillRect(0, 0, MS, MS);
    mg.beginPath(); plan.outline.forEach((q, i) => i ? mg.lineTo(mx(q.x), my(-q.y)) : mg.moveTo(mx(q.x), my(-q.y))); mg.closePath();
    mg.fillStyle = '#fbf9f3'; mg.fill(); mg.strokeStyle = '#8a8272'; mg.lineWidth = 1.5; mg.stroke();
    mg.fillStyle = '#55534f'; mg.fillRect(mx(-plan.iH), my(-plan.iH), plan.iH * 2 * SC, plan.iH * 2 * SC);
    mg.fillStyle = '#b8522f'; plan.wings.forEach(w => mg.fillRect(mx(w.x0), my(w.z0), (w.x1 - w.x0) * SC, (w.z1 - w.z0) * SC));
    mg.setLineDash([3, 3]); mg.strokeStyle = '#e8541e'; mg.lineWidth = 1.5; mg.beginPath();
    samples.forEach((q, i) => i ? mg.lineTo(mx(q.x), my(q.z)) : mg.moveTo(mx(q.x), my(q.z))); mg.stroke(); mg.setLineDash([]);
    ROOMS.forEach((r, i) => {
      const q = curve.getPointAt(r.p); mg.fillStyle = '#1b1a17'; mg.beginPath(); mg.arc(mx(q.x), my(q.z), 7, 0, 7); mg.fill();
      mg.fillStyle = '#fff'; mg.font = '600 9px Inter,sans-serif'; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText(i + 1, mx(q.x), my(q.z) + 0.5);
    });
    const a = ang * Math.PI / 180, X = mx(pos.x), Y = my(pos.z);
    mg.fillStyle = 'rgba(232,84,30,.35)'; mg.beginPath(); mg.moveTo(X, Y); mg.arc(X, Y, 30, a - 0.6, a + 0.6); mg.closePath(); mg.fill();
    mg.fillStyle = '#e8541e'; mg.strokeStyle = '#fff'; mg.lineWidth = 2; mg.beginPath(); mg.arc(X, Y, 5, 0, 7); mg.fill(); mg.stroke();
  }
  mm.addEventListener('pointerdown', e => {          // clicar no minimapa = ir até o ponto mais próximo do percurso
    const r = mm.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width * MS - CX) / SC, z = ((e.clientY - r.top) / r.height * MS - CY) / SC;
    let best = 0, bd = 1e9; samples.forEach((q, i) => { const d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < bd) { bd = d; best = i; } });
    setP(best / 239); auto = false; walk = 0; e.stopPropagation(); hideHint();
  });

  // ---- layout / visibilidade ----
  function resize() {
    const w = box.clientWidth, h = box.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); document.addEventListener('fullscreenchange', () => setTimeout(resize, 50)); resize();
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (!visible && video) video.pause(); }).observe(box);

  // ---- loop ----
  let prev = performance.now();
  (function loop() {
    requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min((now - prev) / 1000, 0.05); prev = now;
    if (!visible) return;

    const dir = walk || (auto ? 1 : 0);
    if (mode === 'sim') {
      if (dir) { p = Math.min(Math.max(p + dir * dt * SIM_SPEED / pathLen, 0), 1); phase += dt * 9; }
      if (auto && p >= 1) auto = false;
    } else if (mode === 'video' && video && video.duration) {
      if (dir > 0) { if (video.paused) video.play().catch(() => {}); }
      else { if (!video.paused) video.pause(); if (dir < 0) video.currentTime = Math.max(0, video.currentTime - dt); }
      p = video.currentTime / video.duration;
      if (auto && video.ended) auto = false;
      if (dir) phase += dt * 9;
    }
    playBtn.textContent = auto ? '❚❚' : '▶';
    if (document.activeElement !== seek) seek.value = p * 1000;

    // olhar volta suavemente para a frente enquanto anda
    if (dir && !drag && !gyro) { idleLook += dt; if (idleLook > 1.2) lon -= lon * Math.min(dt * 1.2, 1); }
    const pos = curve.getPointAt(p), tl = tangentLon(p);
    head += norm(tl - head) * Math.min(dt * 4, 1);

    if (mode === 'sim') {
      const bob = dir ? Math.sin(phase) * 0.012 : 0;
      camera.position.set(pos.x, 0.42 + bob, pos.z);
      const a = THREE.MathUtils.degToRad(head + lon), el = THREE.MathUtils.degToRad(-lat);
      camera.lookAt(camera.position.x + Math.cos(a) * Math.cos(el), camera.position.y + Math.sin(el), camera.position.z + Math.sin(a) * Math.cos(el));
      fortRoot.userData.flag.rotation.y = Math.sin(now / 350) * 0.35;
      renderer.render(sScene, camera);
    } else {
      camera.position.set(0, 0, 0);
      const phi = THREE.MathUtils.degToRad(90 - lat), th = THREE.MathUtils.degToRad(lon);
      camera.lookAt(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
      renderer.render(vScene, camera);
    }

    drawMini(pos, (mode === 'sim' ? head : tl) + lon);

    // legenda do ponto de interesse mais próximo
    let near = null; ROOMS.forEach((r, i) => { if (Math.abs(p - r.p) < 0.04) near = i; });
    if (near === null) caption.classList.remove('show');
    else { caption.innerHTML = `<b>${near + 1}. ${ROOMS[near].name}</b><span>${ROOMS[near].text}</span>`; caption.classList.add('show'); }
  })();
})();
