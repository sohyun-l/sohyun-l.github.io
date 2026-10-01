// buddy.js: a small 3D panda that walks around the page and shows visitors
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
  const CW = 120, CH = 120;                          // canvas size, css px

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
  const shorten = (t, n) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);
  function lineFor(spot, el) {
    if (spot.matches('.publications ol.bibliography > li')) {
      if (el && el.closest('.pub-fig')) return 'Move around the figure: it follows you!';
      const title = (spot.querySelector('.title') || {}).textContent || '';
      const venue = ((spot.querySelector('.periodical b') || spot.querySelector('.abbr abbr') || {}).textContent || '').trim();
      return (venue ? venue + ': ' : '') + shorten(title.trim(), 58);
    }
    if (spot.matches('#navbar .nav-link')) return NAV[spot.textContent.trim().toLowerCase()] || null;
    if (spot.matches('h2[id]')) return SECTION[spot.id] || null;
    return null;
  }

  // ------------------------------------------------------------ the panda
  const C = { white: 0xf7f4ef, black: 0x2a2422, pink: 0xf2a7a7 };
  const mat = (c, r = 0.75) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
  const M = { white: mat(C.white), black: mat(C.black, 0.6), pink: mat(C.pink), eye: mat(0xffffff, 0.3), pupil: mat(0x111111, 0.2) };
  const sphere = (r, m, s = [1, 1, 1], p = [0, 0, 0]) => {
    const o = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), m);
    o.scale.set(...s); o.position.set(...p); return o;
  };
  const capsule = (r, l, m, p = [0, 0, 0]) => {
    const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 8, 16), m);
    o.position.set(...p); return o;
  };
  function makePanda() {
    const root = new THREE.Group(), P = {};
    P.body = new THREE.Group(); root.add(P.body);
    P.body.add(sphere(1, M.white, [1, 0.95, 0.88], [0, 1.05, 0]));
    // the black shoulder band and arms
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.93, 0.98, 0.42, 28, 1, true), M.black);
    band.position.set(0, 1.45, 0); band.scale.set(1, 1, 0.9); P.body.add(band);
    P.legL = new THREE.Group(); P.legL.position.set(-0.45, 0.62, 0.05);
    P.legR = new THREE.Group(); P.legR.position.set(0.45, 0.62, 0.05);
    P.legL.add(capsule(0.3, 0.3, M.black, [0, -0.35, 0.05])); P.legR.add(capsule(0.3, 0.3, M.black, [0, -0.35, 0.05]));
    root.add(P.legL, P.legR);
    P.armL = new THREE.Group(); P.armL.position.set(-0.86, 1.42, 0.1);
    P.armR = new THREE.Group(); P.armR.position.set(0.86, 1.42, 0.1);
    P.armL.add(capsule(0.23, 0.5, M.black, [0, -0.4, 0.1])); P.armR.add(capsule(0.23, 0.5, M.black, [0, -0.4, 0.1]));
    P.armL.rotation.z = -0.25; P.armR.rotation.z = 0.25;
    P.body.add(P.armL, P.armR);
    P.body.add(sphere(0.2, M.white, [1, 1, 1], [0, 0.85, -0.85]));        // tail
    // head
    P.head = new THREE.Group(); P.head.position.set(0, 2.25, 0.05); P.body.add(P.head);
    P.head.add(sphere(0.86, M.white, [1.1, 0.95, 1], [0, 0, 0]));
    for (const s of [-1, 1]) {
      P.head.add(sphere(0.3, M.black, [1, 1, 0.7], [s * 0.66, 0.62, -0.05]));            // ears
      const patch = sphere(0.24, M.black, [0.95, 1.3, 0.45], [s * 0.33, 0.06, 0.72]);   // eye patches
      patch.rotation.z = s * 0.55; P.head.add(patch);
      P.head.add(sphere(0.12, M.pink, [1, 0.7, 0.4], [s * 0.55, -0.22, 0.66]));           // blush
    }
    P.eyes = new THREE.Group(); P.head.add(P.eyes);
    for (const s of [-1, 1]) {
      const e = new THREE.Group(); e.position.set(s * 0.33, 0.1, 0.84);
      e.add(sphere(0.095, M.eye)); e.add(sphere(0.055, M.pupil, [1, 1, 1], [0, 0, 0.06]));
      P.eyes.add(e);
    }
    P.head.add(sphere(0.11, M.black, [1.3, 0.8, 0.8], [0, -0.14, 0.86]));               // nose
    return { root, P };
  }

  // ------------------------------------------------------------ dom
  const canvas = document.createElement('canvas');
  canvas.className = 'buddy';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A panda guide');
  const shadow = document.createElement('div'); shadow.className = 'buddy-shadow';
  const bubble = document.createElement('div'); bubble.className = 'panda-bubble buddy-bubble'; bubble.setAttribute('aria-live', 'polite');
  document.body.append(shadow, canvas, bubble);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
  catch (e) { canvas.remove(); shadow.remove(); bubble.remove(); return; }
  const dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(CW, CH, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c8bd, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-3, 6, 5); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, CW / CH, 0.1, 100);
  const EL = 0.42, D = 8.2;                          // elevation (rad), distance
  camera.position.set(0, 1.5 + D * Math.sin(EL), D * Math.cos(EL));
  camera.lookAt(0, 1.45, 0);
  camera.updateMatrixWorld();
  const { root, P } = makePanda();
  scene.add(root);
  // where the feet land inside the canvas
  const foot = new THREE.Vector3(0, 0, 0).project(camera);
  const FX = (foot.x + 1) / 2 * CW, FY = (1 - foot.y) / 2 * CH;
  canvas.style.transformOrigin = `${FX}px ${FY}px`;
  const HEAD = (1 - new THREE.Vector3(0, 3.25, 0).project(camera).y) / 2 * CH;   // top of the ears

  // ------------------------------------------------------------ walking map
  // obstacles: the page's text and media blocks; free cells are where the
  // panda's feet can stand without its body covering any of them
  const CELL = 24, BODY_W = 30, BODY_H = Math.round(FY - HEAD) + 8;
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
    cursor: null, bubbleUntil: 0, said: '', hover: null, poof: 0,
  };
  function say(text, ms = 3400) {
    if (!text) return;
    if (text !== st.said || !bubble.classList.contains('on')) { bubble.textContent = text; st.said = text; }
    bubble.classList.add('on'); st.bubbleUntil = performance.now() + ms;
  }
  function wake() { st.lastAct = performance.now(); st.sleeping = false; }
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
  document.addEventListener('pointermove', (e) => {
    st.cursor = [e.clientX + scrollX, e.clientY + scrollY];
    wake();
    if (fixedMode()) return;
    const el = e.target instanceof Element ? e.target : null;
    const spot = el && (el.closest('.publications ol.bibliography > li') || el.closest('#navbar .nav-link') || el.closest('h2[id]'));
    if (spot && spot !== st.hover) {
      st.hover = spot;
      if (!spot.closest('#navbar')) goTo(...besideOf(spot));
      say(lineFor(spot, el), 3800);
    } else if (!spot) st.hover = null;
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
  canvas.addEventListener('pointerdown', () => {
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
    say(fixedMode() ? 'Hi! Tap me 🐼' : "Hi! I'm Sohyun's panda. Hover anything and I'll walk you there.", 4500);
  }, 700);

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
      if (d > 1) st.yawT = Math.atan2(dx, dy);
      moving = true;
    } else {
      // at rest: turn to face the visitor, glancing toward the cursor
      st.yawT = 0;
      if (st.cursor && st.pos && !fixed) st.yawT = Math.max(-0.6, Math.min(0.6, (st.cursor[0] - st.pos[0]) / 400));
    }
    let dyaw = st.yawT - st.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    st.yaw += dyaw * Math.min(1, dt * 9);

    // pose
    if (!st.sleeping && now - st.lastAct > 45000) { st.sleeping = true; say('Zzz…', 1e9); }
    st.phase = moving ? st.phase + dt * 10 : st.phase * 0.85;
    const sw = moving ? Math.sin(st.phase) * 0.6 : 0;
    P.legL.rotation.x = sw; P.legR.rotation.x = -sw;
    P.armL.rotation.x = -sw * 0.7; P.armR.rotation.x = sw * 0.7;
    let lift = moving ? Math.abs(Math.sin(st.phase)) * 0.12 : Math.sin(now / 700) * 0.025;
    if (st.jumpT > 0) { const j = (now - st.jumpT) / 520; if (j < 1) lift += Math.sin(j * Math.PI) * 0.9; else st.jumpT = -1; }
    if (st.waveT > 0) { const w = (now - st.waveT) / 1200; if (w < 1) { P.armR.rotation.z = 0.25 + 2.3 * Math.sin(Math.min(1, w * 3) * Math.PI / 2); P.armR.rotation.x = Math.sin(w * 18) * 0.3; } else { st.waveT = -1; P.armR.rotation.z = 0.25; } }
    P.body.position.y = lift;
    P.body.rotation.z = moving ? Math.sin(st.phase) * 0.06 : 0;
    root.rotation.y = st.yaw;
    P.head.rotation.x = st.sleeping ? 0.35 : (moving ? 0.05 : -0.05);
    // blink, or keep the eyes shut while asleep
    let ey = 1;
    if (st.sleeping) ey = 0.12;
    else if (now > st.blinkT) { ey = 0.1; if (now > st.blinkT + 130) st.blinkT = now + 2400 + Math.random() * 2800; }
    P.eyes.children.forEach((e) => (e.scale.y = ey));
    renderer.render(scene, camera);

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
    const pop = st.poof ? Math.min(1, (now - st.poof) / 260) : 1, k = fixed ? 0.72 : 1;
    canvas.style.opacity = String(pop);
    canvas.style.transform = `translate(${left}px, ${top}px) scale(${(0.6 + 0.4 * pop) * k})`;
    shadow.style.transform = `translate(${pos[0] - 26}px, ${pos[1] - 6}px) scale(${(1 - lift * 0.4) * k})`;
    shadow.style.opacity = String(pop * 0.9);
    if (now > st.bubbleUntil) bubble.classList.remove('on');
    const bw = bubble.offsetWidth || 160, vw = document.documentElement.clientWidth;
    const bxv = Math.min(vw - bw - 8, Math.max(8, (fixed ? pos[0] : pos[0] - scrollX) - bw / 2));
    bubble.style.transform = `translate(${bxv + (fixed ? 0 : scrollX)}px, ${pos[1] - (FY - HEAD + lift * 30) * k - 12 - bubble.offsetHeight}px)`;
    bubble.style.setProperty('--tail', `${Math.min(bw - 14, Math.max(14, (fixed ? pos[0] : pos[0] - scrollX) - bxv))}px`);
  }
  requestAnimationFrame(frame);
}
