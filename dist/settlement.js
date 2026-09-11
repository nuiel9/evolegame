import * as THREE from "./three.module.js";
import {
  CreatureWorld,
  heightAt,
  makeCreature,
  animateCreature,
} from "./creature.js";
import {
  BUILDINGS,
  JOBS,
  placeBuilding,
  placementError,
  tickSettlement,
  repairBuilding,
  recoverSettlement,
} from "./settlement-rules.js";

const box = new THREE.BoxGeometry(1, 1, 1),
  sphere = new THREE.SphereGeometry(1, 12, 8);
const wood = new THREE.MeshStandardMaterial({
  color: 0x947358,
  roughness: 0.85,
});
const thatch = new THREE.MeshStandardMaterial({
  color: 0xc4a975,
  roughness: 1,
});
const stone = new THREE.MeshStandardMaterial({
  color: 0x9bada1,
  roughness: 0.85,
});
const dark = new THREE.MeshStandardMaterial({ color: 0x263f36 });
const green = new THREE.MeshStandardMaterial({ color: 0x93ac6d });
const amber = new THREE.MeshStandardMaterial({
  color: 0xffc581,
  emissive: 0xd97829,
  emissiveIntensity: 0.8,
});
function part(root, geometry, material, xyz, scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...xyz);
  m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
  return m;
}
export function buildingModel(type) {
  const root = new THREE.Group();
  if (type === "hearth") {
    const rim = part(
      root,
      new THREE.TorusGeometry(2.4, 0.25, 8, 30),
      stone,
      [0, 0, 0.2],
    );
    for (let i = 0; i < 5; i++) {
      const p = part(
        root,
        box,
        wood,
        [Math.sin(i) * 0.5, Math.cos(i) * 0.5, 0.35],
        [2, 0.3, 0.3],
      );
      p.rotation.z = i;
    }
    const flame = part(
      root,
      new THREE.ConeGeometry(0.7, 2, 7),
      amber,
      [0, 0, 1.25],
    );
    flame.rotation.x = Math.PI / 2;
    root.userData.flame = flame;
    root.userData.rim = rim;
    const light = new THREE.PointLight(0xffb66f, 25, 16);
    light.position.z = 3;
    root.add(light);
  } else if (type === "hut") {
    const walls = part(
      root,
      new THREE.CylinderGeometry(1.8, 2, 2.2, 10),
      wood,
      [0, 0, 1.1],
    );
    walls.rotation.x = Math.PI / 2;
    const roof = part(
      root,
      new THREE.ConeGeometry(2.6, 2.2, 10),
      thatch,
      [0, 0, 3],
    );
    roof.rotation.x = Math.PI / 2;
    part(root, box, dark, [0, -1.87, 0.85], [0.75, 0.15, 1.6]);
    for (const x of [-1, 1])
      part(root, box, amber, [x, -1.65, 1.35], [0.4, 0.15, 0.55]);
  } else if (type === "farm") {
    part(root, box, wood, [0, 0, 0.1], [4.8, 4.8, 0.25]);
    for (let i = 0; i < 4; i++) {
      part(root, box, dark, [i * 1.1 - 1.65, 0, 0.25], [0.8, 4.2, 0.1]);
      for (let j = 0; j < 5; j++) {
        const stem = part(root, new THREE.ConeGeometry(0.23, 0.85, 4), green, [
          i * 1.1 - 1.65,
          j * 0.8 - 1.6,
          0.7,
        ]);
        stem.rotation.x = Math.PI / 2;
        part(
          root,
          sphere,
          amber,
          [i * 1.1 - 1.65 + 0.1, j * 0.8 - 1.6, 0.64],
          [0.16, 0.16, 0.17],
        );
      }
    }
  } else if (type === "tower") {
    for (const x of [-1.1, 1.1])
      for (const y of [-1.1, 1.1])
        part(root, box, wood, [x, y, 2.8], [0.28, 0.28, 5.6]);
    part(root, box, stone, [0, 0, 0.3], [2.8, 2.8, 0.6]);
    part(root, box, wood, [0, 0, 4.7], [3.2, 3.2, 0.4]);
    for (const x of [-1.5, 1.5])
      part(root, box, wood, [x, 0, 5.25], [0.2, 3.2, 0.8]);
    for (const y of [-1.5, 1.5])
      part(root, box, wood, [0, y, 5.25], [3.2, 0.2, 0.8]);
    const roof = part(
      root,
      new THREE.ConeGeometry(2.5, 1.8, 4),
      thatch,
      [0, 0, 7],
    );
    roof.rotation.x = Math.PI / 2;
    roof.rotation.y = Math.PI / 4;
    part(root, sphere, amber, [0, 0, 5.7], [0.35, 0.35, 0.55]);
  } else if (type === "lumber") {
    part(root, box, wood, [0, 0, 0.25], [4, 3, 0.5]);
    for (let i = 0; i < 6; i++) {
      const log = part(root, new THREE.CylinderGeometry(0.3, 0.3, 3, 8), wood, [
        (i % 3) * 0.7 - 0.7,
        0,
        0.65 + Math.floor(i / 3) * 0.55,
      ]);
      log.rotation.z = 0.08;
    }
    part(root, box, thatch, [0, 1.3, 2], [3.8, 1.4, 0.2]);
  } else if (type === "quarry") {
    for (let i = 0; i < 7; i++)
      part(
        root,
        new THREE.IcosahedronGeometry(1, 0),
        stone,
        [Math.sin(i * 2.2) * 1.2, Math.cos(i * 2.2) * 1.2, 0.5],
        [0.7, 0.9, 0.8 + i * 0.07],
      );
    part(root, box, wood, [0, 0, 2.2], [0.25, 0.25, 4.4]);
    part(root, box, wood, [0.7, 0, 4.2], [2, 0.25, 0.25]);
  } else if (type === "monument") {
    for (let i = 0; i < 3; i++) {
      const base = part(
        root,
        new THREE.CylinderGeometry(3 - i * 0.5, 3.2 - i * 0.5, 0.5, 8),
        stone,
        [0, 0, 0.25 + i * 0.5],
      );
      base.rotation.x = Math.PI / 2;
    }
    part(
      root,
      new THREE.OctahedronGeometry(1, 0),
      stone,
      [0, 0, 4.5],
      [1.25, 1.25, 4],
    );
    const halo = part(
      root,
      new THREE.TorusGeometry(1.6, 0.17, 8, 48),
      amber,
      [0, 0, 6.5],
    );
    halo.rotation.x = Math.PI / 2;
    root.userData.halo = halo;
    const light = new THREE.PointLight(0xcbeaac, 30, 20);
    light.position.z = 6;
    root.add(light);
  }
  return root;
}

export class SettlementWorld extends CreatureWorld {
  constructor(state, callbacks) {
    super(state, callbacks);
    this.village = state.village;
    this.buildType = null;
    this.selectedId = 1;
    this.plot = null;
    this.buildingViews = new Map();
    this.raiderViews = new Map();
    this.villagers = [];
    this.beams = [];
    for (const p of this.predators) {
      this.scene.remove(p.mesh);
      p.respawn = Infinity;
    }
    for (const f of this.friends) this.scene.remove(f.mesh);
    this.friends = [];
    this.nest.visible = false;
    this.boundary = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 160 }, (_, i) => {
          const a = (i / 160) * Math.PI * 2,
            x = Math.cos(a) * 34,
            y = Math.sin(a) * 34;
          return new THREE.Vector3(x, y, heightAt(x, y) + 0.12);
        }),
      ),
      new THREE.LineBasicMaterial({
        color: 0xd2dfa5,
        transparent: true,
        opacity: 0.4,
      }),
    );
    this.scene.add(this.boundary);
    this.ghost = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.94, 1, 64),
      new THREE.MeshBasicMaterial({
        color: 0xc4e995,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthTest: false,
      }),
    );
    ring.renderOrder = 10;
    this.ghost.add(ring);
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.ghostRing = ring;
    this.syncBuildings();
    this.syncVillagers();
    this.camera.position
      .copy(this.player.position)
      .add(new THREE.Vector3(0, -37, 42));
  }

  chooseBuilding(type) {
    if (!Object.hasOwn(BUILDINGS, type) || type === "hearth") {
      this.cancelPlacement();
      return false;
    }
    this.buildType = type;
    this.plot = null;
    this.selectedId = null;
    this.velocity.set(0, 0);
    return true;
  }
  cancelPlacement() {
    this.buildType = null;
    this.ghost.visible = false;
    this.plot = null;
  }
  updatePlot(pointer) {
    if (!this.buildType) return;
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(pointer, this.camera);
    const target = new THREE.Vector3();
    this.groundPlane.constant = 0;
    if (!this.ray.ray.intersectPlane(this.groundPlane, target)) {
      this.plot = null;
      this.ghost.visible = false;
      return;
    }
    for (let i = 0; i < 3; i++) {
      this.groundPlane.constant = -heightAt(target.x, target.y);
      if (!this.ray.ray.intersectPlane(this.groundPlane, target)) return;
    }
    const x = Math.round(target.x),
      y = Math.round(target.y);
    this.plot = {
      x,
      y,
      error: placementError(this.village, this.buildType, x, y),
    };
    this.ghost.visible = true;
    this.ghost.position.set(x, y, heightAt(x, y) + 0.2);
    this.ghost.scale.setScalar(BUILDINGS[this.buildType].radius);
    this.ghostRing.material.color.setHex(this.plot.error ? 0xe89983 : 0xc4e995);
  }
  placeAtPointer(pointer) {
    this.updatePlot(pointer);
    if (!this.plot || !this.buildType) return false;
    const result = placeBuilding(
      this.village,
      this.buildType,
      this.plot.x,
      this.plot.y,
    );
    if (!result.ok) {
      this.callbacks.toast(result.error);
      return false;
    }
    this.selectedId = result.building.id;
    this.callbacks.toast(
      `${BUILDINGS[this.buildType].name} construction started`,
    );
    this.cancelPlacement();
    this.syncBuildings();
    this.callbacks.save();
    return true;
  }
  selectAtPointer(pointer) {
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(pointer, this.camera);
    const intersections = this.ray.intersectObjects(
      [...this.buildingViews.values()],
      true,
    );
    for (const hit of intersections) {
      let node = hit.object;
      while (node && !node.userData.buildingId) node = node.parent;
      if (node) {
        this.selectedId = node.userData.buildingId;
        return true;
      }
    }
    return false;
  }
  repairSelected() {
    const ok = repairBuilding(this.village, this.selectedId);
    if (ok) {
      this.callbacks.toast("Building repaired · 10 wood");
      this.callbacks.save();
    }
    return ok;
  }
  syncBuildings() {
    for (const b of this.village.buildings) {
      let view = this.buildingViews.get(b.id);
      if (!view) {
        view = buildingModel(b.type);
        view.userData.buildingId = b.id;
        view.position.set(b.x, b.y, heightAt(b.x, b.y));
        this.scene.add(view);
        this.buildingViews.set(b.id, view);
        // Clear scenery under the exact building footprint, including restored saves.
        for (const object of this.scene.children) {
          if (
            object === view ||
            !object.isGroup ||
            object === this.player ||
            object === this.ghost ||
            object.userData.buildingId ||
            object.userData.body
          )
            continue;
          if (
            Math.hypot(object.position.x - b.x, object.position.y - b.y) <
            BUILDINGS[b.type].radius + 0.8
          )
            object.visible = false;
        }
        for (const f of this.fruit)
          if (
            Math.hypot(f.plant.position.x - b.x, f.plant.position.y - b.y) <
            BUILDINGS[b.type].radius + 1
          ) {
            f.plant.visible = false;
            f.cooldown = Infinity;
          }
      }
      view.visible = b.health > 0;
      view.scale.z = Math.max(0.08, b.progress);
      view.rotation.z = b.type === "farm" ? 0.1 : 0;
      if (view.userData.flame) {
        view.userData.flame.scale.set(
          1 + Math.sin(this.time * 9) * 0.09,
          1,
          1 + Math.sin(this.time * 7) * 0.08,
        );
      }
      if (view.userData.halo) view.userData.halo.rotation.z = this.time * 0.2;
    }
  }
  syncVillagers() {
    while (this.villagers.length < this.village.population) {
      const index = this.villagers.length,
        model = makeCreature(index % 2 ? 0xb6c988 : 0x87b9a0);
      model.scale.setScalar(0.58);
      model.position.set(0, 0, 0);
      const bundle = new THREE.Group();
      part(bundle, box, wood, [0, -0.2, 2.6], [0.7, 0.5, 0.4]);
      model.add(bundle);
      this.scene.add(model);
      this.villagers.push({ model, bundle, job: "idle", phase: index * 1.8 });
    }
    let index = 0;
    for (const job of JOBS)
      for (let i = 0; i < this.village.jobs[job]; i++)
        this.villagers[index++].job = job;
    while (index < this.villagers.length) this.villagers[index++].job = "idle";
  }
  attack() {
    if (this.cooldowns.attack > 0) return false;
    super.attack();
    for (const r of this.village.raiders)
      if (
        Math.hypot(r.x - this.player.position.x, r.y - this.player.position.y) <
        5
      )
        r.health -= 23 + this.state.speed * 2;
    return true;
  }
  sing() {
    return false;
  }
  context() {
    if (this.buildType)
      return (
        this.plot?.error ||
        `Place ${BUILDINGS[this.buildType].name} · Click ground · Esc cancels`
      );
    if (this.village.raiders.length)
      return "Raid underway · Defend your buildings with Q";
    return "B · Build    Click a building to inspect or repair";
  }
  step(dt, input) {
    if (this.village.defeated) return;
    const beforeFruit = this.state.land.fruit;
    if (this.buildType) {
      this.updatePlot(input.pointer);
      super.step(dt, {
        ...input,
        move: new THREE.Vector2(),
        pointerDown: false,
      });
    } else super.step(dt, input);
    if (this.state.health <= 0) return;
    this.village.resources.food = Math.min(
      9999,
      this.village.resources.food + (this.state.land.fruit - beforeFruit) * 4,
    );
    const events = tickSettlement(this.village, dt);
    for (const event of events) {
      if (event.type === "built")
        this.callbacks.toast(`${BUILDINGS[event.building.type].name} ready`);
      if (event.type === "recruited")
        this.callbacks.toast("A new villager has arrived · Assign their work");
      if (event.type === "raid") {
        this.callbacks.toast(`Raid ${event.wave} · Defend the settlement!`);
        this.callbacks.note(140, 0.4);
      }
      if (event.type === "defended")
        this.callbacks.toast(`Raid repelled · +20 wood, +15 stone`);
      if (event.type === "destroyed")
        this.callbacks.toast(
          `${BUILDINGS[event.building.type].name} destroyed`,
        );
      if (event.type === "defeated") this.callbacks.settlementDefeat();
      if (event.type === "victory") this.callbacks.victory();
      this.callbacks.save();
    }
    this.syncBuildings();
    this.syncVillagers();
    const cycle = Math.sin(this.time * 0.018);
    this.sun.intensity = 2.7 + cycle * 0.6;
    for (const [i, worker] of this.villagers.entries()) {
      const sources = {
        wood: [-17, 10],
        stone: [18, 7],
        food: [-8, -15],
        guard: [Math.cos(i * 2) * 9, Math.sin(i * 2) * 9],
        idle: [Math.sin(i) * 4, Math.cos(i) * 4],
      };
      const farm = this.village.buildings.find(
        (b) => b.type === "farm" && b.health > 0 && b.progress >= 1,
      );
      if (farm) sources.food = [farm.x, farm.y];
      const t = (Math.sin(this.time * 0.35 + worker.phase) + 1) / 2,
        [x, y] = sources[worker.job];
      const targetX =
        worker.job === "guard"
          ? x + Math.sin(this.time + i)
          : x * t + Math.sin(i) * 2;
      const targetY =
        worker.job === "guard"
          ? y + Math.cos(this.time + i)
          : y * t + Math.cos(i) * 2;
      const p = worker.model.position,
        dx = targetX - p.x,
        dy = targetY - p.y;
      p.x += dx * Math.min(1, dt * 4);
      p.y += dy * Math.min(1, dt * 4);
      p.z = heightAt(p.x, p.y);
      if (Math.hypot(dx, dy) > 0.03)
        worker.model.rotation.z = -Math.atan2(dx, dy);
      worker.bundle.visible =
        ["wood", "stone", "food"].includes(worker.job) &&
        Math.cos(this.time * 0.35 + worker.phase) < 0;
      animateCreature(worker.model, this.time + i, Math.hypot(dx, dy) > 0.03);
    }
    const ids = new Set();
    for (const r of this.village.raiders) {
      ids.add(r.id);
      let view = this.raiderViews.get(r.id);
      if (!view) {
        view = makeCreature(0xb86b56, true);
        this.scene.add(view);
        this.raiderViews.set(r.id, view);
      }
      const dx = r.x - view.position.x,
        dy = r.y - view.position.y;
      view.rotation.z = -Math.atan2(dx, dy);
      view.position.set(r.x, r.y, heightAt(r.x, r.y));
      animateCreature(view, this.time + r.id, true);
    }
    for (const [id, view] of this.raiderViews)
      if (!ids.has(id)) {
        this.scene.remove(view);
        const materials = new Set();
        view.traverse((o) => {
          if (o.material) materials.add(o.material);
        });
        materials.forEach((m) => m.dispose());
        this.raiderViews.delete(id);
      }
    // Brief projectiles make the automatic tower defenses readable.
    if (Math.floor(this.time * 3) !== Math.floor((this.time - dt) * 3)) {
      for (const b of this.village.buildings.filter(
        (b) => b.type === "tower" && b.progress >= 1 && b.health > 0,
      )) {
        const target = this.village.raiders.find(
          (r) => Math.hypot(r.x - b.x, r.y - b.y) < 19,
        );
        if (!target) continue;
        const beam = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(b.x, b.y, heightAt(b.x, b.y) + 5.7),
            new THREE.Vector3(
              target.x,
              target.y,
              heightAt(target.x, target.y) + 1.3,
            ),
          ]),
          new THREE.LineBasicMaterial({
            color: 0xffd6a0,
            transparent: true,
            opacity: 0.8,
          }),
        );
        this.scene.add(beam);
        this.beams.push({ beam, life: 0.12 });
      }
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.beam);
        b.beam.geometry.dispose();
        b.beam.material.dispose();
        this.beams.splice(i, 1);
      }
    }
  }
  updateCamera(dt) {
    const p = this.player.position,
      mobile = this.camera.aspect < 1;
    this.camera.position.lerp(
      p.clone().add(new THREE.Vector3(0, mobile ? -49 : -37, mobile ? 54 : 42)),
      1 - Math.exp(-dt * 4),
    );
    this.camera.lookAt(p.clone().add(new THREE.Vector3(0, 3, 0)));
    this.sun.position.copy(p).add(new THREE.Vector3(-25, -18, 55));
    this.sun.target.position.copy(p);
  }
  recover() {
    recoverSettlement(this.village);
    this.respawn();
    this.cancelPlacement();
    this.syncBuildings();
  }
  drawMap(ctx) {
    super.drawMap(ctx);
    const p = this.player.position;
    const dot = (x, y, color, size) => {
      x = 90 + (x - p.x) * 1.2;
      y = 70 - (y - p.y) * 1.2;
      if (x < 2 || x > 178 || y < 2 || y > 138) return;
      ctx.fillStyle = color;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    };
    this.village.buildings
      .filter((b) => b.health > 0)
      .forEach((b) =>
        dot(b.x, b.y, b.type === "hearth" ? "#fff2c9" : "#badca8", 4),
      );
    this.village.raiders.forEach((r) => dot(r.x, r.y, "#f19580", 4));
  }
}
