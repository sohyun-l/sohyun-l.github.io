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
  const compact = () => matchMedia('(hover: none)').matches || innerWidth < 980;   // phones: smaller, straight-line moves
  const fixedMode = () => false;
  const CW = 320, CH = 230;                          // canvas size, css px: room above for hops

  // ------------------------------------------------------------ lines
  const SECTION = {
    news: 'Fresh news! 📰',
    experience: 'Where Sohyun has worked and visited 🌍',
    education: 'Where Sohyun studied 🎓',
    publications: "Papers! Hover one and I'll act it out.",
    services: 'Reviewing and service ✅',
    honors: 'Awards and honors 🏆',
    visitors: 'Thanks for visiting!',
    about: "That's Sohyun! Welcome 👋",
  };
  const NAV = { about: 'Back to the start.', publications: 'All the papers, by year.', gallery: 'Photos!', blog: 'Blog posts.', 'curriculum vitae': 'The CV.' };
  // one line per paper, short enough to fit the bubble
  const PAPER = {
    lee2026selfcompensatingvla: "Robots don't move exactly as told. The VLA learns, on the job, to pre-compensate.",
    lee2025dicotta: 'Adapts to ever-changing test domains, and stays ready for the next one.',
    yoon2026metalens: 'A flat metalens that filters out nearby raindrops, fences and dust.',
    lee2026moga: 'Promptable video segmentation that stays robust, frame after frame.',
    lee2025garasam: 'A robust SAM: a gate picks how much adapter rank each input needs.',
    lee2024frest: 'No clean labels needed: restores features hurt by adverse conditions.',
    sehyun2023active: 'Asks which classes appear in a superpixel, then works out which pixel is which.',
    lee2023pid: 'Human poses in extremely low light, with a new real dataset 🌙',
    sehyun2022combating: 'Picks what to label so class proportions match across domains.',
    lee2022fifo: 'A fog-pass filter pulls out the fog, so features stop telling foggy from clear 🌫️',
    kang2022style: 'Keeps inventing novel styles in training, to generalize to new domains.',
  };
  // the section a hovered heading or block belongs to
  const BLOCKS = '.hero-header, .hero-bio, .news, .news-band, .experience, .education, .services, .honors, .mapmyvisitors-widget';
  function sectionOf(spot) {
    if (spot.matches('h2[id]')) return spot.id;
    if (spot.classList.contains('mapmyvisitors-widget')) return 'visitors';
    if (spot.classList.contains('hero-header') || spot.classList.contains('hero-bio')) return 'about';
    if (spot.classList.contains('news-band')) return 'news';
    return ['news', 'experience', 'education', 'services', 'honors'].find((c) => spot.classList.contains(c)) || null;
  }
  function lineFor(spot, el) {
    if (spot.matches('.publications ol.bibliography > li')) {
      const key = (spot.querySelector('[id]') || {}).id;
      const venue = ((spot.querySelector('.abbr abbr') || {}).textContent || '').trim();
      return PAPER[key] || (venue ? `A ${venue} paper!` : null);
    }
    if (spot.matches('#navbar .nav-link')) return NAV[spot.textContent.trim().toLowerCase()] || null;
    if (spot.matches('.gallery-item')) { const c = spot.querySelector('figcaption'); return c ? c.textContent.trim() + ' 📸' : '📸'; }
    return SECTION[sectionOf(spot)] || null;
  }

  // ------------------------------------------------------------ the bear
  const C = { fur: 0x9c6b45, light: 0xe6cba5, dark: 0x2b201b, paw: 0x6e4f3a, ear: 0xd99a86, pink: 0xf2a2a0 };
  const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
  const M = { fur: mat(C.fur), light: mat(C.light), dark: mat(C.dark, 0.35), paw: mat(C.paw), ear: mat(C.ear), pink: mat(C.pink), shine: mat(0xffffff, 0.2),
    eye: mat(0x2b201b, 0.35), coat: mat(0xf3c331, 0.42), trim: mat(0xdca91c, 0.5), boot: mat(0x2f4a6d, 0.4), cloud: mat(0xeef1f5, 0.9),
    drop: new THREE.MeshStandardMaterial({ color: 0x6fa8e0, roughness: 0.2, transparent: true, opacity: 0.85 }) };
  M.coat.side = THREE.DoubleSide;
  const METAL = new THREE.Color(0xcfd6de), METAL2 = new THREE.Color(0xeef1f4), METAL3 = new THREE.Color(0x7d8794), EARC = M.ear.color.clone(), EYEC = M.eye.color.clone(), PAWC = M.paw.color.clone();
  const _c = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color(), BOOTC = M.boot.color.clone(), TRIMC = M.trim.color.clone();
  const COAT = M.coat.color.clone(), FUR = M.fur.color.clone(), LIGHT = M.light.color.clone(), SNOW = new THREE.Color(0xf3f5f8), GREY = new THREE.Color(0x8d8a86);
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
    P.shell = [coat, hem, collar];
    for (const [y, z] of [[1.6, 0.92], [1.3, 0.95], [1.0, 0.97]]) { const b = sphere(0.06, M.boot, [1, 1, 0.6], [0, y, z]); P.body.add(b); P.shell.push(b); }
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
    P.tail = sphere(0.2, M.fur, [1, 1, 1], [0, 0.6, -0.95]); P.body.add(P.tail);   // stubby tail (it wags)
    // head: round, with a pale muzzle, puffy cheeks and the famous smile
    P.head = new THREE.Group(); P.head.position.set(0, 2.25, 0.05); P.body.add(P.head);
    P.head.add(sphere(0.8, M.fur, [1.04, 0.94, 1]));
    P.head.add(sphere(0.36, M.light, [1.15, 0.8, 0.85], [0, -0.22, 0.62]));   // pale teddy muzzle
    // the hood: a shell around the back of the head, open at the face
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 20, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, 0, Math.PI * 0.78), M.coat);
    hood.position.set(0, 0.02, -0.06); P.head.add(hood); P.hood = hood;
    P.ears = []; P.blush = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(s * 0.52, 0.76, -0.08); P.head.add(ear); P.ears.push(ear);   // round ears, poking out of the hood (they twitch)
      ear.add(sphere(0.26, M.fur, [1, 1, 0.6])); ear.add(sphere(0.16, M.light, [1, 1, 0.4], [0, 0, 0.11]));
      const b = sphere(0.1, M.pink, [1, 0.7, 0.4], [s * 0.52, -0.2, 0.62]); P.head.add(b); P.blush.push(b);   // blush
    }
    P.eyes = new THREE.Group(); P.head.add(P.eyes);
    for (const s of [-1, 1]) {
      const e = new THREE.Group(); e.position.set(s * 0.29, 0.13, 0.72);
      e.add(sphere(0.088, M.eye)); e.add(sphere(0.03, M.shine, [1, 1, 1], [0.03, 0.035, 0.07]));
      P.eyes.add(e);
    }
    P.head.add(sphere(0.1, M.dark, [1.35, 0.9, 0.9], [0, -0.12, 0.93]));                // nose
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.024, 8, 24, Math.PI), M.dark);
    smile.rotation.z = Math.PI; smile.rotation.x = -0.25; smile.position.set(0, -0.32, 0.88); P.head.add(smile); P.smile = smile;
    P.mouth = sphere(0.085, M.dark, [1, 1.25, 0.45], [0, -0.36, 0.86]); P.mouth.visible = false; P.head.add(P.mouth);   // open, for a yawn
    return { root, P };
  }

  // what the bear acts out on each paper, after its idea
  const ACT = {
    lee2026selfcompensatingvla: 'tame',      // execution errors: a jittery robot arm, calmed down
    lee2025dicotta: 'tta',                   // continual TTA: the same bear while the domain keeps changing; each time it is
                                             // puzzled for a moment, then adapts (gears up for it)
    yoon2026metalens: 'lens',                // metalens: drops and dust on the lens, still a clear view
    lee2026moga: 'film',                     // robust video segmentation: films steadily through video corruptions (motion blur,
                                             // noise, defocus, compression, low contrast), the seasons, and an unseen one
    lee2025garasam: 'conditions',            // robust SAM: rank components lit per input, even an unseen one
    lee2024frest: 'restore',                 // restoration: rain, snow, fog, dark, shaking each one off
    sehyun2023active: 'ask',                 // active learning: a superpixel is queried, every class in it ticked, then its pixels sorted out
    lee2023pid: 'night',                     // low-light pose: lights down, strikes poses
    sehyun2022combating: 'balance',          // label shift: target class proportions brought to match the source
    lee2022fifo: 'fifo',                     // fog-pass filter: the fog is pulled into a filter; foggy or clear, it can't tell
    kang2022style: 'style',                  // novel styles: an artist painting, the coat keeps trying new colours
    // and the page's sections
    'sec:news': 'news',                      // reads the paper
    'sec:experience': 'globe',               // spins a globe: places worked and visited
    'sec:education': 'grad',                 // mortarboard, tossed in the air
    'sec:publications': 'books',             // a stack of papers
    'sec:services': 'review',                // a clipboard, ticking boxes
    'sec:honors': 'trophy',                  // a trophy held high, confetti
    'sec:about': 'greet',                    // a friendly wave hello
    'sec:visitors': 'hearts',                // a finger heart, hearts floating out
    // gallery: a pose after each photo
    'gal:accv_wicv.jpg': 'speech', 'gal:cvpr22_workshop.jpg': 'speech', 'gal:cvpr22.jpg': 'speech',
    'gal:accv_wicv_2.jpg': 'cheese', 'gal:eccv24_2.jpg': 'cheese', 'gal:eccv22.jpg': 'cheese', 'gal:tubingen2.jpg': 'flagDE',
    'gal:cvpr23.jpg': 'point', 'gal:cvpr26.jpg': 'point', 'gal:eccv22_presentation.jpg': 'point', 'gal:eccv24.jpg': 'point',
    'gal:neurips23.jpg': 'point', 'gal:neurips25_3.jpg': 'point',
    'gal:cvpr26_dc.jpg': 'peace', 'gal:zurich.jpg': 'flagCH', 'gal:neurips25_2.jpg': 'selfie', 'gal:neurips25.jpg': 'tada',
    'gal:cvpr22_fifo.jpg': 'fifo', 'gal:graduation.jpg': 'grad', 'gal:dissertation_award.jpg': 'trophy',
    'gal:swiss.jpg': 'kickCH', 'gal:tubingen.jpg': 'flagDE',
  };

  // where each conference was, and what the bear wears or holds there
  const VENUE = { cvpr22: 'nola', neurips23: 'nola', cvpr23: 'vancouver', eccv22: 'telaviv', eccv24: 'milan', neurips25: 'sandiego', cvpr26: 'denver', accv: 'hanoi' };
  const VNAME = { nola: 'New Orleans 🎺', vancouver: 'Vancouver 🍁', telaviv: 'Tel Aviv 🏖️', milan: 'Milan 👜', sandiego: 'San Diego 🏄', denver: 'Denver, the Mile High City ⛷️', hanoi: 'Hanoi 🇻🇳' };
  // some cities take over the pose: jazz trumpet, the beach, the runway, surfing, skiing in the Rockies
  const VACT = { nola: 'trumpet', telaviv: 'sunbed', milan: 'runway', sandiego: 'surf', denver: 'ski' };
  const VACC = { vancouver: ['maple'], telaviv: ['shades'], milan: ['shades'], sandiego: ['shades'], denver: ['goggles'], hanoi: ['nonla'] };
  const HANDHELD = { maple: 'up' };
  // gallery outfits instead of the raincoat: coat colour (null = none, just fur), boots, a conference badge
  const OUTFIT = {
    conference: { coat: 0x2f3e5c, boots: 0x2b2b33, wear: ['shirt', 'tie', 'badge'] },          // a blazer, shirt and tie, a lanyard
    grad: { coat: 0x1d1d24, boots: 0x2b2b33, wear: ['stole'] },                              // a black gown with a crimson stole
    award: { coat: 0x1f1f26, boots: 0x2b2b33, wear: ['shirt', 'bowtie'] },                   // a black suit and a bow tie
    beach: { coat: null, boots: 'fur', wear: ['swim'] },                                     // a striped swimsuit
    surf: { coat: 0x16181d, boots: 0x16181d, wear: ['wet'] },                                // a wetsuit with stripes
    runway: { coat: 0xd64f8f, boots: 0x2b2b33, wear: ['pearls'] },                           // pink, and pearls
    ski: { coat: 0xe5484d, boots: 0x2b2b33, wear: ['beanie'] },                              // a ski jacket and a bobble hat
    jazz: { coat: 0x5b2a86, boots: 0x2b2b33, wear: ['shirt', 'bowtie', 'fedora'] },          // a purple suit, bow tie and fedora
    hike: { coat: 0x4f8a4b, boots: 0x7a5536, wear: ['backpack', 'bucket'] },                 // a hiking jacket, backpack, bucket hat
    visit: { coat: 0xb5835a, boots: 0x7a5536, wear: ['shirt'] },                             // a cardigan over a shirt
    aodai: { coat: 0xc8102e, boots: 0x2b2b33, wear: ['aodai'] },                             // an áo dài
    lab: { coat: 0xf4f4f1, boots: 0x2b2b33, wear: ['shirt', 'tie', 'glasses'] },             // a lab coat
    pajama: { coat: 0x7fa7d8, boots: 'fur', wear: ['nightcap'] },                            // pyjamas and a nightcap
    ringmaster: { coat: 0xc0392b, boots: 0x1a1a1f, wear: ['tophat', 'baton', 'shirt', 'bowtie'] },   // the tamer: a ringmaster
    robobear: { coat: null, boots: 0x8a929c, wear: ['antenna', 'panel'], robot: true },   // taming: it turns into a robot bear
    gara: { coat: 0x2b3442, boots: 0x2b3442, wear: [] },                                      // GaRA: a bodysuit; armour modules snap on per input
    mechanic: { coat: 0x3b5a8a, boots: 0x5a3d2a, wear: ['mcap', 'wrench'] },                           // restoration: a mechanic in overalls
    detective: { coat: 0xc8a874, boots: 0x5a3d2a, wear: ['deerstalker'] },                   // through the fog: a detective
    director: { coat: 0x1f1f26, boots: 0x1f1f26, wear: ['beret', 'clapper'] },                          // video: a film director
    artist: { coat: 0xd64f8f, boots: 0x2b2b33, wear: ['beret', 'palette', 'brush'] },
    mocap: { coat: 0x15161a, boots: 0x15161a, wear: ['mocapcap'] },                         // pose estimation: a motion-capture suit                            // new styles: an artist
    tta: { coat: 0x3b8bd6, boots: 0x2b2b33, wear: [] },                                      // TestDG: a coat that adapts its colour
    suit: { coat: 0x2f3e5c, boots: 0x2b2b33, wear: ['shirt', 'tie'] },                       // a blazer and tie
    casual: { coat: 0xb5835a, boots: 0x7a5536, wear: ['shirt', 'glasses'] },                 // a cardigan and glasses
    sohyun: { coat: 0x1d2747, boots: 0x2b2b33, wear: ['specs', 'logo'], plain: true },            // as in Sohyun's photo
  };
  // the about and publications pages: dressed for each section and paper (weather papers keep the raincoat)
  const SPOTOUTFIT = {
    'sec:about': 'suit', 'sec:education': 'grad', 'sec:honors': 'award', 'sec:services': 'suit', 'sec:experience': 'casual',
    'sec:publications': 'casual', 'sec:news': 'casual', 'sec:visitors': 'casual',
    yoon2026metalens: 'lab', sehyun2023active: 'lab', sehyun2022combating: 'lab',
    lee2023pid: 'pajama',
    lee2026selfcompensatingvla: 'robobear', lee2025garasam: 'gara', lee2024frest: 'mechanic',
    lee2022fifo: 'detective', lee2026moga: 'director', kang2022style: 'artist',
  };
  function outfitFor(file, act, venue) {
    if (venue === 'hanoi') return OUTFIT.aodai;
    const byAct = { grad: 'grad', trophy: 'award', sunbed: 'beach', surf: 'surf', runway: 'runway', ski: 'ski', trumpet: 'jazz', kickCH: 'hike', flagCH: 'visit', flagDE: 'visit' }[act];
    return OUTFIT[byAct || 'conference'];
  }
  // visiting-researcher photos: round glasses
  const PHOTOEXTRA = { 'zurich.jpg': ['glasses'], 'tubingen.jpg': ['glasses'], 'tubingen2.jpg': ['glasses'] };
  const ACTEXTRA = { surf: ['wave'], ski: ['poleL', 'poleR', 'rockies'], runway: ['bag'], tame: ['goal'], film: ['strip'] };

  // ------------------------------------------------------------ dom
  const canvas = document.createElement('canvas');
  canvas.className = 'buddy';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A bear guide');
  // everything that is placed in page coordinates sits in a layer that clips sideways, so the
  // canvas reaching past the page edge never makes the page wider
  const layer = document.createElement('div'); layer.className = 'buddy-layer'; document.body.appendChild(layer);
  // the layer is as tall as the page (measured with it collapsed, so it never feeds its own height)
  const fitLayer = () => {
    let bottom = innerHeight;
    for (const c of document.body.children) {
      if (c === layer || /buddy/.test(c.className) || getComputedStyle(c).position === 'fixed') continue;
      bottom = Math.max(bottom, c.getBoundingClientRect().bottom + scrollY);
    }
    const h = Math.ceil(bottom) + 'px';
    if (layer.style.height !== h) layer.style.height = h;
  };
  fitLayer(); setInterval(fitLayer, 600); addEventListener('resize', fitLayer);
  const hole = document.createElement('div'); hole.className = 'buddy-hole'; layer.appendChild(hole);
  const bubble = document.createElement('div'); bubble.className = 'buddy-bubble'; bubble.setAttribute('aria-live', 'polite');
  layer.append(canvas); document.body.append(bubble);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, stencil: true }); }
  catch (e) { canvas.remove(); bubble.remove(); return; }
  const dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.autoClear = false;
  renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.12)];   // nothing shows below the ground: it can dig in
  renderer.setSize(CW, CH, false);
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd9c8bd, 1.25); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-3, 6, 5); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xfff1dc, 0.9); rim.position.set(4, 4, -6); scene.add(rim);   // a rim from behind: rounder, more solid
  const EL = 0.42, D = 8.2, PX = 34;                 // elevation (rad), distance, px per unit
  const camera = new THREE.PerspectiveCamera(2 * Math.atan(CH / (2 * D * PX)) * 180 / Math.PI, CW / CH, 0.1, 100);
  camera.position.set(0, 2.3 + D * Math.sin(EL), D * Math.cos(EL));
  camera.lookAt(0, 2.3, 0);
  camera.updateMatrixWorld();
  const { root, P } = makeBear();
  scene.add(root);
  // shadows on the ground, drawn with the bear (so they sit over photos too): a soft dark patch
  // right under the feet, and a real shadow of whatever it is and holds, cast to the right
  const shTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(24,14,8,1)'); gr.addColorStop(0.5, 'rgba(24,14,8,0.75)'); gr.addColorStop(1, 'rgba(24,14,8,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const shMat = () => new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.7), shMat()); contact.rotation.x = -Math.PI / 2; contact.position.y = 0.01;
  contact.renderOrder = -1; scene.add(contact);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;                          // drawn once a frame, with props and all (see the render)
  const caster = new THREE.DirectionalLight(0xffffff, 0);         // lights nothing; only throws the shadow, low from the left
  caster.position.set(-4, 8, 2.4); caster.castShadow = true; caster.layers.enableAll();
  Object.assign(caster.shadow.camera, { left: -4.5, right: 4.5, top: 5, bottom: -3, near: 0.5, far: 20 });
  caster.shadow.mapSize.set(1024, 1024); caster.shadow.bias = -0.001; caster.shadow.radius = 3;
  scene.add(caster);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.ShadowMaterial({ color: 0x180e08, opacity: 0.4, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.005; ground.receiveShadow = true; scene.add(ground);
  const shadowRT = new THREE.WebGLRenderTarget(1, 1);            // the shadow pass draws here; only its shadow map is kept

  // props for the papers' acts
  const pmat = (c, r = 0.5, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, ...o });
  const PR = {};
  // a small robot arm that shows up beside it (self-compensation)
  PR.robot = new THREE.Group(); PR.robot.position.set(1.65, 0, 0.9); PR.robot.rotation.y = -0.3; scene.add(PR.robot);   // beside it, in front
  const grey = pmat(0xb9c0c8, 0.4), blue = pmat(0x3b6fd8, 0.4, { emissive: 0x000000 });   // joints: red while wild, blue once tamed
  const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.26, 24), grey); rb.position.y = 0.13; PR.robot.add(rb);
  const j1 = new THREE.Group(); j1.position.y = 0.22; PR.robot.add(j1);
  j1.add(sphere(0.17, blue)); j1.add(capsule(0.12, 0.6, grey, [0, 0.36, 0]));
  const j2 = new THREE.Group(); j2.position.y = 0.72; j1.add(j2);
  j2.add(sphere(0.15, blue)); j2.add(capsule(0.1, 0.45, grey, [0, 0.28, 0]));
  const grip = new THREE.Group(); grip.position.y = 0.58; j2.add(grip);
  const fingers = [-1, 1].map((sg) => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.12), blue); f.position.set(sg * 0.1, 0.1, 0); grip.add(f); return f; });
  // the spot the robot is told to reach: red while it keeps missing, green once it lands on it
  PR.goal = new THREE.Group(); scene.add(PR.goal);
  const goalMat = new THREE.MeshBasicMaterial({ color: 0xe5484d });
  const goalRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 32), goalMat); PR.goal.add(goalRing);
  for (const a of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.02), goalMat); b.rotation.z = a; PR.goal.add(b); }   // a cross in the middle
  const _g = new THREE.Vector3();
  // a flat lens on a handle (metalens)
  PR.lens = new THREE.Group(); P.body.add(PR.lens);
  PR.lens.add(new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 10, 36), M.dark));
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.015, 36), pmat(0xbfe3ff, 0.05, { transparent: true, opacity: 0.4 }));
  glass.rotation.x = Math.PI / 2; PR.lens.add(glass);
  for (let i = 1; i <= 3; i++) {                                                   // the flat lens's rings
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09 * i, 0.006, 6, 32), pmat(0x7fb4e8, 0.3)); PR.lens.add(ring);
  }
  PR.lens.add(capsule(0.04, 0.38, M.dark, [0, -0.6, 0]));
  // raindrops and dust right on the lens: the metalens filters them out
  const lensDrops = [];
  for (const [x, y, r, c] of [[-0.14, 0.12, 0.05, 0x8fc3ee], [0.12, -0.08, 0.045, 0x8fc3ee], [0.05, 0.2, 0.035, 0x8fc3ee], [-0.05, -0.18, 0.03, 0x7a5a3c], [0.2, 0.1, 0.025, 0x7a5a3c], [-0.22, -0.05, 0.028, 0x7a5a3c]])
    lensDrops.push(sphere(r, pmat(c, 0.15, { transparent: true, opacity: 0.85 }), [1, 1, 0.5], [x, y, 0.03]));
  lensDrops.forEach((d) => PR.lens.add(d));
  // a camcorder with a blinking light (video)
  PR.cam = new THREE.Group(); P.body.add(PR.cam);
  PR.cam.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.5), pmat(0x7d8794, 0.45)));
  PR.cam.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.3), pmat(0x4a525c, 0.5)).translateX(-0.3).translateY(0.1));   // viewfinder
  const lensC = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.22, 20), pmat(0x22262b, 0.3)); lensC.rotation.x = Math.PI / 2; lensC.position.z = 0.34; PR.cam.add(lensC);
  const recMat = pmat(0xff3b30, 0.3, { emissive: 0xff3b30, emissiveIntensity: 0.8 });
  const rec = sphere(0.05, recMat, [1, 1, 1], [0.17, 0.2, 0.18]); PR.cam.add(rec);
  // the footage it shoots, as a film strip: each frame hit by something different, the same object masked in every one
  PR.strip = new THREE.Group(); scene.add(PR.strip);
  const stripCv = document.createElement('canvas'); stripCv.width = 512; stripCv.height = 174;
  const stripTex = new THREE.CanvasTexture(stripCv); stripTex.colorSpace = THREE.SRGBColorSpace;
  PR.strip.add(new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.19), new THREE.MeshBasicMaterial({ map: stripTex, transparent: true, side: THREE.DoubleSide })));
  const STRIPFX = ['blur', 'noise', 'dark', 'snow', 'fog', 'blocks'];
  function drawStrip(A) {
    const g = stripCv.getContext('2d'), W = 512, H = 150, fw = 150, LB = { blur: 'blur', noise: 'noise', dark: 'dark', snow: 'snow', fog: 'fog', blocks: 'jpeg' }, off = (A * 40) % (fw + 8);
    g.clearRect(0, 0, W, H + 24); g.fillStyle = 'rgba(255,250,242,0.92)'; g.beginPath(); g.roundRect(0, H - 4, W, 28, 8); g.fill();
    g.fillStyle = '#1f1f26'; g.beginPath(); g.roundRect(0, 6, W, H - 12, 10); g.fill();
    g.fillStyle = '#fffaf2'; for (let x = 6 - (off % 22); x < W; x += 22) { g.fillRect(x, 11, 10, 7); g.fillRect(x, H - 18, 10, 7); }   // sprocket holes
    for (let i = -1; i < 5; i++) {
      const x = 8 + i * (fw + 8) - off, n = Math.floor(A * 40 / (fw + 8)) + i, fx = STRIPFX[((n % 6) + 6) % 6];
      g.save(); g.beginPath(); g.rect(x, 24, fw, H - 48); g.clip();
      if (fx === 'blur') g.filter = 'blur(2.5px)';
      g.fillStyle = '#9fd0f2'; g.fillRect(x, 24, fw, 60); g.fillStyle = '#7cb36a'; g.fillRect(x, 84, fw, 42);   // sky, grass
      const bx = x + 38 + ((n * 13) % 60), by = 78;                                // the object (a little dog) moves along
      g.fillStyle = '#c0742f'; g.beginPath(); g.ellipse(bx, by, 17, 11, 0, 0, 7); g.fill(); g.beginPath(); g.arc(bx + 16, by - 9, 8, 0, 7); g.fill();
      g.fillRect(bx - 12, by + 6, 4, 10); g.fillRect(bx + 8, by + 6, 4, 10);
      g.filter = 'none';
      if (fx === 'noise') for (let k = 0; k < 140; k++) { g.fillStyle = `rgba(${Math.random() * 255 | 0},${Math.random() * 255 | 0},${Math.random() * 255 | 0},0.7)`; g.fillRect(x + Math.random() * fw, 24 + Math.random() * (H - 48), 2, 2); }
      if (fx === 'dark') { g.fillStyle = 'rgba(10,12,30,0.62)'; g.fillRect(x, 24, fw, H - 48); }
      if (fx === 'snow') { g.fillStyle = '#fff'; for (let k = 0; k < 26; k++) { g.beginPath(); g.arc(x + ((k * 37 + n * 11) % fw), 26 + ((k * 23 + A * 30) % (H - 52)), 1.8, 0, 7); g.fill(); } }
      if (fx === 'fog') { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x, 24, fw, H - 48); }
      if (fx === 'blocks') for (let k = 0; k < 8; k++) { g.fillStyle = `rgba(${120 + k * 12},${110 + k * 9},${130 - k * 5},0.55)`; g.fillRect(x + (k * 29) % fw, 24 + (k * 17) % 70, 18, 14); }
      g.fillStyle = 'rgba(47,123,255,0.5)'; g.strokeStyle = '#2f7bff'; g.lineWidth = 2;   // its mask, frame after frame
      g.beginPath(); g.ellipse(bx, by, 20, 14, 0, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.arc(bx + 16, by - 9, 10, 0, 7); g.fill(); g.stroke();
      g.restore();
      g.fillStyle = '#2b201b'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText(LB[fx], x + fw / 2, H + 18);   // what hit this frame
    }
    g.fillStyle = '#fffaf2'; g.fillRect(0, H, W, 4);
    stripTex.needsUpdate = true;
  }
  // boards it holds up, redrawn live (active learning, label shift)
  function makeBoard() {
    const c = document.createElement('canvas'); c.width = 320; c.height = 220;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.82), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide }));
    const grp = new THREE.Group(); grp.add(m); P.body.add(grp);
    grp.userData.g = c.getContext('2d'); grp.userData.t = t; return grp;
  }
  const frame0 = (g) => { g.fillStyle = '#fffaf2'; g.strokeStyle = '#2b201b'; g.lineWidth = 8; g.beginPath(); g.roundRect(4, 4, 312, 212, 18); g.fill(); g.stroke(); };
  const tick = (g, x, y, k) => { g.strokeStyle = '#2f9e44'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x + 7 * k, y + 9 * k); g.lineTo(x + 7 + 11 * k, y - 10 * k); g.stroke(); };
  // active learning: a region of an image is queried, and every class in it gets a tick
  PR.query = makeBoard();
  // (1) an informative superpixel is picked, (2) the answer: every class in it
  // (a multi-hot label), (3) its pixels are then sorted out class by class
  const SP = [[56, 50], [112, 46], [122, 96], [92, 116], [50, 104]];           // the queried superpixel
  function drawQuery(A) {
    const g = PR.query.userData.g; frame0(g);
    const c = A % 4.6;
    g.save(); g.beginPath(); g.roundRect(20, 30, 140, 160, 8); g.clip();
    g.fillStyle = '#9fd0f2'; g.fillRect(20, 30, 140, 160);                         // sky
    g.fillStyle = '#9a9a9a'; g.fillRect(20, 150, 140, 40);                         // road
    g.fillStyle = '#5f9e46'; g.beginPath(); g.arc(80, 112, 30, 0, 7); g.fill();    // tree
    g.fillStyle = '#7a5332'; g.fillRect(74, 128, 12, 24);
    g.strokeStyle = 'rgba(43,32,27,0.25)'; g.lineWidth = 2;                         // superpixels
    for (const [x0, y0, x1, y1] of [[20, 74, 160, 70], [20, 128, 160, 132], [56, 30, 50, 190], [112, 30, 122, 190], [20, 104, 160, 96]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    const poly = () => { g.beginPath(); SP.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    if (c > 2.6) {                                                                  // (3) which pixel is which
      const k = Math.min(1, (c - 2.6) / 0.8);
      g.save(); poly(); g.clip(); g.globalAlpha = 0.85 * k;
      g.fillStyle = '#3d7bd9'; g.fillRect(20, 30, 140, 160);                       // sky label
      g.fillStyle = '#3aa655'; g.beginPath(); g.arc(80, 112, 30, 0, 7); g.fill();  // tree label
      g.restore();
    }
    g.restore();
    const pulse = c < 1.0 ? 0.5 + 0.5 * Math.sin(c * 12) : 1;                      // (1) the query
    g.setLineDash([7, 5]); g.strokeStyle = `rgba(232,115,90,${pulse})`; g.lineWidth = 5; poly(); g.stroke(); g.setLineDash([]);
    const rows = [['tree', 1], ['sky', 1], ['road', 0], ['car', 0]], n = c < 1.0 ? 0 : Math.floor((c - 1.0) / 0.4) + 1;
    g.font = 'bold 22px sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
    rows.forEach(([name, has], i) => {                                             // (2) multi-hot answer
      const y = 52 + i * 42;
      g.strokeStyle = '#2b201b'; g.lineWidth = 4; g.strokeRect(178, y - 13, 26, 26);
      g.fillStyle = '#2b201b'; g.fillText(name, 214, y);
      if (has && i < n) tick(g, 182, y, 1);
    });
    PR.query.userData.t.needsUpdate = true;
  }
  // label shift: target class proportions pulled to match the source's
  PR.hist = makeBoard();
  // label shift as a balance: what is labelled in the target is picked until its class mix matches the source's
  function drawHist(A) {
    const g = PR.hist.userData.g; frame0(g);
    const src = [3, 2, 1], tgt0 = [1, 1, 4], c = A % 3.6, k = c < 0.6 ? 0 : Math.min(1, (c - 0.6) / 1.6);
    const e = k * k * (3 - 2 * k), cols = ['#3b6fd8', '#6aa84f', '#e8735a'];
    const tgt = tgt0.map((v, i) => Math.round(v + (src[i] - v) * e));
    const miss = tgt.reduce((a, v, i) => a + Math.abs(v - src[i]), 0) / 6, th = 0.32 * miss;   // the target side sinks while the mix is off
    g.fillStyle = '#2b201b'; g.beginPath(); g.moveTo(160, 112); g.lineTo(140, 196); g.lineTo(180, 196); g.fill();   // the stand
    g.save(); g.translate(160, 108); g.rotate(th);
    g.strokeStyle = '#2b201b'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-112, 0); g.lineTo(112, 0); g.stroke();
    [[-1, src, 'source'], [1, tgt, 'target']].forEach(([sd, cnt, name]) => {
      g.save(); g.translate(sd * 104, 0); g.rotate(-th);                            // pans hang straight down
      g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(-34, 50); g.moveTo(0, 0); g.lineTo(34, 50); g.stroke();
      g.fillStyle = '#c9b79c'; g.beginPath(); g.ellipse(0, 52, 44, 8, 0, 0, 7); g.fill(); g.stroke();
      let n = 0; cnt.forEach((v, ci) => { for (let q = 0; q < v; q++, n++) { g.fillStyle = cols[ci]; g.fillRect(-36 + (n % 4) * 18, 30 - Math.floor(n / 4) * 16, 15, 14); } });
      g.fillStyle = '#2b201b'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.fillText(name, 0, 80);
      g.restore();
    });
    g.restore();
    if (k >= 1) tick(g, 276, 28, 1);
    PR.hist.userData.t.needsUpdate = true;
  }
  // card-like props drawn on a canvas
  function cardTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const flat = (w, h, tex) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }));
  // a newspaper (news)
  // the news, as it is on the page right now: in the paper it reads and on the TV it watches
  const curNews = () => {
    const band = document.querySelector('[data-news-band]');
    return band ? [((band.querySelector('[data-date]') || {}).textContent || '').trim(), ((band.querySelector('[data-text]') || {}).textContent || '').trim()] : ['', ''];
  };
  const wrapText = (g, text, x, y, maxW, lh, lines) => {
    const words = text.split(/\s+/); let line = '', n = 0;
    for (let k = 0; k < words.length && n < lines; k++) {
      const t = line ? line + ' ' + words[k] : words[k];
      if (g.measureText(t).width > maxW && line) { g.fillText(n === lines - 1 ? line + '…' : line, x, y + n * lh); n++; line = words[k]; } else line = t;
    }
    if (n < lines && line) g.fillText(line, x, y + n * lh);
  };
  const paperCv = document.createElement('canvas'); paperCv.width = 320; paperCv.height = 220;
  const paperTex = new THREE.CanvasTexture(paperCv); paperTex.colorSpace = THREE.SRGBColorSpace;
  function drawPaper([date, text]) {
    const g = paperCv.getContext('2d'), w = 320, h = 220;
    g.fillStyle = '#f4efe6'; g.fillRect(0, 0, w, h); g.fillStyle = '#2b201b'; g.textAlign = 'center';
    g.font = 'bold 30px serif'; g.fillText('The Daily Bear', w / 2, 34);
    g.fillRect(14, 44, w - 28, 3); g.font = '12px serif'; g.fillText(date || 'today', w / 2, 60); g.fillRect(14, 66, w - 28, 1);
    g.textAlign = 'left'; g.font = 'bold 19px serif'; wrapText(g, text || 'Fresh news!', 16, 90, w - 32, 22, 3);
    g.fillStyle = '#9a9188'; for (let i = 0; i < 4; i++) { g.fillRect(16, 162 + i * 13, 130, 5); g.fillRect(174, 162 + i * 13, 130, 5); }
    paperTex.needsUpdate = true;
  }
  PR.paper = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.86), new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.85, side: THREE.DoubleSide }));
  P.body.add(PR.paper);
  // a little TV on legs beside it, the news on (headline, then a ticker running underneath)
  PR.tv = new THREE.Group(); scene.add(PR.tv);
  const tvCv = document.createElement('canvas'); tvCv.width = 320; tvCv.height = 220;
  const tvTex = new THREE.CanvasTexture(tvCv); tvTex.colorSpace = THREE.SRGBColorSpace;
  PR.tv.add(new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.3, 0.8), pmat(0x8a5a3a, 0.6)).translateY(1.15));                  // a wooden cabinet
  PR.tv.add(new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.0), new THREE.MeshBasicMaterial({ map: tvTex })).translateY(1.15).translateZ(0.405));
  for (const x of [-0.6, 0.6]) PR.tv.add(capsule(0.05, 0.4, M.dark, [x, 0.25, 0]));                                        // legs
  for (const sg of [-1, 1]) { const a = capsule(0.02, 0.5, M.dark, [sg * 0.2, 2.05, 0]); a.rotation.z = -sg * 0.5; PR.tv.add(a); }   // rabbit ears
  function drawTv([date, text], A) {
    const g = tvCv.getContext('2d'), w = 320, h = 220;
    g.fillStyle = '#16233f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, 40); g.fillStyle = '#fff'; g.font = 'bold 24px sans-serif'; g.textAlign = 'left'; g.fillText('NEWS', 14, 29);
    if (Math.sin(A * 5) > 0) { g.fillStyle = '#ff5a4f'; g.beginPath(); g.arc(246, 20, 7, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.font = 'bold 14px sans-serif'; g.fillText('LIVE', 258, 26);
    g.fillStyle = '#9fb4dd'; g.font = '13px sans-serif'; g.fillText(date, 14, 62);
    g.fillStyle = '#fff'; g.font = 'bold 19px sans-serif'; wrapText(g, text || 'Fresh news!', 14, 90, w - 28, 24, 4);
    g.fillStyle = '#f3c331'; g.fillRect(0, h - 30, w, 30); g.fillStyle = '#16233f'; g.font = 'bold 15px sans-serif';
    const tick = (text || '') + '   •   ', tw = g.measureText(tick).width, off = (A * 60) % tw;
    for (let x = -off; x < w; x += tw) g.fillText(tick, x, h - 10);
    for (let y = 0; y < h; y += 4) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y, w, 1); }   // scanlines
    tvTex.needsUpdate = true;
  }
  // a globe on a little stand (experience)
  PR.globe = new THREE.Group(); P.body.add(PR.globe);
  const ball = new THREE.Group(); PR.globe.add(ball);
  ball.add(sphere(0.34, pmat(0x5fa0d8, 0.5)));
  for (const [x, y, z, r] of [[0.15, 0.12, 0.25, 0.14], [-0.2, -0.05, 0.22, 0.12], [0.05, -0.2, -0.27, 0.13], [-0.1, 0.22, -0.2, 0.1]])
    { const land = sphere(r, pmat(0x77b255, 0.6), [1, 0.7, 0.5], [x, y, z]); land.lookAt(0, 0, 0); ball.add(land); }
  const meridian = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 32, Math.PI), pmat(0xc9a227, 0.4)); meridian.rotation.z = Math.PI / 2; PR.globe.add(meridian);
  PR.globe.add(capsule(0.03, 0.2, pmat(0xc9a227, 0.4), [0, -0.5, 0]));
  // a mortarboard (education)
  PR.cap = new THREE.Group(); P.head.add(PR.cap);
  PR.cap.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.22, 24), M.dark));
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 1.2), M.dark); board.position.y = 0.13; board.rotation.y = Math.PI / 4; PR.cap.add(board);
  PR.cap.add(capsule(0.025, 0.35, pmat(0xe0b23a, 0.5), [0.5, -0.05, 0.3]));
  PR.cap.add(sphere(0.05, pmat(0xe0b23a, 0.5), [1, 1, 1], [0, 0.17, 0]));
  // a stack of papers (publications)
  PR.books = new THREE.Group(); P.body.add(PR.books);
  [0xe8735a, 0x3b6fd8, 0x6aa84f].forEach((c, i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.8 - i * 0.04, 0.13, 0.55), pmat(c, 0.6)); b.position.set((i % 2 ? 0.04 : -0.03), i * 0.14, 0); b.rotation.y = (i % 2 ? 0.08 : -0.06); PR.books.add(b);
  });
  // a clipboard with ticks (services)
  PR.clip = new THREE.Group(); P.body.add(PR.clip);
  const ticks = [];
  PR.clip.add(flat(0.62, 0.82, cardTex(150, 200, (g, w, h) => {
    g.fillStyle = '#9c6b45'; g.fillRect(0, 0, w, h); g.fillStyle = '#fffaf2'; g.fillRect(12, 22, w - 24, h - 34);
    g.fillStyle = '#5a5a5a'; g.fillRect(52, 6, 46, 22);
    g.strokeStyle = '#2b201b'; g.lineWidth = 4;
    for (let i = 0; i < 4; i++) { g.strokeRect(24, 44 + i * 36, 20, 20); g.fillStyle = '#bbb'; g.fillRect(54, 50 + i * 36, 70, 8); }
  })));
  for (let i = 0; i < 4; i++) {
    const t = flat(0.13, 0.13, cardTex(64, 64, (g) => { g.strokeStyle = '#2f9e44'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(10, 34); g.lineTo(26, 50); g.lineTo(56, 12); g.stroke(); }));
    t.material.transparent = true; t.position.set(-0.17, 0.235 - i * 0.148, 0.01); PR.clip.add(t); ticks.push(t);
  }
  // a trophy held high, with confetti (honors)
  PR.trophy = new THREE.Group(); P.body.add(PR.trophy);
  const gold = pmat(0xe3b341, 0.25, { metalness: 0.6 });
  const cupP = [[0.08, 0], [0.24, 0.02], [0.24, 0.06], [0.07, 0.1], [0.06, 0.28], [0.12, 0.33], [0.3, 0.45], [0.33, 0.75], [0.3, 0.76]].map(([r, y]) => new THREE.Vector2(r, y));
  const cupM = new THREE.Mesh(new THREE.LatheGeometry(cupP, 28), gold); cupM.material.side = THREE.DoubleSide; PR.trophy.add(cupM);
  for (const sg of [-1, 1]) { const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 20, Math.PI * 1.2), gold); hnd.position.set(sg * 0.33, 0.58, 0); hnd.rotation.z = sg > 0 ? -1.3 : Math.PI + 1.3; PR.trophy.add(hnd); }
  const confetti = Array.from({ length: 18 }, (_, i) => {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05), pmat([0xe8735a, 0x3b6fd8, 0x6aa84f, 0xf3c331, 0xd16ba5][i % 5], 0.6, { side: THREE.DoubleSide }));
    c.position.set((Math.random() - 0.5) * 2.4, Math.random() * 4.2, (Math.random() - 0.3) * 1.2); c.visible = false; scene.add(c); return c;
  });
  // gear for each test domain (continual TTA)
  PR.umbrella = new THREE.Group(); PR.umbrella.position.set(0.95, 1.9, 0.3); PR.umbrella.rotation.z = 0.25; P.body.add(PR.umbrella);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), pmat(0x3b6fd8, 0.5, { side: THREE.DoubleSide }));
  canopy.scale.y = 0.45; canopy.position.y = 2.1; PR.umbrella.add(canopy);
  PR.umbrella.add(capsule(0.03, 2.05, M.dark, [0, 1.05, 0]));
  PR.scarf = new THREE.Group(); P.body.add(PR.scarf);
  const knit = pmat(0xd64545, 0.9);
  const sc = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.12, 10, 30), knit); sc.rotation.x = Math.PI / 2; sc.position.y = 2.0; PR.scarf.add(sc);
  const tailS = capsule(0.1, 0.45, knit, [0.3, 1.65, 0.62]); tailS.rotation.z = 0.25; PR.scarf.add(tailS);
  PR.fan = new THREE.Group(); PR.fan.position.set(0.9, 1.75, 0.85); P.body.add(PR.fan);
  const fanMat = pmat(0xe8735a, 0.6, { side: THREE.DoubleSide });
  const fanLeaf = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24, Math.PI * 0.15, Math.PI * 0.7), fanMat); fanLeaf.position.y = 0.25; PR.fan.add(fanLeaf);
  for (let i = 0; i < 5; i++) { const rib = capsule(0.012, 0.5, M.dark, [0, 0.25 + 0.25, 0.01]); rib.position.set(Math.cos(Math.PI * (0.2 + i * 0.15)) * 0.27, 0.25 + Math.sin(Math.PI * (0.2 + i * 0.15)) * 0.27, 0.01); rib.rotation.z = Math.PI * (0.2 + i * 0.15) - Math.PI / 2; PR.fan.add(rib); }
  PR.fan.add(capsule(0.03, 0.3, M.dark, [0, 0.05, 0]));
  // FIFO: a fog-pass filter, a funnel that pulls the fog out
  PR.funnel = new THREE.Group(); P.body.add(PR.funnel);
  const fun = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.6, 24, 1, true), pmat(0x3b6fd8, 0.45, { side: THREE.DoubleSide }));
  fun.rotation.z = Math.PI; fun.position.y = 0.3; PR.funnel.add(fun);
  PR.funnel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 12), pmat(0x3b6fd8, 0.45)));
  PR.funnel.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 28), pmat(0x2b201b, 0.5)).rotateX(Math.PI / 2).translateZ(-0.6));
  // gallery props: a microphone, a pointer, a phone, a laptop
  PR.mic = new THREE.Group(); P.body.add(PR.mic);
  PR.mic.add(sphere(0.12, pmat(0x55595f, 0.35))); PR.mic.add(capsule(0.045, 0.32, M.dark, [0, -0.26, 0]));
  PR.pointer = new THREE.Group(); P.body.add(PR.pointer);
  const stick = capsule(0.025, 1.3, pmat(0x8a5a2b, 0.5), [0, 0.65, 0]); PR.pointer.add(stick);
  PR.pointer.add(sphere(0.05, pmat(0xe5484d, 0.4), [1, 1, 1], [0, 1.35, 0]));
  PR.phone = new THREE.Group(); PR.phone.position.set(0, -0.72, 0.12); PR.phone.rotation.set(0, Math.PI, 0); P.armL.add(PR.phone);
  PR.phone.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.05), pmat(0x2b2b33, 0.3)));
  const scrMat = pmat(0x9fd0f2, 0.2, { emissive: 0x4a7aa8, emissiveIntensity: 0.4 });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.46), scrMat); scr.position.z = -0.03; scr.rotation.y = Math.PI; PR.phone.add(scr);
  PR.laptop = new THREE.Group(); P.body.add(PR.laptop);
  const lb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.6), pmat(0xb9c0c8, 0.4)); PR.laptop.add(lb);
  const lid = new THREE.Group(); lid.position.set(0, 0.02, -0.3); lid.rotation.x = -0.35; PR.laptop.add(lid);
  lid.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.04), pmat(0xb9c0c8, 0.4)).translateY(0.3));
  const lscr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), pmat(0x9fd0f2, 0.2, { emissive: 0x4a7aa8, emissiveIntensity: 0.5 })); lscr.position.set(0, 0.3, 0.025); lid.add(lscr);
  // GaRA-SAM: three point prompts on the bear (stars), then its mask
  PR.prompts = new THREE.Group(); P.body.add(PR.prompts);
  const promptPts = [[0.05, 1.25, 1.02], [0.18, 2.2, 0.98], [-0.55, 0.75, 0.95]].map(([x, y, z]) => {
    const g = new THREE.Group(); g.position.set(x, y, z);
    g.add(sphere(0.12, pmat(0xffd35a, 0.3, { emissive: 0xffb800, emissiveIntensity: 0.6 })));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 20), M.dark));
    PR.prompts.add(g); return g;
  });
  // a little flag on a pole that waves (Switzerland, Germany)
  const flagTex = (draw) => cardTex(192, 128, draw);
  const FLAGS = {
    CH: flagTex((g, w, h) => { g.fillStyle = '#d52b1e'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(w / 2 - 12, h / 2 - 40, 24, 80); g.fillRect(w / 2 - 40, h / 2 - 12, 80, 24); }),
    DE: flagTex((g, w, h) => { ['#000000', '#dd0000', '#ffce00'].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * h / 3, w, h / 3 + 1); }); }),
  };
  PR.flag = new THREE.Group(); P.body.add(PR.flag);
  PR.flag.add(capsule(0.03, 1.7, pmat(0x8a5a2b, 0.5), [0, 0.85, 0]));
  PR.flag.add(sphere(0.06, pmat(0xe3b341, 0.3), [1, 1, 1], [0, 1.75, 0]));
  const flagGeo = new THREE.PlaneGeometry(0.9, 0.6, 12, 1); flagGeo.translate(0.45, 0, 0);
  const flagBase = flagGeo.attributes.position.array.slice();
  const flagMat = new THREE.MeshStandardMaterial({ map: FLAGS.CH, roughness: 0.8, side: THREE.DoubleSide });
  const cloth = new THREE.Mesh(flagGeo, flagMat); cloth.position.set(0.02, 1.38, 0); PR.flag.add(cloth);
  function waveFlag(t) {
    const a = flagGeo.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { const x = flagBase[i]; a[i + 2] = Math.sin(x * 7 - t * 8) * 0.08 * x / 0.9; }
    flagGeo.attributes.position.needsUpdate = true;
  }
  // ExLPose: glowing keypoints and a skeleton, visible in the dark
  const kpMat = new THREE.MeshBasicMaterial({ color: 0x7cf0ff }), boneMat = new THREE.LineBasicMaterial({ color: 0x7cf0ff });
  const KP = [[P.head, [0, 0, 0.75]], [P.body, [-0.72, 1.5, 0.35]], [P.body, [0.72, 1.5, 0.35]], [P.armL, [0, -0.6, 0.15]], [P.armR, [0, -0.6, 0.15]],
    [P.body, [-0.42, 0.6, 0.45]], [P.body, [0.42, 0.6, 0.45]], [P.legL, [0, -0.5, 0.3]], [P.legR, [0, -0.5, 0.3]]];
  const BONES = [[0, 1], [0, 2], [1, 3], [2, 4], [1, 5], [2, 6], [5, 6], [5, 7], [6, 8]];
  const kps = KP.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), kpMat); m.visible = false; m.layers.set(1); scene.add(m); return m; });
  const boneGeo = new THREE.BufferGeometry(); boneGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BONES.length * 6), 3));
  const bones = new THREE.LineSegments(boneGeo, boneMat); bones.visible = false; bones.layers.set(1); bones.frustumCulled = false; scene.add(bones);
  const _v = new THREE.Vector3();
  function placeKeypoints(on) {
    kps.forEach((m) => (m.visible = on)); bones.visible = on;
    if (!on) return;
    root.updateMatrixWorld(true);
    KP.forEach(([part, p], i) => kps[i].position.copy(part.localToWorld(_v.set(...p))));
    const a = boneGeo.attributes.position.array;
    BONES.forEach(([i, j], b) => { kps[i].position.toArray(a, b * 6); kps[j].position.toArray(a, b * 6 + 3); });
    boneGeo.attributes.position.needsUpdate = true;
  }
  // the page dims around it for the low-light paper
  const dimmer = document.createElement('div'); dimmer.className = 'buddy-dim'; document.body.appendChild(dimmer);
  // a comic mark beside its head (! when it finds something, ? when puzzled), Zs while it sleeps, a heart when patted
  const glyphTex = {};
  const glyph = (ch, col) => glyphTex[ch] || (glyphTex[ch] = cardTex(96, 96, (g) => {
    g.font = 'bold 76px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 12; g.strokeStyle = '#fffaf2'; g.lineJoin = 'round'; g.strokeText(ch, 48, 52); g.fillStyle = col; g.fillText(ch, 48, 52);
  }));
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyph('!', '#e8590c'), transparent: true, depthTest: false }));
  mark.layers.set(1); mark.visible = false; scene.add(mark);
  const zees = Array.from({ length: 3 }, () => { const z = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyph('Z', '#5b6fa8'), transparent: true, depthTest: false })); z.layers.set(1); z.visible = false; scene.add(z); return z; });
  // hearts for the visitors
  const heartTex = cardTex(64, 64, (g) => {
    g.fillStyle = '#ff4d6d'; g.beginPath(); g.moveTo(32, 54);
    g.bezierCurveTo(4, 34, 6, 10, 22, 10); g.bezierCurveTo(28, 10, 31, 14, 32, 19); g.bezierCurveTo(33, 14, 36, 10, 42, 10); g.bezierCurveTo(58, 10, 60, 34, 32, 54); g.fill();
  });
  PR.hearts = new THREE.Group(); P.body.add(PR.hearts);
  const patHeart = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthTest: false })); patHeart.layers.set(1); patHeart.visible = false; scene.add(patHeart);
  const hearts = Array.from({ length: 6 }, (_, i) => { const h = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: heartTex, transparent: true, depthWrite: false })); h.userData.ph = i / 6; PR.hearts.add(h); return h; });
  // outfit pieces
  const tri = (pts, mat) => { const sh = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); return new THREE.Mesh(new THREE.ShapeGeometry(sh), mat); };
  PR.shirt = tri([[-0.27, 0.36], [0.27, 0.36], [0, -0.38]], pmat(0xffffff, 0.6)); PR.shirt.position.set(0, 1.6, 0.97); PR.shirt.rotation.x = -0.22; P.body.add(PR.shirt);
  PR.tie = tri([[0, 0.3], [0.07, 0.2], [0.05, -0.24], [0, -0.32], [-0.05, -0.24], [-0.07, 0.2]], pmat(0xb22234, 0.5)); PR.tie.position.set(0, 1.62, 0.985); PR.tie.rotation.x = -0.22; P.body.add(PR.tie);
  PR.bowtie = new THREE.Group(); PR.bowtie.position.set(0, 1.9, 0.9); P.body.add(PR.bowtie);
  for (const sg of [-1, 1]) PR.bowtie.add(tri([[0, 0], [sg * 0.2, 0.1], [sg * 0.2, -0.1]], pmat(0x1a1a1f, 0.4)));
  PR.bowtie.add(sphere(0.045, pmat(0x1a1a1f, 0.4)));
  PR.stole = new THREE.Group(); P.body.add(PR.stole);
  for (const sg of [-1, 1]) { const st2 = new THREE.Mesh(new THREE.BoxGeometry(0.17, 1.15, 0.02), pmat(0xb22234, 0.5)); st2.position.set(sg * 0.3, 1.35, 0.95); st2.rotation.set(-0.12, 0, sg * 0.1); PR.stole.add(st2); }
  PR.pearls = new THREE.Group(); P.body.add(PR.pearls);
  for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; PR.pearls.add(sphere(0.05, pmat(0xfbf7ef, 0.2), [1, 1, 1], [Math.sin(a) * 0.62, 1.9 - 0.12 * (1 + Math.cos(a)) / 2, Math.cos(a) * 0.6])); }
  PR.swim = new THREE.Group(); P.body.add(PR.swim);                                        // striped swimsuit
  const swimTex = cardTex(256, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#2f7bd9'; g.fillRect(0, i * h / 8, w, h / 8 + 1); } });
  const swimBand = new THREE.Mesh(new THREE.CylinderGeometry(0.99, 1.03, 0.85, 36, 1, true), new THREE.MeshStandardMaterial({ map: swimTex, roughness: 0.7 }));
  swimBand.position.y = 0.95; swimBand.scale.z = 0.92; PR.swim.add(swimBand);
  for (const sg of [-1, 1]) { const strap = capsule(0.05, 0.6, pmat(0x2f7bd9, 0.6), [sg * 0.42, 1.62, 0.62]); strap.rotation.x = -0.5; PR.swim.add(strap); }
  PR.wet = new THREE.Group(); P.body.add(PR.wet);                                          // wetsuit stripes
  for (const sg of [-1, 1]) { const ws = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.3, 0.3), pmat(0x2ec4d6, 0.4)); ws.position.set(sg * 0.98, 1.2, 0.1); ws.rotation.z = sg * -0.05; PR.wet.add(ws); }
  PR.beanie = new THREE.Group(); PR.beanie.position.y = 0.2; P.head.add(PR.beanie);       // a bobble hat
  PR.beanie.add(new THREE.Mesh(new THREE.SphereGeometry(0.86, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), pmat(0xd64545, 0.85)));
  PR.beanie.add(new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.09, 8, 30), pmat(0xffffff, 0.85)).rotateX(Math.PI / 2));
  PR.beanie.add(sphere(0.2, pmat(0xffffff, 0.9), [1, 1, 1], [0, 0.92, 0]));
  PR.fedora = new THREE.Group(); PR.fedora.position.y = 0.78; P.head.add(PR.fedora);     // a fedora
  const fed = pmat(0x2b2b33, 0.6);
  PR.fedora.add(new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.05, 32), fed));
  PR.fedora.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.45, 28), fed).translateY(0.24));
  PR.fedora.add(new THREE.Mesh(new THREE.CylinderGeometry(0.585, 0.585, 0.1, 28), pmat(0xe3b341, 0.5)).translateY(0.08));
  PR.bucket = new THREE.Group(); PR.bucket.position.y = 0.72; P.head.add(PR.bucket);     // a bucket hat
  const buc = pmat(0xc9b27c, 0.85);
  PR.bucket.add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 1.0, 0.18, 32, 1, true), pmat(0xc9b27c, 0.85, { side: THREE.DoubleSide })));
  PR.bucket.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.4, 28), buc).translateY(0.28));
  PR.backpack = new THREE.Group(); P.body.add(PR.backpack);                                 // a backpack
  PR.backpack.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.15, 0.45), pmat(0xe8735a, 0.7)).translateY(1.35).translateZ(-0.95));
  PR.backpack.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.2), pmat(0xc95a43, 0.7)).translateY(1.1).translateZ(-1.2));
  for (const sg of [-1, 1]) { const bs = capsule(0.05, 0.75, pmat(0x5a3d2a, 0.7), [sg * 0.45, 1.5, 0.7]); bs.rotation.x = -0.35; PR.backpack.add(bs); }
  PR.aodai = new THREE.Group(); P.body.add(PR.aodai);                                       // an áo dài: long front panel, mandarin collar
  PR.aodai.add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.85), pmat(0xc8102e, 0.5, { side: THREE.DoubleSide })).translateY(0.35).translateZ(0.98));
  PR.aodai.add(new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.2, 28), pmat(0xc8102e, 0.5)).translateY(2.02));
  PR.aodai.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 28), pmat(0xe3b341, 0.4)).rotateX(Math.PI / 2).translateZ(-1.92));
  // the robot bear's antenna and chest panel
  PR.antenna = new THREE.Group(); PR.antenna.position.set(0, 0.78, -0.05); P.head.add(PR.antenna);
  PR.antenna.add(capsule(0.03, 0.4, pmat(0x8a929c, 0.3, { metalness: 0.7 }), [0, 0.22, 0]));
  const antTip = pmat(0xff4d4d, 0.3, { emissive: 0xff2a2a, emissiveIntensity: 1 }); PR.antenna.add(sphere(0.09, antTip, [1, 1, 1], [0, 0.48, 0]));
  PR.panel = new THREE.Group(); PR.panel.position.set(0, 1.25, 0.9); PR.panel.rotation.x = -0.12; P.body.add(PR.panel);
  PR.panel.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.04), pmat(0x5d6670, 0.3, { metalness: 0.6 })));
  const panelLights = [0, 1, 2].map((i) => { const m = pmat(0x3be37a, 0.3, { emissive: 0x3be37a, emissiveIntensity: 1 }); PR.panel.add(sphere(0.055, m, [1, 1, 0.5], [-0.17 + i * 0.17, 0.05, 0.03])); return m; });
  // FREST: a wrench; RobustPVOS: a clapperboard; Style Neophile: a palette and a brush; ExLPose: a mocap cap
  PR.wrench = new THREE.Group(); PR.wrench.position.set(0, -0.62, 0.15); P.armR.add(PR.wrench);
  const steel = pmat(0xaab2bc, 0.25, { metalness: 0.6 });
  PR.wrench.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.05), steel).translateY(-0.3));
  const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 8, 16, Math.PI * 1.5), steel); jaw.position.y = -0.66; jaw.rotation.z = -Math.PI / 4; PR.wrench.add(jaw);
  PR.clapper = new THREE.Group(); PR.clapper.position.set(0, -0.68, 0.18); P.armL.add(PR.clapper);
  PR.clapper.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.04), pmat(0x1f1f26, 0.5)).translateY(-0.2));
  const clapTex = cardTex(64, 16, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#1f1f26'; g.beginPath(); g.moveTo(i * 8, 0); g.lineTo(i * 8 + 8, 0); g.lineTo(i * 8 + 4, h); g.lineTo(i * 8 - 4, h); g.fill(); } });
  const clapArm = new THREE.Group(); clapArm.position.set(-0.25, -0.02, 0); PR.clapper.add(clapArm);
  clapArm.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.045), new THREE.MeshStandardMaterial({ map: clapTex, roughness: 0.6 })).translateX(0.25));
  PR.palette = new THREE.Group(); PR.palette.position.set(0, -0.68, 0.2); P.armL.add(PR.palette);
  PR.palette.add(sphere(0.34, pmat(0xd9b27c, 0.7), [1, 0.08, 0.75]));
  [0xe5484d, 0x3b6fd8, 0xffd23f, 0x3be37a, 0xd64f8f].forEach((c, i) => PR.palette.add(sphere(0.05, pmat(c, 0.4), [1, 0.5, 1], [Math.cos(i * 1.1) * 0.2, 0.03, Math.sin(i * 1.1) * 0.14])));
  PR.palette.rotation.x = Math.PI / 2;
  PR.brush = new THREE.Group(); PR.brush.position.set(0, -0.62, 0.15); P.armR.add(PR.brush);
  PR.brush.add(capsule(0.025, 0.55, pmat(0x8a5a2b, 0.5), [0, -0.3, 0]));
  const brushTip = pmat(0xd64f8f, 0.5); PR.brush.add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 10), brushTip).rotateX(Math.PI).translateY(0.66));
  PR.mocapcap = new THREE.Group(); PR.mocapcap.position.set(0, 0.42, 0); P.head.add(PR.mocapcap);
  PR.mocapcap.add(new THREE.Mesh(new THREE.SphereGeometry(0.85, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), pmat(0x15161a, 0.8)));
  // GaRA-SAM: a helmet (SAM itself, always on) and seven armour modules, one per rank-1 component;
  // the gate decides which of those go on for each input
  const modMat = pmat(0xffa63d, 0.25, { metalness: 0.45, emissive: 0x8a4a00, emissiveIntensity: 0.4 });
  const mods = [
    [P.head, new THREE.Mesh(new THREE.SphereGeometry(0.98, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), modMat), [0, 0.06, -0.02], null, [1, 1.08, 1]],   // helmet
    [P.body, new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 8, 32), modMat), [0, 2.0, 0.05], [Math.PI / 2 + 0.12, 0, 0]],          // neck guard
    [P.body, sphere(0.34, modMat, [1, 0.6, 1]), [-0.8, 1.8, 0.1]],                                                                        // shoulder L
    [P.body, sphere(0.34, modMat, [1, 0.6, 1]), [0.8, 1.8, 0.1]],                                                                         // shoulder R
    [P.body, new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.12), modMat), [0, 1.42, 0.9], [-0.15, 0, 0]],                             // chest plate
    [P.body, new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.09, 8, 36), modMat), [0, 0.95, 0], [Math.PI / 2, 0, 0], [1, 0.94, 1]],        // belt
    [P.armL, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 16), modMat), [0, -0.5, 0.12]],                                   // gauntlet L
    [P.armR, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 16), modMat), [0, -0.5, 0.12]],                                   // gauntlet R
  ].map(([parent, m, p, r, sc]) => { m.position.set(...p); if (r) m.rotation.set(...r); m.userData.s = sc || [1, 1, 1]; m.userData.k = 0; m.visible = false; parent.add(m); return m; });
  { const visor = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 8, 28, Math.PI), modMat);   // the visor is part of the helmet: never on by itself
    visor.position.set(0, 0.09, 0.13); visor.rotation.set(Math.PI / 2 - 0.15, 0, 0); visor.scale.set(1, 1, 1 / 1.08); mods[0].add(visor); }
  PR.tophat = new THREE.Group(); PR.tophat.position.y = 0.78; P.head.add(PR.tophat);    // a ringmaster's top hat
  const thm = pmat(0x1a1a1f, 0.4);
  PR.tophat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.05, 32), thm));
  PR.tophat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.5, 0.75, 28), thm).translateY(0.4));
  PR.tophat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.515, 0.515, 0.14, 28), pmat(0xc0392b, 0.5)).translateY(0.12));
  PR.baton = new THREE.Group(); PR.baton.position.set(0, -0.62, 0.15); P.armL.add(PR.baton);   // a baton, in the free paw
  PR.baton.add(capsule(0.035, 0.8, pmat(0x1a1a1f, 0.4), [0, -0.4, 0.15]).rotateX(0.5));
  PR.baton.add(sphere(0.06, pmat(0xe3b341, 0.3, { metalness: 0.6 }), [1, 1, 1], [0, -0.78, 0.38]));
  PR.cape = new THREE.Group(); P.body.add(PR.cape);                                           // a superhero's cape
  const capeM = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.25, 1.7, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76), pmat(0xc0392b, 0.6, { side: THREE.DoubleSide }));
  capeM.position.y = 1.05; PR.cape.add(capeM); PR.cape.userData.m = capeM;
  PR.emblem = new THREE.Group(); PR.emblem.position.set(0, 1.45, 0.98); PR.emblem.rotation.x = -0.15; P.body.add(PR.emblem);   // a star on the chest
  { const st5 = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.09 : 0.22, a = Math.PI / 2 + i * Math.PI / 5; i ? st5.lineTo(Math.cos(a) * r, Math.sin(a) * r) : st5.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    PR.emblem.add(new THREE.Mesh(new THREE.CircleGeometry(0.3, 28), pmat(0xffd23f, 0.4)));
    PR.emblem.add(new THREE.Mesh(new THREE.ShapeGeometry(st5), pmat(0xc0392b, 0.4)).translateZ(0.01)); }
  PR.mcap = new THREE.Group(); PR.mcap.position.set(0, 0.42, 0.02); P.head.add(PR.mcap);    // a mechanic's cap
  PR.mcap.add(new THREE.Mesh(new THREE.SphereGeometry(0.85, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), pmat(0x3b5a8a, 0.7)));
  PR.mcap.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 24, 1, false, -Math.PI / 2, Math.PI), pmat(0x2c4468, 0.7)).translateZ(0.62).translateY(0.02));
  PR.deerstalker = new THREE.Group(); PR.deerstalker.position.set(0, 0.42, 0); P.head.add(PR.deerstalker);   // a detective's deerstalker
  const dsm = pmat(0x8a6a45, 0.85);
  PR.deerstalker.add(new THREE.Mesh(new THREE.SphereGeometry(0.86, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), dsm));
  for (const sg of [-1, 1]) PR.deerstalker.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 20, 1, false, -Math.PI / 2, Math.PI), dsm).rotateY(sg > 0 ? 0 : Math.PI).translateZ(0.66).translateY(0.02));
  PR.deerstalker.add(sphere(0.07, dsm, [1, 1, 1], [0, 0.86, 0]));
  PR.beret = new THREE.Group(); PR.beret.position.set(0.1, 0.72, -0.05); PR.beret.rotation.z = -0.25; P.head.add(PR.beret);   // a beret
  PR.beret.add(sphere(0.62, pmat(0x1f1f26, 0.8), [1, 0.32, 1]));
  PR.beret.add(sphere(0.05, pmat(0x1f1f26, 0.8), [1, 1, 1], [0, 0.2, 0]));
  PR.nightcap = new THREE.Group(); PR.nightcap.position.set(0, 0.5, -0.05); PR.nightcap.rotation.z = 0.35; P.head.add(PR.nightcap);   // a nightcap
  PR.nightcap.add(new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.3, 24), pmat(0x7fa7d8, 0.85)).translateY(0.55));
  PR.nightcap.add(new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.1, 8, 28), pmat(0xffffff, 0.9)).rotateX(Math.PI / 2));
  PR.nightcap.add(sphere(0.16, pmat(0xffffff, 0.9), [1, 1, 1], [0, 1.22, 0]));
  // a conference badge on a lanyard
  PR.badge = new THREE.Group(); P.body.add(PR.badge);
  for (const sg of [-1, 1]) { const cord = capsule(0.018, 0.75, pmat(0x3b6fd8, 0.5), [sg * 0.2, 1.62, 0.88]); cord.rotation.z = sg * 0.32; cord.rotation.x = -0.25; PR.badge.add(cord); }
  PR.badge.add(flat(0.36, 0.48, cardTex(72, 96, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#3b6fd8'; g.fillRect(0, 0, w, 26); g.fillStyle = '#2b201b'; g.fillRect(12, 44, 48, 8); g.fillRect(12, 60, 34, 6); })).translateY(1.18).translateZ(1.0));
  // venue accessories
  PR.maple = new THREE.Group(); PR.maple.position.set(0, -0.6, 0.12); P.armL.add(PR.maple);   // a Canadian flag in the left paw
  PR.maple.add(capsule(0.025, 1.0, pmat(0x8a5a2b, 0.5), [0, -0.5, 0]));
  const caTex = flagTex((g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#d52b1e'; g.fillRect(0, 0, w / 4, h); g.fillRect(w * 3 / 4, 0, w / 4, h);
    const cx = w / 2, cy = h / 2 + 4, k = 1.25;                                                // a simple maple leaf
    const pts = [[0, -34], [6, -22], [14, -26], [11, -10], [24, -16], [20, -6], [30, -4], [18, 6], [21, 14], [4, 10], [3, 22], [-3, 22], [-4, 10], [-21, 14], [-18, 6], [-30, -4], [-20, -6], [-24, -16], [-11, -10], [-14, -26], [-6, -22]];
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(cx + x * k, cy + y * k) : g.moveTo(cx + x * k, cy + y * k))); g.closePath(); g.fill();
  });
  const caFlag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshStandardMaterial({ map: caTex, roughness: 0.8, side: THREE.DoubleSide }));
  caFlag.position.set(-0.3, -0.85, 0); caFlag.rotation.z = Math.PI; PR.maple.add(caFlag);
  // New Orleans: a trumpet, with notes floating up
  PR.trumpet = new THREE.Group(); P.body.add(PR.trumpet);
  const brass = pmat(0xe3b341, 0.25, { metalness: 0.7 });
  PR.trumpet.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.9, 12), brass).rotateX(Math.PI / 2));
  PR.trumpet.add(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.35, 24, 1, true), pmat(0xe3b341, 0.25, { metalness: 0.7, side: THREE.DoubleSide })).rotateX(-Math.PI / 2).translateY(-0.6));   // the bell, facing away
  for (let i = 0; i < 3; i++) PR.trumpet.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 10), brass).translateZ(-0.05 + i * 0.1).translateY(0.12));
  const noteTex = cardTex(64, 64, (g) => { g.fillStyle = '#2b201b'; g.font = 'bold 54px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', 32, 34); });
  const notes = Array.from({ length: 4 }, (_, i) => { const n = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: noteTex, transparent: true })); n.userData.ph = i / 4; PR.trumpet.add(n); return n; });
  // Tel Aviv: a sunbed on the sand, under a striped parasol
  PR.beach = new THREE.Group(); scene.add(PR.beach);
  const sand = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), pmat(0xf0d9a8, 0.95)); sand.rotation.x = -Math.PI / 2; sand.position.y = 0.01; PR.beach.add(sand);
  const wood = pmat(0xf7f2e8, 0.6), stripe = pmat(0x3b8bd6, 0.6);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.0), stripe); seat.position.set(0.55, 0.42, 0); PR.beach.add(seat);
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 1.0), stripe); backrest.position.set(-0.85, 0.85, 0); backrest.rotation.z = -0.75; PR.beach.add(backrest);
  for (const [x, z] of [[-0.35, 0.42], [-0.35, -0.42], [1.45, 0.42], [1.45, -0.42]]) PR.beach.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), wood).translateX(x).translateY(0.21).translateZ(z));
  const parasol = new THREE.Group(); parasol.position.set(-1.7, 0, -0.9); PR.beach.add(parasol);
  parasol.add(capsule(0.03, 2.6, wood, [0, 1.3, 0]));
  for (let i = 0; i < 8; i++) parasol.add(new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.45, 8, 1, true, i * Math.PI / 4, Math.PI / 4), pmat(i % 2 ? 0xffffff : 0xe5484d, 0.6, { side: THREE.DoubleSide })).translateY(2.7));
  // San Diego: a surfboard under its feet, and a wave curling behind
  PR.surf = new THREE.Group(); root.add(PR.surf);
  PR.surf.add(sphere(1, pmat(0xffcf33, 0.3), [1.7, 0.07, 0.42], [0, -0.02, 0.05]));
  PR.surf.add(sphere(1, pmat(0xe5484d, 0.3), [1.65, 0.075, 0.05], [0, -0.01, 0.05]));
  PR.wave = new THREE.Group(); PR.wave.position.set(-1.9, 0, -0.4); scene.add(PR.wave);
  const water = pmat(0x2f8fd6, 0.25, { transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  // the wave, seen side-on: it rises on the left and curls over toward the bear, its lip foaming
  const WR = 1.15;
  const sheet = new THREE.Mesh(new THREE.CylinderGeometry(WR, WR, 1.6, 40, 1, true, Math.PI / 2 + 0.35, Math.PI * 1.5 - 0.35), water);
  sheet.rotation.x = Math.PI / 2; sheet.position.y = WR; PR.wave.add(sheet);
    const foam = new THREE.Mesh(new THREE.CylinderGeometry(WR + 0.03, WR + 0.03, 1.64, 40, 1, true, Math.PI / 2 + 0.35, 0.9), pmat(0xffffff, 0.7, { side: THREE.DoubleSide }));
  foam.rotation.x = Math.PI / 2; foam.position.y = WR; PR.wave.add(foam);                               // white water along the crest
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(WR - 0.04, WR - 0.04, 1.58, 40, 1, true, Math.PI / 2 + 0.35, Math.PI * 1.5 - 0.35), pmat(0x7cc4f0, 0.3, { side: THREE.BackSide }));
  inner.rotation.x = Math.PI / 2; inner.position.y = WR; PR.wave.add(inner);                            // the lighter inside of the curl
  const sea = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), pmat(0x56a9e3, 0.3)); sea.rotation.x = -Math.PI / 2; sea.position.set(1.5, 0.0, 0.6); sea.scale.set(1.3, 0.75, 1); PR.wave.add(sea);
  // Milan: the runway, a designer handbag and camera flashes
  PR.bag = new THREE.Group(); PR.bag.position.set(0, -0.72, 0.12); P.armL.add(PR.bag);
  PR.bag.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.16), pmat(0xd64f8f, 0.35)).translateY(-0.2));
  PR.bag.add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 20, Math.PI), pmat(0xe3b341, 0.3, { metalness: 0.6 })).translateY(-0.05));
  PR.runway = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 4.2), pmat(0x2b2b33, 0.5)); PR.runway.rotation.x = -Math.PI / 2; PR.runway.position.set(0, 0.01, -0.6); scene.add(PR.runway);
  // Denver: skis, poles, goggles, and the Rockies behind
  PR.skis = new THREE.Group(); root.add(PR.skis);
  for (const sg of [-1, 1]) { const ski = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 2.0), pmat(0xe5484d, 0.4)); ski.position.set(sg * 0.42, 0.02, 0.3); PR.skis.add(ski); }
  PR.poleL = new THREE.Group(); PR.poleL.position.set(0, -0.6, 0.12); P.armL.add(PR.poleL);
  PR.poleR = new THREE.Group(); PR.poleR.position.set(0, -0.6, 0.12); P.armR.add(PR.poleR);
  for (const pg of [PR.poleL, PR.poleR]) { pg.add(capsule(0.025, 1.3, pmat(0x2b2b33, 0.4), [0, -0.55, 0.2]).rotateX(0.25)); }
  PR.goggles = new THREE.Group(); PR.goggles.position.set(0, 0.16, 0.74); P.head.add(PR.goggles);
  PR.goggles.add(sphere(0.34, pmat(0x2b2b33, 0.5), [1.3, 0.56, 0.3]));
  PR.goggles.add(sphere(0.3, pmat(0xff8a1f, 0.12, { metalness: 0.4 }), [1.25, 0.48, 0.3], [0, 0, 0.03]));
  PR.rockies = new THREE.Group(); PR.rockies.position.set(0, 0, -3.2); scene.add(PR.rockies);
  for (const [x, h, r] of [[-1.8, 2.6, 1.3], [0.2, 3.4, 1.6], [2.0, 2.4, 1.2]]) {
    PR.rockies.add(new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), pmat(0x7d8a99, 0.9)).translateX(x).translateY(h / 2));
    PR.rockies.add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, h * 0.35, 5), pmat(0xffffff, 0.8)).translateX(x).translateY(h - h * 0.175 + 0.01));
  }
  PR.nonla = new THREE.Group(); PR.nonla.position.y = 0.72; P.head.add(PR.nonla);              // a nón lá
  PR.nonla.add(new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.62, 32, 1, true), pmat(0xe6cf8f, 0.75, { side: THREE.DoubleSide })).translateY(0.28));
  // snow: it turns into a snowman (carrot nose, top hat)
  PR.snowman = new THREE.Group(); P.head.add(PR.snowman);
  const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 14), pmat(0xf08a24, 0.5)); carrot.rotation.x = Math.PI / 2; carrot.position.set(0, -0.12, 1.15); PR.snowman.add(carrot);
  const hatM = pmat(0x1f1f24, 0.5);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 28), hatM); brim.position.y = 0.86; PR.snowman.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.55, 28), hatM); crown.position.y = 1.15; PR.snowman.add(crown);
  const hband = new THREE.Mesh(new THREE.CylinderGeometry(0.425, 0.43, 0.1, 28), pmat(0xd64545, 0.5)); hband.position.y = 0.95; PR.snowman.add(hband);
  PR.lantern = new THREE.Group(); PR.lantern.position.set(-0.75, 0.95, 0.85); P.body.add(PR.lantern);
  PR.lantern.add(sphere(0.15, pmat(0xffd27a, 0.3, { emissive: 0xffc04d, emissiveIntensity: 1.6 })));
  PR.lantern.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 20), M.dark));
  PR.lantern.add(capsule(0.02, 0.15, M.dark, [0, 0.25, 0]));
  const glow = new THREE.PointLight(0xffc870, 2.5, 4, 1.5); PR.lantern.add(glow);
  PR.phones = new THREE.Group(); P.head.add(PR.phones);
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 8, 30, Math.PI), pmat(0x2b2b33, 0.4)); band.position.set(0, 0.05, 0.05); PR.phones.add(band);
  for (const sg of [-1, 1]) {
    const cupH = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.24, 24), pmat(0xd64545, 0.4)); cupH.rotation.z = Math.PI / 2; cupH.position.set(sg * 1.0, 0.0, 0.05); PR.phones.add(cupH);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20), pmat(0x2b2b33, 0.6)); pad.rotation.z = Math.PI / 2; pad.position.set(sg * 1.14, 0.0, 0.05); PR.phones.add(pad);
  }
  PR.glasses = new THREE.Group(); PR.glasses.position.set(0, 0.13, 0.8); P.head.add(PR.glasses);   // round researcher glasses
  for (const sg of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 28), M.dark); rim.position.x = sg * 0.29; PR.glasses.add(rim);
    const lensG = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), pmat(0xd8ecff, 0.05, { transparent: true, opacity: 0.25 })); lensG.position.x = sg * 0.29; PR.glasses.add(lensG);
  }
  const gBridge = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12, Math.PI), M.dark); gBridge.position.y = 0.02; PR.glasses.add(gBridge);
  PR.shades = new THREE.Group(); PR.shades.position.set(0, 0.13, 0.78); P.head.add(PR.shades);
  for (const sg of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 20), pmat(0x111111, 0.15)); l.rotation.x = Math.PI / 2; l.position.x = sg * 0.29; PR.shades.add(l); }
  const bridge = capsule(0.02, 0.2, M.dark, [0, 0.03, 0]); bridge.rotation.z = Math.PI / 2; PR.shades.add(bridge);
  // Sohyun, as in the photo: thin round metal glasses, a navy cable-knit sweater with a little red
  // logo, and a black robot hand held up
  PR.specs = new THREE.Group(); PR.specs.position.set(0, 0.13, 0.8); P.head.add(PR.specs);
  const specM = pmat(0xc9b48a, 0.25, { metalness: 0.7 });
  for (const sg of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 8, 32), specM); rim.position.x = sg * 0.29; PR.specs.add(rim);
    const g2 = new THREE.Mesh(new THREE.CircleGeometry(0.18, 24), pmat(0xe6f2ff, 0.05, { transparent: true, opacity: 0.18 })); g2.position.x = sg * 0.29; PR.specs.add(g2);
  }
  const sBridge = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 12, Math.PI), specM); sBridge.position.y = 0.03; PR.specs.add(sBridge);
  // long, down to the chest   // long, down to the chest
  PR.logo = new THREE.Group(); PR.logo.position.set(0.36, 1.42, 0.95); PR.logo.rotation.set(-0.15, 0.35, 0); P.body.add(PR.logo);
  PR.logo.add(sphere(0.07, pmat(0xc0392b, 0.5), [1.3, 0.8, 0.25]));
  PR.robohand = new THREE.Group(); PR.robohand.position.set(0, -0.62, 0.14); PR.robohand.rotation.x = Math.PI / 2; P.armL.add(PR.robohand);
  const rhM = pmat(0x1c1d21, 0.45), rhSteel = pmat(0xb9c0c8, 0.3, { metalness: 0.6 });
  PR.robohand.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.16, 20), rhSteel));                                 // the steel wrist
  PR.robohand.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.13), rhM).translateY(0.22));                               // the palm
  const roboFingers = [-0.105, -0.035, 0.035, 0.105].map((x, i) => { const f = new THREE.Group(); f.position.set(x, 0.37, 0); f.add(capsule(0.03, i === 1 || i === 2 ? 0.2 : 0.16, rhM, [0, 0.12, 0])); PR.robohand.add(f); return f; });
  const roboThumb = new THREE.Group(); roboThumb.position.set(0.17, 0.2, 0.02); roboThumb.rotation.z = -0.9; roboThumb.add(capsule(0.035, 0.14, rhM, [0, 0.1, 0])); PR.robohand.add(roboThumb);
  // TestDG: the stream of test domains above its head; the ones it has adapted to stay lit (nothing forgotten)
  const domTex = (ch) => cardTex(64, 64, (g) => {
    g.fillStyle = '#fffaf2'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill(); g.strokeStyle = '#2b201b'; g.lineWidth = 3; g.stroke();
    // emoji differ in where they sit in their box: measure what is drawn and put its middle in the circle's middle
    let px = 32; g.font = `${px}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    let m = g.measureText(ch), w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    if (Math.max(w, h) > 36) { px = Math.floor(px * 36 / Math.max(w, h)); g.font = g.font.replace(/^\d+px/, px + 'px'); m = g.measureText(ch); w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight; h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent; }
    g.fillText(ch, 32 - w / 2 + m.actualBoundingBoxLeft, 32 + h / 2 - m.actualBoundingBoxDescent);
  });
  const stream = new THREE.Group(); stream.position.y = 3.85; stream.visible = false; scene.add(stream);
  const streamIcons = ['☔', '❄️', '📺', '🌫️', '🌙', '☀️'].map((ch, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: domTex(ch), transparent: true, depthWrite: false }));
    m.position.x = (i - 2.5) * 0.47; m.layers.set(1); stream.add(m); return m;
  });
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 3), new THREE.MeshBasicMaterial({ color: 0x2b201b })); arrow.rotation.z = Math.PI; arrow.layers.set(1); stream.add(arrow);
  const GARA = [                                                  // rank-1 components lit per input (modules 1-7; the helmet is SAM itself, always on)
    { w: 'rain', name: 'Rain', on: [1, 5, 6] }, { w: 'fog', name: 'Fog', on: [1, 4] }, { w: 'noise', name: 'Noise', on: [2, 3, 5, 7] },
    { w: 'snow', name: 'Snow', on: [1, 3, 6, 7] }, { w: 'night', name: 'Dark', on: [2, 4, 6] }, { w: 'dust', name: 'Dust (unseen)', on: [1, 3, 4], unseen: true },
  ];
  const TTA = [
    { w: 'rain', name: 'Rain', gear: 'umbrella', col: 0x3b8bd6 }, { w: 'snow', name: 'Snow', gear: 'snowman', col: 0xf3f5f8 },
    { w: 'noise', name: 'Noise', gear: 'phones', col: 0x8a8f99 }, { w: 'fog', name: 'Fog', gear: 'fan', col: 0xb9a8d6 },
    { w: 'night', name: 'Dark', gear: 'lantern', col: 0x2a3550 }, { w: 'bright', name: 'Glare', gear: 'shades', col: 0xffc94d },
  ];
  for (const k in PR) { PR[k].visible = false; PR[k].userData.k = 0; }
  // props live on layer 1 and are drawn after the bear, over it: always in front, never sunk into it
  root.traverse((o) => o.layers.enable(2));                     // the bear itself, for the segmentation mask pass
  const INPLACE = ['beach', 'wave', 'runway', 'rockies', 'surf', 'skis', 'swim', 'wet', 'beanie', 'fedora', 'bucket', 'backpack', 'aodai', 'pearls', 'nightcap', 'tophat', 'cape', 'mcap', 'deerstalker', 'beret', 'antenna', 'mocapcap', 'logo'];
  const FRONT = Object.keys(PR).filter((k) => !INPLACE.includes(k));
  for (const k in PR) PR[k].traverse((o) => o.layers.set(INPLACE.includes(k) ? 0 : 1));
  // ...but only while it faces us: turned away, glasses, phones and what it holds go behind its head and body
  let propsAway = false;
  const facing = (away) => { if (away === propsAway) return; propsAway = away; FRONT.forEach((k) => PR[k].traverse((o) => o.layers.set(away ? 0 : 1))); [...kps, bones].forEach((o) => o.layers.set(away ? 0 : 1)); };
  // open shells (helmet, hood, hats) cast from both faces, or their shadow is only a thin arc
  const casts = (o) => { if (!o.isMesh) return; o.castShadow = true; [].concat(o.material).forEach((m) => { m.shadowSide = THREE.DoubleSide; }); };
  root.traverse(casts);
  for (const k in PR) if (!['beach', 'wave', 'runway', 'rockies'].includes(k)) PR[k].traverse(casts);
  // the mask covers the bear's whole silhouette (its gear too) in one flat colour: drawn without depth, and
  // through the stencil so each pixel is tinted exactly once
  const maskMat = new THREE.MeshBasicMaterial({ color: 0x2f7bff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.ReplaceStencilOp, stencilFail: THREE.KeepStencilOp });
  hemi.layers.enableAll(); sun.layers.enableAll(); rim.layers.enableAll(); glow.layers.enableAll();
  Object.assign(PR.globe.userData, { s: 1.6 }); Object.assign(PR.trumpet.userData, { s: 1.6 }); Object.assign(PR.books.userData, { s: 1.5 }); Object.assign(PR.cap.userData, { s: 1.35 });
  Object.assign(PR.query.userData, { s: 1.3 }); Object.assign(PR.hist.userData, { s: 1.3 }); Object.assign(PR.paper.userData, { s: 1.2 }); Object.assign(PR.tv.userData, { s: 1.25 }); Object.assign(PR.clip.userData, { s: 1.6 });
  Object.assign(PR.robot.userData, { s: 1.6 }); Object.assign(PR.trophy.userData, { s: 1.45 }); Object.assign(PR.lens.userData, { s: 1.3 }); Object.assign(PR.cam.userData, { s: 1.35 });
  const ACTPROP = { hearts: 'hearts', trumpet: 'trumpet', sunbed: 'beach', runway: 'runway', surf: 'surf', ski: 'skis', flagCH: 'flag', flagDE: 'flag', kickCH: 'flag', conditions: 'prompts', speech: 'mic', point: 'pointer', selfie: 'phone', type: 'laptop', tame: 'robot', me: 'robohand', lens: 'lens', film: 'cam', ask: 'query', balance: 'hist', fifo: 'funnel',
    news: 'paper', globe: 'globe', grad: 'cap', books: 'books', review: 'clip', trophy: 'trophy' };
  // weather props: a little cloud with rain or snow, and fog
  const cloud = new THREE.Group(); cloud.position.y = 4.65; scene.add(cloud);
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
  // fog sits behind and around it, never in front, so the bear and its props stay solid
  const fogs = [[-1.25, 0.7, -0.5], [1.25, 1.1, -0.6], [0, 0.6, -1.1], [-0.7, 1.8, -0.9], [0.9, 2.2, -1.0]].map(([x, y, z]) => { const f = sphere(0.75, fogMat, [1.4, 0.7, 1], [x, y, z]); f.renderOrder = -1; scene.add(f); return f; });
  const W = { rain: 0, snow: 0, fog: 0, noise: 0, dust: 0, petals: 0, leaves: 0 };
  // RobustPVOS: what the camera goes through
  const FILM = [
    { vfx: 'motion' }, { vfx: 'noise', w: 'noise' }, { vfx: 'defocus' }, { vfx: 'pixel' }, { vfx: 'contrast' },
    { w: 'petals' }, { vfx: 'summer', light: 1.6 }, { w: 'leaves' }, { w: 'snow' },          // spring, summer, autumn, winter
    { vfx: 'unseen', unseen: true },                                                        // never seen in training
  ];
  // falling petals (spring) and leaves (autumn)
  const MAPLE = [[0, -34], [6, -22], [14, -26], [11, -10], [24, -16], [20, -6], [30, -4], [18, 6], [21, 14], [4, 10], [3, 22], [-3, 22], [-4, 10], [-21, 14], [-18, 6], [-30, -4], [-20, -6], [-24, -16], [-11, -10], [-14, -26], [-6, -22]];
  const leafShape = new THREE.Shape(); MAPLE.forEach(([x, y], i) => (i ? leafShape.lineTo(x / 300, -y / 300) : leafShape.moveTo(x / 300, -y / 300)));
  const LEAFGEO = new THREE.ShapeGeometry(leafShape), PETALGEO = new THREE.CircleGeometry(0.08, 10);
  const fallers = Array.from({ length: 16 }, (_, i) => {
    const m = new THREE.Mesh(PETALGEO, new THREE.MeshStandardMaterial({ color: 0xf6a6c1, roughness: 0.8, side: THREE.DoubleSide }));
    m.scale.set(1, 0.6, 1); m.position.set((Math.random() - 0.5) * 3, Math.random() * 4.4, (Math.random() - 0.3) * 1.4); m.visible = false; scene.add(m); return m;
  });
  const LEAF = [0xd9622b, 0xe8a33a, 0xb5402a], PETAL = [0xf6a6c1, 0xfbd3e0, 0xf18fb0];
  // dirt kicked up while digging
  const dirt = Array.from({ length: 14 }, () => { const d = sphere(0.07, pmat(0x7a5536, 0.9)); d.visible = false; d.userData.v = new THREE.Vector3(); scene.add(d); return d; });
  // sparkles while it restores itself
  const sparkles = Array.from({ length: 10 }, () => { const sp = sphere(0.05, pmat(0xffe27a, 0.3, { emissive: 0xffd34d, emissiveIntensity: 1 })); sp.visible = false; scene.add(sp); return sp; });
  // GaRA-SAM: rank-1 components above its head; the input decides how many light up
  const rankOn = pmat(0xffa63d, 0.25, { emissive: 0xff8a00, emissiveIntensity: 0.7 }), rankOff = pmat(0xd8d2ca, 0.6);   // lit = the armour's orange
  const rankDots = new THREE.Group(); rankDots.position.y = 3.55; scene.add(rankDots);
  for (let i = 0; i < 7; i++) rankDots.add(sphere(0.07, rankOff, [1, 1, 1], [(i - 3) * 0.19, 0, 0]));   // one per rank-1 component (modules 1-7)
  rankDots.visible = false;
  // a spark flies from each lit rank down to the module it fits on
  const sparkMat = pmat(0xffc061, 0.2, { emissive: 0xff9a1f, emissiveIntensity: 1.4 });
  const rankSparks = Array.from({ length: 7 }, () => { const m = sphere(0.12, sparkMat); m.visible = false; m.layers.set(1); scene.add(m); return m; });
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  // gaussian noise: static that flickers around it
  const NN = 90, noiseGeo = new THREE.BufferGeometry();
  noiseGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NN * 3), 3));
  noiseGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Array.from({ length: NN * 3 }, () => 0.35 + Math.random() * 0.6)), 3));
  const noise = new THREE.Points(noiseGeo, new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, vertexColors: true, transparent: true }));
  scene.add(noise);
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
    if (st.sleeping) { st.sleeping = false; st.bubbleUntil = 0; st.wakeT = performance.now(); say('*yawn* 🥱 I\'m up!', 1600); }
  }
  const pathLen = (pts, from) => pts.reduce((a, q, i) => a + Math.hypot(q[0] - (i ? pts[i - 1] : from)[0], q[1] - (i ? pts[i - 1] : from)[1]), 0);
  // walk to p (or to the first of several spots with a sensible route);
  // when every route is a long detour, pop over instead
  const p0 = (spots) => spots[0];
  function goTo(...spots) {
    if (compact()) { goDirect(spots[0]); return; }
    if (st.burrow) { burrowTo(nearestFree(p0(spots)) ? centre(...nearestFree(p0(spots))) : st.burrow.to); return; }
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
    burrowTo(centre(...first));
  }
  // too far to walk: it digs a hole, goes underground and pops up out of another
  const DIG = 750, UNDER = 200, RISE = 650;
  function burrowTo(p) {
    if (st.burrow) { if (performance.now() - st.burrow.t0 < DIG) st.burrow.to = p; return; }
    st.path = []; st.burrow = { from: st.pos.slice(), to: p, t0: performance.now() };
  }
  // stand beside an element, on the side nearer the cursor
  // gallery photos: stand right beside the photo, by its lower corner, even over the next one
  function besidePhoto(el) {
    const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    const y = r.bottom + scrollY - 6, right = r.right + 120 < vw;           // enough room on the right for it (and its props)?
    return [(right ? r.right + 40 : r.left - 40) + scrollX, y];
  }
  // a straight walk that ignores the page's layout
  function goDirect(p) {
    if (compact()) {                                             // phones: never leave the screen sideways
      const vw = document.documentElement.clientWidth;
      p = [Math.max(scrollX + 50, Math.min(scrollX + vw - 68, p[0])), p[1]];
    }
    if (!st.pos || reduce) { st.pos = p.slice(); return; }
    const d = Math.hypot(p[0] - st.pos[0], p[1] - st.pos[1]);
    if (st.burrow) { burrowTo(p); return; }
    if (d > Math.max(innerHeight * 0.9, 600)) { burrowTo(p); return; }   // far: dig down, pop up there
    st.path = [p];                                              // near: walk, leaving paw prints
  }
  // phones: stand at the right edge, level with what is on screen
  function besideMobile(spot) {
    const r = spot.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    const y = Math.max(innerHeight * 0.4, Math.min(innerHeight * 0.86, r.top + Math.min(r.height, 220)));
    return [scrollX + vw - 68, scrollY + y];
  }
  function besideOf(el) {
    const r = el.getBoundingClientRect(), y = r.top + scrollY + Math.min(r.height, 60) + BODY_H * 0.5;
    const L = [r.left + scrollX - BODY_W - 26, y], R = [r.right + scrollX + BODY_W + 26, y];
    const ref = st.cursor || st.pos;
    if (!ref) return [L, R];
    return Math.abs(L[0] - ref[0]) <= Math.abs(R[0] - ref[0]) ? [L, R] : [R, L];
  }

  if (/[?&]buddydebug\b/.test(location.search)) window.__buddy = { st, showSpot: (el) => showSpot(el, el) };   // for checking acts by hand
  // ------------------------------------------------------------ input
  let followTimer = 0;
  const spotOf = (el) => el && (el.closest('.publications ol.bibliography > li') || el.closest('.gallery-item') || el.closest('#navbar .nav-link') || el.closest('h2[id]') || el.closest(BLOCKS));
  // act out a paper or section, and say its line
  function showSpot(spot, el) {
    st.hover = spot; st.introTok = 0;                            // a new spot ends an introduction
    const key = spot.matches('li') ? (spot.querySelector('[id]') || {}).id
      : spot.matches('.gallery-item') ? 'gal:' + ((spot.querySelector('img') || {}).getAttribute?.('src') || '').split('/').pop().split('?')[0]
      : 'sec:' + sectionOf(spot);
    st.venue = key.startsWith('gal:') ? VENUE[Object.keys(VENUE).find((v) => key.slice(4).startsWith(v))] || null : null;
    // a city's motion replaces the generic poses (poster, group photo, talk); special photos keep theirs
    st.photoExtra = key.startsWith('gal:') ? PHOTOEXTRA[key.slice(4)] || [] : [];
    st.outfit = null;
    const act = (st.venue && VACT[st.venue] && ['point', 'cheese', 'speech', 'tada'].includes(ACT[key]) ? VACT[st.venue] : ACT[key]) || null;
    if (act !== st.act) {
      st.act = act; st.actT = 0;
      if (st.venue !== 'hanoi') st.mark = { ch: '!', t0: performance.now(), dur: 1100 };   // (not under the nón lá's brim)
    }
    if (key.startsWith('gal:')) st.outfit = outfitFor(key.slice(4), act, st.venue);
    else st.outfit = OUTFIT[SPOTOUTFIT[key]] || null;                 // sections and papers (null: the raincoat)
    say(lineFor(spot, el) + (st.venue ? ` · ${VNAME[st.venue]}` : ''), 3800);
  }
  document.addEventListener('pointermove', (e) => {
    st.cursor = [e.clientX + scrollX, e.clientY + scrollY];
    wake();
    if (compact()) return;                                       // phones: a finger drag is not a hover; scrolling decides
    const el = e.target instanceof Element ? e.target : null;
    st.onFig = !!(el && el.closest('.pub-fig'));
    const spot = spotOf(el);
    if (spot && spot !== st.hover) {
      showSpot(spot, el);
      if (spot.matches('.gallery-item')) goDirect(besidePhoto(spot));
      else if (!spot.closest('#navbar')) goTo(...besideOf(spot));
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
  let scrollTimer = 0, lastMid = 0;
  // phones: whatever sits in the middle of the screen is what it acts out
  function midSpot() {
    let el = document.elementFromPoint(innerWidth / 2, innerHeight * 0.45), spot = spotOf(el);
    // at the very bottom the last sections can never reach the middle: take the visitor map if it is on screen
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 40) {
      const v = document.querySelector('.mapmyvisitors-widget'), r = v && v.getBoundingClientRect();
      if (r && r.top < innerHeight && r.bottom > 0) { el = v; spot = v; }
    }
    if (spot && spot !== st.hover && !spot.closest('#navbar')) { showSpot(spot, el); goDirect(besideMobile(spot)); }
    else if (st.pos && (st.pos[1] < scrollY + 80 || st.pos[1] > scrollY + innerHeight - 20)) goDirect([scrollX + document.documentElement.clientWidth - 68, scrollY + innerHeight * 0.7]);
  }
  addEventListener('scroll', () => {
    wake();
    if (compact() && performance.now() - lastMid > 450) { lastMid = performance.now(); midSpot(); }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (compact()) {                                       // phones: act out what is in the middle of the screen
        midSpot();
        return;
      }
      if (!st.pos) return;
      const vy0 = scrollY + 90, vy1 = scrollY + innerHeight - 60;
      if (st.pos[1] < vy0 || st.pos[1] > vy1) {
        const mid = document.querySelector('.gallery-grid') && spotOf(document.elementFromPoint(innerWidth / 2, innerHeight * 0.5));
        if (mid && mid.matches('.gallery-item')) { showSpot(mid, mid); goDirect(besidePhoto(mid)); }   // the photo in view
        else goTo([st.pos[0], scrollY + innerHeight * 0.62]);
      }
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) say('You made it to the end, thanks for visiting!', 3000);
    }, 260);
  }, { passive: true });
  addEventListener('resize', () => { grid = null; });
  // the canvas lets clicks through (it is mostly empty), so hit-test the body itself
  document.addEventListener('pointerdown', (e) => {
    if (!st.at) return;
    const [x, y] = st.at.fixed ? [e.clientX, e.clientY] : [e.pageX, e.pageY], [fx, fy, k] = st.at.foot;
    if (Math.abs(x - fx) > 42 * k || y > fy + 4 || y < fy - (FY - HEAD) * k) return;
    st.tapBear = performance.now(); st.happyT = performance.now();
    wake(); st.waveT = performance.now();
    say(['Hi! ♥', 'Thanks for visiting!', '♥ ♥', 'Hehe, that tickles.'][Math.floor(Math.random() * 4)], 2000);
  });


  // a click on Sohyun's photo: it runs over, waves, and introduces Sohyun
  const INTRO = [
    "This is Sohyun! 👋",
    'A postdoc at POSTECH CVLab, with Prof. Suha Kwak.',
    'Sohyun builds physical AI for the real world 🤖',
    'Robust perception, robust foundation models, test-time adaptation…',
    '…and now: reliable vision-language-action models for real robots!',
    "Hover a paper and I'll act it out for you 🧸",
  ];
  const photo = document.querySelector('.hero-photo img');
  if (photo) { photo.style.cursor = 'pointer'; photo.title = 'Click: the bear will introduce Sohyun'; }
  document.addEventListener('click', (e) => {
    const ph = e.target instanceof Element && e.target.closest('.hero-photo');
    if (!ph || !st.pos) return;
    wake();
    const spot = spotOf(ph) || ph, tok = st.introTok = performance.now();
    st.hover = spot; st.outfit = OUTFIT.sohyun;                  // dressed like Sohyun in the photo
    st.act = 'me'; st.actT = 0; st.mark = { ch: '!', t0: performance.now(), dur: 1100 }; st.happyT = performance.now();
    if (!compact()) goTo(...besideOf(ph));
    INTRO.forEach((line, i) => setTimeout(() => {
      if (st.introTok !== tok) return;
      if (i === INTRO.length - 1) st.happyT = performance.now();
      say(line, 2700);
    }, i * 2700));
  });

  // first appearance: beside the top of the content
  setTimeout(() => {
    if (compact()) {                                         // phones: pop out by the right edge
      st.pos = [scrollX + document.documentElement.clientWidth - 68, scrollY + innerHeight * 0.72];
      st.burrow = { from: null, to: st.pos, t0: performance.now() - DIG };
    } else {
      buildGrid();
      const box = document.querySelector('.container .post') || document.querySelector('.container');
      const r = box.getBoundingClientRect();
      const g = nearestFree([r.left + scrollX - 60, scrollY + innerHeight * 0.55]);
      if (g) { st.pos = centre(...g); st.burrow = { from: null, to: st.pos, t0: performance.now() - DIG }; }   // pops out of a hole
    }
    if (compact()) setTimeout(midSpot, 4800);
    say(compact() ? "Hi! I'm Sohyun's bear 🧸 Scroll, and I'll act out what you see!" : "Hi! I'm Sohyun's bear 🧸 I follow the honey. Hover a paper and I'll act it out!", 5000);
  }, 700);

  // hold a prop d in front of it (toward the viewer) at height y, facing the viewer
  function front(o, y, d, tilt = -0.15) {
    const th = root.rotation.y;
    o.position.set(-d * Math.sin(th), y, d * Math.cos(th)); o.rotation.set(tilt, -th, 0);
  }

  function spray() {
    const d = dirt.find((o) => !o.visible); if (!d) return;
    d.visible = true; d.position.set((Math.random() - 0.5) * 0.8, 0.1, 0.3 + Math.random() * 0.4);
    d.userData.v.set((Math.random() - 0.5) * 3, 3 + Math.random() * 2.5, 0.5 + Math.random());
  }

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
      el.style.transform = `translate(${st.pos[0] - dy * s * 9}px, ${st.pos[1] + dx * s * 9}px) rotate(${ang + 90}deg)`;
      el.addEventListener('animationend', () => el.remove());
      layer.appendChild(el); prints.push(el);                     // in the clipped layer: never widens the page
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
      st.speed = Math.min(Math.max(240, Math.min(900, left / 1.2)), st.speed + 1100 * dt);
      const step = st.speed * dt;
      if (d <= step) { st.pos = tgt.slice(); st.path.shift(); if (!st.path.length) st.speed = 0; }
      else { st.pos = [st.pos[0] + dx / d * step, st.pos[1] + dy / d * step]; }
      if (d > 1) { st.yawT = Math.atan2(dx, dy); st.dir = [dx / d, dy / d]; }
      moving = true;
    } else if (fixed && st.fxT != null && st.fx != null) {      // phones: hop along the bottom of the screen
      const dx = st.fxT - st.fx;
      if (Math.abs(dx) > 3) {
        const sg = Math.sign(dx); st.speed = 170; st.fx += sg * Math.min(Math.abs(dx), 170 * dt);
        st.yawT = sg * Math.PI / 2; st.dir = [sg, 0]; moving = true;
      } else st.fxT = null;
    }
    if (!moving) {
      // at rest: turn to face the visitor, glancing toward the cursor
      st.yawT = -0.35;                               // a three-quarter view shows off the snout
      if (compact()) st.yawT = -0.65;                // phones: it stands at the right edge, so it looks left, at the page
      else if (st.cursor && st.pos && !fixed) st.yawT = Math.max(-0.6, Math.min(0.6, (st.cursor[0] - st.pos[0]) / 400)) || -0.35;
    }
    // little things it does on its own while standing: look around, tilt
    // its head, hop, wiggle, wave, spin, or wander off a bit
    if (!moving && !st.sleeping && !st.act && !st.idle && now > st.nextIdle) {
      const opts = fixed ? ['wander', 'look', 'tilt', 'hop', 'wiggle', 'wave', 'spin'] : ['wander', 'wander', 'look', 'tilt', 'hop', 'wiggle', 'wave', 'spin'];
      st.idle = opts[Math.floor(Math.random() * opts.length)]; st.idleT = 0;
      st.nextIdle = now + 3000 + Math.random() * 3500;
      if (st.idle === 'wave') { st.waveT = now; st.idle = null; }
      else if (st.idle === 'spin') { st.jumpT = now; st.idle = null; }
      else if (st.idle === 'wander' && fixed) { st.idle = null; st.fxT = 60 + Math.random() * (document.documentElement.clientWidth - 120); }
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
      st.idle = 'munch'; st.idleT = 0; st.nomAt = now; st.happyT = now; say('Nom nom 🍯', 1500);
    }
    if (st.idle) st.idleT += dt;
    if (st.act) st.actT += dt;
    let dyaw = st.yawT - st.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    st.yaw += dyaw * Math.min(1, dt * 9);

    // pose
    if (!st.sleeping && now - st.lastAct > 45000) { st.sleeping = true; st.sleepT = now; bubble.classList.remove('on'); }
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
    // burrowing: dig in (wiggle, sink), underground, rise out of the new hole
    let sink = 0, holeK = 0, holeAt = st.pos;
    if (st.burrow && !fixed) {
      const b = st.burrow, t = now - b.t0;
      if (b.from && t < DIG) {
        const u = t / DIG; holeAt = b.from; holeK = Math.min(1, u * 4);
        sink = Math.max(0, (u - 0.25) / 0.75); sink *= sink;
        P.armL.rotation.x = P.armR.rotation.x = (-1.4 + 0.5 * Math.sin(t / 40)) * (1 - sink);   // paws digging
        P.body.rotation.x = 0.35; root.rotation.y = st.yaw + Math.sin(t / 60) * 0.25;
        if (Math.random() < 0.5) spray();
      } else if (t < DIG + UNDER) { sink = 1; holeK = 0; st.pos = b.to.slice(); }
      else if (t < DIG + UNDER + RISE) {
        const u = (t - DIG - UNDER) / RISE; st.pos = b.to.slice(); holeAt = b.to; holeK = 1;
        sink = 1 - Math.min(1, u * 1.35); sink = sink * sink;
        if (u > 0.74) root.position.y += Math.sin((u - 0.74) / 0.26 * Math.PI) * 0.35;      // and a little hop out
        if (u < 0.5 && Math.random() < 0.4) spray();
        P.armL.rotation.z = -0.2 - 1.6 * (1 - sink); P.armR.rotation.z = 0.2 + 1.6 * (1 - sink);
      } else if (t < DIG + UNDER + RISE + 450) { holeAt = b.to; holeK = 1 - (t - DIG - UNDER - RISE) / 450; }
      else st.burrow = null;
      root.position.y -= sink * 3.6;
    }
    root.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
    P.body.rotation.x = st.amp * 0.18;                                          // lean into the hop
    if (st.jumpT < 0) root.rotation.y = st.yaw;
    // reset the free channels, then let the idle or the paper's act pose it
    P.body.rotation.z = 0; P.head.rotation.z = 0; root.rotation.x = 0; root.rotation.z = 0; root.position.x = 0; root.position.z = 0;
    P.legL.rotation.z = P.legR.rotation.z = 0;
    P.armL.rotation.z = -0.2; if (st.waveT < 0) P.armR.rotation.z = 0.2;
    rankDots.visible = false;
    let laugh = 0, eyeBig = 0, goalAt = null, markCh = null, ttaNow = -1, ttaSeen = 0, garaOn = null, garaD = null, garaFly = -1, ttaCol = null, vfx = null, dark = 0, maskK = 0, wink = 0, fogPull = 0, snowy = 0, degrade = 0, sparkle = 0, want = ACTPROP[st.act], hyT = 0, hx = 0, light = 1, wx = { rain: st.onFig && !st.act ? 1 : 0, snow: 0, fog: 0, noise: 0, dust: 0, petals: 0, leaves: 0 };
    const still = 1 - st.amp, T = st.idleT, A = st.actT;
    switch (st.idle) {
      case 'look': hyT = T < 1 ? -0.8 : T < 2 ? 0.8 : 0; if (T > 2.8) st.idle = null; break;
      case 'tilt': P.head.rotation.z = Math.sin(Math.min(T * 2, Math.PI)) * 0.25; if (T > 1.6) st.idle = null; break;
      case 'hop': root.position.y += Math.abs(Math.sin(T * Math.PI * 2.5)) * 0.25 * still; if (T > 0.8) st.idle = null; break;
      case 'wiggle': P.body.rotation.z = Math.sin(T * 18) * 0.12 * Math.max(0, 1 - T / 1.2); if (T > 1.2) st.idle = null; break;
      case 'munch': P.armL.rotation.x = P.armR.rotation.x = -1.3; hx = Math.sin(T * 22) * 0.12; if (T > 1.3) st.idle = null; break;
    }
    switch (st.act) {
      case 'tame': {                                               // a jittery arm, calmed down
        // the robot stands on the side with room: its right on a computer, its left on a phone (it is at the right edge)
        const c = A % 4.4, wildK = c < 2.2 ? 1 - c / 2.4 : 0, sd = compact() ? -1 : 1, RX = 1.65 * sd;
        if (st.outfit && st.outfit.robot && A < 0.8) { root.rotation.y += (1 - A / 0.8) * Math.PI * 4 * (A / 0.8); sparkle = 1; }   // transform!
        antTip.emissiveIntensity = Math.sin(A * 8) > 0 ? 1.4 : 0.2;
        panelLights.forEach((m, i) => { const ok = wildK < 0.05; m.color.setHex(ok ? 0x3be37a : (Math.sin(A * 14 + i * 2) > 0 ? 0xffb020 : 0xe5484d)); m.emissive.copy(m.color); });
        root.rotation.y = st.yaw + (0.75 * sd - st.yaw) * Math.min(1, A * 3);   // turns to the robot
        PR.robot.rotation.y = -0.3 * sd;
        blue.color.setHex(wildK > 0.05 ? 0xe5484d : 0x3b6fd8);
        goalAt = [sd * -0.45, sd * -0.95, wildK < 0.05];
        blue.emissive.setHex(wildK > 0.05 && Math.sin(A * 20) > 0 ? 0x7a1010 : 0x000000);
        if (c < 2.2) {                                             // bear: easy there, a gentle pat
          const pat = sd > 0 ? P.armR : P.armL;                     // easy there: a pat, with the paw on the robot's side
          pat.rotation.z = sd * (0.2 + 0.5 * still); pat.rotation.x = (-1.3 + Math.sin(A * 9) * 0.3) * still;
          j1.rotation.z = sd * (-0.45 - wildK * (0.55 * Math.sin(A * 13) + 0.3 * Math.sin(A * 23)));   // keeps missing the spot it was told
          j2.rotation.z = sd * (-0.95 - wildK * 0.7 * Math.sin(A * 17 + 1));
          PR.robot.position.x = RX + wildK * 0.05 * Math.sin(A * 31);
        } else {                                                   // tamed: smooth and steady, a happy hop
          const v = c - 2.2;
          j1.rotation.z = sd * (-0.45 - 0.02 * Math.sin(v * 2.6)); j2.rotation.z = sd * (-0.95 - 0.02 * Math.sin(v * 2.6 + 1));   // right on it
          if (st.tameSaid !== A - c) { st.tameSaid = A - c; say('Pre-compensated → right on target ✓', 1500); }
          PR.robot.position.x = RX;
          if (v < 0.5) root.position.y += Math.sin(v / 0.5 * Math.PI) * 0.22 * still;
          fingers.forEach((f, i) => (f.position.x = (i ? 1 : -1) * (0.05 + 0.03 * Math.abs(Math.sin(v * 5)))));
        }
        break;
      }
      case 'tta': {                                                // continual TTA: same bear, the world keeps changing
        const n = Math.floor(A / 2.3), D = TTA[n % TTA.length], c = A % 2.3;
        if (D.w === 'night') light = 0.3; else if (D.w === 'bright') light = 1.75; else wx[D.w] = 1;
        ttaNow = n % TTA.length; ttaSeen = Math.min(TTA.length, n + (c >= 0.6 ? 1 : 0));
        if (c < 0.6) { hyT = Math.sin(c * 28) * 0.35; P.head.rotation.z = 0.2 * still; markCh = '?'; }   // huh? a new domain
        else {                                                                            // adapted, at test time: a nod and a sparkle
          if (c < 1.3) markCh = '!';                                                        // got it
          if (D !== st.ttaSaid) { st.ttaSaid = D; say(`Continual TTA · ${D.name} → adapted, nothing forgotten ✓`, 1900); }
          if (D.gear === 'snowman') { snowy = 1; want = 'snowman'; }                       // in the snow it becomes a snowman,
          else if (D.gear === 'lantern' || D.gear === 'phones') want = D.gear;             // in the dark it holds a lantern, in the noise wears headphones
          if (c < 0.9) { root.position.y += Math.sin((c - 0.6) / 0.3 * Math.PI) * 0.12 * still; sparkle = 1; }
          hx = c < 1.1 ? 0.25 * Math.sin((c - 0.6) / 0.5 * Math.PI) : 0;
        }
        break;
      }
      case 'conditions': {                                         // each input lights its own rank-1 components
        const D = GARA[Math.floor(A / 2.2) % GARA.length], c = A % 2.2;
        if (D.w === 'night') light = 0.45; else wx[D.w] = D.w === 'fog' || D.w === 'dust' ? 0.6 : 1;
        rankDots.visible = true;
        rankDots.children.forEach((d, i) => (d.material = D.on.includes(i + 1) && c > 0.1 ? rankOn : rankOff));
        // the gate lights this input's ranks; each flies down and snaps on as its armour piece
        garaD = D; garaFly = c > 0.15 && c < 0.55 ? (c - 0.15) / 0.4 : -1;
        garaOn = c >= 0.55 ? D.on : [];
        if (st.garaSaid !== A - c && c > 0.15) {
          st.garaSaid = A - c;
          say(`${D.name} → gate opens ranks ${D.on.join(', ')}${D.unseen ? ' · still segmented ✓' : ''}`, 1700);
        }
        // three point prompts land on it, one by one, then the mask covers it
        promptPts.forEach((g, i) => g.scale.setScalar(Math.max(0.001, Math.min(1, (c - 0.15 - i * 0.22) * 6))));
        maskK = c < 0.85 ? 0 : Math.min(1, (c - 0.85) * 4);
        break;
      }
      case 'restore': {                                            // a condition degrades it; it polishes itself back
        const c = A % 2.8, w = ['rain', 'snow', 'fog', 'night'][Math.floor(A / 2.8) % 4];
        const on = c < 1.0 ? 1 : Math.max(0, 1 - (c - 1.0) / 1.1);
        if (w === 'night') light = 1 - 0.7 * on; else wx[w] = on;
        degrade = c < 1.0 ? Math.min(1, c / 0.6) : Math.max(0, 1 - (c - 1.0) / 1.2);
        if (c >= 1.0 && c < 2.3) {                                 // polishing: the paw goes round and round
          P.armR.rotation.x = (-1.2 + 0.35 * Math.sin(A * 12)) * still; P.armR.rotation.z = 0.2 + 0.35 * Math.cos(A * 12) * still;   // working the wrench
          PR.wrench.rotation.y = Math.sin(A * 12) * 0.6;
          sparkle = 1; hx = 0.25;
        }
        if (c >= 2.3 && c < 2.7) root.position.y += Math.sin((c - 2.3) / 0.4 * Math.PI) * 0.15 * still;
        if (c >= 2.3 && st.restSaid !== A - c) { st.restSaid = A - c; say('Restored ✨', 900); }
        break;
      }
      case 'lens': {                                               // the lens up to its eye: drops land on it, the metalens filters them out
        const c = A % 3.0, f = c < 0.9 ? 0 : Math.min(1, (c - 0.9) / 0.7);
        P.armR.rotation.x = -1.75 * still; P.armR.rotation.z = 0.35 * still;
        PR.lens.position.set(0.3, 2.42, 1.02); PR.lens.rotation.set(0, 0, 0);
        hyT = 0; hx = 0; P.head.rotation.z = -0.06 * still;
        lensDrops.forEach((d) => { d.material.opacity = 0.85 * (1 - f); d.visible = f < 0.98; });
        eyeBig = 1;                                                 // its eye, huge behind the glass
        if (f >= 1) { sparkle = 1; if (st.lensSaid !== A - c) { st.lensSaid = A - c; say('Drops filtered out → clear view ✓', 1300); } }
        break;
      }
      case 'film': {                                               // keeps filming steadily as conditions change frame to frame
        // corruptions, then the seasons, then one it has never seen: it keeps filming through all of them
        const F = FILM[Math.floor(A / 1.0) % FILM.length], fc = A % 1.0;
        clapArm.rotation.z = fc < 0.12 ? 0.5 * (1 - fc / 0.12) : fc > 0.85 ? 0.5 * (fc - 0.85) / 0.15 : 0;   // clap! each new condition, a new take
        if (F.vfx === 'summer' || F.vfx === 'unseen') vfx = F.vfx;   // the corruptions themselves play out on the film strip
        if (F.w && F.w !== 'noise') wx[F.w] = 1;
        if (F.light) light = F.light;
        if (F.unseen) {
          if (st.filmSaid !== A - fc) { st.filmSaid = A - fc; say('Never seen this one… still tracking ✓', 1200); }
          if (fc > 0.3 && fc < 0.7) root.position.y += Math.sin((fc - 0.3) / 0.4 * Math.PI) * 0.15 * still;
        }
        P.armL.rotation.x = P.armR.rotation.x = -1.35 * still;
        if (st.cursor && st.pos) {
          hyT = Math.max(-1, Math.min(1, (st.cursor[0] - st.pos[0]) / 220)) - root.rotation.y;
          hx = Math.max(-0.5, Math.min(0.4, (st.cursor[1] - st.pos[1] + 80) / 300));
        }
        P.armR.rotation.z = 0.2 + 0.9 * still; P.armL.rotation.x = -0.6 * still;
        PR.cam.position.set(0.75, 2.35, 0.75); PR.cam.rotation.set(hx * 0.8, st.hy * 0.8 + 0.2, 0);
        drawStrip(A); PR.strip.position.set((compact() ? -1 : 1) * 2.45, 3.55, 0.2);
        recMat.emissiveIntensity = Math.sin(A * 6) > 0 ? 1.2 : 0.05;
        break;
      }
      case 'ask':                                                  // ticks every class in the queried region
        P.armL.rotation.x = P.armR.rotation.x = -1.3 * still;
        front(PR.query, 2.0, 1.35);
        drawQuery(A); hx = 0.3; P.head.rotation.z = Math.sin(A * 3) * 0.06;
        break;
      case 'night': {                                              // nearly pitch dark: only its keypoints glow as it poses
        light = 0.05; dark = 1;
        const k2 = Math.floor(A / 0.9) % 3;
        const L = [[-2.6, 2.6, 0], [-1.5, 1.5, 0.4], [-2.6, 0.5, -0.4]][k2];
        P.armL.rotation.z = -0.2 + (L[0] + 0.2) * still; P.armR.rotation.z = 0.2 + (L[1] - 0.2) * still; P.legR.rotation.z = L[2] * still;
        break;
      }
      case 'balance': {                                            // pulls the target's class proportions to the source's
        P.armL.rotation.x = P.armR.rotation.x = -1.3 * still;
        front(PR.hist, 2.0, 1.35);
        drawHist(A); hx = 0.3;
        if (A % 3.6 > 2.2 && A % 3.6 < 2.6) root.position.y += Math.sin((A % 3.6 - 2.2) / 0.4 * Math.PI) * 0.15 * still;
        break;
      }
      case 'fifo': {                                               // fog pulled into the filter; foggy or clear, all the same
        const c = A % 3.2;
        if (c < 1.6) {                                                            // both paws hold the filter up; the fog goes in
          wx.fog = 1; fogPull = Math.max(0, (c - 0.7) / 0.9);
          P.armL.rotation.x = P.armR.rotation.x = -2.2 * still; P.armL.rotation.z = -0.45; P.armR.rotation.z = 0.45;
          PR.funnel.position.set(0, 3.05, 0.85); PR.funnel.rotation.set(-0.2, 0, 0);
        } else {                                                                   // clear now: the filter down, a shrug
          want = null;
          const k = Math.min(1, (c - 1.6) / 0.3) * (c < 2.9 ? 1 : 0);
          P.armL.rotation.z = -0.2 - 0.9 * k * still; P.armR.rotation.z = 0.2 + 0.9 * k * still;   // a two-paw shrug
          P.armL.rotation.x = P.armR.rotation.x = -0.6 * k * still; P.head.rotation.z = 0.2 * k;
          if (st.fifoSaid !== A - c) { st.fifoSaid = A - c; say('Foggy or clear? Looks the same to me 🤷', 1500); }
        }
        hyT = 0.4;
        break;
      }
      case 'trumpet': {                                            // New Orleans jazz: a trumpet, swaying, notes floating up
        P.armL.rotation.x = P.armR.rotation.x = -1.45 * still; P.armL.rotation.z = -0.35; P.armR.rotation.z = 0.15;
        PR.trumpet.position.set(0.05, 2.0, 1.8); PR.trumpet.rotation.set(-0.25 + 0.08 * Math.sin(A * 4), 0, 0);
        P.body.rotation.z = 0.12 * Math.sin(A * 3) * still; root.position.y += Math.abs(Math.sin(A * 3)) * 0.06 * still; hx = -0.15;
        notes.forEach((n) => { const u = (A * 0.6 + n.userData.ph) % 1; n.position.set(0.35 * Math.sin(u * 6 + n.userData.ph * 9), 0.3 + u * 1.6, 0.9 + u * 0.6); n.material.opacity = 1 - u; n.rotation.set(0.25, 0, 0.3 * Math.sin(u * 5)); });
        break;
      }
      case 'sunbed':                                               // Tel Aviv: lying back on a sunbed, in the sun
        // reclined along the lounger, head on the raised end, paws behind the head, one knee up
        root.rotation.y = 0.12; root.rotation.z = 1.05 * still; root.position.x = 1.35 * still; root.position.y += 0.5 * still;
        P.armL.rotation.z = -0.2 - 2.5 * still; P.armR.rotation.z = 0.2 + 2.5 * still; P.armL.rotation.x = P.armR.rotation.x = -0.5 * still;
        P.legL.rotation.x = -0.7 * still; P.head.rotation.z = -0.25 + 0.06 * Math.sin(A * 0.8); hyT = 0.3; light = 1.3;
        PR.beach.rotation.y = 0;
        break;
      case 'runway': {                                             // Milan: struts the runway, hand on hip, flashes going off
        const t = A % 3.2;
        P.armR.rotation.z = 0.2 + 0.9 * still; P.armR.rotation.x = 0.6 * still;        // hand on hip
        P.armL.rotation.x = -0.5 * still;
        P.body.rotation.z = 0.12 * Math.sin(A * 6) * still; root.position.y += Math.abs(Math.sin(A * 6)) * 0.05 * still;
        if (t > 2.2) { root.rotation.y += (t - 2.2) * 0.8; P.head.rotation.z = -0.15 * still; }   // the turn at the end of the runway
        PR.runway.rotation.z = -root.rotation.y;
        if ((A % 0.7) < 0.08) vfx = 'flash';
        break;
      }
      case 'surf': {                                               // San Diego: riding the wave
        P.armL.rotation.z = -0.2 - 1.35 * still; P.armR.rotation.z = 0.2 + 1.2 * still;
        P.armL.rotation.x = -0.3 * still;
        P.legL.rotation.x = -0.25 * still; P.legR.rotation.x = 0.25 * still;
        root.rotation.z = 0.18 * Math.sin(A * 1.8) * still; root.position.y += (0.25 + 0.15 * Math.sin(A * 2.4)) * still;
        P.body.rotation.x = 0.25 * still; hyT = -0.3;
        PR.wave.position.y = 0.1 * Math.sin(A * 2.4);
        break;
      }
      case 'ski': {                                                // Denver: carving down a slope, the Rockies behind
        const sw = Math.sin(A * 2.2);
        P.armL.rotation.x = P.armR.rotation.x = -0.6 * still; P.armL.rotation.z = -0.45; P.armR.rotation.z = 0.45;
        root.rotation.z = 0.2 * sw * still; root.rotation.y = -0.2 + 0.35 * sw; P.body.rotation.x = 0.3 * still;   // facing us, carving
        root.position.y += -0.1 * still; root.position.x = 0.3 * sw * still;
        wx.snow = 0.6;
        break;
      }
      case 'me': {                                                 // Sohyun's photo: the robot hand up by its cheek, a big laugh
        P.armL.rotation.x = -1.5 * still; P.armL.rotation.z = -0.5 * still;
        P.head.rotation.z = 0.12 * still; laugh = 1; hx = -0.05;
        if (A < 1.4) { P.armR.rotation.z = 0.2 + 2.3 * still; P.armR.rotation.x = Math.sin(A * 9) * 0.35 * still; }   // a wave first
        roboFingers.forEach((f, i) => (f.rotation.x = 0.25 + 0.25 * Math.sin(A * 4 + i * 0.7)));                       // its fingers flex
        if ((A % 2.4) < 0.3) root.position.y += Math.sin((A % 2.4) / 0.3 * Math.PI) * 0.1 * still;
        break;
      }
      case 'greet':                                                // hello! a big wave and a little hop
        P.armR.rotation.z = 0.2 + 2.3 * still; P.armR.rotation.x = Math.sin(A * 9) * 0.35 * still;
        P.head.rotation.z = -0.12 * still;
        if ((A % 2) < 0.35) root.position.y += Math.sin((A % 2) / 0.35 * Math.PI) * 0.12 * still;
        break;
      case 'hearts': {                                             // thanks for visiting: a finger heart by the cheek, hearts floating out
        P.armR.rotation.x = -1.75 * still; P.armR.rotation.z = -0.15 * still;
        P.armL.rotation.z = -0.2 - (0.5 + 0.2 * Math.sin(A * 5)) * still;
        P.head.rotation.z = -0.15 * still; wink = 1;
        if ((A % 1.6) < 0.35) root.position.y += Math.sin((A % 1.6) / 0.35 * Math.PI) * 0.12 * still;
        PR.hearts.position.set(0.35, 2.25, 1.05);
        hearts.forEach((h) => { const u = (A * 0.45 + h.userData.ph) % 1; h.position.set(0.5 * u + 0.3 * Math.sin(u * 7 + h.userData.ph * 11), u * 1.8, u * 0.3); h.scale.setScalar(0.5 + u * 0.9); h.material.opacity = Math.min(1, (1 - u) * 2.5); h.rotation.z = 0.3 * Math.sin(u * 6); });
        break;
      }
      case 'speech':                                               // a talk: mic to the mouth, the other paw gesturing
        P.armR.rotation.x = -1.6 * still; P.armR.rotation.z = -0.35 * still;
        PR.mic.position.set(0.12, 2.1, 0.95);
        P.armL.rotation.z = -0.2 - (0.7 + 0.3 * Math.sin(A * 3)) * still; P.armL.rotation.x = -0.5 * still;
        hyT = 0.3 * Math.sin(A * 1.2);
        break;
      case 'cheese':                                               // group photo: both paws up, waving
        P.armL.rotation.z = -0.2 - (2.2 + 0.25 * Math.sin(A * 9)) * still; P.armR.rotation.z = 0.2 + (2.2 + 0.25 * Math.sin(A * 9 + 1)) * still;
        root.position.y += Math.abs(Math.sin(A * 3)) * 0.08 * still;
        break;
      case 'point': {                                              // at the poster: points, then turns to explain
        const p = Math.sin(A * 1.5);
        P.armR.rotation.z = 0.2 + 1.35 * still; P.armR.rotation.x = -0.2 * still;
        PR.pointer.position.set(1.15, 1.6, 0.35); PR.pointer.rotation.set(0, 0, -1.0 + 0.15 * p);
        hyT = 0.5 + 0.4 * p; P.armL.rotation.z = -0.2 - 0.5 * Math.max(0, -p) * still;
        break;
      }
      case 'peace':                                                // V sign, head tilt, a wink
        P.armR.rotation.z = 0.2 + 2.4 * still; P.armR.rotation.x = -0.4 * still;
        P.head.rotation.z = -0.18 * still; wink = 1;
        break;
      case 'selfie':                                               // phone up high, the other paw making a V
        P.armL.rotation.z = -0.2 - 0.9 * still; P.armL.rotation.x = -2.7 * still;                // phone up high, angled down at the face
        PR.phone.rotation.set(-0.6, Math.PI, 0); hx = -0.35;
        { const fl = (A % 1.6) < 0.12; scrMat.emissive.setHex(fl ? 0xffffff : 0x4a7aa8); scrMat.emissiveIntensity = fl ? 2.5 : 0.4; if (fl) vfx = 'flash'; }
        P.armR.rotation.z = 0.2 + 2.3 * still; P.head.rotation.z = 0.15 * still; wink = 1;
        break;
      case 'tada':                                                 // arms wide open: here it is!
        P.armL.rotation.z = -0.2 - 1.5 * still; P.armR.rotation.z = 0.2 + 1.5 * still;
        P.armL.rotation.x = P.armR.rotation.x = -0.6 * still;
        if (A % 2 < 0.4) root.position.y += Math.sin((A % 2) / 0.4 * Math.PI) * 0.18 * still;
        break;
      case 'flagCH': case 'flagDE': case 'kickCH': {                // waves the country's flag (and kicks in the meadow)
        const tex = st.act === 'flagDE' ? FLAGS.DE : FLAGS.CH;
        if (flagMat.map !== tex) { flagMat.map = tex; flagMat.needsUpdate = true; }
        P.armR.rotation.z = 0.2 + 2.1 * still; P.armR.rotation.x = -0.2 * still;
        PR.flag.position.set(1.0, 1.95, 0.4); PR.flag.rotation.set(0, -root.rotation.y, -0.35 + 0.12 * Math.sin(A * 3));
        waveFlag(A);
        if (st.act === 'kickCH') {
          const k = Math.max(0, Math.sin(A * 3));
          P.legR.rotation.z = 0.9 * k * still; P.legR.rotation.x = -0.4 * k * still;
          P.armL.rotation.z = -0.2 - 1.3 * still; P.body.rotation.z = -0.15 * k * still; root.position.y += 0.1 * k * still;
        } else { P.head.rotation.z = -0.12 * still; wink = Math.sin(A * 2) > 0.6 ? 1 : 0; }
        break;
      }
      case 'kick': {                                               // a happy kick in the meadow
        const k = Math.max(0, Math.sin(A * 3));
        P.legR.rotation.z = 0.9 * k * still; P.legR.rotation.x = -0.4 * k * still;
        P.armL.rotation.z = -0.2 - 1.3 * still; P.armR.rotation.z = 0.2 + 1.8 * still;
        P.body.rotation.z = -0.15 * k * still; root.position.y += 0.1 * k * still;
        break;
      }
      case 'type':                                                 // at the desk, typing away
        PR.laptop.position.set(0, 1.25, 1.05); PR.laptop.rotation.set(0.05, -root.rotation.y, 0);
        P.armL.rotation.x = (-1.15 + 0.12 * Math.max(0, Math.sin(A * 16))) * still;
        P.armR.rotation.x = (-1.15 + 0.12 * Math.max(0, Math.sin(A * 16 + 2))) * still;
        hx = 0.35;
        break;
      case 'news': {                                               // the news: on the TV, then in the paper (whatever is in the news band now)
        const N = curNews(), c = A % 9, sd = compact() ? -1 : 1;
        if (N[1] !== st.newsDrawn) { st.newsDrawn = N[1]; drawPaper(N); }
        if (c < 4.5) {                                              // watching TV, turned toward it, a nod now and then
          want = 'tv'; drawTv(N, A);
          PR.tv.position.set(sd * 2.45, 0, 0.4); PR.tv.rotation.y = -sd * 0.55;
          root.rotation.y = st.yaw + (sd * 0.95 - st.yaw) * Math.min(1, c * 3);
          hx = 0.05 + 0.08 * Math.max(0, Math.sin(A * 3)); P.armL.rotation.x = P.armR.rotation.x = -0.3 * still;
          if (c > 3.4 && c < 3.8) root.position.y += Math.sin((c - 3.4) / 0.4 * Math.PI) * 0.12 * still;   // oh!
        } else {                                                    // reading the paper, eyes left to right
          P.armL.rotation.x = P.armR.rotation.x = -1.4 * still;
          front(PR.paper, 2.0, 1.35);
          hyT = 0.35 * Math.sin(A * 2.2); hx = 0.25;
        }
        break;
      }
      case 'globe':                                                // spins the globe
        P.armL.rotation.x = P.armR.rotation.x = -1.2 * still;
        front(PR.globe, 1.85, 1.35, 0); ball.rotation.y = A * 2.2; ball.rotation.z = 0.4;
        hx = 0.2;
        break;
      case 'grad': {                                               // the cap goes up, spins, lands back
        const c = A % 2.4, up = c < 1 ? Math.sin(c * Math.PI) : 0;
        PR.cap.position.set(0, 0.62 + up * 1.4, -0.05); PR.cap.rotation.set(-0.15, up * Math.PI * 2, up * 0.4);
        if (c < 1) { P.armR.rotation.z = 0.2 + 2.2 * still * Math.min(1, c * 3); hx = -0.3 * up; }
        if (c > 1 && c < 1.4) root.position.y += Math.sin((c - 1) / 0.4 * Math.PI) * 0.15 * still;
        break;
      }
      case 'books':
        P.armL.rotation.x = P.armR.rotation.x = -1.15 * still;
        front(PR.books, 1.5, 1.3, 0); PR.books.rotation.z = Math.sin(A * 3) * 0.06;
        hx = 0.15; hyT = 0.15 * Math.sin(A * 1.5);
        break;
      case 'review': {                                             // ticks the boxes, one by one
        P.armL.rotation.x = -1.35 * still;
        front(PR.clip, 1.95, 1.3, -0.2);
        const n = Math.floor(A / 0.55) % 6;
        ticks.forEach((t, i) => (t.visible = i < n));
        P.armR.rotation.x = (-1.2 + Math.abs(Math.sin(A * Math.PI / 0.55)) * 0.25) * still; P.armR.rotation.z = -0.25;
        hx = 0.3; P.head.rotation.z = Math.sin(A * Math.PI / 0.55) * 0.05;
        break;
      }
      case 'trophy': {                                             // up high, a little bounce, confetti
        P.armL.rotation.z = -0.2 - 2.55 * still; P.armR.rotation.z = 0.2 + 2.55 * still;
        P.armL.rotation.x = P.armR.rotation.x = -0.25 * still;
        PR.trophy.position.set(0, 3.0, 0.35);
        root.position.y += Math.abs(Math.sin(A * 4)) * 0.12 * still; hx = -0.3;
        break;
      }
    }
    for (const d of dirt) {
      if (!d.visible) continue;
      d.userData.v.y -= 9.8 * dt; d.position.addScaledVector(d.userData.v, dt);
      if (d.position.y < 0) d.visible = false;
    }
    // the venue's accessories, held in the left paw when they need one
    if (st.act && st.venue === 'vancouver') wx.leaves = 1;                // autumn leaves in Vancouver
    const extra = (st.act && st.venue ? VACC[st.venue] || [] : []).concat(ACTEXTRA[st.act] || [], st.act ? st.photoExtra || [] : [], st.act && st.outfit ? st.outfit.wear : []);
    for (const k of extra) {
      if (HANDHELD[k] === 'up') { P.armL.rotation.z = -0.2 - 2.1 * still; P.armL.rotation.x = -0.2 * still; }
      if (HANDHELD[k] === 'front') { P.armL.rotation.x = -1.1 * still; P.armL.rotation.z = -0.35; }
    }
    // the act's prop pops in, the others pop out
    for (const k in PR) {
      const o = PR[k], on = (want === k || extra.includes(k)) && !st.sleeping;
      o.userData.k += ((on ? 1 : 0) - o.userData.k) * Math.min(1, dt * 9);
      o.visible = o.userData.k > 0.02; o.scale.setScalar(Math.max(0.001, o.userData.k) * (o.userData.s || 1));
    }
    // the coat tries new colours for the style paper, and settles back otherwise
    if (st.act === 'style') {                                  // the artist paints; the coat (and brush) keep trying new colours
      M.coat.color.setHSL((0.13 + A * 0.18) % 1, 0.7, 0.56); brushTip.color.setHSL((0.13 + A * 0.18 + 0.5) % 1, 0.7, 0.5);
      P.armL.rotation.x = -1.0 * still; P.armL.rotation.z = -0.35;
      P.armR.rotation.x = (-1.25 + 0.3 * Math.sin(A * 6)) * still; P.armR.rotation.z = 0.2 + 0.25 * Math.sin(A * 3) * still; hx = 0.2;
    }
    else {
      const of = st.act && st.outfit;
      M.coat.metalness = 0.3 * (st.robo || 0);
      M.coat.color.lerp(snowy ? SNOW : ttaCol != null ? _c.setHex(ttaCol) : of ? (of.coat == null ? (of.robot ? METAL : FUR) : _c.setHex(of.coat)) : COAT, Math.min(1, dt * 6));
      M.boot.color.lerp(of ? (of.boots === 'fur' ? FUR : _c2.setHex(of.boots)) : BOOTC, Math.min(1, dt * 6));
      M.trim.color.lerp(of && of.coat != null ? _c3.setHex(of.coat).multiplyScalar(0.82) : TRIMC, Math.min(1, dt * 6));   // the hem matches the outfit
      P.hood.visible = !of;
      P.shell.forEach((o, i) => (o.visible = (!of || of.coat != null) && !(i > 2 && of && of.plain)));   // a sweater has no buttons
    }
    const robo = st.act && st.outfit && st.outfit.robot ? 1 : 0;
    st.robo = (st.robo || 0) + (robo - (st.robo || 0)) * Math.min(1, dt * 5);
    M.fur.color.lerp(snowy ? SNOW : robo ? METAL : FUR, Math.min(1, dt * 4));
    M.fur.metalness = 0.3 * st.robo; M.fur.roughness = 0.8 - 0.45 * st.robo;
    M.paw.color.lerp(robo ? METAL3 : PAWC, Math.min(1, dt * 4));
    M.light.color.lerp(robo ? METAL2 : LIGHT, Math.min(1, dt * 4)); M.ear.color.lerp(robo ? METAL3 : EARC, Math.min(1, dt * 4));
    M.eye.color.lerp(robo ? _c3.setHex(0x7cf0ff) : EYEC, Math.min(1, dt * 4)); M.eye.emissive.setHex(0x3cc8ff); M.eye.emissiveIntensity = 1.2 * st.robo;
    maskMat.opacity = 0.62 * maskK;
    stream.visible = ttaNow >= 0 && !st.sleeping;
    if (stream.visible) streamIcons.forEach((m, i) => {
      const cur = i === ttaNow, seen = i < ttaSeen;
      m.material.opacity = cur || seen ? 1 : 0.28;
      m.scale.setScalar(cur ? 1.2 + 0.06 * Math.sin(now / 150) : 1);
      if (cur) arrow.position.set(m.position.x, -0.32, 0);
    });
    if (goalAt && PR.goal.visible) {                             // the goal sits where the arm should end up
      const s1 = j1.rotation.z, s2 = j2.rotation.z;
      j1.rotation.z = goalAt[0]; j2.rotation.z = goalAt[1]; PR.robot.updateMatrixWorld(true);
      grip.localToWorld(_g.set(0, 0.22, 0)); PR.goal.position.copy(_g);
      j1.rotation.z = s1; j2.rotation.z = s2; PR.robot.updateMatrixWorld(true);
      PR.goal.quaternion.copy(camera.quaternion);
      goalMat.color.setHex(goalAt[2] ? 0x2f9e44 : (Math.sin(now / 90) > 0 ? 0xe5484d : 0xff8a8a));
    }
    if (garaFly >= 0) root.updateMatrixWorld();
    rankSparks.forEach((sp, j) => {                              // rank j+1 flies from its dot to its module
      sp.visible = garaFly >= 0 && garaD.on.includes(j + 1) && !st.sleeping;
      if (!sp.visible) return;
      const t = garaFly * garaFly * (3 - 2 * garaFly);
      rankDots.children[j].getWorldPosition(_a); mods[j + 1].getWorldPosition(_b);
      sp.position.lerpVectors(_a, _b, t); sp.position.y += Math.sin(t * Math.PI) * 0.35;
      sp.scale.setScalar(1 + 0.4 * Math.sin(t * Math.PI));
    });
    mods.forEach((m, i) => {                                     // modules snap on and off with a little pop
      const on = garaOn && (i === 0 || garaOn.includes(i)) && !st.sleeping ? 1 : 0;   // the helmet (SAM) stays; the gate picks the rest
      m.userData.k += (on - m.userData.k) * Math.min(1, dt * 12);
      m.visible = m.userData.k > 0.02;
      const k = m.userData.k * (1 + 0.25 * Math.sin(m.userData.k * Math.PI)), sc = m.userData.s;
      m.scale.set(sc[0] * k, sc[1] * k, sc[2] * k);
    });
    if (PR.cape.visible) PR.cape.userData.m.rotation.x = -0.12 - 0.12 * Math.sin(now / 260) - st.amp * 0.3;   // the cape flutters
    placeKeypoints(dark > 0 && !st.sleeping);
    dimmer.classList.toggle('on', dark > 0 && !st.sleeping);
    const lit = dark > 0 && !st.sleeping && st.hover && st.hover.matches('li') ? st.hover : null;   // the paper itself stays in the light
    if (lit !== st.lit) { if (st.lit) st.lit.classList.remove('buddy-lit'); if (lit) lit.classList.add('buddy-lit'); st.lit = lit; }
    if (degrade > 0) { M.fur.color.copy(FUR).lerp(GREY, degrade * 0.75); M.coat.color.copy(st.outfit && st.outfit.coat != null ? _c.setHex(st.outfit.coat) : COAT).lerp(GREY, degrade * 0.75); M.light.color.copy(LIGHT).lerp(GREY, degrade * 0.75); }
    else M.light.color.lerp(LIGHT, Math.min(1, dt * 4));
    sparkles.forEach((sp, i) => {
      sp.visible = sparkle > 0;
      if (!sp.visible) return;
      const a = now / 400 + i * 1.3, r = 1.0 + 0.2 * Math.sin(now / 150 + i);
      sp.position.set(Math.cos(a) * r, 0.6 + ((now / 900 + i * 0.29) % 1) * 2.8, Math.sin(a) * r * 0.6 + 0.3);
      sp.scale.setScalar(0.6 + 0.6 * Math.abs(Math.sin(now / 120 + i)));
    });
    hemi.intensity += ((1.25 * light) - hemi.intensity) * Math.min(1, dt * 5);
    sun.intensity += ((1.4 * light) - sun.intensity) * Math.min(1, dt * 5);
    st.hy += (hyT - st.hy) * Math.min(1, dt * 7);
    P.head.rotation.y = st.hy;
    P.head.rotation.x = st.sleeping ? 0.35 : (moving ? 0.05 : -0.05 - W.rain * 0.3 - W.snow * 0.3) + hx;
    // weather: the cloud puffs in for rain and snow, fog drifts round its feet
    for (const w in W) W[w] += ((st.sleeping ? 0 : wx[w]) - W[w]) * Math.min(1, dt * 6);
    const cl = Math.max(W.rain, W.snow);
    cloud.visible = cl > 0.02; cloud.scale.setScalar(Math.max(0.001, cl));
    cloud.position.x = Math.sin(now / 900) * 0.08;
    for (const d of drops) {
      d.visible = W.rain > 0.5;
      d.position.y -= dt * 7;
      const shelter = PR.umbrella.visible && Math.abs(d.position.x - 0.45) < 1.0 && d.position.y < 4.0;
      if (d.position.y < 0.15 || shelter) { d.position.y = 4.45; d.position.x = (Math.random() - 0.5) * 1.5; }
    }
    for (const f of flakes) {
      f.visible = W.snow > 0.5;
      f.position.y -= dt * 1.5; f.position.x += Math.sin(now / 300 + f.position.y * 3) * dt * 0.3;
      if (f.position.y < 0.1) { f.position.y = 4.45; f.position.x = (Math.random() - 0.5) * 1.5; }
    }
    const fall = W.petals > W.leaves ? 'petals' : 'leaves', fk = Math.max(W.petals, W.leaves);
    fallers.forEach((f, i) => {
      f.visible = fk > 0.4;
      if (!f.visible) return;
      f.material.color.setHex((fall === 'petals' ? PETAL : LEAF)[i % 3]);
      f.geometry = fall === 'petals' ? PETALGEO : LEAFGEO;
      f.scale.setScalar(fall === 'petals' ? 1 : 1.5); if (fall === 'petals') f.scale.y *= 0.6;
      f.position.y -= dt * (fall === 'petals' ? 0.9 : 1.3); f.position.x += Math.sin(now / 400 + i) * dt * 0.5;
      f.rotation.x += dt * 3; f.rotation.z += dt * 2;
      if (f.position.y < 0.1) { f.position.y = 4.4; f.position.x = (Math.random() - 0.5) * 3; }
    });
    for (const c of confetti) {
      c.visible = st.act === 'trophy' && !st.sleeping;
      c.position.y -= dt * 1.3; c.rotation.x += dt * 6; c.rotation.y += dt * 4;
      if (c.position.y < 0.1) { c.position.y = 4.4; c.position.x = (Math.random() - 0.5) * 2.4; }
    }
    noise.visible = W.noise > 0.05; noise.material.opacity = W.noise;
    if (noise.visible) {
      const a = noiseGeo.attributes.position.array;
      for (let i = 0; i < NN; i++) { a[i * 3] = (Math.random() - 0.5) * 3.2; a[i * 3 + 1] = Math.random() * 3.8; a[i * 3 + 2] = (Math.random() - 0.3) * 1.6; }
      noiseGeo.attributes.position.needsUpdate = true;
    }
    fogMat.opacity = 0.5 * Math.max(W.fog, W.dust);
    fogMat.color.setHex(W.dust > W.fog ? 0xd9b98c : 0xffffff);
    fogs.forEach((f, i) => {
      f.visible = Math.max(W.fog, W.dust) > 0.02;
      const h = f.userData.home || (f.userData.home = f.position.clone());
      if (fogPull > 0) {                                           // sucked into the fog-pass filter
        const tgt = new THREE.Vector3(0, 3.4, 0.85).applyMatrix4(root.matrixWorld);
        f.position.copy(h).lerp(tgt, fogPull); f.scale.set(1.4 * (1 - 0.8 * fogPull), 0.7 * (1 - 0.8 * fogPull), 1 - 0.8 * fogPull);
      } else { f.position.copy(h); f.position.x += Math.sin(now / 1500 + i * 2) * 0.15; f.scale.set(1.4, 0.7, 1); }
    });
    // little alive things: an ear twitches now and then; when it is happy (a pat, honey) the ears
    // wiggle, the tail wags and the cheeks go pink; a pat squishes it like jelly and pops a heart
    const happy = st.happyT ? Math.max(0, 1 - (now - st.happyT) / 1600) : 0;
    if (now > (st.earNext || 0)) { st.earT = now; st.earSide = Math.floor(Math.random() * 2); st.earNext = now + 2500 + Math.random() * 4500; }
    const et = (now - (st.earT || -1e9)) / 280;
    P.ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * ((i === st.earSide && et < 1 ? Math.sin(et * Math.PI * 2) * 0.4 : 0) + happy * 0.25 * Math.sin(now / 45)); });
    P.tail.position.x = happy * 0.14 * Math.sin(now / 40);
    P.blush.forEach((b) => b.scale.set(1 + happy * 0.8, (1 + happy * 0.8) * 0.7, 0.4));
    if (st.tapBear && now - st.tapBear < 800) {
      const t = (now - st.tapBear) / 1000, j = Math.exp(-t * 6) * Math.cos(t * 28) * 0.24;
      root.scale.set(1 + j * 0.6, 1 - j, 1 + j * 0.6);
    }
    patHeart.visible = !!st.happyT && now - st.happyT < 1300 && !st.sleeping;
    if (patHeart.visible) {
      const u = (now - st.happyT) / 1300;
      patHeart.position.set(root.position.x + 0.75, 3.1 + u * 1.1, 0.6); patHeart.scale.setScalar(0.6 * Math.min(1, u * 6)); patHeart.material.opacity = 1 - u * u;
    }
    // asleep: it sits down, legs out, and nods off; Zs drift up
    if (st.sleeping) {
      P.legL.rotation.x = P.legR.rotation.x = -1.35; root.position.y = -0.28; P.body.rotation.x = -0.1;
      P.armL.rotation.x = P.armR.rotation.x = -0.35; P.head.rotation.x = 0.32 + 0.12 * Math.sin(now / 950);
    }
    zees.forEach((z, i) => {
      z.visible = st.sleeping && now - st.sleepT > 600;
      if (!z.visible) return;
      const u = (now / 2600 + i / 3) % 1;
      z.position.set(root.position.x + 0.6 + u * 0.7 + 0.08 * Math.sin(u * 9), 2.9 + u * 1.4, 0.4); z.scale.setScalar(0.28 + u * 0.4); z.material.opacity = Math.sin(u * Math.PI);
    });
    // woken up: a big yawn and a stretch
    const yawn = st.wakeT && now - st.wakeT < 1400 ? Math.sin((now - st.wakeT) / 1400 * Math.PI) : 0;
    if (yawn > 0) {
      P.armL.rotation.z = -0.2 - 2.5 * yawn; P.armR.rotation.z = 0.2 + 2.5 * yawn; P.armL.rotation.x = P.armR.rotation.x = -0.2 * yawn;
      P.head.rotation.x = -0.3 * yawn; root.scale.y *= 1 + 0.07 * yawn;
    }
    P.mouth.visible = yawn > 0.25 || laugh > 0; P.smile.visible = !P.mouth.visible;
    P.mouth.scale.set(laugh ? 1.35 : 1, laugh ? 1.1 : 1.25, 0.45);                  // a big open laugh
    // the comic mark: ! when it finds something, ? when puzzled
    const mk = markCh || (st.mark && now - st.mark.t0 < st.mark.dur ? st.mark.ch : null);
    if (mk !== st.markOn) { st.markOn = mk; st.markSince = now; }
    mark.visible = !!mk && !st.sleeping;
    if (mark.visible) {
      mark.material.map = glyph(mk, mk === '?' ? '#3b6fd8' : '#e8590c');
      const a = (now - st.markSince) / 180;
      mark.position.set(root.position.x + 1.0, 3.05 + 0.04 * Math.sin(now / 120), 0.4);
      mark.scale.setScalar(0.85 * (a < 1 ? Math.sin(a * Math.PI / 2) * (1 + 0.35 * Math.sin(a * Math.PI)) : 1));
    }
    // blink, or keep the eyes shut while asleep
    let ey = 1;
    if (st.sleeping) ey = 0.12;
    else if (now > st.blinkT) { ey = 0.1; if (now > st.blinkT + 130) st.blinkT = now + 2400 + Math.random() * 2800; }
    if (yawn > 0.25) ey = 0.12;                                   // squeezed shut mid-yawn
    P.eyes.children.forEach((e, i) => { e.scale.y = wink && i === 0 && !st.sleeping ? 0.12 : ey; const b = i === 1 ? 1 + 0.9 * eyeBig : 1; e.scale.x = e.scale.z = b; e.scale.y *= b; });
    // video corruptions: the frame itself degrades (blur, blocks, washed-out colours)
    if (vfx !== st.vfx) {
      st.vfx = vfx;
      if ((vfx === 'pixel') !== (st.pixelOn || false)) { st.pixelOn = vfx === 'pixel'; renderer.setPixelRatio(st.pixelOn ? 0.16 : dpr); }
      canvas.style.imageRendering = vfx === 'pixel' ? 'pixelated' : '';
      canvas.style.filter = { motion: 'blur(1.6px)', defocus: 'blur(3px)', contrast: 'contrast(0.45) saturate(0.5) brightness(1.15)', flash: 'brightness(1.7)',
        summer: 'brightness(1.12) saturate(1.35)', unseen: 'hue-rotate(150deg) saturate(1.6) contrast(1.1)' }[vfx] || '';
    }
    const sh = Math.max(0.35, 1 - Math.max(0, root.position.y) * 0.4);   // shadows shrink and fade as it leaves the ground
    contact.position.x = root.position.x; contact.position.z = root.position.z; contact.scale.setScalar(sh);
    contact.material.opacity = (1 - sink) * (0.4 + 0.4 * sh);
    ground.material.opacity = (1 - sink) * (light < 0.5 ? 0.15 : 0.46);
    renderer.shadowMap.needsUpdate = true;                     // the shadow map, with every layer (props too)
    camera.layers.enableAll(); renderer.setRenderTarget(shadowRT); renderer.render(scene, camera); renderer.setRenderTarget(null);
    if (st.forceYaw != null) root.rotation.y = st.forceYaw;     // ?buddydebug: hold a heading
    facing(Math.cos(root.rotation.y) < 0.35);
    renderer.clear();
    camera.layers.set(0); renderer.render(scene, camera);
    if (maskMat.opacity > 0.01) {                               // the mask: the whole bear, in one flat colour
      renderer.clearStencil(); camera.layers.set(2); scene.overrideMaterial = maskMat; renderer.render(scene, camera); scene.overrideMaterial = null;
    }
    renderer.clearDepth();
    camera.layers.set(1); renderer.render(scene, camera);
    const drawnTop = Math.min(topPx([root, cloud, rankDots, PR.robot, stream].filter((o) => o.visible)), st.act === 'trophy' ? (FY - 4.4 * PX) : CH);
    if (!fixed && st.pos) step(now, moving);

    // place it
    let left, top, pos;
    if (fixed) {
      const f = document.querySelector('footer.fixed-bottom'), fh = f ? f.getBoundingClientRect().height : 0;
      canvas.style.position = bubble.style.position = 'fixed';
      const vw = document.documentElement.clientWidth;
      if (st.fx == null) st.fx = vw - 60;
      st.fx = Math.max(50, Math.min(vw - 50, st.fx));
      left = st.fx - FX; top = innerHeight - fh - CH + (CH - FY) - 2;
      pos = [st.fx, top + FY];
    } else {
      canvas.style.position = bubble.style.position = 'absolute';
      if (!st.pos) { canvas.style.opacity = '0'; return; }
      pos = st.pos; left = pos[0] - FX; top = pos[1] - FY;
    }
    const small = compact();
    st.at = { fixed, foot: [pos[0], pos[1], small ? 0.72 : 1] };
    const pop = st.poof ? Math.min(1, (now - st.poof) / 260) : 1, k = small ? 0.72 : 1;
    canvas.style.opacity = String(pop);
    const jx = st.vfx === 'motion' ? Math.sin(now / 18) * 5 : 0;                    // motion blur: a fast shake
    canvas.style.transform = `translate(${left + jx}px, ${top}px) scale(${(0.6 + 0.4 * pop) * k})`;
    if (holeK > 0.01 && holeAt && !fixed) {
      hole.style.display = 'block';
      hole.style.transform = `translate(${holeAt[0]}px, ${holeAt[1]}px) scale(${holeK})`;
    } else hole.style.display = 'none';
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
