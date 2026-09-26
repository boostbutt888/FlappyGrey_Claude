/* Flappy Grey — route environments with multi-plane parallax.
 *
 * Each route defines independently scrolling planes, painted once into seamless tiles
 * (TILE_W wide, cropped to their vertical band) and scrolled at different speeds:
 *   far (0.05–0.08×)  low contrast, hazy, desaturated: sky clouds, distant mountains/mesas
 *   mid (0.25×)       stronger colour: forest ridges, plains, acacia, conifers
 *   near (0.55×)      darker/richer: large trees, palms, baobab, dead trees
 *   ground (1.0×)     locked to obstacle speed so pillars sit on it
 *   foreground (1.35×) highest contrast, near-black silhouettes in front of the bird
 * Dynamic effects (god rays, pollen, dust, rain, lightning) are drawn per frame.
 */
(function () {
  'use strict';
  const FG = (window.FG = window.FG || {});
  const { rng, ridge, rgba, wrap, silhouette, vgrad, band, clamp } = FG.util;
  const TW = FG.WORLD.TILE_W;
  const GY = FG.WORLD.GROUND_Y;
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------------
  // Shape helpers
  // ------------------------------------------------------------------
  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function cloud(ctx, x, y, s, color, alpha, seed, shade) {
    const r = rng(seed);
    const k = ctx.getTransform ? ctx.getTransform().a : 1;
    ctx.save();
    if ('filter' in ctx) ctx.filter = `blur(${Math.max(1, 2.5 * s * k).toFixed(1)}px)`;
    const n = 7 + Math.floor(r() * 5);
    const puffs = [];
    for (let i = 0; i < n; i++) {
      const dx = (r() - 0.5) * 150 * s;
      const fall = 1 - Math.abs(dx) / (110 * s);
      puffs.push([x + dx, y + (r() - 0.5) * 12 * s - fall * 10 * s, (12 + r() * 20) * s * (0.55 + fall * 0.6)]);
    }
    if (shade) {
      ctx.fillStyle = rgba(shade, alpha * 0.5);
      for (const p of puffs) circle(ctx, p[0], p[1] + p[2] * 0.35, p[2]);
    }
    ctx.fillStyle = rgba(color, alpha * 0.55);
    for (const p of puffs) circle(ctx, p[0], p[1], p[2]);
    ctx.fillStyle = rgba(color, alpha * 0.35);
    for (const p of puffs) circle(ctx, p[0] - p[2] * 0.2, p[1] - p[2] * 0.25, p[2] * 0.7);
    ctx.restore();
  }

  function canopyTree(ctx, x, baseY, topY, s, cols, seed) {
    const r = rng(seed);
    const tw = 7 * s;
    ctx.fillStyle = cols.trunk;
    ctx.beginPath();
    ctx.moveTo(x - tw * 2.4, baseY);
    ctx.quadraticCurveTo(x - tw * 0.6, baseY - 18 * s, x - tw * 0.5, topY + 18 * s);
    ctx.lineTo(x + tw * 0.5, topY + 18 * s);
    ctx.quadraticCurveTo(x + tw * 0.6, baseY - 18 * s, x + tw * 2.4, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = cols.trunk;
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.5 * s;
    for (let i = 0; i < 3; i++) {
      const bx = x + (r() - 0.5) * 60 * s;
      ctx.beginPath();
      ctx.moveTo(x, topY + 24 * s);
      ctx.quadraticCurveTo(x + (bx - x) * 0.3, topY + 5 * s, bx, topY - 4 * s);
      ctx.stroke();
    }
    const puffs = [];
    const n = 10 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      const dx = (r() - 0.5) * 120 * s;
      puffs.push([x + dx, topY + (r() - 0.6) * 30 * s + Math.abs(dx) * 0.18, (16 + r() * 18) * s]);
    }
    ctx.fillStyle = cols.dark;
    for (const p of puffs) circle(ctx, p[0], p[1] + 5 * s, p[2]);
    ctx.fillStyle = cols.leaf;
    for (const p of puffs) circle(ctx, p[0], p[1], p[2] * 0.92);
    ctx.fillStyle = cols.light;
    for (const p of puffs) circle(ctx, p[0] - p[2] * 0.3, p[1] - p[2] * 0.38, p[2] * 0.45);
    // Hanging vines
    if (cols.vine) {
      ctx.strokeStyle = cols.vine;
      ctx.lineWidth = 1.2 * s;
      for (let i = 0; i < 4; i++) {
        const vx = x + (r() - 0.5) * 90 * s;
        const len = (30 + r() * 70) * s;
        ctx.beginPath();
        ctx.moveTo(vx, topY + 10 * s);
        ctx.quadraticCurveTo(vx + 6 * s, topY + len * 0.5, vx - 2 * s, topY + len);
        ctx.stroke();
      }
    }
  }

  function palm(ctx, x, baseY, h, lean, trunkCol, leafCol, seed) {
    const r = rng(seed);
    const tx = x + lean, ty = baseY - h;
    ctx.strokeStyle = trunkCol;
    ctx.lineCap = 'round';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + lean * 0.1, baseY - h * 0.55, tx, ty);
    ctx.stroke();
    // Trunk rings
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 14; i++) {
      const t = i / 14;
      const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * (x + lean * 0.1) + t * t * tx;
      const py = (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * (baseY - h * 0.55) + t * t * ty;
      ctx.beginPath();
      ctx.moveTo(px - 4, py);
      ctx.lineTo(px + 4, py + 1);
      ctx.stroke();
    }
    ctx.fillStyle = leafCol;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI + (i / (n - 1)) * Math.PI + (r() - 0.5) * 0.3;
      const L = 55 + r() * 25;
      const ex = tx + Math.cos(a) * L;
      const ey = ty + Math.sin(a) * L * 0.45 + 22 + Math.abs(Math.cos(a)) * 18;
      const cx = tx + Math.cos(a) * L * 0.5;
      const cy = ty + Math.sin(a) * L * 0.5 - 14;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(cx, cy - 7, ex, ey);
      ctx.quadraticCurveTo(cx, cy + 7, tx, ty);
      ctx.fill();
      // Leaflet fringe
      ctx.strokeStyle = leafCol;
      ctx.lineWidth = 1.4;
      for (let k = 2; k < 10; k++) {
        const t = k / 10;
        const px = (1 - t) * (1 - t) * tx + 2 * (1 - t) * t * cx + t * t * ex;
        const py = (1 - t) * (1 - t) * ty + 2 * (1 - t) * t * cy + t * t * ey;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a + 1.3) * 10 * (1 - t * 0.5), py + 9 * (1 - t * 0.4));
        ctx.stroke();
      }
    }
  }

  function fern(ctx, x, baseY, h, color, seed) {
    const r = rng(seed);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    const n = 5 + Math.floor(r() * 3);
    for (let f = 0; f < n; f++) {
      const a = -2.7 + (f / (n - 1)) * 2.1 + (r() - 0.5) * 0.2;
      const L = h * (0.65 + r() * 0.35);
      const ex = x + Math.cos(a) * L;
      const ey = baseY + Math.sin(a) * L * 0.85 + L * 0.28;
      const cx = x + Math.cos(a) * L * 0.45;
      const cy = baseY + Math.sin(a) * L * 0.95;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(cx, cy, ex, ey);
      ctx.stroke();
      for (let k = 1; k < 16; k++) {
        const t = k / 16;
        const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex;
        const py = (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * cy + t * t * ey;
        const dx = 2 * (1 - t) * (cx - x) + 2 * t * (ex - cx);
        const dy = 2 * (1 - t) * (cy - baseY) + 2 * t * (ey - cy);
        const ang = Math.atan2(dy, dx);
        const len = (1 - t * 0.75) * L * 0.13;
        for (const side of [-1, 1]) {
          const la = ang + side * 1.05;
          ctx.beginPath();
          ctx.ellipse(px + Math.cos(la) * len * 0.5, py + Math.sin(la) * len * 0.5, len * 0.55, len * 0.17, la, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  function broadLeaf(ctx, x, baseY, h, lean, color, rib) {
    const tx = x + lean, ty = baseY - h;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.bezierCurveTo(x - h * 0.45 + lean * 0.3, baseY - h * 0.5, tx - h * 0.2, ty + h * 0.1, tx, ty);
    ctx.bezierCurveTo(tx + h * 0.25, ty + h * 0.15, x + h * 0.4 + lean * 0.3, baseY - h * 0.45, x, baseY);
    ctx.fill();
    if (rib) {
      ctx.strokeStyle = rib;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + lean * 0.4, baseY - h * 0.5, tx, ty);
      ctx.stroke();
    }
  }

  function acacia(ctx, x, baseY, s, color, seed) {
    const r = rng(seed);
    const h = (62 + r() * 18) * s;
    const cw = (80 + r() * 40) * s;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + 5 * s, baseY - h * 0.35, x + 1 * s, baseY - h * 0.55);
    ctx.stroke();
    ctx.lineWidth = 3 * s;
    const forks = [[-0.38, 0.97], [0.34, 0.95], [0.05, 1.0], [-0.15, 0.9]];
    for (const [fx, fy] of forks) {
      ctx.beginPath();
      ctx.moveTo(x + 1 * s, baseY - h * 0.55);
      ctx.quadraticCurveTo(x + cw * fx * 0.4, baseY - h * 0.75, x + cw * fx, baseY - h * fy);
      ctx.stroke();
    }
    // Flat umbrella canopy
    ctx.beginPath();
    ctx.ellipse(x, baseY - h - 3 * s, cw * 0.55, 8 * s, 0, 0, TAU);
    ctx.fill();
    const bumps = 8;
    for (let i = 0; i < bumps; i++) {
      const bx = x + ((i / (bumps - 1)) - 0.5) * cw * 0.95;
      ctx.beginPath();
      ctx.ellipse(bx, baseY - h - 8 * s - r() * 3 * s, (12 + r() * 8) * s, (6 + r() * 3) * s, 0, 0, TAU);
      ctx.fill();
    }
  }

  function baobab(ctx, x, baseY, s, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    const h = 100 * s;
    ctx.beginPath();
    ctx.moveTo(x - 24 * s, baseY);
    ctx.bezierCurveTo(x - 30 * s, baseY - h * 0.5, x - 12 * s, baseY - h * 0.8, x - 13 * s, baseY - h);
    ctx.lineTo(x + 13 * s, baseY - h);
    ctx.bezierCurveTo(x + 12 * s, baseY - h * 0.8, x + 30 * s, baseY - h * 0.5, x + 24 * s, baseY);
    ctx.closePath();
    ctx.fill();
    const br = [[-34, -26], [-18, -38], [0, -42], [18, -36], [32, -22], [-8, -30], [10, -30]];
    for (const [bx, by] of br) {
      ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(x + bx * 0.25 * s, baseY - h + 2 * s);
      ctx.quadraticCurveTo(x + bx * 0.6 * s, baseY - h + by * 0.4 * s, x + bx * s, baseY - h + by * s);
      ctx.stroke();
      ctx.lineWidth = 2.2 * s;
      ctx.beginPath();
      ctx.moveTo(x + bx * s, baseY - h + by * s);
      ctx.lineTo(x + bx * 1.2 * s, baseY - h + (by - 10) * s);
      ctx.stroke();
    }
  }

  function giraffe(ctx, x, baseY, s, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(x, baseY - 27 * s, 12 * s, 6.5 * s, -0.12, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2 * s;
    for (const lx of [-8, -5, 6, 9]) {
      ctx.beginPath();
      ctx.moveTo(x + lx * s, baseY - 24 * s);
      ctx.lineTo(x + (lx + 1) * s, baseY);
      ctx.stroke();
    }
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(x + 8 * s, baseY - 30 * s);
    ctx.lineTo(x + 17 * s, baseY - 58 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + 20.5 * s, baseY - 58 * s, 5 * s, 2.4 * s, 0.35, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(x + 17 * s, baseY - 60 * s);
    ctx.lineTo(x + 16 * s, baseY - 64 * s);
    ctx.moveTo(x - 11 * s, baseY - 28 * s);
    ctx.lineTo(x - 15 * s, baseY - 16 * s);
    ctx.stroke();
  }

  function conifer(ctx, x, baseY, h, color, tiers, seed) {
    const r = rng(seed);
    ctx.fillStyle = color;
    ctx.fillRect(x - h * 0.02 - 1, baseY - h * 0.2, h * 0.04 + 2, h * 0.2);
    for (let i = 0; i < tiers; i++) {
      const k = i / tiers;
      const w = h * 0.3 * (1 - k * 0.72);
      const y0 = baseY - h * 0.12 - k * h * 0.8;
      const top = y0 - (h / tiers) * 1.7;
      ctx.beginPath();
      ctx.moveTo(x - w, y0);
      const jags = 4;
      for (let j = 1; j <= jags; j++) {
        const t = j / jags;
        ctx.lineTo(x - w * (1 - t) + (r() - 0.5) * 2, y0 - (y0 - top) * t + (j % 2 ? 3 : 0));
      }
      for (let j = jags - 1; j >= 0; j--) {
        const t = j / jags;
        ctx.lineTo(x + w * (1 - t) + (r() - 0.5) * 2, y0 - (y0 - top) * t + (j % 2 ? 3 : 0));
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  function deadTree(ctx, x, baseY, h, color, seed) {
    const r = rng(seed);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    function branch(bx, by, ang, len, wdt, depth) {
      const ex = bx + Math.cos(ang) * len;
      const ey = by + Math.sin(ang) * len;
      ctx.lineWidth = wdt;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + Math.cos(ang + 0.3) * len * 0.5, by + Math.sin(ang + 0.3) * len * 0.5, ex, ey);
      ctx.stroke();
      if (depth <= 0) return;
      const k = 2 + (r() < 0.4 ? 1 : 0);
      for (let i = 0; i < k; i++) {
        branch(ex, ey, ang + (r() - 0.5) * 1.3, len * (0.55 + r() * 0.2), wdt * 0.62, depth - 1);
      }
    }
    branch(x, baseY, -Math.PI / 2 + (r() - 0.5) * 0.2, h * 0.45, h * 0.06, 4);
  }

  function grassTuft(ctx, x, baseY, h, n, color, lean, seed) {
    const r = rng(seed);
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const bx = x + (r() - 0.5) * n * 1.8;
      const bh = h * (0.35 + r() * 0.65);
      const tipX = bx + (r() - 0.5) * h * 0.45 + lean * bh;
      const w = 1.2 + r() * 1.6;
      ctx.beginPath();
      ctx.moveTo(bx - w, baseY);
      ctx.quadraticCurveTo(bx + (tipX - bx) * 0.25, baseY - bh * 0.6, tipX, baseY - bh);
      ctx.quadraticCurveTo(bx + (tipX - bx) * 0.25 + w, baseY - bh * 0.6, bx + w, baseY);
      ctx.fill();
    }
  }

  function mesa(ctx, x, base, w, h, colTop, colBot, seed, strata) {
    const r = rng(seed);
    const top = base - h;
    const pts = [
      [x - w / 2 - 28 - r() * 24, base],
      [x - w / 2 - 8, top + 16 + r() * 12],
      [x - w / 2 + 2, top + 4],
    ];
    for (let i = 1; i < 7; i++) pts.push([x - w / 2 + 4 + ((w - 8) * i) / 7, top + (r() - 0.5) * 3]);
    pts.push([x + w / 2 - 2, top + 5], [x + w / 2 + 10, top + 18 + r() * 14], [x + w / 2 + 32 + r() * 26, base]);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
    };
    path();
    ctx.fillStyle = vgrad(ctx, top, base, [[0, colTop], [1, colBot]]);
    ctx.fill();
    ctx.save();
    path();
    ctx.clip();
    // Shadowed flank (sun from the left)
    const sg = ctx.createLinearGradient(x, 0, x + w / 2 + 40, 0);
    sg.addColorStop(0, 'rgba(60,20,30,0)');
    sg.addColorStop(1, 'rgba(60,20,30,0.32)');
    ctx.fillStyle = sg;
    ctx.fillRect(x, top - 5, w / 2 + 70, h + 10);
    if (strata) {
      for (let k = 0; k < 6; k++) {
        const y = top + 10 + k * (h / 6.5) + r() * 4;
        ctx.fillStyle = k % 2 ? 'rgba(255,220,180,0.12)' : 'rgba(80,30,20,0.12)';
        ctx.fillRect(x - w, y, w * 2, 2 + r() * 3);
      }
    }
    // Lit rim on the caprock
    ctx.fillStyle = 'rgba(255,225,190,0.25)';
    ctx.fillRect(x - w / 2 - 10, top - 2, w, 3);
    ctx.restore();
  }

  function bumpsAlong(ctx, fy, x0, x1, step, rmin, rmax, color, r, light) {
    const bumps = [];
    for (let x = x0; x < x1; x += step * (0.7 + r() * 0.6)) bumps.push([x, fy(x), rmin + r() * (rmax - rmin)]);
    ctx.fillStyle = color;
    for (const b of bumps) wrap(TW, b[0], b[2] + 2, (X) => circle(ctx, X, b[1] + b[2] * 0.4, b[2]));
    if (light) {
      ctx.fillStyle = light;
      for (const b of bumps) wrap(TW, b[0], b[2] + 2, (X) => circle(ctx, X - b[2] * 0.25, b[1] + b[2] * 0.1, b[2] * 0.45));
    }
  }

  function groundBase(ctx, r, o) {
    ctx.fillStyle = vgrad(ctx, GY, 720, [[0, o.top], [1, o.bottom]]);
    ctx.fillRect(0, GY - 2, TW, 722 - GY);
    // Strata / texture speckles
    for (let i = 0; i < 380; i++) {
      const x = r() * TW, y = GY + 12 + r() * 80;
      ctx.fillStyle = r() < 0.5 ? o.speckA : o.speckB;
      ctx.fillRect(x, y, 1 + r() * 3, 1 + r() * 2);
    }
    // Edge highlight line
    ctx.fillStyle = o.edge;
    ctx.fillRect(0, GY - 2, TW, 5);
    // Blades along the edge
    for (let x = 0; x < TW; x += 2.2) {
      const h = 4 + r() * o.blade;
      ctx.fillStyle = r() < 0.5 ? o.bladeA : o.bladeB;
      ctx.beginPath();
      ctx.moveTo(x - 1.2, GY + 2);
      ctx.lineTo(x + (r() - 0.5) * 3, GY + 2 - h);
      ctx.lineTo(x + 1.2, GY + 2);
      ctx.fill();
    }
    // Shadow under the edge
    ctx.fillStyle = vgrad(ctx, GY + 3, GY + 18, [[0, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, GY + 3, TW, 15);
  }

  function stones(ctx, r, n, col, top, extra) {
    for (let i = 0; i < n; i++) {
      const x = r() * TW, y = GY + 20 + r() * 70, rw = 6 + r() * 16, rh = rw * (0.45 + r() * 0.2);
      wrap(TW, x, rw + 2, (X) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(X, y, rw, rh, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = top;
        ctx.beginPath();
        ctx.ellipse(X - rw * 0.15, y - rh * 0.35, rw * 0.7, rh * 0.45, 0, 0, TAU);
        ctx.fill();
        if (extra) extra(X, y, rw, rh);
      });
    }
  }

  // ------------------------------------------------------------------
  // Route art definitions
  // ------------------------------------------------------------------
  const ART = {};

  // ======================= JUNGLE DASH =======================
  ART.jungle = {
    sky(ctx, w) {
      ctx.fillStyle = vgrad(ctx, 0, GY, [[0, '#0d3a50'], [0.42, '#3a8b96'], [0.72, '#98cfbd'], [1, '#e1f0d6']]);
      ctx.fillRect(0, 0, w, 720);
      const g = ctx.createRadialGradient(w * 0.78, 110, 10, w * 0.78, 110, 320);
      g.addColorStop(0, 'rgba(255,248,210,0.65)');
      g.addColorStop(0.3, 'rgba(255,240,190,0.2)');
      g.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, 500);
    },
    layers: [
      {
        id: 'far', speed: 0.06, y0: 0, y1: 640,
        paint(ctx, r) {
          for (let i = 0; i < 9; i++) {
            const x = r() * TW, y = 50 + r() * 160, s = 0.7 + r() * 0.9, seed = (r() * 1e9) | 0;
            wrap(TW, x, 200 * s, (X) => cloud(ctx, X, y, s, '#f4fbf7', 0.75, seed, '#9fc9c4'));
          }
          const back = ridge(r, TW, [[2, 110], [5, 60], [11, 22]], true);
          silhouette(ctx, TW, (x) => 440 - back(x), 640, vgrad(ctx, 230, 480, [[0, '#9fc4c2'], [1, '#cfe6dc']]));
          band(ctx, TW, 380, 110, '#e4f3ec', 0.55);
          const front = ridge(r, TW, [[3, 120], [7, 50], [16, 16]], true);
          const fy = (x) => 500 - front(x);
          silhouette(ctx, TW, fy, 640, vgrad(ctx, 280, 520, [[0, '#6c9e98'], [1, '#a8cdbf']]));
          // Rock-face streaks for texture
          for (let i = 0; i < 260; i++) {
            const x = r() * TW, y0 = fy(x) + 4, len = 10 + r() * 50;
            ctx.fillStyle = r() < 0.5 ? 'rgba(40,80,80,0.10)' : 'rgba(230,250,240,0.10)';
            ctx.fillRect(x, y0, 1.5, len);
          }
          // Waterfalls cascading from the ridge
          for (let i = 0; i < 4; i++) {
            const x = 80 + r() * (TW - 160);
            const top = fy(x) + 12, len = 70 + r() * 80, wdt = 3 + r() * 4;
            ctx.fillStyle = vgrad(ctx, top, top + len, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0.25)']]);
            ctx.fillRect(x - wdt / 2, top, wdt, len);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(x - wdt / 2 - 2, top + 6, 1.5, len * 0.8);
            ctx.fillStyle = 'rgba(245,252,250,0.45)';
            ctx.beginPath();
            ctx.ellipse(x, top + len, wdt * 5, 10, 0, 0, TAU);
            ctx.fill();
          }
          band(ctx, TW, 450, 110, '#e1f1e8', 0.8);
          ctx.fillStyle = '#cfe6dc';
          ctx.fillRect(0, 505, TW, 135);
        },
      },
      {
        id: 'mid', speed: 0.25, y0: 330, y1: 640,
        paint(ctx, r) {
          const f = ridge(r, TW, [[3, 50], [7, 26], [13, 10]]);
          const fy = (x) => 520 - f(x);
          silhouette(ctx, TW, fy, 640, '#3f8466');
          bumpsAlong(ctx, fy, 0, TW, 12, 8, 17, '#3f8466', r, 'rgba(110,180,135,0.55)');
          // Emergent kapok trees
          for (let i = 0; i < 7; i++) {
            const x = r() * TW, s = 0.45 + r() * 0.25, seed = (r() * 1e9) | 0, top = fy(x) - 55 - r() * 40;
            wrap(TW, x, 80, (X) => canopyTree(ctx, X, fy(x) + 10, top, s, { trunk: '#2f6450', leaf: '#43906c', dark: '#326f55', light: 'rgba(130,200,150,0.6)' }, seed));
          }
          band(ctx, TW, 515, 60, '#d4ebe0', 0.45);
          const f2 = ridge(r, TW, [[4, 30], [9, 14]]);
          const fy2 = (x) => 575 - f2(x);
          silhouette(ctx, TW, fy2, 640, '#2e6c51');
          bumpsAlong(ctx, fy2, 0, TW, 10, 7, 14, '#2e6c51', r, 'rgba(90,160,115,0.5)');
          band(ctx, TW, 575, 60, '#c6e2d3', 0.4);
        },
      },
      {
        id: 'near', speed: 0.55, y0: 200, y1: 640,
        paint(ctx, r) {
          const cols = { trunk: '#1b4634', leaf: '#1f5a3f', dark: '#153d2c', light: 'rgba(60,140,95,0.55)', vine: '#16402c' };
          let x = 60;
          while (x < TW - 60) {
            const seed = (r() * 1e9) | 0;
            if (r() < 0.45) {
              const h = 190 + r() * 110, lean = (r() - 0.5) * 70;
              palm(ctx, x, 625, h, lean, '#2a4a33', '#1d5a3c', seed);
            } else {
              const s = 0.9 + r() * 0.5;
              canopyTree(ctx, x, 625, 300 + r() * 90, s, cols, seed);
            }
            x += 170 + r() * 150;
          }
          const f = ridge(r, TW, [[5, 14], [11, 8]]);
          const fy = (x2) => 605 - f(x2);
          silhouette(ctx, TW, fy, 640, '#17402d');
          bumpsAlong(ctx, fy, 0, TW, 16, 12, 24, '#17402d', r, 'rgba(50,120,80,0.45)');
          for (let i = 0; i < 14; i++) {
            const bx = r() * TW, lh = 40 + r() * 30, lean = (r() - 0.5) * 40;
            wrap(TW, bx, 60, (X) => broadLeaf(ctx, X, 632, lh, lean, '#1a4a33', 'rgba(90,160,110,0.4)'));
          }
        },
      },
      {
        id: 'ground', speed: 1, y0: 590, y1: 720, ground: true,
        paint(ctx, r) {
          groundBase(ctx, r, {
            top: '#3d4f26', bottom: '#141d10', edge: '#6c9a3a', bladeA: '#6fa03c', bladeB: '#4a7a2a', blade: 10,
            speckA: 'rgba(120,150,70,0.25)', speckB: 'rgba(10,20,5,0.35)',
          });
          stones(ctx, r, 22, '#56604d', 'rgba(110,160,60,0.75)');
          // Roots
          ctx.strokeStyle = 'rgba(40,30,15,0.6)';
          ctx.lineWidth = 2;
          for (let i = 0; i < 18; i++) {
            const x = r() * TW, y = GY + 10 + r() * 30;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + 20, y + 12, x + 45, y + 4 + r() * 20);
            ctx.stroke();
          }
        },
      },
      {
        id: 'fg', speed: 1.35, y0: 460, y1: 720, front: true,
        paint(ctx, r) {
          let x = 90;
          while (x < TW - 90) {
            const seed = (r() * 1e9) | 0;
            fern(ctx, x, 735, 150 + r() * 90, '#0a2517', seed);
            if (r() < 0.6) broadLeaf(ctx, x + 60, 730, 110 + r() * 50, 30 + r() * 30, '#0d2d1c', 'rgba(40,90,60,0.5)');
            x += 300 + r() * 220;
          }
        },
      },
      {
        id: 'fgTop', speed: 1.35, y0: 0, y1: 120, front: true,
        paint(ctx, r) {
          let x = 150;
          while (x < TW - 120) {
            const n = 3 + Math.floor(r() * 4);
            for (let i = 0; i < n; i++) {
              const vx = x + (r() - 0.5) * 70, len = 30 + r() * 75;
              ctx.strokeStyle = '#0b2618';
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              ctx.moveTo(vx, -5);
              ctx.quadraticCurveTo(vx + 8, len * 0.5, vx - 3, len);
              ctx.stroke();
              ctx.fillStyle = '#0c2a1a';
              for (let k = 10; k < len; k += 9) {
                ctx.beginPath();
                ctx.ellipse(vx + (k % 18 ? 4 : -4), k, 5, 2.4, k % 18 ? 0.6 : -0.6, 0, TAU);
                ctx.fill();
              }
            }
            ctx.fillStyle = '#0a2416';
            for (let i = 0; i < 9; i++) {
              ctx.beginPath();
              ctx.ellipse(x + (r() - 0.5) * 120, r() * 16, 16 + r() * 18, 8 + r() * 8, (r() - 0.5) * 0.8, 0, TAU);
              ctx.fill();
            }
            x += 480 + r() * 300;
          }
        },
      },
    ],
    fx: {
      init(s, w) {
        s.motes = [];
        for (let i = 0; i < 28; i++) s.motes.push({ x: Math.random() * w, y: 150 + Math.random() * 450, p: Math.random() * TAU, r: 0.8 + Math.random() * 1.6 });
      },
      update(s, dt, speed, w) {
        for (const m of s.motes) {
          m.x -= (speed * 0.7 + 8) * dt;
          m.p += dt * 1.6;
          m.y += Math.sin(m.p) * 10 * dt;
          if (m.x < -10) { m.x = w + 10; m.y = 150 + Math.random() * 450; }
        }
      },
      after: {
        mid(ctx, s, w, t) {
          // Sun shafts through the canopy
          ctx.save();
          for (let i = 0; i < 4; i++) {
            const x0 = w * (0.55 + i * 0.13);
            const a = 0.05 + 0.03 * Math.sin(t * 0.5 + i * 1.7);
            ctx.fillStyle = vgrad(ctx, 0, 620, [[0, `rgba(255,250,215,${a * 1.4})`], [1, 'rgba(255,250,215,0)']]);
            ctx.beginPath();
            ctx.moveTo(x0, 0);
            ctx.lineTo(x0 + 50 + i * 10, 0);
            ctx.lineTo(x0 - 160 + i * 10, 620);
            ctx.lineTo(x0 - 260, 620);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        },
      },
      front(ctx, s, w, t) {
        for (const m of s.motes) {
          const a = 0.35 + 0.35 * Math.sin(t * 3 + m.p * 2);
          ctx.fillStyle = `rgba(255,246,200,${a})`;
          circle(ctx, m.x, m.y, m.r);
        }
      },
    },
  };

  // ======================= SAVANNA RUN =======================
  ART.savanna = {
    sky(ctx, w) {
      ctx.fillStyle = vgrad(ctx, 0, GY, [[0, '#2a1850'], [0.3, '#7c2f5c'], [0.55, '#dd5f3a'], [0.78, '#ffab4c'], [1, '#ffd699']]);
      ctx.fillRect(0, 0, w, 720);
      const sx = w * 0.3, sy = 440;
      const g = ctx.createRadialGradient(sx, sy, 20, sx, sy, 420);
      g.addColorStop(0, 'rgba(255,236,170,0.8)');
      g.addColorStop(0.25, 'rgba(255,190,110,0.35)');
      g.addColorStop(1, 'rgba(255,160,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, 720);
      const d = ctx.createRadialGradient(sx, sy, 5, sx, sy, 62);
      d.addColorStop(0, '#fffbe8');
      d.addColorStop(0.7, '#ffe7a6');
      d.addColorStop(1, '#ffc56a');
      ctx.fillStyle = d;
      circle(ctx, sx, sy, 60);
    },
    layers: [
      {
        id: 'far', speed: 0.06, y0: 60, y1: 640,
        paint(ctx, r) {
          // Long lit cloud streaks
          for (let i = 0; i < 14; i++) {
            const x = r() * TW, y = 110 + r() * 230, wd = 120 + r() * 260, ht = 6 + r() * 14;
            wrap(TW, x, wd, (X) => {
              ctx.fillStyle = rgba('#ff9d6a', 0.35);
              ctx.beginPath();
              ctx.ellipse(X, y + ht * 0.4, wd, ht, 0, 0, TAU);
              ctx.fill();
              ctx.fillStyle = rgba('#ffd2a0', 0.4);
              ctx.beginPath();
              ctx.ellipse(X - wd * 0.1, y, wd * 0.8, ht * 0.7, 0, 0, TAU);
              ctx.fill();
            });
          }
          const hills = ridge(r, TW, [[4, 18], [9, 8]]);
          silhouette(ctx, TW, (x) => 505 - hills(x), 640, '#d99a7a');
          for (let i = 0; i < 6; i++) {
            const x = ((i + r() * 0.6) / 6) * TW, wd = 130 + r() * 170, h = 55 + r() * 60, seed = (r() * 1e9) | 0;
            wrap(TW, x, wd, (X) => mesa(ctx, X, 510, wd, h, '#c98770', '#e7a987', seed, false));
          }
          band(ctx, TW, 440, 110, '#ffc592', 0.55);
          for (let i = 0; i < 4; i++) {
            const x = ((i + 0.3 + r() * 0.4) / 4) * TW, wd = 180 + r() * 200, h = 90 + r() * 70, seed = (r() * 1e9) | 0;
            wrap(TW, x, wd, (X) => mesa(ctx, X, 540, wd, h, '#a25a4c', '#cf8466', seed, true));
          }
          band(ctx, TW, 500, 80, '#ffbf85', 0.5);
          ctx.fillStyle = '#d58a62';
          ctx.fillRect(0, 538, TW, 102);
        },
      },
      {
        id: 'mid', speed: 0.25, y0: 380, y1: 640,
        paint(ctx, r) {
          const f = ridge(r, TW, [[3, 22], [7, 10]]);
          const fy = (x) => 565 - f(x);
          silhouette(ctx, TW, fy, 640, vgrad(ctx, 530, 640, [[0, '#b8692f'], [1, '#8d4a20']]));
          for (let i = 0; i < 500; i++) {
            const x = r() * TW, y = fy(x) + 4 + r() * 70;
            ctx.fillStyle = r() < 0.6 ? 'rgba(235,160,80,0.35)' : 'rgba(90,40,15,0.25)';
            ctx.fillRect(x, y, 1, 3 + r() * 4);
          }
          for (let i = 0; i < 8; i++) {
            const x = r() * TW, s = 0.45 + r() * 0.4, seed = (r() * 1e9) | 0;
            wrap(TW, x, 70, (X) => acacia(ctx, X, fy(x) + 3, s, '#4d2715', seed));
          }
          for (let i = 0; i < 3; i++) {
            const x = r() * TW, s = 0.55 + r() * 0.15;
            wrap(TW, x, 40, (X) => giraffe(ctx, X, fy(x) + 4, s, '#4d2715'));
          }
          band(ctx, TW, 590, 50, '#ffb56e', 0.3);
        },
      },
      {
        id: 'near', speed: 0.55, y0: 250, y1: 640,
        paint(ctx, r) {
          const f = ridge(r, TW, [[4, 16], [10, 6]]);
          const fy = (x) => 610 - f(x);
          let x = 100;
          let k = 0;
          while (x < TW - 100) {
            const seed = (r() * 1e9) | 0;
            if (k % 3 === 1) baobab(ctx, x, fy(x) + 6, 1.1 + r() * 0.4, '#3a1c0d');
            else acacia(ctx, x, fy(x) + 6, 1.3 + r() * 0.6, '#321709', seed);
            x += 280 + r() * 200;
            k++;
          }
          silhouette(ctx, TW, fy, 640, '#6d3617');
          for (let i = 0; i < 26; i++) {
            const bx = r() * TW, seed = (r() * 1e9) | 0;
            wrap(TW, bx, 40, (X) => grassTuft(ctx, X, fy(bx) + 6, 26 + r() * 20, 14, '#8a4a1c', 0.1, seed));
          }
          for (let i = 0; i < 9; i++) {
            const bx = r() * TW, seed = (r() * 1e9) | 0;
            ctx.fillStyle = '#3d1f0e';
            wrap(TW, bx, 40, (X) => {
              const rr = rng(seed);
              for (let j = 0; j < 6; j++) circle(ctx, X + (rr() - 0.5) * 40, fy(bx) - rr() * 12, 8 + rr() * 9);
            });
          }
        },
      },
      {
        id: 'ground', speed: 1, y0: 590, y1: 720, ground: true,
        paint(ctx, r) {
          groundBase(ctx, r, {
            top: '#b27a36', bottom: '#4f2c10', edge: '#e2ac55', bladeA: '#e0a94d', bladeB: '#a8732c', blade: 12,
            speckA: 'rgba(250,210,140,0.3)', speckB: 'rgba(60,30,10,0.35)',
          });
          stones(ctx, r, 16, '#8a5a34', 'rgba(230,180,120,0.5)');
          // Dry cracks
          ctx.strokeStyle = 'rgba(70,35,12,0.45)';
          ctx.lineWidth = 1;
          for (let i = 0; i < 26; i++) {
            let x = r() * TW, y = GY + 20 + r() * 60;
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let j = 0; j < 4; j++) {
              x += 6 + r() * 10;
              y += (r() - 0.5) * 8;
              ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        },
      },
      {
        id: 'fg', speed: 1.35, y0: 470, y1: 720, front: true,
        paint(ctx, r) {
          let x = 80;
          while (x < TW - 80) {
            const seed = (r() * 1e9) | 0;
            grassTuft(ctx, x, 728, 150 + r() * 70, 34, '#2a1406', -0.15 + r() * 0.1, seed);
            // seed heads
            ctx.fillStyle = '#3a1d09';
            for (let i = 0; i < 5; i++) {
              const hx = x + (r() - 0.5) * 50, hy = 728 - 150 - r() * 60;
              ctx.beginPath();
              ctx.ellipse(hx, hy, 2.5, 9, (r() - 0.5) * 0.5, 0, TAU);
              ctx.fill();
            }
            if (r() < 0.5) {
              ctx.fillStyle = '#1e0e04';
              ctx.beginPath();
              ctx.ellipse(x + 70, 722, 46, 24, 0, Math.PI, TAU);
              ctx.fill();
            }
            x += 240 + r() * 220;
          }
        },
      },
    ],
    fx: {
      init(s, w) {
        s.motes = [];
        for (let i = 0; i < 34; i++) s.motes.push({ x: Math.random() * w, y: 200 + Math.random() * 430, p: Math.random() * TAU, r: 0.8 + Math.random() * 1.8 });
      },
      update(s, dt, speed, w) {
        for (const m of s.motes) {
          m.x -= (speed * 0.9 + 25) * dt;
          m.p += dt;
          m.y += Math.sin(m.p) * 6 * dt;
          if (m.x < -10) { m.x = w + 10; m.y = 200 + Math.random() * 430; }
        }
      },
      front(ctx, s) {
        ctx.fillStyle = 'rgba(255,225,170,0.35)';
        for (const m of s.motes) circle(ctx, m.x, m.y, m.r);
      },
    },
  };

  // ======================= STORM FLIGHT =======================
  ART.storm = {
    sky(ctx, w) {
      ctx.fillStyle = vgrad(ctx, 0, GY, [[0, '#060911'], [0.4, '#141d2e'], [0.75, '#29364a'], [1, '#3b485b']]);
      ctx.fillRect(0, 0, w, 720);
      const g = ctx.createRadialGradient(w * 0.7, 160, 10, w * 0.7, 160, 300);
      g.addColorStop(0, 'rgba(120,145,185,0.22)');
      g.addColorStop(1, 'rgba(120,145,185,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, 500);
    },
    layers: [
      {
        id: 'far', speed: 0.05, y0: 150, y1: 640,
        paint(ctx, r) {
          const back = ridge(r, TW, [[3, 150], [7, 70], [17, 25]], true);
          silhouette(ctx, TW, (x) => 520 - back(x), 640, vgrad(ctx, 250, 540, [[0, '#2a3548'], [1, '#3e4b60']]));
          // Rain curtains
          for (let i = 0; i < 10; i++) {
            const x = r() * TW, wd = 40 + r() * 90;
            wrap(TW, x, wd + 80, (X) => {
              ctx.fillStyle = 'rgba(150,170,200,0.06)';
              ctx.beginPath();
              ctx.moveTo(X, 150);
              ctx.lineTo(X + wd, 150);
              ctx.lineTo(X + wd - 70, 560);
              ctx.lineTo(X - 70, 560);
              ctx.fill();
            });
          }
          band(ctx, TW, 420, 110, '#4a5a70', 0.5);
          const front = ridge(r, TW, [[4, 110], [9, 45], [21, 14]], true);
          const fy = (x) => 555 - front(x);
          silhouette(ctx, TW, fy, 640, vgrad(ctx, 350, 560, [[0, '#1d2737'], [1, '#2f3b4e']]));
          for (let i = 0; i < 200; i++) {
            const x = r() * TW, y0 = fy(x) + 3;
            ctx.fillStyle = 'rgba(140,160,190,0.08)';
            ctx.fillRect(x, y0, 1.2, 8 + r() * 40);
          }
          band(ctx, TW, 500, 90, '#4f5f75', 0.45);
          ctx.fillStyle = '#34425a';
          ctx.fillRect(0, 560, TW, 80);
        },
      },
      {
        id: 'clouds', speed: 0.14, y0: 0, y1: 300,
        paint(ctx, r) {
          const f = ridge(r, TW, [[3, 40], [7, 25], [15, 10]]);
          const fy = (x) => 120 + f(x);
          silhouette(ctx, TW, fy, -10, vgrad(ctx, 0, 220, [[0, '#0b1019'], [1, '#1a2333']]));
          const bumps = [];
          for (let x = 0; x < TW; x += 18 + r() * 22) bumps.push([x, fy(x), 16 + r() * 30]);
          ctx.fillStyle = '#121a27';
          for (const b of bumps) wrap(TW, b[0], b[2], (X) => circle(ctx, X, b[1] + 4, b[2]));
          ctx.fillStyle = '#1c2637';
          for (const b of bumps) wrap(TW, b[0], b[2], (X) => circle(ctx, X - 4, b[1] - 2, b[2] * 0.8));
          ctx.fillStyle = 'rgba(90,110,140,0.18)';
          for (const b of bumps) wrap(TW, b[0], b[2], (X) => circle(ctx, X - b[2] * 0.3, b[1] - b[2] * 0.45, b[2] * 0.4));
          // Scud fragments
          for (let i = 0; i < 12; i++) {
            const x = r() * TW, y = 190 + r() * 80, s = 0.4 + r() * 0.5, seed = (r() * 1e9) | 0;
            wrap(TW, x, 120, (X) => cloud(ctx, X, y, s, '#1f2939', 0.9, seed));
          }
        },
      },
      {
        id: 'mid', speed: 0.25, y0: 360, y1: 640,
        paint(ctx, r) {
          const f = ridge(r, TW, [[3, 40], [8, 16]]);
          const fy = (x) => 560 - f(x);
          for (let x = 0; x < TW; x += 9 + r() * 8) {
            const h = 34 + r() * 36, seed = (r() * 1e9) | 0;
            wrap(TW, x, 20, (X) => conifer(ctx, X, fy(x) + 12, h, '#151e2b', 4, seed));
          }
          silhouette(ctx, TW, fy, 640, '#151e2b');
          band(ctx, TW, 575, 65, '#3d4c62', 0.4);
        },
      },
      {
        id: 'near', speed: 0.55, y0: 220, y1: 640,
        paint(ctx, r) {
          const f = ridge(r, TW, [[4, 14], [11, 6]]);
          const fy = (x) => 612 - f(x);
          let x = 60;
          while (x < TW - 60) {
            const seed = (r() * 1e9) | 0;
            if (r() < 0.25) deadTree(ctx, x, fy(x) + 6, 200 + r() * 90, '#0e141d', seed);
            else {
              const h = 170 + r() * 170;
              conifer(ctx, x, fy(x) + 8, h, '#0b1119', 6, seed);
              if (r() < 0.6) conifer(ctx, x + 26 + r() * 20, fy(x) + 8, h * 0.6, '#0d141d', 5, seed + 1);
            }
            x += 110 + r() * 170;
          }
          silhouette(ctx, TW, fy, 640, '#0d131c');
          for (let i = 0; i < 12; i++) {
            const bx = r() * TW, rw = 14 + r() * 26;
            wrap(TW, bx, rw, (X) => {
              ctx.fillStyle = '#10161f';
              ctx.beginPath();
              ctx.ellipse(X, fy(bx) + 4, rw, rw * 0.55, 0, Math.PI, TAU);
              ctx.fill();
              ctx.fillStyle = 'rgba(90,110,140,0.2)';
              ctx.fillRect(X - rw * 0.6, fy(bx) + 4 - rw * 0.5, rw * 0.7, 1.5);
            });
          }
        },
      },
      {
        id: 'ground', speed: 1, y0: 590, y1: 720, ground: true,
        paint(ctx, r) {
          groundBase(ctx, r, {
            top: '#2a3340', bottom: '#0b0f15', edge: '#4c5b70', bladeA: '#2c3a2e', bladeB: '#1c2620', blade: 8,
            speckA: 'rgba(120,140,170,0.2)', speckB: 'rgba(0,0,0,0.4)',
          });
          // Puddles with sky reflection
          for (let i = 0; i < 12; i++) {
            const x = r() * TW, y = GY + 25 + r() * 55, rw = 20 + r() * 40;
            wrap(TW, x, rw, (X) => {
              ctx.fillStyle = 'rgba(70,90,120,0.55)';
              ctx.beginPath();
              ctx.ellipse(X, y, rw, rw * 0.16, 0, 0, TAU);
              ctx.fill();
              ctx.fillStyle = 'rgba(160,185,220,0.35)';
              ctx.fillRect(X - rw * 0.6, y - 1, rw * 0.9, 1.2);
            });
          }
          stones(ctx, r, 18, '#1d252f', 'rgba(110,130,160,0.3)');
        },
      },
      {
        id: 'fg', speed: 1.35, y0: 470, y1: 720, front: true,
        paint(ctx, r) {
          let x = 70;
          while (x < TW - 70) {
            const seed = (r() * 1e9) | 0;
            grassTuft(ctx, x, 728, 110 + r() * 90, 26, '#04070b', -0.35, seed);
            if (r() < 0.55) {
              ctx.fillStyle = '#05080c';
              ctx.beginPath();
              ctx.moveTo(x + 30, 725);
              ctx.lineTo(x + 45, 670 - r() * 30);
              ctx.lineTo(x + 80, 655 - r() * 20);
              ctx.lineTo(x + 115, 690);
              ctx.lineTo(x + 125, 725);
              ctx.fill();
            }
            x += 220 + r() * 230;
          }
        },
      },
    ],
    fx: {
      init(s, w) {
        s.drops = [];
        for (let i = 0; i < 190; i++) s.drops.push({ x: Math.random() * (w + 200), y: Math.random() * 720, z: 0.25 + Math.random() * 0.75 });
        s.splash = [];
        s.flash = 0;
        s.bolt = null;
        s.boltLife = 0;
        s.nextBolt = 2.5 + Math.random() * 3;
        s.thunderQueued = false;
      },
      update(s, dt, speed, w, onThunder) {
        for (const d of s.drops) {
          d.y += (620 + d.z * 820) * dt;
          d.x -= (160 + d.z * 190 + speed * 0.4) * dt;
          if (d.y > GY + 6 + (1 - d.z) * 40) {
            if (d.z > 0.7 && s.splash.length < 40) s.splash.push({ x: d.x, y: GY + 4 + (1 - d.z) * 30, t: 0 });
            d.y = -20 - Math.random() * 120;
            d.x = Math.random() * (w + 260);
          }
        }
        for (const p of s.splash) { p.t += dt; p.x -= speed * dt; }
        s.splash = s.splash.filter((p) => p.t < 0.22);
        s.flash = Math.max(0, s.flash - dt * 2.2);
        s.boltLife = Math.max(0, s.boltLife - dt);
        s.nextBolt -= dt;
        if (s.nextBolt <= 0) {
          s.nextBolt = 3.5 + Math.random() * 5.5;
          s.flash = 1;
          s.boltLife = 0.38;
          s.bolt = makeBolt(w);
          if (onThunder) onThunder(0.15 + Math.random() * 0.8);
        }
      },
      after: {
        far(ctx, s, w) {
          if (s.boltLife <= 0 || !s.bolt) return;
          const a = Math.min(1, s.boltLife / 0.2) * (Math.random() < 0.2 ? 0.4 : 1);
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (const seg of s.bolt) {
            ctx.strokeStyle = `rgba(170,200,255,${0.35 * a})`;
            ctx.lineWidth = seg.w * 4;
            ctx.beginPath();
            seg.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
            ctx.stroke();
            ctx.strokeStyle = `rgba(245,250,255,${a})`;
            ctx.lineWidth = seg.w;
            ctx.stroke();
          }
          ctx.restore();
        },
      },
      front(ctx, s, w) {
        // Rain in three depth buckets
        const buckets = [[0.25, 0.5], [0.5, 0.75], [0.75, 1.01]];
        for (const [lo, hi] of buckets) {
          const z = (lo + hi) / 2;
          ctx.strokeStyle = `rgba(175,200,235,${0.18 + z * 0.4})`;
          ctx.lineWidth = 0.6 + z * 1.1;
          ctx.beginPath();
          for (const d of s.drops) {
            if (d.z < lo || d.z >= hi) continue;
            const len = 10 + d.z * 18;
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x + len * 0.28, d.y - len);
          }
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(190,210,240,0.55)';
        ctx.lineWidth = 1;
        for (const p of s.splash) {
          const k = p.t / 0.22;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 3 + k * 7, 1 + k * 2, 0, Math.PI, TAU);
          ctx.stroke();
        }
        if (s.flash > 0) {
          const flick = s.flash > 0.6 ? s.flash : s.flash * (0.6 + 0.4 * Math.sin(s.flash * 40));
          ctx.fillStyle = `rgba(215,228,255,${clamp(flick, 0, 1) * 0.42})`;
          ctx.fillRect(0, 0, w, 720);
        }
      },
    },
  };

  function makeBolt(w) {
    const segs = [];
    function grow(x, y, len, wdt, depth) {
      const pts = [[x, y]];
      let cx = x, cy = y;
      const steps = 8 + Math.floor(Math.random() * 6);
      for (let i = 0; i < steps; i++) {
        cx += (Math.random() - 0.5) * 38;
        cy += len / steps;
        pts.push([cx, cy]);
        if (depth > 0 && Math.random() < 0.18) grow(cx, cy, len * 0.4, wdt * 0.55, depth - 1);
      }
      segs.push({ pts, w: wdt });
    }
    grow(w * (0.25 + Math.random() * 0.65), 90, 300 + Math.random() * 140, 2.6, 2);
    return segs;
  }

  // ------------------------------------------------------------------
  // Scenery manager: tile cache, scrolling, drawing
  // ------------------------------------------------------------------
  class Scenery {
    constructor() {
      this.cache = new Map(); // routeId -> tiles (LRU of 2)
      this.scale = 1;
      this.routeId = null;
      this.offsets = {};
      this.fxState = {};
      this.t = 0;
      this.w = 800;
    }

    setScale(scale) {
      if (Math.abs(scale - this.scale) > 0.01) {
        this.scale = scale;
        this.cache.clear();
      }
    }

    setWidth(w) {
      this.w = w;
      if (this.routeId) ART[this.routeId].fx.init(this.fxState, w);
    }

    _build(id) {
      if (this.cache.has(id)) {
        const v = this.cache.get(id);
        this.cache.delete(id);
        this.cache.set(id, v);
        return v;
      }
      const art = ART[id];
      const r = rng(FG.ROUTES[id].seed);
      const s = this.scale;
      const tiles = art.layers.map((def) => {
        const c = document.createElement('canvas');
        c.width = Math.ceil(TW * s);
        c.height = Math.ceil((def.y1 - def.y0) * s);
        const ctx = c.getContext('2d');
        ctx.setTransform(s, 0, 0, s, 0, -def.y0 * s);
        def.paint(ctx, rng((r() * 1e9) | 0));
        return { def, canvas: c };
      });
      this.cache.set(id, tiles);
      while (this.cache.size > 2) this.cache.delete(this.cache.keys().next().value);
      return tiles;
    }

    setRoute(id) {
      if (this.routeId === id) return;
      this.routeId = id;
      this.tiles = this._build(id);
      this.fxState = {};
      ART[id].fx.init(this.fxState, this.w);
    }

    update(dt, worldSpeed, onThunder) {
      this.t += dt;
      if (!this.tiles) return;
      for (const { def } of this.tiles) {
        this.offsets[def.id] = ((this.offsets[def.id] || 0) + def.speed * worldSpeed * dt) % TW;
      }
      ART[this.routeId].fx.update(this.fxState, dt, worldSpeed, this.w, onThunder);
    }

    _drawTile(ctx, tile) {
      const { def, canvas } = tile;
      const s = this.scale;
      const off = this.offsets[def.id] || 0;
      let x = Math.round(-off * s) / s;
      const h = def.y1 - def.y0;
      while (x < this.w) {
        ctx.drawImage(canvas, x, def.y0, TW, h);
        x += TW;
      }
    }

    drawBack(ctx) {
      const art = ART[this.routeId];
      art.sky(ctx, this.w);
      for (const tile of this.tiles) {
        if (tile.def.front || tile.def.ground) continue;
        this._drawTile(ctx, tile);
        const after = art.fx.after && art.fx.after[tile.def.id];
        if (after) after(ctx, this.fxState, this.w, this.t);
      }
    }

    drawGround(ctx) {
      for (const tile of this.tiles) if (tile.def.ground) this._drawTile(ctx, tile);
    }

    drawFront(ctx) {
      for (const tile of this.tiles) if (tile.def.front) this._drawTile(ctx, tile);
      ART[this.routeId].fx.front(ctx, this.fxState, this.w, this.t);
      // Cinematic vignette
      if (!this._vig || this._vigW !== this.w) {
        this._vigW = this.w;
        const g = ctx.createRadialGradient(this.w / 2, 360, 200, this.w / 2, 360, Math.max(this.w, 720) * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.38)');
        this._vig = g;
      }
      ctx.fillStyle = this._vig;
      ctx.fillRect(0, 0, this.w, 720);
    }

    /** Static thumbnail for menu route cards (painted directly, no tile cache). */
    static renderPreview(id, canvas, drawExtras) {
      const ctx = canvas.getContext('2d');
      const art = ART[id];
      const viewW = 900;
      const k = canvas.width / viewW;
      const viewY0 = 720 - canvas.height / k; // bottom-aligned window
      ctx.setTransform(k, 0, 0, k, 0, -viewY0 * k);
      art.sky(ctx, viewW);
      const r = rng(FG.ROUTES[id].seed);
      const painted = art.layers.map((def) => ({ def, seed: (r() * 1e9) | 0 }));
      const paint = (pred) => {
        for (const { def, seed } of painted) {
          if (!pred(def)) continue;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, def.y0, viewW, def.y1 - def.y0);
          ctx.clip();
          def.paint(ctx, rng(seed));
          ctx.restore();
        }
      };
      paint((d) => !d.front && !d.ground);
      if (drawExtras) drawExtras(ctx, viewW);
      paint((d) => d.ground);
      paint((d) => d.front && d.id !== 'fgTop');
    }
  }

  FG.Scenery = Scenery;
})();
