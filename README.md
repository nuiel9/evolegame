# Primordia — An Evolution Odyssey

An original Spore-inspired Three.js evolution game with four connected playable chapters: a microscopic ocean, an explorable land ecosystem, a settlement to build and defend, and a space frontier.

## Run locally

Run `npm start` (or `python3 -m http.server 5173 --directory dist`) and open http://localhost:5173. The static game needs no build or package installation. Python 3 serves the files; Node.js runs the tests.

## The journey

Start as Lumina, a single cell. Collect green nutrients for vitality and 3 DNA each. Spend 30 DNA on flagella, a stronger membrane, or feeding cilia. After three adaptations, select **Take your first steps** to enter the creature stage. All DNA, traits, and pigmentation carry over.

In the Verdant Cradle, forage for fruit, avoid or fight hunters, and sing to peaceful creatures. Three songs within range create a companion that follows you and reduces incoming damage. Discover the Ancestor’s Gate, Singing Grove, and Sunstone. Gather 12 fruit, befriend two creatures, and discover all three landmarks to establish your species and complete the chapter.

The home nest restores vitality and nourishment. Land deaths return you to the nest with a cost of up to 10 DNA; adaptations and discoveries remain. Cell deaths begin a new cell life.

After completing the creature objectives, choose **Found a settlement** to begin civilization. Four villagers start at your hearth with supplies. Build dwellings, gardens, wood camps, stone works, and watchtowers. Use the People tab to assign gathering or guard jobs and recruit more villagers. Click a building to inspect and repair it.

The first raid arrives after two minutes of active settlement play. Watchtowers fire automatically within range, guards help defend attacked buildings, and your creature can strike raiders directly. Losing the hearth pauses the settlement and offers recovery with emergency supplies. Food shortages weaken the hearth, so keep gardens or foragers working.

Reach eight villagers, finish two gardens and two watchtowers, and repel two raids. Then build the Life monument for 150 wood, 150 stone, and 80 food to finish the third chapter. New raids stop after victory and you can continue building. The simulation test reaches this objective with ordinary starting resources in about five minutes; actual play time depends on your choices.

After the Life monument is complete, **Spaceflight** unlocks. Research a launchpad for 80 wood and 80 stone, then launch a spacecraft for 80 wood, 40 stone, and 60 food. Settlement gathering continues while you prepare. Your civilization is preserved in the save after launch.

The Starward Frontier contains nine star systems and 27 worlds. Choose a system to jump for 3 fuel; solar collectors restore 0.3 fuel per active second. Survey planets for ore and knowledge, establish colonies on garden worlds, and make peaceful contact with alien civilizations. Colonies produce ore. Complete six surveys, establish three colonies, and make two contacts, then build the Horizon beacon. This is a finite space exploration chapter, not an infinite universe or a planetary landing simulator. Exploration continues after victory.

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

In civilization, **B** toggles the settlement panel. Select a building, then click a valid ground position inside the marked boundary. **Escape** cancels placement before pausing. The People tab includes worker assignment controls. Housing is required for recruitment; new villagers start idle until assigned. All gameplay controls also have on-screen buttons.

## Saving

Progress saves automatically every five active seconds, when pausing, when adapting, and when leaving the page. Civilization saves include buildings and construction progress, resources, population, jobs, recruitment, and active raids. Space saves include launchpad research, location, supplies, surveys, colonies, contacts, and completion. Version 2 and 3 journeys migrate automatically to version 4. A saved journey resumes paused on reload. Saves are local to this browser and origin; localhost progress does not transfer to the hosted site or another device. Storage failures are reported in the HUD. No account or backend is required.

The upper-left build label identifies the loaded version. When a newer `build.json` is detected, **Save & reload** lets you load it without abandoning the current save. The older cell-only build predates this feature and must be refreshed manually.

## Implementation and verification

- Three.js 0.180.0 is vendored with its MIT license. Google Fonts is optional, with system-font fallbacks.
- `dist/game.js`: cell simulation, chapter orchestration, input, HUD, sound, and save integration.
- `dist/creature.js`: procedural terrain and ecosystem, articulated creatures, combat, social behavior, and land progression.
- `dist/progression.js`: save validation, stage unlocking, and completion rules.
- `dist/settlement-rules.js`: deterministic economy, construction, worker assignment, raids, recovery, and save normalization.
- `dist/settlement.js`: settlement structures, construction previews, villagers, raiders, and defense effects.
- `dist/space-rules.js` and `dist/space.js`: spaceflight costs, exploration economy, alien contact, colonies, beacon completion, and the Three.js star systems and spacecraft.
- `npm test`: all four chapters, survival, settlement economy and combat, space exploration and completion, and save migration including corrupt or unavailable storage.

Tests run the actual simulation and Three.js object model with a minimal DOM/render adapter. They do not validate WebGL output or browser interactions. Optional WebMCP tools expose inspection and pause when supported; their browser integration has not been verified.
