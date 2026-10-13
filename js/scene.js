// Escena 3D: el bar, la mesa, los jugadores con sus caras, las cartas y la cámara (tu cabeza).
import * as THREE from 'three';
import { cardCanvas, backCanvas } from './cards.js';
import { buildRoom, buildTable, buildLamp, addAmbientLights, TABLE_Y } from './decor.js';

const SEAT_D = 0.9;
const CARD_W = 0.068, CARD_H = 0.102;
// En pantallas verticales los rivales se acercan hacia delante para que quepan en el plano.
const LAYOUTS = {
  wide: { neck: new THREE.Vector3(0, 1.1, SEAT_D + 0.25), pitch: -0.15, side: 0, dist: SEAT_D, hand: new THREE.Vector3(0, -0.11, -0.58), handScale: 1 },
  compact: { neck: new THREE.Vector3(0, 1.2, SEAT_D + 0.45), pitch: -0.26, side: 0.7, dist: 0.86, hand: new THREE.Vector3(0, -0.23, -0.45), handScale: 1.25 },
};
const EYE_OFFSET = new THREE.Vector3(0, 0.08, -0.11);
const FACE_PHI = Math.PI * 0.8, FACE_T0 = Math.PI * 0.16, FACE_TL = Math.PI * 0.7;
const REVEAL_SCALE = 1.35;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const seatAngle = (rel, side = 0) => (rel * Math.PI) / 2 + (rel === 1 ? side : rel === 3 ? -side : 0);
const seatDir = (rel, side = 0) => new THREE.Vector3(Math.sin(seatAngle(rel, side)), 0, Math.cos(seatAngle(rel, side)));

function srgbTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const matCache = new Map();
function frontMaterial(card) {
  const key = card.suit + card.rank;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ map: srgbTexture(cardCanvas(card)), roughness: 0.55, alphaTest: 0.5 }));
  }
  return matCache.get(key);
}
function backMaterial() {
  if (!matCache.has('back')) {
    matCache.set('back', new THREE.MeshStandardMaterial({ map: srgbTexture(backCanvas()), roughness: 0.55, alphaTest: 0.5 }));
  }
  return matCache.get('back');
}

const cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
function makeCard(card) {
  const g = new THREE.Group();
  const front = new THREE.Mesh(cardGeo, card ? frontMaterial(card) : backMaterial());
  const back = new THREE.Mesh(cardGeo, backMaterial());
  back.rotation.y = Math.PI;
  front.castShadow = true;
  g.add(front, back);
  g.userData = { card, front };
  return g;
}
function setCardFace(g, card) {
  g.userData.card = card;
  g.userData.front.material = frontMaterial(card);
}

function limb(a, b, r, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2 + r), 6, 12), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  return m;
}

const emojiTexCache = new Map();
function emojiTexture(emoji) {
  if (!emojiTexCache.has(emoji)) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
    ctx.font = '84px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 70);
    emojiTexCache.set(emoji, srgbTexture(cv));
  }
  return emojiTexCache.get(emoji);
}

// Posición de la carta i (de n) en un abanico, con el pivote abajo.
function fanSlot(i, n, step, radius) {
  const a = -(i - (n - 1) / 2) * step;
  return {
    pos: new THREE.Vector3(-Math.sin(a) * radius, (Math.cos(a) - 1) * radius, i * 0.0015),
    quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a)),
    angle: a,
  };
}

class Avatar {
  constructor(rel, info) {
    this.rel = rel;
    this.group = new THREE.Group();
    this.place(LAYOUTS.wide);
    this.phase = Math.random() * 10;
    this.yaw = 0; this.pitch = 0; this.targetYaw = 0; this.targetPitch = 0.15;
    this.talk = 0;
    this.sena = null;

    const shirt = new THREE.MeshStandardMaterial({ color: info.shirt, roughness: 0.85 });
    this.skinMat = new THREE.MeshStandardMaterial({ color: '#e0b48f', roughness: 0.65 });
    this.hairMat = new THREE.MeshStandardMaterial({ color: '#2b1d14', roughness: 0.9 });
    this.faceMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });

    // silla
    const wood = new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.6 });
    const chair = new THREE.Group();
    chair.position.z = -0.12;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.44), wood);
    seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.05), wood);
    back.position.set(0, 0.75, -0.22);
    chair.add(seat, back);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8), wood);
      leg.position.set(sx * 0.2, 0.225, sz * 0.19);
      chair.add(leg);
    }
    chair.traverse((o) => { o.castShadow = o.receiveShadow = true; });
    this.group.add(chair);

    // cuerpo
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.26, 8, 16), shirt);
    torso.scale.set(1.15, 1, 0.7);
    torso.position.set(0, 0.86, -0.05);
    torso.castShadow = true;
    const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.28, 6, 12), shirt);
    shoulders.rotation.z = Math.PI / 2;
    shoulders.position.set(0, 1.0, -0.05);
    shoulders.castShadow = true;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 12), this.skinMat);
    neck.position.set(0, 1.12, -0.04);
    this.group.add(torso, shoulders, neck);

    // brazos y manos sujetando las cartas
    for (const sx of [-1, 1]) {
      const sh = new THREE.Vector3(sx * 0.2, 1.0, -0.04);
      const el = new THREE.Vector3(sx * 0.25, 0.83, 0.12);
      const wr = new THREE.Vector3(sx * 0.085, 0.93, 0.27);
      this.group.add(limb(sh, el, 0.05, shirt), limb(el, wr, 0.045, shirt));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), this.skinMat);
      hand.position.copy(wr);
      hand.castShadow = true;
      this.group.add(hand);
    }

    // cabeza (cabezón, para que se vea bien la cara)
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 1.16, -0.04);
    this.headPivot.rotation.order = 'YXZ';
    this.head = new THREE.Group();
    this.head.position.y = 0.16;
    this.head.scale.set(0.95, 1.08, 1);
    this.headPivot.add(this.head);
    this.group.add(this.headPivot);
    const R = 0.15;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 24), this.skinMat);
    skull.castShadow = true;
    const face = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 48, 32, Math.PI / 2 - FACE_PHI / 2, FACE_PHI, FACE_T0, FACE_TL), this.faceMat);
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.19), this.hairMat);
    const hairBack = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.03, 32, 20, Math.PI / 2 + FACE_PHI / 2 - 0.12, Math.PI * 2 - FACE_PHI + 0.24, 0, Math.PI * 0.64),
      this.hairMat,
    );
    this.head.add(skull, face, hairTop, hairBack);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), this.skinMat);
      ear.scale.set(0.45, 0.8, 0.55);
      ear.position.set(sx * R * 1.0, -0.01, -0.005);
      this.head.add(ear);
    }
    this.senaSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthTest: false }));
    this.senaSprite.position.set(0.19, 0.06, 0.08);
    this.senaSprite.scale.set(0.12, 0.12, 1);
    this.senaSprite.renderOrder = 10;
    this.head.add(this.senaSprite);

    // abanico de cartas
    this.fanPivot = new THREE.Group();
    this.fanPivot.position.set(0, 0.99, 0.285);
    this.fanPivot.rotation.y = Math.PI;
    this.fan = new THREE.Group();
    this.fan.rotation.x = -0.45;
    this.fanPivot.add(this.fan);
    this.group.add(this.fanPivot);
    this.cards = [];

    this.setFace(info.face);
  }

  place(lay) {
    this.group.position.copy(seatDir(this.rel, lay.side).multiplyScalar(lay.dist));
    this.group.rotation.y = seatAngle(this.rel, lay.side) + Math.PI;
  }

  setFace(face) {
    if (!face) return;
    if (this.faceMat.map) this.faceMat.map.dispose();
    this.faceMat.map = srgbTexture(face.canvas);
    this.faceMat.needsUpdate = true;
    this.skinMat.color.set(face.skin);
    this.hairMat.color.set(face.hair);
  }

  slot(i, n = 4) {
    return fanSlot(i, n, 0.22, 0.09);
  }

  lookAtPoint(p) {
    const local = this.group.worldToLocal(p.clone()).sub(new THREE.Vector3(0, 1.32, -0.04));
    this.targetYaw = clamp(Math.atan2(local.x, local.z), -1.15, 1.15);
    this.targetPitch = clamp(Math.atan2(-local.y, Math.hypot(local.x, local.z)), -0.35, 0.5);
  }

  showSena(emoji, duration = 1.4) {
    const mat = this.senaSprite.material;
    mat.map = emojiTexture(emoji);
    mat.needsUpdate = true;
    this.sena = { t: 0, duration };
  }

  update(dt, time) {
    const k = Math.min(1, dt * 5);
    this.yaw += (this.targetYaw - this.yaw) * k;
    this.pitch += (this.targetPitch - this.pitch) * k;
    this.talk = Math.max(0, this.talk - dt * 1.4);
    const bob = Math.sin(this.talk * 22) * 0.07 * this.talk;
    this.headPivot.rotation.y = this.yaw + Math.sin(time * 0.6 + this.phase) * 0.04;
    this.headPivot.rotation.x = this.pitch + bob + Math.sin(time * 0.9 + this.phase) * 0.015;
    this.headPivot.rotation.z = Math.sin(time * 0.5 + this.phase * 2) * 0.05;
    const s = 1 + this.talk * 0.06;
    this.head.scale.set(0.95 * s, 1.08 * s, s);
    this.fanPivot.position.y = 0.99 + Math.sin(time * 1.1 + this.phase) * 0.004;
    if (this.sena) {
      this.sena.t += dt;
      const { t, duration } = this.sena;
      this.senaSprite.material.opacity = t < 0.15 ? t / 0.15 : t > duration - 0.25 ? Math.max(0, (duration - t) / 0.25) : 1;
      if (t >= duration) {
        this.sena = null;
        this.senaSprite.material.opacity = 0;
      }
    }
  }
}

export class MusScene {
  constructor(container, overlay) {
    this.container = container;
    this.overlay = overlay;
    this.mySeat = 0;
    this.avatars = [];
    this.tweens = [];
    this.myCards = [];
    this.allCards = new Set();
    this.selected = new Set();
    this.selectable = false;
    this.onCardToggle = null;
    this.camYaw = 0; this.camPitch = 0; this.tYaw = 0; this.tPitch = 0;
    this.gyro = null;
    this.autoLook = true;
    this.lastManual = -1e9;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a120c');
    this.scene.fog = new THREE.Fog('#1a120c', 6, 12);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.03, 40);
    this.camera.rotation.order = 'YXZ';

    buildRoom(this.scene);
    buildTable(this.scene);
    buildLamp(this.scene);
    addAmbientLights(this.scene);

    // Tu mano: delante de ti, inclinada hacia tus ojos.
    this.myHand = new THREE.Group();
    this.scene.add(this.myHand);
    this.lay = LAYOUTS.wide;
    this.applyLayout();

    this.tableGroup = new THREE.Group();
    this.scene.add(this.tableGroup);
    this.deckObj = this.makeDeckObj();
    this.scene.add(this.deckObj);
    this.piles = [new THREE.Group(), new THREE.Group()];
    this.piles.forEach((p) => this.scene.add(p));
    this.pileCounts = [[0, 0], [0, 0]];
    this.discardCount = 0;

    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();
    this.time = 0;

    this.bindInput();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    renderer.setAnimationLoop(() => this.frame());
  }

  rel(seat) { return (seat - this.mySeat + 4) % 4; }
  dir(rel) { return seatDir(rel, this.lay.side); }

  applyLayout() {
    const { neck, hand, handScale } = this.lay;
    this.myHand.position.copy(neck).add(hand);
    this.myHand.scale.setScalar(handScale);
    this.myHand.lookAt(neck.clone().add(EYE_OFFSET));
    for (const a of this.avatars) a?.place(this.lay);
  }

  // players[seat] = { name, face, shirt }
  setup(players, mySeat) {
    this.mySeat = mySeat;
    for (const a of this.avatars) if (a) this.scene.remove(a.group);
    this.avatars = [];
    this.overlay.querySelectorAll('.nametag, .bubble').forEach((n) => n.remove());
    this.tags = [];
    this.bubbles = [];
    for (let seat = 0; seat < 4; seat++) {
      const rel = this.rel(seat);
      if (rel !== 0) {
        const av = new Avatar(rel, players[seat]);
        av.place(this.lay);
        this.scene.add(av.group);
        this.avatars[seat] = av;
      }
      const tag = document.createElement('div');
      tag.className = `nametag team${seat % 2 === mySeat % 2 ? 'us' : 'them'}`;
      tag.innerHTML = `<span class="nm"></span><span class="badge"></span>`;
      tag.querySelector('.nm').textContent = players[seat].name;
      if (rel === 0) tag.classList.add('hidden');
      this.overlay.appendChild(tag);
      this.tags[seat] = tag;
      const bub = document.createElement('div');
      // Los bocadillos de los laterales salen hacia el centro de la pantalla.
      bub.dataset.pos = ['me', 'left', 'top', 'right'][rel];
      bub.className = `bubble ${bub.dataset.pos}`;
      this.overlay.appendChild(bub);
      this.bubbles[seat] = bub;
    }
    this.lookAll(null);
  }

  setFace(seat, face) {
    this.avatars[seat]?.setFace(face);
  }

  setName(seat, name) {
    const nm = this.tags?.[seat]?.querySelector('.nm');
    if (nm) nm.textContent = name;
  }

  headWorld(seat) {
    if (this.rel(seat) === 0) return this.camera.position.clone();
    const p = new THREE.Vector3();
    this.avatars[seat].head.getWorldPosition(p);
    return p;
  }

  // Todos miran a `seat` (o al centro de la mesa si es null).
  lookAll(seat, except = []) {
    const target = seat === null ? new THREE.Vector3(0, TABLE_Y, 0) : this.headWorld(seat);
    this.avatars.forEach((a, s) => {
      if (!a || s === seat || except.includes(s)) return;
      a.lookAtPoint(target);
    });
  }

  lookAt(seat, targetSeat) {
    const a = this.avatars[seat];
    if (!a) return;
    a.lookAtPoint(targetSeat === null ? new THREE.Vector3(0, TABLE_Y, 0) : this.headWorld(targetSeat));
  }

  // ---------- cámara / cabeza ----------
  bindInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, moved: 0 };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (this.drag) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        this.drag.x = e.clientX; this.drag.y = e.clientY;
        this.drag.moved += Math.abs(dx) + Math.abs(dy);
        if (this.drag.moved > 5) {
          this.lastManual = performance.now();
          this.tYaw = clamp(this.tYaw + dx * 0.005, -2.7, 2.7);
          this.tPitch = clamp(this.tPitch + dy * 0.004, -0.55, 0.8);
        }
      } else {
        el.style.cursor = this.selectable && this.pickCard(e) ? 'pointer' : 'grab';
      }
    });
    const end = (e) => {
      if (this.drag && this.drag.moved <= 5) {
        const g = this.pickCard(e);
        if (g && this.selectable) this.toggleCard(g);
      }
      this.drag = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { this.drag = null; });
    el.addEventListener('dblclick', () => this.resetView());
    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea')) return;
      const step = 0.18;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') this.tYaw = clamp(this.tYaw + step, -2.7, 2.7);
      else if (k === 'arrowright' || k === 'd') this.tYaw = clamp(this.tYaw - step, -2.7, 2.7);
      else if (k === 'arrowup' || k === 'w') this.tPitch = clamp(this.tPitch + step * 0.7, -0.55, 0.8);
      else if (k === 'arrowdown' || k === 's') this.tPitch = clamp(this.tPitch - step * 0.7, -0.55, 0.8);
      else if (k === 'c') this.resetView();
      else if (['1', '2', '3', '4'].includes(k) && this.selectable) {
        const g = this.myCards[Number(k) - 1];
        if (g) this.toggleCard(g);
        e.preventDefault();
        return;
      } else return;
      this.lastManual = performance.now();
      e.preventDefault();
    });
  }

  // Gira la cabeza lo justo para ver a `seat` si se ha quedado fuera de plano
  // (o vuelve al frente con null). No hace nada si acabas de mover la cabeza tú.
  focusSeat(seat) {
    if (!this.autoLook || this.gyro || performance.now() - this.lastManual < 6000) return;
    if (seat === null || this.rel(seat) === 0) {
      this.tYaw = 0;
      return;
    }
    const p = this.headWorld(seat);
    const { neck } = this.lay;
    const yaw = Math.atan2(-(p.x - neck.x), -(p.z - neck.z));
    const half = (this.hfov || 1.2) / 2 - 0.2;
    this.tYaw = Math.abs(yaw) <= half ? 0 : Math.sign(yaw) * (Math.abs(yaw) - half);
  }

  resetView() {
    this.tYaw = 0;
    this.tPitch = 0;
    if (this.gyro) this.gyro.reset = true;
  }

  async enableGyro() {
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return false;
      } catch {
        return false;
      }
    }
    this.gyro = { base: null, reset: true };
    this.onOrient = (e) => {
      if (!this.gyro || e.alpha === null) return;
      const landscape = Math.abs(screen.orientation?.angle ?? window.orientation ?? 0) === 90;
      const yawDeg = e.alpha;
      const pitchDeg = landscape ? -e.gamma * Math.sign(screen.orientation?.angle ?? window.orientation ?? 90) : e.beta;
      if (this.gyro.reset || !this.gyro.base) {
        this.gyro.base = { yaw: yawDeg, pitch: pitchDeg };
        this.gyro.reset = false;
      }
      let dy = yawDeg - this.gyro.base.yaw;
      if (dy > 180) dy -= 360;
      if (dy < -180) dy += 360;
      this.tYaw = clamp((dy * Math.PI) / 180, -2.7, 2.7);
      this.tPitch = clamp(((pitchDeg - this.gyro.base.pitch) * Math.PI) / 180, -0.55, 0.8);
    };
    window.addEventListener('deviceorientation', this.onOrient);
    return true;
  }

  disableGyro() {
    window.removeEventListener('deviceorientation', this.onOrient);
    this.gyro = null;
  }

  pickCard(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.myCards, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !this.myCards.includes(o)) o = o.parent;
    return o;
  }

  toggleCard(g) {
    const id = g.userData.card.id;
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.layoutMyHand(0.15);
    this.onCardToggle?.([...this.selected]);
  }

  setSelected(ids) {
    this.selected = new Set(ids);
    this.layoutMyHand(0.15);
    this.onCardToggle?.([...this.selected]);
  }

  setSelectable(on) {
    this.selectable = on;
    if (!on) {
      this.selected.clear();
      this.layoutMyHand(0.2);
    }
    this.renderer.domElement.style.cursor = 'grab';
  }

  // ---------- animaciones ----------
  tween(obj, to, dur = 0.4, { delay = 0, arc = 0 } = {}) {
    return new Promise((resolve) => this.tweens.push({ obj, to, dur, t: -delay, arc, resolve, from: null }));
  }

  updateTweens(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      const o = tw.obj;
      if (!tw.from) tw.from = { pos: o.position.clone(), quat: o.quaternion.clone(), scale: o.scale.clone() };
      const k = Math.min(1, tw.t / tw.dur), e = ease(k);
      if (tw.to.pos) {
        o.position.lerpVectors(tw.from.pos, tw.to.pos, e);
        if (tw.arc) o.position.y += Math.sin(Math.PI * k) * tw.arc;
      }
      if (tw.to.quat) o.quaternion.slerpQuaternions(tw.from.quat, tw.to.quat, e);
      if (tw.to.scale) o.scale.lerpVectors(tw.from.scale, tw.to.scale, e);
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }
  }

  // Lleva un objeto a una posición local de `parent`, animando en coordenadas de mundo.
  async flyTo(obj, parent, lp, lq, dur, opts = {}, scale = 1) {
    this.scene.attach(obj);
    parent.updateMatrixWorld(true);
    const m = new THREE.Matrix4().compose(lp, lq, new THREE.Vector3(scale, scale, scale)).premultiply(parent.matrixWorld);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), sc = new THREE.Vector3();
    m.decompose(pos, quat, sc);
    await this.tween(obj, { pos, quat, scale: sc }, dur, opts);
    parent.attach(obj);
    obj.position.copy(lp);
    obj.quaternion.copy(lq);
    obj.scale.setScalar(scale);
  }

  makeDeckObj() {
    const g = new THREE.Group();
    const side = new THREE.MeshStandardMaterial({ color: '#efe6d0', roughness: 0.8 });
    const mats = [side, side, backMaterial(), side, side, side];
    const stack = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, 0.018, CARD_H), mats);
    stack.position.y = 0.009;
    stack.castShadow = true;
    g.add(stack);
    g.visible = false;
    return g;
  }

  deckPosition(dealerSeat) {
    const rel = this.rel(dealerSeat);
    const a = seatAngle(rel, this.lay.side);
    const dir = this.dir(rel);
    const right = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    return dir.multiplyScalar(0.3).add(right.multiplyScalar(-0.2)).setY(TABLE_Y + 0.001);
  }

  clearTable() {
    for (const c of this.allCards) c.parent?.remove(c);
    this.allCards.clear();
    this.myCards = [];
    this.avatars.forEach((a) => a && (a.cards = []));
    this.selected.clear();
    this.discardCount = 0;
  }

  newCard(card, at) {
    const g = makeCard(card);
    g.position.copy(at);
    g.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.random() * 0.2));
    this.scene.add(g);
    this.allCards.add(g);
    return g;
  }

  mySlot(i, n, id) {
    const s = fanSlot(i, n, 0.16, 0.34);
    if (this.selected.has(id)) s.pos.add(new THREE.Vector3(-Math.sin(s.angle), Math.cos(s.angle), 0).multiplyScalar(0.035)).add(new THREE.Vector3(0, 0, 0.01));
    return s;
  }

  layoutMyHand(dur = 0.3) {
    const n = this.myCards.length;
    return Promise.all(this.myCards.map((g, i) => {
      const s = this.mySlot(i, n, g.userData.card.id);
      return this.tween(g, { pos: s.pos, quat: s.quat }, dur);
    }));
  }

  async dealInitial(hands, order, dealerSeat, speed = 1) {
    this.clearTable();
    const deckPos = this.deckPosition(dealerSeat);
    this.deckObj.position.copy(deckPos);
    this.deckObj.visible = true;
    const jobs = [];
    let k = 0;
    for (let i = 0; i < 4; i++) {
      for (const seat of order) {
        const card = this.rel(seat) === 0 ? hands[seat][i] : null;
        const g = this.newCard(card, deckPos.clone().setY(TABLE_Y + 0.02));
        jobs.push(this.sendToHand(g, seat, i, 0.38 * speed, k * 0.07 * speed));
        k++;
      }
    }
    this.onSound?.('deal');
    await Promise.all(jobs);
    if (hands[this.mySeat]) await this.syncMyHand(hands[this.mySeat]);
  }

  async sendToHand(g, seat, index, dur, delay) {
    await sleep(delay * 1000);
    this.onSound?.('card');
    if (this.rel(seat) === 0) {
      this.myCards.push(g);
      const s = this.mySlot(index, 4, g.userData.card?.id);
      await this.flyTo(g, this.myHand, s.pos, s.quat, dur, { arc: 0.15 });
    } else {
      const av = this.avatars[seat];
      av.cards.push(g);
      const s = av.slot(index);
      await this.flyTo(g, av.fan, s.pos, s.quat, dur, { arc: 0.12 });
    }
  }

  // Reordena tu mano según el orden del motor (ya viene ordenada).
  async syncMyHand(hand) {
    const byId = new Map(this.myCards.map((g) => [g.userData.card.id, g]));
    this.myCards = hand.map((c) => byId.get(c.id)).filter(Boolean);
    await this.layoutMyHand(0.25);
  }

  async redeal(changes, hands, dealerSeat, speed = 1) {
    const deckPos = this.deckPosition(dealerSeat);
    const center = new THREE.Vector3(0, TABLE_Y + 0.001, -0.02);
    // descartes al centro
    const out = [];
    for (const ch of changes) {
      if (this.rel(ch.seat) === 0) {
        for (const c of ch.out) {
          const g = this.myCards.find((m) => m.userData.card.id === c.id);
          if (g) out.push([ch.seat, g]);
        }
        this.myCards = this.myCards.filter((m) => !ch.out.some((c) => c.id === m.userData.card.id));
      } else {
        const av = this.avatars[ch.seat];
        const gone = av.cards.splice(av.cards.length - ch.out.length, ch.out.length);
        gone.forEach((g) => out.push([ch.seat, g]));
      }
    }
    this.selected.clear();
    this.onSound?.('deal');
    await Promise.all(out.map(([, g], i) => {
      const n = this.discardCount++;
      const lp = center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.08, n * 0.0007, (Math.random() - 0.5) * 0.08));
      const lq = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.random() * Math.PI));
      return this.flyTo(g, this.tableGroup, lp, lq, 0.35 * speed, { delay: i * 0.04 * speed, arc: 0.1 });
    }));
    // cartas nuevas
    const jobs = [];
    let k = 0;
    for (const ch of changes) {
      const isMe = this.rel(ch.seat) === 0;
      for (const c of ch.received) {
        const g = this.newCard(isMe ? c : null, deckPos.clone().setY(TABLE_Y + 0.02));
        if (isMe) {
          jobs.push(this.sendToHand(g, ch.seat, this.myCards.length, 0.38 * speed, k * 0.08 * speed));
        } else {
          const av = this.avatars[ch.seat];
          jobs.push(this.sendToHand(g, ch.seat, av.cards.length, 0.38 * speed, k * 0.08 * speed));
        }
        k++;
      }
    }
    await Promise.all(jobs);
    await this.syncMyHand(hands[this.mySeat]);
    for (const a of this.avatars) {
      if (!a) continue;
      await Promise.all(a.cards.map((g, i) => {
        const s = a.slot(i);
        return this.tween(g, { pos: s.pos, quat: s.quat }, 0.2);
      }));
    }
  }

  async reveal(hands, speed = 1) {
    this.deckObj.visible = false;
    const jobs = [];
    for (let seat = 0; seat < 4; seat++) {
      const rel = this.rel(seat);
      const cards = rel === 0 ? this.myCards : this.avatars[seat].cards;
      const center = seatDir(rel).multiplyScalar([0.3, 0.36, 0.32, 0.36][rel]);
      if (this.lay.side && rel % 2) center.z -= 0.08;
      cards.forEach((g, i) => {
        if (hands[seat][i]) setCardFace(g, hands[seat][i]);
        const lp = center.clone().add(new THREE.Vector3((i - 1.5) * 0.1, TABLE_Y + 0.003 + i * 0.0005, 0));
        const lq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
        jobs.push(this.flyTo(g, this.tableGroup, lp, lq, 0.5 * speed, { delay: (seat * 4 + i) * 0.05 * speed, arc: 0.12 }, REVEAL_SCALE));
      });
    }
    // Tus cartas ya están en la mesa: dejan de ser tu mano.
    this.myCards = [];
    this.selected.clear();
    this.onSound?.('deal');
    await Promise.all(jobs);
  }

  // ---------- piedras (tanteo) ----------
  setScores(scores, animate = true) {
    const myTeam = this.mySeat % 2;
    for (let t = 0; t < 2; t++) {
      const s = Math.max(0, scores[t]);
      const big = Math.floor(s / 5), small = s % 5;
      const [pb, ps] = this.pileCounts[t];
      if (pb === big && ps === small) continue;
      const pile = this.piles[t];
      pile.clear();
      pile.position.set(t === myTeam ? -0.3 : 0.3, TABLE_Y, 0.2);
      const total = big + small;
      for (let i = 0; i < total; i++) {
        const isBig = i < big;
        const r = isBig ? 0.019 : 0.011;
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshStandardMaterial({ color: isBig ? '#e2dccd' : '#8c8578', roughness: 0.55 }));
        m.scale.set(1, 0.55, 0.85);
        m.castShadow = true;
        const idx = isBig ? i : i - big;
        const a = idx * 2.39 + (isBig ? 0 : 1);
        const rad = (isBig ? 0.022 : 0.012) + Math.sqrt(idx) * (isBig ? 0.022 : 0.014);
        m.position.set(Math.cos(a) * rad, r * 0.55, Math.sin(a) * rad + (isBig ? 0 : 0.06));
        m.rotation.y = a;
        pile.add(m);
        const isNew = isBig ? i >= pb : idx >= ps || pb !== big;
        if (animate && isNew) {
          const target = m.position.clone();
          m.position.y += 0.25;
          this.tween(m, { pos: target }, 0.35, { delay: Math.random() * 0.15 });
        }
      }
      this.pileCounts[t] = [big, small];
    }
  }

  // ---------- jugadores ----------
  setMano(seat) {
    this.tags.forEach((t, s) => {
      t.querySelector('.badge').textContent = s === seat ? 'mano' : '';
    });
  }

  setTurn(seat) {
    this.tags.forEach((t, s) => t.classList.toggle('active', s === seat));
    this.bubbles.forEach((b, s) => {
      if (s !== seat && b.classList.contains('thinking')) b.classList.remove('show', 'thinking');
    });
    if (seat === null) return;
    if (this.rel(seat) !== 0) {
      const b = this.bubbles[seat];
      clearTimeout(b._t);
      b.className = `bubble ${b.dataset.pos} thinking show`;
      b.textContent = '';
      this.lookAll(seat);
      this.lookAt(seat, null);
      this.focusSeat(seat);
    } else {
      this.lookAll(seat);
      this.focusSeat(null);
    }
  }

  say(seat, text, kind = '', ms = 2200) {
    const b = this.bubbles[seat];
    clearTimeout(b._t);
    b.className = `bubble ${b.dataset.pos} show ${kind}`;
    b.textContent = text;
    b._t = setTimeout(() => b.classList.remove('show'), ms);
    const av = this.avatars[seat];
    if (av) {
      av.talk = 1;
      av.lookAtPoint(this.camera.position);
    }
    this.lookAll(seat);
  }

  // Seña de un jugador. Resuelve true si la estabas mirando cuando la hizo.
  // Resuelve { seen } si le mirabas, o { peripheral } si solo estaba en pantalla.
  showSena(seat, emoji) {
    const av = this.avatars[seat];
    if (!av) return Promise.resolve({ seen: false, peripheral: false });
    av.showSena(emoji);
    return new Promise((resolve) => {
      let peripheral = false, checks = 0;
      const iv = setInterval(() => {
        checks++;
        const seen = this.isWatching(av.senaSprite, this.lay.side ? 15 : 24);
        peripheral ||= this.onScreen(av.senaSprite);
        if (seen || checks >= 10) {
          clearInterval(iv);
          resolve({ seen, peripheral });
        }
      }, 120);
    });
  }

  onScreen(obj) {
    const p = new THREE.Vector3();
    obj.getWorldPosition(p);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    if (p.clone().sub(this.camera.position).dot(fwd) <= 0) return false;
    const v = p.project(this.camera);
    return Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
  }

  // ¿Le estás mirando? (a menos de `maxDeg` grados de donde apunta tu cabeza)
  isWatching(obj, maxDeg = 24) {
    const p = new THREE.Vector3();
    obj.getWorldPosition(p);
    const toObj = p.sub(this.camera.position).normalize();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return toObj.angleTo(fwd) < THREE.MathUtils.degToRad(maxDeg);
  }

  // ---------- render ----------
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    const lay = aspect < 0.85 ? LAYOUTS.compact : LAYOUTS.wide;
    if (lay !== this.lay) {
      this.lay = lay;
      this.applyLayout();
    }
    // En vertical abrimos el ángulo para que quepan las cartas y los rivales.
    const minH = THREE.MathUtils.degToRad(aspect < 1 ? 80 : 92);
    const vfovForH = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minH / 2) / aspect));
    this.camera.fov = clamp(Math.max(60, vfovForH), 60, 100);
    this.hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * aspect);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  updateCamera(dt) {
    const k = Math.min(1, dt * 8);
    this.camYaw += (this.tYaw - this.camYaw) * k;
    this.camPitch += (this.tPitch - this.camPitch) * k;
    const e = new THREE.Euler(this.lay.pitch + this.camPitch, this.camYaw, Math.sin(this.time * 0.4) * 0.004, 'YXZ');
    const eye = new THREE.Vector3(0, 0.1, -0.09).applyEuler(e);
    this.camera.position.copy(this.lay.neck).add(eye);
    this.camera.position.y += Math.sin(this.time * 0.7) * 0.003;
    this.camera.quaternion.setFromEuler(e);
  }

  // Coloca un elemento HTML sobre un punto 3D (lo oculta si queda detrás o fuera).
  pin(el, p, w, h, fwd) {
    const inFront = p.clone().sub(this.camera.position).dot(fwd) > 0.05;
    const v = p.clone().project(this.camera);
    const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    el.classList.toggle('offscreen', !(inFront && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15));
  }

  updateOverlay() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const head = new THREE.Vector3();
    for (let seat = 0; seat < 4; seat++) {
      const av = this.avatars[seat];
      if (!av) continue;
      av.head.getWorldPosition(head);
      // etiqueta bajo la barbilla
      this.pin(this.tags[seat], head.clone().add(new THREE.Vector3(0, -0.22, 0)), w, h, fwd);
      // bocadillo: encima en el de enfrente, hacia el centro en los laterales
      const rel = this.rel(seat);
      const off = rel === 2 ? new THREE.Vector3(0, 0.2, 0) : this.dir(rel).multiplyScalar(-0.17).setY(0.06);
      this.pin(this.bubbles[seat], head.clone().add(off), w, h, fwd);
    }
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    this.updateTweens(dt);
    for (const a of this.avatars) a?.update(dt, this.time);
    this.updateCamera(dt);
    this.updateOverlay();
    this.renderer.render(this.scene, this.camera);
  }
}
