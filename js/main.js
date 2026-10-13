// Interfaz: une el motor del mus, los bots, la escena 3D y los controles del jugador humano.
import { MusScene } from './scene.js';
import { MusGame, Rules, LANCES, LANCE_NAMES, SENAS, team, partnerOf, Aborted } from './mus.js';
import { BotAgent, estimateWin } from './ai.js';
import { buildFace, faceThumb, cropToDataURL, loadImage } from './faces.js';
import { cardCanvas } from './cards.js';
import { Sound, Voice } from './audio.js';

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STORE_KEY = 'mus3d.v1';
const SEAT_LABELS = ['Tú', 'Rival · derecha', 'Compañero · enfrente', 'Rival · izquierda'];
const SHIRTS = ['#2a6f97', '#a8322a', '#2b8c7e', '#c0662a'];
const DEFAULTS = {
  players: [{ name: 'Tú', face: null }, { name: 'Juan', face: null }, { name: 'Carlos', face: null }, { name: 'Ángel', face: null }],
  target: 40,
  ochoReyes: true,
  speed: 1,
  voice: true,
  sound: true,
  hints: true,
};
const KIND = { mus: 'mus', envido: 'envido', ordago: 'ordago', quiero: 'quiero', noquiero: 'noquiero' };
const chipKey = (lance) => (lance === 'punto' ? 'juego' : lance);

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { ...DEFAULTS, ...s, players: DEFAULTS.players.map((p, i) => ({ ...p, ...(s.players?.[i] || {}) })) };
    }
  } catch {
    // sin almacenamiento: valores por defecto
  }
  return JSON.parse(JSON.stringify(DEFAULTS));
}

class HumanAgent {
  constructor(app) { this.app = app; }
  decideMus(v) { return this.app.askMus(v); }
  chooseDiscards(v) { return this.app.askDiscards(v); }
  bet(v) { return this.app.askBet(v); }
}

class App {
  constructor() {
    this.settings = loadSettings();
    this.mySeat = 0;
    this.faces = [];
    this.sound = new Sound();
    this.voice = new Voice();
    this.scene = new MusScene($('#stage'), $('#overlay'));
    this.scene.onSound = (n) => this.sound.play(n);
    this.game = null;
    this.token = 0;
    this.order = [0, 1, 2, 3];
    this.myHand = [];
    this.cardImgs = new Map();
  }

  async init() {
    this.applyAudio();
    this.faces = await Promise.all(this.settings.players.map((p) => buildFace(p)));
    this.scene.setup(this.playersForScene(), this.mySeat);
    this.scene.setScores([0, 0], false);
    this.updateScoreboard([0, 0]);
    this.bindUI();
    this.openSetup();
  }

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.settings));
    } catch {
      this.toast('No se han podido guardar los ajustes en este navegador.');
    }
  }

  playersForScene() {
    return this.settings.players.map((p, i) => ({ name: this.name(i), face: this.faces[i], shirt: SHIRTS[i] }));
  }
  name(seat) { return (this.settings.players[seat].name || '').trim() || SEAT_LABELS[seat]; }
  myTeam() { return team(this.mySeat); }
  teamCls(t) { return t === this.myTeam() ? 'us' : 'them'; }
  teamName(t) { return t === this.myTeam() ? 'Nosotros' : 'Ellos'; }
  pace() { return this.settings.speed; }

  // ---------- partida ----------
  startGame() {
    if (this.game) this.game.abort();
    const token = ++this.token;
    const s = this.settings;
    this.rules = new Rules({ ochoReyes: s.ochoReyes });
    const agents = [0, 1, 2, 3].map((seat) => (seat === this.mySeat
      ? new HumanAgent(this)
      : new BotAgent(this.rules, { delay: 750 * s.speed, aggression: 0.85 + Math.random() * 0.35, bluff: 0.05 + Math.random() * 0.08 })));
    this.clearButtons();
    $('#conteo').hidden = true;
    $('#modal-end').hidden = true;
    this.scene.clearTable();
    this.scene.setSelectable(false);
    this.scene.setScores([0, 0], false);
    this.updateScoreboard([0, 0]);
    $('#target').textContent = s.target;
    $('#log-list').innerHTML = '';
    const game = new MusGame({
      agents,
      target: s.target,
      ochoReyes: s.ochoReyes,
      emit: (e) => (token === this.token ? this.onEvent(e) : Promise.reject(new Aborted())),
    });
    this.game = game;
    if (window.innerHeight > window.innerWidth * 1.2 && !this.rotateTip) {
      this.rotateTip = true;
      setTimeout(() => this.toast('📱 Consejo: con el móvil en horizontal se ve mejor la mesa.'), 1500);
    }
    game.run().catch((err) => {
      console.error(err);
      this.toast('Ups, algo ha fallado: ' + esc(err.message));
    });
  }

  async onEvent(e) {
    const f = this.pace();
    switch (e.type) {
      case 'handStart': {
        this.mano = e.mano;
        this.dealer = e.dealer;
        this.order = [0, 1, 2, 3].map((i) => (e.mano + i) % 4);
        this.myHand = [];
        this.revealed = null;
        this.resetChips();
        $('#conteo').hidden = true;
        this.scene.setMano(e.mano);
        this.scene.lookAll(null);
        this.logSep(`Mano ${e.handNo + 1} · es mano ${this.name(e.mano)}`);
        this.setPhase('Reparto');
        this.setPrompt(`Reparte <b>${esc(this.name(e.dealer))}</b>…`);
        $('#handinfo').innerHTML = '';
        break;
      }
      case 'deal':
        await this.scene.dealInitial(e.hands, this.order, this.dealer, f);
        this.myHand = e.hands[this.mySeat];
        this.updateHandInfo();
        break;
      case 'sena':
        this.handleSena(e);
        break;
      case 'phase':
        this.setPhase(e.phase === 'mus' ? (e.round ? `Mus · ${e.round + 1}ª vuelta` : 'Mus') : 'Descarte');
        break;
      case 'turn':
        this.scene.setTurn(e.seat);
        if (e.seat !== this.mySeat) this.setPrompt(this.waitingText(e));
        break;
      case 'say': {
        this.scene.say(e.seat, e.text, KIND[e.key] || '');
        if (e.seat !== this.mySeat) this.voice.say(e.text, e.seat);
        if (e.key === 'ordago') this.sound.play('ordago');
        this.log(e.seat, e.text);
        const quick = e.key.startsWith('pares') || e.key.startsWith('juego');
        await sleep((quick ? 420 : 680) * f);
        break;
      }
      case 'musCut':
        this.scene.setTurn(null);
        break;
      case 'redeal':
        this.scene.setTurn(null);
        this.setPrompt('Cartas nuevas…');
        await this.scene.redeal(e.changes, e.hands, this.dealer, f);
        this.myHand = e.hands[this.mySeat];
        this.updateHandInfo();
        break;
      case 'lanceStart':
        this.setPhase(LANCE_NAMES[e.lance]);
        if (e.lance === 'punto') this.setChipLabel('juego', 'Punto');
        this.activeChip(chipKey(e.lance));
        this.currentLance = e.lance;
        this.updateHandInfo();
        await sleep(350 * f);
        break;
      case 'bet':
        this.setChip(chipKey(e.lance), e.ordago ? '¡Órdago!' : `Envite ${e.proposed}`);
        break;
      case 'lanceEnd':
        this.onLanceEnd(e.result);
        await sleep(300 * f);
        break;
      case 'points':
        this.onPoints(e);
        await sleep(250 * f);
        break;
      case 'reveal':
        this.scene.setTurn(null);
        this.scene.lookAll(null);
        this.activeChip(null);
        this.setPhase(e.ordago ? '¡Órdago!' : 'Conteo');
        this.setPrompt('Se enseñan las cartas…');
        this.revealed = e.hands;
        await this.scene.reveal(e.hands, f);
        if (e.ordago) {
          const w = e.ordago.winner;
          this.toast(`¡Órdago a ${LANCE_NAMES[e.ordago.lance].toLowerCase()}! Lo gana <b>${esc(this.name(w))}</b>`, this.teamCls(team(w)));
          await sleep(1800);
        }
        break;
      case 'conteo':
        this.showConteo(e.lines, e.results);
        await sleep(500 * f);
        break;
      case 'handEnd':
        await this.waitNext(e.scores);
        $('#conteo').hidden = true;
        break;
      case 'gameEnd':
        this.showGameEnd(e);
        break;
    }
  }

  waitingText(e) {
    const n = `<b>${esc(this.name(e.seat))}</b>`;
    switch (e.kind) {
      case 'mus': return `${n} está pensando si da mus…`;
      case 'descarte': return `${n} elige qué cartas cambiar…`;
      case 'apuesta': return `${n} habla a ${LANCE_NAMES[e.lance].toLowerCase()}…`;
      case 'responde': return `${n} decide si lo quiere…`;
      default: return `${n}…`;
    }
  }

  onLanceEnd(r) {
    const key = chipKey(r.lance);
    let text = '', cls = '';
    switch (r.status) {
      case 'paso': text = 'En paso'; break;
      case 'quiero': text = `Querido ${r.amount}`; break;
      case 'noquiero': text = `+${r.deje} ${this.teamName(r.team)}`; cls = this.teamCls(r.team); break;
      case 'ordago': text = '¡Órdago querido!'; break;
      case 'solo': text = `Solo ${this.teamName(r.team)}`; cls = this.teamCls(r.team); break;
      case 'nadie': text = 'Nadie'; break;
    }
    this.setChip(key, text, cls);
  }

  onPoints(e) {
    this.updateScoreboard(e.scores, e.team);
    this.scene.setScores(e.scores);
    this.sound.play('stone');
    if (e.info?.why === 'noquiero') {
      this.toast(`No quiero: <b>+${e.n}</b> para ${this.teamName(e.team)}`, this.teamCls(e.team));
    }
  }

  // ---------- turnos del humano ----------
  askMus() {
    this.sound.play('turn');
    this.setPrompt('<b>¿Mus?</b> Con mus, todos pueden cambiar cartas. Si cortas, se juega con estas.');
    return this.choose([
      { label: '¡Mus!', cls: 'primary', value: true },
      { label: 'No hay mus', value: false },
    ]);
  }

  askDiscards(v) {
    this.sound.play('turn');
    return new Promise((resolve) => {
      const render = (ids) => {
        this.setPrompt('<b>Descarte:</b> toca las cartas que quieres cambiar (o pulsa 1-4).');
        const buttons = [
          { label: ids.length ? `Descartar ${ids.length}` : 'Descartar', cls: 'primary', disabled: !ids.length, onClick: () => done(ids) },
          { label: 'Las cuatro', onClick: () => done(v.hand.map((c) => c.id)) },
        ];
        if (this.settings.hints) {
          buttons.push({ label: '💡 Sugerir', cls: 'ghost', onClick: () => this.scene.setSelected(new BotAgent(this.rules).pickDiscards(v.hand)) });
        }
        this.setButtons(buttons);
      };
      const done = (ids) => {
        this.scene.onCardToggle = null;
        this.scene.setSelectable(false);
        this.clearButtons();
        resolve(ids);
      };
      this.scene.onCardToggle = render;
      this.scene.setSelectable(true);
      render([]);
    });
  }

  askBet(v) {
    this.sound.play('turn');
    const L = LANCE_NAMES[v.lance].toLowerCase();
    let prob = '';
    if (this.settings.hints) {
      const p = estimateWin(this.rules, v, v.lance, { samples: 500 });
      prob = ` <span class="prob">(ganáis ~${Math.round(p * 100)}%)</span>`;
    }
    const pick = (resolve, a) => {
      this.clearButtons();
      resolve(a);
    };
    if (v.mode === 'abrir') {
      let amount = 2;
      return new Promise((resolve) => {
        const render = () => {
          this.setPrompt(`<b>${LANCE_NAMES[v.lance]}:</b> ¿pasas o envidas?${prob}`);
          this.setButtons([
            { label: 'Paso', onClick: () => pick(resolve, { type: 'paso' }) },
            {
              stepper: true,
              label: amount === 2 ? 'Envido' : `Envido ${amount}`,
              onMinus: () => { amount = Math.max(2, amount - 1); render(); },
              onPlus: () => { amount = Math.min(30, amount + 1); render(); },
              onClick: () => pick(resolve, { type: 'envido', amount }),
            },
            { label: '¡Órdago!', cls: 'danger', onClick: () => pick(resolve, { type: 'ordago' }) },
          ]);
        };
        render();
      });
    }
    const who = `<b>${esc(this.name(v.bettor))}</b>`;
    if (v.ordago) {
      this.setPrompt(`${who} ha echado un <b>órdago</b> a ${L}. ¡Os jugáis la partida!${prob}`);
      return this.choose([
        { label: 'No quiero', value: { type: 'noquiero' } },
        { label: '¡Quiero!', cls: 'ok', value: { type: 'quiero' } },
      ]);
    }
    let amount = 2;
    return new Promise((resolve) => {
      const render = () => {
        this.setPrompt(`${who} envida <b>${v.proposed}</b> a ${L}. Si no quieres, se llevan ${v.deje}.${prob}`);
        this.setButtons([
          { label: 'No quiero', onClick: () => pick(resolve, { type: 'noquiero' }) },
          { label: `Quiero ${v.proposed}`, cls: 'ok', onClick: () => pick(resolve, { type: 'quiero' }) },
          {
            stepper: true,
            label: `${amount} más`,
            onMinus: () => { amount = Math.max(2, amount - 1); render(); },
            onPlus: () => { amount = Math.min(30, amount + 1); render(); },
            onClick: () => pick(resolve, { type: 'envido', amount }),
          },
          { label: '¡Órdago!', cls: 'danger', onClick: () => pick(resolve, { type: 'ordago' }) },
        ]);
      };
      render();
    });
  }

  waitNext(scores) {
    this.setPhase('Fin de la mano');
    const t = this.myTeam();
    this.setPrompt(`Nosotros <b>${scores[t]}</b> · Ellos <b>${scores[1 - t]}</b>`);
    return this.choose([{ label: 'Siguiente mano ▶', cls: 'primary big', value: true, enter: true }]);
  }

  // ---------- señas ----------
  handleSena(e) {
    const S = SENAS[e.sena];
    if (e.seat === this.mySeat) {
      this.toast(`🤫 Le haces a ${esc(this.name(partnerOf(e.seat)))} la seña de <b>${S.significado.toLowerCase()}</b> ${S.emoji}`, 'us');
      if (e.caughtBy.length) {
        setTimeout(() => this.toast(`👀 ¡${esc(e.caughtBy.map((s) => this.name(s)).join(' y '))} te ha pillado la seña!`, 'them'), 1400);
      }
      return;
    }
    const token = this.token;
    setTimeout(async () => {
      if (token !== this.token) return;
      const { seen, peripheral } = await this.scene.showSena(e.seat, S.emoji);
      if (token !== this.token) return;
      const partner = team(e.seat) === this.myTeam();
      if (seen) {
        this.toast(`${S.emoji} <b>${esc(this.name(e.seat))}</b> ${S.gesto.toLowerCase()} → <b>${S.significado}</b>${partner ? '' : ' · ¡le has pillado la seña!'}`, partner ? 'us' : 'them');
        this.log(e.seat, `seña ${S.emoji} ${S.significado.toLowerCase()}`);
      } else if (partner) {
        this.toast(`${esc(this.name(e.seat))} te ha hecho una seña… ¡pero no estabas mirando!`, 'us');
      } else if (peripheral && Math.random() < 0.5) {
        this.toast(`👀 Por el rabillo del ojo ves que <b>${esc(this.name(e.seat))}</b> hace un gesto… ¡mírale la próxima vez!`, 'them');
      }
    }, e.delay * this.pace());
  }

  renderSenas() {
    const list = $('#senas-list');
    list.innerHTML = '';
    for (const [key, s] of Object.entries(SENAS)) {
      const b = document.createElement('button');
      b.className = 'sena-btn';
      b.innerHTML = `<span class="e">${s.emoji}</span><span><b>${s.significado}</b><br>${s.gesto}</span>`;
      b.onclick = () => {
        $('#senas-pop').hidden = true;
        if (!this.game?.hands) {
          this.toast('Las señas se hacen durante la mano.');
          return;
        }
        this.game.sign(this.mySeat, key).catch(() => {});
      };
      list.appendChild(b);
    }
    $('#senas-table').innerHTML = Object.values(SENAS)
      .map((s) => `<div><span class="e">${s.emoji}</span><span><b>${s.significado}</b>: ${s.gesto.toLowerCase()}</span></div>`)
      .join('');
  }

  // ---------- conteo y fin ----------
  cardImg(c) {
    const k = c.suit + c.rank;
    if (!this.cardImgs.has(k)) this.cardImgs.set(k, cardCanvas(c).toDataURL());
    return this.cardImgs.get(k);
  }

  showConteo(lines, results) {
    const rows = [];
    for (const lance of LANCES) {
      const r = results[lance];
      const label = LANCE_NAMES[r?.lance || lance];
      const line = lines.find((l) => chipKey(l.lance) === lance);
      if (line) {
        const who = line.seat !== null && line.seat !== undefined ? ` · ${esc(this.name(line.seat))}` : '';
        rows.push(`<div class="cline ${this.teamCls(line.team)}"><b>${label}</b><span>${this.teamName(line.team)}${who}<br><span class="why">${line.why}</span></span><span class="pts">+${line.pts}</span></div>`);
      } else if (r?.status === 'noquiero') {
        rows.push(`<div class="cline ${this.teamCls(r.team)}"><b>${label}</b><span>${this.teamName(r.team)}<br><span class="why">cobrado al no querer</span></span><span class="pts">✓</span></div>`);
      } else if (r?.status === 'nadie') {
        rows.push(`<div class="cline"><b>${label}</b><span><span class="why">nadie tiene</span></span><span class="pts">–</span></div>`);
      }
    }
    $('#conteo-lines').innerHTML = rows.join('');
    $('#conteo-hands').innerHTML = this.handsHtml();
    $('#conteo').hidden = false;
  }

  handsHtml() {
    const hands = this.revealed || [];
    return this.order.map((seat) => {
      const h = hands[seat] || [];
      const desc = `${this.rules.describePares(this.rules.pares(h))} · ${this.rules.describeJuego(h)}`;
      return `<div class="chand"><div class="who ${this.teamCls(team(seat))}">${esc(this.name(seat))}${seat === this.mano ? ' (mano)' : ''}</div>
        <div class="cards">${h.map((c) => `<img alt="" src="${this.cardImg(c)}">`).join('')}</div><div class="desc">${desc}</div></div>`;
    }).join('');
  }

  showGameEnd(e) {
    const won = e.team === this.myTeam();
    this.sound.play(won ? 'win' : 'lose');
    this.clearButtons();
    this.setPhase('Fin de la partida');
    this.setPrompt(won ? '¡Partida para vosotros!' : 'Esta vez no ha podido ser…');
    const t = this.myTeam();
    let text = `Nosotros <b>${e.scores[t]}</b> – Ellos <b>${e.scores[1 - t]}</b>.`;
    if (e.info?.reason === 'ordago') {
      text = `Órdago a ${LANCE_NAMES[e.info.lance].toLowerCase()} querido y lo gana <b>${esc(this.name(e.info.seat))}</b>.`;
      if (this.revealed) text += `<div class="end-hands">${this.handsHtml()}</div>`;
    }
    $('#end-title').textContent = won ? '¡Habéis ganado!' : 'Han ganado ellos';
    $('#end-text').innerHTML = text;
    $('#modal-end').hidden = false;
  }

  // ---------- HUD ----------
  setPhase(t) { $('#phase').textContent = t; }
  setPrompt(html) { $('#prompt').innerHTML = html; }

  updateScoreboard(scores, bumpTeam = null) {
    const t = this.myTeam();
    $('#names-us').textContent = `${this.name(this.mySeat)} & ${this.name(partnerOf(this.mySeat))}`;
    $('#names-them').textContent = `${this.name((this.mySeat + 1) % 4)} & ${this.name((this.mySeat + 3) % 4)}`;
    const us = $('#score-us'), them = $('#score-them');
    us.textContent = scores[t];
    them.textContent = scores[1 - t];
    if (bumpTeam !== null) {
      const el = bumpTeam === t ? us : them;
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  }

  updateHandInfo() {
    const el = $('#handinfo');
    if (!this.settings.hints || this.myHand.length !== 4) {
      el.innerHTML = '';
      return;
    }
    const r = this.rules;
    el.innerHTML = `Tu mano: <b>${r.describePares(r.pares(this.myHand))}</b> · <b>${r.describeJuego(this.myHand)}</b>`;
  }

  resetChips() {
    document.querySelectorAll('.chip').forEach((c) => {
      c.className = 'chip';
      c.querySelector('span').textContent = '';
    });
    this.setChipLabel('juego', 'Juego');
  }
  chip(key) { return document.querySelector(`.chip[data-lance="${key}"]`); }
  setChipLabel(key, label) { this.chip(key).querySelector('b').textContent = label; }
  setChip(key, text, cls = '') {
    const c = this.chip(key);
    c.querySelector('span').textContent = text;
    c.classList.remove('us', 'them');
    if (cls) c.classList.add(cls);
  }
  activeChip(key) {
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.lance === key));
  }

  log(seat, text) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="${this.teamCls(team(seat))}">${esc(this.name(seat))}</span>: ${esc(text)}`;
    const list = $('#log-list');
    list.appendChild(li);
    list.parentElement.scrollTop = list.parentElement.scrollHeight;
  }
  logSep(text) {
    const li = document.createElement('li');
    li.className = 'sep';
    li.textContent = text;
    $('#log-list').appendChild(li);
  }

  toast(html, cls = '') {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    el.innerHTML = html;
    const box = $('#toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 4200);
    setTimeout(() => el.remove(), 4700);
  }

  // ---------- botones ----------
  clearButtons() {
    $('#buttons').innerHTML = '';
    this.enterAction = null;
  }

  setButtons(defs) {
    const box = $('#buttons');
    box.innerHTML = '';
    this.enterAction = null;
    for (const d of defs) {
      if (d.stepper) {
        const wrap = document.createElement('div');
        wrap.className = 'stepper';
        const minus = document.createElement('button');
        minus.className = 'btn';
        minus.textContent = '−';
        minus.onclick = d.onMinus;
        const main = document.createElement('button');
        main.className = 'btn primary';
        main.textContent = d.label;
        main.onclick = d.onClick;
        const plus = document.createElement('button');
        plus.className = 'btn';
        plus.textContent = '+';
        plus.onclick = d.onPlus;
        wrap.append(minus, main, plus);
        box.appendChild(wrap);
        continue;
      }
      const b = document.createElement('button');
      b.className = `btn ${d.cls || ''}`;
      b.textContent = d.label;
      b.disabled = !!d.disabled;
      b.onclick = d.onClick;
      if (d.enter) this.enterAction = d.onClick;
      box.appendChild(b);
    }
  }

  choose(options) {
    return new Promise((resolve) => {
      this.setButtons(options.map((o) => ({
        ...o,
        onClick: () => {
          this.clearButtons();
          resolve(o.value);
        },
      })));
    });
  }

  // ---------- sonido ----------
  applyAudio() {
    this.sound.enabled = this.settings.sound;
    this.voice.enabled = this.settings.sound && this.settings.voice;
    $('#btn-sound').firstChild.textContent = this.settings.sound ? '🔊' : '🔇';
  }

  // ---------- configuración y caras ----------
  openSetup() {
    $('#opt-target').value = String(this.settings.target);
    $('#opt-reyes').value = this.settings.ochoReyes ? '8' : '4';
    $('#opt-speed').value = String(this.settings.speed);
    $('#opt-voice').checked = this.settings.voice;
    $('#opt-hints').checked = this.settings.hints;
    $('#setup-close').hidden = !this.game;
    $('#setup-play').textContent = this.game ? 'Nueva partida' : '¡A jugar!';
    this.renderSeats();
    $('#modal-setup').hidden = false;
  }

  readOptions() {
    const s = this.settings;
    const target = Number($('#opt-target').value);
    const ochoReyes = $('#opt-reyes').value === '8';
    const rulesChanged = target !== s.target || ochoReyes !== s.ochoReyes;
    s.target = target;
    s.ochoReyes = ochoReyes;
    s.speed = Number($('#opt-speed').value);
    s.voice = $('#opt-voice').checked;
    s.hints = $('#opt-hints').checked;
    this.applyAudio();
    this.save();
    this.updateHandInfo();
    return rulesChanged;
  }

  renderSeats() {
    const box = $('#seats');
    box.innerHTML = '';
    for (const seat of [0, 2, 1, 3]) {
      const p = this.settings.players[seat];
      const el = document.createElement('div');
      el.className = `seat ${this.teamCls(team(seat))}`;
      el.innerHTML = `
        <div class="where">${SEAT_LABELS[seat]}</div>
        <img class="face" alt="">
        <input type="text" maxlength="16" placeholder="Nombre">
        <div class="row">
          <button class="btn" data-act="cam" title="Hacer foto con la cámara">📷 Cámara</button>
          <button class="btn" data-act="file" title="Subir una foto">🖼️ Foto</button>
          ${p.face ? '<button class="btn ghost" data-act="del" title="Quitar foto">✖</button>' : ''}
        </div>`;
      el.querySelector('img').src = faceThumb(this.faces[seat], 192);
      const input = el.querySelector('input');
      input.value = p.name;
      input.oninput = () => {
        p.name = input.value;
        this.scene.setName(seat, this.name(seat));
        this.updateScoreboard(this.game?.scores || [0, 0]);
        clearTimeout(this.nameTimer);
        if (!p.face) {
          this.nameTimer = setTimeout(async () => {
            await this.refreshFace(seat);
            el.querySelector('img').src = faceThumb(this.faces[seat], 192);
          }, 350);
        }
        this.save();
      };
      el.querySelector('[data-act="cam"]').onclick = () => this.openCamera(seat);
      el.querySelector('[data-act="file"]').onclick = () => this.pickFile(seat);
      el.querySelector('[data-act="del"]')?.addEventListener('click', async () => {
        p.face = null;
        this.save();
        await this.refreshFace(seat);
        this.renderSeats();
      });
      el.addEventListener('dragover', (ev) => { ev.preventDefault(); el.classList.add('drop'); });
      el.addEventListener('dragleave', () => el.classList.remove('drop'));
      el.addEventListener('drop', (ev) => {
        ev.preventDefault();
        el.classList.remove('drop');
        const file = ev.dataTransfer.files?.[0];
        if (file?.type.startsWith('image/')) this.readFile(file, seat);
      });
      box.appendChild(el);
    }
  }

  async refreshFace(seat) {
    this.faces[seat] = await buildFace(this.settings.players[seat]);
    this.scene.setFace(seat, this.faces[seat]);
  }

  pickFile(seat) {
    const input = $('#file-input');
    input.value = '';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) this.readFile(file, seat);
    };
    input.click();
  }

  readFile(file, seat) {
    const reader = new FileReader();
    reader.onload = () => this.openCropper(seat, reader.result);
    reader.readAsDataURL(file);
  }

  async openCamera(seat) {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.toast('Este navegador no deja usar la cámara. Sube una foto.');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 960 } }, audio: false });
    } catch {
      this.toast('No se ha podido abrir la cámara (¿permiso denegado?).');
      return;
    }
    const video = $('#cam-video');
    video.srcObject = stream;
    $('#modal-cam').hidden = false;
    const close = () => {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      $('#modal-cam').hidden = true;
    };
    $('#cam-cancel').onclick = close;
    $('#cam-shot').onclick = () => {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w) return;
      const cv = document.createElement('canvas');
      const size = Math.min(w, h);
      cv.width = cv.height = size;
      const ctx = cv.getContext('2d');
      // como un espejo, igual que la vista previa
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, (w - size) / 2, (h - size) / 2, size, size, 0, 0, size, size);
      close();
      this.openCropper(seat, cv.toDataURL('image/jpeg', 0.9), 1.25);
    };
  }

  async openCropper(seat, src, startZoom = 1.4) {
    let img;
    try {
      img = await loadImage(src);
    } catch {
      this.toast('No se ha podido leer esa imagen.');
      return;
    }
    const cv = $('#crop-canvas');
    const ctx = cv.getContext('2d');
    const zoomEl = $('#crop-zoom');
    const base = Math.min(img.width, img.height);
    const st = { zoom: startZoom, cx: img.width / 2, cy: img.height / 2 };
    zoomEl.value = String(st.zoom);
    const view = () => base / st.zoom;
    const clampCenter = () => {
      const v = view() / 2;
      st.cx = Math.max(v, Math.min(img.width - v, st.cx));
      st.cy = Math.max(v, Math.min(img.height - v, st.cy));
    };
    const draw = () => {
      clampCenter();
      const v = view();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, st.cx - v / 2, st.cy - v / 2, v, v, 0, 0, cv.width, cv.height);
    };
    draw();
    let drag = null;
    cv.onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => {
      if (!drag) return;
      const k = view() / cv.getBoundingClientRect().width;
      st.cx -= (e.clientX - drag.x) * k;
      st.cy -= (e.clientY - drag.y) * k;
      drag = { x: e.clientX, y: e.clientY };
      draw();
    };
    cv.onpointerup = () => { drag = null; };
    cv.onwheel = (e) => {
      e.preventDefault();
      st.zoom = Math.max(1, Math.min(4, st.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
      zoomEl.value = String(st.zoom);
      draw();
    };
    zoomEl.oninput = () => { st.zoom = Number(zoomEl.value); draw(); };
    $('#modal-crop').hidden = false;
    $('#crop-cancel').onclick = () => { $('#modal-crop').hidden = true; };
    $('#crop-ok').onclick = async () => {
      clampCenter();
      const v = view();
      this.settings.players[seat].face = cropToDataURL(img, st.cx - v / 2, st.cy - v / 2, v);
      $('#modal-crop').hidden = true;
      this.save();
      await this.refreshFace(seat);
      this.renderSeats();
      this.toast(`¡Cara de ${esc(this.name(seat))} lista!`);
    };
  }

  // ---------- eventos de la interfaz ----------
  bindUI() {
    $('#setup-play').onclick = () => {
      this.readOptions();
      $('#modal-setup').hidden = true;
      this.sound.ensure();
      this.startGame();
    };
    $('#setup-close').onclick = () => {
      const changed = this.readOptions();
      $('#modal-setup').hidden = true;
      if (changed) this.toast('Los cambios de reglas se aplican en la próxima partida.');
    };
    $('#btn-players').onclick = () => this.openSetup();
    $('#btn-rules').onclick = () => { $('#modal-rules').hidden = false; };
    $('#rules-close').onclick = () => { $('#modal-rules').hidden = true; };
    $('#btn-center').onclick = () => this.scene.resetView();
    $('#btn-sound').onclick = () => {
      this.settings.sound = !this.settings.sound;
      this.applyAudio();
      this.save();
    };
    $('#btn-senas').onclick = () => {
      $('#senas-partner').textContent = this.name(partnerOf(this.mySeat));
      $('#senas-pop').hidden = !$('#senas-pop').hidden;
    };
    $('#btn-log').onclick = () => {
      $('#log').hidden = !$('#log').hidden;
      $('#btn-log').classList.toggle('on', !$('#log').hidden);
    };
    $('#end-again').onclick = () => {
      $('#modal-end').hidden = true;
      this.startGame();
    };
    $('#end-players').onclick = () => {
      $('#modal-end').hidden = true;
      this.openSetup();
    };
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    if (coarse && 'DeviceOrientationEvent' in window) {
      const btn = $('#btn-gyro');
      btn.hidden = false;
      btn.onclick = async () => {
        if (this.scene.gyro) {
          this.scene.disableGyro();
          btn.classList.remove('on');
          return;
        }
        if (await this.scene.enableGyro()) {
          btn.classList.add('on');
          this.toast('Mueve el móvil para mirar alrededor. 🎯 recentra.');
        } else {
          this.toast('No hay acceso al giroscopio en este dispositivo.');
        }
      };
    }
    const hint = $('#look-hint');
    const fade = () => hint.classList.add('fade');
    $('#stage').addEventListener('pointerdown', fade, { once: true });
    setTimeout(fade, 15000);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $('#senas-pop').hidden = true;
        $('#modal-rules').hidden = true;
      }
      if (e.key === 'Enter' && this.enterAction && !e.target.closest('input')) {
        e.preventDefault();
        this.enterAction();
      }
    });
    this.renderSenas();
  }
}

const app = new App();
window.musApp = app;
app.init().catch((e) => {
  console.error(e);
  $('#prompt').textContent = 'No se ha podido iniciar el juego: ' + e.message;
});
