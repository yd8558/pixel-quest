/* PIXEL QUEST - engine.js
 * Core helpers: canvas utilities, RNG, pixel font, input (keyboard + touch), save data.
 */
'use strict';
(function () {
  const PQ = (window.PQ = window.PQ || {});
  PQ.W = 400;          // internal resolution width
  PQ.H = 225;          // internal resolution height
  PQ.T = 16;           // tile size

  PQ.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  PQ.lerp = (a, b, t) => a + (b - a) * t;
  PQ.overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  PQ.rng = function (seed) {
    let s = seed >>> 0 || 123456789;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  };

  PQ.canvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w | 0);
    c.height = Math.max(1, h | 0);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return { c, x };
  };

  /** Build a sprite from an array of strings and a palette map. */
  PQ.fromMap = function (rows, pal) {
    const h = rows.length, w = rows[0].length;
    const { c, x } = PQ.canvas(w, h);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const col = pal[rows[j][i]];
        if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
      }
    }
    return c;
  };

  /** Build a sprite from an inside-test and a color function, with automatic outline. */
  PQ.shape = function (w, h, inside, color, outline) {
    const { c, x } = PQ.canvas(w, h);
    const m = [];
    for (let j = 0; j < h; j++) {
      m[j] = [];
      for (let i = 0; i < w; i++) m[j][i] = !!inside(i + 0.5, j + 0.5);
    }
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (!m[j][i]) continue;
        const edge = !(m[j - 1] && m[j - 1][i]) || !(m[j + 1] && m[j + 1][i]) || !m[j][i - 1] || !m[j][i + 1];
        x.fillStyle = edge && outline ? outline : color(i, j);
        x.fillRect(i, j, 1, 1);
      }
    }
    return c;
  };

  PQ.silhouette = function (src, color) {
    const { c, x } = PQ.canvas(src.width, src.height);
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  };

  PQ.flip = function (src) {
    const { c, x } = PQ.canvas(src.width, src.height);
    x.translate(src.width, 0);
    x.scale(-1, 1);
    x.drawImage(src, 0, 0);
    return c;
  };

  /* ------------------------------------------------------------------ */
  /* Pixel font (5x7)                                                     */
  /* ------------------------------------------------------------------ */
  const G = {
    A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.',
    C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
    E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
    G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
    I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.', J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
    K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
    M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
    O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
    Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
    S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
    U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
    W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
    Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
    0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
    2: '.###.|#...#|....#|..##.|.#...|#....|#####', 3: '####.|....#|....#|.###.|....#|....#|####.',
    4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
    6: '.###.|#....|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|.#...|.#...|.#...',
    8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.', 9: '.###.|#...#|#...#|.####|....#|....#|.###.',
    '.': '.....|.....|.....|.....|.....|.##..|.##..', ',': '.....|.....|.....|.....|.##..|..#..|.#...',
    '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..', '?': '.###.|#...#|....#|..##.|..#..|.....|..#..',
    ':': '.....|.##..|.##..|.....|.##..|.##..|.....', '-': '.....|.....|.....|.###.|.....|.....|.....',
    '+': '.....|..#..|..#..|#####|..#..|..#..|.....', '/': '....#|....#|...#.|..#..|.#...|#....|#....',
    "'": '..#..|..#..|.#...|.....|.....|.....|.....', '*': '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
    '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.', ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...',
    '>': '.#...|..#..|...#.|....#|...#.|..#..|.#...', '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.',
    '%': '##..#|##..#|...#.|..#..|.#...|#..##|#..##', '=': '.....|.....|#####|.....|#####|.....|.....',
    ' ': '.....|.....|.....|.....|.....|.....|.....',
  };
  const glyphCache = new Map();
  function glyph(ch, color) {
    const key = ch + color;
    let g = glyphCache.get(key);
    if (g) return g;
    const def = (G[ch] || G['?']).split('|');
    const pal = { '#': color };
    g = PQ.fromMap(def, pal);
    glyphCache.set(key, g);
    return g;
  }
  PQ.Font = {
    width(str, s = 1) { return str.length ? (str.length * 6 - 1) * s : 0; },
    /** opts: align ('left'|'center'|'right'), shadow color, outline color */
    draw(ctx, str, x, y, color = '#fff', s = 1, opts = {}) {
      str = String(str).toUpperCase();
      const w = this.width(str, s);
      if (opts.align === 'center') x -= Math.floor(w / 2);
      else if (opts.align === 'right') x -= w;
      x = Math.round(x); y = Math.round(y);
      const pass = (col, ox, oy) => {
        for (let i = 0; i < str.length; i++) {
          const ch = str[i];
          if (ch === ' ') continue;
          ctx.drawImage(glyph(ch, col), x + i * 6 * s + ox, y + oy, 5 * s, 7 * s);
        }
      };
      if (opts.outline) {
        const o = opts.ow || s;
        pass(opts.outline, -o, 0); pass(opts.outline, o, 0); pass(opts.outline, 0, -o); pass(opts.outline, 0, o);
        pass(opts.outline, o, o);
      } else if (opts.shadow) {
        pass(opts.shadow, s, s);
      }
      pass(color, 0, 0);
      return w;
    },
  };

  /* ------------------------------------------------------------------ */
  /* Input                                                                */
  /* ------------------------------------------------------------------ */
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
    Escape: 'pause', KeyP: 'pause',
    Enter: 'confirm', NumpadEnter: 'confirm',
  };
  const Input = (PQ.Input = {
    keys: {}, cur: {}, prev: {}, latch: {},
    touch: { left: false, right: false, jump: false, pause: false },
    anyKeyLatch: false,
    pointer: null,
    init(canvas) {
      window.addEventListener('keydown', (e) => {
        const a = KEYMAP[e.code];
        this.anyKeyLatch = true;
        if (a) {
          if (!this.keys[e.code]) this.latch[a] = true;
          this.keys[e.code] = true;
          e.preventDefault();
        }
      });
      window.addEventListener('keyup', (e) => {
        if (KEYMAP[e.code]) { this.keys[e.code] = false; e.preventDefault(); }
      });
      window.addEventListener('blur', () => { this.keys = {}; });

      // Pointer on canvas (menus, tap to start)
      canvas.addEventListener('pointerdown', (e) => {
        const r = canvas.getBoundingClientRect();
        this.pointer = { x: ((e.clientX - r.left) / r.width) * PQ.W, y: ((e.clientY - r.top) / r.height) * PQ.H };
        this.anyKeyLatch = true;
      });

      // Touch buttons: hit-test every active touch against button rects (allows sliding between buttons)
      const btns = { left: 'tLeft', right: 'tRight', jump: 'tJump', pause: 'tPause' };
      const els = {};
      for (const k in btns) els[k] = document.getElementById(btns[k]);
      const update = (e) => {
        const st = { left: false, right: false, jump: false, pause: false };
        for (const t of e.touches) {
          for (const k in els) {
            const el = els[k];
            if (!el || el.offsetParent === null) continue;
            const r = el.getBoundingClientRect();
            const pad = 12;
            if (t.clientX >= r.left - pad && t.clientX <= r.right + pad && t.clientY >= r.top - pad && t.clientY <= r.bottom + pad) st[k] = true;
          }
        }
        for (const k in st) {
          if (st[k] && !this.touch[k]) this.latch[k] = true;
          this.touch[k] = st[k];
          if (els[k]) els[k].classList.toggle('on', st[k]);
        }
      };
      const touchZone = document.getElementById('touch');
      if (touchZone) {
        ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((ev) =>
          touchZone.addEventListener(ev, (e) => { e.preventDefault(); update(e); this.anyKeyLatch = true; }, { passive: false }));
      }
    },
    sample() {
      const k = this.keys, t = this.touch;
      return {
        left: !!(k.ArrowLeft || k.KeyA || t.left),
        right: !!(k.ArrowRight || k.KeyD || t.right),
        up: !!(k.ArrowUp || k.KeyW),
        down: !!(k.ArrowDown || k.KeyS),
        jump: !!(k.Space || k.KeyZ || k.KeyK || k.ArrowUp || k.KeyW || t.jump),
        pause: !!(k.Escape || k.KeyP || t.pause),
        confirm: !!(k.Enter || k.NumpadEnter || k.Space || t.jump),
      };
    },
    update() {
      this.prev = this.cur;
      this.cur = this.sample();
      this._latch = this.latch;
      this.latch = {};
    },
    down(a) { return !!this.cur[a]; },
    pressed(a) {
      const l = this._latch || {};
      if (a === 'confirm' && (l.jump || l.confirm)) return true;
      if (a === 'jump' && l.up) return true;
      return !!l[a] || (!!this.cur[a] && !this.prev[a]);
    },
    takePointer() { const p = this.pointer; this.pointer = null; return p; },
    takeAny() { const a = this.anyKeyLatch; this.anyKeyLatch = false; return a; },
  });

  /* ------------------------------------------------------------------ */
  /* Save data (localStorage, guarded)                                    */
  /* ------------------------------------------------------------------ */
  PQ.Save = {
    key: 'pixelquest_save_v1',
    data: { unlocked: 0, hi: 0, music: true, sfx: true },
    load() {
      try {
        const d = JSON.parse(localStorage.getItem(this.key));
        if (d && typeof d === 'object') Object.assign(this.data, d);
      } catch (e) { /* storage unavailable */ }
      return this.data;
    },
    store() {
      try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    },
  };
})();
