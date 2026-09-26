/* Flappy Grey — Web Audio: synthesized SFX, original retro menu theme, route ambience.
 * All sound is generated in code (no copyrighted material). Browsers only allow audio
 * after a user gesture, so the context is created/resumed on the first input. */
(function () {
  'use strict';
  const FG = (window.FG = window.FG || {});

  const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function freq(note) {
    const m = /^([A-G]#?)(\d)$/.exec(note);
    const midi = (parseInt(m[2], 10) + 1) * 12 + NOTE_INDEX[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ---- Original menu theme "Grey Skies Ahead" (C major, 8 bars, eighth-note grid) ----
  const TEMPO = 138;
  const LEAD = [
    // [note|null, eighths]
    ['E5', 1], ['G5', 1], ['C6', 2], ['B5', 1], ['G5', 1], ['E5', 2],
    ['D5', 1], ['G5', 1], ['B5', 2], ['A5', 1], ['G5', 1], ['D5', 2],
    ['C5', 1], ['E5', 1], ['A5', 2], ['G5', 1], ['E5', 1], ['C5', 1], ['E5', 1],
    ['F5', 2], ['A5', 1], ['C6', 1], ['A5', 2], ['G5', 2],
    ['E5', 1], ['G5', 1], ['C6', 1], ['E6', 1], ['D6', 2], ['C6', 2],
    ['B5', 1], ['D6', 1], ['B5', 1], ['G5', 1], ['A5', 2], ['B5', 2],
    ['C6', 1], ['A5', 1], ['F5', 1], ['A5', 1], ['G5', 1], ['F5', 1], ['E5', 1], ['D5', 1],
    ['D5', 2], ['G5', 1], ['B5', 1], ['D6', 3], [null, 1],
  ];
  const CHORDS = [
    ['C3', ['C4', 'E4', 'G4']],
    ['G2', ['B3', 'D4', 'G4']],
    ['A2', ['A3', 'C4', 'E4']],
    ['F2', ['A3', 'C4', 'F4']],
    ['C3', ['C4', 'E4', 'G4']],
    ['G2', ['B3', 'D4', 'G4']],
    ['F2', ['A3', 'C4', 'F4']],
    ['G2', ['B3', 'D4', 'F4']],
  ];
  // Expand lead into a 64-step grid of note starts.
  const LEAD_STEPS = (function () {
    const steps = new Array(64).fill(null);
    let i = 0;
    for (const [n, len] of LEAD) {
      if (n) steps[i] = { f: freq(n), len };
      i += len;
    }
    return steps;
  })();

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.muted = !!FG.util.storage.get('flappygrey.muted', false);
      this.musicTimer = null;
      this.ambTimer = null;
      this.ambNodes = [];
      this.musicBus = null;
      this.wantMusic = false;
    }

    /** Must be called from a user gesture. Safe to call repeatedly. */
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.9;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        this.master.connect(comp).connect(this.ctx.destination);
        this.sfx = this.ctx.createGain();
        this.sfx.gain.value = 0.9;
        this.sfx.connect(this.master);
        this.amb = this.ctx.createGain();
        this.amb.gain.value = 0.55;
        this.amb.connect(this.master);
        this.noise = this._makeNoise();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.wantMusic && !this.musicTimer) this._startMusic();
    }

    get ready() {
      return !!this.ctx && this.ctx.state === 'running';
    }

    suspend() {
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    }
    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    setMuted(m) {
      this.muted = m;
      FG.util.storage.set('flappygrey.muted', m);
      if (this.master) {
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setTargetAtTime(m ? 0 : 0.9, t, 0.03);
      }
    }

    _makeNoise() {
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    _noiseSrc(loop) {
      const s = this.ctx.createBufferSource();
      s.buffer = this.noise;
      s.loop = !!loop;
      if (loop) s.loopStart = Math.random();
      return s;
    }

    _env(gainNode, t, attack, peak, decay) {
      const g = gainNode.gain;
      g.setValueAtTime(0.0001, t);
      g.exponentialRampToValueAtTime(peak, t + attack);
      g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }

    _tone(type, f0, f1, t, dur, peak, dest) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      this._env(g, t, 0.005, peak, dur);
      o.connect(g).connect(dest || this.sfx);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    _noiseBurst(t, dur, peak, filterType, f0, f1, q, dest) {
      const s = this._noiseSrc(false);
      const f = this.ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.setValueAtTime(f0, t);
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      f.Q.value = q || 1;
      const g = this.ctx.createGain();
      this._env(g, t, 0.004, peak, dur);
      s.connect(f).connect(g).connect(dest || this.sfx);
      s.start(t, Math.random());
      s.stop(t + dur + 0.05);
    }

    // ---------------- SFX ----------------
    flap() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this._noiseBurst(t, 0.11, 0.35, 'bandpass', 1400, 380, 1.2);
      this._tone('sine', 380, 620, t, 0.07, 0.05);
    }

    score() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this._tone('square', 988, null, t, 0.07, 0.07);
      this._tone('square', 1319, null, t + 0.075, 0.14, 0.07);
    }

    hit() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this._noiseBurst(t, 0.22, 0.6, 'lowpass', 1800, 200, 0.7);
      this._tone('sine', 190, 45, t, 0.35, 0.5);
      this._tone('triangle', 900, 180, t + 0.18, 0.65, 0.07); // falling whistle
    }

    thud() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this._tone('sine', 120, 40, t, 0.18, 0.45);
      this._noiseBurst(t, 0.1, 0.25, 'lowpass', 600, 150, 0.7);
    }

    countdown(isGo) {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      if (isGo) {
        this._tone('square', 880, null, t, 0.32, 0.08);
        this._tone('square', 1320, null, t, 0.32, 0.06);
        this._tone('triangle', 440, null, t, 0.35, 0.12);
      } else {
        this._tone('square', 660, null, t, 0.13, 0.08);
      }
    }

    uiClick() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this._tone('square', 740, 1100, t, 0.05, 0.04);
    }

    newBest() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => this._tone('square', freq(n), null, t + i * 0.08, 0.12, 0.06));
    }

    thunder(delay) {
      if (!this.ready) return;
      const t = this.ctx.currentTime + (delay || 0);
      this._noiseBurst(t, 0.15, 0.5, 'lowpass', 2400, 400, 0.6, this.amb);
      const s = this._noiseSrc(false);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 170;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1.3, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      s.connect(f).connect(g).connect(this.amb);
      s.start(t, Math.random());
      s.stop(t + 2.7);
    }

    // ---------------- Menu music ----------------
    playMenuMusic() {
      this.wantMusic = true;
      if (this.ready && !this.musicTimer) this._startMusic();
    }

    stopMenuMusic() {
      this.wantMusic = false;
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
      if (this.musicBus) {
        const bus = this.musicBus;
        const t = this.ctx.currentTime;
        bus.gain.cancelScheduledValues(t);
        bus.gain.setTargetAtTime(0, t, 0.05);
        setTimeout(() => bus.disconnect(), 600);
        this.musicBus = null;
      }
    }

    _startMusic() {
      const ctx = this.ctx;
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0;
      this.musicBus.gain.setTargetAtTime(0.55, ctx.currentTime, 0.2);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 4200;
      this.musicBus.connect(lp).connect(this.master);
      const bus = this.musicBus;
      const stepDur = 60 / TEMPO / 2;
      let step = 0;
      let next = ctx.currentTime + 0.1;
      const schedule = () => {
        while (next < ctx.currentTime + 0.15) {
          this._musicStep(bus, step % 64, next, stepDur);
          step++;
          next += stepDur;
        }
      };
      schedule();
      this.musicTimer = setInterval(schedule, 25);
    }

    _voice(bus, type, f, t, dur, peak, duty) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
      g.gain.setValueAtTime(peak, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + dur + 0.02);
    }

    _musicStep(bus, s, t, d) {
      const bar = Math.floor(s / 8);
      const inBar = s % 8;
      const [bass, chord] = CHORDS[bar];
      // Lead (square)
      const lead = LEAD_STEPS[s];
      if (lead) {
        this._voice(bus, 'square', lead.f, t, d * lead.len * 0.92, 0.06);
        this._voice(bus, 'triangle', lead.f * 2, t, d * lead.len * 0.5, 0.012); // sparkle
      }
      // Bass (triangle): octave bounce on each beat
      if (inBar % 2 === 0) {
        const bf = freq(bass) * (inBar % 4 === 2 ? 2 : 1);
        this._voice(bus, 'triangle', bf, t, d * 1.7, 0.2);
      }
      // Off-beat chord stabs (pulse)
      if (inBar % 2 === 1) {
        for (const n of chord) this._voice(bus, 'square', freq(n), t, d * 0.45, 0.012);
      }
      // Drums
      if (inBar === 0 || inBar === 4) this._kick(bus, t);
      if (inBar === 2 || inBar === 6) this._snare(bus, t);
      this._hat(bus, t, inBar % 2 === 0 ? 0.05 : 0.03);
    }

    _kick(bus, t) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.2);
    }

    _snare(bus, t) {
      this._noiseBurst(t, 0.12, 0.18, 'highpass', 1500, null, 0.8, bus);
    }

    _hat(bus, t, peak) {
      this._noiseBurst(t, 0.035, peak, 'highpass', 7000, null, 0.7, bus);
    }

    // ---------------- Route ambience ----------------
    startAmbience(routeId) {
      this.stopAmbience();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const bed = (type, f, q, gain) => {
        const s = this._noiseSrc(true);
        const flt = ctx.createBiquadFilter();
        flt.type = type;
        flt.frequency.value = f;
        flt.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = 0;
        g.gain.setTargetAtTime(gain, ctx.currentTime, 0.6);
        s.connect(flt).connect(g).connect(this.amb);
        s.start();
        this.ambNodes.push(s, g);
        return g;
      };
      let events;
      if (routeId === 'jungle') {
        bed('bandpass', 1100, 0.4, 0.045);
        events = () => this._birdCall();
      } else if (routeId === 'savanna') {
        const wind = bed('lowpass', 420, 0.5, 0.09);
        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        lfo.frequency.value = 0.13;
        lfoG.gain.value = 0.05;
        lfo.connect(lfoG).connect(wind.gain);
        lfo.start();
        this.ambNodes.push(lfo);
        events = () => this._cricket();
      } else {
        bed('highpass', 900, 0.5, 0.11);
        bed('lowpass', 140, 0.6, 0.12);
        events = null;
      }
      if (events) {
        const tick = () => {
          events();
          this.ambTimer = setTimeout(tick, 900 + Math.random() * 2200);
        };
        this.ambTimer = setTimeout(tick, 600);
      }
    }

    stopAmbience() {
      if (this.ambTimer) clearTimeout(this.ambTimer);
      this.ambTimer = null;
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      for (const n of this.ambNodes) {
        if (n.gain) {
          n.gain.cancelScheduledValues(t);
          n.gain.setTargetAtTime(0, t, 0.15);
        }
      }
      const nodes = this.ambNodes;
      this.ambNodes = [];
      setTimeout(() => nodes.forEach((n) => { try { n.stop && n.stop(); n.disconnect(); } catch (e) {} }), 900);
    }

    _birdCall() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      const base = 1800 + Math.random() * 1600;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const tt = t + i * 0.13;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(base, tt);
        o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.4), tt + 0.05);
        o.frequency.exponentialRampToValueAtTime(base * 0.85, tt + 0.1);
        this._env(g, tt, 0.01, 0.025, 0.1);
        o.connect(g).connect(this.amb);
        o.start(tt);
        o.stop(tt + 0.15);
      }
    }

    _cricket() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.07;
        this._tone('sine', 4600, null, tt, 0.04, 0.012, this.amb);
      }
    }
  }

  FG.Audio = new AudioEngine();
})();
