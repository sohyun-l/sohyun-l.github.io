// panda.js: a small panda that lives along the bottom of the page and shows
// visitors around. It walks after the cursor; hovering a section, a paper
// or a menu item makes it walk over and say a line about it; click it and
// it jumps; leave it alone and it falls asleep. On touch screens it sits in
// a corner and comments on the sections as they scroll into view.
(function () {
  if (window.__panda) return;
  window.__panda = true;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  const SIZE = touch ? 54 : 72;

  // ---------------------------------------------------------------- lines
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
  function lineFor(el) {
    const pub = el.closest('.publications ol.bibliography > li');
    if (pub) {
      const title = (pub.querySelector('.title') || {}).textContent || '';
      const venue = ((pub.querySelector('.periodical b') || pub.querySelector('.abbr abbr') || {}).textContent || '').trim();
      const fig = pub.querySelector('.pub-fig canvas') && el.closest('.pub-fig');
      if (fig) return 'Move around the figure: it follows you!';
      return (venue ? venue + ': ' : '') + shorten(title.trim(), 58);
    }
    const nav = el.closest('#navbar .nav-link');
    if (nav) return NAV[nav.textContent.trim().toLowerCase()] || null;
    const sec = el.closest('h2[id]');
    if (sec) return SECTION[sec.id] || null;
    return null;
  }

  // ---------------------------------------------------------------- the panda
  const wrap = document.createElement('div');
  wrap.className = 'panda';
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', 'A panda guide');
  wrap.innerHTML = `
    <svg viewBox="0 0 100 100" width="${SIZE}" height="${SIZE}">
      <ellipse class="p-shadow" cx="50" cy="95" rx="24" ry="3.5"/>
      <g class="p-flip">
        <g class="p-bob">
          <g class="p-leg p-leg-l"><rect x="35" y="76" width="13" height="16" rx="6"/></g>
          <g class="p-leg p-leg-r"><rect x="53" y="76" width="13" height="16" rx="6"/></g>
          <ellipse class="p-white" cx="50" cy="70" rx="21" ry="17"/>
          <g class="p-arm p-arm-l"><ellipse cx="31" cy="68" rx="6.5" ry="10"/></g>
          <g class="p-arm p-arm-r"><ellipse cx="69" cy="68" rx="6.5" ry="10"/></g>
          <g class="p-head">
            <circle class="p-black" cx="31" cy="23" r="8.5"/>
            <circle class="p-black" cx="69" cy="23" r="8.5"/>
            <circle class="p-white" cx="50" cy="40" r="23"/>
            <ellipse class="p-black" cx="40.5" cy="42" rx="6.2" ry="8" transform="rotate(-22 40.5 42)"/>
            <ellipse class="p-black" cx="59.5" cy="42" rx="6.2" ry="8" transform="rotate(22 59.5 42)"/>
            <g class="p-eyes">
              <circle class="p-eye" cx="41.5" cy="41" r="2.4"/>
              <circle class="p-eye" cx="58.5" cy="41" r="2.4"/>
            </g>
            <path class="p-sleep" d="M37 42 q4 3 8 0 M55 42 q4 3 8 0"/>
            <ellipse class="p-black" cx="50" cy="50" rx="3.4" ry="2.4"/>
            <path class="p-mouth" d="M46.5 53.5 q3.5 3 7 0"/>
            <circle class="p-blush" cx="35" cy="51" r="3"/>
            <circle class="p-blush" cx="65" cy="51" r="3"/>
          </g>
        </g>
      </g>
    </svg>
    <span class="p-zzz">z<small>z</small></span>`;
  const bubble = document.createElement('div');
  bubble.className = 'panda-bubble';
  bubble.setAttribute('aria-live', 'polite');
  document.body.appendChild(wrap);
  document.body.appendChild(bubble);

  const q = (s) => wrap.querySelector(s);
  const flip = q('.p-flip'), bob = q('.p-bob'), legL = q('.p-leg-l'), legR = q('.p-leg-r');
  const armL = q('.p-arm-l'), armR = q('.p-arm-r'), eyes = q('.p-eyes'), head = q('.p-head');

  const st = {
    x: touch ? innerWidth - SIZE : innerWidth * 0.5, target: null, dir: 1, phase: 0,
    lastAct: performance.now(), sleeping: false, jumpT: -1, blinkT: performance.now() + 2500,
    bubbleUntil: 0, cursor: null, said: '',
  };

  function ground() {
    const f = document.querySelector('footer.fixed-bottom');
    return f ? f.getBoundingClientRect().height : 0;
  }
  function say(text, ms = 3200) {
    if (!text) return;
    if (text !== st.said || !bubble.classList.contains('on')) {
      bubble.textContent = text;
      st.said = text;
    }
    bubble.classList.add('on');
    st.bubbleUntil = performance.now() + ms;
  }
  function wake() {
    st.lastAct = performance.now();
    if (st.sleeping) { st.sleeping = false; wrap.classList.remove('sleeping'); }
  }

  // ---------------------------------------------------------------- input
  if (!touch) {
    let hoverEl = null;
    document.addEventListener('pointermove', (e) => {
      st.cursor = [e.clientX, e.clientY];
      wake();
      const el = e.target instanceof Element ? e.target : null;
      const spot = el && (el.closest('.publications ol.bibliography > li') || el.closest('#navbar .nav-link') || el.closest('h2[id]'));
      if (spot !== hoverEl) {
        hoverEl = spot;
        if (spot) {
          const r = spot.getBoundingClientRect();
          st.target = spot.closest('#navbar') ? r.left + r.width / 2 : (e.clientX + (r.left + r.width / 2)) / 2;
          say(lineFor(el), 3600);
        }
      }
      if (!spot) st.target = e.clientX;
    }, { passive: true });
  } else {
    // touch: comment on sections as they come into view
    const seen = new Set();
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting && !seen.has(en.target.id)) { seen.add(en.target.id); wake(); say(SECTION[en.target.id], 2600); }
    }), { threshold: 1 });
    document.querySelectorAll('h2[id]').forEach((h) => SECTION[h.id] && io.observe(h));
  }
  wrap.addEventListener('click', () => {
    wake();
    st.jumpT = performance.now();
    say(['Hi! ♥', 'Thanks for visiting!', '♥ ♥', 'Hehe, that tickles.'][Math.floor(Math.random() * 4)], 2000);
  });
  window.addEventListener('scroll', () => {
    wake();
    const end = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    if (end) say('You made it to the end, thanks for visiting!', 3000);
  }, { passive: true });

  setTimeout(() => say(touch ? 'Hi! Tap me 🐼' : "Hi! I'm Sohyun's panda. Hover anything and I'll show you around.", 4200), 900);

  // ---------------------------------------------------------------- animate
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const W = document.documentElement.clientWidth, half = SIZE / 2;
    if (st.target != null) st.target = Math.min(W - half - 4, Math.max(half + 4, st.target));

    // walk toward the target
    let moving = false;
    if (st.target != null && !st.sleeping) {
      const dx = st.target - st.x;
      if (Math.abs(dx) > 3) {
        moving = true;
        const sp = reduce ? Math.abs(dx) : Math.min(Math.abs(dx), (touch ? 140 : 230) * dt);
        st.x += Math.sign(dx) * sp;
        st.dir = Math.sign(dx);
      }
    }
    st.x = Math.min(W - half - 4, Math.max(half + 4, st.x));
    if (moving && !reduce) st.phase += dt * 11; else st.phase *= 0.85;
    const sw = Math.sin(st.phase) * (moving ? 22 : 0);
    legL.setAttribute('transform', `rotate(${sw} 41 77)`);
    legR.setAttribute('transform', `rotate(${-sw} 59 77)`);
    armL.setAttribute('transform', `rotate(${-sw * 0.6} 31 60)`);
    armR.setAttribute('transform', `rotate(${sw * 0.6} 69 60)`);
    let lift = moving ? Math.abs(Math.sin(st.phase)) * 3 : Math.sin(now / 600) * 0.8;
    if (st.jumpT > 0) {
      const j = (now - st.jumpT) / 520;
      if (j < 1) lift += Math.sin(j * Math.PI) * 18; else st.jumpT = -1;
    }
    bob.setAttribute('transform', `translate(0 ${-lift})`);
    flip.setAttribute('transform', st.dir < 0 ? 'translate(100 0) scale(-1 1)' : '');

    // eyes: follow the cursor a little, blink now and then
    if (st.cursor) {
      const r = wrap.getBoundingClientRect();
      const ex = Math.max(-1.6, Math.min(1.6, (st.cursor[0] - (r.left + r.width / 2)) / 120)) * st.dir;
      const ey = Math.max(-1.2, Math.min(1.4, (st.cursor[1] - (r.top + r.height * 0.4)) / 160));
      eyes.setAttribute('transform', `translate(${ex} ${ey})`);
    }
    if (now > st.blinkT) { eyes.style.opacity = '0'; if (now > st.blinkT + 130) { eyes.style.opacity = ''; st.blinkT = now + 2500 + Math.random() * 3000; } }
    head.setAttribute('transform', moving ? `rotate(${Math.sin(st.phase * 0.5) * 3} 50 60)` : '');

    // asleep after a while alone
    if (!st.sleeping && now - st.lastAct > 45000) { st.sleeping = true; wrap.classList.add('sleeping'); bubble.classList.remove('on'); }

    // place panda and bubble
    const g = ground();
    wrap.style.transform = `translate(${st.x - half}px, 0)`;
    wrap.style.bottom = `${g}px`;
    if (now > st.bubbleUntil) bubble.classList.remove('on');
    const bw = bubble.offsetWidth || 160;
    const bx = Math.min(W - bw - 8, Math.max(8, st.x - bw / 2));
    bubble.style.transform = `translate(${bx}px, 0)`;
    bubble.style.bottom = `${g + SIZE + 6}px`;
    bubble.style.setProperty('--tail', `${Math.min(bw - 14, Math.max(14, st.x - bx))}px`);
  }
  requestAnimationFrame(frame);
})();
