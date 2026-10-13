// Caras de los jugadores: una foto recortada (subida o de la webcam) o una cara de dibujo
// generada a partir del nombre. Devuelve un canvas que se pega sobre la cabeza 3D.
const SIZE = 512;
const SKINS = ['#f6d3b3', '#eebd96', '#dba47c', '#c48a5f', '#a26b45', '#7a4d32'];
const HAIRS = ['#22160f', '#3b2618', '#5c3a1e', '#8b5a2b', '#c99a55', '#151515', '#7d7d7d', '#a33b1c'];

export function hashStr(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

function seeded(seed) {
  let a = seed || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w = SIZE, h = SIZE) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function cartoonFace(name = '?') {
  const rnd = seeded(hashStr(name.trim().toLowerCase()));
  const skin = SKINS[Math.floor(rnd() * SKINS.length)];
  const hair = HAIRS[Math.floor(rnd() * HAIRS.length)];
  const cv = canvas();
  const ctx = cv.getContext('2d');
  const S = SIZE;
  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, S, S);
  // flequillo
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(S, 0); ctx.lineTo(S, S * 0.1);
  const fringe = rnd();
  for (let i = 8; i >= 0; i--) ctx.lineTo((i / 8) * S, S * (0.1 + (i % 2 ? 0.07 : 0.02) * (0.6 + fringe)));
  ctx.closePath();
  ctx.fill();
  // mejillas
  ctx.fillStyle = 'rgba(230, 90, 90, 0.18)';
  ctx.beginPath(); ctx.ellipse(S * 0.3, S * 0.6, S * 0.07, S * 0.045, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(S * 0.7, S * 0.6, S * 0.07, S * 0.045, 0, 0, Math.PI * 2); ctx.fill();
  // ojos
  const eyeY = S * 0.43, eyeDx = S * 0.14;
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(S / 2 + sx * eyeDx, eyeY, S * 0.05, S * 0.038, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath(); ctx.arc(S / 2 + sx * eyeDx, eyeY + 2, S * 0.024, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(S / 2 + sx * eyeDx + 4, eyeY - 3, S * 0.007, 0, Math.PI * 2); ctx.fill();
    // cejas
    ctx.strokeStyle = shade(hair, 0.8);
    ctx.lineWidth = S * 0.018;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(S / 2 + sx * (eyeDx - S * 0.05), eyeY - S * 0.075);
    ctx.quadraticCurveTo(S / 2 + sx * eyeDx, eyeY - S * (0.1 + rnd() * 0.02), S / 2 + sx * (eyeDx + S * 0.055), eyeY - S * 0.07);
    ctx.stroke();
  }
  // nariz
  ctx.strokeStyle = shade(skin, 0.75);
  ctx.lineWidth = S * 0.012;
  ctx.beginPath();
  ctx.moveTo(S * 0.5, S * 0.47);
  ctx.quadraticCurveTo(S * 0.47, S * 0.56, S * 0.5, S * 0.575);
  ctx.quadraticCurveTo(S * 0.53, S * 0.58, S * 0.545, S * 0.565);
  ctx.stroke();
  // barba / bigote
  const beard = rnd();
  if (beard < 0.3) {
    ctx.fillStyle = shade(hair, 1.05);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(S * 0.2, S * 0.6);
    ctx.quadraticCurveTo(S * 0.22, S * 0.95, S * 0.5, S * 0.97);
    ctx.quadraticCurveTo(S * 0.78, S * 0.95, S * 0.8, S * 0.6);
    ctx.quadraticCurveTo(S * 0.65, S * 0.8, S * 0.5, S * 0.78);
    ctx.quadraticCurveTo(S * 0.35, S * 0.8, S * 0.2, S * 0.6);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (beard < 0.5) {
    ctx.fillStyle = shade(hair, 1.05);
    ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.635, S * 0.1, S * 0.022, 0, 0, Math.PI * 2); ctx.fill();
  }
  // boca
  ctx.strokeStyle = '#7a2b25';
  ctx.lineWidth = S * 0.016;
  ctx.beginPath();
  const smile = 0.02 + rnd() * 0.05;
  ctx.moveTo(S * 0.4, S * 0.68);
  ctx.quadraticCurveTo(S * 0.5, S * (0.68 + smile * 2), S * 0.6, S * 0.68);
  ctx.stroke();
  // gafas
  if (rnd() < 0.3) {
    ctx.strokeStyle = '#1d1d1d';
    ctx.lineWidth = S * 0.012;
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(S / 2 + sx * eyeDx, eyeY, S * 0.085, S * 0.065, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(S / 2 - eyeDx + S * 0.085, eyeY); ctx.lineTo(S / 2 + eyeDx - S * 0.085, eyeY); ctx.stroke();
  }
  return { canvas: cv, skin, hair, photo: false };
}

function luma(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

function mix(a, b) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round((((pa >> s) & 255) + ((pb >> s) & 255)) / 2));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function avgColor(ctx, x, y, w, h) {
  const d = ctx.getImageData(x, y, w, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  const to = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Recorta un cuadrado de la imagen y lo devuelve como JPEG pequeño para guardar.
export function cropToDataURL(img, sx, sy, size, out = 384) {
  const cv = canvas(out, out);
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, sx, sy, size, size, 0, 0, out, out);
  return cv.toDataURL('image/jpeg', 0.85);
}

// La foto recortada se funde con un fondo del color de la piel para que no se vea el borde.
export async function photoFace(dataURL) {
  const img = await loadImage(dataURL);
  const src = canvas();
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0, SIZE, SIZE);
  // piel: media de las dos mejillas; pelo: franja de arriba (si es casi blanca, será la pared)
  const skin = mix(
    avgColor(sctx, SIZE * 0.26, SIZE * 0.5, SIZE * 0.12, SIZE * 0.12),
    avgColor(sctx, SIZE * 0.62, SIZE * 0.5, SIZE * 0.12, SIZE * 0.12),
  );
  let hair = avgColor(sctx, SIZE * 0.32, SIZE * 0.02, SIZE * 0.36, SIZE * 0.08);
  if (luma(hair) > 0.72) hair = shade(skin, 0.45);

  const masked = canvas();
  const mctx = masked.getContext('2d');
  mctx.drawImage(src, 0, 0);
  mctx.globalCompositeOperation = 'destination-in';
  const g = mctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.3, SIZE / 2, SIZE / 2, SIZE * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  mctx.fillStyle = g;
  mctx.setTransform(0.92, 0, 0, 1, SIZE * 0.04, 0);
  mctx.fillRect(0, 0, SIZE, SIZE);

  const cv = canvas();
  const ctx = cv.getContext('2d');
  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(masked, 0, 0);
  return { canvas: cv, skin, hair, photo: true };
}

export function slug(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Caras publicadas en el repositorio: faces/index.json → { "carlos": "carlos.jpg", … }
let manifest = null;
function repoManifest() {
  if (!manifest) {
    manifest = fetch('faces/index.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return manifest;
}

async function repoFace(name) {
  const file = (await repoManifest())[slug(name || '')];
  if (!file) return null;
  const img = await loadImage('faces/' + file);
  const size = Math.min(img.width, img.height);
  return cropToDataURL(img, (img.width - size) / 2, (img.height - size) / 2, size);
}

// Prioridad: foto guardada en este navegador > foto del repo > cara de dibujo.
export async function buildFace(player) {
  try {
    const src = player.face || (await repoFace(player.name));
    if (src) return await photoFace(src);
  } catch {
    // foto ilegible: usamos la de dibujo
  }
  return cartoonFace(player.name);
}

// Miniatura redonda para la interfaz (marcador, configuración…)
export function faceThumb(face, size = 96) {
  const cv = canvas(size, size);
  const ctx = cv.getContext('2d');
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = face.hair;
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(face.canvas, size * 0.08, size * 0.08, size * 0.84, size * 0.84);
  return cv.toDataURL('image/png');
}
