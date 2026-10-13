// Decorado del bar: sala, mesa, lámpara y atrezo. Todo procedural (sin assets externos).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const TABLE_Y = 0.76;
export const TABLE_SIZE = 1.24;
const ROOM = 8.4, ROOM_H = 3.2;

function rnd(seed) {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

export function canvasTexture(w, h, draw, { repeat = [1, 1] } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat[0] !== 1 || repeat[1] !== 1) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...repeat);
  }
  return tex;
}

function woodFloor(ctx, w, h) {
  const r = rnd(7);
  const rows = 8, ph = h / rows;
  for (let i = 0; i < rows; i++) {
    let x = -r() * 200;
    while (x < w) {
      const len = 180 + r() * 220;
      const t = 0.75 + r() * 0.35;
      ctx.fillStyle = `rgb(${Math.round(120 * t)}, ${Math.round(78 * t)}, ${Math.round(46 * t)})`;
      ctx.fillRect(x, i * ph, len, ph);
      ctx.strokeStyle = 'rgba(40, 22, 10, 0.25)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        const y = i * ph + 6 + r() * (ph - 12);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 8, x + len * 0.6, y + (r() - 0.5) * 8, x + len, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(25, 14, 6, 0.8)';
      ctx.fillRect(x, i * ph, 2, ph);
      x += len;
    }
    ctx.fillStyle = 'rgba(25, 14, 6, 0.85)';
    ctx.fillRect(0, i * ph, w, 2);
  }
}

function azulejos(ctx, w, h) {
  const n = 4, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * s, y = j * s;
    ctx.fillStyle = '#f3ecd9';
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = '#c9bfa6';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
    const cx = x + s / 2, cy = y + s / 2;
    ctx.fillStyle = '#2d58a0';
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((k * Math.PI) / 2);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.22, s * 0.08, s * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#e2a72e';
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2d58a0';
    for (const [qx, qy] of [[x, y], [x + s, y], [x, y + s], [x + s, y + s]]) {
      ctx.beginPath(); ctx.arc(qx, qy, s * 0.12, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function plaster(ctx, w, h) {
  ctx.fillStyle = '#c9ab82';
  ctx.fillRect(0, 0, w, h);
  const r = rnd(3);
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '255,240,220' : '80,50,30'}, ${0.04 + r() * 0.05})`;
    ctx.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6);
  }
}

function felt(ctx, w, h) {
  ctx.fillStyle = '#1d6a3c';
  ctx.fillRect(0, 0, w, h);
  const r = rnd(11);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'}, ${0.02 + r() * 0.03})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.72);
  g.addColorStop(0, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(240, 210, 140, 0.35)';
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 28, w - 56, h - 56);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.fillStyle = 'rgba(240, 210, 140, 0.13)';
  ctx.font = 'bold 120px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MUS', 0, 0);
  ctx.restore();
}

function neon(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic bold 110px "Brush Script MT", "Segoe Script", cursive';
  for (const [blur, color] of [[40, '#ff2d95'], [18, '#ff5fb0'], [0, '#ffe3f2']]) {
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    ctx.fillText('Bar El Órdago', w / 2, h * 0.42);
  }
  ctx.font = 'bold 44px "Trebuchet MS", sans-serif';
  for (const [blur, color] of [[24, '#21e6ff'], [0, '#e3fdff']]) {
    ctx.shadowColor = '#21e6ff';
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    ctx.fillText('· MUS · CAÑAS · TAPAS ·', w / 2, h * 0.82);
  }
}

function berkeleyNight(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b1030');
  g.addColorStop(0.6, '#2b2a5e');
  g.addColorStop(1, '#5b3b6e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rnd(5);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
    ctx.fillRect(r() * w, r() * h * 0.6, 1.5, 1.5);
  }
  ctx.fillStyle = '#fdf6d8';
  ctx.beginPath(); ctx.arc(w * 0.8, h * 0.2, 26, 0, Math.PI * 2); ctx.fill();
  // colinas
  ctx.fillStyle = '#16142c';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.bezierCurveTo(w * 0.2, h * 0.55, w * 0.45, h * 0.66, w * 0.6, h * 0.6);
  ctx.bezierCurveTo(w * 0.8, h * 0.54, w * 0.9, h * 0.66, w, h * 0.62);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  // el Campanile
  const cx = w * 0.38, base = h * 0.92;
  ctx.fillStyle = '#d8cfb8';
  ctx.fillRect(cx - 18, h * 0.3, 36, base - h * 0.3);
  ctx.fillStyle = '#b9ae95';
  ctx.fillRect(cx - 21, h * 0.3, 42, 14);
  ctx.beginPath();
  ctx.moveTo(cx - 20, h * 0.3); ctx.lineTo(cx, h * 0.12); ctx.lineTo(cx + 20, h * 0.3); ctx.closePath();
  ctx.fillStyle = '#7f9d8c'; ctx.fill();
  ctx.fillStyle = '#ffe9a0';
  ctx.beginPath(); ctx.arc(cx, h * 0.37, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a3a3a';
  for (let k = 0; k < 3; k++) ctx.fillRect(cx - 14 + k * 11, h * 0.43, 6, 18);
  // luces de la ciudad
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = r() < 0.5 ? '#ffd27a' : '#fff1c4';
    ctx.fillRect(r() * w, h * (0.78 + r() * 0.2), 2, 2);
  }
}

function poster(title, lines, bg, fg) {
  return (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.fillText(title, w / 2, 100);
    ctx.font = '30px Georgia, serif';
    lines.forEach((l, i) => ctx.fillText(l, w / 2, 170 + i * 46));
  };
}

function pizarra(ctx, w, h) {
  ctx.fillStyle = '#2b3a2f';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.textAlign = 'center';
  ctx.font = 'bold 56px "Segoe Print", "Comic Sans MS", cursive';
  ctx.fillText('HOY', w / 2, 80);
  ctx.textAlign = 'left';
  ctx.font = '36px "Segoe Print", "Comic Sans MS", cursive';
  ['Caña ........ 1,50 €', 'Tortilla ..... 2,50 €', 'Bravas ....... 3,00 €', 'Órdago ...... gratis'].forEach((l, i) => ctx.fillText(l, 50, 160 + i * 62));
}

function dartboard(ctx, w, h) {
  const cx = w / 2, cy = h / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(cx, cy, w / 2, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 20; i++) {
    const a0 = (i / 20) * Math.PI * 2, a1 = ((i + 1) / 20) * Math.PI * 2;
    for (const [r0, r1, cA, cB] of [[0.08, 0.42, '#f3e6c4', '#1b1b1b'], [0.42, 0.47, '#c0392b', '#2e8b57'], [0.47, 0.78, '#f3e6c4', '#1b1b1b'], [0.78, 0.83, '#c0392b', '#2e8b57']]) {
      ctx.fillStyle = i % 2 ? cA : cB;
      ctx.beginPath();
      ctx.arc(cx, cy, (w / 2) * r1, a0, a1);
      ctx.arc(cx, cy, (w / 2) * r0, a1, a0, true);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.arc(cx, cy, w * 0.04, 0, Math.PI * 2); ctx.fill();
}

function drawClock(ctx, w, h) {
  const cx = w / 2, cy = h / 2, R = w / 2 - 6;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fbf6e8';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 10; ctx.strokeStyle = '#3b2616'; ctx.stroke();
  ctx.fillStyle = '#222';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillRect(cx + Math.sin(a) * R * 0.82 - 3, cy - Math.cos(a) * R * 0.82 - 3, 6, 6);
  }
  const now = new Date();
  const hand = (angle, len, width) => {
    ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(angle) * len, cy - Math.cos(angle) * len); ctx.stroke();
  };
  ctx.strokeStyle = '#222';
  hand(((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2, R * 0.5, 8);
  hand((now.getMinutes() / 60) * Math.PI * 2, R * 0.75, 5);
}

function std(color, rough = 0.7, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function wallPanel(parent, tex, w, h, pos, rotY, basic = false) {
  const mat = basic ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, transparent: true });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.copy(pos);
  m.rotation.y = rotY;
  parent.add(m);
  return m;
}

export function buildRoom(scene) {
  const room = new THREE.Group();
  scene.add(room);
  const half = ROOM / 2;

  const floorTex = canvasTexture(1024, 1024, woodFloor, { repeat: [3, 3] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, ROOM), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, ROOM), std('#2a1c12', 0.9));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_H;
  room.add(ceiling);
  const beamMat = std('#3d2716', 0.8);
  for (let i = -2; i <= 2; i++) box(0.18, 0.2, ROOM, beamMat, i * 1.7, ROOM_H - 0.1, 0, room);

  const tileTex = canvasTexture(512, 512, azulejos, { repeat: [ROOM / 0.6, 2] });
  const plasterTex = canvasTexture(512, 512, plaster, { repeat: [4, 1] });
  const tileMat = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.35 });
  const plasterMat = new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.95 });
  const railMat = std('#4a2e18', 0.6);
  const walls = [
    [new THREE.Vector3(0, 0, -half), 0],
    [new THREE.Vector3(0, 0, half), Math.PI],
    [new THREE.Vector3(-half, 0, 0), Math.PI / 2],
    [new THREE.Vector3(half, 0, 0), -Math.PI / 2],
  ];
  for (const [p, ry] of walls) {
    const low = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, 1.2), tileMat);
    low.position.set(p.x, 0.6, p.z);
    low.rotation.y = ry;
    low.receiveShadow = true;
    room.add(low);
    const up = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, ROOM_H - 1.2), plasterMat);
    up.position.set(p.x, 1.2 + (ROOM_H - 1.2) / 2, p.z);
    up.rotation.y = ry;
    up.receiveShadow = true;
    room.add(up);
    const rail = box(ROOM, 0.06, 0.05, railMat, 0, 1.22, 0, room);
    rail.position.set(p.x * 0.995, 1.22, p.z * 0.995);
    rail.rotation.y = ry;
  }

  // Barra del fondo
  const barZ = -half + 0.75;
  const dark = std('#4a2c17', 0.55);
  box(4.6, 1.05, 0.6, dark, 0, 0.525, barZ, room);
  box(4.8, 0.06, 0.78, std('#8a5a33', 0.35), 0, 1.08, barZ, room);
  const shelfMat = std('#5d3a1f', 0.6);
  for (const y of [1.55, 2.0]) box(3.8, 0.04, 0.26, shelfMat, 0, y, -half + 0.15, room);
  const r = rnd(42);
  const bottleColors = ['#2e7d32', '#6d4c41', '#c8e6c9', '#ffb300', '#8e24aa', '#b71c1c', '#e0f7fa', '#1b5e20'];
  for (const y of [1.57, 2.02]) {
    for (let x = -1.8; x <= 1.8; x += 0.16 + r() * 0.08) {
      const color = bottleColors[Math.floor(r() * bottleColors.length)];
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85, emissive: color, emissiveIntensity: 0.15 });
      const hgt = 0.22 + r() * 0.12;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, hgt, 12), mat);
      body.position.set(x, y + hgt / 2, -half + 0.15);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.09, 8), mat);
      neck.position.y = hgt / 2 + 0.045;
      body.add(neck);
      room.add(body);
    }
  }
  // grifo de cerveza
  const chrome = std('#d0d0d0', 0.2, 0.9);
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.4, 16), chrome);
  tap.position.set(0.9, 1.31, barZ);
  room.add(tap);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.18, 8), std('#111'));
  handle.position.set(0.9, 1.58, barZ);
  room.add(handle);
  // taburetes
  for (const x of [-1.5, -0.5, 0.5, 1.5]) {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 20), std('#7b1f1f', 0.5));
    seat.position.set(x, 0.75, barZ + 0.65);
    seat.castShadow = true;
    room.add(seat);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.72, 10), chrome);
    leg.position.set(x, 0.36, barZ + 0.65);
    room.add(leg);
  }

  // Neón
  const neonTex = canvasTexture(1024, 300, neon);
  wallPanel(room, neonTex, 2.6, 0.76, new THREE.Vector3(0, 2.62, -half + 0.02), 0, true);
  const pink = new THREE.PointLight('#ff3d9a', 2.2, 5, 1.6);
  pink.position.set(0, 2.5, -half + 0.4);
  room.add(pink);

  // Ventana con vistas a Berkeley (pared izquierda)
  const winTex = canvasTexture(640, 440, berkeleyNight);
  wallPanel(room, winTex, 1.7, 1.17, new THREE.Vector3(-half + 0.02, 1.8, -0.6), Math.PI / 2, true);
  const frameMat = std('#3d2716', 0.6);
  for (const [h, d, y, z] of [[1.33, 0.08, 1.8, -1.49], [1.33, 0.08, 1.8, 0.29], [0.08, 1.86, 2.42, -0.6], [0.08, 1.86, 1.18, -0.6], [0.04, 1.7, 1.8, -0.6]]) {
    box(0.08, h, d, frameMat, -half + 0.04, y, z, room);
  }
  const moon = new THREE.PointLight('#9fb4ff', 1.2, 4, 1.5);
  moon.position.set(-half + 0.5, 1.9, -0.6);
  room.add(moon);

  // Pared derecha: carteles y diana
  const p1 = canvasTexture(512, 720, poster('TORNEO DE MUS', ['Sábado · 20:00', '', 'Parejas', 'Inscripción en barra', '', '1er premio:', 'UN JAMÓN'], '#f4e3c1', '#8e1b1b'));
  wallPanel(room, p1, 0.62, 0.87, new THREE.Vector3(half - 0.02, 1.85, -1.1), -Math.PI / 2);
  const p2 = canvasTexture(512, 512, poster('SE PROHÍBE', ['CANTAR', '', '(salvo el órdago)'], '#fdf8ec', '#1d1d1d'));
  wallPanel(room, p2, 0.55, 0.55, new THREE.Vector3(half - 0.02, 1.9, 0.3), -Math.PI / 2);
  const dTex = canvasTexture(512, 512, dartboard);
  wallPanel(room, dTex, 0.45, 0.45, new THREE.Vector3(half - 0.02, 1.75, 1.5), -Math.PI / 2);

  // Pared de detrás: pizarra, puerta y reloj de verdad
  const pTex = canvasTexture(640, 480, pizarra);
  wallPanel(room, pTex, 1.3, 0.98, new THREE.Vector3(-1.2, 1.8, half - 0.02), Math.PI);
  box(1.0, 2.1, 0.08, std('#5a3720', 0.6), 1.2, 1.05, half - 0.04, room);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), chrome);
  knob.position.set(0.8, 1.0, half - 0.1);
  room.add(knob);
  const clockTex = canvasTexture(256, 256, drawClock);
  wallPanel(room, clockTex, 0.4, 0.4, new THREE.Vector3(0, 2.5, half - 0.02), Math.PI);
  setInterval(() => {
    drawClock(clockTex.image.getContext('2d'), 256, 256);
    clockTex.needsUpdate = true;
  }, 30000);

  return room;
}

export function buildTable(scene) {
  const g = new THREE.Group();
  scene.add(g);
  const wood = std('#5a3720', 0.45);
  const top = new THREE.Mesh(new RoundedBoxGeometry(TABLE_SIZE, 0.06, TABLE_SIZE, 4, 0.025), wood);
  top.position.y = TABLE_Y - 0.03;
  top.castShadow = top.receiveShadow = true;
  g.add(top);
  const feltTex = canvasTexture(1024, 1024, felt);
  const feltMesh = new THREE.Mesh(new THREE.PlaneGeometry(TABLE_SIZE - 0.1, TABLE_SIZE - 0.1), new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.95 }));
  feltMesh.rotation.x = -Math.PI / 2;
  feltMesh.position.y = TABLE_Y + 0.001;
  feltMesh.receiveShadow = true;
  g.add(feltMesh);
  const legGeo = new THREE.BoxGeometry(0.07, TABLE_Y - 0.06, 0.07);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, wood);
    leg.position.set(sx * (TABLE_SIZE / 2 - 0.08), (TABLE_Y - 0.06) / 2, sz * (TABLE_SIZE / 2 - 0.08));
    leg.castShadow = true;
    g.add(leg);
  }
  // Cañas y aceitunas
  const glassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.25 });
  const beerMat = new THREE.MeshStandardMaterial({ color: '#e0a020', roughness: 0.2, transparent: true, opacity: 0.85, emissive: '#7a4a00', emissiveIntensity: 0.25 });
  const foamMat = std('#fff8e6', 0.9);
  for (const [x, z] of [[0.47, -0.47], [-0.48, 0.46]]) {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.13, 20, 1, true), glassMat);
    glass.position.set(x, TABLE_Y + 0.065, z);
    g.add(glass);
    const beer = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.1, 20), beerMat);
    beer.position.set(x, TABLE_Y + 0.052, z);
    beer.castShadow = true;
    g.add(beer);
    const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.032, 0.022, 20), foamMat);
    foam.position.set(x, TABLE_Y + 0.112, z);
    g.add(foam);
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.015, 24), std('#f3efe6', 0.4));
  plate.position.set(0.46, TABLE_Y + 0.008, 0.44);
  plate.castShadow = true;
  g.add(plate);
  const oliveMat = std('#6b7d1e', 0.35);
  const r = rnd(9);
  for (let i = 0; i < 9; i++) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), oliveMat);
    o.scale.set(1, 0.8, 1.3);
    const a = r() * Math.PI * 2, d = r() * 0.04;
    o.position.set(0.46 + Math.cos(a) * d, TABLE_Y + 0.025, 0.44 + Math.sin(a) * d);
    g.add(o);
  }
  return g;
}

export function buildLamp(scene) {
  const g = new THREE.Group();
  scene.add(g);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, ROOM_H - 2.12, 6), std('#111'));
  cord.position.y = 2.12 + (ROOM_H - 2.12) / 2;
  g.add(cord);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.2, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: '#1f5a3a', roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }),
  );
  shade.position.y = 2.05;
  g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff3d0' }));
  bulb.position.y = 1.97;
  g.add(bulb);
  const spot = new THREE.SpotLight('#ffe2b0', 9, 6, 0.95, 0.55, 1.2);
  spot.position.set(0, 1.97, 0);
  spot.target.position.set(0, TABLE_Y, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.bias = -0.0004;
  spot.shadow.camera.near = 0.3;
  spot.shadow.camera.far = 4;
  g.add(spot, spot.target);
  return g;
}

export function addAmbientLights(scene) {
  scene.add(new THREE.HemisphereLight('#ffe8c8', '#2a1a10', 0.55));
  const bar = new THREE.PointLight('#ffb36b', 4, 7, 1.4);
  bar.position.set(0, 2.7, -2.8);
  scene.add(bar);
  const back = new THREE.PointLight('#ffcf9a', 2.5, 7, 1.4);
  back.position.set(0, 2.6, 2.8);
  scene.add(back);
}
