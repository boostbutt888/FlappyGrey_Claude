/* Flappy Grey — the African Grey parrot.
 * Identity (non-negotiable): grey scalloped plumage, pale/white bare face patch,
 * pale iris, black hooked beak, bright scarlet tail. Drawn facing right,
 * origin at body centre, ~64 px from tail tip to beak at scale 1.
 * Wing animation: a flap drives a down-stroke; falling fast raises the wings. */
(function () {
  'use strict';
  const FG = (window.FG = window.FG || {});

  const C = {
    bodyLight: '#c2c7cd',
    body: '#9aa0a8',
    bodyDark: '#646a73',
    head: '#d3d7db',
    face: '#f4f3ef',
    wing: '#858b94',
    wingDark: '#4b5058',
    primaries: '#2c3036',
    tail: '#e0232e',
    tailDark: '#9e1119',
    beak: '#17181a',
  };

  function drawTail(ctx) {
    // Fanned scarlet tail feathers
    const g = ctx.createLinearGradient(-18, 0, -42, 0);
    g.addColorStop(0, C.tailDark);
    g.addColorStop(0.35, C.tail);
    g.addColorStop(1, '#f2434b');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-16, 3);
    ctx.quadraticCurveTo(-28, 0, -40, 2);
    ctx.lineTo(-43, 8);
    ctx.lineTo(-40, 14);
    ctx.quadraticCurveTo(-28, 15, -16, 12);
    ctx.closePath();
    ctx.fill();
    // Feather separations
    ctx.strokeStyle = 'rgba(110,8,14,0.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-20, 6); ctx.lineTo(-41, 5.5);
    ctx.moveTo(-20, 9); ctx.lineTo(-42, 9.5);
    ctx.moveTo(-20, 11); ctx.lineTo(-39, 12.5);
    ctx.stroke();
    // Grey under-tail coverts where tail meets body
    ctx.fillStyle = C.bodyDark;
    ctx.beginPath();
    ctx.ellipse(-17, 8, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function wingPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(5, -3);
    ctx.bezierCurveTo(-5, -11, -22, -10, -35, -4);
    ctx.lineTo(-44, 1);
    ctx.lineTo(-37, 3);
    ctx.bezierCurveTo(-26, 9, -10, 11, 5, 6);
    ctx.closePath();
  }

  /** angle > 0 raises the wing tip (canvas rotation is clockwise). */
  function drawWing(ctx, angle, far) {
    ctx.save();
    ctx.translate(3, -3);
    ctx.rotate(angle);
    // Foreshortening: wing looks narrower when swept high or low
    ctx.scale(1, 0.75 + 0.25 * Math.cos(angle * 1.3));
    const g = ctx.createLinearGradient(5, 0, -44, 0);
    if (far) {
      g.addColorStop(0, '#5d626a');
      g.addColorStop(1, '#23262b');
    } else {
      g.addColorStop(0, C.wing);
      g.addColorStop(0.45, C.wingDark);
      g.addColorStop(0.7, C.primaries);
      g.addColorStop(1, '#1f2226');
    }
    wingPath(ctx);
    ctx.fillStyle = g;
    ctx.fill();
    if (!far) {
      ctx.save();
      wingPath(ctx);
      ctx.clip();
      // Covert scallops
      ctx.strokeStyle = 'rgba(225,230,236,0.35)';
      ctx.lineWidth = 0.9;
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 5 - row; i++) {
          const x = 1 - i * 5.2 - row * 3;
          const y = -5 + row * 3.6;
          ctx.beginPath();
          ctx.arc(x, y, 2.8, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
        }
      }
      // Primary feather lines
      ctx.strokeStyle = 'rgba(160,166,175,0.35)';
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(-18 - i * 1.5, -4 + i * 2.4);
        ctx.lineTo(-40 + i * 1.2, 0 + i * 0.8);
        ctx.stroke();
      }
      ctx.restore();
      // Leading-edge highlight
      ctx.strokeStyle = 'rgba(235,238,242,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(5, -3);
      ctx.bezierCurveTo(-5, -11, -22, -10, -35, -4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function bodyPath(ctx) {
    ctx.beginPath();
    ctx.ellipse(-2, 4, 21, 15, -0.12, 0, Math.PI * 2);
  }

  function drawBody(ctx) {
    const g = ctx.createRadialGradient(-2, -6, 3, -2, 6, 26);
    g.addColorStop(0, C.bodyLight);
    g.addColorStop(0.55, C.body);
    g.addColorStop(1, C.bodyDark);
    bodyPath(ctx);
    ctx.fillStyle = g;
    ctx.fill();
    // Scalloped feather texture (defining African Grey look)
    ctx.save();
    bodyPath(ctx);
    ctx.clip();
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 9; col++) {
        const x = -20 + col * 5 + (row % 2) * 2.5;
        const y = -8 + row * 4.2;
        ctx.strokeStyle = 'rgba(236,240,244,0.28)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(x, y, 2.9, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(40,44,50,0.18)';
        ctx.beginPath();
        ctx.arc(x, y + 0.9, 2.9, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    }
    // Belly shading
    const sh = ctx.createLinearGradient(0, 4, 0, 20);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(30,34,40,0.35)');
    ctx.fillStyle = sh;
    ctx.fillRect(-25, 4, 50, 18);
    ctx.restore();
  }

  function drawHead(ctx) {
    const g = ctx.createRadialGradient(12, -15, 2, 15, -8, 14);
    g.addColorStop(0, '#e2e5e8');
    g.addColorStop(0.6, C.head);
    g.addColorStop(1, '#a4aab1');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(15, -8, 12.5, 0, Math.PI * 2);
    ctx.fill();
    // Fine head scallops
    ctx.save();
    ctx.beginPath();
    ctx.arc(15, -8, 12.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(120,126,134,0.35)';
    ctx.lineWidth = 0.6;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        const x = 5 + col * 4 + (row % 2) * 2;
        const y = -18 + row * 3.4;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    }
    ctx.restore();
    // Pale bare facial patch around the eye (lores to cheek)
    ctx.fillStyle = C.face;
    ctx.beginPath();
    ctx.ellipse(20, -8.5, 7.2, 5.6, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,165,170,0.5)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    // Eye: pale straw iris, black pupil, catch-light
    ctx.fillStyle = '#efe6c4';
    ctx.beginPath();
    ctx.arc(20, -9, 2.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6f7378';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.fillStyle = '#0b0b0c';
    ctx.beginPath();
    ctx.arc(20.4, -9, 1.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(19.7, -9.8, 0.65, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBeak(ctx) {
    // Upper mandible: strongly hooked, black
    ctx.fillStyle = C.beak;
    ctx.beginPath();
    ctx.moveTo(24.5, -13);
    ctx.bezierCurveTo(30, -14.5, 35.5, -9, 34.2, -1.5);
    ctx.quadraticCurveTo(33.6, 2.2, 31.2, 2.8);
    ctx.quadraticCurveTo(32, -1.5, 29.5, -3);
    ctx.quadraticCurveTo(27, -4.2, 25, -3.2);
    ctx.closePath();
    ctx.fill();
    // Sheen
    ctx.strokeStyle = 'rgba(140,145,150,0.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(26, -12);
    ctx.quadraticCurveTo(31.5, -11.5, 33, -5);
    ctx.stroke();
    // Lower mandible
    ctx.fillStyle = '#26282b';
    ctx.beginPath();
    ctx.moveTo(25, -3);
    ctx.quadraticCurveTo(29, -2.8, 30, 0.5);
    ctx.quadraticCurveTo(28, 3.2, 24.5, 2.2);
    ctx.closePath();
    ctx.fill();
    // Cere / nostril
    ctx.fillStyle = '#3a3d41';
    ctx.beginPath();
    ctx.arc(25.6, -11.3, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFeet(ctx) {
    ctx.strokeStyle = '#3b3e43';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2, 17); ctx.lineTo(-3, 20);
    ctx.moveTo(5, 17); ctx.lineTo(0, 21);
    ctx.stroke();
  }

  /**
   * Draw the parrot.
   * @param rot body rotation (radians, + = nose down)
   * @param wing wing angle (+ raised, − lowered)
   */
  function draw(ctx, x, y, rot, wing, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (scale && scale !== 1) ctx.scale(scale, scale);
    // Soft drop shadow for separation from busy backgrounds
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    drawWing(ctx, wing * 0.85 + 0.12, true); // far wing, behind body
    ctx.shadowColor = 'transparent';
    drawTail(ctx);
    drawFeet(ctx);
    drawBody(ctx);
    drawHead(ctx);
    drawBeak(ctx);
    drawWing(ctx, wing, false);
    ctx.restore();
  }

  /** Wing pose from time since last flap and vertical velocity. */
  function wingPose(sinceFlap, vy) {
    const DOWN = 0.2, UP = 0.16;
    if (sinceFlap < DOWN) {
      const k = sinceFlap / DOWN;
      return FG.util.lerp(1.05, -0.75, k * k * (3 - 2 * k)); // fast down-stroke
    }
    if (sinceFlap < DOWN + UP) {
      const k = (sinceFlap - DOWN) / UP;
      return FG.util.lerp(-0.75, 0.25, k);
    }
    // Glide / parachute: wings rise as the bird falls faster
    const fall = FG.util.clamp(vy / 600, 0, 1);
    return 0.25 + fall * 0.55;
  }

  /** Continuous flapping (menu hero, countdown hover). */
  function hoverPose(t, rate) {
    return Math.sin(t * (rate || 11)) * 0.9 + 0.15;
  }

  FG.Bird = { draw, wingPose, hoverPose, COLORS: C };
})();
