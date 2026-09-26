/* Flappy Grey — game loop, state machine, input and UI wiring.
 * States: menu → countdown → playing ⇄ paused → dying → over → (retry → countdown | routes → menu) */
(function () {
  'use strict';
  const FG = window.FG;
  const { clamp, storage } = FG.util;
  const WORLD = FG.WORLD;
  const H = WORLD.H;
  const GY = WORLD.GROUND_Y;
  const R = FG.BIRD.RADIUS;

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const audio = FG.Audio;
  const scenery = new FG.Scenery();
  const obstacles = new FG.Obstacles();

  const ui = {
    hud: $('hud'),
    hudRoute: $('hud-route'),
    hudScore: $('hud-score'),
    countdown: $('countdown'),
    hint: $('hint'),
    menu: $('menu'),
    routes: $('routes'),
    pause: $('pause'),
    over: $('gameover'),
    goRoute: $('go-route'),
    goScore: $('go-score'),
    goBest: $('go-best'),
    goNew: $('go-new'),
    goMedal: $('go-medal'),
    retry: $('btn-retry'),
    heroBird: $('hero-bird'),
  };

  const best = Object.assign({ jungle: 0, savanna: 0, storm: 0 }, storage.get('flappygrey.best', {}));

  const state = {
    mode: 'menu',
    route: FG.ROUTES.jungle,
    menuRoute: 'jungle',
    pendingRoute: null,
    fade: 0,
    w: 800,
    scale: 1,
    t: 0,
    score: 0,
    shake: 0,
    flash: 0,
    cd: null,
    resumeCountdown: false,
    pausedFrom: null,
    overReadyAt: 0,
    deadTimer: 0,
    bird: { x: 200, y: 300, baseY: 300, vy: 0, rot: 0, sinceFlap: 1, grounded: false },
  };

  // ------------------------------------------------------------------
  // Sizing: logical height is fixed (720); width follows the screen aspect.
  // ------------------------------------------------------------------
  function birdX() {
    return clamp(state.w * 0.28, 90, 320);
  }

  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cssScale = Math.min(vh / H, vw / WORLD.MIN_W);
    const w = Math.min(vw / cssScale, WORLD.MAX_W);
    const cssW = w * cssScale, cssH = H * cssScale;
    Object.assign(canvas.style, {
      width: cssW + 'px',
      height: cssH + 'px',
      left: (vw - cssW) / 2 + 'px',
      top: (vh - cssH) / 2 + 'px',
    });
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(cssScale * dpr, WORLD.MAX_RENDER_SCALE);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(H * scale);
    state.w = w;
    state.scale = scale;
    scenery.setScale(scale);
    scenery.setWidth(w);
    const id = scenery.routeId || state.menuRoute;
    scenery.routeId = null;
    scenery.setRoute(id);
    obstacles.key = '';
    obstacles.build(state.route.id, scale);
    state.bird.x = birdX();
    setupHeroCanvas();
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  // ------------------------------------------------------------------
  // Menu
  // ------------------------------------------------------------------
  let heroCtx = null;
  function setupHeroCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ui.heroBird.width = 300 * dpr;
    ui.heroBird.height = 220 * dpr;
    heroCtx = ui.heroBird.getContext('2d');
    heroCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildRouteCards() {
    ui.routes.innerHTML = '';
    FG.ROUTE_ORDER.forEach((id, i) => {
      const r = FG.ROUTES[id];
      const card = document.createElement('button');
      card.className = 'route-card';
      card.dataset.route = id;
      card.setAttribute('role', 'listitem');
      card.style.setProperty('--c', r.accent);
      const pips = [1, 2, 3].map((n) => `<i class="${n <= r.level ? 'on' : ''}"></i>`).join('');
      card.innerHTML = `
        <canvas width="480" height="240" aria-hidden="true"></canvas>
        <span class="route-key">${i + 1}</span>
        <span class="route-info">
          <span class="route-name">${r.name}</span>
          <span class="route-tag">${r.tagline}</span>
          <span class="route-meta">
            <span class="diff">${r.difficulty}<span class="pips">${pips}</span></span>
            <span class="route-best">Best <b data-best="${id}">${best[id]}</b></span>
          </span>
        </span>`;
      const cv = card.querySelector('canvas');
      FG.Scenery.renderPreview(id, cv, (c) => {
        FG.Obstacles.drawStatic(c, id, 600, 380, 380 + r.gap);
        FG.Bird.draw(c, 420, 470, -0.12, 0.7, 1.9);
      });
      card.addEventListener('click', () => startRoute(id));
      card.addEventListener('mouseenter', () => previewRoute(id));
      card.addEventListener('focus', () => previewRoute(id));
      ui.routes.appendChild(card);
    });
  }

  function refreshBestLabels() {
    document.querySelectorAll('[data-best]').forEach((el) => {
      el.textContent = best[el.dataset.best] || 0;
    });
  }

  function previewRoute(id) {
    document.querySelectorAll('.route-card').forEach((c) => c.classList.toggle('active', c.dataset.route === id));
    if (id === state.menuRoute && !state.pendingRoute) return;
    state.menuRoute = id;
    state.pendingRoute = id;
  }

  function showMenu() {
    state.mode = 'menu';
    state.cd = null;
    ui.hud.classList.add('hidden');
    ui.countdown.classList.add('hidden');
    ui.hint.classList.add('hidden');
    ui.pause.classList.add('hidden');
    ui.over.classList.add('hidden');
    ui.menu.classList.remove('hidden');
    refreshBestLabels();
    previewRoute(state.route.id);
    audio.stopAmbience();
    audio.playMenuMusic();
  }

  // ------------------------------------------------------------------
  // Run lifecycle
  // ------------------------------------------------------------------
  function startRoute(id) {
    audio.unlock();
    audio.uiClick();
    state.route = FG.ROUTES[id];
    state.menuRoute = id;
    state.pendingRoute = null;
    state.fade = 0;
    scenery.setRoute(id);
    obstacles.build(id, state.scale);
    document.documentElement.style.setProperty('--accent', state.route.accent);
    ui.hudRoute.textContent = state.route.name;
    ui.menu.classList.add('hidden');
    audio.stopMenuMusic();
    audio.startAmbience(id);
    beginRun();
  }

  function beginRun() {
    obstacles.reset();
    state.score = 0;
    setScore(false);
    const b = state.bird;
    b.x = birdX();
    b.baseY = GY * 0.44;
    b.y = b.baseY;
    b.vy = 0;
    b.rot = 0;
    b.sinceFlap = 1;
    b.grounded = false;
    state.shake = 0;
    state.flash = 0;
    ui.over.classList.add('hidden');
    ui.pause.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ui.hint.classList.remove('hidden');
    startCountdown(false);
  }

  const CD_FULL = [['GET READY', 1.2, 'small'], ['3', 0.72], ['2', 0.72], ['1', 0.72], ['GO!', 0.6, 'go']];
  const CD_RESUME = [['3', 0.62], ['2', 0.62], ['1', 0.62], ['GO!', 0.5, 'go']];

  function startCountdown(resume) {
    state.mode = 'countdown';
    state.resumeCountdown = resume;
    state.cd = { seq: resume ? CD_RESUME : CD_FULL, i: -1, t: 0 };
    ui.countdown.classList.remove('hidden');
    advanceCountdown();
  }

  function advanceCountdown() {
    const cd = state.cd;
    cd.i++;
    if (cd.i >= cd.seq.length) {
      state.cd = null;
      ui.countdown.classList.add('hidden');
      return;
    }
    const [txt, dur, cls] = cd.seq[cd.i];
    cd.t = dur;
    ui.countdown.className = 'countdown ' + (cls || '');
    ui.countdown.innerHTML = `<span>${txt}</span>`;
    void ui.countdown.offsetWidth; // restart pop animation
    ui.countdown.classList.add('pop');
    const isGo = cd.i === cd.seq.length - 1;
    if (txt !== 'GET READY') audio.countdown(isGo);
    if (isGo) {
      state.mode = 'playing';
      if (state.resumeCountdown) state.bird.vy = 0;
    }
  }

  function flap() {
    if (state.mode !== 'playing') return;
    const b = state.bird;
    b.vy = -state.route.flap;
    b.sinceFlap = 0;
    audio.flap();
    ui.hint.classList.add('hidden');
  }

  function setScore(bump) {
    ui.hudScore.textContent = state.score;
    if (bump) {
      ui.hudScore.classList.remove('bump');
      void ui.hudScore.offsetWidth;
      ui.hudScore.classList.add('bump');
    }
  }

  function die() {
    if (state.mode !== 'playing') return;
    state.mode = 'dying';
    state.shake = 0.35;
    state.flash = 1;
    state.cd = null;
    ui.countdown.classList.add('hidden');
    ui.hint.classList.add('hidden');
    audio.hit();
    state.bird.vy = Math.min(state.bird.vy, -120);
  }

  function showGameOver() {
    state.mode = 'over';
    const id = state.route.id;
    const prev = best[id] || 0;
    const isNew = state.score > prev;
    if (isNew) {
      best[id] = state.score;
      storage.set('flappygrey.best', best);
    }
    ui.goRoute.textContent = `${state.route.name} · ${state.route.difficulty}`;
    ui.goScore.textContent = state.score;
    ui.goBest.textContent = best[id];
    ui.goNew.classList.toggle('hidden', !isNew);
    const medal = FG.MEDALS.find((m) => state.score >= m.min);
    ui.goMedal.className = 'medal ' + (medal ? medal.cls : 'none');
    ui.goMedal.innerHTML = `<span>${medal ? medal.name : '—'}</span>`;
    ui.over.classList.remove('hidden');
    ui.retry.disabled = true;
    state.overReadyAt = performance.now() + 450;
    setTimeout(() => (ui.retry.disabled = false), 450);
    if (isNew) setTimeout(() => audio.newBest(), 250);
  }

  function retry() {
    if (state.mode !== 'over' || performance.now() < state.overReadyAt) return;
    audio.uiClick();
    beginRun();
  }

  function pause() {
    if (state.mode !== 'playing' && state.mode !== 'countdown') return;
    state.pausedFrom = state.mode === 'countdown' && !state.resumeCountdown ? 'intro' : 'run';
    state.mode = 'paused';
    ui.countdown.classList.add('hidden');
    ui.pause.classList.remove('hidden');
  }

  function resume() {
    if (state.mode !== 'paused') return;
    ui.pause.classList.add('hidden');
    audio.uiClick();
    if (state.pausedFrom === 'intro') startCountdown(false);
    else startCountdown(true);
  }

  function togglePause() {
    if (state.mode === 'paused') resume();
    else pause();
  }

  // ------------------------------------------------------------------
  // Sound toggle
  // ------------------------------------------------------------------
  const ICON_ON = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="#f4f6f8" stroke-width="2" stroke-linecap="round"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#f4f6f8" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="#f4f6f8" stroke-width="2" stroke-linecap="round"/></svg>';
  function renderSoundButtons() {
    document.querySelectorAll('.sound-toggle').forEach((b) => {
      b.innerHTML = audio.muted ? ICON_OFF : ICON_ON;
      b.setAttribute('aria-pressed', String(!audio.muted));
    });
  }
  function toggleMute() {
    audio.unlock();
    audio.setMuted(!audio.muted);
    renderSoundButtons();
  }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    audio.unlock();
    const m = state.mode;
    switch (e.code) {
      case 'Space':
      case 'ArrowUp':
      case 'KeyW':
        if (m === 'menu') {
          const card = document.activeElement && document.activeElement.closest && document.activeElement.closest('.route-card');
          if (card && e.code === 'Space') {
            e.preventDefault();
            startRoute(card.dataset.route);
          }
          return;
        }
        e.preventDefault();
        if (e.repeat) return;
        if (m === 'playing') flap();
        else if (m === 'over') retry();
        else if (m === 'paused') resume();
        break;
      case 'Enter':
        if (m === 'over') { e.preventDefault(); retry(); }
        else if (m === 'paused') { e.preventDefault(); resume(); }
        break;
      case 'KeyR':
        if (m === 'over') retry();
        break;
      case 'KeyP':
        togglePause();
        break;
      case 'Escape':
        if (m === 'playing' || m === 'countdown') pause();
        else if (m === 'paused') resume();
        else if (m === 'over') { audio.uiClick(); showMenu(); }
        break;
      case 'KeyM':
        toggleMute();
        break;
      case 'Digit1': case 'Digit2': case 'Digit3':
      case 'Numpad1': case 'Numpad2': case 'Numpad3':
        if (m === 'menu') startRoute(FG.ROUTE_ORDER[parseInt(e.code.slice(-1), 10) - 1]);
        break;
      default:
    }
  });

  $('app').addEventListener('pointerdown', (e) => {
    audio.unlock();
    if (e.target.closest('button, .panel, #menu')) return;
    if (state.mode === 'playing') {
      e.preventDefault();
      flap();
    }
  });

  // Unlock audio / start menu theme on first interaction anywhere
  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, () => audio.unlock(), { passive: true }));

  document.querySelectorAll('.sound-toggle').forEach((b) => b.addEventListener('click', toggleMute));
  $('btn-pause').addEventListener('click', togglePause);
  $('btn-resume').addEventListener('click', resume);
  $('btn-retry').addEventListener('click', retry);
  $('btn-routes').addEventListener('click', () => { audio.uiClick(); showMenu(); });
  $('btn-pause-routes').addEventListener('click', () => { audio.uiClick(); showMenu(); });

  // Auto-pause when the tab/app goes to the background (important for mobile builds)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause();
      audio.suspend();
    } else {
      audio.resume();
    }
  });
  window.addEventListener('blur', () => pause());

  // ------------------------------------------------------------------
  // Simulation
  // ------------------------------------------------------------------
  function currentSpeed() {
    const r = state.route;
    return r.speed * (1 + r.ramp * Math.min(state.score / 40, 1));
  }

  const onThunder = (delay) => {
    if (state.mode !== 'menu') audio.thunder(delay);
  };

  function update(dt) {
    state.t += dt;
    const b = state.bird;
    const r = state.route;

    if (state.cd && state.mode !== 'paused') {
      state.cd.t -= dt;
      if (state.cd.t <= 0) advanceCountdown();
    }

    switch (state.mode) {
      case 'menu': {
        // Crossfade to the hovered route's world
        if (state.pendingRoute) {
          state.fade = Math.min(1, state.fade + dt * 6);
          if (state.fade >= 1) {
            scenery.setRoute(state.pendingRoute);
            state.pendingRoute = null;
          }
        } else state.fade = Math.max(0, state.fade - dt * 4);
        scenery.update(dt, FG.ROUTES[scenery.routeId].speed * 0.6, onThunder);
        break;
      }
      case 'countdown': {
        if (!state.resumeCountdown) {
          b.y = b.baseY + Math.sin(state.t * 4.5) * 8;
          b.rot = Math.sin(state.t * 4.5 + 1.2) * 0.05;
          scenery.update(dt, r.speed, onThunder);
        } else {
          scenery.update(dt, 0, onThunder);
        }
        break;
      }
      case 'playing': {
        const speed = currentSpeed();
        b.vy = Math.min(b.vy + r.gravity * dt, FG.BIRD.MAX_FALL);
        b.y += b.vy * dt;
        b.sinceFlap += dt;
        const target = clamp(b.vy / 620, -0.45, 1.25);
        b.rot += (target - b.rot) * Math.min(1, dt * (target > b.rot ? 6 : 14));
        scenery.update(dt, speed, onThunder);
        obstacles.update(dt, speed, state.w, r, r.gap);
        const n = obstacles.score(b.x);
        if (n) {
          state.score += n;
          setScore(true);
          audio.score();
        }
        if (b.y - R < 0 || b.y + R >= GY || obstacles.collides(b.x, b.y, R)) die();
        break;
      }
      case 'dying': {
        b.vy = Math.min(b.vy + r.gravity * 1.1 * dt, FG.BIRD.MAX_FALL * 1.2);
        b.y += b.vy * dt;
        b.rot += (1.5 - b.rot) * Math.min(1, dt * 7);
        scenery.update(dt, 0, onThunder);
        if (b.y + R * 0.7 >= GY) {
          b.y = GY - R * 0.7;
          b.grounded = true;
          audio.thud();
          state.shake = Math.max(state.shake, 0.15);
          state.mode = 'dead';
          state.deadTimer = 0.55;
        }
        break;
      }
      case 'dead': {
        scenery.update(dt, 0, onThunder);
        state.deadTimer -= dt;
        if (state.deadTimer <= 0) showGameOver();
        break;
      }
      case 'over':
        scenery.update(dt, 0, onThunder);
        break;
      default:
    }
    state.shake = Math.max(0, state.shake - dt);
    state.flash = Math.max(0, state.flash - dt * 4);
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------
  function birdWing() {
    const b = state.bird;
    switch (state.mode) {
      case 'countdown':
        return state.resumeCountdown ? 0.25 : FG.Bird.hoverPose(state.t, 13);
      case 'playing':
        return FG.Bird.wingPose(b.sinceFlap, b.vy);
      case 'paused':
        return 0.25;
      case 'dying':
        return 0.95 + Math.sin(state.t * 30) * 0.2;
      default:
        return b.grounded ? -0.35 : 0.3;
    }
  }

  function render() {
    const s = state.scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    if (state.shake > 0) {
      const k = state.shake * 22;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
    scenery.drawBack(ctx);
    const inGame = state.mode !== 'menu';
    if (inGame) obstacles.draw(ctx);
    scenery.drawGround(ctx);
    if (inGame) {
      const b = state.bird;
      FG.Bird.draw(ctx, b.x, b.y, b.rot, birdWing(), 1.15);
    }
    scenery.drawFront(ctx);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.6})`;
      ctx.fillRect(0, 0, state.w, H);
    }
    if (state.fade > 0) {
      ctx.fillStyle = `rgba(4,8,12,${state.fade})`;
      ctx.fillRect(0, 0, state.w, H);
    }
    if (state.mode === 'menu' && heroCtx) {
      heroCtx.clearRect(0, 0, 300, 220);
      const bob = Math.sin(state.t * 2.6) * 6;
      FG.Bird.draw(heroCtx, 158, 120 + bob, -0.08 + Math.sin(state.t * 2.6 + 1) * 0.04, FG.Bird.hoverPose(state.t, 9), 2.6);
    }
  }

  // ------------------------------------------------------------------
  // Main loop (fixed-step physics, render every frame)
  // ------------------------------------------------------------------
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (state.mode !== 'paused') {
      acc += dt;
      while (acc >= WORLD.STEP) {
        update(WORLD.STEP);
        acc -= WORLD.STEP;
      }
    } else acc = 0;
    render();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  $('ver').textContent = FG.VERSION;
  resize();
  buildRouteCards();
  renderSoundButtons();
  showMenu();
  requestAnimationFrame(frame);

  // Test/debug hook (harmless in production)
  FG.debug = { state, startRoute, flap, obstacles, scenery, showMenu };
})();
