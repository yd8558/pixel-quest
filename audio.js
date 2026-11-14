/* PIXEL QUEST - audio.js
 * Original chiptune soundtrack and sound effects, synthesized live with the Web Audio API.
 * No external audio files are used.
 */
'use strict';
(function () {
  const PQ = window.PQ;

  /* ---------------- Music data helpers ---------------- */
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(n) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
    if (!m) return 60;
    return (parseInt(m[3], 10) + 1) * 12 + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /** "E5:2 G5:2 r:4" -> events (steps are 16th notes) */
  function seq(str) {
    let s = 0;
    const ev = [];
    for (const tok of str.trim().split(/\s+/)) {
      const [n, d] = tok.split(':');
      const dur = parseFloat(d) || 1;
      if (n !== 'r') ev.push({ s, d: dur, m: midi(n) });
      s += dur;
    }
    return { ev, len: s };
  }
  function chordTones(name) {
    const m = /^([A-G])(#|b)?(m?)/.exec(name);
    const root = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return { root, third: m[3] ? 3 : 4 };
  }
  /** bass line from chord list; pattern = [[step, interval, dur], ...] per bar */
  function bass(chords, pattern, oct) {
    const ev = [];
    chords.forEach((c, bar) => {
      const { root } = chordTones(c);
      const base = (oct + 1) * 12 + root;
      for (const [st, iv, du] of pattern) ev.push({ s: bar * 16 + st, d: du, m: base + iv });
    });
    return { ev, len: chords.length * 16 };
  }
  function arp(chords, oct, order, stepLen) {
    const ev = [];
    chords.forEach((c, bar) => {
      const { root, third } = chordTones(c);
      const base = (oct + 1) * 12 + root;
      const tones = [0, third, 7, 12, 12 + third, 19];
      for (let i = 0; i < 16 / stepLen; i++) ev.push({ s: bar * 16 + i * stepLen, d: stepLen * 0.9, m: base + tones[order[i % order.length]] });
    });
    return { ev, len: chords.length * 16 };
  }
  function drums(bars, pat) {
    const ev = [];
    for (let b = 0; b < bars; b++) {
      const p = Array.isArray(pat) ? pat[b % pat.length] : pat;
      for (let i = 0; i < 16; i++) if (p[i] !== '.') ev.push({ s: b * 16 + i, d: 1, m: p[i] });
    }
    return { ev, len: bars * 16 };
  }

  /* ---------------- Original tracks ---------------- */
  const TRACKS = {};
  function track(name, bpm, channels, loop = true) {
    let len = 0;
    for (const c of channels) len = Math.max(len, c.data.len);
    const byStep = Array.from({ length: Math.ceil(len) }, () => []);
    for (const c of channels) for (const e of c.data.ev) byStep[Math.floor(e.s)].push({ c, e });
    TRACKS[name] = { name, bpm, channels, len: Math.ceil(len), byStep, loop };
  }

  // Title — heroic G major
  {
    const ch = ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D'];
    const mel = seq('D5:2 G5:2 B5:4 A5:2 G5:2 D5:4 F#5:2 A5:2 D6:4 C6:2 A5:2 F#5:4 G5:2 B5:2 E6:4 D6:2 B5:2 G5:4 E5:2 G5:2 C6:4 B5:4 A5:4 ' +
      'B5:2 D6:2 G6:4 F#6:2 E6:2 D6:4 A5:2 D6:2 F#6:4 E6:2 D6:2 A5:4 G5:2 A5:2 B5:2 C6:2 E6:4 D6:4 D6:8 r:8');
    track('title', 118, [
      { inst: 'lead', data: mel },
      { inst: 'bass', data: bass(ch, [[0, 0, 3], [4, 7, 2], [8, 12, 3], [12, 7, 2]], 2) },
      { inst: 'arp', data: arp(ch, 4, [0, 1, 2, 3, 2, 1], 2) },
      { inst: 'drum', data: drums(8, 'k...h...s...h.k.') },
    ]);
  }
  // Level 1 — Emerald Valley, bright C major
  {
    const ch = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'];
    const mel = seq('E5:2 G5:2 C6:3 B5:1 C6:2 G5:2 E5:2 G5:2 A5:3 G5:1 E5:2 C5:2 E5:4 r:2 D5:2 ' +
      'F5:2 A5:2 C6:2 A5:2 G5:2 F5:2 E5:2 F5:2 G5:4 D5:2 G5:2 B5:4 A5:2 G5:2 ' +
      'E5:2 G5:2 C6:3 D6:1 E6:2 D6:2 C6:2 G5:2 A5:2 C6:2 E6:2 C6:2 B5:2 A5:2 G5:2 E5:2 ' +
      'F5:2 G5:2 A5:2 C6:2 D6:3 C6:1 A5:2 F5:2 G5:3 A5:1 B5:2 D6:2 C6:6 r:2');
    track('level1', 140, [
      { inst: 'lead', data: mel },
      { inst: 'bass', data: bass(ch, [[0, 0, 2], [2, 12, 1], [4, 7, 2], [6, 12, 1], [8, 0, 2], [10, 12, 1], [12, 7, 2], [14, 5, 2]], 2) },
      { inst: 'arp', data: arp(ch, 5, [0, 2, 1, 2], 4) },
      { inst: 'drum', data: drums(8, ['k.h.s.h.k.k.s.h.', 'k.h.s.h.k.h.s.hh']) },
    ]);
  }
  // Level 2 — Crystal Caverns, mysterious A minor
  {
    const ch = ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'G', 'E'];
    const mel = seq('A4:4 C5:2 E5:2 A5:6 G5:2 F5:4 E5:2 C5:2 A4:8 D5:4 F5:2 A5:2 G5:4 F5:2 E5:2 E5:6 G#5:2 B5:4 r:4 ' +
      'A5:4 B5:2 C6:2 B5:4 A5:2 G5:2 A5:4 G5:2 F5:2 E5:4 C5:4 D5:2 E5:2 G5:4 B5:2 A5:2 G5:4 G#5:4 E5:4 B4:8');
    const arpData = arp(ch, 5, [0, 1, 2, 3, 4, 3, 2, 1], 1);
    track('level2', 108, [
      { inst: 'lead2', data: mel },
      { inst: 'bass', data: bass(ch, [[0, 0, 6], [6, 7, 2], [8, 12, 6], [14, 7, 2]], 2) },
      { inst: 'bell', data: arpData },
      { inst: 'drum', data: drums(8, ['k.......s.....h.', 'k.....k.s...h.h.']) },
    ]);
  }
  // Level 3 — Lava Fortress, driving D minor
  {
    const ch = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A'];
    const mel = seq('D5:2 D5:1 D5:1 F5:2 A5:2 G5:2 F5:2 E5:2 F5:2 D5:4 A4:2 D5:2 F5:4 E5:4 ' +
      'Bb4:2 D5:2 F5:2 Bb5:2 A5:4 F5:4 C5:2 E5:2 G5:2 C6:2 Bb5:4 A5:4 ' +
      'D6:3 C6:1 A5:2 F5:2 D5:2 F5:2 A5:4 G5:2 F5:2 E5:2 D5:2 E5:2 F5:2 G5:4 ' +
      'F5:2 Bb5:2 D6:4 C6:2 Bb5:2 A5:4 A5:4 C#6:4 E6:4 A5:4');
    track('level3', 150, [
      { inst: 'saw', data: mel },
      { inst: 'bass', data: bass(ch, [[0, 0, 1], [1, 0, 1], [2, 12, 1], [3, 0, 1], [4, 0, 1], [5, 0, 1], [6, 12, 1], [7, 0, 1], [8, 0, 1], [9, 0, 1], [10, 12, 1], [11, 0, 1], [12, 7, 1], [13, 7, 1], [14, 12, 1], [15, 10, 1]], 1) },
      { inst: 'arp', data: arp(ch, 4, [0, 2, 3, 2], 2) },
      { inst: 'drum', data: drums(8, ['k.h.s.hkk.h.s.h.', 'k.hks.h.k.hks.ss']) },
    ]);
  }
  // Boss — intense E minor
  {
    const ch = ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B'];
    const mel = seq('E5:1 E5:1 r:1 E5:1 G5:2 E5:2 B5:2 A5:2 G5:2 F#5:2 E5:2 F#5:2 G5:2 A5:2 B5:4 r:4 ' +
      'C6:2 B5:2 A5:2 G5:2 E5:4 G5:4 D6:2 C6:2 B5:2 A5:2 F#5:4 D5:4 ' +
      'E6:2 D6:2 B5:2 G5:2 E5:2 G5:2 B5:4 A5:2 G5:2 F#5:2 E5:2 F#5:2 G5:2 A5:4 ' +
      'G5:2 C6:2 E6:4 D6:2 C6:2 B5:4 B5:4 D#6:4 F#6:4 B5:4');
    track('boss', 168, [
      { inst: 'lead', data: mel },
      { inst: 'bass', data: bass(ch, [[0, 0, 1], [1, 12, 1], [2, 0, 1], [3, 12, 1], [4, 0, 1], [5, 12, 1], [6, 0, 1], [7, 12, 1], [8, 0, 1], [9, 12, 1], [10, 0, 1], [11, 12, 1], [12, 1, 1], [13, 13, 1], [14, 1, 1], [15, 13, 1]], 1) },
      { inst: 'arp', data: arp(ch, 4, [0, 1, 2, 1], 1) },
      { inst: 'drum', data: drums(8, ['k.hkshk.k.hkshss', 'kkhks.hkk.hkssss']) },
    ]);
  }
  // Jingles (non-looping)
  track('clear', 150, [
    { inst: 'lead', data: seq('G4:1 C5:1 E5:1 G5:2 E5:1 G5:2 C6:8 r:4') },
    { inst: 'bass', data: seq('C3:3 G3:3 C4:8 r:6') },
    { inst: 'arp', data: seq('E4:1 G4:1 C5:1 E5:2 C5:1 E5:2 G5:8 r:4') },
  ], false);
  track('victory', 132, [
    { inst: 'lead', data: seq('C5:2 C5:1 C5:1 G5:4 E5:2 G5:2 C6:4 B5:2 A5:2 G5:2 A5:2 B5:4 C6:12 r:8') },
    { inst: 'arp', data: seq('E4:2 E4:1 E4:1 E5:4 C5:2 E5:2 E5:4 G5:2 F5:2 E5:2 F5:2 G5:4 E5:12 r:8') },
    { inst: 'bass', data: seq('C3:4 C3:4 A2:4 A2:4 F2:4 G2:4 C3:12 r:8') },
    { inst: 'drum', data: drums(3, 'k...s...k.k.s.s.') },
  ], false);
  track('gameover', 96, [
    { inst: 'lead', data: seq('E5:3 D#5:3 D5:3 C#5:6 r:1 A4:2 G#4:2 A4:8 r:4') },
    { inst: 'bass', data: seq('A2:6 G#2:6 F2:4 E2:4 A1:10 r:2') },
  ], false);

  /* ---------------- Synth engine ---------------- */
  const A = (PQ.Audio = {
    ctx: null, master: null, music: null, sfxBus: null, cur: null, noise: null, waves: {},
    musicOn: true, sfxOn: true, pending: null,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { this.ctx = null; return; }
      const c = this.ctx;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      comp.connect(c.destination);
      this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(comp);
      this.music = c.createGain(); this.music.gain.value = this.musicOn ? 0.55 : 0; this.music.connect(this.master);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sfxOn ? 0.7 : 0; this.sfxBus.connect(this.master);
      // echo for bells
      this.echo = c.createDelay(); this.echo.delayTime.value = 0.28;
      const fb = c.createGain(); fb.gain.value = 0.35;
      this.echo.connect(fb); fb.connect(this.echo); this.echo.connect(this.music);
      const len = c.sampleRate;
      const b = c.createBuffer(1, len, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
      this.waves.p25 = this.pulse(0.25);
      this.waves.p12 = this.pulse(0.125);
      setInterval(() => this.tick(), 25);
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
      });
      if (this.pending) { const p = this.pending; this.pending = null; this.play(p.name, p.onEnd); }
    },
    pulse(duty) {
      const n = 48, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      return this.ctx.createPeriodicWave(re, im);
    },
    setMusic(on) { this.musicOn = on; if (this.music) this.music.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05); },
    setSfx(on) { this.sfxOn = on; if (this.sfxBus) this.sfxBus.gain.value = on ? 0.7 : 0; },

    tone(t, f, dur, o = {}) {
      const c = this.ctx;
      const osc = c.createOscillator(), g = c.createGain();
      const w = o.wave || 'square';
      if (this.waves[w]) osc.setPeriodicWave(this.waves[w]); else osc.type = w;
      osc.frequency.setValueAtTime(f, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
      if (o.vib) {
        const l = c.createOscillator(), lg = c.createGain();
        l.frequency.value = o.vib; lg.gain.value = f * 0.03;
        l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05);
      }
      const v = o.vol || 0.1, at = o.attack || 0.004, rel = Math.min(o.release || 0.05, dur * 0.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + at);
      if (o.decay) g.gain.linearRampToValueAtTime(v * o.decay, t + Math.min(dur - rel, at + 0.09));
      g.gain.setValueAtTime(o.decay ? v * o.decay : v, t + Math.max(at, dur - rel));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(o.dest || this.sfxBus);
      if (o.send) g.connect(o.send);
      osc.start(t); osc.stop(t + dur + 0.03);
    },
    noiseHit(t, dur, o = {}) {
      const c = this.ctx;
      const src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = o.type || 'highpass'; f.frequency.setValueAtTime(o.freq || 4000, t);
      if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
      f.Q.value = o.q || 1;
      const g = c.createGain();
      g.gain.setValueAtTime(o.vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(o.dest || this.sfxBus);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    },

    /* --- Music sequencer --- */
    play(name, onEnd) {
      if (!this.ctx) { this.pending = { name, onEnd }; return; }
      if (this.cur && this.cur.name === name && !onEnd) return;
      this.stop();
      const tr = TRACKS[name];
      if (!tr) return;
      const bus = this.ctx.createGain(); bus.gain.value = 1; bus.connect(this.music);
      this.cur = { name, tr, step: 0, next: this.ctx.currentTime + 0.05, dur: 60 / tr.bpm / 4, bus, onEnd };
    },
    stop() {
      if (!this.cur) return;
      const b = this.cur.bus, t = this.ctx.currentTime;
      b.gain.setValueAtTime(b.gain.value, t);
      b.gain.linearRampToValueAtTime(0.0001, t + 0.08);
      setTimeout(() => { try { b.disconnect(); } catch (e) { /* */ } }, 300);
      this.cur = null;
    },
    tick() {
      const cur = this.cur;
      if (!cur || !this.ctx) return;
      const now = this.ctx.currentTime;
      if (cur.next < now - 0.2) cur.next = now + 0.05;
      while (cur.next < now + 0.14) {
        const list = cur.tr.byStep[cur.step];
        if (list) for (const { c, e } of list) this.note(c.inst, e, cur.next, cur.dur, cur.bus);
        cur.step++;
        cur.next += cur.dur;
        if (cur.step >= cur.tr.len) {
          if (cur.tr.loop) cur.step = 0;
          else {
            const cb = cur.onEnd; const endAt = cur.next;
            this.cur = null;
            if (cb) setTimeout(cb, Math.max(0, (endAt - now) * 1000));
            return;
          }
        }
      }
    },
    note(inst, e, t, sd, bus) {
      const dur = e.d * sd;
      if (inst === 'drum') {
        if (e.m === 'k') { this.tone(t, 150, 0.12, { wave: 'sine', slide: 40, vol: 0.5, dest: bus }); }
        else if (e.m === 's') { this.noiseHit(t, 0.12, { type: 'bandpass', freq: 1800, vol: 0.22, dest: bus }); this.tone(t, 220, 0.06, { wave: 'triangle', slide: 120, vol: 0.12, dest: bus }); }
        else if (e.m === 'h') { this.noiseHit(t, 0.035, { type: 'highpass', freq: 7000, vol: 0.08, dest: bus }); }
        return;
      }
      const f = freq(e.m);
      switch (inst) {
        case 'lead': this.tone(t, f, dur, { wave: 'p25', vol: 0.085, decay: 0.7, release: 0.04, dest: bus, vib: e.d >= 4 ? 5.5 : 0 }); break;
        case 'lead2': this.tone(t, f, dur, { wave: 'triangle', vol: 0.17, decay: 0.8, dest: bus, send: this.echo, vib: e.d >= 4 ? 5 : 0 });
          this.tone(t, f * 2, dur, { wave: 'p12', vol: 0.025, decay: 0.5, dest: bus }); break;
        case 'saw': this.tone(t, f, dur, { wave: 'sawtooth', vol: 0.05, decay: 0.6, dest: bus, vib: e.d >= 4 ? 6 : 0 });
          this.tone(t, f * 0.998, dur, { wave: 'p25', vol: 0.04, decay: 0.6, dest: bus }); break;
        case 'bass': this.tone(t, f, dur * 0.95, { wave: 'triangle', vol: 0.26, release: 0.02, dest: bus }); break;
        case 'arp': this.tone(t, f, Math.min(dur, sd * 1.5), { wave: 'p12', vol: 0.035, release: 0.02, dest: bus }); break;
        case 'bell': this.tone(t, f, sd * 1.8, { wave: 'sine', vol: 0.05, decay: 0.3, dest: bus, send: this.echo }); break;
      }
    },

    /* --- Sound effects --- */
    sfx(name) {
      if (!this.ctx || !this.sfxOn) return;
      const t = this.ctx.currentTime + 0.005;
      const T = (f, d, o) => this.tone(t + ((o && o.at) || 0), f, d, o);
      switch (name) {
        case 'jump': T(260, 0.13, { wave: 'p25', vol: 0.11, slide: 640 }); break;
        case 'djump': T(420, 0.16, { wave: 'p25', vol: 0.1, slide: 1100 }); this.noiseHit(t, 0.12, { type: 'highpass', freq: 5000, vol: 0.05 }); break;
        case 'coin': T(988, 0.06, { wave: 'square', vol: 0.07 }); T(1319, 0.28, { wave: 'square', vol: 0.07, at: 0.06, release: 0.22 }); break;
        case 'stomp': T(520, 0.14, { wave: 'square', vol: 0.12, slide: 90 }); this.noiseHit(t, 0.08, { type: 'lowpass', freq: 2500, vol: 0.2 }); break;
        case 'hurt': T(720, 0.38, { wave: 'sawtooth', vol: 0.1, slide: 110, vib: 18 }); break;
        case 'die': [660, 622, 587, 523, 440, 330].forEach((f, i) => T(f, 0.12, { wave: 'p25', vol: 0.1, at: i * 0.1 })); break;
        case 'break': this.noiseHit(t, 0.25, { type: 'lowpass', freq: 2200, slide: 300, vol: 0.35 }); T(200, 0.1, { wave: 'square', vol: 0.08, slide: 60 }); break;
        case 'bump': T(170, 0.08, { wave: 'triangle', vol: 0.3, slide: 90 }); break;
        case 'appear': T(300, 0.35, { wave: 'triangle', vol: 0.22, slide: 1000 }); break;
        case 'powerup': [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => T(f, 0.08, { wave: 'p25', vol: 0.08, at: i * 0.055 })); break;
        case 'oneup': [1319, 1568, 2637, 2093, 2349, 3136].forEach((f, i) => T(f, 0.1, { wave: 'square', vol: 0.06, at: i * 0.08 })); break;
        case 'heart': [784, 988, 1175, 1568].forEach((f, i) => T(f, 0.12, { wave: 'triangle', vol: 0.2, at: i * 0.06 })); break;
        case 'checkpoint': [784, 1047, 1319, 1568].forEach((f, i) => T(f, 0.3, { wave: 'triangle', vol: 0.22, at: i * 0.08 })); break;
        case 'flag': for (let i = 0; i < 10; i++) T(392 * Math.pow(2, i / 5), 0.08, { wave: 'p25', vol: 0.07, at: i * 0.05 }); break;
        case 'select': T(660, 0.05, { wave: 'square', vol: 0.06 }); break;
        case 'confirm': T(660, 0.06, { wave: 'square', vol: 0.07 }); T(990, 0.12, { wave: 'square', vol: 0.07, at: 0.06 }); break;
        case 'pause': T(988, 0.07, { wave: 'p25', vol: 0.08 }); T(740, 0.07, { wave: 'p25', vol: 0.08, at: 0.08 }); T(988, 0.12, { wave: 'p25', vol: 0.08, at: 0.16 }); break;
        case 'bossHit': this.noiseHit(t, 0.35, { type: 'lowpass', freq: 1400, vol: 0.45 }); T(240, 0.32, { wave: 'sawtooth', vol: 0.15, slide: 60 }); break;
        case 'boom': this.noiseHit(t, 0.7, { type: 'lowpass', freq: 1000, slide: 70, vol: 0.55 }); T(100, 0.5, { wave: 'sine', vol: 0.45, slide: 30 }); break;
        case 'fire': this.noiseHit(t, 0.22, { type: 'bandpass', freq: 900, vol: 0.18 }); T(320, 0.16, { wave: 'sawtooth', vol: 0.05, slide: 140 }); break;
        case 'roar': T(120, 1.0, { wave: 'sawtooth', vol: 0.18, slide: 60, vib: 9 }); T(123, 1.0, { wave: 'square', vol: 0.06, slide: 58 }); this.noiseHit(t, 1.0, { type: 'lowpass', freq: 600, vol: 0.25 }); break;
        case 'slam': T(130, 0.3, { wave: 'sine', vol: 0.5, slide: 35 }); this.noiseHit(t, 0.4, { type: 'lowpass', freq: 800, slide: 100, vol: 0.4 }); break;
        case 'splash': this.noiseHit(t, 0.35, { type: 'bandpass', freq: 1200, slide: 400, vol: 0.25 }); break;
        case 'sizzle': this.noiseHit(t, 0.4, { type: 'highpass', freq: 3000, vol: 0.18 }); break;
        case 'jet': this.noiseHit(t, 0.5, { type: 'bandpass', freq: 600, slide: 1500, vol: 0.12 }); break;
        case 'clink': T(1760, 0.05, { wave: 'triangle', vol: 0.12 }); break;
      }
    },
  });
  PQ.Audio.TRACKS = TRACKS;
})();
