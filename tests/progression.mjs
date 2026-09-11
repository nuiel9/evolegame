import assert from "node:assert/strict";
import {
  newJourney,
  canWalk,
  enterCreatureStage,
  saveJourney,
  loadJourney,
  parseJourney,
  chapterComplete,
} from "../dist/progression.js";

const state = newJourney();
assert.equal(enterCreatureStage(state), false);
state.generation = 4;
state.speed = 1;
state.armor = 1;
state.magnet = 1;
state.dna = 27;
assert(canWalk(state));
assert(enterCreatureStage(state));
assert.equal(enterCreatureStage(state), false);
assert.equal(state.dna, 27, "The stage transition preserves earned DNA");
state.land.friends = [1, 4];
state.land.discoveries = ["arch", "grove", "spire"];
state.land.fruit = 12;
assert(chapterComplete(state));
state.land.completed = true;
const storage = {
  value: null,
  setItem(_k, v) {
    this.value = v;
  },
  getItem() {
    return this.value;
  },
};
assert(saveJourney(storage, state));
assert.deepEqual(loadJourney(storage), state);
assert.equal(parseJourney("{broken"), null);
assert.equal(parseJourney('{"version":99}'), null);
const corrupt = newJourney();
corrupt.stage = "creature";
corrupt.speed = -5;
corrupt.dna = 1e20;
corrupt.land.friends = [0, 0, 999, "1"];
corrupt.land.discoveries = ["arch", "arch", "fake"];
const safe = parseJourney(JSON.stringify({ version: 2, state: corrupt }));
assert.equal(safe.stage, "cell");
assert.equal(safe.speed, 0);
assert.equal(safe.dna, 1000000);
assert.deepEqual(safe.land.friends, [0]);
assert.deepEqual(safe.land.discoveries, ["arch"]);
state.health = 0;
state.land.x = 32;
state.land.y = -23;
saveJourney(storage, state);
const recovered = loadJourney(storage);
assert.equal(recovered.health, 100);
assert.equal(recovered.land.x, 0);
assert.equal(recovered.land.y, 0);
assert.equal(recovered.stage, "creature");
assert.equal(
  recovered.dna,
  17,
  "Reloading after death applies the same cost as returning to the nest",
);
assert.equal(
  saveJourney(
    {
      setItem() {
        throw Error("Quota");
      },
    },
    state,
  ),
  false,
);
assert.equal(
  loadJourney({
    getItem() {
      throw Error("Blocked");
    },
  }),
  null,
);
console.log(
  "PASS: gated transition, save round-trip, invalid saves, storage failure, and dead-save recovery.",
);
