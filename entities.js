/* PIXEL QUEST - entities.js
 * Tile world + collision, the player, enemies, hazards, platforms, pickups and the boss.
 */
'use strict';
(function () {
  const PQ = window.PQ, T = PQ.T, Art = PQ.Art;
  const SOLID = (PQ.SOLID = { '#': 1, '=': 1, B: 1, '?': 1, P: 1, R: 1, U: 1, X: 1 });

  /* ================================================================== */
  /* World: tile grid + axis-separated AABB collision                    */
  /* ================================================================== */
  class World {
    constructor(grid) { this.g = grid; this.h = grid.length; this.w = grid[0].length; }
    tile(tx, ty) {
      if (ty < 0 || ty >= this.h) return ' ';
      if (tx < 0 || tx >= this.w) return '#';
      return this.g[ty][tx];
    }
    set(tx, ty, c) { if (ty >= 0 && ty < this.h && tx >= 0 && tx < this.w) this.g[ty][tx] = c; }
    solid(tx, ty) { return !!SOLID[this.tile(tx, ty)]; }
    moveX(b, dx) {
      if (!dx) return false;
      b.x += dx;
      const y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 0.01) / T);
      if (dx > 0) {
        const tx = Math.floor((b.x + b.w - 0.01) / T);
        for (let ty = y0; ty <= y1; ty++) if (this.solid(tx, ty)) { b.x = tx * T - b.w; return true; }
      } else {
        const tx = Math.floor(b.x / T);
        for (let ty = y0; ty <= y1; ty++) if (this.solid(tx, ty)) { b.x = (tx + 1) * T; return true; }
      }
      return false;
    }
    moveY(b, dy, isPlayer) {
      if (!dy) return null;
      const prevTop = b.y, prevBottom = b.y + b.h;
      b.y += dy;
      const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 0.01) / T);
      if (dy > 0) {
        const ty = Math.floor((b.y + b.h - 0.01) / T);
        for (let tx = x0; tx <= x1; tx++) {
          const c = this.tile(tx, ty);
          if (SOLID[c] || (c === '-' && prevBottom <= ty * T + 0.01)) { b.y = ty * T - b.h; return { side: 'bottom', tx, ty }; }
        }
      } else {
        const ty = Math.floor(b.y / T);
        let best = null;
        for (let tx = x0; tx <= x1; tx++) {
          const c = this.tile(tx, ty);
          const hidden = isPlayer && (c === 'H' || c === 'h') && prevTop >= (ty + 1) * T - 0.5;
          if (SOLID[c] || hidden) {
            const d = Math.abs((tx + 0.5) * T - (b.x + b.w / 2));
            if (!best || d < best.d) best = { tx, ty, d };
          }
        }
        if (best) { b.y = (best.ty + 1) * T; return { side: 'top', tx: best.tx, ty: best.ty }; }
      }
      return null;
    }
  }
  PQ.World = World;

  /* ================================================================== */
  /* Player                                                               */
  /* ================================================================== */
  const P = {
    RUN: 150, ACC: 950, AIR_ACC: 680, DEC: 1150, AIR_DEC: 380, TURN: 1900,
    JUMP: 440, DJUMP: 390, G_UP: 1250, G_DOWN: 1650, MAXFALL: 520, CUT: 0.45,
  };
  PQ.PHYS = P;

  class Player {
    constructor(x, y) {
      this.w = 10; this.h = 14;
      this.reset(x, y);
      this.canDouble = false;
    }
    reset(x, y) {
      this.x = x; this.y = y; this.vx = 0; this.vy = 0;
      this.onGround = false; this.facing = 1; this.hp = 3; this.inv = 0; this.coyote = 0; this.jumpBuf = 0;
      this.jumping = false; this.usedDouble = false; this.riding = null; this.dead = false; this.deadT = 0;
      this.runDist = 0; this.auto = null; this.hurtFlash = 0; this.airT = 0; this.forceFrame = null; this.slid = false;
    }
    get cx() { return this.x + this.w / 2; }
    update(dt, G) {
      const W = G.world, I = PQ.Input;
      if (this.dead) {
        this.deadT += dt;
        if (this.deadKind === 'hit' && this.deadT > 0.5) { this.vy += 1500 * dt; this.y += this.vy * dt; }
        return;
      }
      this.inv = Math.max(0, this.inv - dt);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt);
      if (this.auto) { this.auto(dt, G); return; }

      if (this.riding) { W.moveX(this, this.riding.dx); this.y = this.riding.y - this.h; }

      const dir = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
      const g = this.onGround;
      if (dir) {
        if (this.vx * dir < 0) this.vx += dir * (g ? P.TURN : P.AIR_ACC * 1.3) * dt;
        else this.vx += dir * (g ? P.ACC : P.AIR_ACC) * dt;
        this.facing = dir;
        if (g && this.vx * dir < 0 && Math.abs(this.vx) > 80 && G.frame % 4 === 0) G.dust(this.cx, this.y + this.h, 1);
      } else {
        const s = Math.sign(this.vx);
        this.vx -= s * (g ? P.DEC : P.AIR_DEC) * dt;
        if (Math.sign(this.vx) !== s) this.vx = 0;
      }
      this.vx = PQ.clamp(this.vx, -P.RUN, P.RUN);

      // Jump: buffered input + coyote time + optional double jump
      if (I.pressed('jump')) this.jumpBuf = 0.13; else this.jumpBuf -= dt;
      this.coyote = g ? 0.09 : this.coyote - dt;
      if (this.jumpBuf > 0) {
        if (this.coyote > 0) {
          this.vy = -P.JUMP; this.coyote = 0; this.jumpBuf = 0; this.onGround = false; this.riding = null; this.jumping = true;
          G.sfx('jump'); G.dust(this.cx, this.y + this.h, 4);
        } else if (this.canDouble && !this.usedDouble) {
          this.vy = -P.DJUMP; this.usedDouble = true; this.jumpBuf = 0; this.jumping = true;
          G.sfx('djump');
          G.burst(this.cx, this.y + this.h, 10, ['#ffffff', '#8ae4ff'], 90, 0.35, 0, 1);
        }
      }
      if (this.jumping && !I.down('jump') && this.vy < 0) { this.vy *= P.CUT; this.jumping = false; }
      if (this.vy >= 0) this.jumping = false;
      const grav = this.vy < 0 && I.down('jump') ? P.G_UP : P.G_DOWN;
      this.vy = Math.min(this.vy + grav * dt, P.MAXFALL);

      const prevBottom = this.y + this.h;
      this.prevBottom = prevBottom;
      const fallSpeed = this.vy;
      if (W.moveX(this, this.vx * dt)) this.vx = 0;
      const wasGround = this.onGround;
      this.onGround = false;
      const hit = W.moveY(this, this.vy * dt, true);
      if (hit) {
        if (hit.side === 'bottom') {
          this.onGround = true;
          if (!wasGround && fallSpeed > 250) G.dust(this.cx, this.y + this.h, 3);
          this.vy = 0; this.usedDouble = false;
        } else {
          G.hitBlock(hit.tx, hit.ty);
          this.vy = 30; this.jumping = false;
        }
      }
      // Moving platforms (one-way from above)
      this.riding = null;
      if (this.vy >= 0) {
        for (const p of G.platforms) {
          if (this.x + this.w > p.x + 1 && this.x < p.x + p.w - 1 && prevBottom <= p.y + 4 && this.y + this.h >= p.y) {
            this.y = p.y - this.h; this.vy = 0; this.onGround = true; this.riding = p; this.usedDouble = false;
            break;
          }
        }
      }
      if (this.onGround) this.runDist += Math.abs(this.vx) * dt; else this.airT += dt;

      // Hazards
      const tx0 = Math.floor(this.x / T), tx1 = Math.floor((this.x + this.w - 0.01) / T);
      const ty0 = Math.floor(this.y / T), ty1 = Math.floor((this.y + this.h - 0.01) / T);
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const c = W.tile(tx, ty);
          if (c === '^' && this.y + this.h > ty * T + 9 && this.x + this.w > tx * T + 1 && this.x < tx * T + 15) {
            this.hurt(G, this.cx - this.facing * 10);
          }
          if ((c === 'W' || c === 'L') && this.y + this.h > ty * T + 5) { G.killPlayer(c === 'L' ? 'lava' : 'water'); return; }
        }
      }
      if (this.y > W.h * T + 24) G.killPlayer('pit');
    }
    bounce(strong) {
      this.vy = PQ.Input.down('jump') || strong ? -400 : -280;
      this.jumping = PQ.Input.down('jump');
      this.onGround = false; this.usedDouble = false;
    }
    hurt(G, fromX) {
      if (this.inv > 0 || this.dead || G.god) return;
      this.hp--;
      G.shake(4);
      if (this.hp <= 0) { G.killPlayer('hit'); return; }
      G.sfx('hurt');
      this.inv = 1.6; this.hurtFlash = 0.25;
      this.vy = -270; this.vx = (this.cx < fromX ? -1 : 1) * 150; this.onGround = false; this.riding = null;
      G.burst(this.cx, this.y + 7, 8, ['#ffffff', '#ff4a6a'], 110, 0.4, 200, 1);
    }
    frame(G) {
      const A = Art.player;
      if (this.dead) return A.fall;
      if (this.forceFrame) return A[this.forceFrame];
      if (!this.onGround) return this.vy < 0 ? A.jump : A.fall;
      if (Math.abs(this.vx) > 8) return A.run[Math.floor(this.runDist / 7) % 4];
      return G.t % 1.2 < 0.6 ? A.idle : A.idle2;
    }
    draw(ctx, cx, cy, G) {
      if (this.inv > 0 && !this.dead && (G.frame >> 2) & 1) return;
      const fr = this.frame(G);
      const set = this.hurtFlash > 0 ? fr.w : fr.n;
      const img = set[this.facing > 0 ? 0 : 1];
      const bob = fr === Art.player.run[1] || fr === Art.player.run[3] ? -1 : 0;
      ctx.drawImage(img, Math.round(this.x - 1 - cx), Math.round(this.y - 2 - cy + bob));
    }
  }
  PQ.Player = Player;

  /* ================================================================== */
  /* Enemies                                                              */
  /* ================================================================== */
  const WALKERS = { slime: [14, 10, 26, 100], beetle: [14, 11, 48, 200], imp: [12, 14, 40, 200] };
  class Walker {
    constructor(kind, tx, ty) {
      const s = WALKERS[kind];
      this.kind = kind; this.w = s[0]; this.h = s[1]; this.speed = s[2]; this.points = s[3];
      this.x = tx * T + (T - this.w) / 2; this.y = (ty + 1) * T - this.h;
      this.vx = 0; this.vy = 0; this.dir = -1; this.alive = true; this.t = Math.random() * 4;
      this.hop = 1 + Math.random() * 2; this.stompable = true; this.active = false; this.onGround = false;
    }
    update(dt, G) {
      if (!this.alive) {
        this.deadT -= dt;
        if (this.deadKind === 'flip') { this.vy += 1200 * dt; this.y += this.vy * dt; this.x += this.vx * dt; }
        if (this.deadT <= 0) this.remove = true;
        return;
      }
      if (!this.active) { if (this.x < G.cam.x + PQ.W + 40 && this.x > G.cam.x - 80) this.active = true; else return; }
      this.t += dt;
      const W = G.world;
      this.vx = this.dir * this.speed;
      this.vy = Math.min(this.vy + 1400 * dt, 500);
      if (W.moveX(this, this.vx * dt)) this.dir *= -1;
      this.onGround = false;
      const h = W.moveY(this, this.vy * dt);
      if (h && h.side === 'bottom') { this.onGround = true; this.vy = 0; }
      if (this.onGround) {
        const fx = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
        const c = W.tile(Math.floor(fx / T), Math.floor((this.y + this.h + 2) / T));
        if (!SOLID[c] && c !== '-') this.dir *= -1;
        if (this.kind === 'imp') {
          this.hop -= dt;
          if (this.hop <= 0) { this.vy = -250; this.hop = 1.4 + Math.random() * 1.6; this.onGround = false; }
        }
      }
      const ft = W.tile(Math.floor((this.x + this.w / 2) / T), Math.floor((this.y + this.h - 2) / T));
      if (ft === 'W' || ft === 'L' || this.y > W.h * T + 40) this.remove = true;
    }
    stomp(G) {
      this.alive = false; this.deadKind = 'squash'; this.deadT = 0.45;
      G.burst(this.x + this.w / 2, this.y + this.h / 2, 10, this.kind === 'slime' ? ['#8ce86a', '#ffffff'] : this.kind === 'beetle' ? ['#6af6ff', '#b9a0ff', '#ffffff'] : ['#ff7a1a', '#ffd23a'], 120, 0.45, 300, 2);
      G.ring(this.x + this.w / 2, this.y + this.h / 2);
    }
    knock(G, dir) {
      this.alive = false; this.deadKind = 'flip'; this.deadT = 1.2; this.vy = -260; this.vx = (dir || 1) * 60;
      G.burst(this.x + this.w / 2, this.y, 6, ['#ffffff', '#ffd23a'], 80, 0.3, 0, 1);
    }
    draw(ctx, cx, cy, G) {
      const fr = Math.floor(this.t * 6) % 2;
      const set = this.kind === 'slime' ? Art.slime : this.kind === 'beetle' ? Art.beetle : Art.imp;
      const img = set[fr][this.dir > 0 ? 0 : 1];
      const x = Math.round(this.x - 1 - cx), y = Math.round(this.y - 2 - cy);
      if (!this.alive && this.deadKind === 'squash') {
        if (this.kind === 'slime') ctx.drawImage(Art.slimeFlat[0], x, y + img.height - 5);
        else ctx.drawImage(img, x, y + img.height / 2, img.width, img.height / 2);
        return;
      }
      if (!this.alive && this.deadKind === 'flip') {
        ctx.save(); ctx.translate(x, y + img.height); ctx.scale(1, -1); ctx.drawImage(img, 0, 0); ctx.restore();
        return;
      }
      ctx.drawImage(img, x, y);
    }
  }

  class Bat {
    constructor(tx, ty) {
      this.hx = tx * T; this.hy = ty * T; this.w = 12; this.h = 8;
      this.t = Math.random() * 6; this.x = this.hx; this.y = this.hy; this.alive = true; this.stompable = true; this.points = 200; this.dir = 1;
    }
    update(dt, G) {
      if (!this.alive) {
        this.deadT -= dt; this.vy += 1200 * dt; this.y += this.vy * dt;
        if (this.deadT <= 0) this.remove = true;
        return;
      }
      this.t += dt;
      this.x = this.hx + Math.sin(this.t * 0.8) * 44;
      this.y = this.hy + Math.sin(this.t * 2.4) * 12;
      this.dir = Math.cos(this.t * 0.8) >= 0 ? 1 : -1;
    }
    stomp(G) {
      this.alive = false; this.deadT = 1; this.vy = 0; this.deadKind = 'flip';
      G.burst(this.x + 6, this.y + 4, 10, ['#a86ae0', '#ffde3a', '#ffffff'], 120, 0.45, 300, 2);
      G.ring(this.x + 6, this.y + 4);
    }
    knock(G) { this.stomp(G); }
    draw(ctx, cx, cy, G) {
      const fr = this.alive ? Math.floor(this.t * 9) % 2 : 1;
      const img = Art.bat[fr][this.dir > 0 ? 0 : 1];
      const x = Math.round(this.x - 3 - cx), y = Math.round(this.y - 2 - cy);
      if (!this.alive) { ctx.save(); ctx.translate(x, y + 12); ctx.scale(1, -1); ctx.drawImage(img, 0, 0); ctx.restore(); return; }
      ctx.drawImage(img, x, y);
    }
  }

  class Ember {
    constructor(tx, ty) {
      this.x = tx * T + 4; this.base = ty * T + 2; this.y = this.base + 30; this.w = 8; this.h = 8;
      this.vy = 0; this.wait = 0.4 + Math.random() * 1.6; this.fly = false; this.hazard = true; this.t = 0; this.alive = true;
    }
    get danger() { return this.fly; }
    update(dt, G) {
      this.t += dt;
      if (!this.fly) {
        this.wait -= dt;
        if (this.wait <= 0) {
          this.fly = true; this.vy = -440; this.y = this.base;
          if (G.onScreen(this, 32)) { G.sfx('sizzle'); G.lavaSplash(this.x + 4, this.base + 4); }
        }
        return;
      }
      this.vy += 900 * dt; this.y += this.vy * dt;
      if (G.frame % 3 === 0) G.particle(this.x + 4 + (Math.random() - 0.5) * 4, this.y + (this.vy < 0 ? 8 : 0), 0, 0, 0.35, Math.random() < 0.5 ? '#ff7a1a' : '#ffd23a', 2, -20);
      if (this.vy > 0 && this.y > this.base + 4) { this.fly = false; this.wait = 1.3 + Math.random() * 1.5; this.y = this.base + 30; if (G.onScreen(this, 32)) G.lavaSplash(this.x + 4, this.base + 4); }
    }
    draw(ctx, cx, cy) {
      if (!this.fly) return;
      const img = Art.ember[Math.floor(this.t * 10) % 2];
      ctx.drawImage(img, Math.round(this.x - 2 - cx), Math.round(this.y - 2 - cy));
    }
  }

  class Jet {
    constructor(tx, ty) { this.x = tx * T; this.y = ty * T; this.t = (tx * 0.53) % 3.4; this.hazard = true; this.w = 10; this.h = 42; this.alive = true; this.was = 'off'; }
    get phase() { const p = this.t % 3.4; return p < 1.4 ? 'off' : p < 2.0 ? 'warn' : 'on'; }
    get danger() { return this.phase === 'on'; }
    hitbox() { return { x: this.x + 3, y: this.y + 8 - 40, w: 10, h: 40 }; }
    update(dt, G) {
      this.t += dt;
      const ph = this.phase;
      if (ph === 'on' && this.was !== 'on' && G.onScreen({ x: this.x, y: this.y, w: 16, h: 16 }, 0)) G.sfx('jet');
      if (ph === 'warn' && G.frame % 4 === 0) G.particle(this.x + 8 + (Math.random() - 0.5) * 6, this.y + 6, (Math.random() - 0.5) * 30, -40 - Math.random() * 30, 0.3, '#ffb03a', 1, 100);
      this.was = ph;
    }
    draw(ctx, cx, cy, G) {
      const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
      if (this.phase === 'on') {
        const p = (this.t % 3.4) - 2.0;
        const grow = Math.min(1, p / 0.15) * Math.min(1, (1.4 - p) / 0.15);
        const hgt = Math.round(40 * grow);
        for (let i = 0; i < hgt; i += 2) {
          const k = i / 40;
          const wob = Math.sin(G.t * 30 + i * 0.6) * 1.5;
          const wv = Math.max(2, Math.round((5 - k * 3) + wob));
          ctx.fillStyle = '#ff4a10'; ctx.fillRect(x + 8 - wv, y + 8 - i - 2, wv * 2, 2);
          ctx.fillStyle = '#ffa030'; ctx.fillRect(x + 8 - wv + 1, y + 8 - i - 2, Math.max(1, wv * 2 - 2), 2);
          if (wv > 3) { ctx.fillStyle = '#fff6c0'; ctx.fillRect(x + 8 - (wv - 3), y + 8 - i - 2, (wv - 3) * 2, 2); }
        }
      }
      ctx.drawImage(Art.flameJetBase, x, y + 8);
    }
  }

  class Crusher {
    constructor(tx, ty) { this.x = tx * T; this.home = ty * T; this.y = this.home; this.w = 24; this.h = 26; this.state = 'idle'; this.t = 0; this.vy = 0; this.hazard = true; this.alive = true; }
    get danger() { return true; }
    hitbox() { return { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 2 }; }
    update(dt, G) {
      const p = G.player;
      this.t -= dt;
      switch (this.state) {
        case 'idle':
          if (this.t <= 0 && !p.dead && p.x + p.w > this.x - 14 && p.x < this.x + this.w + 14 && p.y > this.y) { this.state = 'shake'; this.t = 0.3; }
          break;
        case 'shake': if (this.t <= 0) { this.state = 'fall'; this.vy = 0; } break;
        case 'fall': {
          this.vy = Math.min(this.vy + 2400 * dt, 650);
          const h = G.world.moveY(this, this.vy * dt);
          if (h) {
            this.state = 'ground'; this.t = 0.9;
            if (G.onScreen(this, 0)) { G.shake(4); G.sfx('slam'); }
            G.dust(this.x + 2, this.y + this.h, 3); G.dust(this.x + this.w - 2, this.y + this.h, 3);
          }
          break;
        }
        case 'ground': if (this.t <= 0) this.state = 'rise'; break;
        case 'rise':
          this.y -= 55 * dt;
          if (this.y <= this.home) { this.y = this.home; this.state = 'idle'; this.t = 0.7; }
          break;
      }
    }
    draw(ctx, cx, cy, G) {
      const sx = this.state === 'shake' ? (G.frame % 2 ? 1 : -1) : 0;
      const x = Math.round(this.x - cx + sx), y = Math.round(this.y - cy);
      // chain up to home
      ctx.fillStyle = '#1a1418';
      for (let yy = Math.round(this.home - cy) - 8; yy < y; yy += 4) { ctx.fillRect(x + 11, yy, 2, 3); }
      ctx.drawImage(Art.crusher, x, y);
    }
  }

  /* ================================================================== */
  /* Moving platform                                                      */
  /* ================================================================== */
  class Mover {
    constructor(o) {
      this.x0 = o.x * T; this.y0 = o.y * T; this.w = o.w * T; this.h = 8;
      this.rx = (o.dx || 0) * T; this.ry = (o.dy || 0) * T; this.speed = o.speed || 0.5;
      this.t = 0; this.x = this.x0; this.y = this.y0; this.dx = 0; this.dy = 0;
    }
    update(dt) {
      this.t += dt * this.speed;
      const k = 0.5 - 0.5 * Math.cos(this.t * Math.PI);
      const nx = this.x0 + this.rx * k, ny = this.y0 + this.ry * k;
      this.dx = nx - this.x; this.dy = ny - this.y; this.x = nx; this.y = ny;
    }
    draw(ctx, cx, cy, G) {
      const x = Math.round(this.x - cx), y = Math.round(this.y - cy), w = this.w;
      const th = G.level.theme;
      if (th === 'emerald') {
        ctx.fillStyle = '#3a2010'; ctx.fillRect(x, y, w, 8);
        ctx.fillStyle = '#c08040'; ctx.fillRect(x + 1, y + 1, w - 2, 5);
        ctx.fillStyle = '#e8b070'; ctx.fillRect(x + 1, y + 1, w - 2, 1);
        ctx.fillStyle = '#7a4a20'; ctx.fillRect(x + 1, y + 6, w - 2, 1);
        ctx.fillStyle = '#3a2010'; for (let i = 8; i < w; i += 8) ctx.fillRect(x + i, y + 1, 1, 5);
        ctx.fillStyle = '#5ad04a'; ctx.fillRect(x + 2, y + 7, 3, 2); ctx.fillRect(x + w - 6, y + 7, 3, 3);
      } else if (th === 'crystal') {
        ctx.fillStyle = '#0e0828'; ctx.fillRect(x, y, w, 8);
        ctx.fillStyle = '#8a5ae0'; ctx.fillRect(x + 1, y + 1, w - 2, 5);
        ctx.fillStyle = '#d8c0ff'; ctx.fillRect(x + 1, y + 1, w - 2, 1);
        const glow = 0.5 + 0.5 * Math.sin(G.t * 4);
        ctx.fillStyle = `rgba(106,246,255,${0.5 + glow * 0.5})`; ctx.fillRect(x + 3, y + 6, w - 6, 1);
        for (let i = 4; i < w - 2; i += 10) { ctx.fillStyle = '#6af6ff'; ctx.fillRect(x + i, y + 8, 2, 2 + (i % 3)); }
      } else {
        ctx.fillStyle = '#0e0c14'; ctx.fillRect(x, y, w, 8);
        ctx.fillStyle = '#5a5868'; ctx.fillRect(x + 1, y + 1, w - 2, 6);
        ctx.fillStyle = '#9a98aa'; ctx.fillRect(x + 1, y + 1, w - 2, 1);
        ctx.fillStyle = '#ff7a2a'; for (let i = 4; i < w - 2; i += 8) ctx.fillRect(x + i, y + 4, 2, 1);
        ctx.fillStyle = '#1a1418'; ctx.fillRect(x + 3, y - 40, 1, 40); ctx.fillRect(x + w - 4, y - 40, 1, 40);
      }
    }
  }

  /* ================================================================== */
  /* Pickups                                                              */
  /* ================================================================== */
  class Item {
    constructor(kind, x, y) { this.kind = kind; this.x = x; this.y = y; this.baseY = y; this.t = 0; this.w = 12; this.h = 12; this.emerge = 0.55; }
    update(dt, G) {
      this.t += dt;
      if (this.kind === 'coinpop') {
        const k = Math.min(1, this.t / 0.5);
        this.y = this.baseY - Math.sin(k * Math.PI) * 36 - k * 6;
        if (this.t > 0.5) { this.remove = true; G.sparkle(this.x + 5, this.y + 6); }
        return;
      }
      if (this.t < this.emerge) this.y = this.baseY - 16 * (this.t / this.emerge);
      else this.y = this.baseY - 16 + Math.sin((this.t - this.emerge) * 3) * 2;
      if (this.t > this.emerge * 0.7 && PQ.overlap(this, G.player) && !G.player.dead) { this.remove = true; G.collectItem(this); }
    }
    draw(ctx, cx, cy, G) {
      const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
      if (this.kind === 'coinpop') { ctx.drawImage(Art.coin[Math.floor(this.t * 24) % 6], x, y); return; }
      const glow = Art.tintedGlow('rgba(255,255,220,0.6)', 32);
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.t * 6);
      ctx.drawImage(glow, x - 10, y - 10);
      ctx.globalAlpha = 1;
      const img = this.kind === 'feather' ? Art.feather : this.kind === 'heart' ? Art.heart : Art.gem;
      ctx.drawImage(img, x + Math.round((12 - img.width) / 2), y + Math.round((12 - img.height) / 2));
    }
  }

  /* ================================================================== */
  /* Boss: MAGMAW, the Molten King                                       */
  /* ================================================================== */
  class Boss {
    constructor(G, tx, ty) {
      this.w = 40; this.h = 34;
      this.home = tx * T;
      this.groundY = (ty + 1) * T;
      this.ax0 = (G.arena.x0 + 1) * T + 2;
      this.ax1 = G.arena.x1 * T - this.w - 2;
      this.reset();
    }
    reset() {
      this.x = this.home; this.y = -80; this.vx = 0; this.vy = 0;
      this.hp = this.maxHp = 9; this.state = 'wait'; this.t = 0; this.facing = -1;
      this.flash = 0; this.inv = 0; this.mouth = 0; this.last = ''; this.volleys = 0; this.boomT = 0; this.alive = true;
    }
    get phase() { return this.hp > 6 ? 1 : this.hp > 3 ? 2 : 3; }
    get mul() { return [1, 1.22, 1.45][this.phase - 1]; }
    get cx() { return this.x + this.w / 2; }
    body() { return { x: this.x + 4, y: this.y + 6, w: this.w - 8, h: this.h - 6 }; }
    start() { this.state = 'intro'; this.t = 0; this.y = -80; this.vy = 0; }
    update(dt, G) {
      const p = G.player;
      this.t += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.inv = Math.max(0, this.inv - dt);
      let mouthTarget = 0;
      const face = () => { this.facing = p.cx < this.cx ? -1 : 1; };
      switch (this.state) {
        case 'wait': return;
        case 'intro':
          this.vy += 1500 * dt; this.y += this.vy * dt;
          if (this.y + this.h >= this.groundY) {
            this.y = this.groundY - this.h; this.state = 'roar'; this.t = 0;
            G.shake(9); G.sfx('slam'); G.sfx('roar'); G.dust(this.x, this.groundY, 6); G.dust(this.x + this.w, this.groundY, 6);
          }
          break;
        case 'roar':
          mouthTarget = 1;
          if (this.t > 0.2 && this.t < 1.2 && G.frame % 3 === 0) G.shake(2);
          if (this.t > 1.5) { this.state = 'idle'; this.t = 0; G.bossReady = true; }
          break;
        case 'idle': {
          face();
          const speed = 28 * this.mul;
          if (Math.abs(p.cx - this.cx) > 30) this.x = PQ.clamp(this.x + this.facing * speed * dt, this.ax0, this.ax1);
          if (this.t > [1.1, 0.8, 0.55][this.phase - 1]) this.choose();
          break;
        }
        case 'chargeWind':
          mouthTarget = 0.4;
          if (G.frame % 2 === 0) G.dust(this.cx - this.facing * 16, this.groundY, 1);
          if (this.t > 0.65 / this.mul) { this.state = 'charge'; this.vx = this.facing * 235 * this.mul; this.t = 0; }
          break;
        case 'charge':
          mouthTarget = 0.6;
          this.x += this.vx * dt;
          if (G.frame % 3 === 0) G.dust(this.cx - this.facing * 18, this.groundY, 1);
          if (this.x <= this.ax0 || this.x >= this.ax1) {
            this.x = PQ.clamp(this.x, this.ax0, this.ax1);
            this.state = 'stunned'; this.t = 0; this.vx = 0;
            G.shake(7); G.sfx('slam');
            if (this.phase >= 2) G.dropRocks(this.phase === 3 ? 4 : 2);
          }
          break;
        case 'stunned':
          if (G.frame % 10 === 0) G.particle(this.cx + (Math.random() - 0.5) * 20, this.y + 2, 0, -30, 0.6, '#fff6a0', 2, 0);
          if (this.t > 1.1) { this.state = 'idle'; this.t = 0; }
          break;
        case 'leapWind':
          face(); mouthTarget = 0.3;
          if (this.t > 0.35 / this.mul) {
            const tx = PQ.clamp(p.cx - this.w / 2, this.ax0, this.ax1);
            this.vy = -560; this.vx = (tx - this.x) / 0.8; this.state = 'leap'; this.t = 0;
            G.dust(this.cx, this.groundY, 5);
          }
          break;
        case 'leap':
          this.vy += 1400 * dt; this.x = PQ.clamp(this.x + this.vx * dt, this.ax0, this.ax1); this.y += this.vy * dt;
          if (this.vy > 0 && this.y + this.h >= this.groundY) {
            this.y = this.groundY - this.h; this.state = 'land'; this.t = 0; this.vx = 0;
            G.shake(7); G.sfx('slam');
            G.addShock(this.x + 2, -1, this.mul); G.addShock(this.x + this.w - 14, 1, this.mul);
            if (this.phase === 3) G.dropRocks(3);
          }
          break;
        case 'land': if (this.t > 0.55 / this.mul) { this.state = 'idle'; this.t = 0; } break;
        case 'fireWind':
          face(); mouthTarget = 1;
          if (G.frame % 2 === 0) G.particle(this.cx + this.facing * 12, this.y + 20, (Math.random() - 0.5) * 40, -20, 0.3, '#ffd23a', 2, 0);
          if (this.t > 0.6 / this.mul) { this.volleys = this.phase === 3 ? 3 : this.phase === 2 ? 2 : 1; this.state = 'fire'; this.t = 99; }
          break;
        case 'fire':
          mouthTarget = 1;
          if (this.volleys > 0 && this.t > 0.42) { this.shoot(G); this.volleys--; this.t = 0; }
          else if (this.volleys <= 0 && this.t > 0.5) { this.state = 'idle'; this.t = 0; }
          break;
        case 'hurt':
          this.x = PQ.clamp(this.x + this.vx * dt, this.ax0, this.ax1); this.vx *= 0.9;
          mouthTarget = 0.8;
          if (this.t > 0.55) { this.state = 'idle'; this.t = 0; }
          break;
        case 'dying':
          mouthTarget = 1;
          this.boomT -= dt;
          if (this.boomT <= 0) {
            this.boomT = 0.13;
            const ex = this.x + Math.random() * this.w, ey = this.y + Math.random() * this.h;
            G.explosion(ex, ey);
            if (Math.random() < 0.35) G.sfx('boom');
            G.shake(3);
          }
          if (this.t > 2.8) {
            this.state = 'dead'; this.alive = false;
            for (let i = 0; i < 6; i++) G.explosion(this.x + Math.random() * this.w, this.y + Math.random() * this.h);
            G.sfx('boom'); G.shake(10); G.whiteFlash = 0.6;
            G.bossDefeated(this);
          }
          break;
      }
      if (this.state !== 'leap' && this.state !== 'intro' && this.state !== 'wait' && this.state !== 'dead') this.y = this.groundY - this.h;
      this.mouth = PQ.lerp(this.mouth, mouthTarget, Math.min(1, dt * 12));
      if (this.phase === 3 && this.alive && G.frame % 6 === 0) G.particle(this.x + Math.random() * this.w, this.y + 4, 0, -30, 0.7, 'rgba(200,180,180,0.6)', 2, -10);
    }
    choose() {
      let opts = ['charge', 'leap', 'fire'];
      if (this.phase >= 2) opts.push('leap', 'fire');
      opts = opts.filter((o) => o !== this.last);
      const pick = opts[Math.floor(Math.random() * opts.length)];
      this.last = pick; this.state = pick + 'Wind'; this.t = 0;
    }
    shoot(G) {
      const p = G.player;
      const n = this.phase === 1 ? 3 : this.phase === 2 ? 4 : 3;
      const ox = this.cx + this.facing * 12, oy = this.y + 16;
      const g = 700, vy0 = -330;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 44 + (Math.random() - 0.5) * 12;
        const tx = PQ.clamp(p.cx + off, this.ax0, this.ax1 + this.w);
        const dy = this.groundY - 8 - oy;
        const tt = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * g * dy)) / g;
        G.shots.push({ kind: 'fireball', x: ox - 5, y: oy - 5, w: 10, h: 10, vx: (tx - ox) / tt, vy: vy0, g, t: 0 });
      }
      G.sfx('fire');
    }
    hit(G) {
      if (this.inv > 0 || !['idle', 'chargeWind', 'charge', 'stunned', 'leapWind', 'leap', 'land', 'fireWind', 'fire'].includes(this.state)) return false;
      this.hp--; this.flash = 0.5; this.inv = 0.9;
      G.sfx('bossHit'); G.shake(6);
      G.burst(this.cx, this.y + 4, 16, ['#ffd23a', '#ff7a1a', '#ffffff'], 160, 0.6, 400, 2);
      G.addScore(500, this.cx, this.y - 6);
      if (this.hp <= 0) {
        this.state = 'dying'; this.t = 0; this.vx = 0; this.inv = 99;
        PQ.Audio.stop(); G.sfx('roar'); G.shots.length = 0;
      } else {
        this.state = 'hurt'; this.t = 0; this.vx = (G.player.cx < this.cx ? 1 : -1) * 140;
        if (this.hp === 6 || this.hp === 3) { G.sfx('roar'); G.popup(this.hp === 3 ? 'ENRAGED!' : 'ANGRY!', this.cx, this.y - 14, '#ff6a3a'); }
      }
      return true;
    }
    draw(ctx, cx, cy, G) {
      if (this.state === 'wait' || this.state === 'dead') return;
      const shakeX = this.state === 'chargeWind' || this.state === 'dying' ? (G.frame % 2 ? 1 : -1) : 0;
      const squash = this.state === 'leapWind' ? 3 : this.state === 'land' && this.t < 0.12 ? 3 : 0;
      const x = Math.round(this.x - 2 - cx + shakeX), y = Math.round(this.y - 6 - cy + squash);
      const flashing = this.flash > 0 && (G.frame >> 1) & 1;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      const sh = this.y + this.h < this.groundY - 2 ? 0.6 : 1;
      ctx.fillRect(Math.round(this.x + 6 - cx), Math.round(this.groundY - 2 - cy), Math.round((this.w - 12) * sh), 3);
      // horns
      ctx.fillStyle = '#0c0408';
      ctx.fillRect(x + 6, y + 2, 6, 6); ctx.fillRect(x + 32, y + 2, 6, 6);
      ctx.fillRect(x + 3, y - 2, 5, 6); ctx.fillRect(x + 36, y - 2, 5, 6);
      ctx.fillStyle = '#e8d8c0';
      ctx.fillRect(x + 7, y + 3, 4, 4); ctx.fillRect(x + 33, y + 3, 4, 4);
      ctx.fillRect(x + 4, y - 1, 3, 4); ctx.fillRect(x + 37, y - 1, 3, 4);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 4, y - 1, 1, 2); ctx.fillRect(x + 37, y - 1, 1, 2);
      // body
      ctx.drawImage(flashing ? Art.bossWhite : Art.bossBody, x, y, 44, 40 - squash);
      if (!flashing) {
        const pulse = 0.55 + 0.45 * Math.sin(G.t * (this.phase === 3 ? 10 : 4));
        ctx.globalAlpha = pulse; ctx.drawImage(Art.bossCracks, x, y, 44, 40 - squash); ctx.globalAlpha = 1;
        if (this.phase === 3) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(G.t * 12); ctx.drawImage(Art.bossRed, x, y, 44, 40 - squash); ctx.globalAlpha = 1; }
      }
      // face (looks toward facing direction)
      const fo = this.facing * 3;
      const ey = y + 14 + Math.floor(squash / 2);
      ctx.fillStyle = '#0c0408'; ctx.fillRect(x + 11 + fo, ey - 2, 9, 2); ctx.fillRect(x + 25 + fo, ey - 2, 9, 2);
      ctx.fillStyle = this.state === 'stunned' ? '#ffffff' : '#ffe03a';
      ctx.fillRect(x + 13 + fo, ey, 6, 4); ctx.fillRect(x + 26 + fo, ey, 6, 4);
      ctx.fillStyle = this.state === 'stunned' ? '#888' : '#ff3a1a';
      ctx.fillRect(x + 16 + fo + this.facing, ey + 1, 2, 2); ctx.fillRect(x + 28 + fo + this.facing, ey + 1, 2, 2);
      // mouth
      const mh = 2 + Math.round(this.mouth * 7);
      const my = ey + 8;
      ctx.fillStyle = '#0c0408'; ctx.fillRect(x + 13 + fo, my, 19, mh + 2);
      ctx.fillStyle = this.mouth > 0.4 ? '#ff7a1a' : '#5a0a08'; ctx.fillRect(x + 14 + fo, my + 1, 17, mh);
      if (this.mouth > 0.4) { ctx.fillStyle = '#ffe070'; ctx.fillRect(x + 17 + fo, my + 2, 11, Math.max(1, mh - 3)); }
      ctx.fillStyle = '#f0e8d8';
      for (let i = 0; i < 4; i++) { ctx.fillRect(x + 15 + fo + i * 4, my + 1, 2, 2); ctx.fillRect(x + 17 + fo + i * 4, my + mh - 1, 2, 2); }
      // fists
      const fy = y + 28 + Math.round(Math.sin(G.t * 6) * (this.state === 'idle' ? 1 : 0));
      for (const fx of [x - 4, x + 40]) {
        ctx.fillStyle = '#0c0408'; ctx.fillRect(fx, fy, 9, 9);
        ctx.fillStyle = flashing ? '#ffffff' : '#4a2e38'; ctx.fillRect(fx + 1, fy + 1, 7, 7);
        ctx.fillStyle = flashing ? '#ffffff' : '#ff7a1a'; ctx.fillRect(fx + 2, fy + 3, 1, 3); ctx.fillRect(fx + 5, fy + 2, 1, 2);
      }
      if (this.state === 'stunned') {
        for (let i = 0; i < 3; i++) {
          const a = G.t * 5 + (i * Math.PI * 2) / 3;
          ctx.fillStyle = '#fff6a0';
          ctx.fillRect(Math.round(x + 22 + Math.cos(a) * 14), Math.round(y - 4 + Math.sin(a) * 3), 2, 2);
        }
      }
    }
  }

  PQ.Ent = { Walker, Bat, Ember, Jet, Crusher, Mover, Item, Boss };
})();
