/* PIXEL QUEST - game.js
 * Game state machine (title, level intro, play, pause, clear, game over, victory),
 * level runtime, effects, camera, rendering and HUD.
 */
'use strict';
(function () {
  const PQ = window.PQ, T = PQ.T, W = PQ.W, H = PQ.H;
  const Art = PQ.Art, F = PQ.Font, I = PQ.Input, Au = PQ.Audio, E = PQ.Ent;
  const DYN = { '?': 1, P: 1, R: 1, B: 1, U: 1, X: 1 };
  const STEP = 1 / 60;
  const pad = (n, l) => String(Math.max(0, Math.floor(n))).padStart(l, '0');

  const Game = (PQ.Game = {
    t: 0, frame: 0, state: 'title', god: false,
    score: 0, coins: 0, lives: 3,
    fx: [], popups: [], shots: [],
    cam: { x: 0, y: 0, look: 0 }, shakeMag: 0, shakeX: 0, shakeY: 0, whiteFlash: 0,
    trans: null, menuRects: [],

    /* ------------------------------------------------------------ */
    init() {
      this.canvas = document.getElementById('game');
      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      Art.build();
      Art.buildBackgrounds();
      PQ.Save.load();
      Au.musicOn = PQ.Save.data.music !== false;
      Au.sfxOn = PQ.Save.data.sfx !== false;
      I.init(this.canvas);
      this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      this.touchEl = document.getElementById('touch');
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
      this.resize();
      this.title = { phase: 'press', sel: 0, t: 0 };
      this.buildTitleGround();
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.openPause(); });
      this.initNative();
      let last = performance.now(), acc = 0;
      const loop = (now) => {
        let dt = (now - last) / 1000; last = now;
        if (dt > 0.25) dt = 0.25;
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 5) { I.update(); this.update(STEP); acc -= STEP; steps++; }
        if (steps >= 5) acc = 0;
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
    resize() {
      const vw = window.innerWidth, vh = window.innerHeight;
      let s = Math.min(vw / W, vh / H);
      if (s >= 2 && Math.floor(s) / s > 0.88) s = Math.floor(s);
      this.canvas.style.width = Math.floor(W * s) + 'px';
      this.canvas.style.height = Math.floor(H * s) + 'px';
    },
    /** Android (Capacitor) integration: hardware back button, app pause/resume, audio unlock. */
    initNative() {
      // Resume audio on any touch (Android WebView may suspend it while the app is in the background)
      document.addEventListener('touchstart', () => { if (Au.ctx && Au.ctx.state !== 'running') Au.ctx.resume(); }, { passive: true });
      const Cap = window.Capacitor;
      this.isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
      if (!this.isNative) return;
      this.isTouch = true;
      const App = Cap.Plugins && Cap.Plugins.App;
      if (!App) return;
      App.addListener('backButton', () => {
        if (this.trans) return;
        if (this.state === 'play') this.openPause();
        else if (this.state === 'pause') { this.state = 'play'; this.sfx('pause'); }
        else if (this.state === 'title') App.exitApp();
        else if (this.state === 'gameover' || this.state === 'victory') this.transition(() => { this.state = 'title'; this.title.phase = 'menu'; this.title.sel = 0; Au.play('title'); });
      });
      App.addListener('pause', () => { if (this.state === 'play') this.openPause(); if (Au.ctx) Au.ctx.suspend(); });
      App.addListener('resume', () => { if (Au.ctx) Au.ctx.resume(); });
    },
    sfx(n) { Au.sfx(n); },
    music(n) { Au.play(n); },

    /* ------------------------------------------------------------ */
    /* Level lifecycle                                               */
    /* ------------------------------------------------------------ */
    newGame(levelIdx) {
      this.score = 0; this.coins = 0; this.lives = 3;
      this.startLevel(levelIdx || 0);
    },
    startLevel(i) {
      this.levelIdx = i;
      this.levelStart = { score: this.score, coins: this.coins };
      this.loadLevel(i);
      this.state = 'intro'; this.introT = 0;
      Au.stop();
    },
    loadLevel(i) {
      const def = PQ.Levels[i]();
      const b = def.b;
      const grid = b.g.map((r) => r.slice());
      this.level = { idx: i, name: def.name, world: def.world, theme: def.theme, music: def.music, w: b.w, h: b.h, arena: def.arena || null };
      this.arena = def.arena ? Object.assign({ locked: false }, def.arena) : null;
      this.world = new PQ.World(grid);
      this.terrain = Art.renderTerrain(grid, def.theme);
      const reserved = new Set();
      for (const e of b.ents) reserved.add(e.x + ',' + e.y);
      this.decor = Art.genDecor(grid, def.theme, def.seed, reserved);
      this.coinList = []; this.enemies = []; this.hazards = []; this.platforms = []; this.items = []; this.checkpoints = [];
      this.flag = null; this.boss = null; this.bossReady = false;
      this.fx = []; this.popups = []; this.shots = []; this.bumps = new Map(); this.rocksWarn = [];
      this.bgFx = [];
      let start = { x: 2, y: 11 };
      for (const e of b.ents) {
        switch (e.t) {
          case 'start': start = e; break;
          case 'coin': this.coinList.push({ x: e.x * T + 3, y: e.y * T + 2, w: 10, h: 12, taken: false, ph: Math.random() * 6 }); break;
          case 'slime': case 'beetle': case 'imp': this.enemies.push(new E.Walker(e.t, e.x, e.y)); break;
          case 'bat': this.enemies.push(new E.Bat(e.x, e.y)); break;
          case 'ember': this.hazards.push(new E.Ember(e.x, e.y)); break;
          case 'jet': this.hazards.push(new E.Jet(e.x, e.y)); break;
          case 'crusher': this.hazards.push(new E.Crusher(e.x, e.y)); break;
          case 'mover': this.platforms.push(new E.Mover(e)); break;
          case 'checkpoint': this.checkpoints.push({ x: e.x * T + 2, y: (e.y + 1) * T - 32, w: 12, h: 32, active: false, t: 0 }); break;
          case 'flag': this.flag = this.makeFlag(e.x, e.y); break;
          case 'boss': this.bossDef = e; this.boss = new E.Boss(this, e.x, e.y); break;
        }
      }
      this.startPos = { x: start.x * T + 3, y: (start.y + 1) * T - 14 };
      this.respawn = Object.assign({}, this.startPos);
      this.player = new PQ.Player(this.startPos.x, this.startPos.y);
      this.snapCamera();
      this.levelT = 0;
    },
    makeFlag(tx, ty) {
      const bottom = (ty + 1) * T;
      return { x: tx * T + 6, top: bottom - 8 * T, bottom, raise: 0, w: 4 };
    },
    snapCamera() {
      const p = this.player;
      this.cam.look = 0;
      this.cam.x = PQ.clamp(p.cx - W / 2, 0, this.level.w * T - W);
      this.cam.y = PQ.clamp(p.y - H * 0.55, 0, this.level.h * T - H);
    },

    killPlayer(kind) {
      const p = this.player;
      if (p.dead || this.state !== 'play') return;
      if (this.god && kind === 'hit') return;
      p.dead = true; p.deadT = 0; p.deadKind = kind === 'hit' ? 'hit' : 'fall';
      p.vy = -430; p.vx = 0; p.inv = 0;
      if (kind === 'water') { this.sfx('splash'); this.burst(p.cx, p.y + p.h, 16, ['#ffffff', '#6ac0ff', '#2a7ad8'], 140, 0.6, 500, 2); }
      if (kind === 'lava') { this.sfx('sizzle'); this.burst(p.cx, p.y + p.h, 18, ['#ffd23a', '#ff7a1a', '#ff3a10'], 150, 0.6, 400, 2); }
      Au.stop();
      this.sfx('die');
      this.deathT = p.deadKind === 'hit' ? 2.3 : 1.7;
      this.lives--;
    },
    doRespawn() {
      const p = this.player;
      const cd = p.canDouble;
      p.reset(this.respawn.x, this.respawn.y);
      p.canDouble = cd;
      p.inv = 1.2;
      this.shots.length = 0; this.rocksWarn.length = 0;
      if (this.arena && this.arena.locked && this.boss && this.boss.alive) {
        this.arena.locked = false;
        const d = this.arena.door;
        for (let y = d.y0; y <= d.y1; y++) this.world.set(d.x, y, ' ');
        this.boss.reset();
        this.bossReady = false;
      }
      this.snapCamera();
      this.music(this.level.music);
    },
    openPause() {
      if (this.state !== 'play') return;
      this.state = 'pause'; this.pauseSel = 0; this.sfx('pause');
    },
    gameOver() {
      this.state = 'gameover'; this.goSel = 0; this.goT = 0;
      Au.play('gameover');
      this.saveHi();
    },
    saveHi() {
      if (this.score > (PQ.Save.data.hi || 0)) { PQ.Save.data.hi = this.score; PQ.Save.store(); }
    },
    transition(fn) { if (this.trans) return; this.trans = { t: 0, phase: 'out', fn }; },

    /* ------------------------------------------------------------ */
    /* Gameplay events                                               */
    /* ------------------------------------------------------------ */
    addScore(n, x, y) {
      this.score += n;
      if (x !== undefined) this.popup(String(n), x, y, '#ffffff');
    },
    addCoin(x, y) {
      this.coins++;
      this.score += 50;
      this.sfx('coin');
      this.sparkle(x, y);
      if (this.coins >= 100) { this.coins -= 100; this.lives++; this.sfx('oneup'); this.popup('1UP', x, y - 8, '#3ae070'); }
    },
    hitBlock(tx, ty) {
      const c = this.world.tile(tx, ty);
      const key = tx + ',' + ty;
      // knock enemies standing on the block
      const top = { x: tx * T, y: ty * T - 4, w: T, h: 4 };
      for (const e of this.enemies) if (e.alive && PQ.overlap(top, { x: e.x, y: e.y + e.h - 2, w: e.w, h: 3 })) { e.knock(this, 1); this.addScore(e.points, e.x, e.y); this.sfx('stomp'); }
      const top2 = { x: tx * T, y: ty * T - 14, w: T, h: 14 };
      for (const cn of this.coinList) if (!cn.taken && PQ.overlap(top2, cn)) { cn.taken = true; this.addCoin(cn.x + 5, cn.y + 6); }
      switch (c) {
        case '?': case 'h':
          this.world.set(tx, ty, 'U'); this.bumps.set(key, 0);
          this.items.push(new E.Item('coinpop', tx * T + 3, ty * T - 12));
          this.addCoin(tx * T + 8, ty * T - 8);
          this.sfx('bump');
          break;
        case 'P': case 'R': case 'H':
          this.world.set(tx, ty, 'U'); this.bumps.set(key, 0);
          this.items.push(new E.Item(c === 'P' ? 'feather' : c === 'R' ? 'heart' : 'gem', tx * T + 2, ty * T + 2));
          this.sfx('appear');
          break;
        case 'B':
          this.world.set(tx, ty, ' ');
          this.sfx('break');
          this.addScore(50);
          for (let i = 0; i < 4; i++) {
            this.fx.push({ x: tx * T + 4 + (i % 2) * 8, y: ty * T + 4 + (i >> 1) * 8, vx: (i % 2 ? 1 : -1) * (60 + Math.random() * 40), vy: -280 + (i >> 1) * 90, life: 1.2, max: 1.2, color: { emerald: '#c8642c', crystal: '#7a4ad0', lava: '#8a2a2a' }[this.level.theme], size: 5, g: 1200, kind: 'debris' });
          }
          this.burst(tx * T + 8, ty * T + 8, 6, ['#ffffff', '#cccccc'], 80, 0.3, 0, 1);
          break;
        default:
          this.bumps.set(key, 0);
          this.sfx('bump');
      }
    },
    collectItem(it) {
      const p = this.player;
      if (it.kind === 'feather') {
        p.canDouble = true; this.sfx('powerup');
        this.popup('DOUBLE JUMP!', it.x + 6, it.y - 4, '#8ae4ff');
        this.addScore(1000);
        this.ring(it.x + 6, it.y + 6, '#8ae4ff');
      } else if (it.kind === 'heart') {
        if (p.hp < 3) { p.hp++; this.popup('+1 HEART', it.x + 6, it.y - 4, '#ff6a8a'); } else this.addScore(1000, it.x + 6, it.y - 4);
        this.sfx('heart');
        this.ring(it.x + 6, it.y + 6, '#ff6a8a');
      } else if (it.kind === 'gem') {
        this.lives++; this.sfx('oneup');
        this.popup('1UP', it.x + 6, it.y - 4, '#3ae070');
        this.ring(it.x + 6, it.y + 6, '#3ae070');
      }
    },
    addShock(x, dir, mul) { this.shots.push({ kind: 'shock', x, y: this.boss.groundY - 14, w: 12, h: 14, vx: dir * 165 * mul, vy: 0, t: 0 }); },
    dropRocks(n) {
      const p = this.player;
      for (let i = 0; i < n; i++) {
        const x = PQ.clamp(p.cx - 6 + (i - (n - 1) / 2) * 52 + (Math.random() - 0.5) * 20, (this.arena.x0 + 1) * T, this.arena.x1 * T - 12);
        this.rocksWarn.push({ x, t: 0.75 + i * 0.12 });
      }
    },
    bossDefeated(b) {
      this.addScore(5000, b.cx, b.y);
      this.flag = this.makeFlag(Math.floor((this.arena.x0 + this.arena.x1) / 2), 12);
      this.flag.drop = -220;
      Au.play('clear');
    },
    levelClear() {
      if (this.state !== 'play') return;
      this.state = 'clear'; this.clearT = 0;
      const p = this.player;
      p.vx = 0; p.vy = 0; p.riding = null;
      this.sfx('flag');
      if (this.levelIdx < 2 || !this.boss) Au.play('clear');
      p.x = this.flag.x - p.w + 1;
      p.facing = 1;
      p.forceFrame = 'fall';
      this.clearBonus = 1000 + p.hp * 500;
      const flagTopBonus = Math.max(0, Math.round((this.flag.bottom - (p.y + p.h)) / 16)) * 100;
      this.clearBonus += flagTopBonus;
      this.tallyShown = 0;
      p.auto = (dt, G) => {
        const f = G.flag;
        f.raise = Math.min(1, f.raise + dt * 0.9);
        if (!p.slid && p.y + p.h < f.bottom - 0.5) { p.y = Math.min(f.bottom - p.h, p.y + 130 * dt); p.forceFrame = 'fall'; p.onGround = false; return; }
        p.slid = true; p.forceFrame = null;
        if (G.clearT > 1.1) { G.world.moveX(p, 80 * dt); p.vx = 80; p.runDist += 80 * dt; } else p.vx = 0;
        p.vy = Math.min(p.vy + 1600 * dt, 500); p.onGround = false;
        const h = G.world.moveY(p, p.vy * dt);
        if (h && h.side === 'bottom') { p.onGround = true; p.vy = 0; }
      };
    },

    /* ------------------------------------------------------------ */
    /* Effects                                                       */
    /* ------------------------------------------------------------ */
    particle(x, y, vx, vy, life, color, size, g) { if (this.fx.length < 600) this.fx.push({ x, y, vx, vy, life, max: life, color, size, g: g || 0 }); },
    burst(x, y, n, colors, speed, life, g, size) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
        this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s - speed * 0.3, life * (0.6 + Math.random() * 0.4), colors[i % colors.length], size || 1, g);
      }
    },
    sparkle(x, y) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.particle(x, y, Math.cos(a) * 70, Math.sin(a) * 70, 0.35, i % 2 ? '#fff6b0' : '#ffd23a', 2, 0);
      }
      this.fx.push({ x, y, life: 0.3, max: 0.3, kind: 'star' });
    },
    ring(x, y, color) { this.fx.push({ x, y, life: 0.4, max: 0.4, kind: 'ring', color: color || '#ffffff' }); },
    dust(x, y, n) {
      for (let i = 0; i < n; i++) this.particle(x + (Math.random() - 0.5) * 8, y - 2, (Math.random() - 0.5) * 60, -10 - Math.random() * 30, 0.35 + Math.random() * 0.2, this.level && this.level.theme === 'emerald' ? '#e8dcc0' : '#a898b0', 2, 40);
    },
    lavaSplash(x, y) { this.burst(x, y, 8, ['#ffd23a', '#ff7a1a', '#ff3a10'], 110, 0.5, 500, 2); },
    explosion(x, y) {
      this.fx.push({ x, y, life: 0.45, max: 0.45, kind: 'boom', r: 8 + Math.random() * 10 });
      this.burst(x, y, 6, ['#fff6c0', '#ffd23a', '#ff7a1a', '#5a4a52'], 140, 0.6, 200, 2);
    },
    popup(text, x, y, color) { this.popups.push({ text, x, y, t: 0, color: color || '#fff' }); },
    shake(m) { this.shakeMag = Math.max(this.shakeMag, m); },
    onScreen(o, m) { return o.x + (o.w || 0) > this.cam.x - m && o.x < this.cam.x + W + m && o.y + (o.h || 0) > this.cam.y - m && o.y < this.cam.y + H + m; },

    /* ------------------------------------------------------------ */
    /* Update                                                        */
    /* ------------------------------------------------------------ */
    update(dt) {
      this.t += dt; this.frame++;
      if (this.trans) {
        const tr = this.trans;
        tr.t += dt;
        if (tr.phase === 'out' && tr.t >= 0.35) { tr.phase = 'in'; tr.t = 0; tr.fn(); }
        else if (tr.phase === 'in' && tr.t >= 0.35) this.trans = null;
        if (tr.phase === 'out') return;
      }
      this.updateTouchUI();
      switch (this.state) {
        case 'title': this.updateTitle(dt); break;
        case 'intro':
          this.introT += dt;
          if (this.introT > 2.4 || (this.introT > 0.6 && (I.pressed('confirm') || I.takePointer()))) { this.state = 'play'; this.music(this.level.music); }
          break;
        case 'play': this.updatePlay(dt); break;
        case 'pause': this.updatePause(); break;
        case 'clear': this.updatePlay(dt); this.updateClear(dt); break;
        case 'gameover': this.updateGameOver(dt); break;
        case 'victory': this.updateVictory(dt); break;
      }
    },
    updateTouchUI() {
      const show = this.isTouch && (this.state === 'play');
      if (show !== this._touchShown) { this._touchShown = show; this.touchEl.classList.toggle('show', show); }
    },
    menuInput(count, sel) {
      let chosen = -1;
      if (I.pressed('up')) { sel = (sel + count - 1) % count; this.sfx('select'); }
      if (I.pressed('down')) { sel = (sel + 1) % count; this.sfx('select'); }
      if (I.pressed('confirm')) chosen = sel;
      const ptr = I.takePointer();
      if (ptr) {
        this.menuRects.forEach((r, i) => { if (ptr.x >= r.x && ptr.x <= r.x + r.w && ptr.y >= r.y && ptr.y <= r.y + r.h) { sel = i; chosen = i; } });
      }
      if (chosen >= 0) this.sfx('confirm');
      return { sel, chosen };
    },
    titleItems() {
      const items = [{ label: 'NEW GAME', act: 'new' }];
      const u = PQ.Save.data.unlocked || 0;
      if (u > 0) items.push({ label: 'CONTINUE - WORLD ' + (u + 1), act: 'cont' });
      items.push({ label: 'MUSIC: ' + (Au.musicOn ? 'ON' : 'OFF'), act: 'music' });
      items.push({ label: 'SOUND FX: ' + (Au.sfxOn ? 'ON' : 'OFF'), act: 'sfx' });
      return items;
    },
    updateTitle(dt) {
      const tt = this.title;
      tt.t += dt;
      if (tt.phase === 'press') {
        if (I.takeAny() || I.pressed('confirm')) {
          I.takePointer();
          Au.init();
          if (this.isTouch && !this.isNative) this.tryFullscreen();
          Au.play('title');
          tt.phase = 'menu'; tt.sel = 0;
          this.sfx('confirm');
        }
        return;
      }
      const items = this.titleItems();
      const r = this.menuInput(items.length, tt.sel);
      tt.sel = r.sel;
      if (r.chosen >= 0) {
        const a = items[r.chosen].act;
        if (a === 'new') this.transition(() => this.newGame(0));
        else if (a === 'cont') this.transition(() => this.newGame(PQ.Save.data.unlocked));
        else if (a === 'music') { Au.setMusic(!Au.musicOn); PQ.Save.data.music = Au.musicOn; PQ.Save.store(); if (Au.musicOn) { Au.stop(); Au.play('title'); } }
        else if (a === 'sfx') { Au.setSfx(!Au.sfxOn); PQ.Save.data.sfx = Au.sfxOn; PQ.Save.store(); this.sfx('coin'); }
      }
    },
    tryFullscreen() {
      try {
        const el = document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* */ } }).catch(() => {});
      } catch (e) { /* not supported */ }
    },
    updatePause() {
      if (I.pressed('pause')) { this.state = 'play'; this.sfx('pause'); return; }
      const r = this.menuInput(4, this.pauseSel);
      this.pauseSel = r.sel;
      switch (r.chosen) {
        case 0: this.state = 'play'; break;
        case 1: this.transition(() => { this.lives = Math.max(1, this.lives); this.score = this.levelStart.score; this.coins = this.levelStart.coins; this.startLevel(this.levelIdx); }); break;
        case 2: Au.setMusic(!Au.musicOn); PQ.Save.data.music = Au.musicOn; PQ.Save.store(); break;
        case 3: this.saveHi(); this.transition(() => { this.state = 'title'; this.title.phase = 'menu'; this.title.sel = 0; Au.stop(); Au.play('title'); }); break;
      }
    },
    updateGameOver(dt) {
      this.goT += dt;
      if (this.goT < 1.2) { I.takePointer(); return; }
      const r = this.menuInput(2, this.goSel);
      this.goSel = r.sel;
      if (r.chosen === 0) this.transition(() => { this.lives = 3; this.score = this.levelStart.score; this.coins = this.levelStart.coins; this.startLevel(this.levelIdx); });
      if (r.chosen === 1) this.transition(() => { this.state = 'title'; this.title.phase = 'menu'; this.title.sel = 0; Au.play('title'); });
    },
    updateVictory(dt) {
      this.vicT += dt;
      if (this.frame % 25 === 0) this.firework();
      for (const f of this.fx) { f.life -= dt; f.vy += (f.g || 0) * dt; f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt; }
      this.fx = this.fx.filter((f) => f.life > 0);
      if (this.vicT > 3 && (I.pressed('confirm') || I.takePointer())) {
        this.transition(() => { this.state = 'title'; this.title.phase = 'menu'; this.title.sel = 0; Au.play('title'); });
      }
    },
    firework() {
      const x = 60 + Math.random() * (W - 120), y = 30 + Math.random() * 80;
      const cols = [['#ffd23a', '#ffffff'], ['#ff6ad8', '#ffffff'], ['#5af0ff', '#ffffff'], ['#3ae070', '#fff6b0']][(Math.random() * 4) | 0];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2, s = 60 + Math.random() * 30;
        this.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.1, max: 1.1, color: cols[i % 2], size: 2, g: 60 });
      }
      this.sfx('clink');
    },
    updateClear(dt) {
      this.clearT += dt;
      if (this.clearT > 2.6 && this.clearBonus > 0) {
        const step = Math.min(this.clearBonus, 50);
        this.clearBonus -= step; this.score += step;
        if (this.frame % 3 === 0) this.sfx('select');
      }
      const done = this.clearT > 5.5 || (this.clearT > 3 && I.pressed('confirm'));
      if (done && !this.trans) {
        this.saveHi();
        if (this.levelIdx >= PQ.Levels.length - 1) {
          this.transition(() => { this.state = 'victory'; this.vicT = 0; this.fx = []; Au.play('victory', () => { if (this.state === 'victory') Au.play('title'); }); this.saveHi(); });
        } else {
          const next = this.levelIdx + 1;
          PQ.Save.data.unlocked = Math.max(PQ.Save.data.unlocked || 0, next); PQ.Save.store();
          this.transition(() => this.startLevel(next));
        }
      }
    },

    updatePlay(dt) {
      const p = this.player;
      if (this.state === 'play' && I.pressed('pause')) { this.openPause(); return; }
      this.levelT += dt;
      for (const m of this.platforms) m.update(dt);
      p.update(dt, this);
      if (this.state === 'play' && p.dead) {
        this.deathT -= dt;
        if (this.deathT <= 0) {
          if (this.lives > 0) this.transition(() => this.doRespawn());
          else this.gameOver();
        }
      }
      // checkpoints
      for (const c of this.checkpoints) {
        c.t += dt;
        if (!c.active && !p.dead && PQ.overlap(p, c)) {
          c.active = true; c.t = 0;
          this.respawn = { x: c.x + 1, y: c.y + c.h - p.h };
          this.sfx('checkpoint'); this.popup('CHECKPOINT', c.x + 6, c.y - 8, '#8af0dc');
          this.burst(c.x + 6, c.y + 4, 16, ['#8af0dc', '#ffffff', '#ffd23a'], 120, 0.6, 100, 2);
          if (p.hp < 3) p.hp = 3;
        }
      }
      // coins
      for (const c of this.coinList) if (!c.taken && !p.dead && PQ.overlap(p, c)) { c.taken = true; this.addCoin(c.x + 5, c.y + 6); }
      // items
      for (const it of this.items) it.update(dt, this);
      this.items = this.items.filter((i) => !i.remove);
      // enemies
      for (const e of this.enemies) {
        e.update(dt, this);
        if (!e.alive || p.dead || this.state !== 'play') continue;
        if (PQ.overlap(p, e)) {
          const stomp = p.vy > 0 && (p.prevBottom <= e.y + 5 || p.y + p.h - e.y < 7);
          if (stomp && e.stompable) {
            e.stomp(this); p.bounce(); this.sfx('stomp');
            this.combo = (p.airT < 0.05 ? 0 : this.combo || 0) + 1;
            const pts = e.points * Math.min(8, this.combo);
            this.addScore(pts, e.x + e.w / 2, e.y - 4);
          } else p.hurt(this, e.x + e.w / 2);
        }
      }
      if (p.onGround) { this.combo = 0; p.airT = 0; }
      this.enemies = this.enemies.filter((e) => !e.remove);
      // hazards
      for (const h of this.hazards) {
        h.update(dt, this);
        if (p.dead || !h.danger || this.state !== 'play') continue;
        const hb = h.hitbox ? h.hitbox() : h;
        if (PQ.overlap({ x: p.x + 1, y: p.y + 2, w: p.w - 2, h: p.h - 2 }, hb)) p.hurt(this, hb.x + hb.w / 2);
      }
      // boss arena
      if (this.arena && this.boss) this.updateArena(dt);
      // projectiles
      this.updateShots(dt);
      // flag
      const f = this.flag;
      if (f) {
        if (f.drop !== undefined && f.drop < 0) { f.drop = Math.min(0, f.drop + 260 * dt); if (f.drop === 0) { this.shake(4); this.sfx('slam'); this.dust(f.x, f.bottom, 6); } }
        if (this.state === 'play' && !p.dead && (f.drop === undefined || f.drop === 0) && p.x + p.w > f.x - 2 && p.x < f.x + 6 && p.y + p.h > f.top) this.levelClear();
      }
      // bumps
      for (const [k, v] of this.bumps) { if (v > 0.18) this.bumps.delete(k); else this.bumps.set(k, v + dt); }
      this.updateFx(dt);
      this.updateCamera(dt);
    },
    updateArena(dt) {
      const p = this.player, a = this.arena, b = this.boss;
      if (!a.locked && b.alive && b.state === 'wait' && p.x > a.trigger * T && !p.dead) {
        a.locked = true;
        for (let y = a.door.y0; y <= a.door.y1; y++) this.world.set(a.door.x, y, 'X');
        this.sfx('slam'); this.shake(5);
        Au.play('boss');
        b.start();
      }
      if (!b.alive) return;
      b.update(dt, this);
      if (b.state === 'wait' || b.state === 'dying' || p.dead || this.state !== 'play') return;
      const body = b.body();
      if (PQ.overlap(p, body)) {
        const stomp = p.vy > 0 && (p.prevBottom <= body.y + 8 || p.y + p.h - body.y < 12);
        if (stomp) {
          if (b.hit(this)) p.bounce(true);
          else if (b.inv > 0) { p.vy = -300; }
        } else if (b.state !== 'hurt') p.hurt(this, b.cx);
      }
    },
    updateShots(dt) {
      const p = this.player;
      const ar = this.arena;
      for (const s of this.shots) {
        s.t += dt;
        if (s.kind === 'fireball') {
          s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
          if (this.frame % 2 === 0) this.particle(s.x + 5, s.y + 5, 0, 0, 0.3, Math.random() < 0.5 ? '#ff7a1a' : '#ffd23a', 2, -30);
          if (this.boss && s.y + s.h >= this.boss.groundY) { s.dead = true; this.lavaSplash(s.x + 5, this.boss.groundY - 2); }
        } else if (s.kind === 'shock') {
          s.x += s.vx * dt;
          if (this.frame % 2 === 0) this.particle(s.x + 6, s.y + 12, 0, -40, 0.3, '#ffb03a', 2, 0);
          if (ar && (s.x < (ar.x0 + 1) * T || s.x + s.w > ar.x1 * T)) s.dead = true;
        } else if (s.kind === 'rock') {
          s.vy = Math.min(s.vy + 1200 * dt, 500); s.y += s.vy * dt;
          if (this.boss && s.y + s.h >= this.boss.groundY) { s.dead = true; this.burst(s.x + 6, s.y + 10, 10, ['#5a4a52', '#8a7a82', '#ff7a1a'], 120, 0.5, 600, 2); this.sfx('break'); }
        }
        if (!s.dead && !p.dead && this.state === 'play') {
          const hb = s.kind === 'shock' ? { x: s.x + 2, y: s.y + 2, w: s.w - 4, h: s.h - 2 } : { x: s.x + 1, y: s.y + 1, w: s.w - 2, h: s.h - 2 };
          if (PQ.overlap(p, hb)) { p.hurt(this, s.x + s.w / 2); if (s.kind !== 'shock') s.dead = true; }
        }
      }
      this.shots = this.shots.filter((s) => !s.dead);
      for (const r of this.rocksWarn) {
        r.t -= dt;
        if (r.t <= 0) { r.dead = true; this.shots.push({ kind: 'rock', x: r.x, y: 2 * T, w: 12, h: 12, vx: 0, vy: 0, t: 0 }); }
      }
      this.rocksWarn = this.rocksWarn.filter((r) => !r.dead);
    },
    updateFx(dt) {
      for (const f of this.fx) {
        f.life -= dt;
        if (f.kind === 'ring' || f.kind === 'star' || f.kind === 'boom') continue;
        f.vy += (f.g || 0) * dt; f.x += f.vx * dt; f.y += f.vy * dt;
      }
      this.fx = this.fx.filter((f) => f.life > 0);
      for (const p of this.popups) { p.t += dt; p.y -= 22 * dt; }
      this.popups = this.popups.filter((p) => p.t < 1);
      this.shakeMag = Math.max(0, this.shakeMag - dt * 18);
      this.shakeX = this.shakeMag ? (Math.random() - 0.5) * this.shakeMag * 2 : 0;
      this.shakeY = this.shakeMag ? (Math.random() - 0.5) * this.shakeMag * 2 : 0;
      this.whiteFlash = Math.max(0, this.whiteFlash - dt);
      // ambient background particles
      const th = this.level.theme;
      if (th === 'lava' && this.frame % 4 === 0) this.bgFx.push({ x: Math.random() * W, y: H + 4, vx: (Math.random() - 0.5) * 10, vy: -20 - Math.random() * 30, life: 6, c: Math.random() < 0.5 ? '#ff7a1a' : '#ffd23a' });
      if (th === 'crystal' && this.frame % 9 === 0) this.bgFx.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 6, vy: -4 - Math.random() * 6, life: 4, c: ['#5af0ff', '#ff6ad8', '#e0d0ff'][(Math.random() * 3) | 0] });
      if (th === 'emerald' && this.frame % 40 === 0) this.bgFx.push({ x: W + 4, y: 20 + Math.random() * 120, vx: -20 - Math.random() * 20, vy: 5, life: 14, c: '#ffd8f0', leaf: true });
      for (const b of this.bgFx) { b.life -= dt; b.x += b.vx * dt + (b.leaf ? Math.sin(this.t * 2 + b.y) * 0.3 : 0); b.y += b.vy * dt + (b.leaf ? Math.sin(this.t * 3 + b.x * 0.05) * 0.3 : 0); }
      this.bgFx = this.bgFx.filter((b) => b.life > 0 && b.y > -10 && b.x > -10);
    },
    updateCamera(dt) {
      const p = this.player, c = this.cam;
      if (p.dead && p.deadKind === 'hit') return;
      c.look = PQ.lerp(c.look, p.facing * 26 * Math.min(1, Math.abs(p.vx) / 100), Math.min(1, dt * 2.5));
      let tx = p.cx - W / 2 + c.look;
      if (this.arena && this.arena.locked) tx = this.arena.x0 * T;
      tx = PQ.clamp(tx, 0, this.level.w * T - W);
      c.x += (tx - c.x) * Math.min(1, dt * (this.arena && this.arena.locked ? 4 : 8));
      const ty = PQ.clamp(p.y - H * 0.55, 0, this.level.h * T - H);
      c.y += (ty - c.y) * Math.min(1, dt * 4);
    },

    /* ------------------------------------------------------------ */
    /* Rendering                                                     */
    /* ------------------------------------------------------------ */
    render() {
      const ctx = this.ctx;
      ctx.imageSmoothingEnabled = false;
      this.menuRects = [];
      switch (this.state) {
        case 'title': this.renderTitle(); break;
        case 'intro': this.renderIntro(); break;
        case 'play': case 'clear': this.renderWorld(); this.renderHUD(); if (this.state === 'clear') this.renderClear(); break;
        case 'pause': this.renderWorld(); this.renderHUD(); this.renderPause(); break;
        case 'gameover': this.renderWorld(); this.renderGameOver(); break;
        case 'victory': this.renderVictory(); break;
      }
      if (this.whiteFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, this.whiteFlash * 1.6)})`; ctx.fillRect(0, 0, W, H); }
      if (this.trans) {
        const a = this.trans.phase === 'out' ? this.trans.t / 0.35 : 1 - this.trans.t / 0.35;
        ctx.fillStyle = `rgba(8,4,20,${PQ.clamp(a, 0, 1)})`; ctx.fillRect(0, 0, W, H);
      }
    },
    skyGradient(theme) {
      this._sky = this._sky || {};
      if (!this._sky[theme]) {
        const s = Art.bg[theme].sky;
        const g = this.ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, s[0]); g.addColorStop(0.6, s[1]); g.addColorStop(1, s[2]);
        this._sky[theme] = g;
      }
      return this._sky[theme];
    },
    renderBackground(theme, cx, cy) {
      const ctx = this.ctx, bg = Art.bg[theme];
      ctx.fillStyle = this.skyGradient(theme);
      ctx.fillRect(0, 0, W, H);
      const yo = -Math.round(cy * 0.3);
      if (bg.sun) {
        ctx.globalAlpha = 0.5; ctx.drawImage(Art.tintedGlow('rgba(255,250,210,0.9)', 120), 270, -20); ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff8d0'; ctx.beginPath(); ctx.arc(330, 40, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(328, 38, 12, 0, Math.PI * 2); ctx.fill();
      }
      if (theme === 'lava') {
        ctx.globalAlpha = 0.35 + 0.1 * Math.sin(this.t * 2);
        ctx.drawImage(Art.tintedGlow('rgba(255,90,20,1)', 256), -40, 60, 480, 260);
        ctx.globalAlpha = 1;
      }
      bg.layers.forEach(([img, f], li) => {
        if (bg.clouds && li === 1) this.renderClouds(bg, cx);
        let off = -((cx * f) % 512);
        if (off > 0) off -= 512;
        const y = Math.round(yo * f * 2);
        for (let x = Math.round(off); x < W; x += 512) ctx.drawImage(img, x, y);
        if (bg.glints && li === 0) {
          for (const g of bg.glints) {
            const gx = (((g.x - cx * f) % 512) + 512) % 512;
            for (const sx of [gx, gx - 512]) {
              if (sx < -20 || sx > W + 20) continue;
              const a = 0.35 + 0.35 * Math.sin(this.t * 2 + g.p);
              ctx.globalAlpha = a; ctx.drawImage(Art.tintedGlow(g.col, 16), Math.round(sx - 7), g.y - 6 + y); ctx.globalAlpha = 1;
            }
          }
        }
      });
      for (const b of this.bgFx || []) {
        ctx.globalAlpha = Math.min(1, b.life);
        ctx.fillStyle = b.c;
        if (b.leaf) { ctx.fillRect(Math.round(b.x), Math.round(b.y), 2, 1); ctx.fillRect(Math.round(b.x) + 1, Math.round(b.y) + 1, 1, 1); }
        else ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
        ctx.globalAlpha = 1;
      }
    },
    renderClouds(bg, cx) {
      const ctx = this.ctx;
      for (let i = 0; i < 7; i++) {
        const img = bg.clouds[i % 3];
        const span = W + 220;
        let x = (i * 151 - cx * 0.06 - this.t * (4 + (i % 3) * 2)) % span;
        if (x < 0) x += span;
        ctx.drawImage(img, Math.round(x - 110), 10 + ((i * 37) % 64));
      }
    },
    renderWorld() {
      const ctx = this.ctx, L = this.level, th = L.theme;
      const cx = Math.round(this.cam.x + this.shakeX), cy = Math.round(this.cam.y + this.shakeY);
      this.renderBackground(th, cx, cy);
      this.renderDecor(0, cx, cy);
      // terrain
      const tw = this.terrain.width;
      const sx = PQ.clamp(cx, 0, tw), dx = sx - cx;
      const sw = Math.min(W - dx, tw - sx);
      if (sw > 0) ctx.drawImage(this.terrain, sx, Math.max(0, cy), sw, H, dx, Math.max(0, cy) - cy, sw, H);
      this.renderDecor(1, cx, cy);
      this.renderLiquids(cx, cy);
      this.renderDynTiles(cx, cy);
      // checkpoints & flag
      for (const c of this.checkpoints) this.drawCheckpoint(c, cx, cy);
      if (this.flag) this.drawFlag(this.flag, cx, cy);
      // coins
      for (const c of this.coinList) {
        if (c.taken || c.x < cx - 16 || c.x > cx + W + 16) continue;
        const fr = Math.floor(this.t * 10 + c.ph) % 6;
        ctx.drawImage(Art.coin[fr], Math.round(c.x - cx), Math.round(c.y - cy + Math.sin(this.t * 3 + c.ph) * 0.8));
      }
      for (const m of this.platforms) if (this.onScreen(m, 16)) m.draw(ctx, cx, cy, this);
      for (const it of this.items) it.draw(ctx, cx, cy, this);
      for (const h of this.hazards) if (this.onScreen({ x: h.x, y: h.y - 48, w: 24, h: 80 }, 16)) h.draw(ctx, cx, cy, this);
      for (const e of this.enemies) if (this.onScreen(e, 24)) e.draw(ctx, cx, cy, this);
      if (this.boss) this.boss.draw(ctx, cx, cy, this);
      this.renderShots(cx, cy);
      this.player.draw(ctx, cx, cy, this);
      this.renderDecor(2, cx, cy);
      this.renderFx(cx, cy);
      this.renderLighting(cx, cy);
    },
    renderDecor(layer, cx, cy) {
      const ctx = this.ctx, t = this.t;
      for (const d of this.decor) {
        if (d.layer !== layer) continue;
        if (d.x < cx - 48) continue;
        if (d.x > cx + W + 8) break;
        const x = Math.round(d.x - cx), y = Math.round(d.y - cy);
        switch (d.k) {
          case 'tree': {
            ctx.drawImage(Art.trunk, x + 16, y - 28);
            const sway = Math.round(Math.sin(t * 1.3 + d.x * 0.05) * 1.2);
            ctx.drawImage(Art.tree[d.v], x + sway, y - 62);
            break;
          }
          case 'bush': ctx.drawImage(Art.bush, x, y); break;
          case 'rock': ctx.drawImage(Art.rock, x, y); break;
          case 'flower': {
            const sw = Math.round(Math.sin(t * 2.2 + d.x * 0.3) * 1);
            ctx.fillStyle = '#2a8a3c'; ctx.fillRect(x, y - 5, 1, 5);
            ctx.fillStyle = d.c; ctx.fillRect(x - 1 + sw, y - 7, 3, 1); ctx.fillRect(x + sw, y - 8, 1, 3);
            ctx.fillStyle = '#fff6a0'; ctx.fillRect(x + sw, y - 7, 1, 1);
            break;
          }
          case 'tuft': {
            const sw = Math.sin(t * 2 + d.x * 0.2) > 0.3 ? 1 : 0;
            ctx.fillStyle = '#5ad04a'; ctx.fillRect(x, y - 2, 1, 2); ctx.fillRect(x + 2, y - 3, 1, 3); ctx.fillRect(x + 1 + sw, y - 4, 1, 2);
            break;
          }
          case 'crystal': ctx.drawImage(Art.crystals[d.v], x, y); break;
          case 'mushroom': ctx.drawImage(Art.mushroom, x, y); break;
          case 'glowmoss': {
            const a = 0.5 + 0.5 * Math.sin(t * 3 + d.x);
            ctx.fillStyle = `rgba(106,246,255,${a})`; ctx.fillRect(x + 3, y - 1, 1, 1); ctx.fillRect(x + 9, y - 1, 1, 1); ctx.fillRect(x + 13, y - 2, 1, 1);
            break;
          }
          case 'stalactite': ctx.drawImage(Art.stalactite[d.v], x, y); break;
          case 'bones': ctx.fillStyle = '#d8d0c0'; ctx.fillRect(x, y, 6, 1); ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x + 5, y - 1, 2, 2); break;
          case 'chain': ctx.drawImage(Art.chain, 0, 0, 6, d.len, x, y, 6, d.len); break;
          case 'banner': ctx.drawImage(Art.banner, x, y + Math.round(Math.sin(t + d.x) * 0.6)); break;
          case 'torch': {
            ctx.drawImage(Art.torch, x, y);
            const f = Math.sin(t * 20 + d.x) > 0 ? 1 : 0;
            ctx.fillStyle = '#ff5a1a'; ctx.fillRect(x + 2, y - 3 + f, 4, 5 - f);
            ctx.fillStyle = '#ffc83a'; ctx.fillRect(x + 3, y - 1, 2, 3);
            ctx.fillStyle = '#fff6c0'; ctx.fillRect(x + 3, y + 1, 2, 1);
            break;
          }
        }
      }
    },
    renderLiquids(cx, cy) {
      const ctx = this.ctx, g = this.world.g, t = this.t;
      const tx0 = Math.max(0, Math.floor(cx / T)), tx1 = Math.min(this.level.w - 1, Math.floor((cx + W) / T));
      for (let ty = 0; ty < this.level.h; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const c = g[ty][tx];
          if (c !== 'W' && c !== 'L') continue;
          const x = tx * T - cx, y = ty * T - cy;
          const surf = ty === 0 || g[ty - 1][tx] !== c;
          if (c === 'W') {
            ctx.fillStyle = '#1e5ab8'; ctx.fillRect(x, y, T, T);
            ctx.fillStyle = '#2a72d0';
            for (let i = 0; i < T; i += 1) { const k = Math.sin((tx * T + i) * 0.2 + t * 2 + ty) ; if (k > 0.7) ctx.fillRect(x + i, y + 6 + ((i + ty) % 5), 1, 1); }
            if (surf) {
              for (let i = 0; i < T; i++) {
                const wv = Math.round(Math.sin((tx * T + i) * 0.35 + t * 3.2) * 1.5 + Math.sin((tx * T + i) * 0.11 - t * 1.7));
                ctx.fillStyle = '#5ab0ff'; ctx.fillRect(x + i, y + 2 + wv, 1, 4);
                ctx.fillStyle = '#d8f0ff'; ctx.fillRect(x + i, y + 1 + wv, 1, 1);
              }
            }
          } else {
            ctx.fillStyle = '#c42a08'; ctx.fillRect(x, y, T, T);
            ctx.fillStyle = '#e8460c'; ctx.fillRect(x, y + (surf ? 4 : 0), T, surf ? 5 : 3);
            for (let i = 0; i < T; i += 2) { const k = Math.sin((tx * T + i) * 0.13 + t * 1.3 + ty * 2); if (k > 0.6) { ctx.fillStyle = '#ff8a1a'; ctx.fillRect(x + i, y + 8 + Math.round(k * 4), 2, 1); } }
            if (surf) {
              for (let i = 0; i < T; i++) {
                const wv = Math.round(Math.sin((tx * T + i) * 0.25 + t * 2) * 1.2);
                ctx.fillStyle = '#ff9a1a'; ctx.fillRect(x + i, y + 2 + wv, 1, 3);
                ctx.fillStyle = '#ffe060'; ctx.fillRect(x + i, y + 1 + wv, 1, 1);
              }
              if (Math.random() < 0.004) this.particle(tx * T + Math.random() * 16, ty * T + 2, 0, -40, 0.5, '#ffd23a', 2, 120);
            }
          }
        }
      }
    },
    renderDynTiles(cx, cy) {
      const ctx = this.ctx, g = this.world.g;
      const tx0 = Math.max(0, Math.floor(cx / T)), tx1 = Math.min(this.level.w - 1, Math.floor((cx + W) / T));
      const ty0 = Math.max(0, Math.floor(cy / T)), ty1 = Math.min(this.level.h - 1, Math.floor((cy + H) / T));
      const fr = Math.floor(this.t * 6) % 4;
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const c = g[ty][tx];
          if (!DYN[c]) continue;
          const b = this.bumps.get(tx + ',' + ty);
          const oy = b !== undefined ? -Math.round(Math.sin((b / 0.18) * Math.PI) * 5) : 0;
          const img = c === 'B' ? Art.brick[this.level.theme] : c === 'U' ? Art.used : c === 'X' ? Art.door : Art.reward[fr];
          ctx.drawImage(img, tx * T - cx, ty * T - cy + oy);
        }
      }
    },
    drawCheckpoint(c, cx, cy) {
      const ctx = this.ctx;
      const x = Math.round(c.x - cx), y = Math.round(c.y - cy);
      if (x < -30 || x > W + 10) return;
      ctx.fillStyle = '#1b1230'; ctx.fillRect(x + 1, y + 28, 10, 4); ctx.fillRect(x + 4, y, 3, 30);
      ctx.fillStyle = '#9a90a8'; ctx.fillRect(x + 2, y + 29, 8, 2);
      ctx.fillStyle = '#d8d0e0'; ctx.fillRect(x + 5, y + 1, 1, 28);
      ctx.fillStyle = c.active ? '#ffd23a' : '#8a8098'; ctx.fillRect(x + 4, y - 2, 3, 3);
      if (c.active) {
        for (let i = 0; i < 12; i++) {
          const wv = Math.round(Math.sin(this.t * 6 - i * 0.6) * 1.5);
          ctx.fillStyle = '#1b1230'; ctx.fillRect(x + 7 + i, y + 2 + wv, 1, 9);
          ctx.fillStyle = i < 2 ? '#8af0dc' : '#2bb3a3'; ctx.fillRect(x + 7 + i, y + 3 + wv, 1, 7);
        }
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 11, y + 5 + Math.round(Math.sin(this.t * 6 - 2.4) * 1.5), 3, 3);
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.t * 4);
        ctx.drawImage(Art.tintedGlow('rgba(138,240,220,1)', 40), x - 10, y - 10);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#1b1230'; ctx.fillRect(x + 7, y + 2, 8, 8);
        ctx.fillStyle = '#c84a5a'; ctx.fillRect(x + 7, y + 3, 7, 6);
        ctx.fillStyle = '#8a2a3a'; ctx.fillRect(x + 7, y + 8, 7, 1);
      }
    },
    drawFlag(f, cx, cy) {
      const ctx = this.ctx;
      const dy = f.drop || 0;
      const x = Math.round(f.x - cx), top = Math.round(f.top - cy + dy), bot = Math.round(f.bottom - cy + dy);
      if (x < -40 || x > W + 40) return;
      ctx.fillStyle = '#1b1230'; ctx.fillRect(x - 5, bot - 8, 14, 8); ctx.fillRect(x - 1, top, 6, bot - top);
      ctx.fillStyle = '#6a6078'; ctx.fillRect(x - 4, bot - 7, 12, 6);
      ctx.fillStyle = '#9a90a8'; ctx.fillRect(x - 4, bot - 7, 12, 1);
      ctx.fillStyle = '#e8e8f0'; ctx.fillRect(x, top, 4, bot - top - 8);
      ctx.fillStyle = '#a8a8c0'; ctx.fillRect(x + 3, top, 1, bot - top - 8);
      ctx.fillStyle = '#1b1230'; ctx.fillRect(x - 2, top - 7, 8, 8);
      ctx.fillStyle = '#ffd23a'; ctx.fillRect(x - 1, top - 6, 6, 6);
      ctx.fillStyle = '#fff6b0'; ctx.fillRect(x, top - 5, 2, 2);
      const fy = Math.round(PQ.lerp(bot - 30, top + 4, f.raise || 0));
      for (let i = 0; i < 24; i++) {
        const wv = Math.round(Math.sin(this.t * 5 - i * 0.4) * 2 * (i / 24));
        ctx.fillStyle = '#1b1230'; ctx.fillRect(x + 4 + i, fy + wv, 1, 18);
        ctx.fillStyle = i % 8 < 1 ? '#ff9a5a' : '#ff7b2e'; ctx.fillRect(x + 4 + i, fy + 1 + wv, 1, 16);
      }
      // star emblem
      const sx = x + 14, sy = fy + 9 + Math.round(Math.sin(this.t * 5 - 4) * 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 1, sy - 4, 3, 9); ctx.fillRect(sx - 4, sy - 1, 9, 3); ctx.fillRect(sx - 2, sy - 2, 5, 5);
    },
    renderShots(cx, cy) {
      const ctx = this.ctx;
      for (const r of this.rocksWarn) {
        if ((this.frame >> 2) & 1) {
          const x = Math.round(r.x - cx), y = Math.round(this.boss.groundY - cy);
          ctx.fillStyle = '#ff3a2a'; ctx.fillRect(x, y - 2, 12, 2); ctx.fillRect(x + 5, y - 10, 2, 5); ctx.fillRect(x + 5, y - 4, 2, 1);
        }
      }
      for (const s of this.shots) {
        const x = Math.round(s.x - cx), y = Math.round(s.y - cy);
        if (s.kind === 'fireball') ctx.drawImage(Art.ember[(this.frame >> 2) % 2], x - 1, y - 1);
        else if (s.kind === 'rock') {
          ctx.fillStyle = '#0c0408'; ctx.fillRect(x, y, 12, 12);
          ctx.fillStyle = '#5a4a52'; ctx.fillRect(x + 1, y + 1, 10, 10);
          ctx.fillStyle = '#8a7a82'; ctx.fillRect(x + 2, y + 2, 4, 3);
          ctx.fillStyle = '#ff7a1a'; ctx.fillRect(x + 7, y + 6, 2, 3);
        } else if (s.kind === 'shock') {
          for (let i = 0; i < 14; i += 2) {
            const w = Math.max(1, Math.round(6 - i * 0.35 + Math.sin(this.t * 30 + i) * 1.5));
            ctx.fillStyle = '#ff4a10'; ctx.fillRect(x + 6 - w, y + 14 - i - 2, w * 2, 2);
            ctx.fillStyle = '#ffd23a'; ctx.fillRect(x + 7 - w, y + 14 - i - 2, Math.max(1, w * 2 - 2), 2);
          }
        }
      }
    },
    renderFx(cx, cy) {
      const ctx = this.ctx;
      for (const f of this.fx) {
        const k = f.life / f.max;
        const x = Math.round(f.x - cx), y = Math.round(f.y - cy);
        if (f.kind === 'ring') {
          const r = (1 - k) * 18 + 4;
          ctx.strokeStyle = f.color; ctx.globalAlpha = k; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
        } else if (f.kind === 'star') {
          const s = Math.round((1 - k) * 6) + 2;
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x - s, y, s * 2 + 1, 1); ctx.fillRect(x, y - s, 1, s * 2 + 1);
        } else if (f.kind === 'boom') {
          const r = f.r * (1.2 - k * 0.6);
          ctx.fillStyle = k > 0.6 ? '#ffffff' : k > 0.35 ? '#ffd23a' : '#ff6a1a';
          ctx.globalAlpha = Math.min(1, k * 1.8);
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        } else if (f.kind === 'debris') {
          ctx.fillStyle = '#1b1230'; ctx.fillRect(x - 1, y - 1, f.size + 2, f.size + 2);
          ctx.fillStyle = f.color; ctx.fillRect(x, y, f.size, f.size);
        } else {
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.fillStyle = f.color; ctx.fillRect(x, y, f.size, f.size);
          ctx.globalAlpha = 1;
        }
      }
      for (const p of this.popups) {
        ctx.globalAlpha = Math.min(1, (1 - p.t) * 3);
        F.draw(ctx, p.text, p.x - cx, p.y - cy, p.color, 1, { align: 'center', outline: '#1b1230' });
        ctx.globalAlpha = 1;
      }
    },
    renderLighting(cx, cy) {
      const ctx = this.ctx, th = this.level.theme;
      if (th === 'crystal') {
        ctx.globalCompositeOperation = 'lighter';
        for (const d of this.decor) {
          if (d.k !== 'crystal' && d.k !== 'mushroom' && !(d.k === 'stalactite' && d.v)) continue;
          if (d.x < cx - 40 || d.x > cx + W + 40) continue;
          const col = d.k === 'mushroom' ? 'rgba(255,106,216,0.8)' : d.k === 'stalactite' ? 'rgba(90,240,255,0.6)' : ['rgba(90,240,255,0.8)', 'rgba(255,106,216,0.8)', 'rgba(184,138,255,0.8)'][d.v];
          ctx.globalAlpha = 0.35 + 0.15 * Math.sin(this.t * 2 + d.x);
          ctx.drawImage(Art.tintedGlow(col, 48), Math.round(d.x - cx - 16), Math.round(d.y - cy + (d.k === 'stalactite' ? 0 : -8)));
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        const p = this.player;
        const px = p.cx - cx, py = p.y - cy;
        const g = ctx.createRadialGradient(px, py, 40, px, py, 300);
        g.addColorStop(0, 'rgba(6,2,24,0)'); g.addColorStop(1, 'rgba(6,2,24,0.55)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      } else if (th === 'lava') {
        ctx.globalCompositeOperation = 'lighter';
        const g = this.world.g;
        const tx0 = Math.max(0, Math.floor(cx / T) - 1), tx1 = Math.min(this.level.w - 1, Math.floor((cx + W) / T) + 1);
        for (let tx = tx0; tx <= tx1; tx += 2) {
          if (g[13][tx] === 'L') {
            ctx.globalAlpha = 0.22 + 0.06 * Math.sin(this.t * 3 + tx);
            ctx.drawImage(Art.tintedGlow('rgba(255,110,30,1)', 80), tx * T - cx - 32, 13 * T - cy - 44);
          }
        }
        for (const d of this.decor) {
          if (d.k !== 'torch' || d.x < cx - 40 || d.x > cx + W + 40) continue;
          ctx.globalAlpha = 0.3 + 0.08 * Math.sin(this.t * 17 + d.x);
          ctx.drawImage(Art.tintedGlow('rgba(255,150,40,1)', 48), Math.round(d.x - cx - 20), Math.round(d.y - cy - 24));
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        const v = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 300);
        v.addColorStop(0, 'rgba(20,0,0,0)'); v.addColorStop(1, 'rgba(20,0,0,0.45)');
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      }
    },

    renderHUD() {
      const ctx = this.ctx, p = this.player;
      ctx.fillStyle = 'rgba(12,6,28,0.45)'; ctx.fillRect(0, 0, W, 17);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, 17, W, 1);
      ctx.drawImage(Art.lifeIcon, 5, 4);
      F.draw(ctx, '*' + this.lives, 19, 6, '#ffffff', 1, { shadow: '#1b1230' });
      for (let i = 0; i < 3; i++) ctx.drawImage(i < p.hp ? Art.heart : Art.heartEmpty, 40 + i * 11, 5);
      if (p.canDouble) ctx.drawImage(Art.feather, 76, 3);
      ctx.drawImage(Art.coinSmall, 150, 5);
      F.draw(ctx, '*' + pad(this.coins, 2), 160, 6, '#ffd23a', 1, { shadow: '#1b1230' });
      F.draw(ctx, 'W' + this.level.world, 210, 6, '#8af0dc', 1, { shadow: '#1b1230' });
      F.draw(ctx, pad(this.score, 7), W - 6, 6, '#ffffff', 1, { align: 'right', shadow: '#1b1230' });
      if (this.levelT < 3 && this.state === 'play') {
        const a = Math.min(1, (3 - this.levelT) * 2);
        ctx.globalAlpha = a;
        F.draw(ctx, this.level.name, W / 2, 28, '#ffffff', 2, { align: 'center', outline: '#1b1230' });
        ctx.globalAlpha = 1;
      }
      const b = this.boss;
      if (b && b.alive && b.state !== 'wait') {
        const bw = 160, bx = (W - bw) / 2, by = 24;
        F.draw(ctx, 'MAGMAW THE MOLTEN KING', W / 2, by - 1, '#ffb03a', 1, { align: 'center', outline: '#1b1230' });
        ctx.fillStyle = '#1b1230'; ctx.fillRect(bx - 2, by + 8, bw + 4, 9);
        ctx.fillStyle = '#4a1418'; ctx.fillRect(bx, by + 10, bw, 5);
        const k = b.hp / b.maxHp;
        ctx.fillStyle = b.flash > 0 && (this.frame >> 1) & 1 ? '#ffffff' : b.phase === 3 ? '#ff2a2a' : b.phase === 2 ? '#ff7a1a' : '#ffc83a';
        ctx.fillRect(bx, by + 10, Math.round(bw * k), 5);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx, by + 10, Math.round(bw * k), 1);
        ctx.fillStyle = '#1b1230'; for (let i = 1; i < b.maxHp; i++) ctx.fillRect(bx + Math.round((bw * i) / b.maxHp), by + 10, 1, 5);
      }
    },
    panel(x, y, w, h) {
      const ctx = this.ctx;
      ctx.fillStyle = '#1b1230'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillStyle = '#2bb3a3'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = '#1b1230'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#261a44'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.fillStyle = '#ffd23a'; [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]].forEach(([a, b]) => ctx.fillRect(a, b, 3, 3));
    },
    drawMenu(items, sel, cx, y, gap, scale = 1) {
      const ctx = this.ctx;
      items.forEach((label, i) => {
        const yy = y + i * gap;
        const on = i === sel;
        const w = F.width(label, scale);
        F.draw(ctx, label, cx, yy, on ? '#ffd23a' : '#e8e0f8', scale, { align: 'center', shadow: '#1b1230' });
        if (on) {
          const bob = Math.round(Math.sin(this.t * 8) * 1.5);
          F.draw(ctx, '>', cx - w / 2 - 12 + bob, yy, '#ff7b2e', scale, { shadow: '#1b1230' });
          F.draw(ctx, '<', cx + w / 2 + 6 - bob, yy, '#ff7b2e', scale, { shadow: '#1b1230' });
        }
        this.menuRects.push({ x: cx - w / 2 - 20, y: yy - 4, w: w + 40, h: 7 * scale + 8 });
      });
    },
    buildTitleGround() {
      const grid = [];
      for (let y = 0; y < 3; y++) grid.push(new Array(34).fill('#'));
      grid.unshift(new Array(34).fill(' '));
      this.titleGround = Art.renderTerrain(grid, 'emerald');
    },
    renderTitle() {
      const ctx = this.ctx, tt = this.title;
      const cx = Math.round(this.t * 22);
      this.bgFx = [];
      this.renderBackground('emerald', cx, 0);
      // scrolling ground strip
      const gx = -((this.t * 40) % 32);
      for (let x = gx; x < W; x += 512) ctx.drawImage(this.titleGround, 0, 16, 512, 48, Math.round(x), H - 30, 512, 48);
      // hero running
      const fr = Art.player.run[Math.floor(this.t * 10) % 4].n[0];
      ctx.drawImage(fr, 70, H - 46 + (Math.floor(this.t * 10) % 2 ? -1 : 0));
      if (Math.floor(this.t * 10) % 3 === 0) { ctx.fillStyle = 'rgba(232,220,192,0.7)'; ctx.fillRect(66 - ((this.t * 60) % 10), H - 32, 2, 2); }
      // a slime chasing for charm
      ctx.drawImage(Art.slime[Math.floor(this.t * 5) % 2][1], 30, H - 42);
      // coins floating
      for (let i = 0; i < 5; i++) ctx.drawImage(Art.coin[Math.floor(this.t * 10 + i) % 6], 150 + i * 46 - ((this.t * 40) % 46), H - 64 + Math.round(Math.sin(this.t * 3 + i) * 3));
      // logo
      const ly = 14 + Math.round(Math.sin(this.t * 1.8) * 3);
      ctx.drawImage(Art.logo, Math.round((W - Art.logo.width) / 2), ly);
      F.draw(ctx, 'A RETRO PLATFORM ADVENTURE', W / 2, ly + Art.logo.height + 2, '#ffffff', 1, { align: 'center', outline: '#1b1230' });
      if (tt.phase === 'press') {
        if (Math.floor(this.t * 2) % 2 === 0) F.draw(ctx, this.isTouch ? 'TAP TO START' : 'PRESS ENTER OR CLICK TO START', W / 2, 136, '#ffd23a', 1, { align: 'center', outline: '#1b1230' });
      } else {
        const items = this.titleItems().map((i) => i.label);
        this.panel(W / 2 - 92, 116, 184, items.length * 13 + 8);
        this.drawMenu(items, tt.sel, W / 2, 122, 13);
      }
      F.draw(ctx, 'HI ' + pad(PQ.Save.data.hi || 0, 7), W - 6, 4, '#ffffff', 1, { align: 'right', outline: '#1b1230' });
      if (!this.isTouch) F.draw(ctx, 'ARROWS/A-D MOVE  SPACE JUMP  ESC PAUSE', W / 2, H - 11, '#ffffff', 1, { align: 'center', outline: '#1b1230' });
    },
    renderIntro() {
      const ctx = this.ctx, L = this.level;
      ctx.fillStyle = '#0c0820'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = i % 3 ? '#3a2a68' : '#8af0dc'; ctx.fillRect((i * 97 + this.t * 10 * (1 + (i % 3))) % W, (i * 53) % H, 1, 1); }
      F.draw(ctx, 'WORLD ' + L.world, W / 2, 58, '#8af0dc', 2, { align: 'center', outline: '#1b1230' });
      F.draw(ctx, L.name, W / 2, 82, '#ffd23a', 3, { align: 'center', outline: '#1b1230' });
      ctx.drawImage(Art.lifeIcon, W / 2 - 22, 128);
      F.draw(ctx, '*  ' + this.lives, W / 2 - 4, 130, '#ffffff', 1, { outline: '#1b1230' });
      const tips = ['JUMP ON ENEMIES TO DEFEAT THEM', 'HOLD JUMP TO JUMP HIGHER', 'HIT GOLD BLOCKS FROM BELOW', 'FIND THE FEATHER TO DOUBLE JUMP'];
      F.draw(ctx, tips[(this.levelIdx + (this.lives % 2)) % tips.length], W / 2, 168, '#9a90b8', 1, { align: 'center' });
    },
    renderClear() {
      const ctx = this.ctx;
      if (this.clearT < 2.4) return;
      const a = Math.min(1, (this.clearT - 2.4) * 3);
      ctx.globalAlpha = a;
      this.panel(W / 2 - 100, 54, 200, 88);
      F.draw(ctx, this.levelIdx >= 2 ? 'FORTRESS CONQUERED!' : 'LEVEL CLEAR!', W / 2, 64, '#ffd23a', 2, { align: 'center', outline: '#1b1230' });
      F.draw(ctx, 'BONUS', W / 2 - 80, 92, '#e8e0f8');
      F.draw(ctx, pad(this.clearBonus, 6), W / 2 + 80, 92, '#ffffff', 1, { align: 'right' });
      F.draw(ctx, 'COINS', W / 2 - 80, 106, '#e8e0f8');
      F.draw(ctx, pad(this.coins, 2), W / 2 + 80, 106, '#ffd23a', 1, { align: 'right' });
      F.draw(ctx, 'SCORE', W / 2 - 80, 120, '#e8e0f8');
      F.draw(ctx, pad(this.score, 7), W / 2 + 80, 120, '#ffffff', 1, { align: 'right' });
      ctx.globalAlpha = 1;
    },
    renderPause() {
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(8,4,20,0.6)'; ctx.fillRect(0, 0, W, H);
      this.panel(W / 2 - 90, 50, 180, 120);
      F.draw(ctx, 'PAUSED', W / 2, 62, '#8af0dc', 2, { align: 'center', outline: '#1b1230' });
      this.drawMenu(['RESUME', 'RESTART LEVEL', 'MUSIC: ' + (Au.musicOn ? 'ON' : 'OFF'), 'QUIT TO TITLE'], this.pauseSel, W / 2, 90, 16);
    },
    renderGameOver() {
      const ctx = this.ctx;
      ctx.fillStyle = `rgba(20,0,10,${Math.min(0.75, this.goT)})`; ctx.fillRect(0, 0, W, H);
      F.draw(ctx, 'GAME OVER', W / 2, Math.round(Math.min(60, 20 + this.goT * 60)), '#ff4a5a', 4, { align: 'center', outline: '#1b1230', ow: 2 });
      if (this.goT > 1.2) {
        F.draw(ctx, 'SCORE ' + pad(this.score, 7), W / 2, 104, '#ffffff', 1, { align: 'center', outline: '#1b1230' });
        this.drawMenu(['CONTINUE', 'QUIT TO TITLE'], this.goSel, W / 2, 128, 16);
      }
    },
    renderVictory() {
      const ctx = this.ctx;
      this.renderBackground('emerald', Math.round(this.t * 10), 0);
      ctx.fillStyle = 'rgba(12,6,40,0.45)'; ctx.fillRect(0, 0, W, H);
      for (const f of this.fx) {
        ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
        ctx.fillStyle = f.color; ctx.fillRect(Math.round(f.x), Math.round(f.y), f.size, f.size);
      }
      ctx.globalAlpha = 1;
      const bob = Math.round(Math.sin(this.t * 3) * 2);
      F.draw(ctx, 'VICTORY!', W / 2, 26 + bob, '#ffd23a', 4, { align: 'center', outline: '#1b1230', ow: 2 });
      F.draw(ctx, 'MAGMAW THE MOLTEN KING IS DEFEATED', W / 2, 70, '#ffffff', 1, { align: 'center', outline: '#1b1230' });
      F.draw(ctx, 'PEACE RETURNS TO THE VALLEY', W / 2, 82, '#8af0dc', 1, { align: 'center', outline: '#1b1230' });
      const jump = Math.abs(Math.sin(this.t * 4)) * 10;
      ctx.drawImage(Art.player.jump.n[0], W / 2 - 6, 112 - Math.round(jump));
      this.panel(W / 2 - 90, 134, 180, 46);
      F.draw(ctx, 'FINAL SCORE', W / 2 - 76, 142, '#e8e0f8');
      F.draw(ctx, pad(this.score, 7), W / 2 + 76, 142, '#ffffff', 1, { align: 'right' });
      F.draw(ctx, 'HI-SCORE', W / 2 - 76, 156, '#e8e0f8');
      F.draw(ctx, pad(PQ.Save.data.hi || 0, 7), W / 2 + 76, 156, '#ffd23a', 1, { align: 'right' });
      F.draw(ctx, 'LIVES LEFT', W / 2 - 76, 170 - 2, '#e8e0f8');
      F.draw(ctx, String(this.lives), W / 2 + 76, 168, '#3ae070', 1, { align: 'right' });
      F.draw(ctx, 'THANK YOU FOR PLAYING!', W / 2, 192, '#ff7b2e', 1, { align: 'center', outline: '#1b1230' });
      if (this.vicT > 3 && Math.floor(this.t * 2) % 2 === 0) F.draw(ctx, this.isTouch ? 'TAP TO CONTINUE' : 'PRESS ENTER', W / 2, 208, '#ffffff', 1, { align: 'center', outline: '#1b1230' });
      this.menuRects.push({ x: 0, y: 0, w: W, h: H });
    },
  });

  // Debug / QA helpers (used by automated tests; harmless for players)
  PQ.debug = {
    warp(tx, ty) {
      const p = Game.player, w = Game.world;
      if (ty === undefined) { ty = 2; while (ty < w.h - 1 && !(w.tile(tx, ty + 1) !== ' ' && w.tile(tx, ty) === ' ')) ty++; }
      p.x = tx * T + 3; p.y = (ty + 1) * T - p.h; p.vy = 0; p.riding = null; Game.snapCamera();
    },
    god(on) { Game.god = on !== false; },
    state() { return { state: Game.state, x: Game.player && Game.player.x, y: Game.player && Game.player.y, lives: Game.lives, score: Game.score, coins: Game.coins, hp: Game.player && Game.player.hp }; },
  };

  window.addEventListener('load', () => Game.init());
})();
