import assert from "node:assert/strict";
import * as THREE from "../dist/three.module.js";
import { CreatureWorld, heightAt, LANDMARKS } from "../dist/creature.js";
import { newJourney } from "../dist/progression.js";

const state = newJourney();
Object.assign(state, {
  stage: "creature",
  generation: 4,
  speed: 1,
  armor: 1,
  magnet: 1,
});
let deaths = 0,
  completions = 0;
const world = new CreatureWorld(state, {
  toast() {},
  note() {},
  save() {},
  death() {
    deaths++;
  },
  complete() {
    completions++;
  },
});
world.resize(1440, 900);
const input = {
  move: new THREE.Vector2(),
  pointer: new THREE.Vector2(),
  pointerDown: false,
};
const putPlayer = (x, y) => {
  world.player.position.set(x, y, heightAt(x, y));
  world.velocity.set(0, 0);
};
// Fruit replenishes health and hunger only once until the plant regrows.
const fruit = world.fruit[0];
putPlayer(fruit.plant.position.x, fruit.plant.position.y);
state.health = 70;
state.land.hunger = 50;
world.step(0.016, input);
assert.equal(state.land.fruit, 1);
assert.equal(state.dna, 4);
assert(state.land.hunger > 60);
assert(state.health > 70);
world.step(0.016, input);
assert.equal(state.land.fruit, 1);
// Social calls respect range, cooldown, and uniqueness.
putPlayer(world.friends[0].mesh.position.x, world.friends[0].mesh.position.y);
assert(world.sing());
assert.equal(world.friends[0].bond, 1);
assert.equal(world.sing(), false);
world.cooldowns.sing = 0;
world.sing();
world.cooldowns.sing = 0;
world.sing();
assert.deepEqual(state.land.friends, [0]);
assert.equal(world.friends[0].bond, 3);
world.cooldowns.sing = 0;
world.sing();
assert.deepEqual(state.land.friends, [0]);
// Predators cause bounded damage; nest, grace periods, and dashes protect the player.
putPlayer(20, 0);
const hunter = world.predators[0];
hunter.mesh.position.copy(world.player.position);
world.cooldowns.damage = 0;
state.health = 100;
world.step(0.016, input);
assert(state.health < 100);
const hurtHealth = state.health;
world.step(0.016, input);
assert.equal(state.health, hurtHealth);
world.cooldowns.damage = 0;
world.dash();
world.step(0.016, input);
assert.equal(state.health, hurtHealth);
assert.equal(world.dash(), false);
world.dashTime = 0;
world.cooldowns.attack = 0;
hunter.mesh.position.copy(world.player.position);
world.attack();
assert(hunter.health < 60);
const hunterHealth = hunter.health;
assert.equal(world.attack(), false);
assert.equal(hunter.health, hunterHealth);
world.cooldowns.attack = 0;
world.attack();
world.cooldowns.attack = 0;
world.attack();
assert(hunter.respawn > 0);
assert.equal(hunter.mesh.visible, false);
putPlayer(0, 0);
state.health = 50;
state.land.hunger = 50;
world.cooldowns.damage = 0;
world.predators[1].mesh.position.copy(world.player.position);
world.step(0.1, input);
assert(state.health > 50);
assert(state.land.hunger > 50);
// Movement samples the terrain, and pointer targeting remains finite.
input.move.set(1, 1);
for (let i = 0; i < 25; i++) world.step(0.02, input);
assert(world.player.position.x > 0);
assert.equal(
  world.player.position.z,
  heightAt(world.player.position.x, world.player.position.y),
);
input.move.set(0, 0);
input.pointerDown = true;
input.pointer.set(0.3, 0.2);
world.updateCamera(0.1);
world.step(0.016, input);
input.pointerDown = false;
assert(Number.isFinite(world.player.position.x));
// Discoveries pay once; chapter completion requires all three goal types.
const before = state.dna;
for (const landmark of LANDMARKS) {
  putPlayer(landmark.x, landmark.y);
  world.step(0.016, input);
}
assert.equal(state.land.discoveries.length, 3);
assert(state.dna >= before + 60);
assert.equal(completions, 0);
const discoveredDNA = state.dna;
world.step(0.016, input);
assert.equal(state.dna, discoveredDNA);
state.land.friends = [0, 1];
state.land.fruit = 12;
world.step(0.016, input);
world.step(0.016, input);
assert.equal(completions, 1);
assert.equal(state.land.completed, true);
putPlayer(40, 40);
state.land.hunger = 0;
state.health = 0.01;
world.step(0.1, input);
assert.equal(deaths, 1);
const generation = state.generation;
world.respawn();
assert.equal(state.health, 100);
assert.equal(world.player.position.x, 0);
assert.equal(state.generation, generation);
assert.equal(state.land.discoveries.length, 3);
console.log(
  "PASS: land foraging, hunger, friends, combat, dash, nest, movement, pointer targeting, discoveries, completion, and respawn.",
);
