// Motor del Mus: reglas, comparación de manos y flujo de la partida.
// No toca el DOM, así que se puede ejecutar y testear en Node.

export const SUITS = ['oros', 'copas', 'espadas', 'bastos'];
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
export const LANCES = ['grande', 'chica', 'pares', 'juego'];
export const LANCE_NAMES = { grande: 'Grande', chica: 'Chica', pares: 'Pares', juego: 'Juego', punto: 'Punto' };
export const RANK_NAMES = { 1: 'As', 2: 'Dos', 3: 'Tres', 4: 'Cuatro', 5: 'Cinco', 6: 'Seis', 7: 'Siete', 10: 'Sota', 11: 'Caballo', 12: 'Rey' };
const ORD_PLURAL = { 1: 'ases', 2: 'doses', 3: 'treses', 4: 'cuatros', 5: 'cincos', 6: 'seises', 7: 'sietes', 8: 'sotas', 9: 'caballos', 10: 'reyes' };
const PARES_TYPE = { par: 1, medias: 2, duples: 3 };
// 31 es la mejor, luego 32, 40, 37, 36, 35, 34 y 33.
const JUEGO_ORDER = [31, 32, 40, 37, 36, 35, 34, 33];

export const team = (seat) => seat % 2;
export const partnerOf = (seat) => (seat + 2) % 4;

export function makeDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ id: suit[0] + rank, suit, rank });
  return deck;
}

export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function lex(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

export class Rules {
  constructor({ ochoReyes = true } = {}) {
    this.ochoReyes = ochoReyes;
  }
  // Rango efectivo: con 8 reyes los treses son reyes y los doses son ases.
  eff(c) {
    if (this.ochoReyes) {
      if (c.rank === 3) return 12;
      if (c.rank === 2) return 1;
    }
    return c.rank;
  }
  // Orden para grande/chica/pares: As=1 … 7=7, Sota=8, Caballo=9, Rey=10.
  ord(c) {
    const e = this.eff(c);
    return e <= 7 ? e : e - 2;
  }
  pts(c) {
    const e = this.eff(c);
    return e >= 10 ? 10 : e;
  }
  sortHand(hand) {
    return hand.slice().sort((a, b) => this.ord(b) - this.ord(a) || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
  }
  grande(hand) { return hand.map((c) => this.ord(c)).sort((a, b) => b - a); }
  chica(hand) { return hand.map((c) => this.ord(c)).sort((a, b) => a - b); }
  count(hand, ordValue) { return hand.filter((c) => this.ord(c) === ordValue).length; }
  reyes(hand) { return this.count(hand, 10); }
  ases(hand) { return this.count(hand, 1); }

  pares(hand) {
    const counts = new Map();
    for (const c of hand) counts.set(this.ord(c), (counts.get(this.ord(c)) || 0) + 1);
    const groups = [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[0] - a[0]);
    if (!groups.length) return null;
    if (groups.length === 2) return { type: 'duples', ranks: [groups[0][0], groups[1][0]], value: 3 };
    const [o, n] = groups[0];
    if (n === 4) return { type: 'duples', ranks: [o, o], value: 3 };
    if (n === 3) return { type: 'medias', ranks: [o], value: 2 };
    return { type: 'par', ranks: [o], value: 1 };
  }
  suma(hand) { return hand.reduce((s, c) => s + this.pts(c), 0); }
  tieneJuego(hand) { return this.suma(hand) >= 31; }
  valorJuego(hand) {
    const s = this.suma(hand);
    return s === 31 ? 3 : s > 31 ? 2 : 0;
  }
  valorPares(hand) { return this.pares(hand)?.value || 0; }
  juegoScore(sum) {
    const i = JUEGO_ORDER.indexOf(sum);
    return i < 0 ? -1 : JUEGO_ORDER.length - i;
  }

  // > 0 si la mano a gana a la b (sin contar quién es mano).
  compare(lance, a, b) {
    switch (lance) {
      case 'grande': return lex(this.grande(a), this.grande(b));
      case 'chica': return -lex(this.chica(a), this.chica(b));
      case 'pares': {
        const pa = this.pares(a), pb = this.pares(b);
        if (!pa || !pb) return (pa ? 1 : 0) - (pb ? 1 : 0);
        return PARES_TYPE[pa.type] - PARES_TYPE[pb.type] || lex(pa.ranks, pb.ranks);
      }
      case 'juego': return this.juegoScore(this.suma(a)) - this.juegoScore(this.suma(b));
      case 'punto': return this.suma(a) - this.suma(b);
    }
    throw new Error('Lance desconocido: ' + lance);
  }

  // Gana la mejor mano; en caso de empate gana quien esté más cerca de la mano.
  winner(lance, hands, order, eligible = order) {
    let best = null;
    for (const s of order) {
      if (!eligible.includes(s)) continue;
      if (best === null || this.compare(lance, hands[s], hands[best]) > 0) best = s;
    }
    return best;
  }

  describePares(p) {
    if (!p) return 'Sin pares';
    const [a, b] = p.ranks;
    if (p.type === 'par') return `Par de ${ORD_PLURAL[a]}`;
    if (p.type === 'medias') return `Medias de ${ORD_PLURAL[a]}`;
    return a === b ? `Duples de ${ORD_PLURAL[a]}` : `Duples de ${ORD_PLURAL[a]} y ${ORD_PLURAL[b]}`;
  }
  describeJuego(hand) {
    const s = this.suma(hand);
    return s >= 31 ? `Juego de ${s}` : `Punto: ${s}`;
  }
}

export function cardName(c) {
  return `${RANK_NAMES[c.rank]} de ${c.suit}`;
}

// Señas clásicas entre compañeros. Se comprueban en este orden (la primera que encaje).
export const SENAS = {
  treintaYUna: { emoji: '😉', gesto: 'Guiña un ojo', significado: '31 de juego', test: (r, h) => r.suma(h) === 31 },
  duples: { emoji: '🤨', gesto: 'Levanta las cejas', significado: 'Duples', test: (r, h) => r.pares(h)?.type === 'duples' },
  medias: { emoji: '😏', gesto: 'Tuerce la boca', significado: 'Medias', test: (r, h) => r.pares(h)?.type === 'medias' },
  tresReyes: { emoji: '😣', gesto: 'Se muerde el labio de lado', significado: 'Tres reyes', test: (r, h) => r.reyes(h) >= 3 },
  dosReyes: { emoji: '😬', gesto: 'Se muerde el labio', significado: 'Dos reyes', test: (r, h) => r.reyes(h) === 2 },
  tresAses: { emoji: '😜', gesto: 'Saca la lengua de lado', significado: 'Tres ases (pitos)', test: (r, h) => r.ases(h) >= 3 },
  dosAses: { emoji: '😛', gesto: 'Saca la punta de la lengua', significado: 'Dos ases (pitos)', test: (r, h) => r.ases(h) === 2 },
  ciego: {
    emoji: '😑', gesto: 'Cierra los ojos', significado: 'Nada de nada',
    test: (r, h) => !r.pares(h) && !r.tieneJuego(h) && r.reyes(h) <= 1 && r.ases(h) <= 1,
  },
};

export function senaFor(rules, hand) {
  return Object.keys(SENAS).find((k) => SENAS[k].test(rules, hand)) || null;
}

const NUM_WORDS = { 1: 'una', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 10: 'diez' };

export function phrase(key, data = {}) {
  switch (key) {
    case 'mus': return '¡Mus!';
    case 'cortar': return 'No hay mus';
    case 'descarte': return `Dame ${NUM_WORDS[data.n] || data.n}`;
    case 'paso': return 'Paso';
    case 'envido':
      if (data.raise) return `¡${data.amount} más!`;
      return data.amount === 2 ? '¡Envido!' : `¡Envido ${data.amount}!`;
    case 'ordago': return '¡ÓRDAGO!';
    case 'quiero': return 'Quiero';
    case 'noquiero': return 'No quiero';
    case 'paresSi': return 'Pares sí';
    case 'paresNo': return 'Pares no';
    case 'juegoSi': return 'Juego sí';
    case 'juegoNo': return 'Juego no';
  }
  return key;
}

export class GameOver extends Error {
  constructor(team, info = {}) {
    super('Fin de la partida');
    this.team = team;
    this.info = info;
  }
}

export class Aborted extends Error {
  constructor() {
    super('Partida cancelada');
    this.aborted = true;
  }
}

/**
 * Una partida completa de mus a `target` tantos.
 * agents[seat] implementa: decideMus(view) → bool, chooseDiscards(view) → [ids], bet(view) → acción,
 * y opcionalmente signal(view) → clave de SENAS | null.
 * emit(evento) se espera (await) para que la interfaz pueda animar.
 */
export class MusGame {
  constructor({ agents, target = 40, ochoReyes = true, rng = Math.random, emit, firstMano, senaCatchChance = 0.2 }) {
    this.agents = agents;
    this.target = target;
    this.rules = new Rules({ ochoReyes });
    this.rng = rng;
    this.emitFn = emit || (async () => {});
    this.scores = [0, 0];
    this.mano = firstMano ?? Math.floor(rng() * 4);
    this.handNo = 0;
    this.knowledge = [[], [], [], []];
    this.senaCatchChance = senaCatchChance;
    this.aborted = false;
  }

  abort() { this.aborted = true; }

  async emit(evt) {
    if (this.aborted) throw new Aborted();
    await this.emitFn(evt);
    if (this.aborted) throw new Aborted();
  }

  order() { return [0, 1, 2, 3].map((i) => (this.mano + i) % 4); }

  async run() {
    try {
      for (;;) {
        await this.playHand();
        this.mano = (this.mano + 1) % 4;
        this.handNo++;
      }
    } catch (e) {
      if (e instanceof GameOver) {
        if (!this.aborted) {
          await this.emitFn({ type: 'gameEnd', team: e.team, scores: [...this.scores], info: e.info });
        }
        return e.team;
      }
      if (e && e.aborted) return null;
      throw e;
    }
  }

  view(seat, extra = {}) {
    return {
      seat,
      mano: this.mano,
      order: this.order(),
      hand: this.hands[seat].map((c) => ({ ...c })),
      gone: this.discardsSeen[seat].map((c) => ({ ...c })),
      scores: [...this.scores],
      target: this.target,
      ochoReyes: this.rules.ochoReyes,
      declarations: JSON.parse(JSON.stringify(this.declarations)),
      knowledge: this.knowledge[seat].map((k) => ({ ...k })),
      ...extra,
    };
  }

  async say(seat, key, data = {}) {
    await this.emit({ type: 'say', seat, key, data, text: phrase(key, data) });
  }

  async addPoints(t, n, info = {}) {
    this.scores[t] += n;
    await this.emit({ type: 'points', team: t, n, scores: [...this.scores], info });
    if (this.scores[t] >= this.target) throw new GameOver(t, { reason: 'tantos', ...info });
  }

  dealOne() {
    if (!this.deck.length) {
      this.deck = shuffle(this.discardPile.splice(0), this.rng);
      this.discardsSeen = [[], [], [], []];
    }
    return this.deck.pop();
  }

  async playHand() {
    const order = this.order();
    this.deck = shuffle(makeDeck(), this.rng);
    this.discardPile = [];
    this.hands = [[], [], [], []];
    this.discardsSeen = [[], [], [], []];
    this.results = {};
    this.declarations = {};
    this.knowledge = [[], [], [], []];
    for (let i = 0; i < 4; i++) for (const s of order) this.hands[s].push(this.deck.pop());
    this.hands = this.hands.map((h) => this.rules.sortHand(h));

    await this.emit({ type: 'handStart', mano: this.mano, dealer: (this.mano + 3) % 4, scores: [...this.scores], handNo: this.handNo });
    await this.emit({ type: 'deal', hands: this.hands.map((h) => h.slice()) });
    await this.collectSignals();
    await this.musPhase();
    for (const lance of LANCES) await this.playLance(lance);
    await this.conteo();
  }

  async collectSignals() {
    for (let s = 0; s < 4; s++) {
      const ag = this.agents[s];
      if (!ag.signal) continue;
      const sena = await ag.signal(this.view(s, { kind: 'sena' }));
      if (sena && SENAS[sena]) await this.sign(s, sena);
    }
  }

  // Un jugador hace una seña: el compañero la ve, y a veces algún rival la pilla.
  async sign(seat, sena) {
    if (!SENAS[sena] || !this.hands) return;
    const p = partnerOf(seat);
    const add = (who) => {
      this.knowledge[who] = this.knowledge[who].filter((k) => k.from !== seat);
      this.knowledge[who].push({ from: seat, sena });
    };
    add(p);
    const caughtBy = [];
    for (const r of [(seat + 1) % 4, (seat + 3) % 4]) {
      if (this.rng() < this.senaCatchChance) {
        add(r);
        caughtBy.push(r);
      }
    }
    await this.emit({ type: 'sena', seat, sena, caughtBy, delay: 300 + Math.floor(this.rng() * 2500) });
  }

  async musPhase() {
    const order = this.order();
    for (let round = 0; ; round++) {
      await this.emit({ type: 'phase', phase: 'mus', round });
      for (const s of order) {
        await this.emit({ type: 'turn', seat: s, kind: 'mus' });
        const mus = await this.agents[s].decideMus(this.view(s, { kind: 'mus', round }));
        await this.say(s, mus ? 'mus' : 'cortar');
        if (!mus) {
          await this.emit({ type: 'musCut', seat: s });
          return;
        }
      }
      await this.emit({ type: 'phase', phase: 'descarte', round });
      const picks = [];
      for (const s of order) {
        await this.emit({ type: 'turn', seat: s, kind: 'descarte' });
        const raw = await this.agents[s].chooseDiscards(this.view(s, { kind: 'descarte', round }));
        const handIds = this.hands[s].map((c) => c.id);
        let ids = [...new Set(raw || [])].filter((id) => handIds.includes(id));
        if (!ids.length) ids = [handIds[handIds.length - 1]];
        picks.push([s, ids]);
        await this.say(s, 'descarte', { n: ids.length });
      }
      const changes = [];
      for (const [s, ids] of picks) {
        const out = this.hands[s].filter((c) => ids.includes(c.id));
        this.hands[s] = this.hands[s].filter((c) => !ids.includes(c.id));
        const received = [];
        for (let k = 0; k < out.length; k++) received.push(this.dealOne());
        // Los descartes van al montón después de servir, así nadie recibe sus propias cartas.
        this.discardPile.push(...out);
        this.discardsSeen[s].push(...out);
        this.hands[s] = this.rules.sortHand([...this.hands[s], ...received]);
        changes.push({ seat: s, out, received });
      }
      this.knowledge = [[], [], [], []];
      await this.emit({ type: 'redeal', changes, hands: this.hands.map((h) => h.slice()) });
      await this.collectSignals();
    }
  }

  async playLance(lance) {
    const order = this.order();
    await this.emit({ type: 'lanceStart', lance });
    let eligible = order;
    let actual = lance;
    if (lance === 'pares' || lance === 'juego') {
      const has = {};
      for (const s of order) {
        has[s] = lance === 'pares' ? !!this.rules.pares(this.hands[s]) : this.rules.tieneJuego(this.hands[s]);
        await this.emit({ type: 'turn', seat: s, kind: 'declara', lance });
        await this.say(s, (lance === 'pares' ? 'pares' : 'juego') + (has[s] ? 'Si' : 'No'));
      }
      this.declarations[lance] = has;
      eligible = order.filter((s) => has[s]);
      const teams = [...new Set(eligible.map(team))];
      if (lance === 'juego' && !eligible.length) {
        actual = 'punto';
        eligible = order;
        await this.emit({ type: 'lanceStart', lance: 'punto' });
      } else if (!teams.length || teams.length === 1) {
        const result = teams.length ? { lance, status: 'solo', team: teams[0], eligible } : { lance, status: 'nadie', eligible };
        this.results[lance] = result;
        await this.emit({ type: 'lanceEnd', result });
        return;
      }
    }
    const result = await this.betRound(actual, eligible);
    result.lance = actual;
    result.eligible = eligible;
    this.results[lance] = result;
    await this.emit({ type: 'lanceEnd', result });
    if (result.status === 'ordago') {
      const w = this.rules.winner(actual, this.hands, order, eligible);
      await this.emit({ type: 'reveal', hands: this.hands.map((h) => h.slice()), ordago: { lance: actual, winner: w } });
      throw new GameOver(team(w), { reason: 'ordago', lance: actual, seat: w });
    }
  }

  sanitizeBet(a, mode) {
    const type = a?.type;
    const amount = Math.max(2, Math.min(99, Math.round(a?.amount || 2)));
    if (mode === 'abrir') {
      if (type === 'envido') return { type, amount };
      if (type === 'ordago') return { type };
      return { type: 'paso' };
    }
    if (mode === 'ordago') return { type: type === 'quiero' ? 'quiero' : 'noquiero' };
    if (type === 'quiero' || type === 'ordago') return { type };
    if (type === 'envido') return { type, amount, raise: true };
    return { type: 'noquiero' };
  }

  async betRound(lance, eligible) {
    const history = [];
    let bettor = null, proposed = 0, deje = 1, ordago = false;
    for (const s of eligible) {
      await this.emit({ type: 'turn', seat: s, kind: 'apuesta', lance });
      const a = await this.agents[s].bet(this.view(s, { kind: 'apuesta', lance, mode: 'abrir', history: history.slice(), eligible }));
      const act = this.sanitizeBet(a, 'abrir');
      history.push({ seat: s, ...act });
      await this.say(s, act.type, act);
      if (act.type === 'paso') continue;
      bettor = s;
      ordago = act.type === 'ordago';
      proposed = ordago ? 0 : act.amount;
      break;
    }
    if (bettor === null) return { status: 'paso', history };

    for (;;) {
      await this.emit({ type: 'bet', lance, bettor, proposed, deje, ordago });
      const responders = [1, 2, 3].map((i) => (bettor + i) % 4).filter((s) => eligible.includes(s) && team(s) !== team(bettor));
      let resp = null;
      for (const s of responders) {
        await this.emit({ type: 'turn', seat: s, kind: 'responde', lance });
        const a = await this.agents[s].bet(this.view(s, {
          kind: 'apuesta', lance, mode: 'responder', proposed, deje, ordago, bettor, history: history.slice(), eligible,
        }));
        const act = this.sanitizeBet(a, ordago ? 'ordago' : 'responder');
        history.push({ seat: s, ...act });
        await this.say(s, act.type, act);
        if (act.type === 'noquiero') continue;
        resp = { seat: s, act };
        break;
      }
      if (!resp) {
        const t = team(bettor);
        const result = { status: 'noquiero', team: t, deje, bettor, history };
        await this.addPoints(t, deje, { lance, why: 'noquiero' });
        return result;
      }
      const { seat, act } = resp;
      if (act.type === 'quiero') {
        return ordago
          ? { status: 'ordago', bettor, accepter: seat, history }
          : { status: 'quiero', amount: proposed, bettor, accepter: seat, history };
      }
      deje = ordago ? deje : proposed;
      bettor = seat;
      if (act.type === 'ordago') {
        ordago = true;
      } else {
        proposed += act.amount;
      }
    }
  }

  // Puntos de cada lance que se cobran al final de la mano.
  conteoLines() {
    const order = this.order();
    const lines = [];
    const sumTeam = (t, fn) => [t, t + 2].reduce((s, seat) => s + fn(this.hands[seat]), 0);
    for (const lance of LANCES) {
      const r = this.results[lance];
      if (!r) continue;
      const L = r.lance || lance;
      if (L === 'grande' || L === 'chica') {
        if (r.status === 'noquiero') continue;
        const w = this.rules.winner(L, this.hands, order);
        lines.push({ lance: L, team: team(w), seat: w, pts: r.status === 'quiero' ? r.amount : 1, why: r.status === 'quiero' ? 'querido' : 'en paso' });
      } else if (L === 'pares' || L === 'juego') {
        if (r.status === 'nadie') continue;
        let t, w = null, extra = 0;
        if (r.status === 'solo' || r.status === 'noquiero') t = r.team;
        else {
          w = this.rules.winner(L, this.hands, order, r.eligible);
          t = team(w);
          if (r.status === 'quiero') extra = r.amount;
        }
        const base = sumTeam(t, (h) => (L === 'pares' ? this.rules.valorPares(h) : this.rules.valorJuego(h)));
        const why = r.status === 'quiero' ? `querido + ${base} de ${L}` : r.status === 'paso' ? 'en paso' : r.status === 'solo' ? 'solo ellos tienen' : 'tras no quiero';
        lines.push({ lance: L, team: t, seat: w, pts: base + extra, why });
      } else if (L === 'punto') {
        let t, w = null;
        if (r.status === 'noquiero') t = r.team;
        else {
          w = this.rules.winner('punto', this.hands, order);
          t = team(w);
        }
        lines.push({ lance: 'punto', team: t, seat: w, pts: 1 + (r.status === 'quiero' ? r.amount : 0), why: r.status === 'quiero' ? 'querido + 1' : r.status === 'paso' ? 'en paso' : 'tras no quiero' });
      }
    }
    return lines;
  }

  async conteo() {
    await this.emit({ type: 'reveal', hands: this.hands.map((h) => h.slice()) });
    const lines = this.conteoLines();
    await this.emit({ type: 'conteo', lines, results: this.results });
    for (const line of lines) await this.addPoints(line.team, line.pts, { lance: line.lance, why: 'conteo' });
    await this.emit({ type: 'handEnd', scores: [...this.scores] });
  }
}
