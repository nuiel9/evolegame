export const BUILDINGS = {
  hearth: {
    name: "Hearth",
    icon: "◉",
    radius: 3,
    health: 300,
    seconds: 0,
    cost: {},
  },
  hut: {
    name: "Dwelling",
    icon: "⌂",
    radius: 2.6,
    health: 140,
    seconds: 10,
    cost: { wood: 25, stone: 8 },
    description: "Room for two more villagers.",
  },
  farm: {
    name: "Garden",
    icon: "❧",
    radius: 3,
    health: 100,
    seconds: 12,
    cost: { wood: 30, stone: 5 },
    description: "Produces 0.8 food each second.",
  },
  lumber: {
    name: "Wood camp",
    icon: "♧",
    radius: 2.5,
    health: 140,
    seconds: 14,
    cost: { wood: 25, stone: 15 },
    description: "Woodcutters gather 50% faster.",
  },
  quarry: {
    name: "Stone works",
    icon: "◇",
    radius: 2.5,
    health: 170,
    seconds: 14,
    cost: { wood: 25, stone: 25 },
    description: "Stoneworkers gather 50% faster.",
  },
  tower: {
    name: "Watchtower",
    icon: "♜",
    radius: 2.2,
    health: 200,
    seconds: 18,
    cost: { wood: 40, stone: 30 },
    description: "Automatically fires at nearby raiders.",
  },
  monument: {
    name: "Life monument",
    icon: "✧",
    radius: 3.2,
    health: 400,
    seconds: 30,
    cost: { wood: 150, stone: 150, food: 80 },
    description: "A lasting home for your species.",
  },
};
export const JOBS = ["wood", "stone", "food", "guard"];
export const newSettlement = () => ({
  resources: { wood: 110, stone: 85, food: 90 },
  population: 4,
  jobs: { wood: 2, stone: 1, food: 1, guard: 0 },
  buildings: [{ id: 1, type: "hearth", x: 0, y: 0, progress: 1, health: 300 }],
  nextId: 2,
  elapsed: 0,
  nextRaid: 120,
  wave: 0,
  survived: 0,
  raiders: [],
  recruitTime: 0,
  completed: false,
  defeated: false,
});
export const finished = (v, type) =>
  v.buildings.filter((b) => b.type === type && b.health > 0 && b.progress >= 1);
export const capacity = (v) => 4 + finished(v, "hut").length * 2;
export const idleWorkers = (v) =>
  v.population - JOBS.reduce((total, job) => total + v.jobs[job], 0);
export const affordable = (v, cost) =>
  Object.entries(cost).every(([key, value]) => v.resources[key] >= value);
const spend = (v, cost) => {
  for (const [key, value] of Object.entries(cost)) v.resources[key] -= value;
};
export function monumentRequirements(v) {
  return [
    {
      done: v.population >= 8,
      text: `Grow to 8 villagers (${v.population}/8)`,
    },
    {
      done: finished(v, "farm").length >= 2,
      text: `Build 2 gardens (${finished(v, "farm").length}/2)`,
    },
    {
      done: finished(v, "tower").length >= 2,
      text: `Build 2 watchtowers (${finished(v, "tower").length}/2)`,
    },
    { done: v.survived >= 2, text: `Repel 2 raids (${v.survived}/2)` },
  ];
}
export function placementError(v, type, x, y) {
  if (!Object.hasOwn(BUILDINGS, type) || type === "hearth")
    return "Choose a building.";
  if (v.defeated) return "Restore your settlement first.";
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) > 34)
    return "Build within the marked settlement boundary.";
  if (v.buildings.filter((b) => b.health > 0).length >= 40)
    return "The settlement has room for 40 buildings.";
  if (type === "monument") {
    if (v.buildings.some((b) => b.type === "monument" && b.health > 0))
      return "Your monument is already underway.";
    const unmet = monumentRequirements(v).find((r) => !r.done);
    if (unmet) return unmet.text;
  }
  for (const b of v.buildings)
    if (
      b.health > 0 &&
      Math.hypot(b.x - x, b.y - y) <
        BUILDINGS[b.type].radius + BUILDINGS[type].radius + 0.7
    )
      return "Leave more space between buildings.";
  if (!affordable(v, BUILDINGS[type].cost))
    return "Gather more resources first.";
  return null;
}
export function placeBuilding(v, type, x, y) {
  const error = placementError(v, type, x, y);
  if (error) return { ok: false, error };
  spend(v, BUILDINGS[type].cost);
  v.buildings = v.buildings.filter((b) => b.health > 0 || b.type === "hearth");
  const building = {
    id: v.nextId++,
    type,
    x,
    y,
    progress: 0,
    health: BUILDINGS[type].health,
  };
  v.buildings.push(building);
  return { ok: true, building };
}
export function assignWorker(v, job, delta) {
  if (!JOBS.includes(job) || ![-1, 1].includes(delta) || v.defeated)
    return false;
  if (
    (delta === 1 && idleWorkers(v) <= 0) ||
    (delta === -1 && v.jobs[job] <= 0)
  )
    return false;
  v.jobs[job] += delta;
  return true;
}
export function recruit(v) {
  if (
    v.defeated ||
    v.recruitTime > 0 ||
    v.population >= Math.min(16, capacity(v)) ||
    v.resources.food < 25
  )
    return false;
  v.resources.food -= 25;
  v.recruitTime = 12;
  return true;
}
export function repairBuilding(v, id) {
  const b = v.buildings.find((b) => b.id === id);
  if (
    v.defeated ||
    !b ||
    b.health <= 0 ||
    b.progress < 1 ||
    b.health >= BUILDINGS[b.type].health ||
    v.resources.wood < 10
  )
    return false;
  v.resources.wood -= 10;
  b.health = Math.min(BUILDINGS[b.type].health, b.health + 100);
  return true;
}
export function production(v) {
  return {
    wood:
      v.jobs.wood * (0.7 + Math.min(2, finished(v, "lumber").length) * 0.35),
    stone:
      v.jobs.stone * (0.55 + Math.min(2, finished(v, "quarry").length) * 0.275),
    food:
      v.jobs.food * 0.85 +
      finished(v, "farm").length * 0.8 -
      v.population * 0.1,
  };
}
export function beginRaid(v) {
  if (v.raiders.length || v.defeated || v.completed) return false;
  v.wave++;
  for (let i = 0; i < Math.min(7, 2 + v.wave); i++) {
    const angle = v.wave * 2.3 + i * 0.22;
    v.raiders.push({
      id: v.wave * 10 + i,
      x: Math.cos(angle) * (37 + i),
      y: Math.sin(angle) * (37 + i),
      health: 35 + v.wave * 9,
    });
  }
  return true;
}
export function tickSettlement(v, delta) {
  if (v.defeated) return [];
  const dt = Math.max(0, Math.min(0.25, Number.isFinite(delta) ? delta : 0));
  const events = [];
  v.elapsed += dt;
  for (const b of v.buildings) {
    if (b.health <= 0 || b.progress >= 1) continue;
    b.progress = Math.min(1, b.progress + dt / BUILDINGS[b.type].seconds);
    if (b.progress >= 1) events.push({ type: "built", building: b });
  }
  const rates = production(v);
  for (const key of ["wood", "stone", "food"])
    v.resources[key] = Math.max(
      0,
      Math.min(9999, v.resources[key] + rates[key] * dt),
    );
  if (
    v.recruitTime > 0 &&
    v.resources.food > 0 &&
    v.population < Math.min(16, capacity(v))
  ) {
    v.recruitTime = Math.max(0, v.recruitTime - dt);
    if (v.recruitTime === 0) {
      v.population++;
      events.push({ type: "recruited" });
    }
  }
  if (v.resources.food === 0) {
    const hearth = v.buildings.find((b) => b.type === "hearth");
    if (hearth) hearth.health = Math.max(0, hearth.health - dt * 1.5);
  }
  const hadRaid = v.raiders.length > 0;
  if (!hadRaid && !v.completed) {
    v.nextRaid = Math.max(0, v.nextRaid - dt);
    if (v.nextRaid === 0 && beginRaid(v))
      events.push({ type: "raid", wave: v.wave });
  }
  for (const tower of finished(v, "tower")) {
    const target = v.raiders
      .filter(
        (r) => r.health > 0 && Math.hypot(r.x - tower.x, r.y - tower.y) < 19,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - tower.x, a.y - tower.y) -
          Math.hypot(b.x - tower.x, b.y - tower.y),
      )[0];
    if (target) target.health -= 20 * dt;
  }
  for (const raider of v.raiders) {
    if (raider.health <= 0) continue;
    const buildings = v.buildings
      .filter((b) => b.health > 0)
      .sort(
        (a, b) =>
          Math.hypot(a.x - raider.x, a.y - raider.y) -
          Math.hypot(b.x - raider.x, b.y - raider.y),
      );
    const target = buildings[0];
    if (!target) continue;
    const dx = target.x - raider.x,
      dy = target.y - raider.y,
      distance = Math.hypot(dx, dy);
    if (distance > BUILDINGS[target.type].radius + 0.9) {
      raider.x += (dx / distance) * dt * 2;
      raider.y += (dy / distance) * dt * 2;
    } else {
      target.health = Math.max(0, target.health - dt * 7);
      raider.health -= dt * (3 + v.jobs.guard * 6);
      if (target.health === 0)
        events.push({ type: "destroyed", building: target });
    }
  }
  v.raiders = v.raiders.filter((r) => r.health > 0);
  if (hadRaid && v.raiders.length === 0) {
    v.survived++;
    v.nextRaid = 100;
    v.resources.wood += 20;
    v.resources.stone += 15;
    events.push({ type: "defended", wave: v.wave });
  }
  const hearth = v.buildings.find((b) => b.type === "hearth");
  if (!hearth || hearth.health <= 0) {
    v.defeated = true;
    events.push({ type: "defeated" });
    return events;
  }
  if (!v.completed && finished(v, "monument").length) {
    v.completed = true;
    events.push({ type: "victory" });
  }
  return events;
}
export function recoverSettlement(v) {
  const hearth = v.buildings.find((b) => b.type === "hearth");
  if (hearth) {
    hearth.health = 300;
    hearth.progress = 1;
  }
  v.raiders = [];
  v.nextRaid = 120;
  v.defeated = false;
  v.resources.wood = Math.max(70, v.resources.wood);
  v.resources.stone = Math.max(45, v.resources.stone);
  v.resources.food = Math.max(60, v.resources.food);
}

export function normalizeSettlement(raw) {
  const v = newSettlement();
  if (!raw || typeof raw !== "object") return v;
  const num = (value, fallback, max, min = 0) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;
  for (const key of ["wood", "stone", "food"])
    v.resources[key] = num(raw.resources?.[key], v.resources[key], 9999);
  v.population = Math.floor(num(raw.population, 4, 16, 4));
  let remaining = v.population;
  for (const job of JOBS) {
    v.jobs[job] = Math.floor(num(raw.jobs?.[job], 0, remaining));
    remaining -= v.jobs[job];
  }
  v.buildings = [];
  for (const b of Array.isArray(raw.buildings)
    ? raw.buildings.slice(0, 40)
    : []) {
    if (!b || !Object.hasOwn(BUILDINGS, b.type)) continue;
    if (b.type === "hearth" && v.buildings.some((x) => x.type === "hearth"))
      continue;
    v.buildings.push({
      id: v.buildings.length + 1,
      type: b.type,
      x: b.type === "hearth" ? 0 : num(b.x, 0, 34, -34),
      y: b.type === "hearth" ? 0 : num(b.y, 0, 34, -34),
      progress: num(b.progress, 0, 1),
      health: num(b.health, BUILDINGS[b.type].health, BUILDINGS[b.type].health),
    });
  }
  if (!v.buildings.some((b) => b.type === "hearth"))
    v.buildings.unshift({ ...newSettlement().buildings[0], id: 41 });
  v.nextId = Math.max(...v.buildings.map((b) => b.id)) + 1;
  v.elapsed = num(raw.elapsed, 0, 1e8);
  v.nextRaid = num(raw.nextRaid, 120, 120);
  v.wave = Math.floor(num(raw.wave, 0, 1e5));
  v.survived = Math.floor(num(raw.survived, 0, v.wave));
  v.recruitTime = num(raw.recruitTime, 0, 12);
  if (v.population >= 16) v.recruitTime = 0;
  v.raiders = (Array.isArray(raw.raiders) ? raw.raiders : [])
    .slice(0, 7)
    .filter((r) => r && typeof r === "object")
    .map((r, i) => ({
      id: v.wave * 10 + i,
      x: num(r.x, 38, 60, -60),
      y: num(r.y, 0, 60, -60),
      health: num(r.health, 44, 10000),
    }))
    .filter((r) => r.health > 0);
  v.defeated = v.buildings.find((b) => b.type === "hearth").health === 0;
  v.completed = finished(v, "monument").length > 0;
  return v;
}
