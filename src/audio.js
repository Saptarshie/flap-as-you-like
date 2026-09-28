export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.ambienceNodes = [];
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.startAmbience();
  }
  startAmbience() {
    const c = this.ctx;
    const air = c.createBufferSource();
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    }
    air.buffer = buf;
    air.loop = true;
    const airFilter = c.createBiquadFilter();
    airFilter.type = 'lowpass';
    airFilter.frequency.value = 420;
    const airGain = c.createGain();
    airGain.gain.value = 0.05;
    air.connect(airFilter).connect(airGain).connect(this.master);
    air.start();
    const chirpTimes = [0.3, 1.4, 2.7];
    this.chirps = [];
    for (const t of chirpTimes) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(2100, c.currentTime);
      g.gain.value = 0;
      g.gain.setValueAtTime(0, c.currentTime + t);
      g.gain.linearRampToValueAtTime(0.02, c.currentTime + t + 0.08);
      g.gain.linearRampToValueAtTime(0, c.currentTime + t + 0.35);
      o.connect(g).connect(this.master);
      o.start();
      this.chirps.push({ o, g, t });
    }
  }
  setEnabled(v) {
    this.enabled = v;
    if (this.master) this.master.gain.value = v ? 0.55 : 0;
  }
  flap() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    const len = Math.floor(c.sampleRate * 0.16);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const p = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - p, 2.2) * (p < 0.15 ? p / 0.15 : 1);
    }
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(260, t + 0.14);
    f.Q.value = 1.1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
  ping(freq = 880, dur = 0.18, vol = 0.22, type = 'sine') {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur * 0.6);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  coin() {
    this.ping(1180, 0.14, 0.2, 'triangle');
    setTimeout(() => this.ping(1560, 0.16, 0.16, 'triangle'), 70);
  }
  ring() {
    this.ping(660, 0.3, 0.18, 'sine');
    setTimeout(() => this.ping(990, 0.34, 0.14, 'sine'), 90);
  }
  crash() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const len = Math.floor(c.sampleRate * 0.6);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const p = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - p, 1.6);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(160, t + 0.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0.65, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    this.ping(180, 0.5, 0.3, 'sawtooth');
  }
  swoosh() {
    if (!this.ctx || !this.enabled) return;
    this.ping(320, 0.22, 0.1, 'sine');
  }
  shoot() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.12);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.16);
  }
  pop() {
    this.ping(420, 0.16, 0.24, 'square');
    setTimeout(() => this.ping(160, 0.2, 0.18, 'sawtooth'), 40);
  }
  screech() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.34);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 3;
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.38);
  }
  roar() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const len = Math.floor(c.sampleRate * 1.4);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const p = i / len;
      const white = Math.random() * 2 - 1;
      last = (last + 0.06 * white) / 1.06;
      d[i] = last * 2.6 * Math.min(1, p * 4) * (1 - p * 0.75);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(520, t + 0.7);
    f.frequency.linearRampToValueAtTime(210, t + 1.4);
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.linearRampToValueAtTime(0.22, t + 1.0);
    g.gain.linearRampToValueAtTime(0.0, t + 1.4);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
  pickup() {
    this.ping(520, 0.12, 0.2, 'triangle');
    setTimeout(() => this.ping(780, 0.14, 0.18, 'triangle'), 60);
    setTimeout(() => this.ping(1040, 0.18, 0.16, 'triangle'), 120);
  }
  potion() {
    this.ping(300, 0.2, 0.2, 'sine');
    setTimeout(() => this.ping(450, 0.22, 0.18, 'sine'), 90);
    setTimeout(() => this.ping(600, 0.26, 0.16, 'sine'), 180);
  }
  portal() {
    this.ping(240, 0.5, 0.2, 'sine');
    setTimeout(() => this.ping(360, 0.55, 0.16, 'sine'), 140);
    setTimeout(() => this.ping(480, 0.6, 0.14, 'sine'), 280);
  }
  thunder() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const len = Math.floor(c.sampleRate * 1.1);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const p = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - p, 1.2) * (0.6 + 0.4 * Math.sin(p * 40));
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(90, t + 1.0);
    const g = c.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
  heal() {
    this.ping(660, 0.3, 0.16, 'sine');
    setTimeout(() => this.ping(880, 0.3, 0.14, 'sine'), 110);
  }
  tunnelHum(on) {
    if (!this.ctx) return;
    if (on) {
      if (this._tunnel) return;
      const c = this.ctx;
      const g = c.createGain();
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(0.07, c.currentTime + 0.5);
      const o1 = c.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.value = 47;
      const o2 = c.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 71;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 170;
      o1.connect(f);
      o2.connect(f);
      f.connect(g);
      g.connect(this.master);
      o1.start();
      o2.start();
      this._tunnel = { o1, o2, g };
    } else if (this._tunnel) {
      const { o1, o2, g } = this._tunnel;
      const t = this.ctx.currentTime;
      g.gain.linearRampToValueAtTime(0, t + 0.3);
      o1.stop(t + 0.35);
      o2.stop(t + 0.35);
      this._tunnel = null;
    }
  }
}