import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "../dist/three.module.js";
import { CreatureWorld } from "../dist/creature.js";
import {
  newJourney,
  canWalk,
  enterCreatureStage,
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
newGame();assert.equal(state.stage,'cell');assert.equal(landWorld,null);assert.equal(state.generation,1);assert.equal(state.land.fruit,0);
clearTimeout(toastTimer);
console.log('PASS: cell gameplay, stage unlock, land entry, inherited adaptations, land respawn, and new journey.');
`;
new Function(
  "THREE",
  "assert",
  "CreatureWorld",
  "newJourney",
  "canWalk",
  "enterCreatureStage",
  "saveJourney",
  "loadJourney",
  source + tests,
)(
  { ...THREE, WebGLRenderer: Renderer },
  assert,
  CreatureWorld,
  newJourney,
  canWalk,
  enterCreatureStage,
  saveJourney,
  loadJourney,
);
