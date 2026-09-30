// pub-fig.js: interactive publication figures (after kdwonn.github.io).
// Mounts on every <canvas data-fig-scene="...">. Each scene draws into a
// fixed 320x180 board that is letterboxed into the canvas; the pointer
// steers the scene, and when nobody is steering it plays by itself.
// Colours come from the site's CSS variables, so light/dark just works.
//   scenes: selfcomp
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
  // Robustness to Robot Hardware Imperfections / Self-Compensating VLA.
  // The pointer places the target. Joint-level imperfections (friction,
  // backlash, compliance, gravity, wear) bend the executed arm away from
  // the commanded one. With self-compensation on, the policy learns the
  // residual between commanded and executed motion online and pre-shifts
  // its command, so the action error closes; off, the error stays open.
  function selfcompScene() {
    const B = [74, 150], L1 = 62, L2 = 54, TABLE = 160;
    const PX = 214, PW = 96;                    // right-hand readout column
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
    // keep the target inside the reachable band, above the table
    function reachable(p) {
      let [x, y] = toWorld(p);
      y = Math.max(y, 6);
      const r = Math.hypot(x, y), a = Math.atan2(y, x);
      const rr = clamp(r, 44, L1 + L2 - 8);
      const q = toScreen([rr * Math.cos(a), rr * Math.sin(a)]);
      return [clamp(q[0], 14, PX - 18), clamp(q[1], 14, TABLE - 12)];
    }
    // idle tour: dwell at a few targets so the traces draw the teaser's arcs
    const TOUR = [[178, 58], [160, 118], [96, 40], [186, 96], [128, 70]];

    const NAMES = ['friction', 'backlash', 'compliance', 'gravity', 'wear'];
    const s = {
      intent: null, cmd: null, raw: null, est: [0, 0], blDir: [1, -1],
      comp: false, userSet: false, trail: [], hist: [], histAt: 0, trailAt: 0,
      terms: [0, 0, 0, 0, 0], err: 0,
    };

    return {
      init(st) {
        const q = ik(reachable(TOUR[0]));
        s.cmd = q.slice(); s.raw = q.slice(); s.intent = q.slice();
        st.ptr = TOUR[0].slice(); st.target = TOUR[0].slice();
      },
      idle(t) {
        const n = TOUR.length, per = 3.4, u = Math.max(0, t) / per, i = Math.floor(u) % n;
        const f = ease(clamp((u - Math.floor(u)) / 0.35, 0, 1));
        const a = TOUR[(i + n - 1) % n], b = TOUR[i];
        return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
      },
      // the toggle pill; returns true when the click was consumed
      click(p, st) {
        const b = s.pill;
        if (b && p[0] >= b[0] - 3 && p[0] <= b[0] + b[2] + 3 && p[1] >= b[1] - 3 && p[1] <= b[1] + b[3] + 3) {
          s.comp = !s.comp; s.userSet = true;
          return true;
        }
        return false;
      },
      draw(P, st) {
        const T = P.T, t = st.t, dt = st.dt || 0.016;

        // ---- auto demo: alternate off/on until the viewer takes the toggle
        if (!s.userSet) s.comp = (t % 13) > 5;

        // ---- dynamics
        const goal = reachable(st.ptr);
        const qd = ik(goal);
        const qGoal = s.comp ? [qd[0] - s.est[0], qd[1] - s.est[1]] : qd;
        const prev = s.cmd.slice();
        // intent: where an ideal arm would be right now on its way to the goal
        for (let j = 0; j < 2; j++) s.intent[j] += (qd[j] - s.intent[j]) * approach(dt, 5);
        for (let j = 0; j < 2; j++) s.cmd[j] += (qGoal[j] - s.cmd[j]) * approach(dt, 5);
        const vel = [(s.cmd[0] - prev[0]) / dt, (s.cmd[1] - prev[1]) / dt];
        // friction: the joints trail the command (first-order lag)
        for (let j = 0; j < 2; j++) s.raw[j] += (s.cmd[j] - s.raw[j]) * approach(dt, 9);
        // backlash: an offset that flips with the direction of travel
        for (let j = 0; j < 2; j++) if (Math.abs(vel[j]) > 0.05) s.blDir[j] = Math.sign(vel[j]);
        const q12 = s.raw[0] + s.raw[1], load = 1 + 0.35 * Math.sin(t * 0.7);
        const grav = [-0.12 * Math.cos(s.raw[0]) - 0.06 * Math.cos(q12), -0.09 * Math.cos(q12)];
        const comp = [-0.04 * load * Math.cos(s.raw[0]), -0.07 * load * Math.cos(q12)];
        const back = [0.05 * s.blDir[0], -0.07 * s.blDir[1]];
        const wear = [0.03, 0.08];
        const exec = [0, 1].map((j) => s.raw[j] + grav[j] + comp[j] + back[j] + wear[j]);
        const fric = [s.raw[0] - s.cmd[0], s.raw[1] - s.cmd[1]];
        const mag = (v) => Math.hypot(v[0], v[1]);
        const tm = [mag(fric), mag(back), mag(comp), mag(grav), mag(wear)];
        for (let i = 0; i < 5; i++) s.terms[i] += (tm[i] - s.terms[i]) * approach(dt, 6);

        // online self-compensation: learn the steady residual between the
        // commanded and executed joints (friction lag is transient, left alone)
        const resid = [exec[0] - s.raw[0], exec[1] - s.raw[1]];
        for (let j = 0; j < 2; j++) s.est[j] += ((s.comp ? resid[j] : 0) - s.est[j]) * approach(dt, s.comp ? 1.1 : 2.5);

        const C = fk(s.cmd), X = fk(exec), I = fk(s.intent);
        const err = dist(X.ee, I.ee);
        s.err += (err - s.err) * approach(dt, 8);

        // traces + error history
        if (t - s.trailAt > 1 / 30) {
          s.trailAt = t;
          s.trail.push([C.ee, X.ee]);
          if (s.trail.length > 75) s.trail.shift();
        }
        if (t - s.histAt > 0.1) {
          s.histAt = t;
          s.hist.push([s.err, s.comp]);
          if (s.hist.length > 80) s.hist.shift();
        }

        // ---- stage
        P.dots(12, 12, PX - 12, TABLE - 6, 12);
        P.line([[10, TABLE], [PX - 8, TABLE]], { w: 1, color: T.mute, alpha: 0.6 });
        for (let x = 14; x < PX - 8; x += 7) P.line([[x, TABLE], [x - 4, TABLE + 4]], { w: 0.7, color: T.mute, alpha: 0.35 });

        // traces: commanded (dashed, accent) and executed (solid, magenta)
        const n = s.trail.length;
        for (let i = 1; i < n; i++) {
          const a = i / n;
          P.line([s.trail[i - 1][0], s.trail[i][0]], { w: 1.2, color: T.acc, alpha: 0.55 * a, dash: [3, 2.5], cap: 'butt' });
          P.line([s.trail[i - 1][1], s.trail[i][1]], { w: 1.6, color: T.exec, alpha: 0.75 * a });
        }

        // pedestal
        P.rrect(B[0] - 11, B[1] - 2, 22, TABLE - B[1] + 2, 2.5, { fill: T.ink, fillAlpha: 0.85, w: 0 });
        P.rrect(B[0] - 15, TABLE - 3, 30, 3, 1, { fill: T.ink, w: 0 });

        // commanded arm: ghost in the theme accent
        const ghost = { w: 9, color: T.acc, alpha: 0.16 };
        P.line([B, C.elbow], ghost);
        P.line([C.elbow, C.ee], { ...ghost, w: 7 });
        P.line([B, C.elbow, C.ee], { w: 1, color: T.acc, alpha: 0.85, dash: [3, 2.5], cap: 'butt' });
        P.circle(C.elbow, 3, { fill: T.bg, color: T.acc, w: 1, alpha: 0.85 });

        // executed arm
        const armFill = { w: 9, color: T.exec, alpha: 0.9 };
        P.line([B, X.elbow], armFill);
        P.line([X.elbow, X.ee], { ...armFill, w: 7 });
        // gripper at the executed end effector
        const ga = -X.a, gd = [Math.cos(ga), Math.sin(ga)], gn = [-gd[1], gd[0]];
        const g0 = [X.ee[0] + gd[0] * 2, X.ee[1] + gd[1] * 2];
        for (const sg of [-1, 1]) {
          const b = [g0[0] + gn[0] * 4 * sg, g0[1] + gn[1] * 4 * sg];
          P.line([[g0[0], g0[1]], b, [b[0] + gd[0] * 6, b[1] + gd[1] * 6]], { w: 1.8, color: T.exec });
        }
        for (const [c, r] of [[B, 5], [X.elbow, 4.2]]) {
          P.circle(c, r, { fill: T.bg, w: 0 });
          P.circle(c, r * 0.55, { fill: T.acc, w: 0 });
        }

        // target + action error
        const hit = err < 4;
        P.star(goal, 7, { fill: T.bg, color: T.ink });
        if (!hit) {
          P.line([X.ee, I.ee], { w: 1.4, color: T.bad });
          P.cross(X.ee, 3, { w: 1.6, color: T.ink });
        }
        // labels sit on whichever side of the target has room
        const side = goal[0] > PX - 60 ? -1 : 1;
        P.text('target', goal[0] + side * 10, goal[1] - 9, { align: side > 0 ? 'left' : 'right', size: 8, color: T.ink, detail: true });
        if (!hit && err > 10) {
          P.text('action error', goal[0] + side * 10, goal[1] + 9, { align: side > 0 ? 'left' : 'right', size: 7.5, color: T.bad, detail: true });
        }

        // ---- readout column
        const x0 = PX, x1 = PX + PW;
        P.line([[PX - 6, 12], [PX - 6, H - 12]], { w: 0.8, color: T.line });
        P.text('action error', x0, 16, { size: P.small ? 11 : 8, color: T.mute });
        const mm = Math.round(s.err * 4);
        const good = mm <= 8;
        P.text(`${mm} mm`, x0, 34, { size: 19, weight: 700, color: good ? T.ok : T.bad });

        // error history: shaded where compensation was on
        const sy0 = 48, sh = P.small ? 44 : 26, sy1 = sy0 + sh;
        const hx = (i) => x0 + (x1 - x0) * i / 79;
        const hy = (e) => sy1 - clamp(e / 36, 0, 1) * sh;
        for (let i = 0; i < s.hist.length; i++) {
          if (s.hist[i][1]) P.rrect(hx(i + 80 - s.hist.length) - 0.6, sy0, (x1 - x0) / 79 + 1.2, sh, 0, { fill: T.ok, fillAlpha: 0.1, w: 0 });
        }
        P.line([[x0, sy1], [x1, sy1]], { w: 0.8, color: T.line });
        const hp = s.hist.map((h, i) => [hx(i + 80 - s.hist.length), hy(h[0])]);
        P.line(hp, { w: 1.4, color: T.bad });

        // imperfection meters (what the residual is made of)
        if (!P.small) {
          P.text('hardware imperfections', x0, 88, { size: 7, color: T.mute });
          NAMES.forEach((nm, i) => {
            const y = 99 + i * 9.5, v = clamp(s.terms[i] / 0.15, 0, 1);
            P.text(nm, x0, y, { size: 7, color: T.ink });
            P.rrect(x0 + 44, y - 2.2, PW - 44, 4.4, 2.2, { fill: T.line, w: 0 });
            P.rrect(x0 + 44, y - 2.2, Math.max(4.4, (PW - 44) * v), 4.4, 2.2, { fill: T.exec, fillAlpha: 0.8, w: 0 });
          });
        }

        // the toggle
        const ph = P.small ? 20 : 15, py = H - 12 - ph;
        s.pill = [x0, py, PW, ph];
        const on = s.comp;
        P.rrect(x0, py, PW, ph, ph / 2, { fill: on ? T.ok : T.bg, fillAlpha: on ? 1 : 1, color: on ? T.ok : T.mute, w: 1 });
        const knob = on ? x0 + PW - ph / 2 : x0 + ph / 2;
        P.circle([knob, py + ph / 2], ph / 2 - 3, { fill: on ? T.bg : T.mute, w: 0 });
        P.text(on ? 'self-comp on' : 'self-comp off', x0 + PW / 2 + (on ? -ph / 4 : ph / 4), py + ph / 2 + 0.5,
          { size: P.small ? 10 : 7.5, weight: 600, align: 'center', color: on ? T.bg : T.mute });

        // legend
        if (!P.small) {
          P.line([[14, 14], [26, 14]], { w: 1.2, color: T.acc, dash: [3, 2.5], cap: 'butt' });
          P.text('commanded', 30, 14, { size: 7, color: T.ink });
          P.line([[84, 14], [96, 14]], { w: 1.8, color: T.exec });
          P.text('executed', 100, 14, { size: 7, color: T.ink });
        }
      },
    };
  }

  const SCENES = { selfcomp: selfcompScene };
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
        st.idle = !st.hover || now - st.lastMove > 2500;
        // with reduced motion the figure holds still until the pointer moves it
        if (!(reduceMotion.matches && st.idle)) st.t += dt;
        st.dt = dt;
        if (st.idle) st.target = scene.idle(st.t);
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
