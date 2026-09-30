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
  // Taming VLAs under Robot Execution Errors (self-compensating VLA +
  // RoboStress). The pointer places the target. The policy emits an action
  // chunk of K delta commands a; the arm executes them through joint-level
  // noise (Stribeck friction, gravity-compensation error, Tao-Kokotovic
  // backlash, spring-mass-damper compliance). Each step leaves a residual
  // eta = executed - commanded. With self-comp on, after every chunk the
  // LoRA-adapted policy moves toward the pseudo-target a - eta, so the next
  // chunk is pre-compensated and the residual shrinks. Clicking the
  // scenario name cycles RoboStress's seven deployment scenarios.
  function selfcompScene() {
    const B = [74, 150], L1 = 62, L2 = 54, TABLE = 160;
    const PX = 214, PW = 96;                    // right-hand readout column
    const K = 8, STEP = 0.11, PAUSE = 0.4;      // chunk length, s per step, update beat
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
    function reachable(p) {
      let [x, y] = toWorld(p);
      y = Math.max(y, 6);
      const r = Math.hypot(x, y), a = Math.atan2(y, x);
      const rr = clamp(r, 46, L1 + L2 - 10);
      const q = toScreen([rr * Math.cos(a), rr * Math.sin(a)]);
      return [clamp(q[0], 14, PX - 18), clamp(q[1], 16, TABLE - 14)];
    }
    const TOUR = [[182, 62], [150, 122], [98, 42], [188, 100], [124, 72]];

    // RoboStress deployment scenarios (paper Table 1) with their pi0.5
    // average success, base -> self-compensating (paper Table 2).
    // w: severity factors for friction, gravity-comp, backlash, compliance.
    const SCEN = [
      { name: 'Heavy Payload', w: [1, 5, 1, 2], base: 44.1, ours: 56.8 },
      { name: 'Thermal Drift-Stribeck', w: [3.5, 1, 1, 1], ramp: 0, base: 54.1, ours: 60.5 },
      { name: 'Thermal Drift-Backlash', w: [1, 1, 3.5, 1], ramp: 2, base: 83.4, ours: 84.8 },
      { name: 'Aged Transmission', w: [2.5, 1, 2.5, 1], base: 33.2, ours: 41.8 },
      { name: 'Aged Joint-Uniform', w: [2.5, 1, 2.5, 2.5], base: 29.5, ours: 38.6 },
      { name: 'Aged Joint-Shoulder', w: [2.5, 1, 2.5, 2.5], joint: 0, base: 43.9, ours: 51.2 },
      { name: 'Aged Joint-Elbow', w: [2.5, 1, 2.5, 2.5], joint: 1, base: 55.6, ours: 62.3 },
    ];
    const COMP = ['friction', 'gravity comp.', 'backlash', 'compliance'];

    const s = {
      sc: 0, scT: 0, userScen: false, comp: false, userSet: false,
      qm: null, ql: null, eta: [[0, 0, 0], [0, 0, 0]],   // motor, link, compliance [pos, vel]
      fit: [[1, 0, 0], [1, 0, 0]],   // per joint: gain, reversal (backlash) term, offset
      buf: [], dir: [1, -1],         // online buffer of executed steps; last motor direction
      chunk: null, step: 0, stepT: 0, pause: 0, chunkNo: 0,
      bars: [], past: [], pill: null, chip: null,
    };
    // severity factor of component c on joint j right now
    function sev(c, j) {
      const S = SCEN[s.sc];
      if (S.joint !== undefined && S.joint !== j) return 1;
      const w = S.w[c];
      return S.ramp === c ? 1 + (w - 1) * clamp(s.scT / 12, 0, 1) : w;
    }
    // gravity torque on each joint at link angles q (arbitrary units)
    const grav = (q) => [Math.cos(q[0]) + 0.55 * Math.cos(q[0] + q[1]), 0.55 * Math.cos(q[0] + q[1])];
    function linkAngles() {
      const g = grav(s.ql);
      // gravity-compensation error leaves a fraction beta*g(q) of the load unbalanced
      return [0, 1].map((j) => s.ql[j] - 0.04 * sev(1, j) * g[j] + s.eta[j][0]);
    }
    const eePos = () => fk(linkAngles()).ee;

    function planChunk(goal) {
      const p0 = eePos();
      const d = [goal[0] - p0[0], goal[1] - p0[1]], L = Math.hypot(d[0], d[1]);
      const k = L > K * 9 ? (K * 9) / L : 1;
      const nom = [d[0] * k / K, d[1] * k / K];      // the motion the policy intends per step
      s.chunk = { p0, nom, cmd: [], exec: [p0], eta: [], err: [], goal, rows: [] };
      s.step = 0; s.stepT = 0;
      startStep();
    }
    // the adapted policy issues, per joint, the command it expects the robot
    // to turn into the intended motion (conditioned on direction reversals)
    function compensate(d, j) {
      if (!s.comp || Math.abs(d) < 1e-6) return d;
      const [g, b, o] = s.fit[j], rev = Math.sign(d) !== s.dir[j] ? Math.sign(d) : 0;
      const cmd = (d - o - b * rev) / clamp(g, 0.6, 1.6);
      return clamp(cmd, -3 * Math.abs(d) - 0.1, 3 * Math.abs(d) + 0.1);
    }
    function startStep() {
      const c = s.chunk, i = s.step;
      const pa = [c.p0[0] + c.nom[0] * i, c.p0[1] + c.nom[1] * i];
      const q0 = ik(pa), q1 = ik([pa[0] + c.nom[0], pa[1] + c.nom[1]]);
      const want = [q1[0] - q0[0], q1[1] - q0[1]];
      c.dq = want.map((d, j) => compensate(d, j));
      c.rev = c.dq.map((d, j) => (Math.abs(d) > 1e-6 && Math.sign(d) !== s.dir[j] ? Math.sign(d) : 0));
      const qx = linkAngles(), p = fk(qx).ee, pc = fk([qx[0] + c.dq[0], qx[1] + c.dq[1]]).ee;
      c.cmd[i] = [pc[0] - p[0], pc[1] - p[1]];      // the issued command, as an end-effector delta
      c.stepStart = p; c.qStart = qx;
    }
    function endStep() {
      const c = s.chunk, p = eePos(), a = c.cmd[s.step], p0 = c.stepStart, q = linkAngles();
      c.exec.push(p);
      c.eta.push([p[0] - p0[0] - a[0], p[1] - p0[1] - a[1]]);            // residual vs issued command
      c.err.push([p[0] - p0[0] - c.nom[0], p[1] - p0[1] - c.nom[1]]);   // vs the motion the policy intended
      c.rows.push([0, 1].map((j) => [c.dq[j], c.rev[j], q[j] - c.qStart[j]]));
    }
    function endChunk() {
      const c = s.chunk;
      const r = c.err.reduce((m, e) => m + Math.hypot(e[0], e[1]), 0) / c.err.length;
      s.bars.push([r, s.comp]);
      if (s.bars.length > 14) s.bars.shift();
      s.past.push(c);
      if (s.past.length > 2) s.past.shift();
      // online update from the command-execution residuals: fit, per joint,
      // how issued commands turn into executed motion over a recent buffer,
      // anchored to the unadapted policy (the paper's LoRA anchor term).
      // With self-comp off the base policy stays frozen.
      if (s.comp) {
        s.buf.push(...c.rows);
        while (s.buf.length > 3 * K) s.buf.shift();
        // a small step toward the new fit, like a few optimizer steps per chunk
        s.fit = [0, 1].map((j) => { const w = ridge(s.buf.map((r) => r[j])); return s.fit[j].map((v, i) => lerp(v, w[i], 0.5)); });
      } else { s.buf = []; s.fit = [[1, 0, 0], [1, 0, 0]]; }
      s.chunkNo++;
      s.pause = PAUSE;
    }
    // least squares for executed = g*cmd + b*reversal + o, pulled toward (1, 0, 0)
    function ridge(rows) {
      const lam = [0.004, 0.2, 2], prior = [1, 0, 0];
      const M = [[lam[0], 0, 0], [0, lam[1], 0], [0, 0, lam[2]]], R = prior.map((w, i) => w * lam[i]);
      for (const [cmd, rev, y] of rows) {
        const f = [cmd, rev, 1];
        for (let i = 0; i < 3; i++) { R[i] += f[i] * y; for (let k = 0; k < 3; k++) M[i][k] += f[i] * f[k]; }
      }
      const inv = inv3(M);
      return [0, 1, 2].map((i) => inv[i][0] * R[0] + inv[i][1] * R[1] + inv[i][2] * R[2]);
    }
    function inv3(m) {
      const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
      const A = e * i - f * h, Bq = -(d * i - f * g), Cq = d * h - e * g, det = a * A + b * Bq + c * Cq;
      return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
        [Bq / det, (a * i - c * g) / det, -(a * f - c * d) / det],
        [Cq / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
    }
    // advance the joints by one frame of the current step
    function integrate(dt) {
      const c = s.chunk, frac = dt / STEP;
      const g = grav(s.ql);
      for (let j = 0; j < 2; j++) {
        // Stribeck friction: small (slow) commands stall against static friction
        const v = Math.abs(c.dq[j]) / STEP, wf = sev(0, j);
        const loss = wf * (0.12 + 0.12 * Math.exp(-((v / 0.3) ** 2)));
        const dqm = c.dq[j] * frac * Math.max(0, 1 - loss);
        s.qm[j] += dqm;
        if (Math.abs(dqm) > 1e-6) s.dir[j] = Math.sign(dqm);
        // backlash (Tao-Kokotovic deadband) between motor and link
        const Bw = 0.01 * sev(2, j);
        if (s.qm[j] - s.ql[j] > Bw) s.ql[j] = s.qm[j] - Bw;
        else if (s.qm[j] - s.ql[j] < -Bw) s.ql[j] = s.qm[j] + Bw;
        // compliance: spring-mass-damper deflection driven by the load torque
        const Kc = 60 / sev(3, j), acc = (dqm - (s.lastDq ? s.lastDq[j] : 0)) / (dt * dt || 1);
        const tau = 0.35 * g[j] + 0.001 * acc;
        const e = s.eta[j];
        e[1] += (-9 * e[1] - Kc * e[0] - tau) * dt;
        e[0] += e[1] * dt;
        s.lastDq = s.lastDq || [0, 0];
        s.lastDq[j] = dqm;
      }
    }

    return {
      state: s,
      init(st) {
        const q = ik(reachable(TOUR[0]));
        s.qm = q.slice(); s.ql = q.slice();
        st.ptr = TOUR[0].slice(); st.target = TOUR[0].slice();
      },
      idle(t) {
        const n = TOUR.length, u = Math.max(0, t) / (3 * (K * STEP + PAUSE)), i = Math.floor(u) % n;
        return TOUR[i];
      },
      click(p) {
        const hit = (b) => b && p[0] >= b[0] - 3 && p[0] <= b[0] + b[2] + 3 && p[1] >= b[1] - 3 && p[1] <= b[1] + b[3] + 3;
        if (hit(s.pill)) { s.comp = !s.comp; s.userSet = true; return true; }
        if (hit(s.chip)) { s.sc = (s.sc + 1) % SCEN.length; s.scT = 0; s.userScen = true; return true; }
        return false;
      },
      draw(P, st) {
        const T = P.T, t = st.t, dt = st.dt || 0.016;

        // ---- auto demo until the viewer takes over: 4 chunks off, 6 on,
        // then the next scenario
        if (!s.userSet) {
          const ph = s.chunkNo % 10;
          if (!s.chunk || s.pause > 0) s.comp = ph >= 4;
          if (!s.userScen && ph === 0 && s.lastCycle !== s.chunkNo && s.chunkNo > 0) {
            s.lastCycle = s.chunkNo; s.sc = (s.sc + 1) % SCEN.length; s.scT = 0;
          }
        }
        s.scT += dt;

        // ---- chunk loop
        const goal = reachable(st.ptr);
        if (!s.chunk) planChunk(goal);
        else if (s.pause > 0) {
          s.pause -= dt;
          if (s.pause <= 0) planChunk(goal);
        } else {
          integrate(dt);
          s.stepT += dt;
          if (s.stepT >= STEP) {
            endStep();
            s.step++; s.stepT = 0;
            if (s.step >= K) endChunk(); else startStep();
          }
        }
        // compliance keeps ringing between chunks
        if (s.pause > 0) for (let j = 0; j < 2; j++) {
          const e = s.eta[j], g = grav(s.ql);
          e[1] += (-9 * e[1] - (60 / sev(3, j)) * e[0] - 0.35 * g[j]) * dt;
          e[0] += e[1] * dt;
        }

        const c = s.chunk, X = fk(linkAngles());
        // commanded end effector right now (for the ghost arm)
        const cur = Math.min(s.step, K - 1), a0 = c.cmd[cur] || [0, 0], st0 = c.stepStart;
        const cf = s.pause > 0 ? 1 : s.stepT / STEP;
        const C = fk(ik([st0[0] + a0[0] * cf, st0[1] + a0[1] * cf]));

        // ---- stage
        P.dots(12, 22, PX - 12, TABLE - 6, 12);
        P.line([[10, TABLE], [PX - 8, TABLE]], { w: 1, color: T.mute, alpha: 0.6 });
        for (let x = 14; x < PX - 8; x += 7) P.line([[x, TABLE], [x - 4, TABLE + 4]], { w: 0.7, color: T.mute, alpha: 0.35 });

        // earlier chunks, fading
        s.past.forEach((pc0, k) => P.line(pc0.exec, { w: 1.3, color: T.exec, alpha: 0.18 + 0.14 * k }));

        // this chunk: the intended plan (dotted), each issued command from where
        // its step started (dashed), the execution, and the error vs intent (red)
        const nomPts = [c.p0];
        for (let i = 0; i < K; i++) nomPts.push([c.p0[0] + c.nom[0] * (i + 1), c.p0[1] + c.nom[1] * (i + 1)]);
        P.line(nomPts, { w: 0.9, color: T.mute, alpha: 0.7, dash: [1.2, 2.2] });
        c.cmd.forEach((a, i) => {
          const from = c.exec[i] || st0;
          P.line([from, [from[0] + a[0], from[1] + a[1]]], { w: 1.3, color: T.acc, dash: [2.5, 1.8], cap: 'butt' });
          P.circle([from[0] + a[0], from[1] + a[1]], 1.3, { fill: T.acc, w: 0 });
        });
        const ex = c.exec.concat(s.pause > 0 ? [] : [X.ee]);
        P.line(ex, { w: 1.8, color: T.exec });
        c.exec.slice(1).forEach((p) => P.circle(p, 1.6, { fill: T.exec, w: 0 }));
        c.err.forEach((e, i) => {
          const tip = c.exec[i + 1], base = [tip[0] - e[0], tip[1] - e[1]];
          if (Math.hypot(e[0], e[1]) > 0.8) P.line([base, tip], { w: 1.3, color: T.bad });
        });

        // pedestal
        P.rrect(B[0] - 11, B[1] - 2, 22, TABLE - B[1] + 2, 2.5, { fill: T.ink, fillAlpha: 0.85, w: 0 });
        P.rrect(B[0] - 15, TABLE - 3, 30, 3, 1, { fill: T.ink, w: 0 });

        // commanded arm (ghost) and executed arm
        const ghost = { w: 9, color: T.acc, alpha: 0.14 };
        P.line([B, C.elbow], ghost);
        P.line([C.elbow, C.ee], { ...ghost, w: 7 });
        const arm = { w: 9, color: T.exec, alpha: 0.9 };
        P.line([B, X.elbow], arm);
        P.line([X.elbow, X.ee], { ...arm, w: 7 });
        const ga = -X.a, gd = [Math.cos(ga), Math.sin(ga)], gn = [-gd[1], gd[0]];
        const g0 = [X.ee[0] + gd[0] * 2, X.ee[1] + gd[1] * 2];
        for (const sg of [-1, 1]) {
          const b = [g0[0] + gn[0] * 4 * sg, g0[1] + gn[1] * 4 * sg];
          P.line([[g0[0], g0[1]], b, [b[0] + gd[0] * 6, b[1] + gd[1] * 6]], { w: 1.8, color: T.exec });
        }
        // joints; the scenario's worn joint is ringed
        const S = SCEN[s.sc];
        [[B, 5, 0], [X.elbow, 4.2, 1]].forEach(([p, r, j]) => {
          P.circle(p, r, { fill: T.bg, w: 0 });
          P.circle(p, r * 0.55, { fill: T.acc, w: 0 });
          if (S.joint === j) P.circle(p, r + 3, { w: 1.2, color: T.bad, dash: [2, 2] });
        });

        P.star(goal, 7, { fill: T.bg, color: T.ink });
        const side = goal[0] > PX - 60 ? -1 : 1;
        P.text('target', goal[0] + side * 10, goal[1] - 9, { align: side > 0 ? 'left' : 'right', size: 8, color: T.ink, detail: true });

        // legend + chunk / update status
        if (!P.small) {
          P.line([[14, 12], [24, 12]], { w: 1.3, color: T.acc, dash: [3, 2.5], cap: 'butt' });
          P.text('command a', 27, 12, { size: 7, color: T.ink });
          P.line([[70, 12], [80, 12]], { w: 1.8, color: T.exec });
          P.text('executed', 83, 12, { size: 7, color: T.ink });
          P.line([[122, 12], [130, 12]], { w: 1.3, color: T.bad });
          P.text('action error', 133, 12, { size: 7, color: T.ink });
        }
        const status = s.pause > 0 ? (s.comp ? 'LoRA update  a ← a − η' : 'base policy (frozen)') : `chunk ${s.chunkNo + 1} · step ${Math.min(K, s.step + 1)}/${K}`;
        P.text(status, 14, TABLE + 11, { size: P.small ? 9 : 7, color: s.pause > 0 && s.comp ? T.ok : T.mute, weight: s.pause > 0 && s.comp ? 700 : 500 });

        // ---- readout column
        const x0 = PX, x1 = PX + PW;
        P.line([[PX - 6, 10], [PX - 6, H - 10]], { w: 0.8, color: T.line });
        P.text('RoboStress', x0, 12, { size: P.small ? 9 : 7, color: T.mute });
        const chH = P.small ? 17 : 13;
        s.chip = [x0, 18, PW, chH];
        P.rrect(x0, 18, PW, chH, 3, { fill: T.line, fillAlpha: 0.55, color: T.mute, w: 0.8 });
        let nm = S.name;
        if (P.small) nm = nm.replace('Thermal Drift-', 'Thermal ').replace('Aged Joint-', 'Aged ');
        P.text(nm + ' ›', x0 + PW / 2, 18 + chH / 2 + 0.5, { size: P.small ? 9.5 : 7.5, weight: 600, align: 'center', color: T.ink });

        let y = 18 + chH + 6;
        if (!P.small) {
          COMP.forEach((n, i) => {
            const yy = y + 4 + i * 8.5;
            const w = Math.max(sev(i, 0), sev(i, 1)), hot = w > 1.05;
            P.text(n, x0, yy, { size: 6.8, color: hot ? T.ink : T.mute });
            P.rrect(x0 + 50, yy - 2, PW - 50, 4, 2, { fill: T.line, w: 0 });
            P.rrect(x0 + 50, yy - 2, Math.max(4, (PW - 50) * clamp(w / 3.5, 0, 1)), 4, 2, { fill: hot ? T.exec : T.mute, fillAlpha: hot ? 0.85 : 0.45, w: 0 });
          });
          y += 38;
        }

        // residual per chunk
        P.text('action error per chunk', x0, y + 3, { size: P.small ? 8.5 : 6.8, color: T.mute });
        const by0 = y + 9, bh = P.small ? 42 : 24, by1 = by0 + bh, n = 14, bw = PW / n;
        P.line([[x0, by1], [x1, by1]], { w: 0.8, color: T.line });
        s.bars.forEach(([r, on], i) => {
          const h = clamp(r / 2.5, 0.04, 1) * bh, x = x0 + (i + n - s.bars.length) * bw;
          P.rrect(x + bw * 0.18, by1 - h, bw * 0.64, h, 1, { fill: on ? T.ok : T.bad, fillAlpha: 0.85, w: 0 });
        });

        // the paper's number for this scenario (pi0.5 average success)
        if (!P.small) {
          const yy = by1 + 10;
          P.text('π0.5 success', x0, yy, { size: 6.8, color: T.mute });
          P.text(`${S.base}%`, x0 + 43, yy, { size: 7.5, color: T.mute, weight: 600 });
          P.text('→', x0 + 70, yy, { size: 7.5, color: T.mute, align: 'center' });
          P.text(`${S.ours}%`, x1, yy, { size: 7.5, color: T.ok, weight: 700, align: 'right' });
        }

        // the toggle
        const ph = P.small ? 20 : 15, py = H - 10 - ph;
        s.pill = [x0, py, PW, ph];
        const on = s.comp;
        P.rrect(x0, py, PW, ph, ph / 2, { fill: on ? T.ok : T.bg, color: on ? T.ok : T.mute, w: 1 });
        P.circle([on ? x0 + PW - ph / 2 : x0 + ph / 2, py + ph / 2], ph / 2 - 3, { fill: on ? T.bg : T.mute, w: 0 });
        P.text(on ? 'self-comp on' : 'self-comp off', x0 + PW / 2 + (on ? -ph / 4 : ph / 4), py + ph / 2 + 0.5,
          { size: P.small ? 10 : 7.5, weight: 600, align: 'center', color: on ? T.bg : T.mute });
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
