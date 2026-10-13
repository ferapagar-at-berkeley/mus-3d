// Bots de mus: estiman su probabilidad de ganar cada lance simulando repartos
// compatibles con lo que saben (sus cartas, descartes, declaraciones y señas vistas).
import { makeDeck, team, SENAS, senaFor } from './mus.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function estimateWin(rules, v, lance, { samples = 220, rng = Math.random, useSenas = true } = {}) {
  const known = new Set([...v.hand, ...(v.gone || [])].map((c) => c.id));
  const pool = makeDeck().filter((c) => !known.has(c.id));
  const others = v.order.filter((s) => s !== v.seat);
  const declKey = lance === 'punto' ? 'juego' : lance;
  const decl = v.declarations?.[declKey];
  const eligible = v.eligible || v.order;
  const constraints = useSenas ? (v.knowledge || []).filter((k) => k.from !== v.seat && SENAS[k.sena]) : [];
  const myTeam = team(v.seat);
  const hands = [];
  hands[v.seat] = v.hand;

  const run = (withSenas) => {
    let wins = 0, n = 0;
    const maxTries = samples * 40;
    for (let tries = 0; n < samples && tries < maxTries; tries++) {
      // Fisher–Yates parcial: solo necesitamos 12 cartas.
      for (let i = 0; i < 12; i++) {
        const j = i + Math.floor(rng() * (pool.length - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      others.forEach((s, k) => { hands[s] = pool.slice(k * 4, k * 4 + 4); });
      if (decl && !others.every((s) => {
        const has = declKey === 'pares' ? !!rules.pares(hands[s]) : rules.tieneJuego(hands[s]);
        return has === !!decl[s];
      })) continue;
      if (withSenas && !constraints.every((k) => SENAS[k.sena].test(rules, hands[k.from]))) continue;
      n++;
      const w = rules.winner(lance, hands, v.order, eligible);
      if (team(w) === myTeam) wins++;
    }
    return { p: n ? wins / n : 0.5, n };
  };

  let res = run(constraints.length > 0);
  if (constraints.length && res.n < 30) res = run(false);
  return res.p;
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

export class BotAgent {
  constructor(rules, { aggression = 1, bluff = 0.08, delay = 900, rng = Math.random, samples = 220 } = {}) {
    this.rules = rules;
    this.aggression = aggression;
    this.bluff = bluff;
    this.delay = delay;
    this.rng = rng;
    this.samples = samples;
  }

  async think(factor = 1) {
    if (this.delay > 0) await sleep(this.delay * factor * (0.6 + this.rng() * 0.8));
  }

  async decideMus(v) {
    await this.think();
    return this.wantsMus(v);
  }

  async chooseDiscards(v) {
    await this.think(0.8);
    return this.pickDiscards(v.hand);
  }

  async bet(v) {
    await this.think(v.mode === 'responder' ? 1.2 : 1);
    return this.decideBet(v);
  }

  signal(v) {
    const sena = senaFor(this.rules, v.hand);
    if (!sena) return null;
    return this.rng() < 0.75 ? sena : null;
  }

  wantsMus(v) {
    const r = this.rules, h = v.hand;
    const sum = r.suma(h), p = r.pares(h);
    const reyes = r.reyes(h), ases = r.ases(h);
    let cut = false;
    if (sum === 31) cut = true;
    else if (p && p.type !== 'par') cut = true;
    else if (p && sum >= 31) cut = true;
    else if (reyes >= 3 || ases >= 3) cut = true;
    else if (reyes >= 2 && sum >= 31) cut = true;
    else if (p && p.ranks[0] === 10 && reyes >= 2 && this.rng() < 0.5) cut = true;
    // Si el rival está a punto de ganar, mejor no dar mus con algo decente.
    const opp = 1 - team(v.seat);
    if (v.scores[opp] >= v.target - 5 && (p || sum >= 31)) cut = true;
    if (!cut && this.rng() < 0.06) cut = true;
    return !cut;
  }

  pickDiscards(hand) {
    const r = this.rules;
    const reyes = r.reyes(hand), ases = r.ases(hand);
    const counts = {};
    for (const c of hand) counts[r.ord(c)] = (counts[r.ord(c)] || 0) + 1;
    const goGrande = reyes >= ases;
    const keep = (c) => {
      const o = r.ord(c);
      if (counts[o] >= 2 && (o >= 8 || o === 1)) return true;
      if (goGrande) return o === 10;
      return o === 1 || (o === 4 && ases >= 1);
    };
    let out = hand.filter((c) => !keep(c));
    if (!out.length) {
      // Hay que descartar al menos una: la que menos aporta.
      const worst = hand.slice().sort((a, b) => (goGrande ? r.ord(a) - r.ord(b) : r.ord(b) - r.ord(a)))[0];
      out = [worst];
    }
    return out.map((c) => c.id);
  }

  decideBet(v) {
    const lance = v.lance;
    const p = estimateWin(this.rules, v, lance, { samples: this.samples, rng: this.rng });
    const rng = this.rng, ag = this.aggression;
    const myTeam = team(v.seat), opp = 1 - myTeam;
    const oppNear = v.scores[opp] >= v.target - 6;
    const weNear = v.scores[myTeam] >= v.target - 6;
    const raises = (v.history || []).filter((h) => h.type === 'envido' || h.type === 'ordago').length;

    if (v.mode === 'abrir') {
      if ((p > 0.95 && rng() < 0.3 * ag) || (oppNear && !weNear && p > 0.8 && rng() < 0.6)) return { type: 'ordago' };
      if (p > 0.72 / ag) return { type: 'envido', amount: p > 0.88 ? pick([2, 3, 4, 5], rng) : 2 };
      if (rng() < this.bluff * ag && p > 0.25) return { type: 'envido', amount: 2 };
      return { type: 'paso' };
    }
    if (v.ordago) {
      let th = 0.74;
      if (oppNear) th = 0.55;
      if (weNear && !oppNear) th = 0.85;
      return { type: p > th ? 'quiero' : 'noquiero' };
    }
    if (raises < 3 && v.proposed < 15 && p > 0.88 && rng() < 0.5 * ag) {
      return p > 0.96 && rng() < 0.25 ? { type: 'ordago' } : { type: 'envido', amount: pick([2, 2, 3, 5], rng) };
    }
    const th = Math.min(0.72, 0.4 + 0.025 * v.proposed);
    return { type: p > th ? 'quiero' : 'noquiero' };
  }
}
