# Primordia — A Cell Odyssey

An original Spore-inspired Three.js cell-stage survival game. Procedural 3D organisms swim through a volumetric-looking ocean with animated appendages, translucent membranes, suspended particles, AI predators, and a live minimap.

## Play locally

Run `python3 -m http.server 5173 --directory dist` and open http://localhost:5173.

- WASD / arrow keys / hold pointer: swim
- Space: dash (3.5-second cooldown)
- E: evolve (30 DNA)
- J: field notes
- Escape: pause

Nutrients grant 3 DNA and restore vitality. Evolve flagella, membrane strength, and feeding range; customize pigmentation. Progress is session-local and resets on reload. Creature and civilization stages are not implemented. This is a polished cell-stage prototype, not a complete AAA title.

## Implementation

Static ES modules, vendored Three.js 0.180.0, procedural geometry and shaders, synthesized optional Web Audio. No build or service dependencies. Google Fonts is optional; system fonts serve as fallback.

`node tests/gameplay.mjs` checks simulation rules using the real Three.js objects and a minimal DOM/render adapter. It does not validate WebGL rendering or browser interaction. WebMCP inspection and pause tools are feature-detected; validation requires a supporting browser.
