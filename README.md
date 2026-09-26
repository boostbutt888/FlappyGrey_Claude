# Flappy Grey — v0.5.1

A flap-and-dodge browser arcade game starring an **African Grey parrot**: grey scalloped plumage, pale face, black hooked beak and a bright red tail.

**Stack:** HTML5 · CSS · vanilla JavaScript · Canvas 2D · Web Audio API. There is no build step and nothing to install.

## Run it
Open `index.html` in any modern browser. Double-clicking the file works, because the scripts are classic scripts rather than ES modules, so a local server isn't needed.

## Controls
| Action | Input |
|---|---|
| Flap | Space / ↑ / W · mouse click · tap |
| Pause / resume | P · Esc · ⏸ button (the game also pauses automatically when the tab or app goes to the background) |
| Sound on/off | M · speaker button |
| Quick-start a route | 1 / 2 / 3 on the menu |
| Retry / Routes (game over) | Space or Enter / Esc |

## Game loop
1. Choose a route on the start screen.
2. The countdown runs: GET READY → 3 → 2 → 1 → GO.
3. Physics and obstacles start at GO.
4. Passing an obstacle scores 1 point.
5. Hitting an obstacle, the ceiling or the ground ends the run.
6. The game-over screen shows your score, your best for that route (saved on the device) and a medal: Bronze at 10, Silver at 25, Gold at 50, Platinum at 100.
7. Retry replays the countdown. Routes returns to the menu, and the menu music starts again.

Resuming after a pause runs a short 3 → 2 → 1 → GO countdown before play continues.

## Routes
| Route | Difficulty | Speed | Gravity | Gap | Look |
|---|---|---|---|---|---|
| Jungle Dash | Easy | 165 | 1450 | 200 | Misty rainforest, waterfalls, sun shafts, moss-covered carved stone pillars |
| Savanna Run | Medium | 200 | 1600 | 178 | Sunset, mesas, acacia, baobab, giraffes, sandstone hoodoos |
| Storm Flight | Hard | 238 | 1780 | 160 | Storm clouds, rain, lightning with thunder, conifers, wet basalt columns |

Speed rises gently with your score: up to +12% on Jungle Dash, +15% on Savanna Run and +18% on Storm Flight, reached at 40 points. All tuning values are in `js/config.js`.

## Parallax
Every route has at least five independently scrolling planes. Each plane is painted once into a seamless tile, so scrolling stays cheap.

| Plane | Speed | Treatment |
|---|---|---|
| Far | 0.05–0.08× | Hazy, desaturated, low contrast: clouds and distant mountains or mesas |
| Mid | 0.25× | Stronger colour: forest ridges, plains, acacia, conifers |
| Near | 0.55× | Darker and richer: large trees, palms, baobab, dead trees |
| Ground | 1.0× | Locked to obstacle speed |
| Foreground | 1.35× | Near-black silhouettes (ferns, tall grass, rocks) drawn in front of the bird |

Effects drawn every frame on top of the planes:
- Jungle Dash: god rays and pollen
- Savanna Run: dust motes
- Storm Flight: 3-depth rain with splashes, and lightning bolts with a screen flash
- All routes: a cinematic vignette

## Audio
All audio is synthesized in code, so there are no files and no copyrighted material.
- Sound effects: flap, score, hit and fall, ground thud, countdown beeps, new-best fanfare.
- Menu theme: an original 8-bar retro-console tune ("Grey Skies Ahead") with lead, bass, chord stabs and drums.
- Route ambience:
  - Jungle Dash: leaf rustle and birdsong
  - Savanna Run: wind and crickets
  - Storm Flight: rain and rumble, with thunder synced to lightning
- Browsers block audio until the first click, tap or key press. That first input starts the menu music.

## Project structure
```text
index.html
css/game.css        UI: menu, HUD, countdown, pause, game over
js/util.js          seeded RNG, seamless ridge noise, colour and storage helpers
js/config.js        world size, physics, route tuning, medals
js/audio.js         Web Audio engine: SFX, menu theme, ambience
js/bird.js          African Grey drawing and wing animation
js/scenery.js       route art, parallax tiles, weather effects, menu previews
js/obstacles.js     biome pillar sprites, spawning, collision, scoring
js/game.js          state machine, input, game loop, UI wiring
assets/images/      reserved for production artwork
assets/audio/       reserved for production audio
```

## Mobile readiness (for the later Capacitor build)
- The logical height is fixed at 720 and the width follows the screen aspect (320–1400), with HiDPI rendering capped at 2×.
- Safe-area insets are respected, `viewport-fit=cover` is set, and the menu uses a single column on narrow screens.
- Touch input goes through pointer events, with `touch-action: none` on the game area.
- Physics runs on a fixed step (120 Hz), so it behaves the same at 60, 90 and 120 Hz displays.
- The game auto-pauses and suspends audio when the app goes to the background.
- All paths are relative, and there are no external dependencies or CDN calls.

## Version history
### v0.5.1
Fix: no sound in iPhone Safari. Web Audio is now routed as media playback, so the silent switch no longer mutes it. Unlocking also handles iOS's 'interrupted' audio state and listens for tap-end and click events.

### v0.5 — current
Rebuilt from the v0.4 product context:
- New African Grey rendering: scalloped feathers, bare pale face patch, pale iris, hooked black beak, fanned scarlet tail and a far wing behind the body. The wing animates through a down-stroke on each flap and rises into a parachute glide when falling.
- Obstacles now match their route:
  - Jungle Dash: mossy carved stone with vines
  - Savanna Run: layered sandstone with caprock and dry grass
  - Storm Flight: wet basalt columns with drips
- 5–6 parallax planes per route, with stronger colour and contrast separation between them.
- Weather and atmosphere, including lightning with thunder.
- Pause and resume, plus auto-pause when the app goes to the background.
- Persistent best score per route, medals and a New Best badge.
- Route-specific ambience.
- A cinematic start screen: animated African Grey hero, a live background that switches to whichever route card you hover over, and route cards with rendered previews.
- Carried over from v0.4:
  - the three routes and their difficulty order
  - the GET READY / 3-2-1-GO countdown, including on retry
  - the original retro menu music, which resumes on return to the menu
  - the sound toggle and HUD

### v0.4
African Grey start icon, reworked far/middle/foreground planes, more route elements, improved bird shading.

### v0.3
Original retro menu melody; GET READY → 3-2-1-GO countdown, including on retry.

### v0.2
Scrolling environments and the three-depth parallax concept.

### v0.1
Initial playable prototype.

## Suggested next steps (v0.6+)
1. Replace the vector bird with production sprite art that keeps the same identity rules.
2. Replace painted planes with high-resolution layer artwork, keeping the same tile and speed system.
3. Play-test and tune the physics per route.
4. Improve the game-over presentation further.
5. Integrate Capacitor, with an app icon, splash screen and native packaging.
