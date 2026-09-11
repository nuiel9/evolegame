import * as THREE from "./three.module.js";
import { SYSTEMS, tickSpace } from "./space-rules.js";

export class SpaceWorld {
  constructor(state) {
    this.state = state;
    this.time = 0;
    this.transit = 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030813);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 900);
    this.camera.up.set(0, 0, 1);
    this.scene.add(new THREE.AmbientLight(0x9eb9ed, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(-20, -30, 50);
    this.scene.add(sun);
    let seed = 72041;
    const random = () =>
      (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const points = new Float32Array(2700);
    for (let i = 0; i < points.length; i += 3) {
      points[i] = (random() - 0.5) * 600;
      points[i + 1] = (random() - 0.5) * 500;
      points[i + 2] = -30 - random() * 130;
    }
    const stars = new THREE.BufferGeometry();
    stars.setAttribute("position", new THREE.BufferAttribute(points, 3));
    this.scene.add(
      new THREE.Points(
        stars,
        new THREE.PointsMaterial({
          color: 0xa2bce4,
          size: 0.55,
          transparent: true,
          opacity: 0.8,
        }),
      ),
    );
    this.planets = [];
    this.markers = [];
    for (const system of SYSTEMS) {
      const group = new THREE.Group();
      group.position.set(system.x, system.y, 0);
      this.scene.add(group);
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(2.8, 24, 16),
        new THREE.MeshBasicMaterial({ color: system.color }),
      );
      group.add(star);
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(3.5, 24, 16),
        new THREE.MeshBasicMaterial({
          color: system.color,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        }),
      );
      group.add(glow);
      system.planets.forEach((p, j) => {
        const radius = 8 + j * 6;
        const orbit = new THREE.Mesh(
          new THREE.RingGeometry(radius - 0.035, radius + 0.035, 96),
          new THREE.MeshBasicMaterial({
            color: 0x537197,
            transparent: true,
            opacity: 0.38,
            side: THREE.DoubleSide,
          }),
        );
        group.add(orbit);
        const planet = new THREE.Mesh(
          new THREE.SphereGeometry(j === 1 ? 1.65 : 1.2, 32, 20),
          new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.72 }),
        );
        const angle = j * 2.1 + system.id * 0.5;
        planet.position.set(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          0,
        );
        group.add(planet);
        this.planets[p.id] = planet;
        if (p.habitable) {
          const atmosphere = new THREE.Mesh(
            new THREE.SphereGeometry(1.8, 24, 16),
            new THREE.MeshBasicMaterial({
              color: 0x86e5ff,
              transparent: true,
              opacity: 0.14,
              depthWrite: false,
            }),
          );
          planet.add(atmosphere);
          for (let c = 0; c < 7; c++) {
            const patch = new THREE.Mesh(
              new THREE.SphereGeometry(0.45, 8, 6),
              new THREE.MeshStandardMaterial({ color: 0x568055, roughness: 1 }),
            );
            const a = random() * Math.PI * 2,
              b = random() * Math.PI;
            patch.position.set(
              1.32 * Math.sin(b) * Math.cos(a),
              1.32 * Math.sin(b) * Math.sin(a),
              1.32 * Math.cos(b),
            );
            patch.scale.z = 0.4;
            planet.add(patch);
          }
        }
        const marker = new THREE.Mesh(
          new THREE.TorusGeometry(2.4, 0.08, 8, 48),
          new THREE.MeshBasicMaterial({ color: 0xc9f39d }),
        );
        marker.position.copy(planet.position);
        marker.visible = false;
        group.add(marker);
        this.markers[p.id] = marker;
      });
    }
    this.player = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 2.4, 5),
      new THREE.MeshStandardMaterial({
        color: 0xe2efd9,
        metalness: 0.65,
        roughness: 0.3,
      }),
    );
    hull.rotation.x = Math.PI / 2;
    this.player.add(hull);
    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.6, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x718fba, metalness: 0.5 }),
    );
    this.player.add(wings);
    this.engine = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0x73cfff }),
    );
    this.engine.position.y = -1.2;
    this.player.add(this.engine);
    this.scene.add(this.player);
    this.focus = new THREE.Vector3();
    this.cooldowns = { dash: 0, attack: 0, sing: 0 };
    this.setDestination(true);
  }
  setDestination(immediate = false) {
    const s = SYSTEMS[this.state.space.system];
    this.target = new THREE.Vector3(s.x, s.y, 0);
    if (immediate) {
      this.focus.copy(this.target);
      this.player.position.set(s.x, s.y - 5, 3);
    } else this.transit = 2.5;
  }
  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.distance = w < 760 ? 88 : 68;
    this.updateCamera(1);
  }
  step(dt) {
    this.time += dt;
    this.state.elapsed += dt;
    tickSpace(this.state.space, dt);
    this.transit = Math.max(0, this.transit - dt);
    const id = this.state.space.system * 3 + this.state.space.planet;
    const target = this.planets[id]
      .getWorldPosition(new THREE.Vector3())
      .add(new THREE.Vector3(0, -3, 2));
    this.player.position.lerp(target, 1 - Math.exp(-dt * 2));
    this.player.rotation.z = Math.sin(this.time * 0.5) * 0.2;
    this.engine.scale.setScalar(1 + Math.sin(this.time * 12) * 0.18);
    this.planets.forEach((p, i) => {
      p.rotation.z += dt * 0.08;
      this.markers[i].visible = this.state.space.colonies.includes(i);
    });
  }
  updateCamera(dt) {
    this.focus.lerp(this.target, 1 - Math.exp(-dt * 2));
    this.camera.position.set(
      this.focus.x,
      this.focus.y - this.distance * 0.55,
      this.distance,
    );
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
  }
  drawMap() {}
  dash() {
    return false;
  }
  attack() {
    return false;
  }
  sing() {
    return false;
  }
  setTraits() {}
  setColor() {}
}
