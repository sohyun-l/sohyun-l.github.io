// pub-fig.js: interactive publication figures, drawn like a drafting sheet
// (after kdwonn.github.io): white paper, ink linework, one blue pigment,
// sienna only for errors, small mono labels. Mounts on every
// <canvas data-fig-scene="...">; each scene draws on a 320x180 board that
// is letterboxed into the canvas. Figures hold still and move only under
// the cursor.
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
  const LIGHT = {
    bg: '#ffffff', ink: '#15181d', mute: '#7c828c', faint: 'rgba(20,30,50,.2)', grid: 'rgba(20,30,50,.14)',
    acc: '#1a3190', alt: '#0f6e62', bad: '#b4442a', badSoft: 'rgba(180,68,42,.1)', ochre: '#b07a12', violet: '#5b3fa8',
  };
  const DARK = {
    bg: '#15181d', ink: '#eceef1', mute: '#8b919b', faint: 'rgba(236,238,241,.22)', grid: 'rgba(236,238,241,.1)',
    acc: '#8ea2ff', alt: '#5ccfb8', bad: '#ff8a5b', badSoft: 'rgba(255,138,91,.12)', ochre: '#e8b25c', violet: '#b3a2ff',
  };
  const FONT = '"iA Writer Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  let theme = null, themeAt = 0;
  function readTheme(now) {
    if (theme && now - themeAt < 400) return theme;
    themeAt = now;
    // the site's own background decides light or dark
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--global-bg-color').trim();
    const m = bg.match(/^#?([0-9a-f]{6})$/i);
    const lum = m ? parseInt(m[1].slice(0, 2), 16) * 0.3 + parseInt(m[1].slice(2, 4), 16) * 0.59 + parseInt(m[1].slice(4, 6), 16) * 0.11 : 240;
    theme = lum < 110 ? DARK : LIGHT;
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
      ctx.font = `${o.bold ? 700 : 400} ${size}px ${FONT}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = o.keepCase ? '0px' : `${(size * 0.14).toFixed(2)}px`;
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

  // ---------------------------------------------------------------- selfcomp
  // Taming VLAs under Robot Execution Errors (self-compensating VLA).
  // The arm reaches for the target; execution errors make the executed
  // reach miss the commanded one, and after each try the policy
  // pre-compensates its next command from the command-execution residual,
  // so the miss closes. Still: the tries on one target, the last one on
  // it. Under the cursor: the cursor is the target and the arm tries live.
  function selfcompScene() {
    const B = [96, 150], L1 = 84, L2 = 74, TABLE = 158;
    const REACH = 1.1, HOLD = 0.8, BACK = 0.45, TRY = REACH + HOLD + BACK;
    const HOME = [Math.PI / 2 + 0.25, -2.2];      // folded, upright
    const toWorld = (p) => [p[0] - B[0], B[1] - p[1]];
    const toScreen = (p) => [B[0] + p[0], B[1] - p[1]];
    function fk(q) {
      const e = [L1 * Math.cos(q[0]), L1 * Math.sin(q[0])], a = q[0] + q[1];
      return { elbow: toScreen(e), ee: toScreen([e[0] + L2 * Math.cos(a), e[1] + L2 * Math.sin(a)]), a };
    }
    function ik(p) {
      const [x, y] = toWorld(p);
      const c2 = clamp((x * x + y * y - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
      const q2 = -Math.acos(c2);                  // elbow up
      return [Math.atan2(y, x) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2)), q2];
    }
    // targets stay inside the workspace, leaving room for a command that aims past them
    function reachable(p, margin = 30) {
      let [x, y] = toWorld(p);
      y = Math.max(y, 16);
      const r = Math.hypot(x, y), a = Math.atan2(y, x);
      const rr = clamp(r, 60, L1 + L2 - margin);
      const q = toScreen([rr * Math.cos(a), rr * Math.sin(a)]);
      return margin > 5 ? [clamp(q[0], B[0] + 30, W - 24), clamp(q[1], 22, TABLE - 20)] : q;
    }
    // execution errors along a reach (u: 0..1): friction shortfall,
    // pose-dependent gravity sag and a backlash-like offset
    function executed(qc, u) {
      const q = [HOME[0] + (qc[0] - HOME[0]) * u * 0.9, HOME[1] + (qc[1] - HOME[1]) * u * 0.9];
      const q12 = q[0] + q[1];
      return [q[0] - u * (0.12 * Math.cos(q[0]) + 0.06 * Math.cos(q12)) - 0.05 * u, q[1] - u * 0.1 * Math.cos(q12) + 0.08 * u];
    }
    const G0 = reachable([222, 70]);               // the still picture's target
    const cmdFor = (goal, off) => ik(reachable([goal[0] - off[0], goal[1] - off[1]], 1));
    const landed = (qc) => fk(executed(qc, 1)).ee;
    // learning from the residual: shift the next command by the miss
    const learn = (off, miss) => [off[0] + 0.8 * miss[0], off[1] + 0.8 * miss[1]];

    // the still picture: three tries on G0
    const still = (() => {
      let off = [0, 0];
      const tries = [];
      for (let i = 0; i < 6; i++) {                   // until it lands on the target
        const qc = cmdFor(G0, off), e = landed(qc);
        tries.push({ qc, e, miss: dist(e, G0) });
        if (dist(e, G0) < 4) break;
        off = learn(off, [e[0] - G0[0], e[1] - G0[1]]);
      }
      return tries;
    })();

    const live = { on: false, t0: 0, off: [0, 0], goal: null, qc: null, tries: [], cut: false };
    function startTry(t, goal) { live.t0 = t; live.goal = goal.slice(); live.qc = cmdFor(goal, live.off); live.cut = false; }

    function path(qc, upto, exec) {
      const pts = [], n = 28;
      for (let i = 0; i <= n * upto; i++) {
        const v = i / n;
        pts.push(fk(exec ? executed(qc, v) : [HOME[0] + (qc[0] - HOME[0]) * v, HOME[1] + (qc[1] - HOME[1]) * v]).ee);
      }
      return pts;
    }
    function arm(P, q, ghost) {
      const T = P.T, K = fk(q);
      if (ghost) {
        P.line([B, K.elbow, K.ee], { w: 1.2, color: T.acc, dash: [3, 2.5], cap: 'butt', alpha: 0.9 });
        return;
      }
      P.line([B, K.elbow, K.ee], { w: 3, color: T.ink });
      const gd = [Math.cos(-K.a), Math.sin(-K.a)], gn = [-gd[1], gd[0]];
      for (const sg of [-1, 1]) {
        const b = [K.ee[0] + gn[0] * 4 * sg, K.ee[1] + gn[1] * 4 * sg];
        P.line([K.ee, b, [b[0] + gd[0] * 6, b[1] + gd[1] * 6]], { w: 1.6, color: T.ink });
      }
      for (const [c, r] of [[B, 3.6], [K.elbow, 3.2]]) P.circle(c, r, { w: 1.4, color: T.ink, fill: T.bg });
    }
    function tryBoxes(P, list) {
      const T = P.T, s = P.small ? 11 : 8, gap = P.small ? 4 : 3;
      const x1 = W - 14, x0 = x1 - list.length * (s + gap) + gap, y = 14;
      P.text('try', x0 - 5, y + s / 2, { size: 6.5, align: 'right', detail: true });
      list.forEach((m, i) => {
        const x = x0 + i * (s + gap), hit = m < 4;
        P.rect(x, y, s, s, { w: 1, color: hit ? T.acc : T.bad, fill: T.bg });
        if (hit) P.check(x + s / 2, y + s / 2, s / 11, { color: T.acc, w: 1.3 });
        else P.cross(x + s / 2, y + s / 2, s / 13, { color: T.bad, w: 1.3 });
      });
    }

    return {
      sticky: true,
      idle: () => null,
      draw(P, st) {
        const T = P.T, t = st.t;
        P.marks();
        P.dots(16, 16, W - 16, TABLE - 8, 12);
        // ground
        P.line([[16, TABLE], [W - 16, TABLE]], { w: 1.1, color: T.ink });
        for (let x = 20; x < W - 16; x += 6) P.line([[x, TABLE], [x - 4, TABLE + 4]], { w: 0.7, color: T.faint });
        P.rect(B[0] - 10, B[1] - 1, 20, TABLE - B[1] + 1, { w: 1.3, color: T.ink, fill: T.bg });
        if (!P.small) {
          P.line([[16, 16], [28, 16]], { w: 1.2, color: T.acc, dash: [3, 2.5], cap: 'butt' });
          P.text('commanded', 32, 16, { size: 6.5, color: T.acc });
          P.line([[92, 16], [104, 16]], { w: 2.2, color: T.ink });
          P.text('executed', 108, 16, { size: 6.5, color: T.ink });
        }

        if (st.idle) {
          // ---- the still picture
          live.on = false;
          still.slice(0, -1).forEach((tr, i) => {
            P.line(path(tr.qc, 1, true), { w: 1, color: T.ink, alpha: 0.22 + 0.12 * i });
            P.cross(tr.e[0], tr.e[1], 0.8, { color: T.bad, w: 1.3, alpha: 0.6 + 0.2 * i });
          });
          const last = still[still.length - 1];
          P.line(path(last.qc, 1, false), { w: 1.2, color: T.acc, dash: [1.5, 3] });
          P.line(path(last.qc, 1, true), { w: 1.2, color: T.ink });
          P.dim(still[0].e, G0, { color: T.bad });
          arm(P, last.qc, true);
          arm(P, executed(last.qc, 1), false);
          P.target(G0, 6.5, { color: T.acc });
          tryBoxes(P, still.map((tr) => tr.miss));
          return;
        }

        // ---- live, under the cursor
        const goalNow = reachable(st.ptr);
        if (!live.on) { live.on = true; live.off = [0, 0]; live.tries = []; startTry(t, goalNow); }
        let ph = t - live.t0;
        if (!live.cut && ph > 0.3 && ph < REACH + HOLD && dist(goalNow, live.goal) > 10) { live.cut = true; live.t0 = t - (REACH + HOLD); ph = REACH + HOLD; }
        if (ph >= TRY) {
          if (!live.cut) {
            const e = landed(live.qc), miss = [e[0] - live.goal[0], e[1] - live.goal[1]];
            live.off = learn(live.off, miss);
            live.tries.push(Math.hypot(miss[0], miss[1]));
            if (live.tries.length > 6) live.tries.shift();
          }
          if (live.cut || dist(goalNow, live.goal) > 6) live.tries = [];
          startTry(t, goalNow); ph = 0;
        }
        const u = ph < REACH ? ease(ph / REACH) : ph < REACH + HOLD ? 1 : 1 - ease((ph - REACH - HOLD) / BACK);
        const out = ph < REACH + HOLD, qCmd = [HOME[0] + (live.qc[0] - HOME[0]) * u, HOME[1] + (live.qc[1] - HOME[1]) * u];
        const qExe = executed(live.qc, u), X = fk(qExe).ee;
        if (out) {
          P.line(path(live.qc, u, false), { w: 1.2, color: T.acc, dash: [1.5, 3] });
          P.line(path(live.qc, u, true), { w: 1.2, color: T.ink });
        }
        arm(P, qCmd, true);
        arm(P, qExe, false);
        const done = out && ph >= REACH * 0.98, miss = dist(X, live.goal);
        P.target(goalNow, 6.5, { color: done && miss < 4 ? T.acc : T.ink });
        if (done && miss >= 4) { P.dim(X, live.goal, { color: T.bad }); P.cross(X[0], X[1], 0.8, { color: T.bad, w: 1.3 }); }
        tryBoxes(P, live.tries);
      },
    };
  }

  // ---------------------------------------------------------------- testdg
  // TestDG: test-time domain generalization for continual TTA.
  // Two boards see the same stream of test domains (colour = domain,
  // shape = class, dashed outline = where each class belongs). Prior CTTA
  // adapts to the current domain only, so an unseen domain lands shifted
  // and its samples fall into the wrong class. TestDG aligns each domain
  // with prototypes of the previous one (diamonds) and grows invariant, so
  // the unseen domain lands in place. Still until the cursor moves it: the
  // cursor is the unseen domain's shift.
  function testdgScene() {
    const BOX = [{ x: 14, name: 'prior ctta' }, { x: 170, name: 'testdg' }], BW = 136, BY = 28, BH = 118;
    const CY = BY + BH / 2 + 2;
    const CLS = [[-34, -24], [34, -24], [0, 30]];
    const OFF = [[40, -18], [-40, 22], [14, 38], [-36, -26], [30, 30]];   // domain shifts; last is unseen
    const ND = OFF.length, PER = 6, UNSEEN = ND - 1;
    const rnd = (k) => hash(k * 7919 + 13) - 0.5;
    const s = { cur: OFF[UNSEEN].slice() };

    function shift(d, mine) {
      const off = d === UNSEEN ? s.cur : OFF[d];
      const adapt = d === UNSEEN ? 0 : 0.65;                 // earlier domains were adapted to
      const inv = mine ? 1 - 0.7 * Math.pow(0.6, d) : 0;     // TestDG: invariance built up over domains
      const k = (1 - inv) * (1 - adapt);
      return [off[0] * k, off[1] * k];
    }
    function samples(d, mine, cx) {
      const sh = shift(d, mine), out = [];
      CLS.forEach((c, ci) => {
        for (let i = 0; i < PER; i++) {
          const k = d * 97 + ci * 13 + i;
          const p = [cx + c[0] + sh[0] + 24 * rnd(k), CY + c[1] + sh[1] + 18 * rnd(k + 500)];
          let best = 0;
          CLS.forEach((q, qi) => { if (dist(p, [cx + q[0], CY + q[1]]) < dist(p, [cx + CLS[best][0], CY + CLS[best][1]])) best = qi; });
          out.push({ p, ci, ok: best === ci });
        }
      });
      return out;
    }
    function shape(P, ci, p, r, o) {
      const ctx = P.ctx;
      ctx.save();
      ctx.beginPath();
      if (ci === 0) ctx.arc(p[0], p[1], r, 0, TAU);
      else if (ci === 1) { ctx.moveTo(p[0], p[1] - r * 1.15); ctx.lineTo(p[0] + r * 1.1, p[1] + r * 0.75); ctx.lineTo(p[0] - r * 1.1, p[1] + r * 0.75); ctx.closePath(); }
      else ctx.rect(p[0] - r * 0.88, p[1] - r * 0.88, r * 1.76, r * 1.76);
      ctx.globalAlpha = o.alpha ?? 1;
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = Math.max(o.w || 1, 1 / P.k); if (o.dash) ctx.setLineDash(o.dash); ctx.stroke(); }
      ctx.restore();
    }

    return {
      sticky: true,
      idle: () => null,
      draw(P, st) {
        const T = P.T;
        const DOM = [T.acc, T.alt, T.ochre, T.violet, T.ink];
        P.marks();

        // the cursor plays the unseen domain's shift, from the centre of the board it is over
        let want = OFF[UNSEEN];
        if (!st.idle) {
          const cx = st.ptr[0] < 160 ? BOX[0].x + BW / 2 : BOX[1].x + BW / 2;
          let v = [st.ptr[0] - cx, st.ptr[1] - CY];
          const L = Math.hypot(v[0], v[1]);
          if (L > 56) v = [v[0] * 56 / L, v[1] * 56 / L];
          want = v;
        }
        const kk = approach(st.dt || 0.016, 10);
        s.cur = [lerp(s.cur[0], want[0], kk), lerp(s.cur[1], want[1], kk)];

        BOX.forEach((bx, bi) => {
          const mine = bi === 1, cx = bx.x + BW / 2;
          P.text(bx.name, bx.x, BY - 8, { size: P.small ? 10 : 7, color: mine ? T.acc : T.mute, bold: mine });
          P.rect(bx.x, BY, BW, BH, { w: 1.2, color: T.ink, fill: T.bg });
          P.dots(bx.x + 8, BY + 8, bx.x + BW - 8, BY + BH - 8, 10);
          P.ctx.save(); P.ctx.beginPath(); P.ctx.rect(bx.x + 1, BY + 1, BW - 2, BH - 2); P.ctx.clip();
          CLS.forEach((c, ci) => shape(P, ci, [cx + c[0], CY + c[1]], 13, { stroke: T.ink, w: 1, dash: [3, 2.5], alpha: 0.55 }));
          // the previous domain: its prototypes (TestDG) or its faded samples
          const prev = samples(UNSEEN - 1, mine, cx);
          if (mine) prev.filter((_, i) => i % 3 === 0).forEach(({ p }) => {
            const r = 4.6;
            P.line([[p[0], p[1] - r], [p[0] + r, p[1]], [p[0], p[1] + r], [p[0] - r, p[1]], [p[0], p[1] - r]], { w: 1.3, color: DOM[UNSEEN - 1] });
          });
          else prev.forEach(({ p, ci }) => shape(P, ci, p, 3.2, { fill: DOM[UNSEEN - 1], alpha: 0.2 }));
          // the unseen domain; a wrong class gets a sienna cross
          samples(UNSEEN, mine, cx).forEach(({ p, ci, ok }) => {
            shape(P, ci, p, 4.2, { fill: DOM[UNSEEN] });
            if (!ok) P.cross(p[0] + 5.5, p[1] - 5.5, 0.55, { color: T.bad, w: 1.2 });
          });
          P.ctx.restore();
        });

        // the domain stream, as a row of cells; the last one is unseen
        const cs = P.small ? 12 : 10, gap = 4, n = ND, x0 = W / 2 - (n * cs + (n - 1) * gap) / 2, y = H - 18;
        for (let i = 0; i < n; i++) {
          const x = x0 + i * (cs + gap), unseen = i === UNSEEN;
          if (unseen) P.rect(x, y, cs, cs, { w: 1.2, color: T.ink, dash: [2, 1.6], fill: T.bg });
          else P.rect(x, y, cs, cs, { w: 0, fill: DOM[i] });
          P.text(unseen ? '?' : `${i + 1}`, x + cs / 2, y + cs / 2 + 0.5, { size: cs * 0.62, align: 'center', color: unseen ? T.ink : T.bg, keepCase: true, bold: unseen });
          if (i < n - 1) P.line([[x + cs + 0.8, y + cs / 2], [x + cs + gap - 0.8, y + cs / 2]], { w: 0.8, color: T.faint });
        }
        P.text('test domains', x0 - 8, y + cs / 2, { size: 6.5, align: 'right', detail: true });
        P.text('unseen', x0 + n * (cs + gap) + 4, y + cs / 2, { size: 6.5, detail: true });
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
