import assert from "node:assert/strict";
import * as THREE from "../dist/three.module.js";
import {
  newJourney,
  canFound,
  enterCivilizationStage,
  parseJourney,
  saveJourney,
  loadJourney,
} from "../dist/progression.js";
import {
  BUILDINGS,
  newSettlement,
  normalizeSettlement,
  placementError,
  placeBuilding,
  assignWorker,
  recruit,
  capacity,
  idleWorkers,
  tickSettlement,
  beginRaid,
  repairBuilding,
  recoverSettlement,
  finished,
  monumentRequirements,
} from "../dist/settlement-rules.js";
import { SettlementWorld } from "../dist/settlement.js";

const tick = (v, seconds) => {
  const events = [];
  for (let i = 0; i < Math.ceil(seconds / 0.1); i++)
    events.push(...tickSettlement(v, 0.1));
  return events;
};
const state = newJourney();
assert.equal(enterCivilizationStage(state), false);
state.stage = "creature";
state.generation = 4;
state.speed = 1;
state.armor = 1;
state.magnet = 1;
state.land.fruit = 12;
state.land.friends = [0, 1];
state.land.discoveries = ["arch", "grove", "spire"];
assert(canFound(state));
assert(enterCivilizationStage(state));
assert.equal(enterCivilizationStage(state), false);
const v = state.village;
assert.equal(placeBuilding(v, "hut", 0, 0).ok, false, "Cannot overlap hearth");
assert.equal(
  placeBuilding(v, "hut", 99, 0).ok,
  false,
  "Cannot build outside boundary",
);
assert.equal(placeBuilding(v, "hut", NaN, 0).ok, false);
assert.equal(placeBuilding(v, "__proto__", 10, 0).ok, false);
const before = { ...v.resources };
const hut = placeBuilding(v, "hut", -8, -5);
assert(hut.ok);
assert.equal(v.resources.wood, before.wood - 25);
assert.equal(capacity(v), 4);
assert.equal(recruit(v), false, "Unfinished homes provide no capacity");
tick(v, 10.1);
assert.equal(capacity(v), 6);
assert(recruit(v));
assert.equal(recruit(v), false, "Only one recruitment at a time");
tick(v, 12.1);
assert.equal(v.population, 5);
assert.equal(idleWorkers(v), 1);
assert(assignWorker(v, "guard", 1));
assert.equal(assignWorker(v, "guard", 1), false);
assert(assignWorker(v, "wood", -1));
assert(assignWorker(v, "stone", 1));
assert.equal(assignWorker(v, "fake", 1), false);
const available = { ...v.resources };
v.resources.wood = 0;
assert.equal(placeBuilding(v, "tower", 8, 8).ok, false);
assert.equal(v.resources.stone, available.stone);
v.resources.wood = available.wood;
const damaged = v.buildings[0];
damaged.health = 200;
assert(repairBuilding(v, damaged.id));
assert.equal(damaged.health, 300);
assert.equal(repairBuilding(v, damaged.id), false);
assert(placementError(v, "monument", 15, 15), "Monument requires milestones");

// A production-paced playthrough must be able to reach victory with ordinary starting resources.
const play = newSettlement();
let elapsed = 0;
const buildQueue = [
  ["tower", -8, 12],
  ["tower", 8, -12],
  ["farm", -9, -12],
  ["hut", 8, 4],
  ["hut", 16, 4],
  ["farm", -18, -12],
  ["quarry", 22, -8],
  ["lumber", 3, 15],
];
let pending = 0,
  won = false;
for (let step = 0; step < 9000 && !won; step++) {
  if (pending < buildQueue.length) {
    const [type, x, y] = buildQueue[pending];
    if (placeBuilding(play, type, x, y).ok) pending++;
  }
  if (play.population < 8) recruit(play);
  while (idleWorkers(play) > 0) {
    const job =
      play.jobs.stone < 3 ? "stone" : play.jobs.guard < 1 ? "guard" : "wood";
    assignWorker(play, job, 1);
  }
  if (
    monumentRequirements(play).every((r) => r.done) &&
    !play.buildings.some((b) => b.type === "monument")
  )
    placeBuilding(play, "monument", -22, 1);
  const events = tickSettlement(play, 0.1);
  elapsed += 0.1;
  assert.equal(
    play.defeated,
    false,
    `Balanced playthrough should survive (at ${elapsed.toFixed(1)} seconds)`,
  );
  won = events.some((e) => e.type === "victory");
}
assert.equal(pending, buildQueue.length);
assert(won, "Economy supports reaching the monument objective");
assert(play.survived >= 2);
assert(finished(play, "monument").length);
const wave = play.wave;
tick(play, 150);
assert.equal(play.wave, wave, "Victory stops new raids");

// Raids, hunger, recovery, and queued recruitment remain deterministic.
const danger = newSettlement();
danger.jobs = { wood: 4, stone: 0, food: 0, guard: 0 };
danger.resources.food = 0;
tick(danger, 220);
assert(danger.defeated);
recoverSettlement(danger);
assert.equal(danger.defeated, false);
assert.equal(danger.nextRaid, 120);
assert(danger.resources.food >= 60);
const defense = newSettlement();
beginRaid(defense);
const raid = defense.raiders[0];
raid.health = 0;
tick(defense, 0.1);
assert.equal(defense.survived, 0);
defense.raiders.forEach((r) => (r.health = 0));
tick(defense, 0.1);
assert.equal(defense.survived, 1);
const reward = defense.resources.wood;
tick(defense, 0.1);
assert(defense.resources.wood < reward + 1, "No duplicate raid rewards");
const stalled = newSettlement();
const home = placeBuilding(stalled, "hut", 8, 0).building;
tick(stalled, 11);
assert(recruit(stalled));
home.health = 0;
const queue = stalled.recruitTime;
tick(stalled, 1);
assert.equal(
  stalled.recruitTime,
  queue,
  "Recruitment waits for replacement housing",
);

// Round-trip a real civilization, including an active raid and unfinished structure.
state.village = play;
state.village.completed = false;
state.village.buildings = state.village.buildings.filter(
  (b) => b.type !== "monument",
);
beginRaid(state.village);
const storage = {
  raw: "",
  setItem(_k, raw) {
    this.raw = raw;
  },
  getItem() {
    return this.raw;
  },
};
assert(saveJourney(storage, state));
const restored = loadJourney(storage);
assert.equal(restored.stage, "civilization");
assert.equal(restored.village.population, 8);
assert.equal(restored.village.raiders.length, state.village.raiders.length);
assert.deepEqual(restored.village.resources, state.village.resources);
const legacy = { ...state, stage: "creature" };
delete legacy.village;
const migrated = parseJourney(JSON.stringify({ version: 2, state: legacy }));
assert.equal(migrated.stage, "creature");
assert.equal(migrated.village.population, 4);
assert.equal(migrated.land.fruit, 12);
const invalid = normalizeSettlement({
  population: 999,
  jobs: { wood: 999, stone: 999 },
  resources: { wood: -4, food: "bad" },
  buildings: [{ type: "__proto__" }],
  raiders: [null],
});
assert.equal(invalid.population, 16);
assert(idleWorkers(invalid) >= 0);
assert.equal(invalid.resources.wood, 0);
assert(invalid.buildings.some((b) => b.type === "hearth"));

// Exercise geometry, placement picking, scene updates, and player defense with actual Three.js objects.
const sceneState = newJourney();
Object.assign(sceneState, {
  stage: "civilization",
  generation: 4,
  speed: 1,
  armor: 1,
  magnet: 1,
});
sceneState.land.completed = true;
let victoryCount = 0;
const world = new SettlementWorld(sceneState, {
  toast() {},
  note() {},
  save() {},
  death() {},
  complete() {},
  settlementDefeat() {},
  victory() {
    victoryCount++;
  },
});
world.resize(1440, 900);
world.updateCamera(0.1);
world.chooseBuilding("hut");
world.updatePlot(new THREE.Vector2(0.4, 0));
assert(world.plot);
assert(Number.isFinite(world.plot.x));
const woodBeforePlacement = sceneState.village.resources.wood;
assert(world.placeAtPointer(new THREE.Vector2(0.4, 0)));
assert.equal(sceneState.village.resources.wood, woodBeforePlacement - 25);
assert(world.buildingViews.has(world.selectedId));
assert.equal(world.ghost.visible, false);
const built = placeBuilding(sceneState.village, "tower", -8, 12);
assert(built.ok);
world.syncBuildings();
assert(world.buildingViews.has(built.building.id));
const input = {
  move: new THREE.Vector2(1, 0),
  pointer: new THREE.Vector2(),
  pointerDown: false,
};
world.step(0.1, input);
world.updateCamera(0.1);
assert(world.player.position.x > 0);
assert.equal(world.villagers.length, 4);
beginRaid(sceneState.village);
sceneState.village.raiders[0].x = world.player.position.x;
sceneState.village.raiders[0].y = world.player.position.y;
const hp = sceneState.village.raiders[0].health;
assert(world.attack());
assert(sceneState.village.raiders[0].health < hp);
assert.equal(world.attack(), false);
world.step(0.1, input);
assert(world.raiderViews.size > 0);
console.log(
  `PASS: settlement placement, economy, workers, recruitment, combat, raids, recovery, saves, migration, and victory after ${Math.round(elapsed)} simulated seconds.`,
);
