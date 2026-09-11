// A repeatable frontier: generated planet properties stay identical after reload.
const names = [
  "Solara",
  "Vesper",
  "Mira",
  "Orison",
  "Kepler",
  "Nacre",
  "Aster",
  "Lyra",
  "Eden",
];
export const SYSTEMS = names.map((name, i) => ({
  id: i,
  name,
  x: ((i % 3) - 1) * 66,
  y: (Math.floor(i / 3) - 1) * 52,
  color: [0xffcc77, 0x86bfff, 0xef9bba][i % 3],
  planets: Array.from({ length: 3 }, (_, p) => ({
    id: i * 3 + p,
    name: `${name} ${["I", "II", "III"][p]}`,
    kind:
      p === 1 ? "Ocean garden" : p === 0 ? "Mineral world" : "Frozen frontier",
    habitable: p === 1,
    inhabited: p === 1 && i > 0 && i % 2 === 0,
    color: [0xc59475, 0x64c5a5, 0x9bbae8][p],
  })),
}));
export const PLANETS = SYSTEMS.flatMap((s) => s.planets);
export const newSpace = () => ({
  researched: false,
  system: 0,
  planet: 1,
  fuel: 12,
  ore: 35,
  data: 0,
  surveyed: [],
  colonies: [],
  contacts: [],
  completed: false,
});
export function normalizeSpace(raw = {}) {
  if (!raw || typeof raw !== "object") raw = {};
  const s = newSpace();
  s.researched = raw.researched === true;
  for (const key of ["system", "planet", "fuel", "ore", "data"]) {
    const max = { system: 8, planet: 2, fuel: 12, ore: 9999, data: 9999 }[key];
    s[key] = Number.isFinite(raw[key])
      ? Math.max(0, Math.min(max, raw[key]))
      : s[key];
  }
  s.system = Math.floor(s.system);
  s.planet = Math.floor(s.planet);
  for (const key of ["surveyed", "colonies", "contacts"])
    s[key] = [
      ...new Set(
        Array.isArray(raw[key])
          ? raw[key].filter((id) => Number.isInteger(id) && PLANETS[id])
          : [],
      ),
    ];
  s.colonies = s.colonies.filter(
    (id) => PLANETS[id].habitable && s.surveyed.includes(id),
  );
  s.contacts = s.contacts.filter(
    (id) => PLANETS[id].inhabited && s.surveyed.includes(id),
  );
  s.completed = raw.completed === true && beaconReady(s);
  return s;
}
export function researchSpace(state) {
  const v = state.village;
  if (state.stage !== "civilization" || !v.completed || state.space.researched)
    return false;
  if (v.resources.wood < 80 || v.resources.stone < 80) return false;
  v.resources.wood -= 80;
  v.resources.stone -= 80;
  state.space.researched = true;
  return true;
}
export function launchSpace(state) {
  const v = state.village;
  if (state.stage !== "civilization" || !v.completed || !state.space.researched)
    return false;
  if (v.resources.wood < 80 || v.resources.stone < 40 || v.resources.food < 60)
    return false;
  v.resources.wood -= 80;
  v.resources.stone -= 40;
  v.resources.food -= 60;
  state.stage = "space";
  state.health = 100;
  return true;
}
export function jump(s, id) {
  if (!Number.isInteger(id) || !SYSTEMS[id] || id === s.system || s.fuel < 3)
    return false;
  s.fuel -= 3;
  s.system = id;
  s.planet = 1;
  return true;
}
export function survey(s) {
  const id = s.system * 3 + s.planet;
  if (s.surveyed.includes(id)) return false;
  s.surveyed.push(id);
  s.ore += 18;
  s.data += 12;
  return true;
}
export function colonize(s) {
  const id = s.system * 3 + s.planet;
  if (
    !PLANETS[id].habitable ||
    !s.surveyed.includes(id) ||
    s.colonies.includes(id) ||
    s.ore < 40 ||
    s.data < 20
  )
    return false;
  s.ore -= 40;
  s.data -= 20;
  s.colonies.push(id);
  return true;
}
export function contact(s) {
  const id = s.system * 3 + s.planet;
  if (
    !PLANETS[id].inhabited ||
    !s.surveyed.includes(id) ||
    s.contacts.includes(id)
  )
    return false;
  s.contacts.push(id);
  s.ore += 20;
  s.data += 15;
  return true;
}
export function beaconReady(s) {
  return (
    s.surveyed.length >= 6 && s.colonies.length >= 3 && s.contacts.length >= 2
  );
}
export function buildBeacon(s) {
  if (s.completed || !beaconReady(s) || s.ore < 60 || s.data < 40) return false;
  s.ore -= 60;
  s.data -= 40;
  s.completed = true;
  return true;
}
export function tickSpace(s, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  s.fuel = Math.min(12, s.fuel + dt * 0.3);
  s.ore = Math.min(9999, s.ore + s.colonies.length * dt * 0.12);
}
