# Flappy Flight 3D — Adventure Edition

A fully playable 3D Flappy Bird-style adventure built entirely with **Three.js** (no game engine). Punchy flapping, regenerating health, energy-ball combat, Angry Birds villains, genuinely sucking tornados, dangerous cave tunnels, snow-capped mountain ranges, dynamic storms -- an endless world that keeps escalating.

## Quick start

Double-click **`start.bat`** (Windows) — starts a local server and opens the game.

Or manually:

```
node server.js
```

then open http://localhost:8321

> A local server is required (ES modules don't load from `file://`).

## Controls

| Action | Keys | Touch |
|---|---|---|
| Flap | `Up` / `W` | tap screen |
| Dive (fold wings, drop) | `Down` / `S` | - |
| Shoot energy ball | `Space` | SHOOT button |
| Glide (toggle) | `G` | GLIDE button |
| Flap power 1-9 (1 gentle, 5 default, 9 strong) | `1`-`9` | - |
| Steer | `Left` `Right` / `A` `D` | drag horizontally |
| Mute | `M` | - |
| Start / restart | `Space` / tap | tap |

## Gameplay

### Flight
- **Flap** has real punch (~4m rise per tap at default power) with soft gravity and a hard terminal-velocity clamp.
- **Flap power 1-9** is adjustable live during play (`1`-`9`): 1 = gentlest hop, 5 = default, 9 = max climb (~9m per tap). HUD shows the current level. Flap impulse also auto-calibrates +22% by top world speed so climbing keeps pace with the escalating world.
- **Dive** (`Down`/`S`): folds the wings and drops altitude fast -- the opposite of flapping.
- **Glide** (`G`): wings lock spread, near-zero gravity, precise steering.
- **HUD altitude readout** (`ALT xx.x m`) shows live height above the terrain.

### Depth & readability
- Real-time **sun shadows** on the terrain from the bird, gates, blades and scenery.
- A **ground blob shadow** under the bird that shrinks/fades with height -- the classic depth cue for judging altitude and ground proximity.
- Textured terrain (detail texture x vertex-color banding) so slope and height read in 3D instead of flat color.

### Combat & villains
- `Space` fires energy balls (shots always outpace the world).
- **Three villain types**: red chasers, fast blue weavers, heavy black bombers. Contact costs one healing charge; blasting them scores 15/20/25.
- **Boss: MEGA BEAK** at 1400m and every ~2200m after: swoops, fires feather bullets, and launches angry-bird formations that grow with every encounter (3 → 10 birds). Each wave mixes four identifiable types: **red chasers** that track you, **blue shooters** that hold near the fight and snipe fast cyan bolts, **yellow speeders** that zigzag fast, and **black bombers** that close in over your head and drop egg-bombs you must dodge or shoot. Minions are shootable (+10, +15 shooters/speeders, +20 bombers); your energy balls remove one point from MEGA BEAK's visible strength bar; defeat it for +120.
- When MEGA BEAK arrives, the game opens a dedicated **combat corridor**: ordinary clutter is cleared, but three widely spaced side-lane rock spires cycle through as real hazards without blocking the central firing line. Boss bullets/minions, powerups and player shooting remain active.

### Healing
- You begin with **3x healing charges**. A collision or enemy/boss attack removes one charge and the run continues; a short recovery window prevents one impact from draining multiple charges.
- Missing charges regenerate automatically at **1x every 6 seconds** until the bar reaches 3x. Reaching 0x ends the run.

### Tornados - air manipulation, not walls
- A tornado never kills by contact. It **manipulates the air around you**: the field drags your path sideways toward the funnel (radial suck + tangential swirl that visibly drifts your line) and adds updraft/downdraft by altitude.
- Inside the core the churn whips you around violently -- you can lose healing charges by being slammed into the ground or walls, not by touching the tornado. Broad external dust spirals inward and rises into visible helical airflow around a coherently bending 9-ring funnel.

### Obstacles — precise collision
- Hit shapes match the visuals exactly: blade wheels hit only on their **sweeping arms** (gaps between arms are safe), swinging logs hit only on the **beam**, boulders use proper spheres. Swept-Z tests stop anything tunneling through you at top speed. No more phantom hits in empty air.
- Gates (gaps tighten 15→8.2), gold rings, coin arcs, floating boulders.

### Caves & mountains
- **Cave tunnels** wrap the flight line every 700-1200m: fly the centreline for +10 and a rumbling hum; clip the walls and it's over.
- **Tunnels are obstacle-free**: gates, movers and coin arcs are never spawned inside a cave span (existing ones are swept clear when a cave appears) -- the walls are the challenge.
- **Snow-capped mountain ranges** use varied silhouettes, scales and depth-dependent parallax; waterfalls flank the valley, bird flocks cross overhead, and ground mist drifts through.
- Terrain uses slope-aware grass, exposed-rock strata, deterministic multi-scale surface texture, and subtly animated wave texture on the water.

### Endless & escalating
- The world **never empties**: a scroll-synced spawn corridor keeps gates/movers flowing forever (verified to 13km+). Spacing 55→33, gaps 15→8.2, mover density and villain waves rise with distance, storms intensify. Milestone toasts announce the escalation.

### Performance
- The normal render path is optimized for integrated and mobile GPUs: capped pixel ratio, direct tone-mapped rendering without depth-of-field/fullscreen bloom, selective 512px shadows, scaled tornado/rain particles, and cached HUD writes.
- If sustained frame time is still slow, rendering automatically drops to 0.85 pixel ratio without changing gameplay simulation.

### Power-ups & mystic zones
- ⚡ speed potion, 🛡 shield (absorbs one hit), 💎 gems (×2 score).
- **Mystic portals → Sky Garden** bonus level: 12s of island-hopping collection, then back to the run.

### Weather & audio
- Storms: darkening sky/fog, streaming rain, lightning + thunder, gusts feeding turbulence.
- Procedural WebAudio: ambience, flap, shots, pops, screeches, tornado roar, thunder, portal hum, cave drone.

### Leaderboard
- Top-10 in localStorage with rank, coins, distance and boss kills.

## Assets
- **24 procedural GLB models** authored by `build-assets.mjs` + `build-assets-landmarks.mjs` (GLTFExporter + Node FileReader shim). All enriched with detail (crest tufts, snow caps, rune rings, strata, crystals, pennants…). Rebuild: `npm run assets`.
- Primitive fallbacks everywhere — the game runs even if a GLB is missing.

## Architecture

```
index.html          shell + importmap + HUD/chips/boss bar/touch UI
server.js           zero-dependency static server
start.bat           one-click launcher
build-assets.mjs    16 core models  (npm run assets)
build-assets-landmarks.mjs   8 landmark/villain-variant models
assets/*.glb        24 generated models
lib/                vendored three r170 + loaders + postprocessing
src/                22 modules:
  config    collide   input    audio    player   terrain  scenery
  obstacles combat    enemies  tornado  powerups weather  bonus
  boss      landmarks leaderboard effects ui game utils
tests/              puppeteer-core headless suites (bounded, exit-coded)
```

## Tests (with server running)

```
node tests/test-feel.js          # flap apex, blade gap/arm/far precision, enemy charge damage (5/5)
node tests/test-tornado-pull.js  # suction drag + core churn (2/2)
node tests/test-endless.js       # fields never empty at 13.6km, hard mode (3/3)
node tests/test-landmarks.js     # tunnel centre pass +10, wall crash (2/2)
node tests/test-flight-ui.js     # altitude HUD, 1-9 flap power, dive, tornado air-field, clear tunnels, blob shadow (9/9)
node tests/test-health-boss-visuals.js # 3x healing, regeneration, boss damage/HUD, tornado inflow, environment detail
node tests/test-boss-waves.js     # wave scaling 3->10, 4 minion types/behaviors/colors, bolts aim at player, bomber egg runs (12/12)
node tests/test-performance-boss-arena.js # optimized pipeline + clear, resumable boss combat corridor
node tests/test-headless.js      # menu/play/death/restart regression
```

All suites are time-bounded with explicit pass/fail verdicts and exit codes.

## Tuning
Everything lives in `src/config.js`: flap/gravity, difficulty curves, combat, power-ups, scores.
Collision primitives in `src/collide.js` (swept-Z, ellipsoids, capsules) shared by every system.
