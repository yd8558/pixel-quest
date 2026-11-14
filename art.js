/* PIXEL QUEST - art.js
 * All artwork is original and generated procedurally at startup: sprites, tiles,
 * decorations and parallax background layers for the three worlds.
 */
'use strict';
(function () {
  const PQ = window.PQ, T = PQ.T;
  const Art = (PQ.Art = {});

  /* ================================================================== */
  /* Player: "Pip", a hooded wanderer with an orange scarf              */
  /* ================================================================== */
  const PAL = {
    k: '#1b1230', h: '#2bb3a3', H: '#16756f', l: '#8af0dc', s: '#f8c9a0', S: '#e0907a',
    r: '#ff7b2e', R: '#c4421c', p: '#3b3f78', b: '#6b3e26', B: '#a3643a', w: '#ffffff',
  };
  const TOP = [
    '...kkkkk....',
    '..khhhhhk...',
    '.khlhhhhhk..',
    '.khlhhhhhhk.',
    '.khhkkkkkkkk',
    '.khksssssssk',
    '.khksssksksk',
    '.khksssksksk',
    '..kkssssSssk',
    '..krrrrrrrk.',
    '.rRkhhhhhhk.',
    '..khhlhhhhk.',
  ];
  const ARMS = '..kshhhhhsk.';
  const ARMS_UP = 'skhhhhhhhks.';
  const LEGS = {
    idle: ['..kkpppppkk.', '..kbbk.kbbk.', '..kkkk.kkkk.'],
    a: ['..kpppkppk..', '.kbbk..kbbk.', '.kkk....kkk.'],
    b: ['...kpppk....', '...kbbbk....', '...kkkkk....'],
    c: ['...kpkppk...', '..kbbkkbbk..', '..kkk..kkk..'],
    jump: ['..kppkppk...', '.kbbkkbbk...', '.kkk..kkk...'],
    fall: ['..kpppppk...', '.kbk...kbk..', '.kk.....kk..'],
  };
  function playerFrame(legs, armsUp, scarfAlt) {
    const rows = TOP.slice();
    if (scarfAlt) rows[10] = 'rRRkhhhhhhk.';
    rows.push(armsUp ? ARMS_UP : ARMS);
    return PQ.fromMap(rows.concat(LEGS[legs]), PAL);
  }
  function pair(c) { return [c, PQ.flip(c)]; }
  function withWhite(c) { return { n: pair(c), w: pair(PQ.silhouette(c, '#ffffff')) }; }

  Art.build = function () {
    Art.player = {
      idle: withWhite(playerFrame('idle', false)),
      idle2: withWhite(playerFrame('idle', false, true)),
      run: [withWhite(playerFrame('a')), withWhite(playerFrame('b', false, true)), withWhite(playerFrame('c')), withWhite(playerFrame('b', false, true))],
      jump: withWhite(playerFrame('jump', true)),
      fall: withWhite(playerFrame('fall', true, true)),
    };
    Art.lifeIcon = PQ.fromMap(TOP.slice(0, 10), PAL);

    Art.heart = PQ.fromMap(['.kkk.kkk.', 'krwrkrrrk', 'krrrrrrRk', 'krrrrrrRk', '.krrrrRk.', '..krrRk..', '...kRk...', '....k....'],
      { k: '#2a0a14', r: '#ff3d5a', R: '#b81c3a', w: '#ffffff' });
    Art.heartEmpty = PQ.fromMap(['.kkk.kkk.', 'krrrkrrrk', 'krrrrrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....'],
      { k: '#2a0a14', r: '#4a3048' });
    Art.feather = PQ.fromMap([
      '.........kk.', '........kwwk', '.......kwlwk', '......kwllk.', '.....kwllwk.', '....kwllwk..',
      '...kwllwk...', '..kwllwk....', '..kwlwk.....', '.kwwkk......', '.kk.........', 'k...........'],
    { k: '#1b3a5a', w: '#ffffff', l: '#8ae4ff' });
    Art.gem = PQ.fromMap(['...kkkk...', '..kllggk..', '.kllgggGk.', 'kllggggGGk', 'kgggggGGGk', '.kggGGGGk.', '..kgGGGk..', '...kGGk...', '....kk....'],
      { k: '#0a3020', l: '#c8ffd8', g: '#3ae070', G: '#1a9a48' });

    buildCoins();
    buildEnemies();
    buildBlocks();
    buildMisc();
    buildBoss();
    buildLogo();
    Art.glow = radial(48, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  };

  function radial(size, inner, outer) {
    const { c, x } = PQ.canvas(size, size);
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    return c;
  }
  Art.tintedGlow = function (color, size = 48) {
    Art._glows = Art._glows || {};
    const k = color + size;
    if (!Art._glows[k]) Art._glows[k] = radial(size, color, 'rgba(0,0,0,0)');
    return Art._glows[k];
  };

  /* ---------------- Coins ---------------- */
  function buildCoins() {
    Art.coin = [10, 8, 6, 2, 6, 8].map((w) => {
      const rx = w / 2, cx = 5;
      return PQ.shape(10, 12, (x, y) => ((x - cx) / rx) ** 2 + ((y - 6) / 6) ** 2 <= 1.0, (x, y) => {
        const dx = (x + 0.5 - cx) / Math.max(rx, 1), dy = (y + 0.5 - 6) / 6;
        if (w <= 2) return '#ffd23a';
        if (dx < -0.25 && dy < -0.2) return '#fff6b0';
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > 0.5 && r < 0.72) return '#e8a818';
        if (dx > 0.3 && dy > 0.1) return '#d89418';
        return '#ffd23a';
      }, w > 3 ? '#7a4a08' : null);
    });
    Art.coinSmall = PQ.shape(7, 8, (x, y) => ((x - 3.5) / 3.5) ** 2 + ((y - 4) / 4) ** 2 <= 1, (x, y) => (x < 3 && y < 3 ? '#fff6b0' : '#ffd23a'), '#7a4a08');
  }

  /* ---------------- Enemies ---------------- */
  function buildEnemies() {
    // Slime (Emerald Valley)
    Art.slime = [0, 1].map((f) => {
      const rx = f ? 7.6 : 6.6, ry = f ? 4.8 : 6, cy = 12 - ry;
      const c = PQ.shape(16, 12, (x, y) => ((x - 8) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, (x, y) => {
        const dx = x - 8, dy = y - cy;
        if ((dx + 3) ** 2 + (dy + 2.5) ** 2 < 2.5) return '#effff0';
        if (dy > ry * 0.45) return '#2f9a3a';
        if (dx < -1 && dy < 0) return '#8ce86a';
        return '#4cc644';
      }, '#14381c');
      const x = c.getContext('2d');
      const ey = Math.round(cy - 1);
      x.fillStyle = '#fff'; x.fillRect(8, ey, 2, 3); x.fillRect(11, ey, 2, 3);
      x.fillStyle = '#14381c'; x.fillRect(9, ey + 1, 1, 2); x.fillRect(12, ey + 1, 1, 2);
      x.fillStyle = '#ff9ab0'; x.fillRect(7, ey + 3, 1, 1); x.fillRect(13, ey + 3, 1, 1);
      return pair(c);
    });
    Art.slimeFlat = pair(PQ.shape(16, 5, (x, y) => ((x - 8) / 8) ** 2 + ((y - 5) / 4) ** 2 <= 1, (x, y) => (y < 2 ? '#8ce86a' : '#4cc644'), '#14381c'));

    // Crystal beetle (Crystal Caverns)
    Art.beetle = [0, 1].map((f) => {
      const { c, x } = PQ.canvas(16, 13);
      const shell = PQ.shape(13, 9, (px, py) => ((px - 6.5) / 6.5) ** 2 + ((py - 9) / 8) ** 2 <= 1, (px, py) => {
        if (py < 3 && px < 7) return '#b9a0ff';
        if (Math.abs(px - 6.5) < 0.8) return '#3a2490';
        return py > 6 ? '#4a2fb0' : '#6a4ae0';
      }, '#160c3a');
      x.drawImage(shell, 0, 2);
      // crystal spikes
      x.fillStyle = '#6af6ff'; x.fillRect(3, 1, 1, 2); x.fillRect(6, 0, 1, 3); x.fillRect(9, 1, 1, 2);
      x.fillStyle = '#e0ffff'; x.fillRect(6, 0, 1, 1);
      // head
      x.fillStyle = '#160c3a'; x.fillRect(11, 5, 5, 5);
      x.fillStyle = '#2a1a6a'; x.fillRect(12, 6, 3, 3);
      x.fillStyle = '#fff'; x.fillRect(13, 6, 2, 2);
      x.fillStyle = '#ff3a6a'; x.fillRect(14, 7, 1, 1);
      x.fillStyle = '#160c3a'; x.fillRect(15, 9, 1, 2);
      // legs
      x.fillStyle = '#160c3a';
      const lx = f ? [2, 6, 10] : [3, 7, 11];
      for (const l of lx) { x.fillRect(l, 11, 1, 2); x.fillRect(l + (f ? 1 : -1), 12, 1, 1); }
      return pair(c);
    });

    // Cave bat
    Art.bat = [0, 1].map((f) => {
      const c = PQ.shape(18, 12, (x, y) => {
        const body = (x - 9) ** 2 / 12 + (y - 6) ** 2 / 14 <= 1;
        const ears = (y > 1 && y < 4 && (Math.abs(x - 7) < 1 || Math.abs(x - 11) < 1));
        let wing;
        if (f === 0) wing = (y > 1 && y < 7 && Math.abs(x - 9) > 2 && y > 1 + Math.abs(x - 9) * 0.25 && y < 3 + Math.abs(x - 9) * 0.55);
        else wing = (y > 5 && y < 12 && Math.abs(x - 9) > 2 && Math.abs(x - 9) < 9 && y < 6 + (9 - Math.abs(x - 9)) * 0.7);
        return body || ears || wing;
      }, (x, y) => (Math.abs(x - 9) > 3 ? '#8a4ac8' : y < 5 ? '#a86ae0' : '#6a3aa0'), '#1e0a30');
      const x = c.getContext('2d');
      x.fillStyle = '#ffde3a'; x.fillRect(8, 5, 1, 1); x.fillRect(10, 5, 1, 1);
      x.fillStyle = '#fff'; x.fillRect(8, 8, 1, 1); x.fillRect(10, 8, 1, 1);
      return pair(c);
    });

    // Fire imp (Lava Fortress)
    Art.imp = [0, 1].map((f) => {
      const { c, x } = PQ.canvas(14, 16);
      const body = PQ.shape(12, 11, (px, py) => ((px - 6) / 6) ** 2 + ((py - 6) / 5.5) ** 2 <= 1, (px, py) => {
        if (py > 6 && Math.abs(px - 6) < 3) return '#ffb070';
        if (px < 5 && py < 4) return '#ff7a5a';
        return '#e8402a';
      }, '#3a0a0a');
      x.drawImage(body, 1, 3);
      // horns
      x.fillStyle = '#ffe6b0'; x.fillRect(2, 1, 1, 3); x.fillRect(11, 1, 1, 3); x.fillRect(1, 0, 1, 2); x.fillRect(12, 0, 1, 2);
      // eyes
      x.fillStyle = '#fff'; x.fillRect(7, 6, 2, 2); x.fillRect(10, 6, 2, 2);
      x.fillStyle = '#1a0505'; x.fillRect(8, 6, 1, 2); x.fillRect(11, 6, 1, 2);
      x.fillStyle = '#3a0a0a'; x.fillRect(7, 5, 2, 1); x.fillRect(10, 5, 2, 1);
      // mouth
      x.fillStyle = '#3a0a0a'; x.fillRect(8, 10, 3, 1);
      x.fillStyle = '#fff'; x.fillRect(9, 10, 1, 1);
      // feet
      x.fillStyle = '#3a0a0a';
      if (f) { x.fillRect(3, 14, 3, 2); x.fillRect(9, 13, 3, 2); } else { x.fillRect(3, 13, 3, 2); x.fillRect(9, 14, 3, 2); }
      return pair(c);
    });

    // Lava ember
    Art.ember = [0, 1].map((f) => PQ.shape(12, 12, (x, y) => (x - 6) ** 2 + (y - 6) ** 2 <= (f ? 30 : 26), (x, y) => {
      const r = Math.hypot(x + 0.5 - 6, y + 0.5 - 5);
      return r < 2 ? '#fffbd0' : r < 3.5 ? '#ffd23a' : '#ff7a1a';
    }, '#b82a08'));

    // Crusher block face
    {
      const { c, x } = PQ.canvas(24, 26);
      const stone = PQ.shape(24, 22, (px, py) => px > 0.5 && px < 23.5 && py > 0.5 && py < 21.5 && !((px < 2 || px > 22) && (py < 2 || py > 20)),
        (px, py) => (px < 3 || py < 3 ? '#a89ab0' : px > 20 || py > 18 ? '#4a3e52' : '#76687e'), '#140c18');
      x.drawImage(stone, 0, 0);
      x.fillStyle = '#140c18';
      x.fillRect(4, 6, 6, 4); x.fillRect(14, 6, 6, 4);
      x.fillStyle = '#ff3a2a'; x.fillRect(6, 7, 2, 2); x.fillRect(16, 7, 2, 2);
      x.fillStyle = '#140c18'; x.fillRect(3, 5, 4, 1); x.fillRect(17, 5, 4, 1);
      x.fillRect(6, 13, 12, 5);
      x.fillStyle = '#e8e0d0'; for (let i = 0; i < 6; i++) x.fillRect(6 + i * 2, 13, 1, 2), x.fillRect(7 + i * 2, 16, 1, 2);
      x.fillStyle = '#5a4e62'; x.fillRect(4, 2, 1, 1); x.fillRect(19, 2, 1, 1); x.fillRect(4, 19, 1, 1); x.fillRect(19, 19, 1, 1);
      // bottom spikes
      for (let i = 0; i < 6; i++) {
        x.fillStyle = '#140c18'; x.fillRect(i * 4 + 1, 22, 3, 1); x.fillRect(i * 4 + 2, 23, 1, 3);
        x.fillStyle = '#c8c0d0'; x.fillRect(i * 4 + 2, 22, 1, 2);
      }
      Art.crusher = c;
    }
  }

  /* ---------------- Blocks ---------------- */
  function bevelBlock(x, ox, oy, base, light, dark, outline) {
    x.fillStyle = outline; x.fillRect(ox, oy, 16, 16);
    x.fillStyle = base; x.fillRect(ox + 1, oy + 1, 14, 14);
    x.fillStyle = light; x.fillRect(ox + 1, oy + 1, 14, 1); x.fillRect(ox + 1, oy + 1, 1, 14);
    x.fillStyle = dark; x.fillRect(ox + 1, oy + 14, 14, 1); x.fillRect(ox + 14, oy + 1, 1, 14);
  }
  function buildBlocks() {
    Art.reward = [0, 1, 2, 3].map((f) => {
      const { c, x } = PQ.canvas(16, 16);
      bevelBlock(x, 0, 0, '#f2a72e', '#ffd87a', '#b8631a', '#3a1c08');
      x.fillStyle = '#7a3a0a';
      [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(([a, b]) => x.fillRect(a, b, 1, 1));
      const gc = ['#ffffff', '#fff2a0', '#ffd060', '#fff2a0'][f];
      // gem emblem
      x.fillStyle = '#7a3a0a';
      x.fillRect(7, 3, 2, 1); x.fillRect(5, 4, 6, 1); x.fillRect(4, 5, 8, 2); x.fillRect(5, 7, 6, 2); x.fillRect(6, 9, 4, 2); x.fillRect(7, 11, 2, 1);
      x.fillStyle = gc;
      x.fillRect(7, 4, 2, 1); x.fillRect(5, 5, 6, 1); x.fillRect(6, 6, 4, 2); x.fillRect(7, 8, 2, 2);
      x.fillStyle = '#7a3a0a'; x.fillRect(8, 12, 0, 0);
      x.fillStyle = '#5a2a06'; x.fillRect(5, 13, 6, 1);
      return c;
    });
    {
      const { c, x } = PQ.canvas(16, 16);
      bevelBlock(x, 0, 0, '#8a5a3a', '#a8744a', '#5a3420', '#24120a');
      x.fillStyle = '#3a2214';
      [[3, 3], [12, 3], [3, 12], [12, 12]].forEach(([a, b]) => x.fillRect(a, b, 1, 1));
      Art.used = c;
    }
    const brick = (base, mortar, hl) => {
      const { c, x } = PQ.canvas(16, 16);
      x.fillStyle = mortar; x.fillRect(0, 0, 16, 16);
      for (let r = 0; r < 4; r++) {
        const off = r % 2 ? 4 : 0;
        for (let b = -1; b < 3; b++) {
          const bx = b * 8 + off, by = r * 4;
          x.fillStyle = base; x.fillRect(bx + 1, by + 1, 7, 3);
          x.fillStyle = hl; x.fillRect(bx + 1, by + 1, 7, 1);
        }
      }
      x.fillStyle = mortar; x.fillRect(0, 0, 16, 1); x.fillRect(0, 15, 16, 1); x.fillRect(0, 0, 1, 16); x.fillRect(15, 0, 1, 16);
      return c;
    };
    Art.brick = {
      emerald: brick('#c8642c', '#5a2410', '#ee9454'),
      crystal: brick('#7a4ad0', '#221450', '#a888ff'),
      lava: brick('#8a2a2a', '#240808', '#c25444'),
    };
    // iron door bars
    {
      const { c, x } = PQ.canvas(16, 16);
      x.fillStyle = '#1a1418'; x.fillRect(0, 0, 16, 16);
      for (let i = 0; i < 4; i++) { x.fillStyle = '#6a6070'; x.fillRect(1 + i * 4, 0, 2, 16); x.fillStyle = '#9a90a0'; x.fillRect(1 + i * 4, 0, 1, 16); }
      x.fillStyle = '#4a4050'; x.fillRect(0, 6, 16, 3); x.fillStyle = '#8a8090'; x.fillRect(0, 6, 16, 1);
      Art.door = c;
    }
  }

  /* ---------------- Misc: spikes, platforms, flags, decorations ---------------- */
  function buildMisc() {
    const spikes = (body, light, dark) => {
      const { c, x } = PQ.canvas(16, 16);
      for (let i = 0; i < 4; i++) {
        const sx = i * 4;
        for (let h = 0; h < 8; h++) {
          const w = Math.max(1, Math.round((h + 1) / 2));
          const y = 8 + h;
          x.fillStyle = dark; x.fillRect(sx + 2 - w, y, w * 2, 1);
          x.fillStyle = body; x.fillRect(sx + 2 - w + 1, y, Math.max(1, w * 2 - 2), 1);
          x.fillStyle = light; x.fillRect(sx + 2 - w + (w > 1 ? 1 : 0), y, 1, 1);
        }
      }
      x.fillStyle = dark; x.fillRect(0, 15, 16, 1);
      return c;
    };
    Art.spikes = {
      emerald: spikes('#c8d0e0', '#ffffff', '#3a4058'),
      crystal: spikes('#6ae8ff', '#e0ffff', '#1a3a6a'),
      lava: spikes('#5a5060', '#ffb060', '#1a1018'),
    };

    // Trees for Emerald Valley
    Art.tree = [0, 1, 2].map((v) => {
      const r = PQ.rng(77 + v * 13);
      const { c, x } = PQ.canvas(40, 40);
      const blobs = [];
      for (let i = 0; i < 9; i++) blobs.push([8 + r() * 24, 8 + r() * 18, 7 + r() * 5]);
      const can = PQ.shape(40, 40, (px, py) => blobs.some(([bx, by, br]) => (px - bx) ** 2 + (py - by) ** 2 < br * br), (px, py) => {
        const n = r();
        const lit = px + py < 32;
        if (lit && n < 0.12) return '#a8f080';
        if (lit) return n < 0.5 ? '#5ac850' : '#4ab845';
        return n < 0.4 ? '#2a8a3c' : '#36a044';
      }, '#14401e');
      x.drawImage(can, 0, 0);
      return c;
    });
    {
      const { c, x } = PQ.canvas(8, 28);
      x.fillStyle = '#3a2010'; x.fillRect(0, 0, 8, 28);
      x.fillStyle = '#7a4a2a'; x.fillRect(1, 0, 6, 28);
      x.fillStyle = '#9a6a3a'; x.fillRect(2, 0, 2, 28);
      x.fillStyle = '#5a3420'; x.fillRect(5, 4, 1, 4); x.fillRect(3, 14, 1, 5);
      x.fillStyle = '#3a2010'; x.fillRect(-1, 25, 10, 3);
      Art.trunk = c;
    }
    Art.bush = PQ.shape(26, 12, (px, py) => [[6, 8, 6], [13, 6, 7], [20, 8, 6]].some(([a, b, rr]) => (px - a) ** 2 + (py - b) ** 2 < rr * rr) && py < 12,
      (px, py) => (py < 5 ? '#7ae060' : py < 8 ? '#4cb848' : '#2f8a3a'), '#14401e');
    Art.rock = PQ.shape(12, 7, (px, py) => ((px - 6) / 6) ** 2 + ((py - 7) / 6) ** 2 <= 1, (px, py) => (px < 5 && py < 4 ? '#c8c0b0' : '#8a8478'), '#3a3630');

    // Crystal Caverns decor
    Art.crystals = ['#5af0ff', '#ff6ad8', '#b88aff'].map((col) => {
      const { c, x } = PQ.canvas(16, 18);
      const shard = (sx, h, w) => {
        for (let yy = 0; yy < h; yy++) {
          const ww = yy < 3 ? Math.ceil(((yy + 1) / 3) * w) : w;
          x.fillStyle = '#0e0828'; x.fillRect(sx - Math.ceil(ww / 2) - 1, 17 - h + yy, ww + 2, 1);
        }
        for (let yy = 0; yy < h; yy++) {
          const ww = yy < 3 ? Math.ceil(((yy + 1) / 3) * w) : w;
          x.fillStyle = col; x.fillRect(sx - Math.ceil(ww / 2), 17 - h + yy, ww, 1);
          x.fillStyle = '#ffffff'; x.fillRect(sx - Math.ceil(ww / 2), 17 - h + yy, 1, 1);
        }
      };
      shard(5, 10, 3); shard(10, 15, 4); shard(13, 7, 2);
      return c;
    });
    Art.stalactite = [0, 1].map((tip) => {
      const { c, x } = PQ.canvas(10, 16);
      for (let yy = 0; yy < 14; yy++) {
        const w = Math.max(1, Math.round(8 * (1 - yy / 14)));
        x.fillStyle = '#120c2a'; x.fillRect(5 - Math.ceil(w / 2) - 1, yy, w + 2, 1);
        x.fillStyle = yy > 9 && tip ? '#5af0ff' : '#3b2f6e'; x.fillRect(5 - Math.ceil(w / 2), yy, w, 1);
        x.fillStyle = yy > 9 && tip ? '#e0ffff' : '#5a4a9a'; x.fillRect(5 - Math.ceil(w / 2), yy, 1, 1);
      }
      return c;
    });
    Art.mushroom = PQ.shape(9, 9, (px, py) => (py < 5 && ((px - 4.5) / 4.5) ** 2 + ((py - 5) / 4.5) ** 2 <= 1) || (py >= 4 && Math.abs(px - 4.5) < 1.5),
      (px, py) => (py >= 5 ? '#e0d8f0' : (px + py) % 4 === 0 ? '#ffffff' : '#ff6ad8'), '#2a0a3a');

    // Lava Fortress decor
    {
      const { c, x } = PQ.canvas(8, 12);
      x.fillStyle = '#1a1014'; x.fillRect(2, 4, 4, 8); x.fillRect(0, 4, 8, 2);
      x.fillStyle = '#6a5a60'; x.fillRect(3, 5, 2, 7); x.fillRect(1, 4, 6, 1);
      Art.torch = c;
    }
    {
      const { c, x } = PQ.canvas(14, 30);
      x.fillStyle = '#2a1018'; x.fillRect(0, 0, 14, 2);
      x.fillStyle = '#d8a838'; x.fillRect(0, 0, 14, 1);
      x.fillStyle = '#1a0408'; x.fillRect(1, 2, 12, 24);
      x.fillStyle = '#8a1424'; x.fillRect(2, 2, 10, 22);
      x.fillStyle = '#b02234'; x.fillRect(2, 2, 3, 22);
      for (let i = 0; i < 5; i++) { x.fillStyle = '#1a0408'; x.fillRect(1 + i * 3, 26, 2, 2 + (i % 2) * 2); x.fillStyle = '#8a1424'; x.fillRect(2 + i * 3 - 1, 24, 2, 2); }
      x.fillStyle = '#ffc83a'; x.fillRect(6, 7, 2, 1); x.fillRect(5, 8, 4, 1); x.fillRect(4, 9, 6, 2); x.fillRect(5, 11, 4, 1); x.fillRect(6, 12, 2, 1);
      x.fillStyle = '#fff6b0'; x.fillRect(6, 9, 1, 1);
      Art.banner = c;
    }
    {
      const { c, x } = PQ.canvas(6, 48);
      for (let i = 0; i < 12; i++) {
        x.fillStyle = '#1a1418';
        if (i % 2) { x.fillRect(2, i * 4, 2, 5); x.fillStyle = '#6a6070'; x.fillRect(2, i * 4 + 1, 1, 3); }
        else { x.fillRect(1, i * 4, 4, 5); x.fillStyle = '#5a5060'; x.fillRect(2, i * 4 + 1, 2, 3); x.fillStyle = '#1a1418'; x.fillRect(2, i * 4 + 2, 2, 1); }
      }
      Art.chain = c;
    }
    Art.flameJetBase = (() => {
      const { c, x } = PQ.canvas(16, 8);
      x.fillStyle = '#140c10'; x.fillRect(1, 2, 14, 6);
      x.fillStyle = '#5a5060'; x.fillRect(2, 3, 12, 4);
      x.fillStyle = '#8a8090'; x.fillRect(2, 3, 12, 1);
      x.fillStyle = '#140c10'; x.fillRect(5, 0, 6, 3);
      x.fillStyle = '#ff6a1a'; x.fillRect(6, 1, 4, 2);
      return c;
    })();
  }

  /* ---------------- Boss: MAGMAW, the Molten King ---------------- */
  function buildBoss() {
    const W = 44, H = 40;
    const r = PQ.rng(991);
    const inside = (x, y) => Math.pow(Math.abs(x - 22) / 21, 2.4) + Math.pow(Math.abs(y - 23) / 17, 2.4) <= 1;
    Art.bossBody = PQ.shape(W, H, inside, (x, y) => {
      const n = r();
      if (x + y < 28 && n < 0.5) return '#6a4a52';
      if (y > 33) return '#24121a';
      if (x > 34) return '#2e1a22';
      return n < 0.15 ? '#4a2e38' : '#3a222a';
    }, '#0c0408');
    // crack overlay (glowing magma veins)
    const { c, x } = PQ.canvas(W, H);
    const rr = PQ.rng(4242);
    for (let k = 0; k < 9; k++) {
      let px = 6 + rr() * 32, py = 10 + rr() * 26;
      for (let s = 0; s < 10; s++) {
        if (inside(px, py) && inside(px + 2, py) && inside(px - 2, py) && inside(px, py + 2)) {
          x.fillStyle = '#ff7a1a'; x.fillRect(px | 0, py | 0, 1, 1);
          if (s % 3 === 0) { x.fillStyle = '#ffe070'; x.fillRect(px | 0, py | 0, 1, 1); }
        }
        px += (rr() - 0.5) * 4; py += rr() * 2.2 - 0.6;
      }
    }
    Art.bossCracks = c;
    Art.bossWhite = PQ.silhouette(Art.bossBody, '#ffffff');
    Art.bossRed = PQ.silhouette(Art.bossBody, 'rgba(255,40,20,0.45)');
  }

  /* ---------------- Logo ---------------- */
  function buildLogo() {
    const s = 4, text1 = 'PIXEL', text2 = 'QUEST';
    const w = PQ.Font.width(text2, s) + 16, h = 7 * s * 2 + 30;
    const { c, x } = PQ.canvas(w, h);
    const mask = PQ.canvas(w, h);
    PQ.Font.draw(mask.x, text1, w / 2, 6, '#ffffff', s, { align: 'center' });
    PQ.Font.draw(mask.x, text2, w / 2, 6 + 7 * s + 8, '#ffffff', s, { align: 'center' });
    // outline + shadow
    const sh = PQ.silhouette(mask.c, '#1b1230');
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [2, 2], [-2, 2], [2, -2], [-2, -2], [3, 4], [2, 4], [4, 4]]) x.drawImage(sh, dx, dy);
    // gradient fill
    const g = PQ.canvas(w, h);
    const grad = g.x.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#fff6a0'); grad.addColorStop(0.22, '#ffc83a'); grad.addColorStop(0.42, '#ff7b2e');
    grad.addColorStop(0.5, '#8af0dc'); grad.addColorStop(0.75, '#2bb3a3'); grad.addColorStop(1, '#16756f');
    g.x.fillStyle = grad; g.x.fillRect(0, 0, w, h);
    g.x.globalCompositeOperation = 'destination-in'; g.x.drawImage(mask.c, 0, 0);
    x.drawImage(g.c, 0, 0);
    // highlights
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = 'rgba(255,255,255,0.55)';
    for (let yy = 6; yy < h; yy += 7 * s + 8) x.fillRect(0, yy, w, s);
    Art.logo = c;
  }

  /* ================================================================== */
  /* Terrain                                                              */
  /* ================================================================== */
  const TERRAIN = { '#': 1, '=': 1 };
  Art.renderTerrain = function (grid, theme) {
    const h = grid.length, w = grid[0].length;
    const { c, x } = PQ.canvas(w * T, h * T);
    const at = (tx, ty) => (ty < 0 || ty >= h ? (ty < 0 ? ' ' : '#') : tx < 0 || tx >= w ? grid[ty][Math.max(0, Math.min(w - 1, tx))] : grid[ty][tx]);
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const ch = grid[ty][tx];
        const r = PQ.rng((tx * 73856093) ^ (ty * 19349663) ^ 0x5bd1e995);
        if (ch === '#') {
          let depth = 0;
          while (depth < 4 && TERRAIN[at(tx, ty - depth - 1)] && at(tx, ty - depth - 1) === '#') depth++;
          const nb = { u: TERRAIN[at(tx, ty - 1)], d: TERRAIN[at(tx, ty + 1)], l: TERRAIN[at(tx - 1, ty)], r: TERRAIN[at(tx + 1, ty)] };
          paintGround(x, tx * T, ty * T, theme, nb, depth, r);
        } else if (ch === '=') {
          paintBlock(x, tx * T, ty * T, theme, r);
        } else if (ch === '-') {
          paintBridge(x, tx * T, ty * T, theme, at(tx - 1, ty) === '-', at(tx + 1, ty) === '-');
        } else if (ch === '^') {
          x.drawImage(Art.spikes[theme], tx * T, ty * T);
        }
      }
    }
    return c;
  };

  const GROUND = {
    emerald: { base: ['#b8743e', '#a8663a', '#965a32', '#86502c', '#7a482a'], speck: '#8a4e28', light: '#d49058', edge: '#5a2c16',
      cap: ['#9af06a', '#5ad04a', '#44b83e', '#36a038'], stone: '#a08070' },
    crystal: { base: ['#3f3274', '#382c68', '#32275e', '#2c2254', '#281f4c'], speck: '#261c4e', light: '#5e4ea0', edge: '#120c2a',
      cap: ['#a8fff0', '#3ae0d0', '#1aa8b0', '#14808c'], stone: '#6af0ff' },
    lava: { base: ['#4e3e4a', '#483844', '#42323e', '#3c2e38', '#382a34'], speck: '#2a1e28', light: '#68566a', edge: '#140c12',
      cap: ['#a08890', '#7a6672', '#5e4c58', '#4e3e4a'], stone: '#ff7a2a' },
  };
  function paintGround(x, ox, oy, theme, nb, depth, r) {
    const P = GROUND[theme];
    x.fillStyle = P.base[Math.min(depth, 4)];
    x.fillRect(ox, oy, T, T);
    if (theme === 'lava') {
      // stone bricks
      x.fillStyle = P.speck;
      x.fillRect(ox, oy + 7, T, 1); x.fillRect(ox, oy + 15, T, 1);
      const off = ((oy / T) | 0) % 2 ? 0 : 8;
      x.fillRect(ox + off, oy, 1, 7); x.fillRect(ox + ((off + 8) % 16), oy + 8, 1, 7);
      x.fillStyle = P.light;
      x.fillRect(ox + off + 1, oy, 6, 1); x.fillRect(ox + ((off + 8) % 16) + 1, oy + 8, 6, 1);
      if (r() < 0.25) { x.fillStyle = P.speck; x.fillRect(ox + (r() * 12) | 0, oy + 2 + ((r() * 4) | 0), 2, 1); }
    } else {
      for (let i = 0; i < 9; i++) {
        x.fillStyle = r() < 0.6 ? P.speck : P.light;
        x.fillRect(ox + ((r() * 15) | 0), oy + ((r() * 15) | 0), r() < 0.5 ? 2 : 1, 1);
      }
      if (r() < 0.3) {
        const sx = ox + 2 + ((r() * 10) | 0), sy = oy + 4 + ((r() * 9) | 0);
        x.fillStyle = P.edge; x.fillRect(sx, sy, 4, 3);
        x.fillStyle = P.stone; x.fillRect(sx, sy, 3, 2);
        x.fillStyle = theme === 'crystal' ? '#e0ffff' : '#c8b0a0'; x.fillRect(sx, sy, 1, 1);
      }
    }
    if (!nb.l) { x.fillStyle = P.edge; x.fillRect(ox, oy, 1, T); }
    if (!nb.r) { x.fillStyle = P.edge; x.fillRect(ox + T - 1, oy, 1, T); }
    if (!nb.d) {
      x.fillStyle = P.edge; x.fillRect(ox, oy + T - 1, T, 1);
      if (theme === 'crystal') for (let i = 1; i < 15; i += 3 + ((r() * 3) | 0)) { x.fillRect(ox + i, oy + T, 1, 1 + ((r() * 3) | 0)); }
    }
    if (!nb.u) {
      const C = P.cap;
      x.fillStyle = C[1]; x.fillRect(ox, oy, T, 4);
      x.fillStyle = C[0]; x.fillRect(ox, oy, T, 1);
      x.fillStyle = C[2]; x.fillRect(ox, oy + 3, T, 1);
      for (let i = 0; i < T; i++) {
        const d = (r() * 3) | 0;
        if (d) { x.fillStyle = C[2]; x.fillRect(ox + i, oy + 4, 1, d); x.fillStyle = C[3]; x.fillRect(ox + i, oy + 4 + d, 1, 1); }
        if (theme === 'emerald' && r() < 0.25) { x.fillStyle = C[0]; x.fillRect(ox + i, oy + 1, 1, 1); }
      }
      if (theme === 'lava') { x.fillStyle = '#ff6a1a'; if (r() < 0.3) x.fillRect(ox + ((r() * 14) | 0), oy + 2, 2, 1); }
      if (!nb.l) { x.clearRect(ox, oy, 1, 1); x.fillStyle = P.edge; x.fillRect(ox, oy + 1, 1, 6); }
      if (!nb.r) { x.clearRect(ox + T - 1, oy, 1, 1); x.fillStyle = P.edge; x.fillRect(ox + T - 1, oy + 1, 1, 6); }
    }
  }
  function paintBlock(x, ox, oy, theme, r) {
    if (theme === 'emerald') {
      bevelBlock(x, ox, oy, '#e0c080', '#f8e4b0', '#b08c56', '#5a3e1c');
      x.fillStyle = '#c8a466'; x.fillRect(ox + 4, oy + 5, 3, 1); x.fillRect(ox + 9, oy + 10, 3, 1);
    } else if (theme === 'crystal') {
      bevelBlock(x, ox, oy, '#8a5ae0', '#d0b0ff', '#5a34a8', '#1a0c40');
      x.fillStyle = '#b088ff'; x.fillRect(ox + 3, oy + 3, 5, 5);
      x.fillStyle = '#ffffff'; x.fillRect(ox + 3, oy + 3, 2, 1);
      x.fillStyle = '#6a40c0'; x.fillRect(ox + 8, oy + 8, 5, 5);
    } else {
      bevelBlock(x, ox, oy, '#5a5868', '#8a889a', '#34323e', '#0e0c14');
      x.fillStyle = '#20202a'; [[3, 3], [12, 3], [3, 12], [12, 12]].forEach(([a, b]) => x.fillRect(ox + a, oy + b, 2, 2));
      x.fillStyle = '#a8a6b8'; [[3, 3], [12, 3], [3, 12], [12, 12]].forEach(([a, b]) => x.fillRect(ox + a, oy + b, 1, 1));
    }
  }
  function paintBridge(x, ox, oy, theme, hasL, hasR) {
    if (theme === 'emerald') {
      x.fillStyle = '#3a2010'; x.fillRect(ox, oy, T, 7);
      x.fillStyle = '#b8783a'; x.fillRect(ox, oy + 1, T, 4);
      x.fillStyle = '#e0a060'; x.fillRect(ox, oy + 1, T, 1);
      x.fillStyle = '#3a2010'; x.fillRect(ox + 7, oy + 1, 1, 4);
      x.fillStyle = '#7a4a20'; x.fillRect(ox, oy + 5, T, 1);
      if (!hasL) { x.fillStyle = '#3a2010'; x.fillRect(ox, oy, 1, 7); }
      if (!hasR) { x.fillStyle = '#3a2010'; x.fillRect(ox + 15, oy, 1, 7); }
    } else if (theme === 'crystal') {
      x.fillStyle = '#0e0828'; x.fillRect(ox, oy, T, 6);
      x.fillStyle = '#3ae0d0'; x.fillRect(ox, oy + 1, T, 3);
      x.fillStyle = '#c8fff8'; x.fillRect(ox, oy + 1, T, 1);
      x.fillStyle = '#1a8a98'; x.fillRect(ox + 2, oy + 4, 3, 2); x.fillRect(ox + 10, oy + 4, 2, 3);
    } else {
      x.fillStyle = '#0e0c14'; x.fillRect(ox, oy, T, 6);
      x.fillStyle = '#6a6878'; x.fillRect(ox, oy + 1, T, 3);
      x.fillStyle = '#9a98a8'; x.fillRect(ox, oy + 1, T, 1);
      x.fillStyle = '#0e0c14'; for (let i = 1; i < 16; i += 3) x.fillRect(ox + i, oy + 2, 1, 2);
    }
  }

  /* ================================================================== */
  /* Decorations (generated per level from the tile grid)                */
  /* ================================================================== */
  Art.genDecor = function (grid, theme, seed, reserved) {
    const r = PQ.rng(seed);
    const h = grid.length, w = grid[0].length;
    const out = [];
    const empty = (tx, ty) => ty >= 0 && ty < h && tx >= 0 && tx < w && grid[ty][tx] === ' ' && !reserved.has(tx + ',' + ty);
    for (let tx = 0; tx < w; tx++) {
      for (let ty = 1; ty < h; ty++) {
        const c = grid[ty][tx];
        if (c !== '#') continue;
        const above = grid[ty - 1][tx];
        if (above === ' ' && !reserved.has(tx + ',' + (ty - 1))) {
          const px = tx * T, py = ty * T;
          const n = r();
          if (theme === 'emerald') {
            if (n < 0.1 && empty(tx, ty - 2) && empty(tx, ty - 3) && tx > 6) out.push({ k: 'tree', x: px - 12, y: py, v: (r() * 3) | 0, layer: 0 });
            else if (n < 0.24) out.push({ k: 'bush', x: px - 5, y: py - 10, layer: 0 });
            else if (n < 0.3) out.push({ k: 'rock', x: px + 2, y: py - 6, layer: 2 });
            if (r() < 0.55) out.push({ k: 'flower', x: px + 2 + ((r() * 11) | 0), y: py, c: ['#ff4a6a', '#ffd23a', '#ffffff', '#ff8ad8', '#6ac8ff'][(r() * 5) | 0], layer: 2 });
            if (r() < 0.7) out.push({ k: 'tuft', x: px + ((r() * 13) | 0), y: py, layer: 2 });
          } else if (theme === 'crystal') {
            if (n < 0.14) out.push({ k: 'crystal', x: px, y: py - 17, v: (r() * 3) | 0, layer: 1 });
            else if (n < 0.22) out.push({ k: 'mushroom', x: px + 3, y: py - 8, layer: 2 });
            else if (n < 0.3) out.push({ k: 'glowmoss', x: px, y: py, layer: 2 });
          } else if (theme === 'lava') {
            if (n < 0.06) out.push({ k: 'bones', x: px + 4, y: py - 3, layer: 2 });
          }
        }
        // ceiling decorations
        if (ty + 1 < h && grid[ty + 1][tx] === ' ' && !reserved.has(tx + ',' + (ty + 1))) {
          if (theme === 'crystal' && r() < 0.35) out.push({ k: 'stalactite', x: tx * T + 3, y: (ty + 1) * T, v: r() < 0.5 ? 1 : 0, layer: 1 });
          if (theme === 'lava' && r() < 0.12) out.push({ k: 'chain', x: tx * T + 5, y: (ty + 1) * T, len: 16 + ((r() * 30) | 0), layer: 0 });
        }
      }
    }
    if (theme === 'lava') {
      for (let tx = 4; tx < w; tx += 6 + ((r() * 4) | 0)) {
        for (let ty = 5; ty < 10; ty++) {
          if (empty(tx, ty) && empty(tx, ty + 1) && empty(tx, ty - 1)) { out.push({ k: 'torch', x: tx * T + 4, y: ty * T, layer: 0 }); break; }
        }
      }
      for (let tx = 9; tx < w - 27; tx += 14 + ((r() * 6) | 0)) {
        if (empty(tx, 3) && empty(tx, 4) && empty(tx, 5)) out.push({ k: 'banner', x: tx * T + 1, y: 2 * T + 4, layer: 0 });
      }
    }
    out.sort((a, b) => a.x - b.x);
    return out;
  };

  /* ================================================================== */
  /* Parallax backgrounds                                                 */
  /* ================================================================== */
  const BW = 512;
  function layer(h = PQ.H) { return PQ.canvas(BW, h); }
  const TAU = Math.PI * 2;
  const wave = (x, parts) => parts.reduce((s, [a, f, p]) => s + a * Math.sin((TAU * x * f) / BW + p), 0);

  Art.buildBackgrounds = function () {
    const B = (Art.bg = {});
    /* ---- Emerald Valley ---- */
    {
      const far = layer(), mid = layer(), near = layer();
      for (let x = 0; x < BW; x++) {
        const hgt = 92 + wave(x, [[22, 2, 0], [12, 5, 1.3], [5, 11, 0.4]]) + Math.abs(wave(x, [[14, 3, 0.7]]));
        const top = PQ.H - hgt;
        far.x.fillStyle = '#8fb8e8'; far.x.fillRect(x, top, 1, hgt);
        const slope = wave(x + 1, [[22, 2, 0], [12, 5, 1.3], [5, 11, 0.4]]) - wave(x, [[22, 2, 0], [12, 5, 1.3], [5, 11, 0.4]]);
        far.x.fillStyle = slope > 0 ? '#a8ccf0' : '#7aa4d8'; far.x.fillRect(x, top, 1, Math.min(hgt, 30));
        if (top < 112) { far.x.fillStyle = '#f0f8ff'; far.x.fillRect(x, top, 1, Math.max(2, Math.min(8, 112 - top) | 0)); }
        far.x.fillStyle = '#9cc4ec'; far.x.fillRect(x, PQ.H - 40, 1, 40);
      }
      const r = PQ.rng(5);
      for (let x = 0; x < BW; x++) {
        const hgt = 62 + wave(x, [[10, 3, 0.2], [6, 7, 2]]);
        mid.x.fillStyle = '#6cbc6c'; mid.x.fillRect(x, PQ.H - hgt, 1, hgt);
        mid.x.fillStyle = '#8ad88a'; mid.x.fillRect(x, PQ.H - hgt, 1, 2);
        mid.x.fillStyle = '#5aa85e'; mid.x.fillRect(x, PQ.H - hgt + 12, 1, hgt);
      }
      for (let i = 0; i < 26; i++) {
        const x = r() * BW, hgt = 62 + wave(x, [[10, 3, 0.2], [6, 7, 2]]), rad = 5 + r() * 6;
        for (const ox of [0, BW, -BW]) {
          mid.x.fillStyle = '#4a9a54'; mid.x.beginPath(); mid.x.arc(Math.round(x + ox), Math.round(PQ.H - hgt + 2), rad, 0, TAU); mid.x.fill();
          mid.x.fillStyle = '#5cae5e'; mid.x.beginPath(); mid.x.arc(Math.round(x + ox - 1), Math.round(PQ.H - hgt), rad - 2, 0, TAU); mid.x.fill();
        }
      }
      for (let x = 0; x < BW; x++) {
        const hgt = 34 + wave(x, [[6, 4, 1], [4, 13, 0.5], [2, 29, 0]]);
        near.x.fillStyle = '#2e7a4a'; near.x.fillRect(x, PQ.H - hgt, 1, hgt);
        near.x.fillStyle = '#3e9258'; near.x.fillRect(x, PQ.H - hgt, 1, 2);
      }
      for (let i = 0; i < 40; i++) {
        const x = r() * BW, hgt = 34 + wave(x, [[6, 4, 1], [4, 13, 0.5], [2, 29, 0]]);
        for (const ox of [0, BW, -BW]) {
          near.x.fillStyle = '#286c42'; near.x.beginPath(); near.x.arc(Math.round(x + ox), Math.round(PQ.H - hgt), 6 + r() * 5, 0, TAU); near.x.fill();
        }
      }
      const clouds = [0, 1, 2].map((v) => {
        const rr = PQ.rng(300 + v);
        const blobs = [];
        const n = 5 + v * 2;
        for (let i = 0; i < n; i++) blobs.push([10 + (i / n) * (40 + v * 20) + rr() * 6, 14 + rr() * 6 - Math.sin((i / n) * Math.PI) * 8, 7 + rr() * 5]);
        return PQ.shape(70 + v * 20, 28, (x, y) => y < 24 && blobs.some(([a, b, rad]) => (x - a) ** 2 + (y - b) ** 2 < rad * rad),
          (x, y) => (y > 18 ? '#c8e4f8' : y > 14 ? '#e8f4ff' : '#ffffff'), null);
      });
      B.emerald = {
        sky: ['#4aa8f0', '#8ccdfa', '#d4f0ff'], layers: [[far.c, 0.12, 0], [mid.c, 0.3, 0], [near.c, 0.55, 0]], clouds, sun: true,
      };
    }
    /* ---- Crystal Caverns ---- */
    {
      const far = layer(), mid = layer();
      const r = PQ.rng(17);
      for (let x = 0; x < BW; x++) {
        const top = 30 + wave(x, [[16, 4, 0], [10, 9, 1], [6, 23, 2]]) + Math.max(0, wave(x, [[40, 6, 0.5]]));
        far.x.fillStyle = '#1c1440'; far.x.fillRect(x, 0, 1, top);
        const bot = 50 + wave(x, [[14, 3, 1], [8, 11, 0.3]]) + Math.max(0, wave(x, [[30, 5, 2]]));
        far.x.fillRect(x, PQ.H - bot, 1, bot);
      }
      for (let x = 0; x < BW; x++) {
        const top = 14 + Math.max(0, wave(x, [[30, 7, 1], [14, 17, 0]]));
        mid.x.fillStyle = '#2a1d58'; mid.x.fillRect(x, 0, 1, top);
        mid.x.fillStyle = '#3a2a78'; mid.x.fillRect(x, top - 2, 1, 2);
        const bot = 28 + Math.max(0, wave(x, [[34, 4, 0.2], [12, 13, 1]]));
        mid.x.fillStyle = '#2a1d58'; mid.x.fillRect(x, PQ.H - bot, 1, bot);
        mid.x.fillStyle = '#3a2a78'; mid.x.fillRect(x, PQ.H - bot, 1, 2);
      }
      const glints = [];
      for (let i = 0; i < 30; i++) {
        const x = (r() * BW) | 0, y = (r() < 0.5 ? 10 + r() * 50 : PQ.H - 20 - r() * 60) | 0;
        const col = ['#5af0ff', '#ff6ad8', '#b88aff'][(r() * 3) | 0];
        far.x.fillStyle = col; far.x.fillRect(x, y, 1, 3); far.x.fillRect(x - 1, y + 1, 3, 1);
        glints.push({ x, y, col, p: r() * TAU });
      }
      for (let i = 0; i < 12; i++) {
        const x = (r() * (BW - 20)) | 0, bot = 28 + Math.max(0, wave(x, [[34, 4, 0.2], [12, 13, 1]]));
        const cr = Art.crystals[(r() * 3) | 0];
        mid.x.globalAlpha = 0.85; mid.x.drawImage(cr, x, PQ.H - bot - 14); mid.x.globalAlpha = 1;
      }
      B.crystal = { sky: ['#07041a', '#140c34', '#22164a'], layers: [[far.c, 0.15, 0], [mid.c, 0.4, 0]], glints };
    }
    /* ---- Lava Fortress ---- */
    {
      const far = layer(), mid = layer(), near = layer();
      const r = PQ.rng(29);
      // volcano silhouettes
      const volc = (x) => {
        const peaks = [[90, 110, 70], [300, 150, 55], [440, 95, 60]];
        let best = 30 + wave(x, [[6, 5, 0]]);
        for (const [px, ph, pw] of peaks) {
          for (const o of [0, BW, -BW]) {
            const d = Math.abs(x - px - o);
            const hh = ph - d * (ph / (pw * 2.2)) - (d < 8 ? (8 - d) * 1.2 : 0);
            if (hh > best) best = hh;
          }
        }
        return best;
      };
      for (let x = 0; x < BW; x++) {
        const hgt = volc(x);
        far.x.fillStyle = '#3a0e16'; far.x.fillRect(x, PQ.H - hgt, 1, hgt);
        far.x.fillStyle = '#4e1820'; far.x.fillRect(x, PQ.H - hgt, 1, 2);
      }
      // lava streams
      for (const [px, ph] of [[90, 110], [300, 150], [440, 95]]) {
        let x = px, y = PQ.H - ph + 6;
        while (y < PQ.H) {
          far.x.fillStyle = '#ff5a1a'; far.x.fillRect(x | 0, y | 0, 2, 2);
          far.x.fillStyle = '#ffb040'; far.x.fillRect(x | 0, y | 0, 1, 1);
          x += (r() - 0.45) * 2; y += 2;
        }
        far.x.fillStyle = '#ff7a2a'; far.x.fillRect(px - 5, PQ.H - ph + 4, 10, 3);
      }
      // castle towers
      for (let i = 0; i < 6; i++) {
        const tx = 20 + i * 86 + ((r() * 30) | 0), th = 70 + r() * 60, tw = 22 + r() * 16;
        mid.x.fillStyle = '#22070c'; mid.x.fillRect(tx, PQ.H - th, tw, th);
        for (let c = 0; c < tw; c += 6) mid.x.fillRect(tx + c, PQ.H - th - 5, 4, 5);
        mid.x.fillStyle = '#2e0c12'; mid.x.fillRect(tx, PQ.H - th, 2, th);
        for (let wy = PQ.H - th + 12; wy < PQ.H - 20; wy += 18) {
          mid.x.fillStyle = r() < 0.7 ? '#ff9a2a' : '#5a1a10';
          mid.x.fillRect(tx + tw / 2 - 2, wy, 4, 6);
          mid.x.fillRect(tx + tw / 2 - 1, wy - 1, 2, 1);
        }
      }
      mid.x.fillStyle = '#22070c'; mid.x.fillRect(0, PQ.H - 34, BW, 34);
      for (let c = 0; c < BW; c += 8) mid.x.fillRect(c, PQ.H - 39, 5, 5);
      // near pillars/arches
      for (let i = 0; i < 4; i++) {
        const px = i * 128 + 40;
        near.x.fillStyle = '#140408'; near.x.fillRect(px, 0, 16, PQ.H);
        near.x.fillStyle = '#1e080c'; near.x.fillRect(px + 2, 0, 3, PQ.H);
        near.x.fillStyle = '#140408'; near.x.fillRect(px - 6, 0, 28, 10); near.x.fillRect(px - 4, PQ.H - 12, 24, 12);
      }
      B.lava = { sky: ['#12020a', '#4a0c10', '#b03010'], layers: [[far.c, 0.1, 0], [mid.c, 0.28, 0], [near.c, 0.7, 0]], embers: true };
    }
  };
})();
