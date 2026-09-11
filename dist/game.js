import * as THREE from "./three.module.js";
import { CreatureWorld } from "./creature.js";
import { SettlementWorld } from "./settlement.js";
import { SpaceWorld } from "./space.js";
import {
  SYSTEMS,
  researchSpace,
  launchSpace,
  jump,
  survey,
  colonize,
  contact,
  beaconReady,
  buildBeacon,
} from "./space-rules.js";
import {
  BUILDINGS,
  JOBS,
  capacity,
  idleWorkers,
  affordable,
  monumentRequirements,
  production,
  assignWorker,
  recruit,
} from "./settlement-rules.js";
import {
  newJourney,
  canWalk,
  canFound,
  enterCreatureStage,
  enterCivilizationStage,
  saveJourney,
  loadJourney,
} from "./progression.js";

const $ = (id) => document.getElementById(id);
const canvas = $("ocean");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
} catch {
  $("modal").hidden = false;
  $("modal-title").textContent = "Your ocean needs WebGL";
  $("modal-content").innerHTML =
    "<p>Enable hardware acceleration in your browser and reload to explore Primordia.</p>";
  throw new Error("WebGL unavailable");
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setClearColor(0x08262d);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x092a30, 0.011);
const camera = new THREE.PerspectiveCamera(
  43,
  innerWidth / innerHeight,
  0.1,
  250,
);
camera.position.set(0, 0, 47);
const hemi = new THREE.HemisphereLight(0xc7f7e4, 0x153f46, 2.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xc6fbd6, 3.4);
sun.position.set(-12, 20, 30);
scene.add(sun);
const blueLight = new THREE.PointLight(0x58f5de, 55, 60, 1.5);
blueLight.position.set(10, 5, 12);
scene.add(blueLight);
const warmLight = new THREE.PointLight(0xcddd8b, 40, 55, 1.5);
warmLight.position.set(-18, -5, 10);
scene.add(warmLight);
let seed = 719;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const range = (a, b) => a + rand() * (b - a);
const sphere = new THREE.SphereGeometry(1, 32, 24);
const smallSphere = new THREE.SphereGeometry(1, 12, 10);
const basic = (color, opacity = 1) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity === 1,
  });
const softTexture = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(220,255,216,1)");
  g.addColorStop(0.15, "rgba(190,255,207,.65)");
  g.addColorStop(0.45, "rgba(130,255,202,.17)");
  g.addColorStop(1, "rgba(100,255,180,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
function glow(color, size, opacity = 0.3) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: softTexture,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  s.scale.set(size, size, 1);
  return s;
}
function blob(color, size = 1) {
  const mesh = new THREE.Mesh(
    sphere,
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.25,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
      transparent: true,
      opacity: 0.72,
      emissive: color,
      emissiveIntensity: 0.11,
    }),
  );
  mesh.scale.setScalar(size);
  return mesh;
}
function tube(points, radius, color, opacity = 0.8) {
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      24,
      radius,
      6,
      false,
    ),
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.4,
      transparent: true,
      opacity,
      emissive: color,
      emissiveIntensity: 0.18,
    }),
  );
}
function organism(color, radius = 1, kind = "grazer") {
  const group = new THREE.Group();
  const body = blob(color, radius);
  body.scale.y *= kind === "predator" ? 0.88 : 1.14;
  body.scale.z *= 0.68;
  group.add(body);
  const membrane = new THREE.Mesh(
    sphere,
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.1,
      metalness: 0.05,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: color,
      emissiveIntensity: 0.25,
    }),
  );
  membrane.scale.copy(body.scale).multiplyScalar(1.13);
  group.add(membrane);
  const nucleus = blob(
    kind === "predator" ? 0xb74739 : 0x72a761,
    radius * 0.46,
  );
  nucleus.position.set(-0.1 * radius, 0.08 * radius, 0.42 * radius);
  nucleus.scale.z *= 0.65;
  group.add(nucleus);
  const halo = glow(color, radius * 5, 0.15);
  halo.position.z = -0.7;
  group.add(halo);
  const organelles = [];
  for (let j = 0; j < 15; j++) {
    const a = range(0, Math.PI * 2),
      r = range(0.38, 0.84) * radius;
    const organ = blob(j % 3 ? color : 0xd6dc96, range(0.06, 0.17) * radius);
    organ.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.4 * radius);
    organ.scale.set(
      organ.scale.x * 1.3,
      organ.scale.y * 0.8,
      organ.scale.z * 0.7,
    );
    group.add(organ);
    organelles.push(organ);
  }
  const appendages = [];
  if (kind === "predator") {
    for (let j = 0; j < 13; j++) {
      const a = (j / 13) * Math.PI * 2;
      const sp = new THREE.Mesh(
        new THREE.ConeGeometry(radius * 0.12, radius * 0.67, 10),
        new THREE.MeshStandardMaterial({
          color: 0xeebba0,
          roughness: 0.3,
          emissive: 0x683223,
          emissiveIntensity: 0.15,
        }),
      );
      sp.position.set(
        Math.cos(a) * radius * 1.24,
        Math.sin(a) * radius * 1.13,
        0,
      );
      sp.rotation.z = a - Math.PI / 2;
      group.add(sp);
    }
  } else {
    for (let j = 0; j < 22; j++) {
      const a = (j / 22) * Math.PI * 2;
      const s = radius;
      const pts = [
        new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s * 1.08, 0),
        new THREE.Vector3(
          Math.cos(a + 0.07) * s * 1.26,
          Math.sin(a + 0.07) * s * 1.35,
          -0.02,
        ),
        new THREE.Vector3(
          Math.cos(a + 0.17) * s * 1.46,
          Math.sin(a + 0.17) * s * 1.55,
          -0.08,
        ),
      ];
      const cilium = tube(pts, 0.022 * radius, color, 0.65);
      group.add(cilium);
      appendages.push(cilium);
    }
    for (let j = 0; j < 3; j++) {
      const pts = [];
      for (let k = 0; k < 11; k++)
        pts.push(
          new THREE.Vector3(
            Math.sin(k * 0.6 + j) * 0.22 * radius + (j - 1) * 0.24 * radius,
            -radius - k * 0.23 * radius,
            -0.13,
          ),
        );
      const tail = tube(pts, 0.037 * radius, color, 0.75);
      group.add(tail);
      appendages.push(tail);
    }
  }
  const eyes = [];
  for (const x of [-0.33, 0.33]) {
    const eye = new THREE.Group();
    eye.position.set(x * radius, 0.47 * radius, 0.74 * radius);
    const white = new THREE.Mesh(
      sphere,
      new THREE.MeshStandardMaterial({ color: 0xe5edd0, roughness: 0.25 }),
    );
    white.scale.set(0.23 * radius, 0.25 * radius, 0.18 * radius);
    eye.add(white);
    const pupil = new THREE.Mesh(
      sphere,
      new THREE.MeshPhysicalMaterial({
        color: 0x072b2a,
        roughness: 0.15,
        clearcoat: 1,
      }),
    );
    pupil.position.set(0, 0.045 * radius, 0.155 * radius);
    pupil.scale.set(0.115 * radius, 0.14 * radius, 0.08 * radius);
    eye.add(pupil);
    const sparkle = new THREE.Mesh(smallSphere, basic(0xffffff));
    sparkle.scale.setScalar(0.028 * radius);
    sparkle.position.set(-0.035 * radius, 0.08 * radius, 0.227 * radius);
    eye.add(sparkle);
    group.add(eye);
    eyes.push(pupil);
  }
  group.userData = {
    body,
    membrane,
    halo,
    nucleus,
    appendages,
    organelles,
    radius,
    kind,
    phase: range(0, 6.28),
    color,
  };
  return group;
}
// The ocean is a procedural volume: softly lit depth layers, suspended detritus and distant life.
const backgroundGeometry = new THREE.PlaneGeometry(330, 240);
const backgroundMaterial = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 } },
  vertexShader:
    "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader: `varying vec2 vUv;uniform float time;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}void main(){vec2 p=vUv*7.;float f=n(p+time*.008)*.55+n(p*2.1-time*.011)*.28+n(p*4.3)*.12;float light=pow(max(0.,sin(vUv.x*29.+vUv.y*9.+f*2.)),10.)*.04;vec3 c=mix(vec3(.012,.055,.075),vec3(.06,.22,.22),f);c+=vec3(.12,.19,.11)*pow(max(0.,vUv.y),3.)*.3+light;gl_FragColor=vec4(c,1.);}`,
});
const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
background.position.z = -48;
scene.add(background);
const particlePositions = new Float32Array(1500 * 3);
for (let i = 0; i < 1500; i++) {
  particlePositions[i * 3] = range(-120, 120);
  particlePositions[i * 3 + 1] = range(-100, 100);
  particlePositions[i * 3 + 2] = range(-38, 12);
}
const pg = new THREE.BufferGeometry();
pg.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
const particles = new THREE.Points(
  pg,
  new THREE.PointsMaterial({
    color: 0xa2d6b5,
    size: 0.09,
    transparent: true,
    opacity: 0.48,
    sizeAttenuation: true,
    depthWrite: false,
  }),
);
scene.add(particles);
const distant = [];
for (let i = 0; i < 75; i++) {
  let r = range(0.3, 2.4);
  const obj = new THREE.Mesh(
    new THREE.TorusGeometry(r, 0.025, 5, 40),
    basic(0x74b9a0, range(0.05, 0.2)),
  );
  obj.position.set(range(-90, 90), range(-65, 65), range(-34, -10));
  obj.scale.y = range(0.8, 1.4);
  scene.add(obj);
  distant.push(obj);
  if (i % 3 === 0) {
    const g = glow(0x60b7a1, r * 3, 0.06);
    g.position.copy(obj.position);
    scene.add(g);
  }
}
const player = organism(0xb0dc86, 1.53, "player");
scene.add(player);
const playerLight = new THREE.PointLight(0xccf7a0, 9, 13, 1.4);
playerLight.position.z = 4;
player.add(playerLight);
const aura = new THREE.Mesh(
  new THREE.RingGeometry(2.75, 2.765, 96),
  basic(0xc7edaa, 0.2),
);
aura.position.z = -0.1;
player.add(aura);
const predators = [],
  grazers = [],
  foods = [],
  effects = [];
for (let i = 0; i < 15; i++) {
  const o = organism(
    [0xcf675c, 0xc56e56, 0x976582][i % 3],
    range(1.05, 1.8),
    "predator",
  );
  o.position.set(range(-75, 75), range(-65, 65), range(-2, 1));
  if (o.position.length() < 12) o.position.x += 20;
  scene.add(o);
  predators.push(o);
}
// Compose a few nearby organisms into the opening view; all remain part of the simulation.
predators[0].position.set(12, 7, -1);
predators[1].position.set(-16, -8, -1.5);
predators[2].position.set(25, -7, 0);
for (let i = 0; i < 20; i++) {
  const o = organism(
    [0x52b8b3, 0x63a8b3, 0xb0b665, 0x8593c0][i % 4],
    range(0.55, 1.2),
  );
  o.position.set(range(-75, 75), range(-65, 65), range(-5, 0));
  scene.add(o);
  grazers.push(o);
}
grazers[0].position.set(-11, 7, -2);
grazers[1].position.set(8, -6, -1);
grazers[2].position.set(19, 1, -3);
grazers[3].position.set(-20, 2, -3);
const nutrientMat = new THREE.MeshStandardMaterial({
  color: 0xbadd82,
  emissive: 0x81c952,
  emissiveIntensity: 0.5,
  roughness: 0.35,
});
function addFood(x, y) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(range(0.11, 0.23), 1),
    nutrientMat,
  );
  core.scale.y = 1.25;
  group.add(core);
  group.add(glow(0xc1eb78, 1.45, 0.35));
  group.position.set(x, y, range(-1, 1));
  group.userData = { phase: range(0, 6.28), baseZ: group.position.z };
  scene.add(group);
  foods.push(group);
}
for (let i = 0; i < 290; i++) addFood(range(-82, 82), range(-72, 72));
for (let i = 0; i < 27; i++) {
  const a = range(0, 6.28),
    r = range(3.5, 16);
  addFood(Math.cos(a) * r, Math.sin(a) * r);
}
let state = newJourney();
let landWorld = null,
  saveClock = 0,
  saveAvailable = true,
  saveStorage;
try {
  saveStorage = globalThis.localStorage;
} catch {
  saveAvailable = false;
}
let paused = false,
  dead = false,
  modalType = "",
  dashTime = 0,
  dashCooldown = 0,
  damageCooldown = 0,
  toastTimer = 0,
  audioContext = null,
  audioGain = null;
let frame = 0,
  lastTime = performance.now(),
  totalTime = 0,
  uiTime = 0;
const keys = new Set(),
  pointer = new THREE.Vector2(),
  velocity = new THREE.Vector2(),
  move = new THREE.Vector2();
let pointerDown = false;
const mapCtx = $("minimap").getContext("2d");
function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 2600);
}
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.position.z = innerWidth < 760 ? 54 : 47;
  camera.updateProjectionMatrix();
}
resize();
addEventListener("resize", resize);
function updateUI() {
  $("dna").textContent = state.dna;
  $("health-label").innerHTML =
    `${Math.ceil(state.health)} <small>/ 100</small>`;
  $("health-bar").style.width = state.health + "%";
  $("health-bar").style.background = state.health < 30 ? "#e78b75" : "#bddf9b";
  $("generation").textContent =
    "GEN " + String(state.generation).padStart(2, "0");
  $("collect-count").textContent = `${Math.min(state.eaten, 12)} / 12 consumed`;
  $("objective-check").textContent = state.eaten >= 12 ? "✓" : "↗";
  const percent = Math.min(100, Math.round((state.dna / 30) * 100));
  $("evolution-percent").textContent = percent + "%";
  $("evolution-fill").style.width = percent + "%";
  $("evolution-label").textContent =
    state.dna >= 30
      ? "A new possibility is waiting."
      : "Single cell. Infinite possibilities.";
  $("evolve-objective").textContent =
    state.generation > 1
      ? `Generation ${state.generation} · keep adapting`
      : state.dna >= 30
        ? "Your first adaptation is ready"
        : "Gather 30 DNA to adapt";
  $("dash-state").textContent =
    dashCooldown > 0 ? `${dashCooldown.toFixed(1)}s cooldown` : "Ready";
}
function pulse(position, color = 0xc5ed91) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.28, 32),
    basic(color, 0.8),
  );
  mesh.position.copy(position);
  mesh.position.z += 1;
  scene.add(mesh);
  effects.push({ mesh, life: 0 });
}
function dash() {
  if (paused || dead || dashCooldown > 0) return;
  dashTime = 0.32;
  dashCooldown = 3.5;
  state.dashes++;
  if (velocity.length() < 0.2) velocity.set(0, 1);
  pulse(player.position);
  soundNote(200, 0.1);
}
function soundNote(freq, duration = 0.15) {
  if (!audioContext || audioContext.state !== "running") return;
  const osc = audioContext.createOscillator(),
    gain = audioContext.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(
    freq * 1.4,
    audioContext.currentTime + duration,
  );
  gain.gain.setValueAtTime(0.045, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + duration,
  );
  osc.connect(gain);
  gain.connect(audioGain);
  osc.start();
  osc.stop(audioContext.currentTime + duration);
}
async function toggleSound() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioGain = audioContext.createGain();
    audioGain.gain.value = 0.4;
    audioGain.connect(audioContext.destination);
    const buffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate * 3,
      audioContext.sampleRate,
    );
    const data = buffer.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < data.length; i++) {
      prev = (prev + (Math.random() * 2 - 1) * 0.018) / 1.018;
      data[i] = prev * 0.5;
    }
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    noise.connect(filter);
    filter.connect(audioGain);
    noise.start();
    await audioContext.resume();
  } else if (audioContext.state === "running") await audioContext.suspend();
  else await audioContext.resume();
  const on = audioContext.state === "running";
  $("sound").textContent = on ? "♫" : "♪";
  $("sound").setAttribute(
    "aria-label",
    on ? "Mute ocean sound" : "Enable ocean sound",
  );
  toast(on ? "Ocean sound on" : "Ocean sound off");
}
function showModal(type, title, content) {
  paused = true;
  pointerDown = false;
  keys.clear();
  modalType = type;
  $("modal-title").textContent = title;
  $("modal-content").innerHTML = content;
  $("modal").hidden = false;
  $("close-modal").focus();
  $("pause").textContent = "▷";
}
function closeModal() {
  if (dead) return;
  $("modal").hidden = true;
  paused = false;
  modalType = "";
  $("pause").textContent = "Ⅱ";
  lastTime = performance.now();
}
function openEvolution() {
  if (dead) return;
  showModal(
    "evolve",
    "Choose your next adaptation",
    `<p>Life changes one small step at a time. Spend <strong>30 DNA</strong> to carry a new trait into your next generation. <span style="color:#c4ed9b">You have ${state.dna} DNA.</span></p><div class="adaptations"><button class="adaptation" data-upgrade="speed" ${state.dna < 30 ? "disabled" : ""}><span>≋</span><h3>Flagella</h3><p>Longer tails. Swim 18% faster with every adaptation.</p><strong>30 DNA · Lv ${state.speed}</strong></button><button class="adaptation" data-upgrade="armor" ${state.dna < 30 ? "disabled" : ""}><span>◈</span><h3>Membrane</h3><p>A tougher cell wall. Reduce damage by 20% per level.</p><strong>30 DNA · Lv ${state.armor}</strong></button><button class="adaptation" data-upgrade="magnet" ${state.dna < 30 ? "disabled" : ""}><span>✺</span><h3>Feeding cilia</h3><p>Pull nearby nutrients closer. Increase feeding reach.</p><strong>30 DNA · Lv ${state.magnet}</strong></button></div><div class="color-options">Cell pigment <button data-color="b0dc86" style="background:#b0dc86" aria-label="Lime pigment"></button><button data-color="65c9c5" style="background:#65c9c5" aria-label="Turquoise pigment"></button><button data-color="b89bda" style="background:#b89bda" aria-label="Violet pigment"></button><button data-color="e2b17f" style="background:#e2b17f" aria-label="Amber pigment"></button></div>`,
  );
}
function upgrade(type) {
  if (state.dna < 30 || !["speed", "armor", "magnet"].includes(type)) return;
  state.dna -= 30;
  state[type]++;
  state.generation++;
  state.health = 100;
  const s = 1 + Math.min(state.generation - 1, 8) * 0.055;
  player.scale.setScalar(s);
  if (type === "speed") {
    const pts = [];
    for (let i = 0; i < 14; i++)
      pts.push(
        new THREE.Vector3(
          Math.sin(i * 0.6) * 0.4 + (state.speed % 2 ? -0.5 : 0.5),
          -1.3 - i * 0.3,
          -0.1,
        ),
      );
    const t = tube(pts, 0.065, player.userData.color);
    player.add(t);
    player.userData.appendages.push(t);
  }
  if (type === "armor") {
    player.userData.membrane.material.opacity = Math.min(
      0.5,
      0.16 + state.armor * 0.045,
    );
  }
  if (type === "magnet") {
    aura.scale.setScalar(1 + state.magnet * 0.2);
  }
  closeModal();
  pulse(player.position);
  toast(
    `Generation ${state.generation} · ${type === "speed" ? "Flagella" : type === "armor" ? "Membrane" : "Feeding cilia"} evolved`,
  );
  soundNote(460, 0.35);
  updateUI();
}
function showHelp() {
  showModal(
    "help",
    "Small beginnings. Endless possibility.",
    `<p>Guide Lumina through the primordial ocean. Green nutrients restore vitality and grant <strong>3 DNA</strong> each. Red hunters pursue you when you drift too close.</p><div class="notes-row"><span>Swim</span><strong>W A S D / Arrow keys / Hold pointer</strong></div><div class="notes-row"><span>Dash & evade</span><strong>Space · 3.5 second cooldown</strong></div><div class="notes-row"><span>Adapt your organism</span><strong>E · 30 DNA</strong></div><div class="notes-row"><span>Field notes / Pause</span><strong>J / Escape</strong></div><p>Survive, feed, and evolve through successive generations. This playable chapter explores the cell stage.</p><button class="modal-action" data-resume>Into the ocean</button>`,
  );
}
function journal() {
  showModal(
    "journal",
    "An extraordinary little life",
    `<p>Observations from the primordial shallows.</p><div class="notes-row"><span>Current generation</span><strong>${state.generation}</strong></div><div class="notes-row"><span>Nutrients consumed</span><strong>${state.eaten}</strong></div><div class="notes-row"><span>Time alive</span><strong>${Math.floor(state.elapsed / 60)}m ${Math.floor(state.elapsed % 60)}s</strong></div><div class="notes-row"><span>Successful dashes</span><strong>${state.dashes}</strong></div><div class="notes-row"><span>Adaptations</span><strong>${state.speed + state.armor + state.magnet}</strong></div><p>“In a single drop of water, a whole world waits to become.”</p><button class="modal-action" data-resume>Continue exploring</button>`,
  );
}
function pauseGame() {
  if (dead) return;
  if (paused) {
    closeModal();
    return;
  }
  showModal(
    "pause",
    "The ocean can wait.",
    `<p>Your little corner of the universe is paused.</p><button class="modal-action" data-resume>Resume journey</button>`,
  );
}
function gameOver() {
  dead = true;
  showModal(
    "death",
    "Life begins again.",
    `<p>Lumina survived ${Math.floor(state.elapsed)} seconds, consumed ${state.eaten} nutrients, and reached generation ${state.generation}. A new organism is waiting for its turn.</p><button class="modal-action" id="restart">Begin a new life</button>`,
  );
}
function restart() {
  state = newJourney();
  player.position.set(0, 0, 0);
  player.scale.setScalar(1);
  velocity.set(0, 0);
  player.userData.membrane.material.opacity = 0.16;
  aura.scale.setScalar(1);
  while (player.userData.appendages.length > 25) {
    const part = player.userData.appendages.pop();
    player.remove(part);
    part.geometry.dispose();
    part.material.dispose();
  }
  predators.forEach((p, i) => {
    const a = (i / predators.length) * 6.28;
    p.position.set(Math.cos(a) * range(20, 65), Math.sin(a) * range(20, 60), 0);
  });
  for (let i = 0; i < foods.length; i++) {
    foods[i].position.set(range(-82, 82), range(-72, 72), 0);
  }
  for (let i = 0; i < 27; i++) {
    const a = range(0, 6.28),
      r = range(3.5, 16);
    foods[i].position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
  }
  damageCooldown = 3;
  dashCooldown = 0;
  dead = false;
  closeModal();
  updateUI();
  toast("A new beginning. Follow the green glow.");
}
$("modal-content").addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button) return;
  if (button.dataset.upgrade) upgrade(button.dataset.upgrade);
  if (button.dataset.color) {
    const color = parseInt(button.dataset.color, 16);
    player.userData.color = color;
    for (const part of [player.userData.body, player.userData.membrane]) {
      part.material.color.setHex(color);
      part.material.emissive.setHex(color);
    }
    player.userData.halo.material.color.setHex(color);
    player.userData.appendages.forEach((p) => {
      p.material.color.setHex(color);
    });
    toast("Cell pigment updated");
  }
  if (button.hasAttribute("data-resume")) closeModal();
  if (button.id === "restart") restart();
});
$("close-modal").onclick = () => (dead ? restart() : closeModal());
$("evolve").onclick = openEvolution;
$("mobile-evolve").onclick = openEvolution;
$("mobile-dash").onclick = dash;
$("help").onclick = showHelp;
$("stage-info").onclick = showHelp;
$("pause").onclick = pauseGame;
$("journal").onclick = journal;
$("sound").onclick = toggleSound;
addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target.closest?.("button")) return;
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (e.code === "Tab" && !$("modal").hidden) {
    const focusable = [...$("modal").querySelectorAll("button:not(:disabled)")];
    const first = focusable[0],
      last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
    return;
  }
  if (e.repeat) return;
  if (e.code === "Escape") {
    if (!paused && state.stage === "civilization" && landWorld?.buildType) {
      landWorld.cancelPlacement();
      updateVillageUI();
      return;
    }
    pauseGame();
    return;
  }
  if (paused) return;
  keys.add(e.code);
  if (e.code === "Space") dash();
  if (e.code === "KeyE") openEvolution();
  if (e.code === "KeyJ") journal();
});
addEventListener("keyup", (e) => keys.delete(e.code));
const setPointer = (e) => {
  pointer.set(
    (e.clientX / innerWidth) * 2 - 1,
    (-e.clientY / innerHeight) * 2 + 1,
  );
};
canvas.addEventListener("pointerdown", (e) => {
  if (paused) return;
  setPointer(e);
  if (state.stage === "civilization" && landWorld) {
    if (landWorld.buildType) {
      landWorld.placeAtPointer(pointer);
      pointerDown = false;
      updateVillageUI();
      return;
    }
    if (landWorld.selectAtPointer(pointer)) {
      pointerDown = false;
      $("village-panel").hidden = false;
      showVillageTab("build");
      updateVillageUI();
      return;
    }
  }
  pointerDown = true;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", setPointer);
canvas.addEventListener("pointerup", () => (pointerDown = false));
canvas.addEventListener("pointercancel", () => (pointerDown = false));
addEventListener("blur", () => {
  keys.clear();
  pointerDown = false;
  if (!paused && !dead) pauseGame();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !paused) pauseGame();
});
function animateOrganism(obj, t) {
  const d = obj.userData;
  const breath = 1 + Math.sin(t * 1.6 + d.phase) * 0.035;
  d.body.scale.x = d.radius * breath;
  d.body.scale.y = (d.radius * (d.kind === "predator" ? 0.88 : 1.14)) / breath;
  d.appendages.forEach((a, i) => {
    a.rotation.z = Math.sin(t * 3 + i * 0.7 + d.phase) * 0.035;
  });
  d.organelles.forEach((o, i) => {
    o.position.z = d.radius * 0.4 + Math.sin(t * 1.5 + i) * 0.035;
  });
}
function drawMap() {
  const ctx = mapCtx,
    w = 180,
    h = 140;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#a0cfaa15";
  ctx.lineWidth = 0.6;
  for (let r = 22; r < 90; r += 25) {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();
  function dot(obj, color, size) {
    const x = (obj.position.x - player.position.x) * 2 + 90,
      y = 70 - (obj.position.y - player.position.y) * 2;
    if (x < 3 || x > 177 || y < 3 || y > 137) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 6.28);
    ctx.fill();
  }
  foods.forEach((f) => dot(f, "#bfd89088", 1.1));
  predators.forEach((p) => dot(p, "#d88d76", 2));
  grazers.forEach((g) => dot(g, "#70b9b188", 1.5));
  dot(player, "#dcf9b6", 3);
  ctx.strokeStyle = "#d5edac66";
  ctx.beginPath();
  ctx.arc(90, 70, 7, 0, 6.28);
  ctx.stroke();
}
function simulate(dt) {
  state.elapsed += dt;
  dashCooldown = Math.max(0, dashCooldown - dt);
  dashTime = Math.max(0, dashTime - dt);
  damageCooldown = Math.max(0, damageCooldown - dt);
  move.set(
    (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
      (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
    (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
  );
  if (pointerDown) {
    const target = new THREE.Vector3(pointer.x, pointer.y, 0.5).unproject(
      camera,
    );
    const dir = target.sub(camera.position).normalize();
    const hit = camera.position
      .clone()
      .add(dir.multiplyScalar(-camera.position.z / dir.z));
    move.set(hit.x - player.position.x, hit.y - player.position.y);
    if (move.length() < 0.5) move.set(0, 0);
  }
  if (move.length() > 0) move.normalize();
  if (dashTime > 0 && move.length() === 0) move.copy(velocity).normalize();
  const speed = (4.6 + state.speed * 0.83) * (dashTime > 0 ? 3.4 : 1);
  velocity.lerp(move.multiplyScalar(speed), 1 - Math.exp(-dt * 5));
  player.position.x = THREE.MathUtils.clamp(
    player.position.x + velocity.x * dt,
    -79,
    79,
  );
  player.position.y = THREE.MathUtils.clamp(
    player.position.y + velocity.y * dt,
    -69,
    69,
  );
  if (velocity.length() > 0.5) {
    let desired = -Math.atan2(velocity.x, velocity.y);
    let diff = Math.atan2(
      Math.sin(desired - player.rotation.z),
      Math.cos(desired - player.rotation.z),
    );
    player.rotation.z += diff * Math.min(1, dt * 5);
  }
  player.userData.body.material.emissiveIntensity =
    damageCooldown > 0.4 ? 0.3 + Math.sin(totalTime * 30) * 0.2 : 0.11;
  const pickup = 1.8 * player.scale.x;
  const attraction = pickup + state.magnet * 1.15;
  for (const food of foods) {
    const dx = player.position.x - food.position.x,
      dy = player.position.y - food.position.y,
      d = Math.hypot(dx, dy);
    if (d < attraction && d > pickup) {
      food.position.x += dx * dt * 2;
      food.position.y += dy * dt * 2;
    }
    if (d < pickup) {
      state.eaten++;
      state.dna += 3;
      state.health = Math.min(100, state.health + 3);
      pulse(food.position);
      soundNote(600 + Math.random() * 250, 0.1);
      food.position.set(
        player.position.x + range(-55, 55),
        player.position.y + range(-45, 45),
        range(-1, 1),
      );
      food.position.x = THREE.MathUtils.clamp(food.position.x, -80, 80);
      food.position.y = THREE.MathUtils.clamp(food.position.y, -70, 70);
      if (state.dna === 30) toast("Evolution available · Press E to adapt");
      if (state.eaten === 12)
        toast("A spark of life · Nutrient objective complete");
    }
    food.rotation.z += dt * 0.6;
    food.position.z =
      food.userData.baseZ + Math.sin(totalTime + food.userData.phase) * 0.2;
  }
  for (const p of predators) {
    const dx = player.position.x - p.position.x,
      dy = player.position.y - p.position.y,
      d = Math.hypot(dx, dy);
    const hunting = d < 10 && state.elapsed > 5;
    const direction = hunting
      ? Math.atan2(dy, dx)
      : totalTime * 0.13 + p.userData.phase;
    const s = hunting ? 2.5 : 0.7;
    p.position.x += Math.cos(direction) * s * dt;
    p.position.y += Math.sin(direction) * s * dt;
    p.rotation.z = direction - Math.PI / 2;
    if (
      d < p.userData.radius + pickup * 0.63 &&
      damageCooldown === 0 &&
      dashTime === 0
    ) {
      state.health -= 22 * Math.pow(0.8, state.armor);
      damageCooldown = 1.25;
      velocity.set(dx, dy).normalize().multiplyScalar(16);
      player.position.x += (dx / Math.max(d, 0.01)) * 0.5;
      player.position.y += (dy / Math.max(d, 0.01)) * 0.5;
      pulse(player.position, 0xf59c81);
      soundNote(110, 0.18);
      toast("Predator attack! Dash away with Space.");
      if (state.health <= 0) {
        state.health = 0;
        gameOver();
      }
    }
    p.position.x = THREE.MathUtils.clamp(p.position.x, -82, 82);
    p.position.y = THREE.MathUtils.clamp(p.position.y, -72, 72);
  }
  for (const g of grazers) {
    const d = totalTime * 0.18 + g.userData.phase;
    g.position.x += Math.cos(d) * dt * 0.55;
    g.position.y += Math.sin(d) * dt * 0.55;
    g.rotation.z = d - Math.PI / 2;
  }
  if (state.health < 100 && damageCooldown === 0)
    state.health = Math.min(100, state.health + dt * 0.5);
}
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.04);
  lastTime = now;
  frame++;
  if (!paused) {
    totalTime += dt;
    if (state.stage !== "cell" && landWorld) {
      const direction = new THREE.Vector2(
        (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
          (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
        (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
          (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
      );
      landWorld.step(dt, { move: direction, pointerDown, pointer });
    } else {
      simulate(dt);
      backgroundMaterial.uniforms.time.value = totalTime;
      animateOrganism(player, totalTime);
      for (const o of [...predators, ...grazers]) animateOrganism(o, totalTime);
      particles.rotation.z = Math.sin(totalTime * 0.015) * 0.015;
      for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i];
        e.life += dt;
        e.mesh.scale.setScalar(1 + e.life * 7);
        e.mesh.material.opacity = Math.max(0, 0.8 - e.life * 1.3);
        if (e.life > 0.65) {
          scene.remove(e.mesh);
          e.mesh.geometry.dispose();
          e.mesh.material.dispose();
          effects.splice(i, 1);
        }
      }
    }
    saveClock += dt;
    if (saveClock >= 5) {
      saveProgress();
      saveClock = 0;
    }
  }
  if (state.stage !== "cell" && landWorld) {
    landWorld.updateCamera(dt);
    renderer.render(landWorld.scene, landWorld.camera);
  } else {
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      player.position.x,
      1 - Math.exp(-dt * 3),
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      player.position.y,
      1 - Math.exp(-dt * 3),
    );
    const screen = player.position.clone().project(camera);
    $("player-tag").style.left = (screen.x * 0.5 + 0.5) * innerWidth + "px";
    $("player-tag").style.top =
      (-screen.y * 0.5 + 0.5) * innerHeight +
      (innerWidth < 760 ? 67 : 84) +
      "px";
    renderer.render(scene, camera);
  }
  uiTime += dt;
  if (uiTime > 0.12) {
    updateUI();
    if (landWorld && state.stage !== "cell") landWorld.drawMap(mapCtx);
    else drawMap();
    uiTime = 0;
  }
}

function saveProgress() {
  if (state.stage === "cell")
    state.cellPosition = { x: player.position.x, y: player.position.y };
  saveAvailable = saveJourney(saveStorage, state);
  $("save-status").textContent = saveAvailable
    ? "Journey saved on this device"
    : "Saving unavailable · keep this tab open";
  return saveAvailable;
}

function recolorCell(color) {
  player.userData.color = color;
  for (const part of [player.userData.body, player.userData.membrane]) {
    part.material.color.setHex(color);
    part.material.emissive.setHex(color);
  }
  player.userData.halo.material.color.setHex(color);
  player.userData.appendages.forEach((p) => p.material.color.setHex(color));
}

function restoreCellTraits() {
  player.scale.setScalar(1 + Math.min(state.generation - 1, 8) * 0.055);
  player.userData.membrane.material.opacity = Math.min(
    0.5,
    0.16 + state.armor * 0.045,
  );
  aura.scale.setScalar(1 + state.magnet * 0.2);
  while (player.userData.appendages.length > 25) {
    const p = player.userData.appendages.pop();
    player.remove(p);
    p.geometry.dispose();
    p.material.dispose();
  }
  for (let n = 1; n <= state.speed; n++) {
    const pts = [];
    for (let i = 0; i < 14; i++)
      pts.push(
        new THREE.Vector3(
          Math.sin(i * 0.6) * 0.4 + (n % 2 ? -0.5 : 0.5),
          -1.3 - i * 0.3,
          -0.1,
        ),
      );
    const tail = tube(pts, 0.065, state.color);
    player.add(tail);
    player.userData.appendages.push(tail);
  }
  recolorCell(state.color);
}

function startLand() {
  if (state.stage === "space") {
    startSpace();
    return;
  }
  const World =
    state.stage === "civilization" ? SettlementWorld : CreatureWorld;
  landWorld = new World(state, {
    toast,
    note: soundNote,
    save: saveProgress,
    death: gameOver,
    complete: completeChapter,
    settlementDefeat: settlementDefeat,
    victory: civilizationVictory,
  });
  landWorld.resize(innerWidth, innerHeight);
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  $("game").classList.add("land-mode");
  $("land-actions").hidden = false;
  $("interaction-hint").hidden = false;
  $("land-vitals").hidden = false;
  $("species-name").textContent = "Lumina terrestris";
  $("species-subtitle").textContent = "Herbivore · Land creature";
  $("stage-info").className = "stage previous";
  $("creature-stage").className = "stage current";
  $("biome-title").textContent = "THE VERDANT CRADLE";
  $("biome-time").textContent = "Your first steps into a larger world";
  $("depth-name").textContent = "VERDANT CRADLE";
  $("depth-value").textContent = "LAND";
  $("food-legend").textContent = "Fruit";
  $("chapter-count").textContent = "02 / 04";
  $("chapter-eyebrow").textContent = "A WORLD BEYOND";
  $("chapter-title").textContent = "Find your place";
  $("chapter-description").textContent = "A new world. A familiar spark.";
  $("primary-objective").textContent = "Forage for fruit";
  $("secondary-objective").textContent = "Discover the valley";
  $("tip-copy").innerHTML =
    "Sing to peaceful creatures.<br>Your nest is a safe place to rest.";
  $("friends-objective").hidden = false;
  if (state.stage === "civilization") configureSettlementHUD();
}

function completeChapter() {
  showModal(
    "chapter-complete",
    "A species finds its home.",
    `<p>You explored the valley, gathered food, and found companions. Your species is ready to build a future together.</p><div class="progress-summary"><div><strong>3</strong><span>Landmarks found</span></div><div><strong>${state.land.friends.length}</strong><span>Companions</span></div><div><strong>${state.land.fruit}</strong><span>Fruit gathered</span></div></div><p>Found a settlement at your nest to begin the civilization chapter.</p><div class="chapter-options"><button class="modal-action" id="open-settlement">Begin civilization ↗</button><button class="modal-secondary" data-resume>Keep exploring</button></div>`,
  );
}

function openShore() {
  if (state.stage !== "cell") {
    toast("You are already exploring the creature stage.");
    return;
  }
  if (!canWalk(state)) {
    showModal(
      "shore-locked",
      "The shore is calling.",
      `<p>Evolve three cell adaptations to grow the body you need for life on land.</p><div class="chapter-intro"><p>${Math.min(3, state.generation - 1)} / 3 adaptations complete</p><p>Collect nutrients, then press E to adapt. Every trait carries into your land creature.</p></div><button class="modal-action" data-resume>Keep evolving</button>`,
    );
    return;
  }
  showModal(
    "shore",
    "Take your first steps.",
    `<p>What began as a spark in the ocean is ready for a larger world. Your adaptations and DNA will carry into your new body.</p><div class="chapter-intro"><p>Explore a living valley. Forage to stay nourished.</p><p>Sing to make companions. Strike or dash to escape hunters.</p><p>Return to your nest to recover. Your journey saves automatically.</p></div><div class="chapter-options"><button class="modal-action" id="enter-land">Evolve onto land ↗</button><button class="modal-secondary" data-resume>Stay in the ocean</button></div>`,
  );
}

const cellUpdateUI = updateUI;
updateUI = function () {
  $("launch-space").hidden =
    state.stage !== "civilization" || !state.village.completed;
  if (state.stage === "space") {
    updateSpaceUI();
    return;
  }
  cellUpdateUI();
  $("chapter-banner").hidden = !canWalk(state);
  $("settlement-unlock").hidden = !canFound(state);
  $("civilization-stage").className =
    state.stage === "civilization"
      ? "stage current"
      : canFound(state)
        ? "stage unlocked"
        : "stage locked";
  if (state.stage === "cell") {
    $("creature-stage").className = canWalk(state)
      ? "stage unlocked"
      : "stage locked";
    $("evolve-objective").textContent =
      `${Math.min(3, state.generation - 1)} / 3 adaptations to reach land`;
    if (canWalk(state))
      $("evolution-label").textContent = "Ready to leave the ocean.";
    return;
  }
  $("hunger-label").textContent = Math.ceil(state.land.hunger) + "%";
  $("hunger-bar").style.width = state.land.hunger + "%";
  $("collect-count").textContent =
    `${Math.min(state.land.fruit, 12)} / 12 gathered`;
  $("objective-check").textContent = state.land.fruit >= 12 ? "✓" : "↗";
  $("evolve-objective").textContent =
    `${state.land.discoveries.length} / 3 landmarks found`;
  $("friends-count").textContent =
    `${state.land.friends.length} / 2 companions`;
  $("dash-state").textContent =
    landWorld.cooldowns.dash > 0
      ? landWorld.cooldowns.dash.toFixed(1) + "s"
      : "Ready";
  $("attack-ready").textContent =
    landWorld.cooldowns.attack > 0
      ? landWorld.cooldowns.attack.toFixed(1) + "s"
      : "Ready";
  $("sing-ready").textContent =
    landWorld.cooldowns.sing > 0
      ? landWorld.cooldowns.sing.toFixed(1) + "s"
      : "Ready";
  $("interaction-hint").textContent = landWorld.context();
  $("evolution-label").textContent = state.land.completed
    ? "An established species. Keep exploring."
    : state.dna >= 30
      ? "A new adaptation is ready."
      : "Build the creature you will become.";
  if (state.stage === "civilization") updateVillageUI();
};
const cellDash = dash;
dash = function () {
  if (paused || dead) return;
  if (state.stage !== "cell") {
    if (landWorld.dash()) soundNote(200, 0.1);
  } else cellDash();
};
const cellEvolution = openEvolution;
openEvolution = function () {
  if (state.stage === "space") {
    showHelp();
    return;
  }
  if (state.stage === "cell") {
    cellEvolution();
    return;
  }
  if (dead) return;
  const traits = [
    ["speed", "≋", "Powerful legs", "Move faster and strike harder."],
    ["armor", "◈", "Protective plates", "Reduce damage from hunters."],
    ["magnet", "✺", "Foraging senses", "Gather fruit from farther away."],
  ];
  showModal(
    "evolve",
    "Shape your next generation.",
    `<p>Your cell traits live on in your new body. You have <strong>${state.dna} DNA</strong>.</p><div class="adaptations">${traits.map(([key, icon, title, copy]) => `<button class="adaptation" data-upgrade="${key}" ${state.dna < 30 || state[key] >= 12 ? "disabled" : ""}><span>${icon}</span><h3>${title}</h3><p>${copy}</p><strong>${state[key] >= 12 ? "Maximum level" : "30 DNA · Lv " + state[key]}</strong></button>`).join("")}</div><p>Each adaptation restores vitality and is saved to your journey.</p><div class="color-options">Pigment ${["b0dc86", "65c9c5", "b89bda", "e2b17f"].map((c) => `<button data-color="${c}" style="background:#${c}" aria-label="Choose ${c} pigment"></button>`).join("")}</div>`,
  );
};
const cellUpgrade = upgrade;
upgrade = function (type) {
  if (
    !["speed", "armor", "magnet"].includes(type) ||
    state.dna < 30 ||
    state[type] >= 12
  )
    return;
  if (state.stage === "cell") {
    cellUpgrade(type);
    if (canWalk(state)) toast("The shore is calling · Creature stage unlocked");
  } else {
    state.dna -= 30;
    state[type]++;
    state.generation++;
    state.health = 100;
    landWorld.setTraits();
    closeModal();
    toast("Adaptation complete · Generation " + state.generation);
    soundNote(460, 0.35);
    updateUI();
  }
  saveProgress();
};
const cellHelp = showHelp;
showHelp = function () {
  if (state.stage === "space") {
    showModal(
      "space-help",
      "A species among the stars.",
      `<p>Choose a star system to jump there for 3 fuel. Solar collectors restore fuel automatically, so you can always continue.</p><p>Select a planet and survey it for 18 ore and 12 knowledge. Surveyed ocean gardens support colonies for 40 ore and 20 knowledge. Each colony produces ore over time. Some garden worlds are home to alien civilizations: establish contact for a one-time exchange of resources.</p><p>Survey 6 worlds, found 3 colonies, and meet 2 civilizations. Then assemble the Horizon beacon for 60 ore and 40 knowledge. Exploration can continue after completion.</p><button class="modal-action" data-resume>Return to orbit</button>`,
    );
    return;
  }
  if (state.stage === "civilization") {
    showCivilizationHelp();
    return;
  }
  if (state.stage === "cell") {
    cellHelp();
    return;
  }
  showModal(
    "help",
    "Make a home in the valley.",
    `<p>Forage for fruit to earn DNA and replenish nourishment. Discover all three landmarks and befriend two creatures to complete this chapter.</p><div class="notes-row"><span>Move / dash</span><strong>WASD, arrows, or hold pointer / Space</strong></div><div class="notes-row"><span>Strike a hunter</span><strong>Q · short range</strong></div><div class="notes-row"><span>Make a friend</span><strong>F · sing three times nearby</strong></div><div class="notes-row"><span>Adapt / pause</span><strong>E / Escape</strong></div><p>Companions follow you and reduce incoming damage. The nest (white dot on the map) restores vitality and nourishment.</p><button class="modal-action" data-resume>Back to the valley</button>`,
  );
};
journal = function () {
  if (state.stage === "space") {
    showModal(
      "journal",
      "The story of your species.",
      `<p>Chapter 04 · The Starward Frontier</p><div class="notes-row"><span>Worlds surveyed / Colonies</span><strong>${state.space.surveyed.length} / ${state.space.colonies.length}</strong></div><div class="notes-row"><span>Alien contacts</span><strong>${state.space.contacts.length}</strong></div><p>${saveAvailable ? "Your complete journey, including your home civilization, saves on this device." : "Saving is unavailable. Progress lasts for this open tab."}</p><div class="chapter-options"><button class="modal-action" data-resume>Return to the stars</button><button class="modal-secondary" id="new-journey">New journey</button></div>`,
    );
    return;
  }
  showModal(
    "journal",
    "The story of your species.",
    `<p>${state.stage === "civilization" ? "Chapter 03 · The First Hearth" : state.stage === "creature" ? "Chapter 02 · The Verdant Cradle" : "Chapter 01 · The Primordial Shallows"}</p><div class="notes-row"><span>Generation</span><strong>${state.generation}</strong></div><div class="notes-row"><span>Adaptations / DNA</span><strong>${state.speed + state.armor + state.magnet} / ${state.dna}</strong></div><div class="notes-row"><span>Time alive</span><strong>${Math.floor(state.elapsed / 60)}m ${Math.floor(state.elapsed % 60)}s</strong></div><div class="notes-row"><span>Cell nutrients / Land fruit</span><strong>${state.eaten} / ${state.land.fruit}</strong></div><div class="notes-row"><span>Landmarks / Companions</span><strong>${state.land.discoveries.length} / ${state.land.friends.length}</strong></div>${state.stage === "civilization" ? `<div class="notes-row"><span>Villagers / Raids repelled</span><strong>${state.village.population} / ${state.village.survived}</strong></div>` : ""}<p>${saveAvailable ? "Your journey saves on this device. Reloading resumes your progress." : "Your browser is not allowing saves. Progress lasts for this open tab."}</p><div class="chapter-options"><button class="modal-action" data-resume>Continue journey</button><button class="modal-secondary" id="new-journey">New journey</button></div>`,
  );
};
pauseGame = function () {
  if (dead) return;
  if (paused) {
    closeModal();
    return;
  }
  saveProgress();
  showModal(
    "pause",
    "The world can wait.",
    `<p>Your journey is paused. ${saveAvailable ? "Progress is saved on this device." : ""}</p><div class="chapter-options"><button class="modal-action" data-resume>Resume journey</button><button class="modal-secondary" id="open-notes">Field notes</button></div>`,
  );
};
const cellDeath = gameOver;
gameOver = function () {
  if (dead) return;
  if (state.stage === "cell") {
    cellDeath();
    saveProgress();
    return;
  }
  dead = true;
  showModal(
    "death",
    "Your nest is waiting.",
    `<p>The valley is unforgiving, but your species survives. Return to your nest with your adaptations, companions, and discoveries intact. You lose up to 10 DNA.</p><button class="modal-action" id="respawn-land">Return to the nest</button>`,
  );
  saveProgress();
};
const cellRestart = restart;
restart = function () {
  if (state.stage !== "cell" && dead) {
    if (state.stage === "civilization" && state.village.defeated)
      landWorld.recover();
    else landWorld.respawn();
    dead = false;
    closeModal();
    saveProgress();
    updateUI();
    return;
  }
  cellRestart();
  state = { ...newJourney(), ...state };
  state.color = 0xb0dc86;
  recolorCell(state.color);
  saveProgress();
};

function releaseLandWorld() {
  if (landWorld) {
    const geometries = new Set(),
      materials = new Set();
    landWorld.scene.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) materials.add(o.material);
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    landWorld = null;
  }
}

function newGame() {
  releaseLandWorld();
  state = newJourney();
  dead = false;
  $("game").classList.remove("land-mode");
  $("game").classList.remove("civilization-mode");
  $("game").classList.remove("space-mode");
  $("space-hud").hidden = true;
  $("launch-space").hidden = true;
  for (const id of [
    "village-resources",
    "village-panel",
    "village-mission",
    "toggle-village",
    "settlement-unlock",
  ])
    $(id).hidden = true;
  $("land-actions").hidden = true;
  $("interaction-hint").hidden = true;
  $("land-vitals").hidden = true;
  $("friends-objective").hidden = true;
  if (renderer.shadowMap) renderer.shadowMap.enabled = false;
  $("species-name").textContent = "Lumina";
  $("species-subtitle").textContent = "Herbivore · Single-cell organism";
  $("stage-info").className = "stage active";
  $("creature-stage").className = "stage locked";
  $("civilization-stage").className = "stage locked";
  $("biome-title").textContent = "THE PRIMORDIAL SHALLOWS";
  $("biome-time").textContent = "3.8 billion years before now";
  $("depth-name").textContent = "SHALLOWS";
  $("depth-value").textContent = "12 m ↓";
  $("food-legend").textContent = "Nutrients";
  $("chapter-count").textContent = "01 / 04";
  $("chapter-eyebrow").textContent = "THE BEGINNING";
  $("chapter-title").textContent = "A spark of life";
  $("chapter-description").textContent = "Every great journey starts small.";
  $("primary-objective").textContent = "Collect nutrients";
  $("secondary-objective").textContent = "Evolve your organism";
  $("tip-copy").innerHTML =
    "Follow the green glow.<br>Stay clear of the red hunters.";
  restart();
  camera.position.set(0, 0, innerWidth < 760 ? 54 : 47);
}

function openSettlement() {
  if (state.stage === "civilization") {
    if (paused) closeModal();
    toggleVillage();
    return;
  }
  if (!canFound(state)) {
    showModal(
      "settlement-locked",
      "A future together.",
      `<p>Complete the creature chapter to found your settlement.</p><div class="chapter-intro"><p>Gather 12 fruit · ${Math.min(12, state.land.fruit)}/12</p><p>Befriend 2 creatures · ${Math.min(2, state.land.friends.length)}/2</p><p>Discover all 3 landmarks · ${state.land.discoveries.length}/3</p></div><p>Your existing adaptations and discoveries carry forward.</p><button class="modal-action" data-resume>Continue your journey</button>`,
    );
    return;
  }
  showModal(
    "settlement",
    "From a nest to a civilization.",
    `<p>Your companions are ready to build a permanent home. Lead four villagers from the first hearth to a thriving settlement.</p><div class="chapter-intro"><p>Build gardens to feed your people and dwellings to welcome more.</p><p>Assign villagers to gather wood, stone, and food, or defend the village.</p><p>Prepare watchtowers before the first raid arrives in two minutes.</p></div><p>Grow to eight villagers, build two gardens and two watchtowers, repel two raids, then raise the Life monument.</p><div class="chapter-options"><button id="enter-civilization" class="modal-action">Found the First Hearth ↗</button><button data-resume class="modal-secondary">Stay in the valley</button></div>`,
  );
}

function configureSettlementHUD() {
  $("chapter-count").textContent = "03 / 04";
  $("game").classList.add("civilization-mode");
  for (const id of [
    "village-resources",
    "village-panel",
    "village-mission",
    "toggle-village",
  ])
    $(id).hidden = false;
  $("settlement-unlock").hidden = true;
  $("creature-stage").className = "stage previous";
  $("civilization-stage").className = "stage current";
  $("species-name").textContent = "The Lumina";
  $("species-subtitle").textContent = "Founders · Verdant Hearth";
  $("depth-name").textContent = "FIRST HEARTH";
  $("depth-value").textContent = "DAY 1";
  showVillageTab("build");
  updateVillageUI();
}

function showVillageTab(tab) {
  $("construction-page").hidden = tab !== "build";
  $("people-page").hidden = tab !== "people";
  $("build-tab").setAttribute("aria-pressed", String(tab === "build"));
  $("people-tab").setAttribute("aria-pressed", String(tab === "people"));
}

function toggleVillage() {
  if (state.stage !== "civilization" || dead) return;
  $("village-panel").hidden = !$("village-panel").hidden;
}

function updateVillageUI() {
  if (state.stage !== "civilization" || !landWorld) return;
  const v = state.village,
    rates = production(v);
  for (const key of ["wood", "stone", "food"]) {
    $(key + "-count").textContent = Math.floor(v.resources[key]);
    $(key + "-rate").textContent =
      `${rates[key] >= 0 ? "+" : ""}${rates[key].toFixed(1)}/s`;
  }
  $("village-population").textContent =
    `${v.population} / ${Math.min(16, capacity(v))}`;
  for (const button of $("build-menu").querySelectorAll("[data-build]")) {
    const type = button.dataset.build;
    button.classList.toggle("selected", landWorld.buildType === type);
    button.classList.toggle(
      "short-resources",
      !affordable(v, BUILDINGS[type].cost),
    );
    button.setAttribute("aria-pressed", String(landWorld.buildType === type));
  }
  for (const job of JOBS) $("job-" + job).textContent = v.jobs[job];
  for (const button of $("job-menu").querySelectorAll("[data-job]"))
    button.disabled =
      button.dataset.delta === "1"
        ? idleWorkers(v) === 0
        : v.jobs[button.dataset.job] === 0;
  $("idle-count").textContent = `${idleWorkers(v)} villagers available`;
  $("recruit-villager").disabled =
    v.recruitTime > 0 ||
    v.population >= Math.min(16, capacity(v)) ||
    v.resources.food < 25;
  $("recruit-villager").textContent =
    v.recruitTime > 0
      ? `Arriving in ${Math.ceil(v.recruitTime)}s`
      : "Recruit villager · 25 food";
  $("recruit-hint").textContent =
    v.population >= 16
      ? "Your settlement has reached 16 villagers."
      : v.population >= capacity(v)
        ? "Build a dwelling to welcome two more villagers."
        : v.resources.food < 25
          ? "Gather 25 food to recruit a villager."
          : "New villagers arrive in 12 seconds. Assign their work.";
  $("cancel-building").hidden = !landWorld.buildType;
  const selected = v.buildings.find(
    (b) => b.id === landWorld.selectedId && b.health > 0,
  );
  $("selected-building").textContent = landWorld.buildType
    ? BUILDINGS[landWorld.buildType].name
    : selected
      ? BUILDINGS[selected.type].name
      : "Choose a building";
  $("building-condition").textContent = landWorld.buildType
    ? landWorld.plot?.error ||
      "Click a clear patch of ground inside the boundary."
    : selected
      ? selected.progress < 1
        ? `Under construction · ${Math.ceil((1 - selected.progress) * BUILDINGS[selected.type].seconds)}s remaining`
        : `Condition ${Math.ceil(selected.health)} / ${BUILDINGS[selected.type].health}`
      : "Click a building in the world to inspect it.";
  $("repair-building").hidden = !selected || !!landWorld.buildType;
  $("repair-building").disabled =
    !selected ||
    selected.progress < 1 ||
    selected.health >= BUILDINGS[selected.type].health ||
    v.resources.wood < 10;
  $("raid-status").className =
    v.raiders.length || v.resources.food === 0 ? "danger" : "";
  $("raid-status").textContent = v.defeated
    ? "The hearth has fallen."
    : v.raiders.length
      ? `Raid ${v.wave} · ${v.raiders.length} raiders remain`
      : v.completed
        ? "The settlement is at peace."
        : v.resources.food === 0
          ? "Food depleted · The hearth is weakening!"
          : `${v.wave ? "Next raid" : "First raid"} in ${Math.floor(v.nextRaid / 60)}:${String(Math.ceil(v.nextRaid % 60)).padStart(2, "0")}`;
  const requirements = monumentRequirements(v),
    monument = v.buildings.find((b) => b.type === "monument" && b.health > 0);
  $("monument-requirements").innerHTML = requirements
    .map(
      (r) =>
        `<div class="${r.done ? "done" : ""}">${r.done ? "✓" : "○"} ${r.text}</div>`,
    )
    .join("");
  $("mission-title").textContent = v.completed
    ? "A civilization takes root"
    : monument
      ? "The monument is rising"
      : "Raise the Life monument";
  $("evolution-label").textContent = v.completed
    ? "From one cell to a lasting civilization."
    : monument
      ? `Monument construction · ${Math.round(monument.progress * 100)}%`
      : "Build a future for your species.";
  const percent = v.completed
    ? 100
    : Math.round(
        (requirements.filter((r) => r.done).length / 5) * 100 +
          (monument ? monument.progress * 20 : 0),
      );
  $("evolution-percent").textContent = percent + "%";
  $("evolution-fill").style.width = percent + "%";
}

function showCivilizationHelp() {
  showModal(
    "help",
    "Build a future together.",
    `<p>Use the Build tab to select a structure, then click clear ground within the marked settlement boundary. A green outline means the plot is valid; a red outline explains what is missing. Escape cancels placement.</p><div class="notes-row"><span>Build / people panel</span><strong>B or Settlement</strong></div><div class="notes-row"><span>Assign work</span><strong>People tab · − and +</strong></div><div class="notes-row"><span>Move / defend</span><strong>WASD or hold pointer / Q</strong></div><div class="notes-row"><span>Repair</span><strong>Click a building · 10 wood</strong></div><p>Gardens produce food. Dwellings add capacity. Recruit villagers for 25 food, then assign their jobs. Wood camps and stone works speed up gathering. Guards protect attacked buildings; watchtowers fire automatically within range.</p><p>Grow to eight villagers, finish two gardens and two watchtowers, and repel two raids. Then build the Life monument to complete your civilization. Your settlement, construction, and raids all save automatically.</p><button class="modal-action" data-resume>Return to the hearth</button>`,
  );
}

function settlementDefeat() {
  dead = true;
  showModal(
    "settlement-defeat",
    "The ember still glows.",
    `<p>Your hearth has fallen. Your people will help rebuild it, bring emergency supplies, and give you two minutes to prepare. Surviving buildings, villagers, and completed milestones remain.</p><button class="modal-action" id="recover-settlement">Rekindle the hearth</button>`,
  );
}

function civilizationVictory() {
  showModal(
    "victory",
    "From a spark to a civilization.",
    `<p>The Life monument stands. New raids have stopped, and your species is ready to reach beyond its home world.</p><p>Continue gathering resources, then open Spaceflight to research a launchpad and build your first spacecraft.</p><button class="modal-action" data-resume>Prepare for the stars</button>`,
  );
}

function initializeSettlementControls() {
  const costText = (cost) =>
    Object.entries(cost)
      .map(([key, value]) => `${value} ${key}`)
      .join(" · ");
  $("build-menu").innerHTML = Object.entries(BUILDINGS)
    .filter(([key]) => key !== "hearth")
    .map(
      ([key, b]) =>
        `<button class="build-card" data-build="${key}" aria-pressed="false" title="${b.description}"><span>${b.icon}</span><strong>${b.name}</strong><small>${costText(b.cost)}</small></button>`,
    )
    .join("");
  const jobNames = {
    wood: "Woodcutters",
    stone: "Stoneworkers",
    food: "Foragers",
    guard: "Guards",
  };
  $("job-menu").innerHTML = JOBS.map(
    (job) =>
      `<div class="job-row"><span>${jobNames[job]}</span><button data-job="${job}" data-delta="-1" aria-label="Remove ${jobNames[job]}">−</button><strong id="job-${job}">0</strong><button data-job="${job}" data-delta="1" aria-label="Add ${jobNames[job]}">+</button></div>`,
  ).join("");
  $("build-menu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-build]");
    if (!button || paused || dead) return;
    landWorld.chooseBuilding(button.dataset.build);
    pointerDown = false;
    updateVillageUI();
  });
  $("job-menu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-job]");
    if (!button || paused || dead) return;
    if (
      assignWorker(
        state.village,
        button.dataset.job,
        Number(button.dataset.delta),
      )
    ) {
      saveProgress();
      updateVillageUI();
    }
  });
  $("recruit-villager").onclick = () => {
    if (paused || dead) return;
    if (recruit(state.village)) {
      saveProgress();
      updateVillageUI();
      toast("A new villager is on the way.");
    }
  };
  $("build-tab").onclick = () => showVillageTab("build");
  $("people-tab").onclick = () => showVillageTab("people");
  $("toggle-village").onclick = toggleVillage;
  $("cancel-building").onclick = () => {
    landWorld?.cancelPlacement();
    updateVillageUI();
  };
  $("repair-building").onclick = () => {
    if (!paused && !dead) {
      landWorld.repairSelected();
      updateVillageUI();
    }
  };
}

$("modal-content").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.id === "enter-land" && enterCreatureStage(state)) {
    startLand();
    closeModal();
    saveProgress();
    updateUI();
    toast("Chapter 02 · Welcome to the Verdant Cradle");
  }
  if (button.id === "open-settlement") openSettlement();
  if (button.id === "enter-civilization" && enterCivilizationStage(state)) {
    releaseLandWorld();
    startLand();
    closeModal();
    saveProgress();
    updateUI();
    toast("Chapter 03 · The First Hearth");
  }
  if (button.id === "recover-settlement") restart();
  if (button.dataset.color) {
    state.color = parseInt(button.dataset.color, 16);
    landWorld?.setColor(state.color);
    saveProgress();
  }
  if (button.id === "respawn-land") restart();
  if (button.id === "open-notes") journal();
  if (button.id === "new-journey")
    showModal(
      "new-journey",
      "Begin a new journey?",
      `<p>This replaces the journey saved on this device. Your current adaptations and discoveries will be lost.</p><div class="chapter-options"><button class="modal-action" id="confirm-new-journey">Begin again</button><button class="modal-secondary" data-resume>Keep this journey</button></div>`,
    );
  if (button.id === "confirm-new-journey") newGame();
});
$("shore").onclick = openShore;
$("creature-stage").onclick = openShore;
$("civilization-stage").onclick = openSettlement;
$("found-settlement").onclick = openSettlement;
$("evolve").onclick = openEvolution;
$("mobile-evolve").onclick = openEvolution;
$("mobile-dash").onclick = dash;
$("help").onclick = showHelp;
$("stage-info").onclick = showHelp;
$("pause").onclick = pauseGame;
$("journal").onclick = journal;
$("attack").onclick = () => {
  if (!paused && !dead) landWorld?.attack();
};
$("sing").onclick = () => {
  if (!paused && !dead) landWorld?.sing();
};
$("return-nest").onclick = () => {
  if (!landWorld) return;
  const p = landWorld.player.position;
  const direction = [
    p.y > 3 ? "south" : p.y < -3 ? "north" : "",
    p.x > 3 ? "west" : p.x < -3 ? "east" : "",
  ]
    .filter(Boolean)
    .join("-");
  toast(
    direction
      ? `Your nest is ${direction} · ${Math.round(Math.hypot(p.x, p.y))} m away (white map dot)`
      : "You are home. Rest here to recover.",
  );
};
addEventListener("keydown", (event) => {
  if (event.repeat || paused || dead || state.stage === "cell") return;
  if (event.code === "KeyQ") landWorld.attack();
  if (event.code === "KeyF") landWorld.sing();
  if (event.code === "KeyB" && state.stage === "civilization") toggleVillage();
});
addEventListener("resize", () => landWorld?.resize(innerWidth, innerHeight));
addEventListener("pagehide", saveProgress);
function startSpace() {
  landWorld = new SpaceWorld(state);
  landWorld.resize(innerWidth, innerHeight);
  $("game").classList.add("space-mode");
  $("game").classList.remove("civilization-mode");
  $("space-hud").hidden = false;
  $("launch-space").hidden = true;
  if (renderer.shadowMap) renderer.shadowMap.enabled = false;
  $("space-systems").innerHTML = SYSTEMS.map(
    (s) =>
      `<button data-system="${s.id}"><span>${String(s.id + 1).padStart(2, "0")}</span>${s.name}<small>3 fuel</small></button>`,
  ).join("");
  updateSpaceUI();
}
function openSpaceflight() {
  if (state.stage !== "civilization" || !state.village.completed) return;
  const r = state.village.resources;
  const researched = state.space.researched;
  const ready = researched
    ? r.wood >= 80 && r.stone >= 40 && r.food >= 60
    : r.wood >= 80 && r.stone >= 80;
  showModal(
    "spaceflight",
    researched ? "Your first spacecraft." : "The sky is only the beginning.",
    `<p>${researched ? "The launchpad is ready. Build a vessel to carry your species into a frontier of nine star systems." : "Research orbital flight and construct a launchpad beside your civilization. Then prepare a spacecraft for the journey."}</p><div class="notes-row"><span>Available supplies</span><strong>${Math.floor(r.wood)} wood · ${Math.floor(r.stone)} stone · ${Math.floor(r.food)} food</strong></div><p>${researched ? "Spacecraft: 80 wood · 40 stone · 60 food" : "Launchpad research: 80 wood · 80 stone"}</p><p>Your home civilization is preserved while you explore space.</p><button class="modal-action" id="${researched ? "launch-vessel" : "research-flight"}" ${ready ? "" : "disabled"}>${researched ? "Launch into orbit ↗" : "Research spaceflight"}</button><button class="modal-secondary" data-resume>Return to settlement</button>`,
  );
}
function updateSpaceUI() {
  const s = state.space,
    system = SYSTEMS[s.system],
    p = system.planets[s.planet];
  const busy = landWorld?.transit > 0;
  $("space-location").textContent = system.name;
  $("space-fuel").textContent = `${s.fuel.toFixed(1)} / 12`;
  $("space-ore").textContent = Math.floor(s.ore);
  $("space-data").textContent = Math.floor(s.data);
  $("space-planet-name").textContent = p.name;
  $("space-planet-kind").textContent =
    `${p.kind}${p.inhabited ? " · Radio signals detected" : ""}`;
  $("space-status").textContent = busy
    ? "Crossing the interstellar frontier…"
    : s.colonies.includes(p.id)
      ? "Colony established · Producing ore"
      : s.surveyed.includes(p.id)
        ? "Survey complete · Choose your next discovery"
        : "Uncharted world · Ready for orbital survey";
  $("space-progress").textContent =
    `${Math.min(6, s.surveyed.length)}/6 surveys · ${Math.min(3, s.colonies.length)}/3 colonies · ${Math.min(2, s.contacts.length)}/2 contacts`;
  $("space-goal").textContent = s.completed
    ? "Horizon beacon active · Keep exploring"
    : "Connect your species to the stars";
  $("space-survey").disabled = busy || s.surveyed.includes(p.id);
  $("space-colonize").disabled =
    busy ||
    !p.habitable ||
    !s.surveyed.includes(p.id) ||
    s.colonies.includes(p.id) ||
    s.ore < 40 ||
    s.data < 20;
  $("space-contact").hidden = !p.inhabited;
  $("space-contact").disabled =
    busy || !s.surveyed.includes(p.id) || s.contacts.includes(p.id);
  $("space-beacon").disabled =
    busy || s.completed || !beaconReady(s) || s.ore < 60 || s.data < 40;
  for (const button of $("space-systems").querySelectorAll("button")) {
    const current = Number(button.dataset.system) === s.system;
    button.classList.toggle("selected", current);
    button.setAttribute("aria-pressed", String(current));
    button.disabled = current || busy || s.fuel < 3;
  }
  for (const button of $("space-planets").querySelectorAll("button")) {
    const n = Number(button.dataset.planet);
    button.textContent = system.planets[n].name;
    button.classList.toggle("selected", n === s.planet);
    button.setAttribute("aria-pressed", String(n === s.planet));
    button.disabled = busy;
  }
}
$("launch-space").onclick = openSpaceflight;
$("space-journal").onclick = journal;
$("modal-content").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.id === "research-flight" && researchSpace(state)) {
    saveProgress();
    openSpaceflight();
  }
  if (button.id === "launch-vessel" && launchSpace(state)) {
    releaseLandWorld();
    startSpace();
    closeModal();
    saveProgress();
    toast("Chapter 04 · The Starward Frontier");
  }
});
$("space-hud").addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b || paused || state.stage !== "space" || landWorld.transit > 0) return;
  const s = state.space;
  if (b.dataset.system !== undefined && jump(s, Number(b.dataset.system))) {
    landWorld.setDestination();
    soundNote(180, 0.6);
  }
  if (b.dataset.planet !== undefined) {
    const p = Number(b.dataset.planet);
    if (Number.isInteger(p) && p >= 0 && p < 3) s.planet = p;
  }
  if (b.id === "space-survey" && survey(s))
    toast("Survey complete · +18 ore · +12 knowledge");
  if (b.id === "space-colonize" && colonize(s))
    toast("A new home among the stars · Colony established");
  if (b.id === "space-contact" && contact(s))
    toast("Peaceful contact · +20 ore · +15 knowledge");
  if (b.id === "space-beacon" && buildBeacon(s))
    showModal(
      "space-victory",
      "From a single cell to the stars.",
      '<p>Your Horizon beacon carries the story of your species across the frontier. Your colonies and new allies are connected. All four chapters are complete.</p><p>The remaining worlds are yours to discover.</p><button class="modal-action" data-resume>Keep exploring the galaxy</button>',
    );
  saveProgress();
  updateSpaceUI();
});
initializeSettlementControls();
const BUILD_VERSION = "0.4.0";
$("reload-update").onclick = () => {
  if (!saveProgress()) {
    toast(
      "Saving is unavailable. Reload manually only if you are ready to restart.",
    );
    return;
  }
  location.reload();
};
if (typeof window !== "undefined" && typeof fetch === "function") {
  setInterval(async () => {
    try {
      const response = await fetch("./build.json", { cache: "no-store" });
      if (!response.ok) return;
      const build = await response.json();
      $("update-notice").hidden =
        !build.version || build.version === BUILD_VERSION;
    } catch {
      /* An offline session can continue without update checks. */
    }
  }, 30000);
}
const savedJourney = loadJourney(saveStorage);
if (savedJourney) {
  state = savedJourney;
  restoreCellTraits();
  player.position.set(state.cellPosition.x, state.cellPosition.y, 0);
  camera.position.x = player.position.x;
  camera.position.y = player.position.y;
  if (state.stage !== "cell") startLand();
  pauseGame();
  $("modal-title").textContent = "Welcome back, little explorer.";
  if (state.stage === "civilization" && state.village.defeated)
    settlementDefeat();
}
updateUI();
drawMap();
requestAnimationFrame(loop);
// A small structured interface supports pausing and inspecting this local game session.
if (document.modelContext?.registerTool) {
  for (const tool of [
    {
      name: "inspect_organism",
      description: "Read the current organism, vitality, DNA, and adaptations.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => ({
        content: [{ type: "text", text: JSON.stringify({ ...state, paused }) }],
      }),
    },
    {
      name: "pause_ocean",
      description: "Pause the Primordia game.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        if (!paused) pauseGame();
        return { content: [{ type: "text", text: "Game paused." }] };
      },
    },
  ]) {
    try {
      void Promise.resolve(document.modelContext.registerTool(tool)).catch(
        () => {},
      );
    } catch {}
  }
}
