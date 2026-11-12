/**
 * SFX sintetizados con WebAudio: cero assets, cero licencias, cero peso.
 * Todo es original y procedural. Los subtítulos cubren cada cue (accesibilidad).
 */

export class Sfx {
  private ctx: AudioContext | null = null;
  enabled = true;
  private volMaster = 0.8;
  private volMusic = 0.6;
  private volSfx = 1;

  setVolumes(master: number, music: number, sfx: number): void {
    this.volMaster = Math.min(1, Math.max(0, master));
    this.volMusic = Math.min(1, Math.max(0, music));
    this.volSfx = Math.min(1, Math.max(0, sfx));
    this.enabled = this.volMaster > 0;
  }

  private scaled(gain: number, music: boolean): number {
    const channel = music ? this.volMusic : this.volSfx;
    return gain * channel * this.volMaster;
  }

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, durMs: number, type: OscillatorType, gain: number, slideTo?: number): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), ctx.currentTime + durMs / 1000);
    const g = this.scaled(gain, false);
    amp.gain.setValueAtTime(g, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durMs / 1000);
    osc.connect(amp).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durMs / 1000);
  }

  private noise(durMs: number, gain: number, filterHz: number): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * (durMs / 1000)));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    const amp = ctx.createGain();
    amp.gain.value = this.scaled(gain, false);
    src.connect(filter).connect(amp).connect(ctx.destination);
    src.start();
  }

  shot(): void {
    this.noise(90, 0.18, 2200);
    this.tone(190, 60, 'square', 0.06, 60);
  }

  distantShot(): void {
    this.noise(70, 0.06, 700);
  }

  hit(): void {
    this.tone(320, 70, 'sawtooth', 0.08, 140);
  }

  hurt(): void {
    this.tone(140, 160, 'sawtooth', 0.12, 70);
  }

  explosion(): void {
    this.noise(420, 0.32, 320);
    this.tone(70, 380, 'sine', 0.25, 34);
  }

  pickup(): void {
    this.tone(660, 90, 'triangle', 0.09);
    this.tone(990, 110, 'triangle', 0.07);
  }

  reload(): void {
    this.tone(240, 60, 'square', 0.05);
    window.setTimeout(() => this.tone(300, 60, 'square', 0.05), 120);
  }

  zoneWarn(): void {
    this.tone(520, 200, 'sine', 0.1);
    window.setTimeout(() => this.tone(390, 260, 'sine', 0.1), 240);
  }

  airdrop(): void {
    this.tone(300, 300, 'triangle', 0.1, 600);
  }

  kill(): void {
    this.tone(520, 90, 'triangle', 0.1);
    window.setTimeout(() => this.tone(780, 140, 'triangle', 0.1), 100);
  }

  victory(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => window.setTimeout(() => this.tone(n, 260, 'triangle', 0.12), i * 160));
  }

  defeat(): void {
    const notes = [392, 330, 262];
    notes.forEach((n, i) => window.setTimeout(() => this.tone(n, 320, 'sine', 0.1), i * 200));
  }
}
