// Efectos de sonido sintetizados con WebAudio y voz (speechSynthesis) para los cantes.
export class Sound {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  noise(at, dur, freq, gain) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(at);
  }

  tone(at, freq, dur, gain, type = 'sine') {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(ctx.destination);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  play(name) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    switch (name) {
      case 'card': this.noise(t, 0.07, 2600, 0.35); break;
      case 'deal': for (let i = 0; i < 10; i++) this.noise(t + i * 0.035, 0.05, 1800 + Math.random() * 1500, 0.18); break;
      case 'stone':
        this.tone(t, 1900, 0.06, 0.12, 'triangle');
        this.tone(t + 0.05, 1300, 0.08, 0.08, 'triangle');
        break;
      case 'turn': this.tone(t, 880, 0.18, 0.06); this.tone(t + 0.09, 1320, 0.22, 0.05); break;
      case 'ordago':
        this.tone(t, 70, 0.6, 0.5, 'sawtooth');
        this.tone(t, 110, 0.5, 0.25, 'square');
        this.noise(t, 0.3, 300, 0.5);
        break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.12, f, 0.35, 0.12, 'triangle')); break;
      case 'lose': [392, 330, 262].forEach((f, i) => this.tone(t + i * 0.16, f, 0.4, 0.1, 'triangle')); break;
    }
  }
}

export class Voice {
  constructor() {
    this.enabled = true;
    this.voice = null;
    if (!('speechSynthesis' in window)) return;
    const pickVoice = () => {
      const vs = speechSynthesis.getVoices();
      this.voice = vs.find((v) => v.lang === 'es-ES') || vs.find((v) => v.lang?.startsWith('es')) || null;
    };
    pickVoice();
    speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  }

  say(text, seat = 0) {
    if (!this.enabled || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text.replace(/[¡!]/g, ''));
    u.lang = 'es-ES';
    if (this.voice) u.voice = this.voice;
    u.pitch = [1, 0.8, 1.2, 0.65][seat % 4];
    u.rate = 1.12;
    if (speechSynthesis.pending) speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}
