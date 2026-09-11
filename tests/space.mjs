import assert from "node:assert/strict";
import { newJourney, parseJourney } from "../dist/progression.js";
import {
  newSpace,
  normalizeSpace,
  researchSpace,
  launchSpace,
  jump,
  survey,
  colonize,
  contact,
  tickSpace,
  buildBeacon,
  SYSTEMS,
} from "../dist/space-rules.js";
import { SpaceWorld } from "../dist/space.js";
const state = newJourney();
assert.equal(researchSpace(state), false);
state.stage = "civilization";
state.speed = state.armor = state.magnet = 1;
state.generation = 4;
state.land.fruit = 12;
state.land.friends = [0, 1];
state.land.discoveries = ["arch", "grove", "spire"];
state.village.completed = true;
state.village.buildings.push({
  id: 2,
  type: "monument",
  x: 10,
  y: 10,
  health: 400,
  progress: 1,
});
state.village.resources = { wood: 159, stone: 120, food: 60 };
assert(researchSpace(state));
assert.equal(researchSpace(state), false);
assert.equal(launchSpace(state), false);
state.village.resources.wood++;
assert(launchSpace(state));
assert.equal(state.stage, "space");
assert.equal(launchSpace(state), false);
assert.deepEqual(state.village.resources, { wood: 0, stone: 0, food: 0 });
assert.equal(colonize(state.space), false);
assert.equal(contact(state.space), false);
assert.equal(jump(state.space, -1), false);
assert.equal(jump(state.space, 99), false);
assert.equal(buildBeacon(state.space), false);
// Complete the frontier with earned resources, without injecting supplies.
for (const system of SYSTEMS) {
  if (system.id !== state.space.system) {
    tickSpace(state.space, 10);
    assert(jump(state.space, system.id));
  }
  for (let p = 0; p < 3; p++) {
    state.space.planet = p;
    assert(survey(state.space));
    const ore = state.space.ore;
    assert.equal(survey(state.space), false);
    assert.equal(state.space.ore, ore);
    if (p === 1) {
      if (system.planets[p].inhabited) {
        assert(contact(state.space));
        assert.equal(contact(state.space), false);
      }
      if (state.space.ore >= 40 && state.space.data >= 20) {
        assert(colonize(state.space));
        assert.equal(colonize(state.space), false);
      }
    }
  }
}
assert(buildBeacon(state.space));
assert.equal(buildBeacon(state.space), false);
assert.equal(state.space.surveyed.length, 27);
assert(state.space.colonies.length >= 3);
assert(state.space.contacts.length >= 2);
const loaded = parseJourney(JSON.stringify({ version: 4, state }));
assert.equal(loaded.stage, "space");
assert.deepEqual(loaded.space, state.space);
const old = parseJourney(
  JSON.stringify({
    version: 3,
    state: { ...state, stage: "civilization", space: undefined },
  }),
);
assert.equal(old.stage, "civilization");
assert.deepEqual(old.space, newSpace());
assert.deepEqual(normalizeSpace(null), newSpace());
const invalid = normalizeSpace({
  system: Infinity,
  planet: -5,
  fuel: 99,
  ore: -1,
  surveyed: [1, 1, 999],
  colonies: [1, 2],
  contacts: [1],
  completed: true,
});
assert.equal(invalid.fuel, 12);
assert.equal(invalid.ore, 0);
assert.deepEqual(invalid.colonies, [1]);
assert.deepEqual(invalid.contacts, []);
assert.equal(invalid.completed, false);
state.space.fuel = 0;
assert.equal(jump(state.space, 0), false);
tickSpace(state.space, 10);
assert(jump(state.space, 0));
const world = new SpaceWorld(state);
world.resize(1440, 900);
world.step(0.1);
world.updateCamera(0.1);
assert.equal(world.planets.length, 27);
assert(Number.isFinite(world.camera.position.z));
tickSpace(state.space, 10);
assert(jump(state.space, 1));
world.setDestination();
assert(world.transit > 0);
for (let i = 0; i < 200; i++) {
  world.step(0.02);
  world.updateCamera(0.02);
}
assert.equal(world.transit, 0);
assert(Math.abs(world.focus.x - SYSTEMS[1].x) < 1);
world.resize(390, 844);
assert(world.camera.aspect < 1);
console.log(
  "PASS: spaceflight gates and costs, 27 surveys, colonies, diplomacy, beacon victory, fuel recovery, save migration, and Three.js travel.",
);
