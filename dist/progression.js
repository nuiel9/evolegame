import { newSettlement, normalizeSettlement } from "./settlement-rules.js";
import { newSpace, normalizeSpace } from "./space-rules.js";
// Keep the storage key stable so existing cell and creature journeys migrate.
export const SAVE_KEY = "primordia.journey.v2";
export const newJourney = () => ({
  stage: "cell",
  dna: 0,
  health: 100,
  eaten: 0,
  generation: 1,
  speed: 0,
  armor: 0,
  magnet: 0,
  dashes: 0,
  elapsed: 0,
  color: 0xb0dc86,
  cellPosition: { x: 0, y: 0 },
  land: {
    x: 0,
    y: 0,
    hunger: 100,
    fruit: 0,
    friends: [],
    discoveries: [],
    completed: false,
  },
  village: newSettlement(),
  space: newSpace(),
});

export function canWalk(state) {
  return (
    state.stage === "cell" &&
    state.generation >= 4 &&
    state.speed + state.armor + state.magnet >= 3
  );
}

export function enterCreatureStage(state) {
  if (!canWalk(state)) return false;
  state.stage = "creature";
  state.health = 100;
  state.land.hunger = 100;
  return true;
}

export function chapterComplete(state) {
  return (
    state.land.fruit >= 12 &&
    state.land.friends.length >= 2 &&
    state.land.discoveries.length >= 3
  );
}

export function canFound(state) {
  return state.stage === "creature" && chapterComplete(state);
}

export function enterCivilizationStage(state) {
  if (!canFound(state)) return false;
  state.stage = "civilization";
  state.land.completed = true;
  state.land.x = 0;
  state.land.y = 0;
  state.land.hunger = 100;
  state.health = 100;
  state.village = newSettlement();
  return true;
}

function bounded(value, fallback, min, max) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function parseJourney(raw) {
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    if (
      ![2, 3, 4].includes(payload.version) ||
      !payload.state ||
      !["cell", "creature", "civilization", "space"].includes(
        payload.state.stage,
      )
    )
      return null;
    const data = payload.state,
      state = newJourney();
    for (const key of ["dna", "eaten", "dashes"])
      state[key] = Math.floor(bounded(data[key], 0, 0, 1000000));
    for (const key of ["speed", "armor", "magnet"])
      state[key] = Math.floor(bounded(data[key], 0, 0, 12));
    state.generation = 1 + state.speed + state.armor + state.magnet;
    state.health = bounded(data.health, 100, 0, 100);
    state.elapsed = bounded(data.elapsed, 0, 0, 1e8);
    state.color = Math.floor(bounded(data.color, state.color, 0, 0xffffff));
    state.cellPosition = {
      x: bounded(data.cellPosition?.x, 0, -79, 79),
      y: bounded(data.cellPosition?.y, 0, -69, 69),
    };
    const land = data.land || {};
    state.land = {
      x: bounded(land.x, 0, -72, 72),
      y: bounded(land.y, 0, -62, 62),
      hunger: bounded(land.hunger, 100, 0, 100),
      fruit: Math.floor(bounded(land.fruit, 0, 0, 1e6)),
      friends: [
        ...new Set(
          Array.isArray(land.friends)
            ? land.friends.filter((x) => Number.isInteger(x) && x >= 0 && x < 7)
            : [],
        ),
      ],
      discoveries: [
        ...new Set(
          Array.isArray(land.discoveries)
            ? land.discoveries.filter((x) =>
                ["arch", "grove", "spire"].includes(x),
              )
            : [],
        ),
      ],
      completed: false,
    };
    state.land.completed = chapterComplete(state) && land.completed === true;
    if (data.stage !== "cell" && canWalk(state)) state.stage = "creature";
    if (["civilization", "space"].includes(data.stage) && canFound(state)) {
      state.stage = "civilization";
      state.land.completed = true;
      state.village = normalizeSettlement(data.village);
      state.space = normalizeSpace(data.space);
      if (
        data.stage === "space" &&
        state.village.completed &&
        state.space.researched
      )
        state.stage = "space";
    }
    if (state.health === 0) {
      if (state.stage === "cell") return newJourney();
      state.health = 100;
      state.land.hunger = 80;
      state.land.x = 0;
      state.land.y = 0;
      state.dna = Math.max(0, state.dna - 10);
    }
    return state;
  } catch {
    return null;
  }
}

export function saveJourney(storage, state) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 4, state }));
    return true;
  } catch {
    return false;
  }
}

export function loadJourney(storage) {
  try {
    return parseJourney(storage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}
