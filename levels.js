/* PIXEL QUEST - levels.js
 * Level layouts are authored with a small builder API so they stay readable and easy to tweak.
 *
 * Tile legend (grid characters):
 *   '#' ground   '=' stone block   '-' one-way ledge   '^' spikes
 *   '?' coin block   'P' feather block (double jump)   'R' heart block
 *   'B' breakable brick   'H' hidden 1-UP block   'h' hidden coin block
 *   'W' water (deadly)   'L' lava (deadly)
 * Rows: 0 (top) .. 14 (bottom). ground(x0, x1, h) fills the bottom h rows.
 */
'use strict';
(function () {
  const PQ = window.PQ;

  class LevelBuilder {
    constructor(w, h = 15) {
      this.w = w; this.h = h;
      this.g = [];
      for (let y = 0; y < h; y++) this.g.push(new Array(w).fill(' '));
      this.ents = [];
    }
    set(x, y, c) { if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.g[y][x] = c; return this; }
    get(x, y) { return x >= 0 && x < this.w && y >= 0 && y < this.h ? this.g[y][x] : ' '; }
    rect(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c); return this; }
    ground(x0, x1, h) { return this.rect(x0, this.h - h, x1, this.h - 1, '#'); }
    row(x0, x1, y, c) { return this.rect(x0, y, x1, y, c); }
    liquid(x0, x1, c, depth = 2) {
      for (let x = x0; x <= x1; x++) for (let y = this.h - depth; y < this.h; y++) if (this.get(x, y) === ' ') this.set(x, y, c);
      return this;
    }
    blocks(x, y, str) { for (let i = 0; i < str.length; i++) if (str[i] !== ' ') this.set(x + i, y, str[i]); return this; }
    coins(x0, x1, y) { for (let x = x0; x <= x1; x++) this.ents.push({ t: 'coin', x, y }); return this; }
    arc(x0, x1, yBase, rise) {
      const n = x1 - x0;
      for (let x = x0; x <= x1; x++) {
        const k = n ? (x - x0) / n : 0.5;
        this.ents.push({ t: 'coin', x, y: yBase - Math.round(Math.sin(k * Math.PI) * rise) });
      }
      return this;
    }
    add(t, x, y, o = {}) { this.ents.push(Object.assign({ t, x, y }, o)); return this; }
  }

  /* ----------------------------------------------------------------- */
  /* WORLD 1 — EMERALD VALLEY                                           */
  /* ----------------------------------------------------------------- */
  function emeraldValley() {
    const b = new LevelBuilder(200);
    b.ground(0, 22, 3);
    b.add('start', 3, 11);
    b.coins(6, 8, 9);
    b.blocks(10, 8, '? BPB?');
    b.add('slime', 19, 11);
    b.liquid(23, 25, 'W');
    b.arc(22, 26, 9, 2);

    b.ground(26, 44, 3);
    b.ground(31, 35, 5);
    b.coins(31, 35, 8);
    b.add('slime', 39, 11);
    b.row(40, 43, 8, '-');
    b.coins(40, 43, 7);

    b.liquid(45, 50, 'W');
    b.add('mover', 45, 10, { w: 3, dx: 3, dy: 0, speed: 0.55 });

    b.ground(51, 70, 3);
    b.set(56, 11, '^').set(57, 11, '^');
    b.arc(55, 58, 9, 2);
    b.set(60, 8, 'H');
    b.add('slime', 62, 11);
    b.set(64, 8, '?');
    b.add('slime', 67, 11);

    b.ground(71, 71, 4); b.ground(72, 72, 5); b.ground(73, 76, 6);
    b.arc(76, 81, 7, 2);
    b.liquid(77, 80, 'W');
    b.ground(81, 84, 6); b.ground(85, 85, 5); b.ground(86, 86, 4);
    b.ground(87, 100, 3);
    b.add('checkpoint', 89, 11);
    b.row(93, 96, 8, '=');
    b.blocks(94, 4, '?R');
    b.coins(93, 96, 7);
    b.add('slime', 98, 11);

    b.liquid(101, 103, 'W');
    b.ground(104, 130, 3);
    b.add('slime', 108, 11);
    b.ground(112, 114, 6);
    b.coins(112, 114, 8);
    b.blocks(118, 8, 'BB?BB');
    b.coins(118, 122, 7);
    b.add('slime', 120, 11);
    b.add('slime', 126, 11);
    b.set(124, 8, 'h');

    b.liquid(131, 135, 'W');
    b.set(133, 10, '=');
    b.coin(133, 9);

    b.ground(136, 160, 3);
    b.add('checkpoint', 138, 11);
    b.set(142, 11, '^').set(143, 11, '^');
    b.row(145, 148, 8, '-'); b.coins(145, 148, 7);
    b.row(150, 153, 5, '-'); b.coins(150, 153, 4);
    b.add('slime', 147, 11); b.add('slime', 151, 11); b.add('slime', 156, 11);

    b.liquid(161, 164, 'W');
    b.add('mover', 161, 11, { w: 2, dx: 2, dy: 0, speed: 0.7 });

    b.ground(165, 199, 3);
    b.add('slime', 170, 11);
    b.ground(176, 176, 4); b.ground(177, 177, 5); b.ground(178, 178, 6); b.ground(179, 179, 7); b.ground(180, 181, 8);
    b.arc(176, 181, 5, 1);
    b.add('flag', 189, 11);
    return { name: 'EMERALD VALLEY', world: 1, theme: 'emerald', music: 'level1', seed: 1101, b };
  }

  /* ----------------------------------------------------------------- */
  /* WORLD 2 — CRYSTAL CAVERNS                                          */
  /* ----------------------------------------------------------------- */
  function crystalCaverns() {
    const W = 205, b = new LevelBuilder(W);
    b.rect(0, 0, W - 1, 1, '#');
    for (let x = 4; x < W; x += 7) { b.set(x, 2, '#'); b.set(x + 1, 2, '#'); }

    b.ground(0, 18, 3);
    b.add('start', 3, 11);
    b.blocks(8, 8, '?BPB');
    b.coins(12, 15, 10);
    b.add('beetle', 15, 11);

    b.add('mover', 19, 10, { w: 3, dx: 2, dy: 0, speed: 0.55 });
    b.ground(24, 40, 3);
    b.set(29, 11, '^').set(30, 11, '^');
    b.arc(28, 31, 9, 2);
    b.add('bat', 33, 7);
    b.ground(35, 40, 5);
    b.add('beetle', 38, 9);

    b.ground(43, 44, 4);
    b.coins(43, 44, 9);

    b.ground(47, 62, 3);
    b.rect(52, 2, 56, 7, '#');
    b.coins(52, 56, 10);
    b.add('beetle', 50, 11);
    b.add('beetle', 59, 11);
    b.add('checkpoint', 61, 11);

    b.add('mover', 63, 10, { w: 3, dx: 2, dy: 0, speed: 0.55 });
    b.add('mover', 69, 6, { w: 2, dx: 0, dy: 5, speed: 0.5 });
    b.coins(66, 67, 7);

    b.ground(73, 90, 3);
    b.set(77, 11, '^').set(78, 11, '^').set(83, 11, '^').set(84, 11, '^');
    b.row(76, 79, 8, '-'); b.coins(76, 79, 7);
    b.row(82, 85, 8, '-'); b.coins(82, 85, 7);
    b.set(80, 4, '?');
    b.add('bat', 80, 6);
    b.add('bat', 88, 7);

    b.set(93, 9, '=');
    b.coin(93, 8);

    b.ground(96, 115, 3);
    b.set(99, 8, 'H');
    b.blocks(102, 8, 'BB?BB');
    b.add('beetle', 104, 11); b.add('beetle', 108, 11); b.add('beetle', 112, 11);
    b.add('checkpoint', 114, 11);

    b.ground(116, 120, 3);
    b.row(121, 122, 9, '=');
    b.row(124, 125, 6, '=');
    b.ground(127, 140, 8);
    b.coins(129, 138, 5);
    b.add('bat', 132, 4);
    b.add('beetle', 136, 6);
    b.set(139, 3, 'R');

    b.add('mover', 141, 8, { w: 3, dx: 7, dy: 0, speed: 0.38 });
    b.coins(144, 148, 6);

    b.ground(151, 170, 3);
    b.row(156, 162, 8, '-'); b.coins(156, 162, 7);
    b.set(158, 11, '^');
    b.add('beetle', 154, 11); b.add('beetle', 161, 11); b.add('beetle', 166, 11);

    b.add('mover', 173, 7, { w: 2, dx: 0, dy: 4, speed: 0.55 });
    b.ground(177, W - 1, 3);
    b.add('bat', 183, 7);
    b.add('flag', 195, 11);
    return { name: 'CRYSTAL CAVERNS', world: 2, theme: 'crystal', music: 'level2', seed: 2202, b };
  }

  /* ----------------------------------------------------------------- */
  /* WORLD 3 — LAVA FORTRESS (with boss arena)                          */
  /* ----------------------------------------------------------------- */
  function lavaFortress() {
    const W = 175, b = new LevelBuilder(W);
    b.ground(0, 16, 3);
    b.add('start', 3, 11);
    b.blocks(7, 8, '?PB');
    b.add('imp', 14, 11);

    b.liquid(17, 20, 'L');
    b.add('ember', 18, 13);
    b.arc(17, 20, 9, 2);

    b.ground(21, 36, 3);
    b.rect(24, 0, 30, 1, '#');
    b.add('crusher', 27, 2);
    b.set(32, 11, '^').set(33, 11, '^');
    b.add('imp', 35, 11);

    b.liquid(37, 44, 'L');
    b.add('mover', 37, 10, { w: 3, dx: 5, dy: 0, speed: 0.45 });
    b.add('ember', 41, 13);

    b.ground(45, 60, 4);
    b.add('jet', 49, 10);
    b.add('jet', 54, 10);
    b.coins(51, 52, 8);
    b.add('imp', 57, 10);
    b.add('checkpoint', 59, 10);

    b.liquid(61, 63, 'L'); b.ground(64, 66, 5); b.liquid(67, 69, 'L'); b.ground(70, 72, 6); b.liquid(73, 75, 'L');
    b.add('ember', 62, 13); b.add('ember', 68, 13); b.add('ember', 74, 13);
    b.coins(64, 66, 8); b.coins(70, 72, 7);

    b.ground(76, 90, 3);
    b.rect(77, 0, 89, 3, '#');
    b.add('crusher', 80, 4);
    b.add('crusher', 85, 4);
    b.coins(79, 87, 11);
    b.add('imp', 89, 11);

    b.liquid(91, 100, 'L');
    b.add('mover', 93, 6, { w: 2, dx: 0, dy: 5, speed: 0.5 });
    b.add('mover', 96, 9, { w: 2, dx: 3, dy: 0, speed: 0.5 });
    b.add('ember', 95, 13);

    b.ground(101, 118, 3);
    b.add('checkpoint', 103, 11);
    b.set(104, 8, 'H');
    b.add('jet', 107, 11);
    b.add('jet', 111, 11);
    b.row(106, 112, 8, '-'); b.coins(106, 112, 7);
    b.add('imp', 115, 11);
    b.set(117, 8, 'R');

    b.liquid(119, 120, 'L'); b.ground(121, 121, 4); b.liquid(122, 123, 'L');
    b.add('ember', 122, 13);

    b.ground(124, 149, 3);
    b.set(128, 11, '^').set(129, 11, '^');
    b.rect(130, 0, 134, 1, '#');
    b.add('crusher', 131, 2);
    b.set(135, 11, '^').set(136, 11, '^');
    b.add('imp', 139, 11);
    b.add('checkpoint', 143, 11);
    b.coins(145, 148, 10);

    // Boss arena: columns 150..174
    b.ground(150, 174, 2);
    b.rect(150, 0, 174, 1, '#');
    b.rect(150, 2, 150, 9, '#');
    b.rect(174, 2, 174, 12, '#');
    b.row(154, 157, 9, '-');
    b.row(167, 170, 9, '-');
    b.add('boss', 165, 12);
    return {
      name: 'LAVA FORTRESS', world: 3, theme: 'lava', music: 'level3', seed: 3303, b,
      arena: { x0: 150, x1: 174, trigger: 153, door: { x: 150, y0: 10, y1: 12 } },
    };
  }
  LevelBuilder.prototype.coin = function (x, y) { this.ents.push({ t: 'coin', x, y }); return this; };

  PQ.Levels = [emeraldValley, crystalCaverns, lavaFortress];
  PQ.LevelBuilder = LevelBuilder;
})();
