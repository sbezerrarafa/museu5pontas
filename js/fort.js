/* Modelo 3D do Forte das Cinco Pontas (Forte de São Tiago)
   Baseado em fotos aéreas: planta quadrada com 4 baluartes, muralhas caiadas de branco
   com parapeito de ameias, pátio de pedra escura, duas alas com telhado de barro
   (portas e janelas marrons), mastro com bandeira, gramado e palmeiras.
   Unidades: ~1 unidade = 5 m (esquemático, não é levantamento topográfico). */
window.LOWPOWER = matchMedia('(pointer:coarse)').matches || innerWidth < 860;   // celular/tablet: menos pixels e sombras
window.buildFort = function () {
  const T = THREE;
  const root = new T.Group();

  // ---- paleta (cores da foto aérea) ----
  const C = {
    grass: 0x6b9a3a, plateSide: 0x6b5a3e,
    white: 0xf4f1ea, wallTop: 0x9b978f, yard: 0x55534f,
    roof: 0xb8522f, door: 0x6b3a22, glass: 0x3b2f27,
    palmTrunk: 0x7a5a3a, palm: 0x2f7a2c, shrub: 0x3f8a35, path: 0xcdbf9f,
  };

  const H = 5, K = 2.3, F = 2.0, TIP = 2.1, S2 = Math.SQRT1_2, GATE = 0.55;

  function bastionLocal() {
    const c = H * Math.SQRT2;
    const bu = c - K * S2, bv = K * S2, su = bu + F * S2, sv = bv + F * S2;
    return [[bu, -bv], [su, -sv], [su + TIP, 0], [su, sv], [bu, bv]];
  }
  function outline(scale = 1) {
    const pts = [], loc = bastionLocal();
    for (let i = 0; i < 4; i++) {
      const th = Math.PI / 4 + i * Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
      loc.forEach(([u, v]) => pts.push(new T.Vector2((u * c - v * s) * scale, (u * s + v * c) * scale)));
    }
    return pts;
  }
  const outer = outline();
  const iH = H - 1.15;

  // contorno da muralha com abertura real do portão (cortina sul, entre os pontos 14 e 15)
  const V = (x, y) => new T.Vector2(x, y);
  const solid = outer.slice(0, 15).concat([
    V(-GATE, -H), V(-GATE, -iH), V(-iH, -iH), V(-iH, iH), V(iH, iH), V(iH, -iH), V(GATE, -iH), V(GATE, -H),
  ], outer.slice(15));
  const shape = new T.Shape(solid);

  // ---- texturas procedurais ----
  function tex(w, h, draw, rx, ry) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry);
    t.anisotropy = 4; return t;
  }
  const rnd = (a) => (Math.random() - 0.5) * a;
  const yardTex = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#4f4d49'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const v = 82 + rnd(26); g.fillStyle = `rgb(${v},${v - 1},${v - 4})`;
      g.fillRect(x * 32 + 1.5, y * 32 + 1.5, 29, 29);
    }
  }, 3, 3);
  const grassTex = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#6b9a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const l = 40 + Math.random() * 20; g.fillStyle = `hsl(${85 + rnd(26)},48%,${l}%)`;
      g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
  }, 9, 9);
  const roofTex = tex(128, 128, (g, w, h) => {
    g.fillStyle = '#b8522f'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < 16; x++) for (let y = 0; y < 8; y++) {
      g.fillStyle = `hsl(${14 + rnd(8)},58%,${40 + rnd(10)}%)`;
      g.fillRect(x * 8 + 0.8, y * 16 + 0.8, 6.6, 14.4);
    }
  }, 5, 2);
  const wallTex = tex(128, 128, (g, w, h) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${150 + rnd(30)},${140 + rnd(30)},${120},${0.05 + Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 8, 2); }
  }, 3, 1);

  const std = (color, o = {}) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.92, metalness: 0 }, o));
  const mk = (geo, color, o) => {
    const m = new T.Mesh(geo, Array.isArray(color) ? color : std(color, o));
    m.castShadow = true; m.receiveShadow = true; return m;
  };
  const edge = (mesh, color = 0x8a8272, op = 0.25) => {
    mesh.add(new T.LineSegments(new T.EdgesGeometry(mesh.geometry, 25), new T.LineBasicMaterial({ color, transparent: true, opacity: op })));
    return mesh;
  };
  const wallSide = () => std(0xffffff, { map: wallTex });

  // ---- base tipo "maquete": gramado ----
  const plate = mk(new T.CylinderGeometry(13, 13.4, 0.5, 72), [std(C.plateSide), std(0xffffff, { map: grassTex }), std(C.plateSide)]);
  plate.position.y = -0.25; plate.castShadow = false;
  root.add(plate);

  // ---- muralha: lateral branca, topo cinza (adarve) ----
  const wallGeo = new T.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false });
  wallGeo.rotateX(-Math.PI / 2);
  root.add(edge(mk(wallGeo, [std(C.wallTop), wallSide()]), 0x8a8272, 0.3));

  // ---- ameias no parapeito ----
  {
    const blocks = [];
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i], b = outer[(i + 1) % outer.length];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      const n = Math.max(1, Math.floor(len / 0.62));
      const nx = -dy / len, ny = dx / len;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, x = a.x + dx * t + nx * 0.17, y = a.y + dy * t + ny * 0.17;
        if (Math.abs(x) < GATE + 0.9 && y < -H + 0.6) continue;
        blocks.push([x, y, Math.atan2(dy, dx)]);
      }
    }
    const inst = new T.InstancedMesh(new T.BoxGeometry(0.36, 0.3, 0.2), std(C.white), blocks.length);
    inst.castShadow = true; inst.receiveShadow = true;
    const d = new T.Object3D();
    blocks.forEach(([x, y, ang], i) => { d.position.set(x, 1.65, -y); d.rotation.set(0, ang, 0); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); });
    root.add(inst);
  }

  // ---- pátio de pedra + mastro com bandeira ----
  const yard = mk(new T.PlaneGeometry(iH * 2, iH * 2), 0xffffff);
  yard.material.map = yardTex; yard.rotation.x = -Math.PI / 2; yard.position.y = 0.05; yard.castShadow = false;
  root.add(yard);
  const slab = mk(new T.BoxGeometry(GATE * 2, 0.05, H - iH + 0.2), C.yard); slab.position.set(0, 0.025, (H + iH) / 2); slab.castShadow = false; root.add(slab);
  const ring = mk(new T.CylinderGeometry(0.55, 0.6, 0.1, 24), 0x77746e); ring.position.set(0, 0.1, 0.3); root.add(ring);
  const pole = mk(new T.CylinderGeometry(0.025, 0.03, 3.0, 8), 0xdddddd); pole.position.set(0, 1.6, 0.3); root.add(pole);
  const flag = mk(new T.PlaneGeometry(0.7, 0.42), 0x1f4fae, { side: T.DoubleSide, roughness: 0.7 });
  flag.position.set(0.37, 2.85, 0.3); root.add(flag);
  root.userData.flag = flag;

  // ---- alas ----
  const roofGeo = new T.CylinderGeometry(1, 1, 1, 3); roofGeo.rotateX(-Math.PI / 2);
  function roofMesh(len, width, h, eave) {
    const m = new T.Mesh(roofGeo, std(0xffffff, { map: roofTex, roughness: 0.85 }));
    m.scale.set(width / 1.732, h / 1.5, len);
    m.position.y = eave + (0.5 * h) / 1.5; m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function wing(along, cx, cz, len, depth, faceSign) {
    const g = new T.Group(), BH = 1.0;
    const w = along === 'x' ? len : depth, d = along === 'x' ? depth : len;
    const body = edge(mk(new T.BoxGeometry(w, BH, d), 0xffffff, { map: wallTex }), 0x8a8272, 0.2); body.position.y = BH / 2; g.add(body);
    const roof = roofMesh(len + 0.2, depth + 0.35, 0.62, BH);
    if (along === 'x') roof.rotation.y = Math.PI / 2;
    g.add(roof);
    const n = Math.max(2, Math.floor(len / 0.85));
    for (let k = 0; k < n; k++) {
      const t = ((k + 0.5) / n - 0.5) * (len - 0.3), isDoor = k % 3 === 1;
      const bw = isDoor ? 0.28 : 0.2, bh = isDoor ? 0.58 : 0.32;
      const geo = along === 'x' ? new T.BoxGeometry(bw, bh, 0.03) : new T.BoxGeometry(0.03, bh, bw);
      const op = mk(geo, isDoor ? C.door : C.glass); op.castShadow = false;
      const off = depth / 2 + 0.012;
      op.position.set(along === 'x' ? t : faceSign * off, isDoor ? bh / 2 : 0.55, along === 'x' ? faceSign * off : t);
      g.add(op);
    }
    g.position.set(cx, 0.05, cz); root.add(g); return g;
  }
  const rw = iH - 0.6;
  wing('x', 0, -rw, iH * 2, 1.2, +1);   // ala norte, fachada para +z
  wing('z', rw, -0.2, 4.9, 1.2, -1);    // ala leste, fachada para -x

  // ---- portal de entrada (vazado: dá para passar) ----
  const gate = new T.Group();
  [-1, 1].forEach(s => { const p = edge(mk(new T.BoxGeometry(0.6, 1.9, 1.1), 0xffffff, { map: wallTex }), 0x8a8272, 0.3); p.position.set(s * (GATE + 0.3), 0.95, 0); gate.add(p); });
  const lintel = edge(mk(new T.BoxGeometry((GATE + 0.6) * 2, 0.4, 1.1), 0xffffff, { map: wallTex }), 0x8a8272, 0.3); lintel.position.y = 1.7; gate.add(lintel);
  const cornice = mk(new T.BoxGeometry((GATE + 0.6) * 2 + 0.2, 0.14, 1.3), C.white); cornice.position.y = 1.97; gate.add(cornice);
  const crest = mk(new T.BoxGeometry(0.7, 0.3, 0.5), C.white); crest.position.y = 2.19; gate.add(crest);
  gate.position.set(0, 0, H + 0.05); root.add(gate);
  const path = mk(new T.BoxGeometry(1.5, 0.03, 8), C.path); path.position.set(0, 0.02, H + 4.6); path.castShadow = false; root.add(path);

  // ---- palmeiras e arbustos ----
  function palm(x, z, h, lean) {
    const g = new T.Group();
    const trunk = mk(new T.CylinderGeometry(0.06, 0.1, h, 7), C.palmTrunk);
    trunk.rotation.z = lean; trunk.position.set(-Math.sin(lean) * h / 2, h / 2, 0); g.add(trunk);
    const top = new T.Group(); top.position.set(-Math.sin(lean) * h, h, 0);
    for (let i = 0; i < 9; i++) {
      const geo = new T.BoxGeometry(1.1, 0.025, 0.18); geo.translate(0.55, 0, 0);
      const leaf = mk(geo, C.palm); leaf.rotation.set(0, (i / 9) * Math.PI * 2, -0.45); leaf.castShadow = false; top.add(leaf);
    }
    g.add(top); g.position.set(x, 0, z); g.rotation.y = x * 3.7 + z; root.add(g);
  }
  [[-3.2, 9.2, 2.8], [3.0, 10.2, 2.4], [-7.6, 7.6, 2.6], [8.6, 7.4, 3.0], [11, -1, 2.7], [9.8, -6.6, 2.5],
   [-10.5, 2, 2.8], [-9.2, -6.6, 2.4], [6.4, -10.4, 2.9], [-4, -11, 2.6], [1, -11.8, 2.3], [11.2, 4, 2.4],
   [-10.8, 7.2, 2.5], [-6.2, 10.6, 2.2]].forEach(([x, z, h], i) => palm(x, z, h, 0.05 + (i % 5) * 0.02));
  [[-5, 9.8], [5.6, 9.4], [-9.4, -1.5], [9.9, 0.8], [-1.8, -10.2], [4.5, -11.2]].forEach(([x, z]) => {
    const s = mk(new T.SphereGeometry(0.5, 10, 8), C.shrub); s.scale.y = 0.7; s.position.set(x, 0.3, z); root.add(s);
  });

  // ---- dados para o minimapa e para a caminhada (coordenadas do mundo: x, z; norte = -z) ----
  root.userData.plan = {
    outline: solid.map(p => ({ x: p.x, y: p.y })), iH, H,
    wings: [{ x0: -iH, x1: iH, z0: -iH, z1: -iH + 1.2 }, { x0: rw - 0.6, x1: iH, z0: -2.65, z1: 2.25 }],
  };
  root.userData.walk = [[0, 12.5], [0, 9], [0, 5], [0, 2.6], [-0.4, 0.6], [-1.7, -0.9], [-0.2, -1.9], [1.3, -0.9], [1.6, 1.2], [0.6, 2.6], [-1.8, 2.4]];

  // ---- hotspots ----
  root.userData.spots = [
    { id: 'portao', name: 'Portal de entrada', pos: new T.Vector3(0, 2.6, H + 0.5), cam: [0, 5, 14], room: 0,
      text: 'A entrada do forte. Daqui começa a visita: o portal dá acesso ao pátio interno, de pedra.' },
    { id: 'patio', name: 'Pátio e mastro', pos: new T.Vector3(0, 3.3, 0.3), cam: [0, 10, 8], room: 0,
      text: 'O grande pátio de pedra, com o mastro da bandeira ao centro, onde acontecem feiras, festivais e atividades educativas, como o Meu Forte é Cultura.' },
    { id: 'leste', name: 'Ala leste · exposições', pos: new T.Vector3(rw, 2.0, -0.2), cam: [10, 7, 6], room: 1,
      text: 'Uma das duas alas de telhado de barro que ocupam o pátio. Abriga exposições de fotografia, cartografia e história urbana.' },
    { id: 'norte', name: 'Ala norte · acervo', pos: new T.Vector3(0, 2.0, -rw), cam: [0, 8, 10], room: 2,
      text: 'A ala dos fundos, junto à muralha, reúne salas de exposição e áreas de apoio ao acervo do museu.' },
    { id: 'baluarte', name: 'Baluarte', pos: new T.Vector3(6.4, 2.3, -6.4), cam: [14, 8, -12], room: 3,
      text: 'Os quatro baluartes em ponta de lança protegiam as cortinas com fogo cruzado. Do alto, as ameias brancas e a vista para a cidade.' },
    { id: 'muralha', name: 'Muralhas', pos: new T.Vector3(-H, 2.1, 0), cam: [-13, 7, 7], room: 3,
      text: 'Muralhas de pedra e cal caiadas de branco, com parapeito de ameias. A primeira versão holandesa (1630) era de madeira e terra, com cinco pontas e fosso.' },
  ];
  return root;
};
