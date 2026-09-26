# Flappy Grey — v0.6.3

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

## Route records (4-letter names)
Each route has one record: the top score and the 4-letter name of whoever set it.
- The record for each route shows on its menu card and on the game-over screen.
- When a run beats the route record, the game-over screen asks for a 4-letter name (A–Z). The name you used last time is filled in for you.
- Without a Firebase setup, records are kept on each device only and labelled **Device record**.
- With Firebase set up, one shared record per route is visible to every player and labelled **World record**.

### Online records: one-time Firebase setup (free Spark plan, about 10 minutes)
1. Go to https://console.firebase.google.com and click **Create a project**, for example `flappy-grey`. Google Analytics isn't needed.
2. In the left menu, open **Build → Firestore Database** and click **Create database**. Choose a location near your players (e.g. `asia-southeast1` for Singapore) and start in **production mode**.
3. Open the **Rules** tab, replace everything with the rules below, then click **Publish**.
4. Click the gear icon next to Project Overview and open **Project settings**. Copy the **Project ID**.
5. Under **Your apps**, click the web icon `</>` and register an app with any nickname. You don't need Hosting. Copy the **apiKey** value.
6. Paste both values into `js/leaderboard-config.js`, then push to GitHub.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{route} {
      allow read: if true;
      allow create, update: if route in ['jungle', 'savanna', 'storm']
        && request.resource.data.keys().hasOnly(['name', 'score'])
        && request.resource.data.name is string
        && request.resource.data.name.matches('^[A-Z]{4}$')
        && request.resource.data.score is int
        && request.resource.data.score > 0
        && request.resource.data.score <= 9999
        && (resource == null || request.resource.data.score > resource.data.score);
      allow delete: if false;
    }
  }
}
```
These rules only allow a write that beats the current record, and only with a valid 4-letter name and a score from 1 to 9999.

The apiKey is a public identifier, not a password, so it's normal for it to be visible in the code.

Because scores are calculated in the player's browser, a determined player could still send a fake score. To reset a record, delete its document in the Firebase console under Firestore Database → leaderboard.

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
js/leaderboard-config.js  Firebase Project ID + apiKey (blank = device-only records)
js/leaderboard.js   route records: fetch, check, submit (Firestore REST)
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
### v0.6.3
- Records now update live across devices. The shared board is re-checked every 15 seconds on the menu and game-over screens, and straight away when you return to the app.
- When someone sets a new record, its line on the route card flashes gold.
- The end-of-run check confirms against the live board, so if a record was beaten mid-run the player sees who beat it.
- Fix: the Firebase keys were missing from the live build.

### v0.6.2
- Route cards now show a simpler, smaller line: `TOP SCORE : 42  JACK`.
- A save that Firebase refuses now shows a clear message instead of "record changed".

### v0.6.1
Connected the route records to the `flappy-grey` Firebase project, so records are now shared by all players.

### v0.6
- Added route records. Beating a route's record prompts for a 4-letter name, and each menu card shows the route's top score and its holder.
- Records are shared through Firebase Firestore when it's configured, and stay on the device otherwise.
- Script and style links now carry `?v=` version stamps, so browsers load the new files straight after an update.

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
