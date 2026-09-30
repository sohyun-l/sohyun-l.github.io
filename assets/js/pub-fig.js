// pub-fig.js: interactive publication figures (after kdwonn.github.io).
// Mounts on every <canvas data-fig-scene="...">. Each scene draws into a
// fixed 320x180 board that is letterboxed into the canvas; the pointer
// steers the scene, and when nobody is steering it plays by itself.
// Colours come from the site's CSS variables, so light/dark just works.
//   scenes: selfcomp, testdg
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
  let theme = null, themeAt = 0;
  function readTheme(now) {
    if (theme && now - themeAt < 400) return theme;
    themeAt = now;
    const cs = getComputedStyle(document.documentElement);
    const v = (n, d) => cs.getPropertyValue(n).trim() || d;
    const bg = v('--global-bg-color', '#faf0eb');
    // crude luminance test on the page background picks the pigment set
    const m = bg.match(/^#?([0-9a-f]{6})$/i);
    const lum = m ? (parseInt(m[1].slice(0, 2), 16) * 0.3 + parseInt(m[1].slice(2, 4), 16) * 0.59 + parseInt(m[1].slice(4, 6), 16) * 0.11) : 240;
    const dark = lum < 110;
    theme = {
      dark, bg,
      ink: v('--global-text-color', '#2a2422'),
      mute: v('--global-text-color-light', '#7a6b66'),
      line: v('--global-divider-color', '#ead9d0'),
      acc: v('--global-theme-color', '#2563eb'),
      exec: dark ? '#e58bd6' : '#a3308f',   // executed motion (teaser magenta)
      bad: dark ? '#ff7d6e' : '#d0342c',    // action error
      ok: dark ? '#6fd3a8' : '#16845a',     // compensated
      warn: dark ? '#e8b25c' : '#c27a0e',
      violet: dark ? '#b3a2ff' : '#6a4fc4',
      font: getComputedStyle(document.body).fontFamily || 'sans-serif',
    };
    return theme;
  }

  // ---------------------------------------------------------------- pen
  function makePen(ctx, T, k, small) {
    const P = { T, small, k, ctx };
    const minW = 1 / k;
    P.line = (pts, o = {}) => {
      if (pts.length < 2) return;
      ctx.save();
      ctx.strokeStyle = o.color || T.ink;
      ctx.lineWidth = Math.max(o.w ?? 1.2, minW);
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.lineCap = o.cap || 'round';
      ctx.lineJoin = 'round';
      if (o.dash) { ctx.setLineDash(o.dash); ctx.lineDashOffset = o.dashOffset || 0; }
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
      ctx.restore();
    };
    P.arrow = (a, b, o = {}) => {
      const h = o.head ?? 6, ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (dist(a, b) < h * 0.8) return;
      P.line([a, [b[0] - h * 0.5 * Math.cos(ang), b[1] - h * 0.5 * Math.sin(ang)]], o);
      ctx.save();
      ctx.fillStyle = o.color || T.ink;
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - h * Math.cos(ang - 0.42), b[1] - h * Math.sin(ang - 0.42));
      ctx.lineTo(b[0] - h * Math.cos(ang + 0.42), b[1] - h * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    P.circle = (c, r, o = {}) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(c[0], c[1], r, 0, TAU);
      if (o.fill) { ctx.globalAlpha = o.fillAlpha ?? 1; ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.w !== 0) {
        ctx.globalAlpha = o.alpha ?? 1;
        ctx.strokeStyle = o.color || T.ink;
        ctx.lineWidth = Math.max(o.w ?? 1.2, minW);
        if (o.dash) ctx.setLineDash(o.dash);
        ctx.stroke();
      }
      ctx.restore();
    };
    P.rrect = (x, y, w, h, r, o = {}) => {
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
      if (o.fill) { ctx.globalAlpha = o.fillAlpha ?? 1; ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.w !== 0) {
        ctx.globalAlpha = o.alpha ?? 1;
        ctx.strokeStyle = o.color || T.ink;
        ctx.lineWidth = Math.max(o.w ?? 1, minW);
        if (o.dash) ctx.setLineDash(o.dash);
        ctx.stroke();
      }
      ctx.restore();
    };
    // o.detail: only drawn when the figure is shown large enough to read it
    P.text = (str, x, y, o = {}) => {
      if (o.detail && small) return 0;
      const size = o.size ?? 8;
      ctx.save();
      ctx.font = `${o.weight || 500} ${size}px ${T.font}`;
      ctx.fillStyle = o.color || T.mute;
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(str, x, y);
      const wd = ctx.measureText(str).width;
      ctx.restore();
      return wd;
    };
    P.star = (c, r, o = {}) => {
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
        const p = [c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)];
        i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.fillStyle = o.fill || T.bg;
      ctx.fill();
      ctx.strokeStyle = o.color || T.ink;
      ctx.lineWidth = Math.max(o.w ?? 1.3, minW);
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    };
    P.cross = (c, r, o = {}) => {
      P.line([[c[0] - r, c[1] - r], [c[0] + r, c[1] + r]], o);
      P.line([[c[0] + r, c[1] - r], [c[0] - r, c[1] + r]], o);
    };
    P.dots = (x0, y0, x1, y1, pitch) => {
      ctx.save();
      ctx.fillStyle = T.line;
      const s = 1.3 / k;
      for (let x = x0; x <= x1 + 0.1; x += pitch)
        for (let y = y0; y <= y1 + 0.1; y += pitch) ctx.fillRect(x - s / 2, y - s / 2, s, s);
      ctx.restore();
    };
    return P;
  }

  // ---------------------------------------------------------------- selfcomp
  // Taming VLAs under Robot Execution Errors (self-compensating VLA).
  // One idea: the arm keeps reaching for the target. Execution errors
  // (gravity-compensation error, friction, backlash) make the executed
  // reach miss the commanded one; after each try the policy learns from
  // the command-execution residual and pre-compensates the next command,
  // so the miss shrinks try by try. The pointer moves the target, and the
  // arm re-adapts on the fly.
  function selfcompScene() {
    const B = [100, 166], L1 = 92, L2 = 80, TABLE = 170;
    const REACH = 1.1, HOLD = 0.8, BACK = 0.45, TRY = REACH + HOLD + BACK;
    const toWorld = (p) => [p[0] - B[0], B[1] - p[1]];
    const toScreen = (p) => [B[0] + p[0], B[1] - p[1]];
    function fk(q) {
      const e = [L1 * Math.cos(q[0]), L1 * Math.sin(q[0])];
      const a = q[0] + q[1];
      return { elbow: toScreen(e), ee: toScreen([e[0] + L2 * Math.cos(a), e[1] + L2 * Math.sin(a)]), a };
    }
    function ik(p) {
      const [x, y] = toWorld(p);
      const c2 = clamp((x * x + y * y - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
      const q2 = -Math.acos(c2);                  // elbow up
      return [Math.atan2(y, x) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2)), q2];
    }
    // targets stay well inside the workspace, so a pre-compensated command
    // (which aims past the target) still has room
    function reachable(p, margin = 30) {
      let [x, y] = toWorld(p);
      y = Math.max(y, 16);
      const r = Math.hypot(x, y), a = Math.atan2(y, x);
      const rr = clamp(r, 60, L1 + L2 - margin);
      const q = toScreen([rr * Math.cos(a), rr * Math.sin(a)]);
      return margin > 5 ? [clamp(q[0], B[0] + 30, W - 24), clamp(q[1], 22, TABLE - 20)] : q;
    }
    const HOME = [Math.PI / 2 + 0.25, -2.2];      // folded, upright
    // execution errors for a commanded joint configuration: gravity sag
    // (pose dependent), friction shortfall and a backlash offset
    function executed(qh, qc, u) {
      const q = [qh[0] + (qc[0] - qh[0]) * u * 0.9, qh[1] + (qc[1] - qh[1]) * u * 0.9];
      const q12 = q[0] + q[1];
      return [q[0] - u * (0.12 * Math.cos(q[0]) + 0.06 * Math.cos(q12)) - 0.05 * u,
        q[1] - u * 0.1 * Math.cos(q12) + 0.08 * u];
    }
    const TOUR = [[236, 62], [206, 128], [150, 40], [252, 108], [192, 84]];

    const s = { t0: null, off: [0, 0], goal: null, cmd: null, tries: [], tourI: 0, good: 0, marks: [] };
    function startTry(goal) {
      s.goal = goal.slice();
      s.cmd = reachable([goal[0] - s.off[0], goal[1] - s.off[1]], 1);
      s.qc = ik(s.cmd);
    }
    function endTry() {
      const e = fk(executed(HOME, s.qc, 1)).ee;
      const miss = [e[0] - s.goal[0], e[1] - s.goal[1]], m = Math.hypot(miss[0], miss[1]);
      // learn from the residual: pre-compensate the next command
      s.off = [s.off[0] + 0.8 * miss[0], s.off[1] + 0.8 * miss[1]];
      s.tries.push(m);
      if (s.tries.length > 7) s.tries.shift();
      s.marks.push(e);
      if (s.marks.length > 4) s.marks.shift();
      s.good = m < 4 ? s.good + 1 : 0;
    }

    return {
      state: s,
      sticky: true,
      init(st) { st.ptr = TOUR[0].slice(); st.target = TOUR[0].slice(); },
      // hold each target until the arm has hit it twice, then move on
      idle() {
        if (s.good >= 2) { s.tourI = (s.tourI + 1) % TOUR.length; s.good = 0; }
        return TOUR[s.tourI];
      },
      draw(P, st) {
        const T = P.T, t = st.t;
        const goalNow = reachable(st.ptr);
        if (s.t0 === null) { s.t0 = t; startTry(goalNow); }
        let ph = t - s.t0;
        // the target moved mid-reach: give up this try and head back at once
        if (!s.cut && ph > 0.3 && ph < REACH + HOLD && dist(goalNow, s.goal) > 10) {
          s.cut = true; s.t0 = t - (REACH + HOLD); ph = REACH + HOLD;
        }
        if (ph >= TRY) {
          if (!s.cut) endTry();                 // only a finished reach teaches anything
          // a new target: the marks of the old one no longer apply
          if (s.cut || dist(goalNow, s.goal) > 6) { s.marks = []; s.tries = []; }
          s.cut = false; s.t0 = t; ph = 0; startTry(goalNow);
        }
        const u = ph < REACH ? ease(ph / REACH) : ph < REACH + HOLD ? 1 : 1 - ease((ph - REACH - HOLD) / BACK);
        const out = ph < REACH + HOLD;

        const qCmd = [HOME[0] + (s.qc[0] - HOME[0]) * u, HOME[1] + (s.qc[1] - HOME[1]) * u];
        const qExe = executed(HOME, s.qc, u);
        const C = fk(qCmd), X = fk(qExe);

        // stage
        P.dots(14, 14, W - 14, TABLE - 8, 13);
        P.line([[12, TABLE], [W - 12, TABLE]], { w: 1, color: T.mute, alpha: 0.6 });
        for (let x = 16; x < W - 12; x += 7) P.line([[x, TABLE], [x - 4, TABLE + 4]], { w: 0.7, color: T.mute, alpha: 0.35 });

        // paths of this reach: commanded (dashed) and executed
        if (out) {
          const n = 24, cp = [], xp = [];
          const lim = Math.max(1, Math.round(n * (ph < REACH ? ease(ph / REACH) : 1)));
          for (let i = 0; i <= lim; i++) {
            const v = i / n;
            cp.push(fk([HOME[0] + (s.qc[0] - HOME[0]) * v, HOME[1] + (s.qc[1] - HOME[1]) * v]).ee);
            xp.push(fk(executed(HOME, s.qc, v)).ee);
          }
          P.line(cp, { w: 1.3, color: T.acc, dash: [3.5, 3], cap: 'butt', alpha: 0.9 });
          P.line(xp, { w: 1.8, color: T.exec, alpha: 0.85 });
        }

        // where earlier tries landed: they close in on the target
        s.marks.forEach((m, i) => P.cross(m, 2.4, { w: 1.2, color: T.exec, alpha: 0.2 + 0.15 * i }));

        // pedestal
        P.rrect(B[0] - 12, B[1] - 2, 24, TABLE - B[1] + 2, 2.5, { fill: T.ink, fillAlpha: 0.85, w: 0 });
        P.rrect(B[0] - 17, TABLE - 3, 34, 3, 1, { fill: T.ink, w: 0 });

        // commanded arm (ghost) and executed arm
        const ghost = { w: 10, color: T.acc, alpha: 0.14 };
        P.line([B, C.elbow], ghost);
        P.line([C.elbow, C.ee], { ...ghost, w: 8 });
        const arm = { w: 10, color: T.exec, alpha: 0.92 };
        P.line([B, X.elbow], arm);
        P.line([X.elbow, X.ee], { ...arm, w: 8 });
        const ga = -X.a, gd = [Math.cos(ga), Math.sin(ga)], gn = [-gd[1], gd[0]];
        const g0 = [X.ee[0] + gd[0] * 2, X.ee[1] + gd[1] * 2];
        for (const sg of [-1, 1]) {
          const b = [g0[0] + gn[0] * 4.5 * sg, g0[1] + gn[1] * 4.5 * sg];
          P.line([[g0[0], g0[1]], b, [b[0] + gd[0] * 7, b[1] + gd[1] * 7]], { w: 2, color: T.exec });
        }
        for (const [c, r] of [[B, 5.5], [X.elbow, 4.6]]) {
          P.circle(c, r, { fill: T.bg, w: 0 });
          P.circle(c, r * 0.55, { fill: T.acc, w: 0 });
        }

        // target; at the end of a reach, the miss (red) or a hit (check)
        const miss = dist(X.ee, s.goal), landed = ph >= REACH * 0.98 && out;
        const hit = landed && miss < 4;
        P.star(goalNow, 8, { fill: hit ? T.ok : T.bg, color: hit ? T.ok : T.ink });   // follows the cursor at once
        if (landed && !hit) {
          P.line([X.ee, s.goal], { w: 1.6, color: T.bad });
          P.cross(X.ee, 3.2, { w: 1.7, color: T.ink });
        }

        // tries so far on this target: red while missing, green once on target
        const n = s.tries.length, dx = P.small ? 13 : 10, x0 = W - 16 - (n - 1) * dx, y0 = 14;
        s.tries.forEach((m, i) => P.circle([x0 + i * dx, y0], P.small ? 3.4 : 2.6, { fill: m < 4 ? T.ok : T.bad, fillAlpha: m < 4 ? 1 : clamp(0.35 + m / 30, 0.35, 1), w: 0 }));

        // a two-word legend, only when shown large
        if (!P.small) {
          P.line([[16, 14], [28, 14]], { w: 1.3, color: T.acc, dash: [3.5, 3], cap: 'butt' });
          P.text('commanded', 32, 14, { size: 7.5, color: T.ink });
          P.line([[84, 14], [96, 14]], { w: 1.8, color: T.exec });
          P.text('executed', 100, 14, { size: 7.5, color: T.ink });
        }
      },
    };
  }

  // ---------------------------------------------------------------- testdg
  // TestDG: test-time domain generalization for continual TTA.
  // One idea: test domains keep changing. Each new domain lands somewhere
  // in the domain-embedding space; when the domain changes, only a few
  // prototypes of the previous domain are kept (hollow diamonds), and the
  // current domain's embeddings are pulled onto them, so the encoder grows
  // domain-invariant and each later domain lands closer. The strip below
  // shows error over the stream: a baseline spikes at every domain change,
  // TestDG stays flat. The pointer drops a new domain where it is.
  function testdgScene() {
    const C = [160, 66], TOP = 12, BOT = 124;     // embedding space
    const SY0 = 138, SY1 = 170, SPAN = 16;        // error strip, seconds shown
    const DUR = 5.2, N = 24, NP = 5;
    const FAR = [[110, -34], [-118, 30], [96, 40], [-100, -36], [16, 48], [-40, -44]];
    const rnd = (k) => hash(k * 7919 + 13);
    const gauss = (k) => { const u = Math.max(1e-6, rnd(k)), v = rnd(k + 1); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };

    const s = { dom: -1, t0: 0, shift: [0, 0], protos: [], old: [], oldT: 0, gap: 1, hist: [], lastPtr: null };
    const colorOf = (T, k) => [T.exec, T.acc, T.warn, T.ok, T.violet][((k % 5) + 5) % 5];
    // positions of the current domain's embeddings
    function cloud(t) {
      const a = align(t), out = [];
      const tgt = s.protos.length ? centroid(s.protos.map((p) => p.pos)) : C;
      const base = [C[0] + s.shift[0], C[1] + s.shift[1]];
      const ctr = [lerp(base[0], tgt[0], a), lerp(base[1], tgt[1], a)];
      const n = Math.min(N, Math.floor(3 + (t - s.t0) * 9));   // samples stream in
      for (let i = 0; i < n; i++) {
        const k = s.dom * 101 + i * 3;
        out.push([ctr[0] + 11 * gauss(k), ctr[1] + 8 * gauss(k + 50)]);
      }
      return out;
    }
    const centroid = (ps) => [ps.reduce((m, p) => m + p[0], 0) / ps.length, ps.reduce((m, p) => m + p[1], 0) / ps.length];
    const align = (t) => ease(clamp((t - s.t0 - 0.6) / 2.6, 0, 1)) * 0.92;
    // keep a few representative prototypes (greedy, spread over the cloud)
    function selectProtos(pts) {
      const ctr = centroid(pts), pick = [];
      let first = pts.reduce((b, p) => (dist(p, ctr) < dist(b, ctr) ? p : b), pts[0]);
      pick.push(first);
      while (pick.length < NP) {
        let best = null, bd = -1;
        for (const p of pts) {
          const d = Math.min(...pick.map((q) => dist(p, q)));
          if (d > bd) { bd = d; best = p; }
        }
        pick.push(best);
      }
      return pick;
    }
    function newDomain(t, shift) {
      if (s.dom >= 0) {
        const pts = cloud(t);
        s.old = pts; s.oldT = t; s.oldDom = s.dom;
        s.protos = selectProtos(pts).map((p) => ({ pos: p, dom: s.dom, born: t }));
        s.gap = Math.max(0.28, s.gap * 0.72);      // the encoder is more invariant each time
      }
      s.dom++; s.t0 = t;
      if (!shift && s.dom % 6 === 0) { s.gap = 1; s.protos = []; }   // start the demo loop over
      s.shift = shift || FAR[s.dom % FAR.length].map((v) => v * s.gap);
      s.hist.push({ t, gap: s.gap });
    }

    return {
      sticky: true,
      idle: () => null,
      draw(P, st) {
        const T = P.T, t = st.t;
        if (s.dom < 0) newDomain(t);
        // the pointer drops a new domain where it rests (if far from the current one)
        if (!st.idle && st.ptr[1] < BOT) {
          const cur = centroid(cloud(t)), want = [st.ptr[0] - C[0], st.ptr[1] - C[1]];
          if (t - s.t0 > 1.2 && dist(st.ptr, cur) > 34 && (!s.lastPtr || dist(st.ptr, s.lastPtr) > 20)) {
            s.lastPtr = st.ptr.slice();
            newDomain(t, want);
          }
        } else if (t - s.t0 > DUR) newDomain(t);

        // ---- embedding space
        P.dots(14, TOP + 2, W - 14, BOT - 4, 13);
        // the previous domain dissolves, leaving its prototypes
        const fade = 1 - clamp((t - s.oldT) / 0.9, 0, 1);
        if (fade > 0) s.old.forEach((p) => P.circle(p, 2.2, { fill: colorOf(T, s.oldDom), fillAlpha: 0.7 * fade, w: 0 }));
        const pts = cloud(t), col = colorOf(T, s.dom), a = align(t);
        // pull lines toward the nearest prototype while aligning
        if (s.protos.length && a < 0.85) {
          pts.forEach((p, i) => {
            if (i % 3) return;
            const q = s.protos.reduce((b, r) => (dist(r.pos, p) < dist(b.pos, p) ? r : b), s.protos[0]).pos;
            P.line([p, q], { w: 0.8, color: T.mute, alpha: 0.35 * (1 - a), dash: [2, 2.5] });
          });
        }
        pts.forEach((p) => P.circle(p, 2.3, { fill: col, fillAlpha: 0.85, w: 0 }));
        s.protos.forEach((r) => {
          const pop = ease(clamp((t - r.born) / 0.5, 0, 1));
          const d = 4.2 * (0.6 + 0.4 * pop), c = r.pos;
          const dia = [[c[0], c[1] - d], [c[0] + d, c[1]], [c[0], c[1] + d], [c[0] - d, c[1]], [c[0], c[1] - d]];
          P.ctx.save(); P.ctx.beginPath(); dia.forEach((q, i) => (i ? P.ctx.lineTo(q[0], q[1]) : P.ctx.moveTo(q[0], q[1])));
          P.ctx.fillStyle = T.bg; P.ctx.fill(); P.ctx.restore();
          P.line(dia, { w: 1.5, color: colorOf(T, r.dom) });
        });
        if (!P.small) {
          P.circle([18, TOP + 4], 2.3, { fill: col, fillAlpha: 0.85, w: 0 });
          P.text('current domain', 25, TOP + 4, { size: 7.5, color: T.ink });
          const c = [102, TOP + 4], d = 3.6;
          P.line([[c[0], c[1] - d], [c[0] + d, c[1]], [c[0], c[1] + d], [c[0] - d, c[1]], [c[0], c[1] - d]], { w: 1.3, color: T.ink });
          P.text('prototypes', 110, TOP + 4, { size: 7.5, color: T.ink });
        }

        // ---- error over the stream: baseline spikes at each change, TestDG stays low
        P.line([[14, SY1], [W - 14, SY1]], { w: 0.8, color: T.line });
        const X = (tt) => W - 14 - (t - tt) / SPAN * (W - 28);
        const Y = (e) => SY1 - clamp(e, 0, 1) * (SY1 - SY0);
        s.hist.forEach((h) => { if (t - h.t < SPAN) P.line([[X(h.t), SY0 - 2], [X(h.t), SY1]], { w: 0.7, color: T.line, dash: [2, 2] }); });
        const errAt = (tt, mine) => {
          let h = null;
          for (const e of s.hist) if (e.t <= tt) h = e;
          if (!h) return 0.3;
          const tau = tt - h.t;
          return mine ? 0.18 + 0.28 * h.gap * Math.exp(-tau / 0.5) : 0.38 + 0.5 * Math.exp(-tau / 1.3);
        };
        const base = [], mine = [];
        for (let i = 0; i <= 90; i++) {
          const tt = t - SPAN + SPAN * i / 90;
          base.push([X(tt), Y(errAt(tt, false))]); mine.push([X(tt), Y(errAt(tt, true))]);
        }
        P.line(base, { w: 1.2, color: T.mute, alpha: 0.7, dash: [3, 2.5] });
        P.line(mine, { w: 1.8, color: T.acc });
        if (!P.small) {
          P.text('error', 14, SY0 - 6, { size: 7, color: T.mute });
          P.line([[40, SY0 - 6], [50, SY0 - 6]], { w: 1.8, color: T.acc });
          P.text('TestDG', 53, SY0 - 6, { size: 7, color: T.ink });
          P.line([[88, SY0 - 6], [98, SY0 - 6]], { w: 1.2, color: T.mute, dash: [3, 2.5] });
          P.text('w/o', 101, SY0 - 6, { size: 7, color: T.ink });
        }
      },
    };
  }

  const SCENES = { selfcomp: selfcompScene, testdg: testdgScene };
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
