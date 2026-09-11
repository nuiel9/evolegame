# Primordia — An Evolution Odyssey

An original Spore-inspired Three.js evolution game with two connected playable chapters: a microscopic ocean and an explorable land ecosystem.

## Run locally

Run `npm start` (or `python3 -m http.server 5173 --directory dist`) and open http://localhost:5173. The static game needs no build or package installation. Python 3 serves the files; Node.js runs the tests.

## The journey

Start as Lumina, a single cell. Collect green nutrients for vitality and 3 DNA each. Spend 30 DNA on flagella, a stronger membrane, or feeding cilia. After three adaptations, select **Take your first steps** to enter the creature stage. All DNA, traits, and pigmentation carry over.

In the Verdant Cradle, forage for fruit, avoid or fight hunters, and sing to peaceful creatures. Three songs within range create a companion that follows you and reduces incoming damage. Discover the Ancestor’s Gate, Singing Grove, and Sunstone. Gather 12 fruit, befriend two creatures, and discover all three landmarks to establish your species and complete the chapter.

The home nest restores vitality and nourishment. Land deaths return you to the nest with a cost of up to 10 DNA; adaptations and discoveries remain. Cell deaths begin a new cell life. Civilization is not implemented yet.

## Controls

| Action        | Input                                   |
| ------------- | --------------------------------------- |
| Swim / walk   | WASD, arrow keys, or hold mouse / touch |
| Dash          | Space, or on-screen Dash button         |
| Strike (land) | Q, or on-screen Strike button           |
| Sing (land)   | F, or on-screen Sing button             |
| Adapt         | E, or Evolve button                     |
| Field notes   | J                                       |
| Pause         | Escape                                  |

Field notes includes **New journey**, with confirmation before replacing the saved game.

## Saving

Progress saves automatically every five active seconds, when pausing, when adapting, and when leaving the page. A saved journey resumes paused on reload. Saves are local to this browser and origin; localhost progress does not transfer to the hosted site or another device. Storage failures are reported in the HUD. No account or backend is required.

## Implementation and verification

- Three.js 0.180.0 is vendored with its MIT license. Google Fonts is optional, with system-font fallbacks.
- `dist/game.js`: cell simulation, chapter orchestration, input, HUD, sound, and save integration.
- `dist/creature.js`: procedural terrain and ecosystem, articulated creatures, combat, social behavior, and land progression.
- `dist/progression.js`: save validation, stage unlocking, and completion rules.
- `npm test`: cell-to-land integration, survival mechanics, social and combat cooldowns, chapter completion, and save round-trips including corrupt or unavailable storage.

Tests run the actual simulation and Three.js object model with a minimal DOM/render adapter. They do not validate WebGL output or browser interactions. Optional WebMCP tools expose inspection and pause when supported; their browser integration has not been verified.
