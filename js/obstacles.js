/* Flappy Grey — biome-specific obstacles.
 *   Jungle: ancient moss-covered carved stone pillars with vines
 *   Savanna: layered sandstone hoodoos with caprock and dry grass
 *   Storm: wet basalt columns with jagged broken tops
 * Each pillar is painted once into a sprite (cap at y=0, shaft extending down) and
 * reused; top pillars are drawn vertically flipped. */
(function () {
  'use strict';
  const FG = (window.FG = window.FG || {});
  const { rng, mix, clamp } = FG.util;
  const O = FG.OBSTACLE;
  const GY = FG.WORLD.GROUND_Y;
  const L = 700; // sprite shaft length (covers the tallest possible pillar)
  const M = O.OVERHANG;
  const TAU = Math.PI * 2;
  const SX = (O.CAP_W - O.SHAFT_W) / 2;

  function sideShade(ctx, x, w, y, h, light, dark) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, light);
    g.addColorStop(0.35, 'rgba(0,0,0,0)');
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }

  function capShade(ctx, top) {
    const g = ctx.createLinearGradient(0, 0, 0, O.CAP_H);
    if (top) {
      g.addColorStop(0, 'rgba(0,0,0,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(0.3, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.25)');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, O.CAP_W, O.CAP_H);
  }

  const PAINT = {
    jungle(ctx, r, top) {
      const CW = O.CAP_W, SW = O.SHAFT_W, CH = O.CAP_H;
      // Shaft of stacked carved blocks
      let y = CH;
      let row = 0;
      while (y < L) {
        const bh = 42 + r() * 26;
        ctx.fillStyle = mix('#76816d', '#59634f', r());
        ctx.fillRect(SX, y, SW, bh);
        // Vertical joint
        const jx = SX + SW * (row % 2 ? 0.35 : 0.65) + (r() - 0.5) * 8;
        ctx.fillStyle = 'rgba(25,30,22,0.55)';
        ctx.fillRect(jx, y, 2, bh);
        ctx.fillStyle = 'rgba(200,210,190,0.18)';
        ctx.fillRect(jx + 2, y, 1, bh);
        // Mortar line
        ctx.fillStyle = 'rgba(20,25,18,0.7)';
        ctx.fillRect(SX, y, SW, 2.5);
        ctx.fillStyle = 'rgba(210,220,200,0.2)';
        ctx.fillRect(SX, y + 2.5, SW, 1);
        // Carved glyph
        if (r() < 0.35) {
          const gx = SX + SW * (row % 2 ? 0.68 : 0.3), gy = y + bh / 2;
          ctx.lineWidth = 2;
          for (const [col, off] of [['rgba(215,225,205,0.25)', 1], ['rgba(25,30,22,0.6)', 0]]) {
            ctx.strokeStyle = col;
            ctx.beginPath();
            if (r() < 0.5) {
              for (let a = 0; a < 10; a += 0.3) {
                const rad = 1 + a * 1.1;
                const px = gx + Math.cos(a) * rad + off, py = gy + Math.sin(a) * rad + off;
                a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
              }
            } else {
              ctx.ellipse(gx + off, gy + off, 10, 6, 0, 0, TAU);
              ctx.moveTo(gx + 3 + off, gy + off);
              ctx.arc(gx + off, gy + off, 3, 0, TAU);
            }
            ctx.stroke();
          }
        }
        // Cracks
        if (r() < 0.5) {
          ctx.strokeStyle = 'rgba(25,30,22,0.5)';
          ctx.lineWidth = 1;
          let cx = SX + r() * SW, cy = y + 4;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          for (let i = 0; i < 4; i++) {
            cx += (r() - 0.5) * 12;
            cy += bh / 5;
            ctx.lineTo(clamp(cx, SX + 2, SX + SW - 2), cy);
          }
          ctx.stroke();
        }
        y += bh;
        row++;
      }
      sideShade(ctx, SX, SW, CH, L, 'rgba(230,240,215,0.22)', 'rgba(10,20,10,0.5)');
      // Moss patches clinging to the stone
      for (let i = 0; i < 70; i++) {
        const my = CH + Math.pow(r(), 1.8) * 420;
        const edge = r() < 0.55;
        const mx = edge ? (r() < 0.5 ? SX + r() * 10 : SX + SW - r() * 10) : SX + r() * SW;
        ctx.fillStyle = r() < 0.5 ? 'rgba(86,128,44,0.85)' : 'rgba(112,152,56,0.8)';
        ctx.beginPath();
        ctx.ellipse(mx, my, 3 + r() * 7, 2 + r() * 4, r() * 3, 0, TAU);
        ctx.fill();
      }
      // Vines
      for (let v = 0; v < 2; v++) {
        let vx = SX + 12 + r() * (SW - 24);
        const len = 120 + r() * 260;
        ctx.strokeStyle = '#2f5a1f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(vx, CH - 2);
        for (let yy = CH; yy < CH + len; yy += 12) {
          vx += (r() - 0.5) * 8;
          ctx.lineTo(clamp(vx, SX + 4, SX + SW - 4), yy);
        }
        ctx.stroke();
        ctx.fillStyle = '#4b8a2c';
        for (let yy = CH + 8; yy < CH + len; yy += 14) {
          ctx.beginPath();
          ctx.ellipse(clamp(vx + (r() - 0.5) * 30, SX + 4, SX + SW - 4), yy, 4, 2.2, r() * 3, 0, TAU);
          ctx.fill();
        }
      }
      // Cap slab
      ctx.fillStyle = '#7c8873';
      ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = 'rgba(25,30,22,0.6)';
      ctx.fillRect(0, CH - 3, CW, 3);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(25,30,22,0.35)';
        ctx.fillRect(10 + i * 30 + r() * 6, 8, 16, 2);
        ctx.fillRect(10 + i * 30 + r() * 6, 20, 16, 2);
      }
      capShade(ctx, top);
      sideShade(ctx, 0, CW, 0, CH, 'rgba(230,240,215,0.2)', 'rgba(10,20,10,0.45)');
      if (!top) {
        // Moss blanket on top with drips over the cap face
        ctx.fillStyle = '#5c8f2f';
        for (let x = 2; x < CW - 2; x += 5) {
          ctx.beginPath();
          ctx.ellipse(x, 1, 5, 3 + r() * 2, 0, 0, TAU);
          ctx.fill();
          if (r() < 0.35) {
            ctx.beginPath();
            ctx.ellipse(x, 4 + r() * 6, 2.2, 4 + r() * 6, 0, 0, TAU);
            ctx.fill();
          }
        }
        ctx.fillStyle = '#86b845';
        for (let x = 4; x < CW - 4; x += 7) {
          ctx.beginPath();
          ctx.ellipse(x, -1, 3, 1.6, 0, 0, TAU);
          ctx.fill();
        }
        // Small fern tuft
        ctx.strokeStyle = '#3f7a26';
        ctx.lineWidth = 1.6;
        const fx = 20 + r() * (CW - 40);
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI + 0.4 + (i / 5) * (Math.PI - 0.8);
          ctx.beginPath();
          ctx.moveTo(fx, 0);
          ctx.quadraticCurveTo(fx + Math.cos(a) * 10, -14, fx + Math.cos(a) * 18, -8 - r() * 10);
          ctx.stroke();
        }
      } else {
        // Hanging vines and moss beards under the lintel (hang into the gap once flipped)
        ctx.fillStyle = '#4f7f2a';
        for (let x = 3; x < CW - 3; x += 6) {
          ctx.beginPath();
          ctx.ellipse(x, 0, 3.5, 2 + r() * 3, 0, 0, TAU);
          ctx.fill();
        }
        for (let i = 0; i < 4; i++) {
          const vx = 8 + r() * (CW - 16), len = 10 + r() * (M - 12);
          ctx.strokeStyle = '#2f5a1f';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(vx, 0);
          ctx.quadraticCurveTo(vx + 4, -len * 0.5, vx - 1, -len);
          ctx.stroke();
          ctx.fillStyle = '#5b9a33';
          ctx.beginPath();
          ctx.ellipse(vx - 1, -len, 3, 2, 0.5, 0, TAU);
          ctx.fill();
        }
      }
    },

    savanna(ctx, r, top) {
      const CW = O.CAP_W, SW = O.SHAFT_W, CH = O.CAP_H;
      const pA = r() * TAU, pB = r() * TAU;
      const wobL = (y) => Math.sin(y * 0.035 + pA) * 3.5 + Math.sin(y * 0.11 + pB) * 1.5;
      const wobR = (y) => Math.sin(y * 0.03 + pB) * 3.5 + Math.sin(y * 0.09 + pA) * 1.5;
      const shaft = () => {
        ctx.beginPath();
        ctx.moveTo(SX + wobL(CH), CH);
        for (let y = CH; y <= L; y += 8) ctx.lineTo(SX + 3 + wobL(y), y);
        for (let y = L; y >= CH; y -= 8) ctx.lineTo(SX + SW - 3 - wobR(y), y);
        ctx.closePath();
      };
      shaft();
      ctx.fillStyle = '#b86a3c';
      ctx.fill();
      ctx.save();
      shaft();
      ctx.clip();
      const pal = ['#c97e47', '#a95c32', '#d6925b', '#b36638', '#9a522c', '#c27240'];
      let y = CH;
      while (y < L) {
        const bh = 10 + r() * 22;
        ctx.fillStyle = pal[Math.floor(r() * pal.length)];
        ctx.fillRect(0, y, CW, bh);
        ctx.fillStyle = 'rgba(255,225,180,0.18)';
        ctx.fillRect(0, y, CW, 1.2);
        y += bh;
      }
      // Erosion grooves
      for (let i = 0; i < 9; i++) {
        const gx = SX + 6 + r() * (SW - 12);
        ctx.fillStyle = 'rgba(90,40,15,0.25)';
        ctx.fillRect(gx, CH, 1.5, L);
        ctx.fillStyle = 'rgba(255,215,160,0.12)';
        ctx.fillRect(gx + 1.5, CH, 1, L);
      }
      sideShade(ctx, SX, SW, CH, L, 'rgba(255,225,170,0.3)', 'rgba(70,20,10,0.5)');
      ctx.restore();
      // Caprock (harder, darker, wider)
      ctx.beginPath();
      ctx.moveTo(2, CH);
      ctx.lineTo(0, 10);
      ctx.lineTo(4, 2);
      for (let x = 10; x < CW - 6; x += 10) ctx.lineTo(x, (r() - 0.5) * 3);
      ctx.lineTo(CW - 3, 3);
      ctx.lineTo(CW, 12);
      ctx.lineTo(CW - 2, CH);
      ctx.closePath();
      ctx.fillStyle = '#7e4627';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(40,15,5,0.25)';
      ctx.fillRect(0, 14, CW, 2);
      ctx.fillRect(0, 24, CW, 2);
      capShade(ctx, top);
      sideShade(ctx, 0, CW, 0, CH, 'rgba(255,215,160,0.25)', 'rgba(50,15,5,0.45)');
      ctx.restore();
      ctx.fillStyle = 'rgba(40,15,5,0.5)';
      ctx.fillRect(SX, CH, SW, 3);
      if (!top) {
        ctx.fillStyle = 'rgba(255,220,160,0.5)';
        ctx.fillRect(3, 0, CW - 6, 1.5);
        // Dry grass tufts
        for (let t = 0; t < 3; t++) {
          const tx = 10 + r() * (CW - 20);
          for (let i = 0; i < 9; i++) {
            const h = 8 + r() * 16, lean = (r() - 0.5) * 12;
            ctx.strokeStyle = r() < 0.5 ? '#e0ac50' : '#b98636';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(tx + (r() - 0.5) * 8, 1);
            ctx.quadraticCurveTo(tx + lean * 0.3, -h * 0.6, tx + lean, -h);
            ctx.stroke();
          }
        }
        ctx.fillStyle = '#6a3a1e';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.ellipse(8 + r() * (CW - 16), 0, 3 + r() * 3, 2, 0, Math.PI, TAU);
          ctx.fill();
        }
      } else {
        // Dangling dry roots
        ctx.strokeStyle = '#4a260f';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) {
          const rx = 6 + r() * (CW - 12), len = 6 + r() * (M - 10);
          ctx.beginPath();
          ctx.moveTo(rx, 0);
          ctx.quadraticCurveTo(rx + (r() - 0.5) * 10, -len * 0.5, rx + (r() - 0.5) * 8, -len);
          ctx.stroke();
        }
      }
    },

    storm(ctx, r, top) {
      const CW = O.CAP_W, SW = O.SHAFT_W, CH = O.CAP_H;
      const cols = 3, cw = SW / cols;
      const faces = ['#56627a', '#434d62', '#30384a'];
      for (let c = 0; c < cols; c++) {
        const x0 = SX + c * cw;
        ctx.fillStyle = faces[c];
        ctx.fillRect(x0, CH - 4, cw + 0.5, L);
        // Horizontal fractures
        let y = CH + r() * 30;
        while (y < L) {
          ctx.fillStyle = 'rgba(5,8,12,0.65)';
          ctx.fillRect(x0, y, cw, 2);
          ctx.fillStyle = 'rgba(140,160,190,0.18)';
          ctx.fillRect(x0, y + 2, cw, 1);
          y += 34 + r() * 40;
        }
        // Wet streaks
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = `rgba(160,185,220,${0.06 + r() * 0.12})`;
          ctx.fillRect(x0 + 3 + r() * (cw - 6), CH + r() * 200, 1.2, 60 + r() * 300);
        }
        // Column edge highlight
        ctx.fillStyle = 'rgba(150,172,205,0.6)';
        ctx.fillRect(x0, CH - 4, 1.4, L);
      }
      sideShade(ctx, SX, SW, CH, L, 'rgba(175,200,235,0.3)', 'rgba(0,0,0,0.4)');
      // Jagged broken cap
      ctx.beginPath();
      ctx.moveTo(0, CH);
      ctx.lineTo(0, 8);
      const n = 7;
      for (let i = 0; i <= n; i++) ctx.lineTo((i / n) * CW, (i % 2 ? 0 : 6) + (r() - 0.5) * 4);
      ctx.lineTo(CW, 8);
      ctx.lineTo(CW, CH);
      ctx.closePath();
      ctx.fillStyle = '#566278';
      ctx.fill();
      ctx.save();
      ctx.clip();
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = c % 2 ? 'rgba(0,0,0,0.18)' : 'rgba(150,170,200,0.08)';
        ctx.fillRect(c * (CW / 4), 0, CW / 4, CH);
      }
      capShade(ctx, top);
      sideShade(ctx, 0, CW, 0, CH, 'rgba(150,170,200,0.18)', 'rgba(0,0,0,0.45)');
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(SX, CH, SW, 3);
      if (!top) {
        ctx.strokeStyle = 'rgba(150,175,215,0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const px = (i / n) * CW, py = (i % 2 ? 0 : 6);
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
        ctx.fillStyle = '#1c2a22';
        for (let t = 0; t < 2; t++) {
          const tx = 12 + r() * (CW - 24);
          for (let i = 0; i < 7; i++) {
            ctx.beginPath();
            ctx.moveTo(tx - 1 + i * 2, 4);
            ctx.lineTo(tx - 6 + i * 2 - r() * 4, -6 - r() * 10);
            ctx.lineTo(tx + 1 + i * 2, 4);
            ctx.fill();
          }
        }
      } else {
        // Water drips
        ctx.fillStyle = 'rgba(170,195,230,0.7)';
        for (let i = 0; i < 6; i++) {
          const dx = 6 + r() * (CW - 12), len = 3 + r() * 10;
          ctx.fillRect(dx, -len, 1.2, len);
          ctx.beginPath();
          ctx.ellipse(dx + 0.6, -len - 1.5, 1.6, 2.2, 0, 0, TAU);
          ctx.fill();
        }
      }
    },
  };

  class Obstacles {
    constructor() {
      this.list = [];
      this.sprites = null;
      this.key = '';
    }

    build(routeId, scale) {
      const key = routeId + '@' + scale.toFixed(2);
      if (key === this.key) return;
      this.key = key;
      this.routeId = routeId;
      const base = rng(FG.ROUTES[routeId].seed * 7 + 13);
      const make = (top) => {
        const c = document.createElement('canvas');
        c.width = Math.ceil(O.CAP_W * scale);
        c.height = Math.ceil((M + L) * scale);
        const ctx = c.getContext('2d');
        ctx.setTransform(scale, 0, 0, scale, 0, M * scale);
        PAINT[routeId](ctx, rng((base() * 1e9) | 0), top);
        return c;
      };
      this.sprites = [];
      for (let i = 0; i < 3; i++) this.sprites.push({ top: make(true), bottom: make(false) });
    }

    reset() {
      this.list = [];
      this.lastGap = null;
    }

    update(dt, speed, w, cfg, gapSize) {
      for (const o of this.list) o.x -= speed * dt;
      this.list = this.list.filter((o) => o.x > -O.CAP_W - 20);
      const last = this.list[this.list.length - 1];
      if (!last || last.x < w - cfg.spacing) {
        const x = last ? last.x + cfg.spacing : w + 60;
        const lo = O.EDGE_MARGIN + gapSize / 2;
        const hi = GY - O.EDGE_MARGIN - gapSize / 2;
        let c;
        if (this.lastGap === null || this.lastGap === undefined) c = (lo + hi) / 2 + (Math.random() - 0.5) * 80;
        else c = this.lastGap + (Math.random() * 2 - 1) * cfg.shift;
        c = clamp(c, lo, hi);
        this.lastGap = c;
        this.list.push({ x, top: c - gapSize / 2, bot: c + gapSize / 2, scored: false, v: Math.floor(Math.random() * 3) });
      }
    }

    /** Returns the number of obstacles newly passed by birdX. */
    score(birdX) {
      let n = 0;
      for (const o of this.list) {
        if (!o.scored && o.x + O.CAP_W / 2 < birdX) {
          o.scored = true;
          n++;
        }
      }
      return n;
    }

    collides(cx, cy, rad) {
      const hit = (x, y, w, h) => {
        const nx = clamp(cx, x, x + w), ny = clamp(cy, y, y + h);
        const dx = cx - nx, dy = cy - ny;
        return dx * dx + dy * dy < rad * rad;
      };
      for (const o of this.list) {
        if (o.x > cx + 120 || o.x + O.CAP_W < cx - 120) continue;
        if (hit(o.x + SX, -200, O.SHAFT_W, o.top - O.CAP_H + 200)) return true;
        if (hit(o.x, o.top - O.CAP_H, O.CAP_W, O.CAP_H)) return true;
        if (hit(o.x, o.bot, O.CAP_W, O.CAP_H)) return true;
        if (hit(o.x + SX, o.bot + O.CAP_H, O.SHAFT_W, GY - o.bot)) return true;
      }
      return false;
    }

    draw(ctx) {
      if (!this.sprites) return;
      for (const o of this.list) {
        const sp = this.sprites[o.v];
        const x = Math.round(o.x * 2) / 2;
        // Soft contact shadow on the background for depth separation
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x + O.CAP_W - 2, 0, 8, o.top);
        ctx.fillRect(x + O.CAP_W - 2, o.bot, 8, GY - o.bot);
        ctx.drawImage(sp.bottom, x, o.bot - M, O.CAP_W, M + L);
        ctx.save();
        ctx.translate(x, o.top);
        ctx.scale(1, -1);
        ctx.drawImage(sp.top, 0, -M, O.CAP_W, M + L);
        ctx.restore();
      }
    }

    /** Paint a pillar pair directly (menu previews). */
    static drawStatic(ctx, routeId, x, top, bot) {
      const r = rng(FG.ROUTES[routeId].seed * 7 + 13);
      ctx.save();
      ctx.translate(x, bot);
      ctx.beginPath();
      ctx.rect(0, -M, O.CAP_W, GY - bot + M);
      ctx.clip();
      PAINT[routeId](ctx, rng((r() * 1e9) | 0), false);
      ctx.restore();
      ctx.save();
      ctx.translate(x, top);
      ctx.scale(1, -1);
      ctx.beginPath();
      ctx.rect(0, -M, O.CAP_W, top + M);
      ctx.clip();
      PAINT[routeId](ctx, rng((r() * 1e9) | 0), true);
      ctx.restore();
    }
  }

  FG.Obstacles = Obstacles;
})();
