import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "../dist/three.module.js";
import { CreatureWorld } from "../dist/creature.js";
import { SettlementWorld } from "../dist/settlement.js";
import { SpaceWorld } from "../dist/space.js";
import * as spaceRules from "../dist/space-rules.js";
import * as settlementRules from "../dist/settlement-rules.js";
import {
  newJourney,
  canWalk,
  canFound,
  enterCreatureStage,
  enterCivilizationStage,
  saveJourney,
  loadJourney,
} from "../dist/progression.js";
// Exercise the real simulation with a minimal DOM/rendering adapter, without a browser.
const ctx = new Proxy(
  { createRadialGradient: () => ({ addColorStop() {} }) },
  { get: (t, k) => t[k] ?? (() => {}) },
);
const element = () => ({
  textContent: "",
  innerHTML: "",
  style: {},
  hidden: true,
  classList: { add() {}, remove() {} },
  getContext: () => ctx,
  addEventListener() {},
  setAttribute() {},
  focus() {},
  querySelectorAll: () => [],
  setPointerCapture() {},
  insertBefore() {},
  replaceWith() {},
});
const elements = new Map();
globalThis.document = {
  getElementById: (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  },
  createElement: () => element(),
  addEventListener() {},
  querySelector: () => element(),
  querySelectorAll: () => [],
};
globalThis.innerWidth = 1440;
globalThis.innerHeight = 900;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
globalThis.requestAnimationFrame = () => {};
class Renderer {
  setPixelRatio() {}
  setClearColor() {}
  setSize() {}
  render() {}
}
const source = fs
  .readFileSync(new URL("../dist/game.js", import.meta.url), "utf8")
  .replace(/^import\s[\s\S]*?;\s*/gm, "");
const tests = `
const originalFoods=foods.length;
foods.forEach(f=>f.position.set(70,65,0));
foods[0].position.copy(player.position);
simulate(.016);
assert.equal(state.eaten,1,'A nearby nutrient is consumed');
assert.equal(state.dna,3,'Nutrients grant three DNA');
assert.equal(foods.length,originalFoods,'Nutrients recycle without allocating new entities');
state.dna=30;openEvolution();upgrade('speed');
assert.equal(state.speed,1);assert.equal(state.generation,2);assert.equal(state.dna,0);assert.equal(paused,false);
const generation=state.generation;upgrade('armor');assert.equal(state.generation,generation,'Unaffordable upgrades cannot be purchased');
state.elapsed=6;damageCooldown=0;predators.forEach(p=>p.position.set(70,65,0));predators[0].position.copy(player.position);simulate(.016);assert(state.health<100,'Predators damage the player');
const health=state.health;simulate(.016);assert.equal(state.health,health,'Damage grace period prevents per-frame damage');
dash();assert(dashTime>0);const dashes=state.dashes;dash();assert.equal(state.dashes,dashes,'Dash cooldown is enforced');
pauseGame();assert.equal(paused,true);closeModal();assert.equal(paused,false);
state.dna=60;state.health=0;gameOver();assert.equal(dead,true);restart();assert.equal(state.health,100);assert.equal(state.generation,1);assert.equal(state.dna,0);assert.equal(dead,false);assert.equal(paused,false);assert.equal(player.userData.appendages.length,25);
state.dna=90;upgrade('speed');upgrade('armor');upgrade('magnet');assert(canWalk(state),'Three adaptations unlock the next chapter');
assert(enterCreatureStage(state));startLand();assert.equal(state.stage,'creature');assert.equal(landWorld.state,state);
state.dna=30;upgrade('armor');assert.equal(state.armor,2);assert.equal(state.dna,0);assert.equal(state.generation,5);
gameOver();assert(dead);restart();assert.equal(state.stage,'creature');assert.equal(state.generation,5);assert.equal(state.health,100);
state.land.fruit=12;state.land.friends=[0,1];state.land.discoveries=['arch','grove','spire'];state.land.completed=true;
assert(canFound(state));assert(enterCivilizationStage(state));releaseLandWorld();startLand();assert(landWorld instanceof SettlementWorld);assert.equal(state.village.population,4);
landWorld.chooseBuilding('hut');assert.equal(landWorld.buildType,'hut');landWorld.cancelPlacement();assert.equal(landWorld.buildType,null);
state.village.buildings[0].health=0;state.village.defeated=true;settlementDefeat();assert(dead);restart();assert.equal(state.village.defeated,false);assert.equal(state.stage,'civilization');assert.equal(state.village.buildings[0].health,300);
newGame();assert.equal(state.stage,'cell');assert.equal(landWorld,null);assert.equal(state.generation,1);assert.equal(state.land.fruit,0);
state.stage='civilization';state.village.completed=true;state.village.resources={wood:200,stone:200,food:200};assert(researchSpace(state));assert(launchSpace(state));startLand();assert(landWorld instanceof SpaceWorld);updateUI();loop(lastTime+16);showHelp();closeModal();assert.equal(state.stage,'space');
newGame();assert.equal(state.stage,'cell');assert.equal(landWorld,null);
clearTimeout(toastTimer);
console.log('PASS: cell gameplay, land entry, civilization entry, inherited traits, recovery, and new journey.');
`;
new Function(
  "THREE",
  "assert",
  "CreatureWorld",
  "SettlementWorld",
  "SpaceWorld",
  ...Object.keys(spaceRules),
  ...Object.keys(settlementRules),
  "newJourney",
  "canWalk",
  "canFound",
  "enterCreatureStage",
  "enterCivilizationStage",
  "saveJourney",
  "loadJourney",
  source + tests,
)(
  { ...THREE, WebGLRenderer: Renderer },
  assert,
  CreatureWorld,
  SettlementWorld,
  SpaceWorld,
  ...Object.values(spaceRules),
  ...Object.values(settlementRules),
  newJourney,
  canWalk,
  canFound,
  enterCreatureStage,
  enterCivilizationStage,
  saveJourney,
  loadJourney,
);
