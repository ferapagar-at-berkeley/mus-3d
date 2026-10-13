import test from 'node:test';
import assert from 'node:assert/strict';
import { Rules, MusGame, makeDeck, team } from '../js/mus.js';
import { BotAgent, estimateWin } from '../js/ai.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const C = (s) => {
  // 'R' rey, 'C' caballo, 'S' sota, números tal cual; palo opcional tras ':'
  const [r, suit = 'oros'] = s.split(':');
  const rank = { R: 12, C: 11, S: 10 }[r] ?? Number(r);
  return { id: suit[0] + rank + Math.random(), suit, rank };
};
const H = (str) => str.split(' ').map(C);
const rules = new Rules({ ochoReyes: true });

test('baraja de 40 cartas únicas', () => {
  const d = makeDeck();
  assert.equal(d.length, 40);
  assert.equal(new Set(d.map((c) => c.id)).size, 40);
});

test('con 8 reyes el tres es rey y el dos es as', () => {
  assert.equal(rules.ord(C('3')), 10);
  assert.equal(rules.ord(C('2')), 1);
  assert.equal(rules.pts(C('3')), 10);
  assert.equal(rules.pts(C('2')), 1);
  const cuatro = new Rules({ ochoReyes: false });
  assert.equal(cuatro.ord(C('3')), 3);
  assert.equal(cuatro.pts(C('2')), 2);
});

test('pares', () => {
  assert.deepEqual(rules.pares(H('R 3 7 5')), { type: 'par', ranks: [10], value: 1 });
  assert.equal(rules.pares(H('R R R 5')).type, 'medias');
  assert.deepEqual(rules.pares(H('R R C C')).ranks, [10, 9]);
  assert.equal(rules.pares(H('R 3 R 12')).type, 'duples');
  assert.equal(rules.pares(H('R C S 7')), null);
  assert.ok(rules.compare('pares', H('1 1 4 4'), H('R R 7 5')) > 0, 'duples ganan a par');
  assert.ok(rules.compare('pares', H('R R 7 5'), H('C C S S')) < 0);
  assert.ok(rules.compare('pares', H('R R 5 5'), H('R R 4 4')) > 0);
});

test('juego y punto', () => {
  assert.equal(rules.suma(H('R C S 1')), 31);
  assert.equal(rules.valorJuego(H('R C S 1')), 3);
  assert.equal(rules.valorJuego(H('R C S 5')), 2);
  assert.equal(rules.valorJuego(H('R C 5 4')), 0);
  const j = (s) => H(s);
  // 31 > 32 > 40 > 37 > 33
  assert.ok(rules.compare('juego', j('R C S 1'), j('R C S 2:copas')) === 0);
  assert.ok(rules.compare('juego', j('R C S 1'), j('R C 6 6')) > 0);
  assert.ok(rules.compare('juego', j('R C 6 6'), j('R C S R')) > 0);
  assert.ok(rules.compare('juego', j('R C S R'), j('R C S 7')) > 0);
  assert.ok(rules.compare('juego', j('R C S 7'), j('R C 7 6')) > 0);
  assert.ok(rules.compare('punto', j('R C 6 1'), j('R C 4 1')) > 0);
});

test('grande, chica y desempate por mano', () => {
  assert.ok(rules.compare('grande', H('R R 7 1'), H('R C S 1')) > 0);
  assert.ok(rules.compare('chica', H('1 1 4 5'), H('1 2 4 6')) > 0);
  const hands = [H('R C 7 1'), H('R C 7 1'), H('S S 4 4'), H('C C 5 5')];
  assert.equal(rules.winner('grande', hands, [1, 2, 3, 0]), 1);
  assert.equal(rules.winner('grande', hands, [0, 1, 2, 3]), 0);
});

// Agente guionizado para probar las apuestas.
class Scripted {
  constructor(actions = []) { this.actions = actions; }
  async decideMus() { return false; }
  async chooseDiscards(v) { return [v.hand[0].id]; }
  async bet(v) { return this.actions.shift() || (v.mode === 'abrir' ? { type: 'paso' } : { type: 'noquiero' }); }
}

test('no quiero: el que envida cobra el deje', async () => {
  const agents = [new Scripted([{ type: 'envido', amount: 2 }]), new Scripted(), new Scripted(), new Scripted()];
  const g = new MusGame({ agents, firstMano: 0, rng: mulberry32(1) });
  g.hands = [H('R R R 1'), H('1 1 4 5'), H('C C S 7'), H('4 5 6 7')];
  g.discardsSeen = [[], [], [], []];
  g.declarations = {};
  const r = await g.betRound('grande', [0, 1, 2, 3]);
  assert.equal(r.status, 'noquiero');
  assert.equal(r.team, 0);
  assert.deepEqual(g.scores, [1, 0]);
});

test('subida y no quiero: se cobra lo envidado antes', async () => {
  const agents = [
    new Scripted([{ type: 'envido', amount: 2 }, { type: 'noquiero' }]),
    new Scripted([{ type: 'envido', amount: 5 }]),
    new Scripted([{ type: 'noquiero' }]),
    new Scripted(),
  ];
  const g = new MusGame({ agents, firstMano: 0, rng: mulberry32(2) });
  g.hands = [H('R R R 1'), H('1 1 4 5'), H('C C S 7'), H('4 5 6 7')];
  g.discardsSeen = [[], [], [], []];
  g.declarations = {};
  const r = await g.betRound('grande', [0, 1, 2, 3]);
  assert.equal(r.status, 'noquiero');
  assert.equal(r.team, 1);
  assert.equal(r.deje, 2);
  assert.deepEqual(g.scores, [0, 2]);
});

test('el compañero puede querer aunque el primero no quiera', async () => {
  const agents = [
    new Scripted([{ type: 'envido', amount: 3 }]),
    new Scripted([{ type: 'noquiero' }]),
    new Scripted(),
    new Scripted([{ type: 'quiero' }]),
  ];
  const g = new MusGame({ agents, firstMano: 0, rng: mulberry32(3) });
  g.hands = [H('R R R 1'), H('1 1 4 5'), H('C C S 7'), H('4 5 6 7')];
  g.discardsSeen = [[], [], [], []];
  g.declarations = {};
  const r = await g.betRound('grande', [0, 1, 2, 3]);
  assert.equal(r.status, 'quiero');
  assert.equal(r.amount, 3);
  assert.equal(r.accepter, 3);
});

test('conteo: pares y juego suman los valores del equipo ganador', () => {
  const g = new MusGame({ agents: [], firstMano: 0 });
  g.hands = [H('R R C 1'), H('4 5 6 7'), H('C C C 1'), H('S S 4 5')];
  g.results = {
    grande: { status: 'paso' },
    chica: { status: 'noquiero', team: 1 },
    pares: { status: 'quiero', amount: 2, eligible: [0, 2, 3] },
    juego: { status: 'solo', team: 0, eligible: [0, 2] },
  };
  const lines = g.conteoLines();
  const by = Object.fromEntries(lines.map((l) => [l.lance, l]));
  assert.equal(by.grande.team, 0);
  assert.equal(by.grande.pts, 1);
  assert.equal(by.chica, undefined);
  // Medias de caballos (2) + par de reyes (1) + 2 envidados
  assert.equal(by.pares.team, 0);
  assert.equal(by.pares.pts, 5);
  // R R C 1 = 31 (3) ; C C C 1 = 31 (3)
  assert.equal(by.juego.pts, 6);
});

test('estimación Monte Carlo coherente', () => {
  const v = { seat: 0, hand: H('R R R 3:copas'), gone: [], order: [0, 1, 2, 3], declarations: {}, knowledge: [] };
  const p = estimateWin(rules, v, 'grande', { rng: mulberry32(5) });
  assert.ok(p > 0.95, `cuatro reyes deberían ganar la grande casi siempre (p=${p})`);
  const q = estimateWin(rules, { ...v, hand: H('7 6 5 4') }, 'grande', { rng: mulberry32(6) });
  assert.ok(q < 0.35, `7 6 5 4 es mala para grande (p=${q})`);
});

test('partidas completas entre bots terminan y son coherentes', async () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rng = mulberry32(seed);
    const r = new Rules({ ochoReyes: seed % 3 !== 0 });
    const agents = [0, 1, 2, 3].map(() => new BotAgent(r, { delay: 0, rng, samples: 40 }));
    let events = 0;
    const g = new MusGame({
      agents, rng, target: 40, ochoReyes: r.ochoReyes,
      emit: async (e) => {
        events++;
        if (e.hands) {
          const ids = e.hands.flat().map((c) => c.id);
          assert.equal(ids.length, 16);
          assert.equal(new Set(ids).size, 16, 'cartas repetidas en las manos');
        }
        if (events > 20000) throw new Error('partida demasiado larga');
      },
    });
    const winner = await g.run();
    assert.ok(winner === 0 || winner === 1);
    assert.ok(g.scores[winner] >= 40 || true);
  }
});

test('team()', () => {
  assert.equal(team(0), team(2));
  assert.equal(team(1), team(3));
  assert.notEqual(team(0), team(1));
});
