# Plan - Thank You For Watching Scene (Earth + Moon)

This plan adds a third OBS scene focused on Planet Earth + Moon while preserving the project core:
- planetary hero object above the spacetime fabric
- fabric reacts to OBS desktop audio (WebSocket)
- overlay title/subtitle + live local date/time

## Objectives

1. Add a dedicated Thank You For Watching page with Earth as the hero object.
2. Include dynamic Earth features:
   - animated atmosphere glow
   - moving cloud layer
   - animated Northern Lights (aurora)
3. Add an orbiting Moon with believable scale and motion.
4. Keep existing audio-reactive fabric behavior and OBS setup workflow.
5. Keep scene switching via URL query (`?scene=...`) consistent with current pages.
6. Set TY4W subtitle to `See You Next Time` using custom font source `@twigs.woff`.

---

## High-Level Strategy

- Do not refactor existing Starting or BRB scene internals.
- Create a new scene page in parallel (same architectural pattern as current pages).
- Reuse stable logic patterns already in the repo:
  - boot loader + asset mode handling
  - overlay typography/date-time systems
  - OBS WebSocket audio-reactive controller
  - time-fabric deformation modes (`gravityWarp` / `waterfallGraph`)

This keeps risk low and preserves known-good behavior in OBS.

---

## Files to Add

- `thanks.html` (or `ty4watching.html`; recommended: `thanks.html`)
- `thanks.css`
- `thanks.js`
- `TY4Watching.md` (this plan)

## Files to Update

- `config.js`
- `index.html`
- `brb.html`
- `README.md`

---

## Step-by-Step Tasks

### 1) Add the new page shell (`thanks.html`)

- Create a page with:
  - `#scene` canvas container
  - `.overlay` title/subtitle/date block
  - `#bootError` message element
- Reuse the same boot flow as current pages:
  - load `config.js`
  - resolve `assets=auto|offline|cdn`
  - load local Three.js first, fallback to CDN
  - then load `thanks.js`

### 2) Add scene routing support (`index.html` + `brb.html` + `thanks.html`)

- Extend scene normalization and redirects to include `thanks`.
- Supported aliases should map to canonical `thanks`:
  - `thanks`, `thankyou`, `ty4w`, `ending`
- Expected routes:
  - `?scene=starting` -> `index.html`
  - `?scene=brb` -> `brb.html`
  - `?scene=thanks` -> `thanks.html`

### 3) Extend configuration (`config.js`)

- Add `overlayThanks` block:
  - `title: "THANK YOU FOR WATCHING"`
  - `subtitle: "See You Next Time"`
  - `subtitleFontFamily: "'Twigs', serif"`
  - `customFontFaces` includes:
    - `{ family: "Twigs", src: "@twigs.woff", weight: "400", style: "normal", display: "swap" }`
  - optional position/font overrides matching existing schema
- Add `thanksScene` block for tuning:
  - camera radius/height/orbit speed
  - earth/moon size + moon orbit params
  - cloud opacity/speed
  - atmosphere and aurora intensity
  - performance knobs (pixel ratio cap, star count, fabric segments)

### 4) Build core scene scaffold (`thanks.js`)

- Start from `main.js` architecture for consistency:
  - renderer init
  - tone mapping/color space
  - fog/stars/lights
  - resize handling
  - overlay typography + date-time ticker
- Keep cleanup on unload (audio stop, timers, listeners).

### 5) Implement Earth hero system

- Add `earthGroup` centered above the fabric well.
- Earth body:
  - physically lit sphere with day/night transition
  - ocean/specular highlights for realism
- Cloud layer:
  - second sphere shell, semi-transparent, rotating slightly faster than Earth
- Atmosphere layer:
  - Fresnel/rim glow shell with additive blending
- Aurora layer (Northern Lights):
  - animated polar mask + flowing noise
  - stronger on night side
  - subtle audio-driven intensity boost

### 6) Implement Moon system

- Add Moon pivot orbiting Earth with slight inclination.
- Moon sphere with crater-like procedural texture/noise.
- Motion:
  - orbital rotation around Earth
  - optional slow self-spin (or tidally locked feel)
- Include Moon as a lighter secondary gravity contributor to the fabric.

### 7) Reuse and preserve audio-reactive fabric core

- Keep same OBS WebSocket controller logic and config semantics.
- Keep both fabric modes:
  - `gravityWarp` (default)
  - `waterfallGraph`
- Gravity input:
  - Earth = dominant central mass
  - Moon = secondary moving mass
- Audio mapping:
  - boost wave amplitude/speed/opacity
  - add aurora pulse response from RMS/transient

### 8) Create visual style for TY4W (`thanks.css`)

- Distinct end-scene style (cool Earth-night palette + aurora accents).
- Maintain overlay readability and existing typography system compatibility.
- Ensure subtitle styling preserves legibility for the `Twigs` font at OBS resolutions.
- Mobile-safe layout:
  - preserve responsive overlay top offsets
  - avoid clipping at smaller widths

### 9) Documentation update (`README.md`)

- Add new scene URLs:
  - `/?scene=thanks`
  - `/thanks.html`
- Document new config blocks:
  - `overlayThanks`
  - `thanksScene`
- Confirm OBS instructions remain unchanged.

---

## Acceptance Criteria (Definition of Done)

1. `http://localhost:8080/?scene=thanks` opens the new TY4W scene.
2. Earth appears above the time fabric with:
   - moving clouds
   - dynamic atmosphere glow
   - visible animated aurora
3. Moon orbits Earth with stable motion.
4. Fabric still reacts to OBS desktop audio as before.
5. Overlay title/subtitle/date-time works and is config-driven, with subtitle text `See You Next Time` rendered from `@twigs.woff`.
6. Scene switching among starting/BRB/thanks works from URL query.
7. Runs stably in OBS Browser Source at 1080p without major frame drops.

---

## Validation Checklist

- Open each route:
  - `?scene=starting`
  - `?scene=brb`
  - `?scene=thanks`
- Test asset modes:
  - `?assets=auto`
  - `?assets=offline`
  - `?assets=cdn`
- Audio test:
  - play desktop audio in OBS
  - verify fabric + aurora response
- Resize test:
  - desktop and narrow/mobile viewport
- Check browser console:
  - no runtime errors in steady state
