// pub-fig.js: interactive publication figures, drawn like a drafting sheet
// (after kdwonn.github.io) in the site's own colours: its paper, ink and
// accent, red only for errors, small uppercase labels. Mounts on every
// <canvas data-fig-scene="...">; each scene draws on a 320x180 board that
// is letterboxed into the canvas. Figures hold still and move only under
// the cursor.
//   scenes: selfcomp, testdg, garasam
(function () {
  if (window.__pubFig) return;
  window.__pubFig = true;

  const W = 320, H = 180, TAU = Math.PI * 2;

  // ---------------------------------------------------------------- math
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const approach = (dt, rate) => 1 - Math.exp(-dt * rate);
  function hash(n) {                          // deterministic 0..1 from an integer
    n = (n | 0) ^ 0x9e3779b9;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  // ---------------------------------------------------------------- theme
  // The site's own palette: its paper, text and accent colours and its
  // font, so the figures sit on the page like the rest of it. Only the
  // error colour and the domain pigments are added.
  let theme = null, themeAt = 0;
  function readTheme(now) {
    if (theme && now - themeAt < 400) return theme;
    themeAt = now;
    const cs = getComputedStyle(document.documentElement);
    const v = (n, d) => cs.getPropertyValue(n).trim() || d;
    const bg = v('--global-bg-color', '#faf0eb');
    const m = bg.match(/^#?([0-9a-f]{6})$/i);
    const lum = m ? parseInt(m[1].slice(0, 2), 16) * 0.3 + parseInt(m[1].slice(2, 4), 16) * 0.59 + parseInt(m[1].slice(4, 6), 16) * 0.11 : 240;
    const dark = lum < 110;
    theme = {
      dark, bg,
      ink: v('--global-text-color', '#2a2422'),
      mute: v('--global-text-color-light', '#7a6b66'),
      faint: v('--global-divider-color', '#ead9d0'),
      grid: v('--global-divider-color', '#ead9d0'),
      acc: v('--global-theme-color', '#2563eb'),
      bad: dark ? '#ff6b5e' : '#c0392b',
      pig: dark ? ['#8fb4ff', '#5fd0b8', '#f2c46b', '#c9a8ff', '#f6a6cf'] : ['#3b6fd8', '#12897a', '#c2841a', '#8a4fd1', '#b8327a'],
      font: getComputedStyle(document.body).fontFamily || 'Inter, sans-serif',
    };
    return theme;
  }

  // ---------------------------------------------------------------- pen
  function makePen(ctx, T, k, small) {
    const P = { T, small, k, ctx };
    const lw = (w) => Math.max(w, 1 / k);     // never thinner than a device pixel
    P.line = (pts, o = {}) => {
      if (pts.length < 2) return;
      ctx.save();
      ctx.strokeStyle = o.color || T.ink;
      ctx.lineWidth = lw(o.w ?? 1.2);
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.lineCap = o.cap || 'round';
      ctx.lineJoin = 'round';
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
      ctx.restore();
    };
    P.head = (tip, ang, o = {}) => {
      const h = o.head ?? 6, hw = h * 0.38, b = [tip[0] - h * Math.cos(ang), tip[1] - h * Math.sin(ang)];
      ctx.save();
      ctx.fillStyle = o.color || T.ink;
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.beginPath();
      ctx.moveTo(tip[0], tip[1]);
      ctx.lineTo(b[0] - hw * Math.sin(ang), b[1] + hw * Math.cos(ang));
      ctx.lineTo(b[0] + hw * Math.sin(ang), b[1] - hw * Math.cos(ang));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    // a dimension line: the gap between a and b, arrowheads at both ends
    P.dim = (a, b, o = {}) => {
      const L = dist(a, b);
      if (L < 3) return;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), h = Math.min(5, L / 3);
      P.line([a, b], { w: 1, color: o.color });
      P.head(b, ang, { color: o.color, head: h });
      P.head(a, ang + Math.PI, { color: o.color, head: h });
    };
    P.circle = (c, r, o = {}) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(c[0], c[1], r, 0, TAU);
      if (o.fill) { ctx.globalAlpha = o.fillAlpha ?? 1; ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.w !== 0) {
        ctx.globalAlpha = o.alpha ?? 1;
        ctx.strokeStyle = o.color || T.ink;
        ctx.lineWidth = lw(o.w ?? 1.2);
        if (o.dash) ctx.setLineDash(o.dash);
        ctx.stroke();
      }
      ctx.restore();
    };
    P.rect = (x, y, w, h, o = {}) => {
      ctx.save();
      if (o.fill) { ctx.globalAlpha = o.fillAlpha ?? 1; ctx.fillStyle = o.fill; ctx.fillRect(x, y, w, h); }
      if (o.w !== 0) {
        ctx.globalAlpha = o.alpha ?? 1;
        ctx.strokeStyle = o.color || T.ink;
        ctx.lineWidth = lw(o.w ?? 1.2);
        if (o.dash) ctx.setLineDash(o.dash);
        ctx.strokeRect(x, y, w, h);
      }
      ctx.restore();
    };
    // small mono label; o.detail: only when the figure is shown large
    P.text = (str, x, y, o = {}) => {
      if (o.detail && small) return 0;
      const size = o.size ?? 7;
      const s = o.keepCase ? str : str.toUpperCase();
      ctx.save();
      ctx.font = `${o.bold ? 700 : 500} ${size}px ${T.font}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = o.keepCase ? '0px' : `${(size * 0.1).toFixed(2)}px`;
      ctx.fillStyle = o.color || T.mute;
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(s, x, y);
      const wd = ctx.measureText(s).width;
      ctx.restore();
      return wd;
    };
    P.target = (c, r, o = {}) => {
      const col = o.color || T.ink;
      P.circle(c, r, { w: 1.3, color: col, fill: T.bg });
      const e = r + 4;
      P.line([[c[0] - e, c[1]], [c[0] + e, c[1]]], { w: 1, color: col });
      P.line([[c[0], c[1] - e], [c[0], c[1] + e]], { w: 1, color: col });
    };
    P.star = (c, r, o = {}) => {
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
        i ? ctx.lineTo(c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)) : ctx.moveTo(c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a));
      }
      ctx.closePath();
      ctx.fillStyle = o.fill || T.bg; ctx.fill();
      ctx.strokeStyle = o.color || T.ink; ctx.lineWidth = lw(o.w ?? 1.2); ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    };
    P.check = (x, y, s, o = {}) => P.line([[x - 4 * s, y], [x - 1.2 * s, y + 3 * s], [x + 4.5 * s, y - 4 * s]], { w: 1.6, ...o });
    P.cross = (x, y, s, o = {}) => {
      P.line([[x - 3.2 * s, y - 3.2 * s], [x + 3.2 * s, y + 3.2 * s]], { w: 1.6, ...o });
      P.line([[x + 3.2 * s, y - 3.2 * s], [x - 3.2 * s, y + 3.2 * s]], { w: 1.6, ...o });
    };
    P.dots = (x0, y0, x1, y1, pitch) => {
      ctx.save();
      ctx.fillStyle = T.grid;
      const d = 1.2 / k;
      for (let x = x0; x <= x1 + 0.1; x += pitch)
        for (let y = y0; y <= y1 + 0.1; y += pitch) ctx.fillRect(x - d / 2, y - d / 2, d, d);
      ctx.restore();
    };
    // registration marks in two corners, as on a drafting sheet
    P.marks = () => {
      if (small) return;
      for (const [x, y] of [[9, 9], [W - 9, H - 9]]) {
        P.line([[x - 3.5, y], [x + 3.5, y]], { w: 0.9, color: T.faint });
        P.line([[x, y - 3.5], [x, y + 3.5]], { w: 0.9, color: T.faint });
      }
    };
    return P;
  }

  // ---------------------------------------------------------------- photos
  // A small photo of one scene (sky, sun, hill, house, tree) under a
  // corruption, rendered once off screen and cached. The corruptions are
  // applied pixel by pixel the way the benchmarks' corruptions look.
  const PHOTO_W = 120, PHOTO_H = 70, photos = new Map();
  // the house in the photo, in 0..1 photo coordinates (for masks)
  const HOUSE = { wall: [0.3, 0.44, 0.28, 0.26], roof: [[0.26, 0.46], [0.44, 0.26], [0.62, 0.46]] };
  function photo(name) {
    if (photos.has(name)) return photos.get(name);
    const PW = PHOTO_W, PH = PHOTO_H;
    let seed = 1234;
    for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const gauss = () => { const u = Math.max(1e-6, rand()), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
    const c = document.createElement('canvas'); c.width = PW; c.height = PH;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, PH * 0.7); sky.addColorStop(0, '#8fc3ee'); sky.addColorStop(1, '#dcefff');
    g.fillStyle = sky; g.fillRect(0, 0, PW, PH);
    g.fillStyle = '#ffd35a'; g.beginPath(); g.arc(PW * 0.82, PH * 0.2, PH * 0.1, 0, TAU); g.fill();
    g.fillStyle = '#8cc56f'; g.beginPath(); g.moveTo(0, PH * 0.72); g.quadraticCurveTo(PW * 0.35, PH * 0.52, PW, PH * 0.66); g.lineTo(PW, PH); g.lineTo(0, PH); g.fill();
    g.fillStyle = '#5f9e4c'; g.beginPath(); g.moveTo(0, PH * 0.86); g.quadraticCurveTo(PW * 0.6, PH * 0.74, PW, PH * 0.84); g.lineTo(PW, PH); g.lineTo(0, PH); g.fill();
    const [wx, wy, ww, wh] = HOUSE.wall;
    g.fillStyle = '#f3e7d2'; g.fillRect(PW * wx, PH * wy, PW * ww, PH * wh);
    g.fillStyle = '#c8553d'; g.beginPath(); HOUSE.roof.forEach(([fx, fy], i) => (i ? g.lineTo(PW * fx, PH * fy) : g.moveTo(PW * fx, PH * fy))); g.fill();
    g.fillStyle = '#6b4f3a'; g.fillRect(PW * 0.41, PH * 0.56, PW * 0.07, PH * 0.14);
    g.fillStyle = '#7a5a3c'; g.fillRect(PW * 0.72, PH * 0.5, PW * 0.025, PH * 0.16);
    g.fillStyle = '#3f7d3a'; g.beginPath(); g.arc(PW * 0.733, PH * 0.44, PH * 0.12, 0, TAU); g.fill();
    const img = g.getImageData(0, 0, PW, PH), px = img.data, src = name === 'blur' ? new Uint8ClampedArray(px) : null;
    for (let i = 0; i < px.length; i += 4) {
      const y = Math.floor(i / 4 / PW) / PH;
      let r = px[i], gg = px[i + 1], b = px[i + 2];
      if (name === 'gaussian') { r += 42 * gauss(); gg += 42 * gauss(); b += 42 * gauss(); }
      if (name === 'shot') { r += 12 * gauss(); gg += 12 * gauss(); b += 12 * gauss(); }
      if (name === 'fog') { const a = 0.5 + 0.3 * (1 - y) + 0.08 * Math.sin(i * 0.0007 + y * 9); r = lerp(r, 214, a); gg = lerp(gg, 220, a); b = lerp(b, 226, a); }
      if (name === 'snow') { r = r * 0.75 + 20; gg = gg * 0.78 + 24; b = b * 0.82 + 34; }
      if (name === 'bright') { r = 120 + r * 0.6; gg = 120 + gg * 0.6; b = 120 + b * 0.6; }
      if (name === 'rain') { r = r * 0.82 + 10; gg = gg * 0.84 + 12; b = b * 0.88 + 18; }
      if (name === 'night') { r = r * 0.22 + 8 * gauss(); gg = gg * 0.26 + 8 * gauss(); b = b * 0.4 + 10 + 8 * gauss(); }
      if (name === 'blur') {                       // horizontal motion blur
        const x = (i / 4) % PW, row = i - x * 4;
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (let k = -7; k <= 7; k++) { const xx = clamp(x + k, 0, PW - 1), j = row + xx * 4; sr += src[j]; sg += src[j + 1]; sb += src[j + 2]; n++; }
        r = sr / n; gg = sg / n; b = sb / n;
      }
      px[i] = clamp(r, 0, 255); px[i + 1] = clamp(gg, 0, 255); px[i + 2] = clamp(b, 0, 255);
    }
    g.putImageData(img, 0, 0);
    if (name === 'shot') {                        // sparse, saturated photon speckles
      for (let k = 0; k < 150; k++) {
        const hue = Math.floor(rand() * 360), sz = 1.5 + rand() * 1.5;
        g.fillStyle = rand() < 0.3 ? '#111' : `hsl(${hue},95%,${55 + rand() * 25}%)`;
        g.fillRect(rand() * PW, rand() * PH, sz, sz);
      }
    }
    if (name === 'rain') {                        // long, thin, slanted streaks
      g.strokeStyle = 'rgba(235,240,255,.75)'; g.lineWidth = 0.8;
      for (let k = 0; k < 120; k++) { const x0 = rand() * PW * 1.2 - 10, y0 = rand() * PH, l = 7 + rand() * 9; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + l * 0.28, y0 + l); g.stroke(); }
    }
    if (name === 'snow') {
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1;
      for (let k = 0; k < 90; k++) { const x0 = rand() * PW, y0 = rand() * PH, l = 2 + rand() * 4; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + l * 0.45, y0 + l); g.stroke(); }
      g.fillStyle = '#ffffff';
      for (let k = 0; k < 70; k++) { g.beginPath(); g.arc(rand() * PW, rand() * PH, 0.7 + rand() * 1.3, 0, TAU); g.fill(); }
    }
    if (name === 'pixelate') {                     // heavy pixelation
      const bs = 10, im2 = g.getImageData(0, 0, PW, PH), q = im2.data;
      for (let by = 0; by < PH; by += bs) for (let bx = 0; bx < PW; bx += bs) {
        const j = ((by + bs / 2 | 0) * PW + (bx + bs / 2 | 0)) * 4;
        g.fillStyle = `rgb(${q[j]},${q[j + 1]},${q[j + 2]})`; g.fillRect(bx, by, bs, bs);
      }
    }
    photos.set(name, c);
    return c;
  }

  // ---------------------------------------------------------------- selfcomp
  // Taming VLAs under Robot Execution Errors - the paper's Fig. 1a.
  // The arm is to reach a cup. Before adaptation the command goes to the
  // cup but the robot's execution falls short: the residual (red) and a
  // failed grasp. Online updates from that residual shift the command
  // (blue) so it pre-compensates; the residual is still there, but now
  // the execution lands on the cup. Still: before (faint) and after.
  // Under the cursor: its x scrubs the online updates, before -> after.
  function selfcompScene() {
    const B = [92, 150], L1 = 84, L2 = 76, TABLE = 158;
    const HOME = [Math.PI / 2 + 0.25, -2.2];
    const BOXX = 196, BOXW = 44, BOXTOP = 112;                // the box the cup stands on
    const CUP = [BOXX + BOXW / 2, BOXTOP];                    // cup base centre
    const GRASP = [CUP[0], CUP[1] - 11];                      // where the gripper must arrive
    const toWorld = (p) => [p[0] - B[0], B[1] - p[1]];
    const toScreen = (p) => [B[0] + p[0], B[1] - p[1]];
    function fk(q) {
      const e = [L1 * Math.cos(q[0]), L1 * Math.sin(q[0])], a = q[0] + q[1];
      return { elbow: toScreen(e), ee: toScreen([e[0] + L2 * Math.cos(a), e[1] + L2 * Math.sin(a)]), a };
    }
    function ik(p) {
      const [x, y] = toWorld(p);
      const c2 = clamp((x * x + y * y - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
      const q2 = -Math.acos(c2);
      return [Math.atan2(y, x) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2)), q2];
    }
    // execution errors: friction shortfall, gravity sag, a joint offset
    function executed(qc, u = 1) {
      const q = [HOME[0] + (qc[0] - HOME[0]) * u * 0.9, HOME[1] + (qc[1] - HOME[1]) * u * 0.9];
      const q12 = q[0] + q[1];
      return [q[0] - u * (0.2 * Math.cos(q[0]) + 0.1 * Math.cos(q12)), q[1] - u * 0.12 * Math.cos(q12) + 0.06 * u];
    }
    const landed = (aim) => fk(executed(ik(aim))).ee;
    // the fully adapted aim: iterate on the residual until execution lands on GRASP
    const AIM = (() => {
      let aim = GRASP.slice();
      for (let i = 0; i < 40; i++) {
        const e = landed(aim);
        aim = [aim[0] - 0.7 * (e[0] - GRASP[0]), aim[1] - 0.7 * (e[1] - GRASP[1])];
      }
      return aim;
    })();
    const s = { p: 1 };

    function reachPath(qc, exec) {
      const pts = [];
      for (let i = 0; i <= 28; i++) {
        const v = i / 28;
        pts.push(fk(exec ? executed(qc, v) : [HOME[0] + (qc[0] - HOME[0]) * v, HOME[1] + (qc[1] - HOME[1]) * v]).ee);
      }
      return pts;
    }
    function arm(P, q, o = {}) {
      const T = P.T, K = fk(q);
      if (o.ghost) { P.line([B, K.elbow, K.ee], { w: 1.2, color: T.acc, dash: [3, 2.5], cap: 'butt', alpha: o.alpha ?? 0.9 }); return K; }
      P.line([B, K.elbow, K.ee], { w: 3, color: T.ink, alpha: o.alpha ?? 1 });
      const gd = [Math.cos(-K.a), Math.sin(-K.a)], gn = [-gd[1], gd[0]], open = o.closed ? 3 : 5;
      for (const sg of [-1, 1]) {
        const b = [K.ee[0] + gn[0] * open * sg, K.ee[1] + gn[1] * open * sg];
        P.line([K.ee, b, [b[0] + gd[0] * 6, b[1] + gd[1] * 6]], { w: 1.6, color: T.ink, alpha: o.alpha ?? 1 });
      }
      if (!o.alpha || o.alpha > 0.5) for (const [c, r] of [[B, 3.6], [K.elbow, 3.2]]) P.circle(c, r, { w: 1.4, color: T.ink, fill: T.bg });
      return K;
    }
    const arrow = (P, a, b, color) => {
      if (dist(a, b) < 4) return;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      P.line([a, [b[0] - 3 * Math.cos(ang), b[1] - 3 * Math.sin(ang)]], { w: 1.3, color });
      P.head(b, ang, { color, head: 5 });
    };
    function cup(P, ok) {
      const T = P.T, [x, y] = CUP;
      P.rect(BOXX, BOXTOP, BOXW, TABLE - BOXTOP, { w: 1.2, color: T.ink, fill: T.bg });
      P.line([[x - 7, y], [x - 8.5, y - 14], [x + 8.5, y - 14], [x + 7, y], [x - 7, y]], { w: 1.3, color: ok ? T.acc : T.ink });
      P.line([[x + 8, y - 11], [x + 12, y - 9], [x + 12, y - 5], [x + 7.6, y - 4]], { w: 1.1, color: ok ? T.acc : T.ink });
    }
    // one state of adaptation p in [0, 1]
    function state(p) {
      const aim = [lerp(GRASP[0], AIM[0], p), lerp(GRASP[1], AIM[1], p)], qc = ik(aim);
      const X = fk(executed(qc)).ee;
      return { aim, qc, X, ok: dist(X, GRASP) < 3.5 };
    }

    return {
      sticky: true,
      idle: () => null,
      draw(P, st) {
        const T = P.T;
        P.marks();
        P.dots(16, 16, W - 16, TABLE - 8, 12);
        P.line([[16, TABLE], [W - 16, TABLE]], { w: 1.1, color: T.ink });
        for (let x = 20; x < W - 16; x += 6) P.line([[x, TABLE], [x - 4, TABLE + 4]], { w: 0.7, color: T.faint });
        P.rect(B[0] - 10, B[1] - 1, 20, TABLE - B[1] + 1, { w: 1.3, color: T.ink, fill: T.bg });

        // how far online adaptation has gone: the cursor's x, else fully adapted
        const want = st.idle ? 1 : clamp((st.ptr[0] - 40) / (W - 80), 0, 1);
        s.p = lerp(s.p, want, approach(st.dt || 0.016, 12));
        const now = state(s.p), before = state(0);

        if (st.idle) {
          // the failed first attempt, faint
          arm(P, executed(before.qc), { alpha: 0.22 });
          P.cross(before.X[0], before.X[1], 0.85, { color: T.bad, w: 1.4, alpha: 0.7 });
        }
        P.line(reachPath(now.qc, false), { w: 1.1, color: T.acc, dash: [1.5, 3] });
        P.line(reachPath(now.qc, true), { w: 1.1, color: T.ink, alpha: 0.6 });
        cup(P, now.ok);
        arm(P, now.qc, { ghost: true });
        arm(P, executed(now.qc), { closed: now.ok });
        P.circle(now.aim, 2.4, { w: 1.2, color: T.acc, fill: T.bg });
        arrow(P, now.aim, now.X, T.bad);                         // residual: executed vs commanded
        if (now.ok) P.check(GRASP[0] + 16, GRASP[1] - 12, 1.1, { color: T.acc, w: 1.8 });
        else P.cross(GRASP[0] + 16, GRASP[1] - 12, 1, { color: T.bad, w: 1.8 });

        // legend
        if (!P.small) {
          P.line([[16, 16], [28, 16]], { w: 1.2, color: T.acc, dash: [3, 2.5], cap: 'butt' });
          P.text('command', 32, 16, { size: 6.5, color: T.acc });
          P.line([[82, 16], [94, 16]], { w: 2.4, color: T.ink });
          P.text('execution', 98, 16, { size: 6.5, color: T.ink });
          P.line([[152, 16], [164, 16]], { w: 1.3, color: T.bad });
          P.text('residual', 168, 16, { size: 6.5, color: T.bad });
        }
        // the adaptation scale, drawn only while scrubbing
        if (!st.idle) {
          const y = H - 8, x0 = 40, x1 = W - 40, xp = lerp(x0, x1, s.p);
          P.line([[x0, y], [x1, y]], { w: 1, color: T.faint });
          P.line([[x0, y], [xp, y]], { w: 1.6, color: T.acc });
          P.circle([xp, y], 2.6, { fill: T.acc, w: 0 });
          P.text('before', x0 - 4, y, { size: 6, align: 'right', detail: true });
          P.text('online update', x1 + 4, y, { size: 6, detail: true });
        }
      },
    };
  }

  // ---------------------------------------------------------------- testdg
  // TestDG: test-time domain generalization for continual TTA.
  // Top: the test stream - unlabeled images whose corruption keeps
  // changing, the last kind never seen; the cursor's x is "now". Below,
  // the model adapts online as the stream goes, and each board shows the
  // domain embeddings of every domain seen so far. Prior CTTA adapts to
  // the domain at hand, so each domain sits apart and a new one lands
  // somewhere new. TestDG pulls the current domain onto prototypes of the
  // previous one (diamonds) - domain-invariant learning at test time - so
  // the domains pile up in one region and the next, even unseen, lands
  // there too. Under each board, the error at that moment.
  function testdgScene() {
    const DOMS = ['gaussian', 'shot', 'fog', 'snow', 'bright', 'unseen'];
    const N = DOMS.length, X0 = 16, X1 = W - 16, SEG = (X1 - X0) / N;
    const TY = 9, TW = SEG - 6, TH = 24, LY = TY + TH + 12;
    const BOX = [{ x: 12, name: 'prior ctta' }, { x: 166, name: 'testdg' }], BW = 142, BY = 62, BH = 94;
    const SPOT = [[-42, -20], [40, -22], [-34, 22], [44, 18], [4, -26], [-52, 4]];   // where each domain lands, unadapted
    const PER = 9;
    const rnd = (k) => hash(k * 7919 + 11) - 0.5;
    const s = { u: 0.999 };

    // centre of domain d's embeddings at progress f within it
    function centre(d, f, mine) {
      if (!mine) return SPOT[d];                                   // stays where it landed
      const g = Math.pow(0.5, d);                                  // each domain arrives closer
      const start = [SPOT[d][0] * g, SPOT[d][1] * g];
      const tgt = [0, 0];                                          // the shared region
      const a = 0.85 * ease(clamp(f / 0.6, 0, 1));                 // pulled onto the prototypes
      return [lerp(start[0], tgt[0], a), lerp(start[1], tgt[1], a)];
    }
    const pts = (d, c, n) => Array.from({ length: n }, (_, i) => [c[0] + 15 * rnd(d * 61 + i), c[1] + 11 * rnd(d * 61 + i + 300)]);
    function err(d, f, mine) {
      const base = mine ? [0.36, 0.3, 0.26, 0.24, 0.2, 0.24][d] : [0.6, 0.55, 0.45, 0.5, 0.35, 0.82][d];
      return clamp(base + (d ? (mine ? 0.05 : 0.3) * Math.exp(-f / 0.2) : 0), 0, 1);
    }

    function tile(P, x, y, w, h, d, hot) {
      const T = P.T, ctx = P.ctx;
      ctx.save();
      ctx.imageSmoothingEnabled = DOMS[d] !== 'unseen';
      ctx.drawImage(photo(DOMS[d] === 'unseen' ? 'pixelate' : DOMS[d]), x, y, w, h);
      ctx.restore();
      const col = d === N - 1 ? T.ink : T.pig[d];
      P.rect(x, y, w, h, { w: hot ? 2 : 1.2, color: col, dash: d === N - 1 ? [2.5, 2] : null, alpha: hot ? 1 : 0.85 });
      if (d === N - 1) {
        P.circle([x + w, y], 4.6, { fill: T.ink, w: 0 });
        P.text('?', x + w, y + 0.4, { size: 6.5, color: T.bg, align: 'center', keepCase: true, bold: true });
      }
    }

    return {
      sticky: true,
      idle: () => null,
      draw(P, st) {
        const T = P.T, COL = [...T.pig, T.ink];
        P.marks();
        const want = st.idle ? 0.999 : clamp((st.ptr[0] - X0) / (X1 - X0), 0, 0.999);
        s.u = lerp(s.u, want, approach(st.dt || 0.016, 12));
        const d = Math.min(N - 1, Math.floor(s.u * N)), f = s.u * N - d;

        // the test stream, with "now"
        DOMS.forEach((nm, i) => {
          const x = X0 + i * SEG + 3;
          tile(P, x, TY, TW, TH, i, i === d);
          P.text(nm, x + TW / 2, TY + TH + 6, { size: 5.6, align: 'center', color: i === d ? T.ink : T.mute, detail: true });
        });
        const nx = X0 + s.u * (X1 - X0);
        P.line([[X0, LY], [X1, LY]], { w: 0.8, color: T.faint });
        P.line([[X0, LY], [nx, LY]], { w: 1.6, color: T.ink });
        P.head([nx + 1, LY], 0, { head: 5 });
        P.text('test stream', X1, LY + 7, { size: 5.8, align: 'right', detail: true });

        BOX.forEach((bx, bi) => {
          const mine = bi === 1, cx = bx.x + BW / 2, cy = BY + BH / 2 - 6;
          P.text(bx.name, bx.x + BW / 2, BY - 7, { align: 'center', size: P.small ? 9.5 : 7, color: mine ? T.acc : T.mute, bold: mine });
          P.rect(bx.x, BY, BW, BH, { w: 1.1, color: T.ink });
          P.dots(bx.x + 8, BY + 8, bx.x + BW - 8, BY + BH - 20, 10);
          const at = (c) => [cx + c[0], cy + c[1]];
          // domains already passed, fainter the older
          for (let k = 0; k < d; k++) pts(k, at(centre(k, 1, mine)), PER).forEach((p) => P.circle(p, 2.2, { fill: COL[k], fillAlpha: 0.25 + 0.1 * (k - d + 4), w: 0 }));
          // TestDG keeps a few prototypes of the previous domain
          let protoC = null;
          if (mine && d > 0) {
            const pr = pts(d - 1, at(centre(d - 1, 1, true)), PER).filter((_, i) => i % 3 === 0);
            protoC = pr.reduce((m, p) => [m[0] + p[0] / pr.length, m[1] + p[1] / pr.length], [0, 0]);
            pr.forEach((p) => { const r = 3.8; P.line([[p[0], p[1] - r], [p[0] + r, p[1]], [p[0], p[1] + r], [p[0] - r, p[1]], [p[0], p[1] - r]], { w: 1.3, color: COL[d - 1] }); });
          }
          // the domain at hand, streaming in
          const c = at(centre(d, f, mine)), cur = pts(d, c, Math.max(3, Math.round(PER * clamp(f / 0.35, 0.3, 1))));
          if (protoC && f < 0.55) P.line([c, protoC], { w: 1, color: T.acc, dash: [2, 2], alpha: 1 - f / 0.55 });
          cur.forEach((p) => (d === N - 1 ? P.circle(p, 2.8, { fill: T.bg, color: T.ink, w: 1.2 }) : P.circle(p, 2.8, { fill: COL[d], w: 0 })));
          // error right now
          const e = err(d, f, mine), by = BY + BH - 9, bx0 = bx.x + 34, bw = BW - 44;
          P.text('error', bx.x + 7, by, { size: 6, detail: true });
          P.rect(bx0, by - 2.5, bw, 5, { w: 0, fill: T.faint });
          P.rect(bx0, by - 2.5, bw * e, 5, { w: 0, fill: mine ? T.acc : T.bad, fillAlpha: 0.85 });
        });
      },
    };
  }

  // ---------------------------------------------------------------- garasam
  // GaRA-SAM: robustifying SAM with gated-rank adaptation (the paper's
  // Figs. 1, 3 and 6). Adapters in the frozen SAM are made of rank-1
  // components in a lower-rank and a higher-rank space. For each input a
  // space gate picks one space, and a binary gate lights the subset of its
  // components that input needs, so the effective rank follows the input
  // (e.g. rain stays low, snow goes high), and an unseen corruption is
  // met by a combination of learned components. Frozen SAM's mask breaks
  // up under corruption; GaRA-SAM's holds. The cursor picks the input.
  // Which components light is illustrative.
  function garasamScene() {
    const INS = [
      { name: 'rain', photo: 'rain', hi: false, on: [1, 5, 6], deg: 0.5 },
      { name: 'fog', photo: 'fog', hi: false, on: [2, 4], deg: 0.55 },
      { name: 'noise', photo: 'gaussian', hi: true, on: [0, 2, 3, 5, 6, 8, 9, 11, 13, 14], deg: 0.85 },
      { name: 'snow', photo: 'snow', hi: true, on: [1, 2, 4, 5, 7, 8, 10, 11, 12, 15], deg: 0.75 },
      { name: 'night', photo: 'night', hi: true, on: [0, 3, 4, 6, 7, 9, 12, 13], deg: 0.8 },
      { name: 'unseen', photo: 'blur', hi: false, on: [0, 3, 5, 7], deg: 0.75 },
    ];
    const N = INS.length, KL = 8, KH = 16, X0 = 16, X1 = W - 16, SEG = (X1 - X0) / N;
    const TY = 9, TW = SEG - 6, TH = 24;
    const IMG = { x: 14, y: 62, w: 104, h: 104 * PHOTO_H / PHOTO_W };
    const ADX = 128, ADW = 80, ADY = 62, ADH = 92;
    const OUT = [{ y: 52, name: 'sam' }, { y: 119, name: 'gara-sam' }], OX = 220, OW = 84, OH = 86 * PHOTO_H / PHOTO_W;
    const PROMPT = [0.47, 0.5];                             // the click on the house, photo coords
    const s = { i: 3, glowL: new Array(KL).fill(0), glowH: new Array(KH).fill(0), sp: 1 };

    // is a photo-space point inside the house?
    function inHouse(fx, fy) {
      const [wx, wy, ww, wh] = HOUSE.wall;
      if (fx >= wx && fx <= wx + ww && fy >= wy && fy <= wy + wh) return true;
      const [a, b, c] = HOUSE.roof;
      const sgn = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
      const p = [fx, fy], d1 = sgn(p, a, b), d2 = sgn(p, b, c), d3 = sgn(p, c, a);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    }
    // a mask as a grid of cells; deg breaks it up (holes, spill), seed fixes the pattern
    function mask(P, x, y, w, h, deg, seed, color) {
      const n = 30, m = Math.round(n * h / w), cw = w / n, ch = h / m;
      P.ctx.save();
      P.ctx.fillStyle = color;
      for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
        const fx = (i + 0.5) / n, fy = (j + 0.5) / m, r = hash(seed * 7777 + j * 131 + i);
        const blob = 0.5 + 0.5 * Math.sin(i * 0.9 + seed) * Math.cos(j * 0.8 - seed);   // spatially coherent damage
        const keep = inHouse(fx, fy) ? r > deg * (0.35 + 0.65 * blob) : r < deg * 0.06 * blob;
        if (!keep) continue;
        P.ctx.globalAlpha = 0.55;
        P.ctx.fillRect(x + i * cw, y + j * ch, cw + 0.3, ch + 0.3);
      }
      P.ctx.restore();
    }
    // one rank-1 component, drawn as an hourglass (as in the paper)
    function comp(P, c, s, on, glow) {
      const T = P.T, [x, y] = c;
      const pts = [[x - s, y - s], [x + s, y - s], [x - s, y + s], [x + s, y + s], [x - s, y - s]];
      if (glow > 0.02) {
        P.ctx.save(); P.ctx.globalAlpha = 0.85 * glow; P.ctx.fillStyle = T.acc;
        P.ctx.beginPath(); P.ctx.moveTo(x - s, y - s); P.ctx.lineTo(x + s, y - s); P.ctx.lineTo(x, y); P.ctx.closePath(); P.ctx.fill();
        P.ctx.beginPath(); P.ctx.moveTo(x - s, y + s); P.ctx.lineTo(x + s, y + s); P.ctx.lineTo(x, y); P.ctx.closePath(); P.ctx.fill();
        P.ctx.restore();
      }
      P.line(pts, { w: 1.1, color: on ? T.acc : T.mute, alpha: on ? 1 : 0.5 });
    }

    return {
      sticky: true,
      idle: () => null,
      draw(P, st) {
        const T = P.T;
        P.marks();
        if (!st.idle) s.i = clamp(Math.floor((st.ptr[0] - X0) / SEG), 0, N - 1);
        const inp = INS[s.i], dt = st.dt || 0.016;
        const kk = approach(dt, 10);
        for (let k = 0; k < KL; k++) s.glowL[k] = lerp(s.glowL[k], !inp.hi && inp.on.includes(k) ? 1 : 0, kk);
        for (let k = 0; k < KH; k++) s.glowH[k] = lerp(s.glowH[k], inp.hi && inp.on.includes(k) ? 1 : 0, kk);
        s.sp = lerp(s.sp, inp.hi ? 1 : 0, kk);

        // the inputs
        INS.forEach((it, i) => {
          const x = X0 + i * SEG + 3, hot = i === s.i;
          P.ctx.drawImage(photo(it.photo), x, TY, TW, TH);
          P.rect(x, TY, TW, TH, { w: hot ? 2 : 1, color: hot ? T.acc : T.ink, alpha: hot ? 1 : 0.6, dash: it.name === 'unseen' ? [2.5, 2] : null });
          P.text(it.name, x + TW / 2, TY + TH + 6, { size: 5.8, align: 'center', color: hot ? T.ink : T.mute, detail: true });
        });

        // the chosen input with its prompt point
        P.ctx.drawImage(photo(inp.photo), IMG.x, IMG.y, IMG.w, IMG.h);
        P.rect(IMG.x, IMG.y, IMG.w, IMG.h, { w: 1.2, color: T.ink });
        const pp = [IMG.x + PROMPT[0] * IMG.w, IMG.y + PROMPT[1] * IMG.h];
        P.star(pp, 4.2, { fill: '#ffd35a', color: '#1b1b1b', w: 1 });
        P.text('input + prompt', IMG.x, IMG.y - 6, { size: 6, detail: true });

        // the adapter inside frozen SAM: components, gated by the input
        P.rect(ADX, ADY, ADW, ADH, { w: 1.1, color: T.ink, dash: [3, 2] });
        P.text('frozen sam', ADX + ADW / 2, ADY - 6, { size: 6, align: 'center', detail: true });
        P.text('gara', ADX + ADW / 2, ADY + 10, { size: P.small ? 9 : 7, align: 'center', color: T.acc, bold: true });
        // the space gate picks a row; the binary gate lights components in it
        const rows = [{ y: ADY + 32, n: KL, r: 3.3, gl: s.glowL, on: !inp.hi, label: 'lower' }, { y: ADY + 62, n: KH, r: 2.6, gl: s.glowH, on: inp.hi, label: 'higher' }];
        rows.forEach((rw) => {
          const span = ADW - 12, step = span / (rw.n <= 8 ? rw.n : rw.n / 2);
          for (let k = 0; k < rw.n; k++) {
            const col = rw.n <= 8 ? k : k % (rw.n / 2), row = rw.n <= 8 ? 0 : Math.floor(k / (rw.n / 2));
            comp(P, [ADX + 6 + step * (col + 0.5), rw.y + row * 8 - (rw.n > 8 ? 4 : 0)], rw.r, rw.on && inp.on.includes(k), rw.gl[k]);
          }
          if (!rw.on) P.rect(ADX + 4, rw.y - 11, ADW - 8, 22, { w: 0, fill: T.bg, fillAlpha: 0.55 });
          P.text(rw.label, ADX + 5, rw.y - 14, { size: 5.5, color: rw.on ? T.acc : T.mute, detail: true });
        });
        // the space gate, drawn as a switch pointing at the chosen row
        const sy = lerp(rows[0].y, rows[1].y, s.sp);
        P.circle([ADX - 8, ADY + ADH / 2], 1.8, { fill: T.ink, w: 0 });
        P.line([[ADX - 8, ADY + ADH / 2], [ADX - 1, sy]], { w: 1.4, color: T.acc });
        P.head([ADX + 2, sy], Math.atan2(sy - ADY - ADH / 2, 9), { color: T.acc, head: 4.5 });
        P.text(inp.hi ? 'high rank' : 'low rank', ADX + ADW / 2, ADY + ADH - 9, { size: P.small ? 9 : 7, align: 'center', color: T.acc });
        // input -> gate -> adapter
        P.line([[IMG.x + IMG.w + 1, IMG.y + IMG.h / 2], [ADX - 8, ADY + ADH / 2]], { w: 1, color: T.ink });
        P.text('gate', ADX - 8, ADY + ADH / 2 + 8, { size: 5.5, align: 'center', detail: true });

        // masks: frozen SAM vs GaRA-SAM
        OUT.forEach((o, oi) => {
          const mine = oi === 1, deg = mine ? inp.deg * 0.06 : inp.deg;
          P.ctx.save(); P.ctx.globalAlpha = 0.35; P.ctx.drawImage(photo(inp.photo), OX, o.y, OW, OH); P.ctx.restore();
          mask(P, OX, o.y, OW, OH, deg, s.i * 3 + oi + 1, mine || deg < 0.3 ? T.acc : T.bad);
          P.rect(OX, o.y, OW, OH, { w: 1.1, color: T.ink });
          P.text(o.name, OX, o.y - 6, { size: P.small ? 8.5 : 6.5, color: mine ? T.acc : T.mute, bold: mine });
          const good = deg < 0.3;
          if (good) P.check(OX + OW - 8, o.y - 6, 0.75, { color: T.acc, w: 1.6 });
          else P.cross(OX + OW - 8, o.y - 6, 0.75, { color: T.bad, w: 1.6 });
        });
      },
    };
  }

  const SCENES = { selfcomp: selfcompScene, testdg: testdgScene, garasam: garasamScene };
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  // ---------------------------------------------------------------- mount
  function mount(canvas, opts = {}) {
    const make = SCENES[canvas.dataset.figScene];
    if (!make) return null;
    const scene = make();
    const ctx = canvas.getContext('2d');
    const st = { t: 0, ptr: [W * 0.6, H * 0.4], target: [W * 0.6, H * 0.4], hover: false, lastMove: -1e9 };
    if (scene.init) scene.init(st);
    let view = { k: 1, ox: 0, oy: 0, cw: 0, ch: 0, dpr: 1 }, visible = true, last = performance.now();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth, ch = canvas.clientHeight || cw * H / W;
      canvas.width = Math.max(1, Math.round(cw * dpr));
      canvas.height = Math.max(1, Math.round(ch * dpr));
      const k = Math.min(cw / W, ch / H);
      view = { k, ox: (cw - W * k) / 2, oy: (ch - H * k) / 2, cw, ch, dpr };
    }
    const toLocal = (e) => {
      const b = canvas.getBoundingClientRect();
      const sx = b.width / (view.cw || b.width);
      return [((e.clientX - b.left) / sx - view.ox) / view.k, ((e.clientY - b.top) / sx - view.oy) / view.k];
    };
    const steer = (e) => { st.target = toLocal(e); st.hover = true; st.lastMove = performance.now(); };
    canvas.addEventListener('pointermove', steer);
    canvas.addEventListener('pointerleave', () => { st.hover = false; });
    canvas.addEventListener('pointerdown', steer);
    canvas.addEventListener('click', (e) => {
      if (scene.click && scene.click(toLocal(e), st)) return;
      if (opts.onExpand && e.pointerType !== 'touch' && !matchMedia('(hover: none)').matches) opts.onExpand(canvas);
    });
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    if (window.IntersectionObserver) new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; }).observe(canvas);
    resize();

    function frame(now) {
      if (!canvas.isConnected) return;
      requestAnimationFrame(frame);
      const dt = clamp((now - last) / 1000, 0, 0.05);   // rAF stamps can predate mount
      last = now;
      if (visible && view.cw > 0) {
        // sticky scenes keep the cursor's spot for as long as it stays on the figure
        st.idle = !st.hover || (!scene.sticky && now - st.lastMove > 2500);
        // with reduced motion the figure holds still until the pointer moves it
        if (!(reduceMotion.matches && st.idle)) st.t += dt;
        st.dt = dt;
        if (st.idle) { const it = scene.idle(st.t); if (it) st.target = it; }   // null: keep the last spot
        st.ptr = [lerp(st.ptr[0], st.target[0], approach(dt, st.idle ? 6 : 14)), lerp(st.ptr[1], st.target[1], approach(dt, st.idle ? 6 : 14))];
        const T = readTheme(now);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = T.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(view.k * view.dpr, 0, 0, view.k * view.dpr, view.ox * view.dpr, view.oy * view.dpr);
        try { scene.draw(makePen(ctx, T, view.k, view.cw < 300), st); } catch (err) { console.error(err); }
      }
    }
    requestAnimationFrame(frame);
    return scene;
  }

  // ---------------------------------------------------------------- expand
  // Click (mouse) on an inline figure opens it large, with all its labels.
  function expand(src) {
    const wrap = document.createElement('div');
    wrap.className = 'pub-fig-modal';
    wrap.innerHTML = '<div class="pub-fig-modal-box"><button type="button" class="pub-fig-close" aria-label="Close">&times;</button></div>';
    const c = document.createElement('canvas');
    c.dataset.figScene = src.dataset.figScene;
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', src.getAttribute('aria-label') || '');
    wrap.firstChild.appendChild(c);
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.classList.contains('pub-fig-close')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    c.__pubFig = mount(c) || true;
  }

  function scan() {
    document.querySelectorAll('canvas[data-fig-scene]').forEach((c) => {
      if (!c.__pubFig) c.__pubFig = mount(c, { onExpand: expand }) || true;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
})();
