// buddy.js: a small 3D bear that walks around the page and shows visitors
// around (after klemenkotar.github.io's robot; own code). It lives on the
// page itself: it path-finds through the margins and the gaps between
// blocks so it never stands on text, walks over to whatever you hover
// (a section, a paper, a menu item) and says a line about it, follows you
// when you scroll, looks at the cursor, waves when clicked and dozes off
// when left alone. On narrow screens it sits in a corner instead.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

if (!window.__buddy) {
  window.__buddy = true;
  start();
}

function start() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fixedMode = () => matchMedia('(hover: none)').matches || innerWidth < 980;
  const CW = 180, CH = 230;                          // canvas size, css px: room above for hops

  // ------------------------------------------------------------ lines
  const SECTION = {
    news: 'Latest news!',
    experience: 'Where Sohyun has worked and visited.',
    education: 'Where Sohyun studied.',
    publications: 'Papers! Hover a figure: it moves.',
    services: 'Reviewing and service.',
    honors: 'Awards and honors ✨',
  };
  const NAV = { about: 'Back to the start.', publications: 'All the papers, by year.', gallery: 'Photos!', blog: 'Blog posts.', 'curriculum vitae': 'The CV.' };
  // one line per paper, short enough to fit the bubble
  const PAPER = {
    lee2026selfcompensatingvla: 'Robots slip up. This one notices and fixes it mid-task!',
    lee2025dicotta: 'Keeps adapting while test conditions keep changing.',
    yoon2026metalens: 'A flat lens that sees past what is in the way.',
    lee2026moga: 'Segmenting objects in video, even in rough conditions.',
    lee2025garasam: 'Segment Anything, made ready for rain, fog and noise ☔',
    lee2024frest: 'Restoring features so segmentation works in any weather.',
    sehyun2023active: 'Smarter labeling: ask about several classes at once.',
    lee2023pid: 'Finding human poses in near-total darkness 🌙',
    sehyun2022combating: 'Adapting to a new domain when class frequencies shift.',
    lee2022fifo: 'Seeing through fog by treating fog as a style 🌫️',
    kang2022style: 'Always hunting for new styles to generalize better.',
  };
  function lineFor(spot, el) {
    if (spot.matches('.publications ol.bibliography > li')) {
      const key = (spot.querySelector('[id]') || {}).id;
      const venue = ((spot.querySelector('.abbr abbr') || {}).textContent || '').trim();
      return PAPER[key] || (venue ? `A ${venue} paper!` : null);
    }
    if (spot.matches('#navbar .nav-link')) return NAV[spot.textContent.trim().toLowerCase()] || null;
    if (spot.matches('h2[id]')) return SECTION[spot.id] || null;
    return null;
  }

  // ------------------------------------------------------------ the bear
  const C = { fur: 0x9c6b45, light: 0xe6cba5, dark: 0x2b201b, paw: 0x6e4f3a, ear: 0xd99a86, pink: 0xf2a2a0 };
  const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
  const M = { fur: mat(C.fur), light: mat(C.light), dark: mat(C.dark, 0.35), paw: mat(C.paw), ear: mat(C.ear), pink: mat(C.pink), shine: mat(0xffffff, 0.2),
    coat: mat(0xf3c331, 0.42), trim: mat(0xdca91c, 0.5), boot: mat(0x2f4a6d, 0.4), cloud: mat(0xeef1f5, 0.9),
    drop: new THREE.MeshStandardMaterial({ color: 0x6fa8e0, roughness: 0.2, transparent: true, opacity: 0.85 }) };
  M.coat.side = THREE.DoubleSide;
  const COAT = M.coat.color.clone();
  const sphere = (r, m, s = [1, 1, 1], p = [0, 0, 0]) => {
    const o = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), m);
    o.scale.set(...s); o.position.set(...p); return o;
  };
  const capsule = (r, l, m, p = [0, 0, 0]) => {
    const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 8, 16), m);
    o.position.set(...p); return o;
  };
  function makeBear() {
    const root = new THREE.Group(), P = {};
    P.body = new THREE.Group(); root.add(P.body);
    P.body.add(sphere(1, M.fur, [0.95, 1, 0.9], [0, 1.08, 0]));
    P.body.add(sphere(0.86, M.fur, [1.08, 0.75, 0.95], [0, 0.78, 0.02]));   // pear-shaped bottom
    // the yellow raincoat: an A-line shell, a hem, a collar and buttons
    const prof = [[0.5, 2.02], [0.78, 1.9], [0.96, 1.66], [1.0, 1.3], [1.02, 1.0], [1.05, 0.7]].map(([r, y]) => new THREE.Vector2(r, y));
    const coat = new THREE.Mesh(new THREE.LatheGeometry(prof, 36), M.coat); coat.scale.z = 0.93; P.body.add(coat);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.05, 8, 40), M.trim); hem.rotation.x = Math.PI / 2; hem.position.y = 0.7; hem.scale.y = 0.93; P.body.add(hem);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.08, 8, 30), M.coat); collar.rotation.x = Math.PI / 2; collar.position.y = 2.0; P.body.add(collar);
    for (const [y, z] of [[1.6, 0.92], [1.3, 0.95], [1.0, 0.97]]) P.body.add(sphere(0.06, M.boot, [1, 1, 0.6], [0, y, z]));
    // legs with long feet
    for (const [k, s] of [['legL', -1], ['legR', 1]]) {
      P[k] = new THREE.Group(); P[k].position.set(s * 0.42, 0.55, 0.05);
      P[k].add(capsule(0.26, 0.25, M.boot, [0, -0.3, 0.05]));                      // rain boots
      P[k].add(sphere(0.24, M.boot, [1, 0.55, 1.5], [0, -0.5, 0.18]));
      root.add(P[k]);
    }
    // short arms, held in front
    for (const [k, s] of [['armL', -1], ['armR', 1]]) {
      P[k] = new THREE.Group(); P[k].position.set(s * 0.72, 1.5, 0.3);
      P[k].add(capsule(0.17, 0.36, M.coat, [0, -0.3, 0.08]));                      // sleeves
      P[k].add(sphere(0.13, M.paw, [1, 0.9, 1], [0, -0.55, 0.12]));
      P[k].rotation.z = s * 0.2;
      P.body.add(P[k]);
    }
    P.body.add(sphere(0.2, M.fur, [1, 1, 1], [0, 0.6, -0.95]));                    // stubby tail
    // head: round, with a pale muzzle, puffy cheeks and the famous smile
    P.head = new THREE.Group(); P.head.position.set(0, 2.25, 0.05); P.body.add(P.head);
    P.head.add(sphere(0.8, M.fur, [1.04, 0.94, 1]));
    P.head.add(sphere(0.36, M.light, [1.15, 0.8, 0.85], [0, -0.22, 0.62]));   // pale teddy muzzle
    // the hood: a shell around the back of the head, open at the face
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 20, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, 0, Math.PI * 0.78), M.coat);
    hood.position.set(0, 0.02, -0.06); P.head.add(hood);
    for (const s of [-1, 1]) {
      P.head.add(sphere(0.26, M.fur, [1, 1, 0.6], [s * 0.52, 0.76, -0.08]));          // round ears, poking out of the hood
      P.head.add(sphere(0.16, M.light, [1, 1, 0.4], [s * 0.52, 0.76, 0.03]));
      P.head.add(sphere(0.1, M.pink, [1, 0.7, 0.4], [s * 0.52, -0.2, 0.62]));         // blush
    }
    P.eyes = new THREE.Group(); P.head.add(P.eyes);
    for (const s of [-1, 1]) {
      const e = new THREE.Group(); e.position.set(s * 0.29, 0.13, 0.72);
      e.add(sphere(0.088, M.dark)); e.add(sphere(0.03, M.shine, [1, 1, 1], [0.03, 0.035, 0.07]));
      P.eyes.add(e);
    }
    P.head.add(sphere(0.1, M.dark, [1.35, 0.9, 0.9], [0, -0.12, 0.93]));                // nose
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.024, 8, 24, Math.PI), M.dark);
    smile.rotation.z = Math.PI; smile.rotation.x = -0.25; smile.position.set(0, -0.32, 0.88); P.head.add(smile);
    return { root, P };
  }

  // what the bear acts out on each paper, after its idea
  const ACT = {
    lee2026selfcompensatingvla: 'stumble',   // execution errors: trips, then catches itself
    lee2025dicotta: 'weathers',              // continual shifts: the weather keeps changing, it stays steady
    yoon2026metalens: 'peek',                // de-occluding: peeks around what is in the way
    lee2026moga: 'track',                    // video segmentation: keeps its eyes on the target (the cursor)
    lee2025garasam: 'rain',                  // robust SAM: rain, no problem
    lee2024frest: 'shake',                   // restoration: gets rained on, shakes it off
    sehyun2023active: 'ask',                 // active learning: hand up, asking
    lee2023pid: 'night',                     // low-light pose: lights down, strikes poses
    sehyun2022combating: 'balance',          // label shift: keeps its balance
    lee2022fifo: 'fog',                      // fog-invariant: fog rolls in, it looks around unbothered
    kang2022style: 'style',                  // novel styles: the coat keeps trying new colours
  };

  // ------------------------------------------------------------ dom
  const canvas = document.createElement('canvas');
  canvas.className = 'buddy';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A bear guide');
  const shadow = document.createElement('div'); shadow.className = 'buddy-shadow';
  const bubble = document.createElement('div'); bubble.className = 'buddy-bubble'; bubble.setAttribute('aria-live', 'polite');
  document.body.append(shadow, canvas, bubble);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
  catch (e) { canvas.remove(); shadow.remove(); bubble.remove(); return; }
  const dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(CW, CH, false);
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd9c8bd, 1.25); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-3, 6, 5); scene.add(sun);
  const EL = 0.42, D = 8.2, PX = 34;                 // elevation (rad), distance, px per unit
  const camera = new THREE.PerspectiveCamera(2 * Math.atan(CH / (2 * D * PX)) * 180 / Math.PI, CW / CH, 0.1, 100);
  camera.position.set(0, 2.3 + D * Math.sin(EL), D * Math.cos(EL));
  camera.lookAt(0, 2.3, 0);
  camera.updateMatrixWorld();
  const { root, P } = makeBear();
  scene.add(root);
  // weather props: a little cloud with rain or snow, and fog
  const cloud = new THREE.Group(); cloud.position.y = 4.05; scene.add(cloud);
  for (const [x, y, r] of [[-0.45, 0, 0.32], [0, 0.12, 0.42], [0.45, 0, 0.3], [0.2, -0.08, 0.3], [-0.2, -0.08, 0.3]]) cloud.add(sphere(r, M.cloud, [1, 0.8, 0.8], [x, y, 0]));
  const drops = Array.from({ length: 12 }, (_, i) => {
    const d = capsule(0.025, 0.16, M.drop, [(Math.random() - 0.5) * 1.6, 3.85 - (i / 12) * 3.6, (Math.random() - 0.3) * 1.0]);
    scene.add(d); return d;
  });
  const flakes = Array.from({ length: 14 }, (_, i) => {
    const f = sphere(0.05, M.cloud, [1, 1, 1], [(Math.random() - 0.5) * 1.6, 3.85 - (i / 14) * 3.6, (Math.random() - 0.3) * 1.0]);
    scene.add(f); return f;
  });
  const fogMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0, depthWrite: false });
  const fogs = [[-0.9, 0.7, 0.6], [0.9, 1.1, 0.4], [0.2, 0.4, 1.0], [-0.4, 1.6, 0.9]].map(([x, y, z]) => { const f = sphere(0.75, fogMat, [1.4, 0.7, 1], [x, y, z]); scene.add(f); return f; });
  const W = { rain: 0, snow: 0, fog: 0 };
  const box = new THREE.Box3(), corner = new THREE.Vector3();
  // the highest point of what is drawn, in canvas px from the top
  function topPx(objs) {
    let y = CH;
    for (const o of objs) {
      box.setFromObject(o);
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
        y = Math.min(y, (1 - corner.y) / 2 * CH);
      }
    }
    return y;
  }
  // where the feet land inside the canvas
  const foot = new THREE.Vector3(0, 0, 0).project(camera);
  const FX = (foot.x + 1) / 2 * CW, FY = (1 - foot.y) / 2 * CH;
  canvas.style.transformOrigin = `${FX}px ${FY}px`;
  const HEAD = (1 - new THREE.Vector3(0, 3.25, 0).project(camera).y) / 2 * CH;   // top of the ears

  // ------------------------------------------------------------ walking map
  // obstacles: the page's text and media blocks; free cells are where the
  // bear's feet can stand without its body covering any of them
  const CELL = 24, BODY_W = 38, BODY_H = Math.round(FY - HEAD) + 8;
  let grid = null, gridAt = 0;
  function buildGrid() {
    const de = document.documentElement, W = de.scrollWidth, Hh = de.scrollHeight;
    const cols = Math.ceil(W / CELL), rows = Math.ceil(Hh / CELL), blocked = new Uint8Array(cols * rows);
    const nav = document.getElementById('navbar'), navH = nav ? nav.offsetHeight : 0;
    const mark = (l, t, r, b) => {
      const c0 = Math.max(0, Math.floor(l / CELL)), c1 = Math.min(cols - 1, Math.floor(r / CELL));
      const r0 = Math.max(0, Math.floor(t / CELL)), r1 = Math.min(rows - 1, Math.floor(b / CELL));
      for (let y = r0; y <= r1; y++) blocked.fill(1, y * cols + c0, y * cols + c1 + 1);
    };
    mark(0, 0, W, navH + BODY_H);                      // under the fixed navbar
    const els = document.querySelectorAll('.container p, .container h1, .container h2, .container h3, .container li, .container img, .container canvas, .container table, .container blockquote, .container figure, .container .news, .container .social, .container .year-jumper, .container .hero-header, .container .btn');
    for (const el of els) {
      if (el.closest('.buddy')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      mark(r.left + scrollX - BODY_W, r.top + scrollY - 4, r.right + scrollX + BODY_W, r.bottom + scrollY + BODY_H);
    }
    mark(0, 0, BODY_W, Hh); mark(W - BODY_W, 0, W, Hh); mark(0, Hh - 60, W, Hh);
    grid = { cols, rows, blocked, W, H: Hh };
    gridAt = performance.now();
  }
  const free = (c, r) => grid && c >= 0 && r >= 0 && c < grid.cols && r < grid.rows && !grid.blocked[r * grid.cols + c];
  const cellOf = (p) => [Math.floor(p[0] / CELL), Math.floor(p[1] / CELL)];
  const centre = (c, r) => [c * CELL + CELL / 2, r * CELL + CELL / 2];
  function nearestFree(p, maxR = 18) {
    const [c0, r0] = cellOf(p);
    for (let d = 0; d <= maxR; d++)
      for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        if (free(c0 + dx, r0 + dy)) return [c0 + dx, r0 + dy];
      }
    return null;
  }
  function lineFree(a, b) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (CELL / 2));
    for (let i = 0; i <= n; i++) {
      const p = [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n], [c, r] = cellOf(p);
      if (!free(c, r)) return false;
    }
    return true;
  }
  // A* over the grid, then pull the path tight
  function findPath(from, to) {
    const s = nearestFree(from, 6), g = to;
    if (!s || !g) return null;
    const { cols } = grid, key = (c, r) => r * cols + c, gk = key(g[0], g[1]);
    const open = [[0, s[0], s[1]]], gs = new Map([[key(s[0], s[1]), 0]]), came = new Map();
    let n = 0;
    while (open.length && n++ < 40000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, c, r] = open.splice(bi, 1)[0], k = key(c, r);
      if (k === gk) {
        const pts = [centre(g[0], g[1])];
        let cur = k;
        while (came.has(cur)) { cur = came.get(cur); pts.push(centre(cur % cols, Math.floor(cur / cols))); }
        pts.reverse();
        const out = [pts[0]];
        let i = 0;
        while (i < pts.length - 1) {
          let j = pts.length - 1;
          while (j > i + 1 && !lineFree(pts[i], pts[j])) j--;
          out.push(pts[j]); i = j;
        }
        return out;
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nc = c + dx, nr = r + dy;
        if (!free(nc, nr) || (dx && dy && (!free(c + dx, r) || !free(c, r + dy)))) continue;
        const ng = gs.get(k) + (dx && dy ? 1.414 : 1), nk = key(nc, nr);
        if (ng < (gs.get(nk) ?? Infinity)) {
          gs.set(nk, ng); came.set(nk, k);
          const h = Math.hypot(nc - g[0], nr - g[1]);
          open.push([ng + h, nc, nr]);
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------ state
  const st = {
    pos: null, path: [], speed: 0, yaw: 0, yawT: 0, phase: 0,
    lastAct: performance.now(), sleeping: false, jumpT: -1, waveT: -1, blinkT: performance.now() + 2000,
    cursor: null, bubbleUntil: 0, said: '', hover: null, poof: 0, amp: 0, bubOff: 0,
    act: null, actT: 0, onFig: false, idle: null, idleT: 0, nextIdle: performance.now() + 5000, hy: 0, lastStep: 0, dir: [1, 0], nomAt: 0,
  };
  function say(text, ms = 3400) {
    if (!text) return;
    if (text !== st.said || !bubble.classList.contains('on')) { bubble.textContent = text; st.said = text; }
    bubble.classList.add('on'); st.bubbleUntil = performance.now() + ms;
  }
  function wake() {
    st.lastAct = performance.now();
    if (st.sleeping) { st.sleeping = false; st.bubbleUntil = 0; }
  }
  const pathLen = (pts, from) => pts.reduce((a, q, i) => a + Math.hypot(q[0] - (i ? pts[i - 1] : from)[0], q[1] - (i ? pts[i - 1] : from)[1]), 0);
  // walk to p (or to the first of several spots with a sensible route);
  // when every route is a long detour, pop over instead
  function goTo(...spots) {
    if (fixedMode()) return;
    if (!grid || performance.now() - gridAt > 2500) buildGrid();
    let first = null;
    for (const p of spots) {
      const g = nearestFree(p);
      if (!g) continue;
      first = first || g;
      if (!st.pos || reduce) break;
      const direct = Math.hypot(p[0] - st.pos[0], p[1] - st.pos[1]);
      if (direct > 1600) break;
      const path = findPath(st.pos, g);
      if (path && pathLen(path, st.pos) < 1.5 * direct + 240) { st.path = path.slice(1); return; }
    }
    if (!first) return;
    st.pos = centre(...first); st.path = []; st.poof = performance.now();
  }
  // stand beside an element, on the side nearer the cursor
  function besideOf(el) {
    const r = el.getBoundingClientRect(), y = r.top + scrollY + Math.min(r.height, 60) + BODY_H * 0.5;
    const L = [r.left + scrollX - BODY_W - 26, y], R = [r.right + scrollX + BODY_W + 26, y];
    const ref = st.cursor || st.pos;
    if (!ref) return [L, R];
    return Math.abs(L[0] - ref[0]) <= Math.abs(R[0] - ref[0]) ? [L, R] : [R, L];
  }

  // ------------------------------------------------------------ input
  let followTimer = 0;
  document.addEventListener('pointermove', (e) => {
    st.cursor = [e.clientX + scrollX, e.clientY + scrollY];
    wake();
    if (fixedMode()) return;
    const el = e.target instanceof Element ? e.target : null;
    st.onFig = !!(el && el.closest('.pub-fig'));
    const spot = el && (el.closest('.publications ol.bibliography > li') || el.closest('#navbar .nav-link') || el.closest('h2[id]'));
    if (spot && spot !== st.hover) {
      st.hover = spot;
      const key = (spot.querySelector('[id]') || {}).id;
      if (ACT[key] !== st.act) { st.act = ACT[key] || null; st.actT = 0; }
      if (!spot.closest('#navbar')) goTo(...besideOf(spot));
      say(lineFor(spot, el), 3800);
    } else if (!spot) {
      st.hover = null; st.act = null;
      // otherwise it follows the honey pot (the cursor), as near as it can stand
      clearTimeout(followTimer);
      followTimer = setTimeout(() => {
        if (!st.pos || st.hover) return;
        if (Math.hypot(st.cursor[0] - st.pos[0], st.cursor[1] - st.pos[1]) > 110) goTo([st.cursor[0], st.cursor[1] + 40]);
      }, 260);
    }
  }, { passive: true });
  let scrollTimer = 0;
  addEventListener('scroll', () => {
    wake();
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (fixedMode() || !st.pos) return;
      const vy0 = scrollY + 90, vy1 = scrollY + innerHeight - 60;
      if (st.pos[1] < vy0 || st.pos[1] > vy1) goTo([st.pos[0], scrollY + innerHeight * 0.62]);
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) say('You made it to the end, thanks for visiting!', 3000);
    }, 260);
  }, { passive: true });
  addEventListener('resize', () => { grid = null; });
  // the canvas lets clicks through (it is mostly empty), so hit-test the body itself
  document.addEventListener('pointerdown', (e) => {
    if (!st.at) return;
    const [x, y] = st.at.fixed ? [e.clientX, e.clientY] : [e.pageX, e.pageY], [fx, fy, k] = st.at.foot;
    if (Math.abs(x - fx) > 42 * k || y > fy + 4 || y < fy - (FY - HEAD) * k) return;
    wake(); st.jumpT = performance.now(); st.waveT = performance.now();
    say(['Hi! ♥', 'Thanks for visiting!', '♥ ♥', 'Hehe, that tickles.'][Math.floor(Math.random() * 4)], 2000);
  });
  if (matchMedia('(hover: none)').matches) {
    const seen = new Set();
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting && !seen.has(en.target.id)) { seen.add(en.target.id); wake(); say(SECTION[en.target.id], 2600); }
    }), { threshold: 1 });
    document.querySelectorAll('h2[id]').forEach((h) => SECTION[h.id] && io.observe(h));
  }

  // first appearance: beside the top of the content
  setTimeout(() => {
    if (!fixedMode()) {
      buildGrid();
      const box = document.querySelector('.container .post') || document.querySelector('.container');
      const r = box.getBoundingClientRect();
      const g = nearestFree([r.left + scrollX - 60, scrollY + innerHeight * 0.55]);
      if (g) { st.pos = centre(...g); st.poof = performance.now(); }
    }
    say(fixedMode() ? 'Hi! Tap me ✨' : "Hi! I'm Sohyun's bear 🧸 I follow the honey. Hover a paper and I'll act it out!", 5000);
  }, 700);

  // ------------------------------------------------------------ footprints
  // a pair of little prints at each landing, fading on their own
  const prints = [];
  function step(now, moving) {
    const n = Math.floor(st.phase / Math.PI);
    if (n === st.lastStep) return;
    st.lastStep = n;
    if (!moving || st.amp < 0.6) return;
    const [dx, dy] = st.dir, ang = Math.atan2(dy, dx) * 180 / Math.PI;
    for (const s of [-1, 1]) {
      const el = document.createElement('div');
      el.className = 'buddy-print';
      el.style.transform = `translate(${st.pos[0] - dy * s * 8}px, ${st.pos[1] + dx * s * 8}px) rotate(${ang}deg)`;
      el.addEventListener('animationend', () => el.remove());
      document.body.appendChild(el); prints.push(el);
    }
    while (prints.length > 60) prints.shift().remove();
  }

  // ------------------------------------------------------------ animate
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    const fixed = fixedMode();

    // follow the path
    let moving = false;
    if (!fixed && st.pos && st.path.length) {
      const tgt = st.path[0], dx = tgt[0] - st.pos[0], dy = tgt[1] - st.pos[1], d = Math.hypot(dx, dy);
      let left = d;
      for (let i = 1; i < st.path.length; i++) left += Math.hypot(st.path[i][0] - st.path[i - 1][0], st.path[i][1] - st.path[i - 1][1]);
      st.speed = Math.min(Math.max(240, Math.min(700, left / 1.4)), st.speed + 900 * dt);
      const step = st.speed * dt;
      if (d <= step) { st.pos = tgt.slice(); st.path.shift(); if (!st.path.length) st.speed = 0; }
      else { st.pos = [st.pos[0] + dx / d * step, st.pos[1] + dy / d * step]; }
      if (d > 1) { st.yawT = Math.atan2(dx, dy); st.dir = [dx / d, dy / d]; }
      moving = true;
    } else {
      // at rest: turn to face the visitor, glancing toward the cursor
      st.yawT = -0.35;                               // a three-quarter view shows off the snout
      if (st.cursor && st.pos && !fixed) st.yawT = Math.max(-0.6, Math.min(0.6, (st.cursor[0] - st.pos[0]) / 400)) || -0.35;
    }
    // little things it does on its own while standing: look around, tilt
    // its head, hop, wiggle, wave, spin, or wander off a bit
    if (!moving && !st.sleeping && !st.act && !st.idle && now > st.nextIdle) {
      const opts = fixed ? ['look', 'tilt', 'hop', 'wiggle', 'wave'] : ['wander', 'wander', 'look', 'tilt', 'hop', 'wiggle', 'wave', 'spin'];
      st.idle = opts[Math.floor(Math.random() * opts.length)]; st.idleT = 0;
      st.nextIdle = now + 3000 + Math.random() * 3500;
      if (st.idle === 'wave') { st.waveT = now; st.idle = null; }
      else if (st.idle === 'spin') { st.jumpT = now; st.idle = null; }
      else if (st.idle === 'wander') {
        st.idle = null;
        const vw = document.documentElement.clientWidth;
        const p = [st.pos[0] + (Math.random() - 0.5) * 700, st.pos[1] + (Math.random() - 0.5) * 300];
        p[0] = Math.max(scrollX + 40, Math.min(scrollX + vw - 40, p[0]));
        p[1] = Math.max(scrollY + 130, Math.min(scrollY + innerHeight - 50, p[1]));
        goTo(p);
      }
    }
    if (moving) { st.nextIdle = Math.max(st.nextIdle, now + 2500); if (st.idle !== 'munch') st.idle = null; }
    // reached the honey: a nibble
    if (!fixed && !moving && st.cursor && st.pos && !st.act && !st.idle && now - st.nomAt > 7000
      && Math.hypot(st.cursor[0] - st.pos[0], st.cursor[1] - st.pos[1] + 50) < 90) {
      st.idle = 'munch'; st.idleT = 0; st.nomAt = now; say('Nom nom 🍯', 1500);
    }
    if (st.idle) st.idleT += dt;
    if (st.act) st.actT += dt;
    let dyaw = st.yawT - st.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    st.yaw += dyaw * Math.min(1, dt * 9);

    // pose
    if (!st.sleeping && now - st.lastAct > 45000) { st.sleeping = true; say('Zzz…', 1e9); }
    // it hops: both feet together, tucked in the air, a squash on landing
    st.amp += ((moving ? 1 : 0) - st.amp) * Math.min(1, dt * 10);
    st.phase += dt * (7 + st.speed / 110);
    const h = Math.abs(Math.sin(st.phase));
    let lift = st.amp * h * 0.26 + (1 - st.amp) * Math.sin(now / 700) * 0.02, air = st.amp * h;
    let squash = st.amp * Math.max(0, 0.3 - h) * 0.5;
    if (st.jumpT > 0) {
      const j = (now - st.jumpT) / 650;
      if (j < 1) {
        if (j < 0.12) squash += (0.12 - j) * 1.2;                                // crouch, then spring
        else { const a = Math.sin((j - 0.12) / 0.88 * Math.PI); lift += a * 0.75; air = Math.max(air, a); }
        root.rotation.y = st.yaw + (j > 0.12 ? (j - 0.12) / 0.88 * Math.PI * 2 : 0);  // a little spin
      } else st.jumpT = -1;
    }
    P.legL.rotation.x = P.legR.rotation.x = -air * 0.8;
    P.armL.rotation.x = P.armR.rotation.x = -air * 0.9;
    if (st.waveT > 0) { const w = (now - st.waveT) / 1200; if (w < 1) { P.armR.rotation.z = 0.25 + 2.3 * Math.sin(Math.min(1, w * 3) * Math.PI / 2); P.armR.rotation.x = Math.sin(w * 18) * 0.3; } else { st.waveT = -1; P.armR.rotation.z = 0.25; } }
    root.position.y = lift;
    root.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
    P.body.rotation.x = st.amp * 0.18;                                          // lean into the hop
    if (st.jumpT < 0) root.rotation.y = st.yaw;
    // reset the free channels, then let the idle or the paper's act pose it
    P.body.rotation.z = 0; P.head.rotation.z = 0;
    P.legL.rotation.z = P.legR.rotation.z = 0;
    P.armL.rotation.z = -0.2; if (st.waveT < 0) P.armR.rotation.z = 0.2;
    let hyT = 0, hx = 0, light = 1, wx = { rain: st.onFig && !st.act ? 1 : 0, snow: 0, fog: 0 };
    const still = 1 - st.amp, T = st.idleT, A = st.actT;
    switch (st.idle) {
      case 'look': hyT = T < 1 ? -0.8 : T < 2 ? 0.8 : 0; if (T > 2.8) st.idle = null; break;
      case 'tilt': P.head.rotation.z = Math.sin(Math.min(T * 2, Math.PI)) * 0.25; if (T > 1.6) st.idle = null; break;
      case 'hop': root.position.y += Math.abs(Math.sin(T * Math.PI * 2.5)) * 0.25 * still; if (T > 0.8) st.idle = null; break;
      case 'wiggle': P.body.rotation.z = Math.sin(T * 18) * 0.12 * Math.max(0, 1 - T / 1.2); if (T > 1.2) st.idle = null; break;
      case 'munch': P.armL.rotation.x = P.armR.rotation.x = -1.3; hx = Math.sin(T * 22) * 0.12; if (T > 1.3) st.idle = null; break;
    }
    switch (st.act) {
      case 'stumble': {                                            // trip, wobble, recover
        const c = A % 2.6, tip = c < 0.25 ? 0.6 * c / 0.25 : 0.6 * Math.exp(-3.5 * (c - 0.25)) * Math.cos(8 * (c - 0.25));
        P.body.rotation.z = tip * still;
        const fl = Math.min(1, Math.abs(tip) * 2) * still;
        P.armL.rotation.z = -0.2 - 1.6 * fl; P.armR.rotation.z = 0.2 + 1.6 * fl;
        P.legR.rotation.z = 0.35 * fl;
        break;
      }
      case 'weathers': { const w = ['rain', 'snow', 'fog'][Math.floor(A / 1.6) % 3]; wx[w] = 1; break; }
      case 'peek': { const p = Math.sin(A * 1.7); P.body.rotation.z = 0.3 * p * still; hyT = 0.7 * p; break; }
      case 'track':
        if (st.cursor && st.pos) {
          hyT = Math.max(-1, Math.min(1, (st.cursor[0] - st.pos[0]) / 220)) - root.rotation.y;
          hx = Math.max(-0.5, Math.min(0.4, (st.cursor[1] - st.pos[1] + 80) / 300));
        }
        break;
      case 'rain': wx.rain = 1; break;
      case 'shake': {                                              // rained on, then a wet-dog shake
        const c = A % 3;
        if (c < 1.5) wx.rain = 1;
        else if (c < 2.2) root.rotation.y += Math.sin(c * 45) * 0.45 * (2.2 - c) / 0.7 * still;
        break;
      }
      case 'ask': P.armR.rotation.z = 0.2 + 2.5 * still; P.armR.rotation.x = Math.sin(A * 7) * 0.25; P.head.rotation.z = 0.15 * still; break;
      case 'night': {                                              // lights down, strike a pose
        light = 0.35;
        const k2 = Math.floor(A / 0.9) % 3;
        const L = [[-2.6, 2.6, 0], [-1.5, 1.5, 0.4], [-2.6, 0.5, -0.4]][k2];
        P.armL.rotation.z = -0.2 + (L[0] + 0.2) * still; P.armR.rotation.z = 0.2 + (L[1] - 0.2) * still; P.legR.rotation.z = L[2] * still;
        break;
      }
      case 'balance': {                                            // arms out, on one foot, swaying
        P.armL.rotation.z = -0.2 - 1.3 * still; P.armR.rotation.z = 0.2 + 1.3 * still;
        P.body.rotation.z = Math.sin(A * 2.4) * 0.16 * still; P.legL.rotation.z = -0.55 * still; P.legL.rotation.x = -0.4 * still;
        break;
      }
      case 'fog': wx.fog = 1; hyT = Math.sin(A * 1.3) * 0.6; break;
    }
    // the coat tries new colours for the style paper, and settles back otherwise
    if (st.act === 'style') M.coat.color.setHSL((0.13 + A * 0.18) % 1, 0.7, 0.56);
    else M.coat.color.lerp(COAT, Math.min(1, dt * 4));
    hemi.intensity += ((1.25 * light) - hemi.intensity) * Math.min(1, dt * 5);
    sun.intensity += ((1.4 * light) - sun.intensity) * Math.min(1, dt * 5);
    st.hy += (hyT - st.hy) * Math.min(1, dt * 7);
    P.head.rotation.y = st.hy;
    P.head.rotation.x = st.sleeping ? 0.35 : (moving ? 0.05 : -0.05 - W.rain * 0.3 - W.snow * 0.3) + hx;
    // weather: the cloud puffs in for rain and snow, fog drifts round its feet
    for (const w in W) W[w] += ((st.sleeping || fixed ? 0 : wx[w]) - W[w]) * Math.min(1, dt * 6);
    const cl = Math.max(W.rain, W.snow);
    cloud.visible = cl > 0.02; cloud.scale.setScalar(Math.max(0.001, cl));
    cloud.position.x = Math.sin(now / 900) * 0.08;
    for (const d of drops) {
      d.visible = W.rain > 0.5;
      d.position.y -= dt * 7;
      if (d.position.y < 0.15) { d.position.y = 3.85; d.position.x = (Math.random() - 0.5) * 1.5; }
    }
    for (const f of flakes) {
      f.visible = W.snow > 0.5;
      f.position.y -= dt * 1.5; f.position.x += Math.sin(now / 300 + f.position.y * 3) * dt * 0.3;
      if (f.position.y < 0.1) { f.position.y = 3.85; f.position.x = (Math.random() - 0.5) * 1.5; }
    }
    fogMat.opacity = 0.5 * W.fog;
    fogs.forEach((f, i) => { f.visible = W.fog > 0.02; f.position.x += Math.sin(now / 1500 + i * 2) * dt * 0.25; });
    // blink, or keep the eyes shut while asleep
    let ey = 1;
    if (st.sleeping) ey = 0.12;
    else if (now > st.blinkT) { ey = 0.1; if (now > st.blinkT + 130) st.blinkT = now + 2400 + Math.random() * 2800; }
    P.eyes.children.forEach((e) => (e.scale.y = ey));
    renderer.render(scene, camera);
    const drawnTop = topPx(cloud.visible ? [root, cloud] : [root]);
    if (!fixed && st.pos) step(now, moving);

    // place it
    let left, top, pos;
    if (fixed) {
      const f = document.querySelector('footer.fixed-bottom'), fh = f ? f.getBoundingClientRect().height : 0;
      canvas.style.position = shadow.style.position = bubble.style.position = 'fixed';
      left = document.documentElement.clientWidth - CW - 4; top = innerHeight - fh - CH + (CH - FY) - 2;
      pos = [left + FX, top + FY];
    } else {
      canvas.style.position = shadow.style.position = bubble.style.position = 'absolute';
      if (!st.pos) { canvas.style.opacity = '0'; return; }
      pos = st.pos; left = pos[0] - FX; top = pos[1] - FY;
    }
    st.at = { fixed, foot: [pos[0], pos[1], fixed ? 0.72 : 1] };
    const pop = st.poof ? Math.min(1, (now - st.poof) / 260) : 1, k = fixed ? 0.72 : 1;
    canvas.style.opacity = String(pop);
    canvas.style.transform = `translate(${left}px, ${top}px) scale(${(0.6 + 0.4 * pop) * k})`;
    shadow.style.transform = `translate(${pos[0] - 32}px, ${pos[1] - 7}px) scale(${Math.max(0.35, 1 - lift * 0.4) * k})`;
    shadow.style.opacity = String(pop * 0.9);
    if (now > st.bubbleUntil) bubble.classList.remove('on');
    const bw = bubble.offsetWidth || 160, vw = document.documentElement.clientWidth;
    const bxv = Math.min(vw - bw - 8, Math.max(8, (fixed ? pos[0] : pos[0] - scrollX) - bw / 2));
    // rises at once with a hop, settles back slowly so it does not bob
    const off = (FY - drawnTop) * k * (0.6 + 0.4 * pop);
    st.bubOff = Math.max(off, st.bubOff - dt * 90);
    bubble.style.transform = `translate(${bxv + (fixed ? 0 : scrollX)}px, ${pos[1] - st.bubOff - 12 - bubble.offsetHeight}px)`;
    bubble.style.setProperty('--tail', `${Math.min(bw - 14, Math.max(14, (fixed ? pos[0] : pos[0] - scrollX) - bxv))}px`);
  }
  requestAnimationFrame(frame);
}
