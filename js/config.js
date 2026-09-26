/* Flappy Grey — game configuration: world size, routes and difficulty tuning. */
(function () {
  'use strict';
  const FG = (window.FG = window.FG || {});

  FG.VERSION = '0.6.2';

  FG.WORLD = {
    H: 720, // logical height; width adapts to screen aspect
    MIN_W: 320,
    MAX_W: 1400,
    GROUND_Y: 630,
    TILE_W: 1280, // parallax tile width (seamless)
    STEP: 1 / 120, // fixed physics timestep
    MAX_RENDER_SCALE: 2,
  };

  FG.OBSTACLE = {
    SHAFT_W: 78,
    CAP_W: 96,
    CAP_H: 34,
    OVERHANG: 34, // decorative space beyond the cap (moss, grass tufts, vines)
    EDGE_MARGIN: 70, // min distance of a gap from ceiling / ground
  };

  FG.BIRD = {
    RADIUS: 15, // forgiving circular hitbox
    MAX_FALL: 720,
  };

  /**
   * Routes. speed = px/s world scroll, gravity = px/s², flap = upward velocity,
   * gap = opening height, spacing = distance between obstacles,
   * shift = max vertical change between consecutive gaps (fairness),
   * ramp = extra speed fraction gained by 40 points (gentle difficulty curve).
   */
  FG.ROUTES = {
    jungle: {
      id: 'jungle',
      name: 'Jungle Dash',
      difficulty: 'Easy',
      level: 1,
      accent: '#5fd08a',
      tagline: 'Misty rainforest, waterfalls & ancient stone',
      speed: 165,
      gravity: 1450,
      flap: 455,
      gap: 200,
      spacing: 300,
      shift: 170,
      ramp: 0.12,
      seed: 1101,
    },
    savanna: {
      id: 'savanna',
      name: 'Savanna Run',
      difficulty: 'Medium',
      level: 2,
      accent: '#ffb347',
      tagline: 'Sunset plains, mesas & acacia',
      speed: 200,
      gravity: 1600,
      flap: 480,
      gap: 178,
      spacing: 280,
      shift: 200,
      ramp: 0.15,
      seed: 2202,
    },
    storm: {
      id: 'storm',
      name: 'Storm Flight',
      difficulty: 'Hard',
      level: 3,
      accent: '#7fb3ff',
      tagline: 'Rain, lightning & basalt peaks',
      speed: 238,
      gravity: 1780,
      flap: 505,
      gap: 160,
      spacing: 262,
      shift: 230,
      ramp: 0.18,
      seed: 3303,
    },
  };

  FG.ROUTE_ORDER = ['jungle', 'savanna', 'storm'];

  FG.MEDALS = [
    { min: 100, name: 'Platinum', cls: 'platinum' },
    { min: 50, name: 'Gold', cls: 'gold' },
    { min: 25, name: 'Silver', cls: 'silver' },
    { min: 10, name: 'Bronze', cls: 'bronze' },
  ];
})();
