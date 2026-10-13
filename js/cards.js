// Cartas de la baraja española dibujadas en canvas (sin imágenes externas).
const W = 256, H = 384, R = 22;
const SUIT_COLOR = { oros: '#c8901a', copas: '#b3261e', espadas: '#2f5fa8', bastos: '#3f7d2a' };
const ROBE = { oros: '#e29a2b', copas: '#c0392b', espadas: '#2f6db5', bastos: '#3d8b37' };
const PINTAS = { oros: 0, copas: 1, espadas: 2, bastos: 3 };

const cache = new Map();

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawOro(ctx, x, y, s) {
  const r = s / 2;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff3b0');
  g.addColorStop(0.55, '#f2c230');
  g.addColorStop(1, '#b07a10');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = Math.max(1.5, s * 0.05);
  ctx.strokeStyle = '#8a5a00';
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.68, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a5a00';
  ctx.lineWidth = Math.max(1, s * 0.03);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3);
    ctx.lineTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
    ctx.stroke();
  }
}

function drawCopa(ctx, x, y, s) {
  const w = s * 0.8, h = s;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(1.2, s * 0.04);
  ctx.strokeStyle = '#6d1410';
  // cáliz
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, '#8e1b14'); g.addColorStop(0.45, '#e04a3a'); g.addColorStop(1, '#8e1b14');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.42);
  ctx.quadraticCurveTo(-w / 2, h * 0.08, -w * 0.08, h * 0.12);
  ctx.lineTo(w * 0.08, h * 0.12);
  ctx.quadraticCurveTo(w / 2, h * 0.08, w / 2, -h * 0.42);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // borde dorado
  ctx.fillStyle = '#f0c040';
  ctx.beginPath(); ctx.ellipse(0, -h * 0.42, w / 2, h * 0.06, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // pie
  ctx.fillStyle = '#e8b830';
  ctx.fillRect(-w * 0.07, h * 0.12, w * 0.14, h * 0.2);
  ctx.strokeRect(-w * 0.07, h * 0.12, w * 0.14, h * 0.2);
  ctx.beginPath(); ctx.ellipse(0, h * 0.36, w * 0.32, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#d4a020'; ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawEspada(ctx, x, y, s, angle = 0) {
  const len = s * 1.15, bw = s * 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.strokeStyle = '#1b3560';
  const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
  g.addColorStop(0, '#9fb8dc'); g.addColorStop(0.5, '#e8f0ff'); g.addColorStop(1, '#5d82bd');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -len / 2);
  ctx.lineTo(bw / 2, -len / 2 + bw);
  ctx.lineTo(bw / 2, len * 0.22);
  ctx.lineTo(-bw / 2, len * 0.22);
  ctx.lineTo(-bw / 2, -len / 2 + bw);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // guarda
  ctx.fillStyle = '#2f5fa8';
  roundRect(ctx, -s * 0.3, len * 0.2, s * 0.6, s * 0.09, s * 0.04);
  ctx.fill(); ctx.stroke();
  // empuñadura
  ctx.fillStyle = '#c8901a';
  ctx.fillRect(-bw * 0.4, len * 0.29, bw * 0.8, len * 0.17);
  ctx.strokeRect(-bw * 0.4, len * 0.29, bw * 0.8, len * 0.17);
  ctx.beginPath(); ctx.arc(0, len * 0.5, bw * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = '#2f5fa8'; ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawBasto(ctx, x, y, s, angle = 0) {
  const len = s * 1.15;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.strokeStyle = '#24480f';
  const g = ctx.createLinearGradient(-s * 0.2, 0, s * 0.2, 0);
  g.addColorStop(0, '#2f6a1a'); g.addColorStop(0.5, '#6cb041'); g.addColorStop(1, '#2f6a1a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-s * 0.08, len / 2);
  ctx.quadraticCurveTo(-s * 0.13, 0, -s * 0.2, -len * 0.38);
  ctx.quadraticCurveTo(0, -len * 0.58, s * 0.2, -len * 0.38);
  ctx.quadraticCurveTo(s * 0.13, 0, s * 0.08, len / 2);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // nudos
  ctx.fillStyle = '#c0392b';
  for (const [kx, ky] of [[-0.12, -0.2], [0.11, 0.0], [-0.08, 0.2]]) {
    ctx.beginPath(); ctx.ellipse(kx * s, ky * len, s * 0.045, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawSuit(ctx, suit, x, y, s, angle = 0) {
  if (suit === 'oros') drawOro(ctx, x, y, s * 0.8);
  else if (suit === 'copas') drawCopa(ctx, x, y, s * 0.85);
  else if (suit === 'espadas') drawEspada(ctx, x, y, s, angle);
  else drawBasto(ctx, x, y, s, angle);
}

const LAYOUTS = {
  1: [[0.5, 0.5]],
  2: [[0.5, 0.27], [0.5, 0.73]],
  3: [[0.5, 0.2], [0.5, 0.5], [0.5, 0.8]],
  4: [[0.3, 0.27], [0.7, 0.27], [0.3, 0.73], [0.7, 0.73]],
  5: [[0.3, 0.22], [0.7, 0.22], [0.5, 0.5], [0.3, 0.78], [0.7, 0.78]],
  6: [[0.3, 0.2], [0.7, 0.2], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
  7: [[0.3, 0.18], [0.7, 0.18], [0.5, 0.34], [0.3, 0.52], [0.7, 0.52], [0.3, 0.82], [0.7, 0.82]],
};

function drawBorder(ctx, suit) {
  const c = SUIT_COLOR[suit];
  const m = 14, x0 = m, y0 = m, x1 = W - m, y1 = H - m;
  ctx.strokeStyle = c;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + 10); ctx.lineTo(x0, y1 - 10);
  ctx.moveTo(x1, y0 + 10); ctx.lineTo(x1, y1 - 10);
  ctx.stroke();
  // Las "pintas": cortes en el marco que indican el palo.
  const gaps = PINTAS[suit];
  for (const y of [y0, y1]) {
    const segs = gaps + 1;
    const gap = 18;
    const total = x1 - x0 - 20 - gap * gaps;
    let x = x0 + 10;
    for (let i = 0; i < segs; i++) {
      const len = total / segs;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
      x += len + gap;
    }
  }
}

function drawIndex(ctx, card) {
  const c = SUIT_COLOR[card.suit];
  ctx.fillStyle = c;
  ctx.font = 'bold 40px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(String(card.rank), 24, 24);
  ctx.save();
  ctx.translate(W - 24, H - 24);
  ctx.rotate(Math.PI);
  ctx.fillText(String(card.rank), 0, 0);
  ctx.restore();
}

function drawFigure(ctx, card) {
  const cx = W / 2;
  const robe = ROBE[card.suit];
  ctx.save();
  // panel
  roundRect(ctx, 40, 70, W - 80, H - 140, 12);
  ctx.fillStyle = '#fbf3df';
  ctx.fill();
  ctx.strokeStyle = SUIT_COLOR[card.suit];
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();

  if (card.rank === 11) {
    // caballo
    ctx.fillStyle = '#8b5a2b';
    ctx.strokeStyle = '#4a2c10';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx, 268, 78, 38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 50, 250); ctx.lineTo(cx - 72, 190); ctx.lineTo(cx - 92, 200); ctx.lineTo(cx - 70, 268);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx - 86, 192, 22, 13, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b1a08';
    ctx.beginPath(); ctx.arc(cx - 84, 186, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 60, 296, 10, 34); ctx.fillRect(cx + 46, 296, 10, 34);
  }
  const small = card.rank === 11;
  const top = small ? 140 : 150;
  const headY = small ? 128 : 132;
  // túnica
  ctx.fillStyle = robe;
  ctx.strokeStyle = '#3a2a10';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 40, top + 10);
  ctx.lineTo(cx + 40, top + 10);
  ctx.lineTo(cx + 62, small ? 250 : 300);
  ctx.lineTo(cx - 62, small ? 250 : 300);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f0c040';
  ctx.fillRect(cx - 5, top + 12, 10, small ? 96 : 146);
  // cabeza
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(cx, headY, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2b1a08';
  ctx.beginPath(); ctx.arc(cx - 8, headY - 3, 2.6, 0, Math.PI * 2); ctx.arc(cx + 8, headY - 3, 2.6, 0, Math.PI * 2); ctx.fill();
  if (card.rank === 12) {
    ctx.fillStyle = '#e8e2d0';
    ctx.beginPath(); ctx.arc(cx, headY + 10, 18, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#f2c230';
    ctx.strokeStyle = '#8a5a00';
    ctx.beginPath();
    ctx.moveTo(cx - 24, headY - 18); ctx.lineTo(cx - 24, headY - 42); ctx.lineTo(cx - 12, headY - 28);
    ctx.lineTo(cx, headY - 46); ctx.lineTo(cx + 12, headY - 28); ctx.lineTo(cx + 24, headY - 42); ctx.lineTo(cx + 24, headY - 18);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (card.rank === 10) {
    ctx.fillStyle = robe;
    ctx.beginPath(); ctx.ellipse(cx, headY - 18, 30, 12, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#f0c040';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx + 18, headY - 26); ctx.quadraticCurveTo(cx + 46, headY - 52, cx + 52, headY - 30); ctx.stroke();
  } else {
    ctx.fillStyle = '#3a2410';
    ctx.beginPath(); ctx.ellipse(cx, headY - 16, 26, 12, 0, Math.PI, 0); ctx.fill();
  }
  ctx.restore();
  // el palo que sostiene
  drawSuit(ctx, card.suit, cx + 62, small ? 175 : 210, 62, card.suit === 'espadas' || card.suit === 'bastos' ? 0.35 : 0);
  ctx.fillStyle = SUIT_COLOR[card.suit];
  ctx.font = 'bold 22px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText({ 10: 'SOTA', 11: 'CABALLO', 12: 'REY' }[card.rank], cx, H - 38);
}

export function cardCanvas(card) {
  const key = card.suit + card.rank;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  roundRect(ctx, 2, 2, W - 4, H - 4, R);
  ctx.fillStyle = '#fdf8ec';
  ctx.fill();
  ctx.strokeStyle = '#c9bfa6';
  ctx.lineWidth = 3;
  ctx.stroke();
  drawBorder(ctx, card.suit);
  drawIndex(ctx, card);
  if (card.rank >= 10) {
    drawFigure(ctx, card);
  } else {
    const pts = LAYOUTS[card.rank];
    const size = card.rank === 1 ? 150 : card.rank <= 3 ? 84 : 66;
    const ix = 44, iy = 64, iw = W - 88, ih = H - 128;
    pts.forEach(([px, py], i) => {
      const tilt = card.suit === 'espadas' || card.suit === 'bastos' ? (card.rank === 1 ? 0 : (i % 2 ? 0.25 : -0.25)) : 0;
      drawSuit(ctx, card.suit, ix + px * iw, iy + py * ih, size, tilt);
    });
  }
  cache.set(key, cv);
  return cv;
}

let backCv = null;
export function backCanvas() {
  if (backCv) return backCv;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  roundRect(ctx, 2, 2, W - 4, H - 4, R);
  ctx.fillStyle = '#fdf8ec';
  ctx.fill();
  roundRect(ctx, 14, 14, W - 28, H - 28, 14);
  ctx.fillStyle = '#8e1b1b';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(240, 192, 64, 0.45)';
  ctx.lineWidth = 2;
  for (let i = -H; i < W + H; i += 22) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, H); ctx.lineTo(i + H, 0); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#fdf8ec';
  ctx.beginPath(); ctx.ellipse(W / 2, H / 2, 70, 92, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = '#8e1b1b';
  ctx.font = 'bold 50px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MUS', W / 2, H / 2 - 6);
  ctx.font = 'bold 15px Georgia, serif';
  ctx.fillText('· 3D ·', W / 2, H / 2 + 34);
  backCv = cv;
  return cv;
}

export const CARD_ASPECT = W / H;
