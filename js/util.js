/* Flappy Grey — shared utilities (seeded RNG, seamless noise, colour helpers). */
(function () {
  'use strict';
  const FG = (window.FG = window.FG || {});

  // Mulberry32 seeded PRNG — deterministic scenery/obstacle art per seed.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Seamless 1D ridge function over a period (tile width).
   * terms: [[cycles, amplitude], ...] — integer cycles guarantee f(0) === f(period).
   * ridged: sharpen into peaks (mountains) instead of rolling hills.
   */
  function ridge(r, period, terms, ridged) {
    const parts = terms.map(([k, a]) => ({ k: Math.max(1, Math.round(k)), a: a * (0.65 + r() * 0.35), p: r() * Math.PI * 2 }));
    return function (x) {
      const u = (x / period) * Math.PI * 2;
      let v = 0;
      for (const t of parts) {
        const s = Math.sin(u * t.k + t.p);
        v += ridged ? t.a * (1 - Math.abs(s)) : t.a * (s * 0.5 + 0.5);
      }
      return v;
    };
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
  }

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  /** Draw fn at x and at its wrapped copies so features crossing tile edges stay seamless. */
  function wrap(tileW, x, margin, fn) {
    fn(x);
    if (x < margin) fn(x + tileW);
    if (x > tileW - margin) fn(x - tileW);
  }

  /** Fill a silhouette under a ridge function from x=0..w. */
  function silhouette(ctx, w, f, bottom, fill, step) {
    step = step || 4;
    ctx.beginPath();
    ctx.moveTo(0, bottom);
    for (let x = 0; x <= w + step; x += step) ctx.lineTo(Math.min(x, w), f(Math.min(x, w)));
    ctx.lineTo(w, bottom);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function vgrad(ctx, y0, y1, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  }

  /** Soft horizontal band (mist/haze) — uniform horizontally so always seamless. */
  function band(ctx, w, y, h, color, alpha) {
    ctx.fillStyle = vgrad(ctx, y, y + h, [
      [0, rgba(color, 0)],
      [0.5, rgba(color, alpha)],
      [1, rgba(color, 0)],
    ]);
    ctx.fillRect(0, y, w, h);
  }

  const storage = {
    get(key, fallback) {
      try {
        const v = window.localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* storage unavailable (private mode) — session-only */
      }
    },
  };

  FG.util = { rng, ridge, hexToRgb, mix, rgba, clamp, lerp, wrap, silhouette, vgrad, band, storage };
})();
