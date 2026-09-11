import * as THREE from "./three.module.js";
import { chapterComplete } from "./progression.js";

const clamp = THREE.MathUtils.clamp;
export const heightAt = (x, y) =>
  Math.sin(x * 0.055) * Math.cos(y * 0.065) * 3.4 +
  Math.sin(y * 0.14 + x * 0.06) * 0.8 -
  Math.max(0, x - 51) * 0.3;
const ground = (x, y) => new THREE.Vector3(x, y, heightAt(x, y));
export const LANDMARKS = [
  { id: "arch", name: "The Ancestor’s Gate", x: 19, y: 25, color: 0xe6d5a7 },
  { id: "grove", name: "The Singing Grove", x: -28, y: 20, color: 0xa4d5d5 },
  { id: "spire", name: "The Sunstone", x: 32, y: -23, color: 0xeeb873 },
];
const material = (color, roughness = 0.7) =>
  new THREE.MeshStandardMaterial({ color, roughness });
const sphere = new THREE.SphereGeometry(1, 20, 14);
const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
const up = new THREE.Vector3(0, 0, 1);

function mesh(geometry, mat, parent, position, scale) {
  const m = new THREE.Mesh(geometry, mat);
  if (position) m.position.set(...position);
  if (scale) m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function makeCreature(color, hunter = false, traits = {}) {
  const root = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.48,
    metalness: 0.02,
  });
  const belly = material(hunter ? 0xedb091 : 0xe1e6ba);
  const body = new THREE.Group();
  root.add(body);
  mesh(sphere, skin, body, [0, 0, 1.37], [0.72, 1.13, 0.77]);
  mesh(sphere, belly, body, [0, 0.32, 1.28], [0.55, 0.83, 0.53]);
  mesh(sphere, skin, body, [0, 0.9, 2.1], [0.64, 0.62, 0.57]);
  mesh(sphere, belly, body, [0, 1.37, 1.96], [0.42, 0.35, 0.23]);
  const eyeWhite = material(0xf3efdd, 0.25),
    pupilMat = material(0x12342e, 0.2);
  for (const x of [-0.33, 0.33]) {
    mesh(sphere, eyeWhite, body, [x, 1.29, 2.29], [0.23, 0.23, 0.24]);
    mesh(sphere, pupilMat, body, [x, 1.48, 2.29], [0.12, 0.09, 0.15]);
    mesh(
      sphere,
      material(0xffffff),
      body,
      [x - 0.035, 1.55, 2.35],
      [0.035, 0.026, 0.035],
    );
  }
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Group();
    leg.position.set(i % 2 ? 0.54 : -0.54, i < 2 ? 0.56 : -0.6, 0.93);
    body.add(leg);
    mesh(sphere, skin, leg, [0, 0, -0.25], [0.19, 0.2, 0.54]);
    mesh(sphere, belly, leg, [0, 0.13, -0.78], [0.25, 0.39, 0.16]);
    legs.push(leg);
  }
  const tail = new THREE.Group();
  tail.position.set(0, -0.8, 1.5);
  body.add(tail);
  mesh(sphere, skin, tail, [0, -0.65, -0.1], [0.2, 0.95, 0.24]);
  const horns = new THREE.Group();
  body.add(horns);
  for (let i = 0; i < (hunter ? 5 : 3); i++) {
    const horn = mesh(
      new THREE.ConeGeometry(0.15, hunter ? 0.65 : 0.38, 8),
      material(hunter ? 0xead8b2 : 0xdce5a5),
      horns,
      [0, -0.6 + i * 0.4, 2.07],
    );
    horn.rotation.x = Math.PI / 2;
  }
  const armor = new THREE.Group();
  body.add(armor);
  for (let i = 0; i < Math.min(traits.armor || 0, 6); i++)
    mesh(
      rockGeometry,
      material(0x73967c),
      armor,
      [i % 2 ? 0.58 : -0.58, -0.45 + Math.floor(i / 2) * 0.42, 1.75],
      [0.24, 0.3, 0.16],
    );
  root.userData = { body, legs, tail, skin, phase: 0, hunter };
  return root;
}

export function animateCreature(c, time, moving, singing = false) {
  const d = c.userData,
    phase = time * (moving ? 10 : 2);
  d.body.position.z = Math.sin(phase * 2) * (moving ? 0.055 : 0.018);
  d.legs.forEach((leg, i) => {
    leg.rotation.x = moving
      ? Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.48
      : 0;
  });
  d.tail.rotation.z = Math.sin(time * 2) * 0.18;
  d.body.rotation.x = singing ? Math.sin(time * 12) * 0.09 : 0;
}

export class CreatureWorld {
  constructor(state, callbacks) {
    this.state = state;
    this.callbacks = callbacks;
    this.time = 0;
    this.velocity = new THREE.Vector2();
    this.cooldowns = { dash: 0, attack: 0, sing: 0, damage: 4 };
    this.dashTime = 0;
    this.attackFlash = 0;
    this.singFlash = 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x779f99);
    this.scene.fog = new THREE.FogExp2(0x779f99, 0.013);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 230);
    this.camera.up.copy(up);
    this.scene.add(new THREE.HemisphereLight(0xf4edcb, 0x36574f, 2.15));
    const sun = new THREE.DirectionalLight(0xffead0, 3.4);
    sun.position.set(-25, -18, 55);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -42,
      right: 42,
      top: 42,
      bottom: -42,
      near: 1,
      far: 160,
    });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.05;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.rng = 1129;
    this.buildTerrain();
    this.buildFlora();
    this.buildNest();
    this.buildLandmarks();
    this.player = makeCreature(state.color, false, state);
    this.player.position.copy(ground(state.land.x, state.land.y));
    this.scene.add(this.player);
    this.fruit = [];
    this.friends = [];
    this.predators = [];
    this.rings = [];
    this.buildLife();
    this.camera.position
      .copy(this.player.position)
      .add(new THREE.Vector3(0, -24, 24));
    this.camera.lookAt(
      this.player.position.clone().add(new THREE.Vector3(0, 2, 1)),
    );
    this.ray = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(up, 0);
  }

  random(a = 0, b = 1) {
    this.rng = (this.rng * 16807) % 2147483647;
    return a + ((this.rng - 1) / 2147483646) * (b - a);
  }

  buildTerrain() {
    const geometry = new THREE.PlaneGeometry(180, 160, 150, 130),
      positions = geometry.attributes.position;
    const colors = [],
      color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        z = heightAt(x, y);
      positions.setZ(i, z);
      const variation =
        Math.sin(x * 0.3 + y * 0.17) * 0.035 + this.random(-0.025, 0.025);
      color.setHSL(
        x > 50 ? 0.13 : 0.25 + variation,
        x > 50 ? 0.25 : 0.25,
        x > 50 ? 0.43 : 0.27 + z * 0.008 + variation,
      );
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const terrain = mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
      this.scene,
    );
    terrain.castShadow = false;
    this.water = mesh(
      new THREE.PlaneGeometry(320, 280),
      new THREE.MeshPhysicalMaterial({
        color: 0x458f8e,
        roughness: 0.25,
        metalness: 0.25,
        transparent: true,
        opacity: 0.88,
      }),
      this.scene,
      [0, 0, -3.1],
    );
    this.water.castShadow = false;
    // Distant ridges frame the playable valley.
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const m = mesh(
        new THREE.ConeGeometry(this.random(10, 20), this.random(15, 37), 6),
        material(0x617f76),
        this.scene,
        [Math.cos(a) * 103, Math.sin(a) * 93, 1],
      );
      m.rotation.x = Math.PI / 2;
      m.castShadow = false;
    }
  }

  buildFlora() {
    const trunkMat = material(0x586753),
      canopyMat = material(0x628d77),
      topMat = material(0x83a384);
    const rockMat = material(0x7f8770);
    for (let i = 0; i < 95; i++) {
      const x = this.random(-78, 48),
        y = this.random(-70, 70);
      if (
        Math.hypot(x, y) < 9 ||
        LANDMARKS.some((l) => Math.hypot(l.x - x, l.y - y) < 6)
      )
        continue;
      const root = new THREE.Group();
      root.position.copy(ground(x, y));
      this.scene.add(root);
      const h = this.random(3, 8);
      const trunk = mesh(
        new THREE.CylinderGeometry(0.18, 0.45, h, 7),
        trunkMat,
        root,
        [0, 0, h / 2],
      );
      trunk.rotation.x = Math.PI / 2;
      mesh(sphere, canopyMat, root, [0, 0, h], [h * 0.55, h * 0.48, h * 0.2]);
      mesh(
        sphere,
        topMat,
        root,
        [-h * 0.17, 0.1, h * 1.09],
        [h * 0.35, h * 0.32, h * 0.17],
      );
      if (i % 2 === 0)
        mesh(rockGeometry, rockMat, root, [1.4, 1, 0.4], [1.2, 0.8, 0.8]);
    }
    const grassGeometry = new THREE.ConeGeometry(0.075, 0.65, 3);
    grassGeometry.rotateX(Math.PI / 2);
    grassGeometry.translate(0, 0, 0.3);
    const grass = new THREE.InstancedMesh(
      grassGeometry,
      material(0x93a979),
      6000,
    );
    const matrix = new THREE.Matrix4(),
      q = new THREE.Quaternion();
    for (let i = 0; i < 6000; i++) {
      const x = this.random(-79, 49),
        y = this.random(-70, 70),
        scale = this.random(0.45, 1.8);
      q.setFromAxisAngle(up, this.random(0, Math.PI * 2));
      matrix.compose(ground(x, y), q, new THREE.Vector3(scale, scale, scale));
      grass.setMatrixAt(i, matrix);
    }
    this.scene.add(grass);
    const sporesGeometry = new THREE.BufferGeometry(),
      points = [];
    for (let i = 0; i < 250; i++)
      points.push(
        this.random(-65, 65),
        this.random(-60, 60),
        this.random(2, 14),
      );
    sporesGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    this.spores = new THREE.Points(
      sporesGeometry,
      new THREE.PointsMaterial({
        color: 0xfff1b2,
        size: 0.07,
        transparent: true,
        opacity: 0.65,
      }),
    );
    this.scene.add(this.spores);
  }

  buildNest() {
    this.nest = new THREE.Group();
    this.nest.position.copy(ground(0, 0));
    this.scene.add(this.nest);
    const nestRing = mesh(
      new THREE.TorusGeometry(3.3, 0.3, 8, 40),
      material(0x9b9a6b),
      this.nest,
      [0, 0, 0.08],
    );
    nestRing.scale.y = 0.85;
    const inner = mesh(
      new THREE.CircleGeometry(3, 40),
      material(0x9b9d6d),
      this.nest,
      [0, 0, 0.12],
    );
    inner.castShadow = false;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      mesh(
        sphere,
        material(0xaaba8b),
        this.nest,
        [Math.cos(a) * 2.3, Math.sin(a) * 2, 0.35],
        [0.32, 0.4, 0.48],
      );
    }
    this.nestBeacon = mesh(
      new THREE.RingGeometry(3.55, 3.6, 64),
      new THREE.MeshBasicMaterial({
        color: 0xd0e5ad,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      }),
      this.nest,
      [0, 0, 0.18],
    );
  }

  buildLandmarks() {
    for (const site of LANDMARKS) {
      const root = new THREE.Group();
      root.position.copy(ground(site.x, site.y));
      this.scene.add(root);
      const stone = material(site.color),
        glow = new THREE.MeshStandardMaterial({
          color: site.color,
          emissive: site.color,
          emissiveIntensity: 0.6,
          roughness: 0.4,
        });
      if (site.id === "arch") {
        const arch = mesh(
          new THREE.TorusGeometry(3.8, 0.7, 8, 24, Math.PI),
          stone,
          root,
          [0, 0, 0.1],
        );
        arch.rotation.x = Math.PI / 2;
        for (const x of [-3.8, 3.8])
          mesh(rockGeometry, stone, root, [x, 0, 0.2], [1, 1, 1.5]);
      } else if (site.id === "grove") {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2,
            x = Math.cos(a) * 3,
            y = Math.sin(a) * 3;
          const stem = mesh(
            new THREE.CylinderGeometry(0.18, 0.3, 3.5 + i * 0.4, 8),
            stone,
            root,
            [x, y, 1.8],
          );
          stem.rotation.x = Math.PI / 2;
          mesh(sphere, glow, root, [x, y, 3.6 + i * 0.2], [1.4, 1.4, 0.4]);
        }
      } else {
        for (let i = 0; i < 5; i++)
          mesh(
            new THREE.OctahedronGeometry(1, 0),
            i === 0 ? glow : stone,
            root,
            [(i - 2) * 0.9, Math.sin(i) * 0.7, i === 0 ? 3.8 : 2.3],
            [0.65, 0.65, i === 0 ? 4.8 : 2.8],
          );
      }
      const ring = mesh(
        new THREE.RingGeometry(4.7, 4.8, 64),
        new THREE.MeshBasicMaterial({
          color: site.color,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        }),
        root,
        [0, 0, 0.15],
      );
      ring.castShadow = false;
    }
  }

  buildLife() {
    const fruitMat = material(0xe3b079, 0.35),
      leafMat = material(0x668d63);
    for (let i = 0; i < 55; i++) {
      const x = i < 8 ? Math.cos(i * 0.8) * 8 : this.random(-55, 46),
        y = i < 8 ? Math.sin(i * 0.8) * 8 : this.random(-53, 53);
      const plant = new THREE.Group();
      plant.position.copy(ground(x, y));
      this.scene.add(plant);
      mesh(sphere, leafMat, plant, [0, 0, 0.48], [0.8, 0.8, 0.65]);
      const fruit = new THREE.Group();
      plant.add(fruit);
      for (let k = 0; k < 3; k++)
        mesh(
          sphere,
          fruitMat,
          fruit,
          [Math.cos(k * 2.1) * 0.4, Math.sin(k * 2.1) * 0.4, 0.97],
          [0.28, 0.28, 0.34],
        );
      this.fruit.push({ plant, fruit, cooldown: 0 });
    }
    for (let i = 0; i < 7; i++) {
      const c = makeCreature([0xc0b36f, 0x77b3ae, 0xb4a0bd][i % 3]);
      c.scale.setScalar(0.82);
      c.position.copy(
        ground(
          i < 2 ? -7 + i * 16 : this.random(-42, 37),
          i < 2 ? 11 : this.random(-40, 45),
        ),
      );
      this.scene.add(c);
      this.friends.push({
        id: i,
        mesh: c,
        home: c.position.clone(),
        bond: this.state.land.friends.includes(i) ? 3 : 0,
      });
    }
    for (let i = 0; i < 7; i++) {
      const c = makeCreature(0xb26c56, true);
      c.scale.setScalar(1.12);
      const a = (i / 7) * Math.PI * 2;
      c.position.copy(ground(Math.cos(a) * 30, Math.sin(a) * 29));
      this.scene.add(c);
      this.predators.push({
        mesh: c,
        home: c.position.clone(),
        health: 60,
        respawn: 0,
        flee: 0,
      });
    }
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  setColor(color) {
    this.player.userData.skin.color.setHex(color);
  }
  setTraits() {
    const old = this.player,
      replacement = makeCreature(this.state.color, false, this.state);
    replacement.position.copy(old.position);
    replacement.rotation.copy(old.rotation);
    this.scene.remove(old);
    this.scene.add(replacement);
    this.player = replacement;
    // Body meshes share geometry; only their unique materials are released.
    const materials = new Set();
    old.traverse((o) => {
      if (o.material) materials.add(o.material);
    });
    materials.forEach((m) => m.dispose());
  }

  pulse(position, color) {
    const ring = mesh(
      new THREE.RingGeometry(0.7, 0.76, 48),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      this.scene,
      [position.x, position.y, position.z + 0.25],
    );
    ring.castShadow = false;
    this.rings.push({ mesh: ring, age: 0 });
  }

  dash() {
    if (this.cooldowns.dash > 0) return false;
    this.cooldowns.dash = 3.5;
    this.dashTime = 0.4;
    this.state.dashes++;
    if (this.velocity.length() < 0.1)
      this.velocity.set(
        -Math.sin(this.player.rotation.z),
        Math.cos(this.player.rotation.z),
      );
    this.pulse(this.player.position, 0xe1eac0);
    return true;
  }

  attack() {
    if (this.cooldowns.attack > 0) return false;
    this.cooldowns.attack = 0.8;
    this.attackFlash = 0.3;
    this.pulse(this.player.position, 0xedb48a);
    for (const p of this.predators) {
      if (
        p.respawn > 0 ||
        p.mesh.position.distanceTo(this.player.position) > 4.6
      )
        continue;
      p.health -= 22 + this.state.speed * 2;
      p.flee = 2;
      if (p.health <= 0) {
        p.respawn = 35;
        p.mesh.visible = false;
        this.state.dna += 12;
        this.callbacks.toast("Hunter driven away · +12 DNA");
      }
    }
    this.callbacks.note(160, 0.12);
    return true;
  }

  sing() {
    if (this.cooldowns.sing > 0) return false;
    const nearby = this.friends
      .filter(
        (f) =>
          f.bond < 3 && f.mesh.position.distanceTo(this.player.position) < 6,
      )
      .sort(
        (a, b) =>
          a.mesh.position.distanceTo(this.player.position) -
          b.mesh.position.distanceTo(this.player.position),
      )[0];
    this.cooldowns.sing = 2;
    this.singFlash = 1;
    this.pulse(this.player.position, 0xa8e1d5);
    this.callbacks.note(520, 0.3);
    if (!nearby) {
      this.callbacks.toast("Sing near a peaceful creature to make a friend.");
      return true;
    }
    nearby.bond++;
    if (nearby.bond === 3) {
      this.state.land.friends.push(nearby.id);
      this.state.dna += 15;
      this.callbacks.toast(
        "A new friend! They will follow and protect you. +15 DNA",
      );
      this.callbacks.save();
    } else
      this.callbacks.toast(`They’re learning your song · ${nearby.bond} / 3`);
    return true;
  }

  context() {
    if (this.player.position.length() < 4.5)
      return "Home nest · recovering vitality";
    const friend = this.friends.find(
      (f) => f.bond < 3 && f.mesh.position.distanceTo(this.player.position) < 6,
    );
    if (friend) return `F · Sing to this creature (${friend.bond}/3)`;
    if (
      this.predators.some(
        (p) =>
          p.respawn === 0 &&
          p.mesh.position.distanceTo(this.player.position) < 9,
      )
    )
      return "Q · Strike    Space · Dash to safety";
    return "Explore · forage · find your kind";
  }

  step(dt, input) {
    this.time += dt;
    const state = this.state,
      pos = this.player.position;
    state.elapsed += dt;
    for (const key in this.cooldowns)
      this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);
    this.attackFlash = Math.max(0, this.attackFlash - dt);
    this.singFlash = Math.max(0, this.singFlash - dt);
    const move = input.move.clone();
    if (input.pointerDown) {
      this.camera.updateMatrixWorld();
      this.ray.setFromCamera(input.pointer, this.camera);
      this.groundPlane.constant = -pos.z;
      const target = new THREE.Vector3();
      if (this.ray.ray.intersectPlane(this.groundPlane, target)) {
        move.set(target.x - pos.x, target.y - pos.y);
        if (move.length() < 0.6) move.set(0, 0);
      }
    }
    if (move.length() > 0) move.normalize();
    if (this.dashTime > 0 && move.length() === 0)
      move.copy(this.velocity).normalize();
    const speed = (5 + state.speed * 0.65) * (this.dashTime > 0 ? 2.7 : 1);
    this.velocity.lerp(move.multiplyScalar(speed), 1 - Math.exp(-dt * 9));
    pos.x = clamp(pos.x + this.velocity.x * dt, -72, 57);
    pos.y = clamp(pos.y + this.velocity.y * dt, -62, 62);
    pos.z = heightAt(pos.x, pos.y);
    if (this.velocity.length() > 0.2) {
      const angle = -Math.atan2(this.velocity.x, this.velocity.y),
        diff = Math.atan2(
          Math.sin(angle - this.player.rotation.z),
          Math.cos(angle - this.player.rotation.z),
        );
      this.player.rotation.z += diff * Math.min(1, dt * 9);
    }
    const home = Math.hypot(pos.x, pos.y) < 4.5;
    state.land.hunger = clamp(
      state.land.hunger - dt * 0.42 + (home ? dt * 5 : 0),
      0,
      100,
    );
    if (home) state.health = Math.min(100, state.health + dt * 9);
    else if (state.land.hunger === 0)
      state.health = Math.max(0, state.health - dt * 3);
    for (const f of this.fruit) {
      f.cooldown = Math.max(0, f.cooldown - dt);
      f.fruit.visible = f.cooldown === 0;
      if (
        f.cooldown === 0 &&
        f.plant.position.distanceTo(pos) < 1.9 + state.magnet * 0.25
      ) {
        f.cooldown = 24;
        f.fruit.visible = false;
        state.land.fruit++;
        state.dna += 4;
        state.health = Math.min(100, state.health + 4);
        state.land.hunger = Math.min(100, state.land.hunger + 17);
        this.pulse(f.plant.position, 0xe9bd78);
        this.callbacks.note(700, 0.1);
      }
    }
    for (const f of this.friends) {
      const angle = f.id * 2.4,
        target =
          f.bond === 3
            ? pos
                .clone()
                .add(
                  new THREE.Vector3(
                    Math.cos(angle) * 3.5,
                    Math.sin(angle) * 3.5,
                    0,
                  ),
                )
            : f.home
                .clone()
                .add(
                  new THREE.Vector3(
                    Math.sin(this.time * 0.17 + f.id) * 2,
                    Math.cos(this.time * 0.14 + f.id) * 2,
                    0,
                  ),
                );
      const dx = target.x - f.mesh.position.x,
        dy = target.y - f.mesh.position.y,
        distance = Math.hypot(dx, dy),
        moving = distance > 0.5;
      if (moving) {
        const amount = Math.min(distance, dt * (f.bond === 3 ? 6 : 0.85));
        f.mesh.position.x += (dx / distance) * amount;
        f.mesh.position.y += (dy / distance) * amount;
        f.mesh.rotation.z = -Math.atan2(dx, dy);
      }
      f.mesh.position.z = heightAt(f.mesh.position.x, f.mesh.position.y);
      animateCreature(f.mesh, this.time + f.id, moving);
    }
    for (const p of this.predators) {
      if (p.respawn > 0) {
        p.respawn = Math.max(0, p.respawn - dt);
        if (p.respawn === 0) {
          p.health = 60;
          p.mesh.position.copy(p.home);
          p.mesh.visible = true;
        }
        continue;
      }
      p.flee = Math.max(0, p.flee - dt);
      const distance = p.mesh.position.distanceTo(pos),
        hunting = distance < 14 && !home;
      const target = hunting
        ? pos
        : p.home
            .clone()
            .add(
              new THREE.Vector3(
                Math.sin(this.time * 0.2) * 3,
                Math.cos(this.time * 0.15) * 3,
                0,
              ),
            );
      let dx = target.x - p.mesh.position.x,
        dy = target.y - p.mesh.position.y;
      if (p.flee > 0) {
        dx = -dx;
        dy = -dy;
      }
      const len = Math.hypot(dx, dy),
        speed = hunting ? 3.5 : 0.8;
      if (len > 0.4) {
        p.mesh.position.x = clamp(
          p.mesh.position.x + (dx / len) * speed * dt,
          -72,
          57,
        );
        p.mesh.position.y = clamp(
          p.mesh.position.y + (dy / len) * speed * dt,
          -62,
          62,
        );
        p.mesh.rotation.z = -Math.atan2(dx, dy);
      }
      p.mesh.position.z = heightAt(p.mesh.position.x, p.mesh.position.y);
      animateCreature(p.mesh, this.time, len > 0.4);
      if (
        distance < 2 &&
        !home &&
        this.cooldowns.damage === 0 &&
        this.dashTime === 0 &&
        p.flee === 0
      ) {
        state.health = Math.max(
          0,
          state.health -
            (18 * Math.pow(0.8, state.armor)) /
              (1 + state.land.friends.length * 0.15),
        );
        this.cooldowns.damage = 1.5;
        this.pulse(pos, 0xec987b);
        this.callbacks.note(110, 0.15);
      }
    }
    this.player.userData.skin.emissive.setHex(
      this.cooldowns.damage > 0.5 && this.cooldowns.damage < 1.6
        ? 0x692b1f
        : 0x000000,
    );
    animateCreature(
      this.player,
      this.time,
      this.velocity.length() > 0.2,
      this.singFlash > 0,
    );
    this.player.userData.body.rotation.z =
      this.attackFlash > 0
        ? Math.sin((this.attackFlash / 0.3) * Math.PI * 2) * 0.35
        : 0;
    for (const site of LANDMARKS) {
      if (
        !state.land.discoveries.includes(site.id) &&
        Math.hypot(pos.x - site.x, pos.y - site.y) < 6
      ) {
        state.land.discoveries.push(site.id);
        state.dna += 20;
        this.callbacks.toast(`Discovered ${site.name} · +20 DNA`);
        this.callbacks.note(400, 0.4);
        this.callbacks.save();
      }
    }
    state.land.x = pos.x;
    state.land.y = pos.y;
    if (state.health <= 0) {
      this.callbacks.death();
      return;
    }
    if (!state.land.completed && chapterComplete(state)) {
      state.land.completed = true;
      this.callbacks.complete();
      this.callbacks.save();
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      r.mesh.scale.setScalar(1 + r.age * 4);
      r.mesh.material.opacity = Math.max(0, 0.8 - r.age);
      if (r.age > 0.8) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
      }
    }
    this.spores.rotation.z = Math.sin(this.time * 0.015) * 0.03;
    this.water.position.z = -3.1 + Math.sin(this.time * 0.7) * 0.025;
  }

  updateCamera(dt) {
    const p = this.player.position,
      mobile = this.camera.aspect < 1;
    const desired = p
      .clone()
      .add(new THREE.Vector3(0, mobile ? -31 : -24, mobile ? 32 : 24));
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 5));
    this.camera.lookAt(p.clone().add(new THREE.Vector3(0, 2, 1)));
    this.sun.position.copy(p).add(new THREE.Vector3(-25, -18, 55));
    this.sun.target.position.copy(p);
  }

  respawn() {
    this.player.position.copy(ground(0, 0));
    this.velocity.set(0, 0);
    this.state.land.x = 0;
    this.state.land.y = 0;
    this.state.health = 100;
    this.state.land.hunger = 80;
    this.state.dna = Math.max(0, this.state.dna - 10);
    this.cooldowns.damage = 4;
  }

  drawMap(ctx) {
    ctx.clearRect(0, 0, 180, 140);
    const p = this.player.position;
    ctx.strokeStyle = "#c2d6a820";
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(90, 70, 15 + i * 17, 0, Math.PI * 2);
      ctx.stroke();
    }
    const dot = (x, y, color, size = 2) => {
      x = 90 + (x - p.x) * 1.2;
      y = 70 - (y - p.y) * 1.2;
      if (x < 3 || x > 177 || y < 3 || y > 137) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 6.28);
      ctx.fill();
    };
    this.fruit
      .filter((f) => !f.cooldown)
      .forEach((f) =>
        dot(f.plant.position.x, f.plant.position.y, "#cbb57d", 1),
      );
    this.predators
      .filter((p) => !p.respawn)
      .forEach((p) => dot(p.mesh.position.x, p.mesh.position.y, "#de8d78"));
    this.friends.forEach((f) =>
      dot(
        f.mesh.position.x,
        f.mesh.position.y,
        "#89cec4",
        f.bond === 3 ? 3 : 2,
      ),
    );
    LANDMARKS.forEach((l) =>
      dot(
        l.x,
        l.y,
        this.state.land.discoveries.includes(l.id) ? "#c2dc9d" : "#f3dca7",
        3,
      ),
    );
    dot(0, 0, "#ffffff", 3);
    dot(p.x, p.y, "#edffc3", 3);
  }
}
