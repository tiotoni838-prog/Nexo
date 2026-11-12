import type { GameMap } from '../shared/map.js';
import type { SnapshotMsg, NetPlayer } from '../shared/protocol.js';
import { WORLD_RADIUS, MAP_SIZE } from '../shared/constants.js';
import { CHARACTERS } from '../shared/characters.js';
import { ParticleSystem } from './effects.js';
import { canvasFilter, rarityColor, timeOfDay, type ColorFilter } from '../shared/graphics.js';

const RARITY_COLORS: Record<string, string> = {
  comun: '#b7c3d8',
  raro: '#4ea1ff',
  epico: '#b06bff',
  legendario: '#f2b632',
};

export interface RenderState {
  snapshot: SnapshotMsg | null;
  yourId: number;
  map: GameMap | null;
  prevPlayers: Map<number, { x: number; y: number }>;
  renderTime: number;
  spectateId?: number;
  dtMs: number;
  wings: boolean;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  dpr = 1;
  particles = new ParticleSystem();
  private currentDarkness = 0;
  private shakeMs = 0;
  private shakeIntensity = 0;
  private timeMs = 0;
  private lastPositions = new Map<number, { x: number; y: number }>();
  private moveSpeeds = new Map<number, number>();
  dprCap = 3;
  shadows = true;
  brightness = 1;
  filter: ColorFilter = 'off';
  reduceEffects = false;
  colorblind: string = 'off';

  setQuality(dprCap: number, shadows: boolean, brightness: number): void {
    this.dprCap = dprCap;
    this.shadows = shadows;
    this.brightness = brightness;
    this.resize();
  }

  setStyle(filter: ColorFilter, reduceEffects: boolean, colorblind: string): void {
    this.filter = filter;
    this.reduceEffects = reduceEffects;
    this.colorblind = colorblind;
  }

  private drawClouds(): void {
    const { ctx, canvas } = this;
    const drift = (this.timeMs * 0.008) % (canvas.width + 400);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
    for (let i = 0; i < 6; i++) {
      const baseX = ((i * 397) % (canvas.width + 400)) - drift;
      const x = baseX < -200 ? baseX + canvas.width + 400 : baseX;
      const y = ((i * 233) % Math.max(1, canvas.height * 0.8)) + 40;
      const w = (140 + (i * 61) % 160) * this.dpr;
      ctx.beginPath();
      ctx.ellipse(x, y, w, w * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  addShake(ms: number, intensity: number): void {
    this.shakeMs = Math.max(this.shakeMs, ms);
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
  }

  private worldToScreen(camX: number, camY: number, zoom: number, wx: number, wy: number): [number, number] {
    return [
      (wx - camX) * zoom + this.canvas.width / 2,
      (wy - camY) * zoom + this.canvas.height / 2,
    ];
  }

  render(state: RenderState): void {
    const { ctx, canvas } = this;
    const snap = state.snapshot;
    ctx.filter = canvasFilter(this.brightness, this.filter);
    const tod = timeOfDay(this.timeMs);
    this.currentDarkness = snap?.night ? Math.max(tod.darkness, 0.45) : tod.darkness;
    ctx.fillStyle = state.map?.palette.sky ?? tod.sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!snap || !state.map) return;

    this.timeMs += state.dtMs;
    this.particles.update(state.dtMs);
    if (this.shakeMs > 0) this.shakeMs -= state.dtMs;
    this.drawClouds();

    const me = snap.players.find((p) => p.id === state.yourId);
    let focus = me && me.alive ? me : null;
    if (!focus) {
      const alive = snap.players.filter((p) => p.alive && !p.landing);
      if (state.spectateId !== undefined) {
        focus = alive.find((p) => p.id === state.spectateId) ?? alive[0] ?? null;
      } else {
        focus = alive[0] ?? null;
      }
    }
    if (!focus) return;

    const zoom = Math.min(canvas.width, canvas.height) / (900 * this.dpr) * this.dpr;
    const shakeScale = this.reduceEffects ? 0.3 : 1;
    const shake = this.shakeMs > 0 ? this.shakeIntensity * (this.shakeMs / 300) * shakeScale : 0;
    const camX = focus.x + (shake ? (Math.random() - 0.5) * shake : 0);
    const camY = focus.y + (shake ? (Math.random() - 0.5) * shake : 0);

    const toScreen = (wx: number, wy: number): [number, number] => [
      (wx - camX) * zoom + canvas.width / 2,
      (wy - camY) * zoom + canvas.height / 2,
    ];

    this.trackMovement(snap, state.dtMs);
    this.drawGrid(camX, camY, zoom);
    this.drawZone(snap, camX, camY, zoom);
    this.drawRedZone(snap, camX, camY, zoom);
    this.drawMap(state.map, camX, camY, zoom);
    this.drawWalls(snap, camX, camY, zoom);
    this.drawVehicles(snap, camX, camY, zoom);
    this.drawShadows(state.map, snap, camX, camY, zoom);
    this.drawItems(snap, camX, camY, zoom);
    this.drawGrenades(snap, camX, camY, zoom);
    this.drawBullets(snap, camX, camY, zoom);
    this.drawPlayers(snap, state, camX, camY, zoom);
    this.particles.draw(this.ctx, toScreen, this.dpr);
    this.drawPoiNames(state.map, camX, camY, zoom);
    if (this.currentDarkness > 0) {
      ctx.save();
      ctx.filter = 'none';
      ctx.fillStyle = `rgba(4, 8, 24, ${this.currentDarkness})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    this.drawVignette();
    this.drawMinimap(snap, state.map, state.yourId);
  }

  private trackMovement(snap: SnapshotMsg, dtMs: number): void {
    const dtSec = Math.max(1, dtMs) / 1000;
    for (const p of snap.players) {
      const last = this.lastPositions.get(p.id);
      if (last) {
        this.moveSpeeds.set(p.id, Math.hypot(p.x - last.x, p.y - last.y) / dtSec);
      } else {
        this.moveSpeeds.set(p.id, 0);
      }
      this.lastPositions.set(p.id, { x: p.x, y: p.y });
    }
  }

  private drawWalls(snap: SnapshotMsg, camX: number, camY: number, zoom: number): void {
    const { ctx } = this;
    for (const wall of snap.walls) {
      const [sx, sy] = this.worldToScreen(camX, camY, zoom, wall.x, wall.y);
      const wpx = wall.w * zoom;
      const hpx = wall.h * zoom;
      ctx.save();
      ctx.shadowColor = '#7de8ff';
      ctx.shadowBlur = this.shadows ? 12 * this.dpr : 0;
      const gradient = ctx.createLinearGradient(sx, sy, sx + wpx, sy + hpx);
      gradient.addColorStop(0, 'rgba(125, 232, 255, 0.85)');
      gradient.addColorStop(0.5, 'rgba(56, 189, 248, 0.6)');
      gradient.addColorStop(1, 'rgba(125, 232, 255, 0.85)');
      ctx.fillStyle = gradient;
      ctx.fillRect(sx, sy, wpx, hpx);
      ctx.restore();
      ctx.strokeStyle = 'rgba(232, 247, 255, 0.9)';
      ctx.lineWidth = 1.5 * this.dpr;
      ctx.strokeRect(sx, sy, wpx, hpx);
    }
  }

  private drawShadows(map: GameMap, snap: SnapshotMsg, camX: number, camY: number, zoom: number): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    for (const o of map.obstacles) {
      const [sx, sy] = this.worldToScreen(camX, camY, zoom, o.x + 7, o.y + 9);
      ctx.fillRect(sx, sy, o.w * zoom, o.h * zoom);
    }
    for (const p of snap.players) {
      if (!p.alive) continue;
      const [sx, sy] = this.worldToScreen(camX, camY, zoom, p.x + 4, p.y + 6);
      ctx.beginPath();
      ctx.ellipse(sx, sy, 13 * zoom * this.dpr * 0.5, 8 * zoom * this.dpr * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawGrenades(snap: SnapshotMsg, camX: number, camY: number, zoom: number): void {
    const { ctx } = this;
    const pulse = 1 + Math.sin(this.timeMs / 60) * 0.25;
    for (const g of snap.grenades) {
      const [sx, sy] = this.worldToScreen(camX, camY, zoom, g.x, g.y);
      ctx.fillStyle = '#5a6b52';
      ctx.beginPath();
      ctx.arc(sx, sy, 5 * this.dpr * 0.6 * zoom * 0.6 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ef5b6b';
      ctx.lineWidth = 1.5 * this.dpr;
      ctx.stroke();
    }
  }

  private drawPoiNames(map: GameMap, camX: number, camY: number, zoom: number): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(142, 160, 192, 0.4)';
    ctx.font = `${13 * this.dpr}px system-ui`;
    ctx.textAlign = 'center';
    for (const poi of map.pois) {
      const [sx, sy] = this.worldToScreen(camX, camY, zoom, poi.center.x, poi.center.y);
      if (sx < -100 || sx > this.canvas.width + 100 || sy < -100 || sy > this.canvas.height + 100) continue;
      ctx.fillText(poi.nameEs, sx, sy);
    }
  }

  private drawVignette(): void {
    const { ctx, canvas } = this;
    const gradient = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      Math.min(canvas.width, canvas.height) * 0.42,
      canvas.width / 2,
      canvas.height / 2,
      Math.max(canvas.width, canvas.height) * 0.75,
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private drawGrid(camX: number, camY: number, zoom: number): void {
    const { ctx, canvas } = this;
    const step = 200 * zoom;
    if (step < 12) return;
    const startX = Math.floor((camX - WORLD_RADIUS) / 200) * 200;
    const startY = Math.floor((camY - WORLD_RADIUS) / 200) * 200;
    ctx.strokeStyle = 'rgba(56, 225, 200, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= camX + WORLD_RADIUS; x += 200) {
      const [sx] = this.worldToScreen(camX, camY, zoom, x, 0);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, canvas.height);
    }
    for (let y = startY; y <= camY + WORLD_RADIUS; y += 200) {
      const [, sy] = this.worldToScreen(camX, camY, zoom, 0, y);
      ctx.moveTo(0, sy);
      ctx.lineTo(canvas.width, sy);
    }
    ctx.stroke();
  }

  private drawZone(snap: SnapshotMsg, camX: number, camY: number, zoom: number): void {
    const { ctx } = this;
    const [zx, zy] = this.worldToScreen(camX, camY, zoom, snap.zone.cx, snap.zone.cy);
    const zr = snap.zone.r * zoom;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.canvas.width, this.canvas.height);
    ctx.arc(zx, zy, zr, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(239, 91, 107, 0.16)';
    ctx.fill('evenodd');
    ctx.restore();

    ctx.strokeStyle = '#38e1c8';
    ctx.lineWidth = 3 * this.dpr;
    ctx.beginPath();
    ctx.arc(zx, zy, zr, 0, Math.PI * 2);
    ctx.stroke();

    if (snap.zoneMode === 'shrink') {
      const [tx, ty] = this.worldToScreen(camX, camY, zoom, snap.zone.tcx, snap.zone.tcy);
      ctx.strokeStyle = 'rgba(242, 182, 50, 0.8)';
      ctx.setLineDash([8 * this.dpr, 8 * this.dpr]);
      ctx.beginPath();
      ctx.arc(tx, ty, snap.zone.tr * zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawRedZone(snap: SnapshotMsg, camX: number, camY: number, zoom: number): void {
    if (!snap.redZone) return;
    const { ctx } = this;
    const [zx, zy] = this.worldToScreen(camX, camY, zoom, snap.redZone.x, snap.redZone.y);
    const zr = snap.redZone.r * zoom;
    ctx.save();
    ctx.beginPath();
    ctx.arc(zx, zy, zr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 60, 60, 0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.85)';
    ctx.setLineDash([10 * this.dpr, 6 * this.dpr]);
    ctx.lineWidth = 2 * this.dpr;
    ctx.stroke();
    ctx.restore();
  }

  private drawMap(map: GameMap, camX: number, camY: number, zoom: number): void {
    const { ctx } = this;
    const palette = map.palette ?? {
      obstacle: '#26314e',
      obstacleTop: '#1c2740',
    };
    for (const o of map.obstacles) {
      const [sx, sy] = this.worldToScreen(camX, camY, zoom, o.x, o.y);
      ctx.fillStyle = o.w > 40 ? palette.obstacle : palette.obstacleTop;
      ctx.fillRect(sx, sy, o.w * zoom, o.h * zoom);
      ctx.strokeStyle = 'rgba(142, 160, 192, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, o.w * zoom, o.h * zoom);
    }
  }

  private drawVehicles(snap: SnapshotMsg, camX: number, camY: number, zoom: number): void {
    if (!snap.vehicles) return;
    const { ctx, canvas } = this;
    const colors: Record<string, string> = {
      moto: '#e05a3a',
      buggy: '#d8a03a',
      todoterreno: '#4a8a4a',
      blindado: '#5a6a7a',
      bote: '#3a7ad0',
    };
    for (const v of snap.vehicles) {
      const x = (v.x - camX) * zoom + canvas.width / 2;
      const y = (v.y - camY) * zoom + canvas.height / 2;
      const size = (v.kind === 'moto' ? 34 : v.kind === 'blindado' ? 58 : 46) * zoom;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(v.aim);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-size / 2 + 3, -size / 3 + 4, size, size * 0.66);
      ctx.fillStyle = colors[v.kind] ?? '#888';
      ctx.fillRect(-size / 2, -size / 3, size, size * 0.66);
      ctx.fillStyle = 'rgba(10,16,30,0.55)';
      ctx.fillRect(-size * 0.18, -size / 4, size * 0.34, size * 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(size / 2 - 3, -size / 5, 3, size * 0.4);
      if (v.hp < v.maxHp) {
        ctx.rotate(-v.aim);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-size / 2, -size / 2 - 9, size, 5);
        ctx.fillStyle = v.hp / v.maxHp > 0.5 ? '#4caf50' : v.hp / v.maxHp > 0.25 ? '#f2b632' : '#ff4d5e';
        ctx.fillRect(-size / 2, -size / 2 - 9, (size * v.hp) / v.maxHp, 5);
      }
      ctx.restore();
    }
  }

  private drawItems(snap: SnapshotMsg, camX: number, camY: number, zoom: number): void {
    const { ctx } = this;
    for (const item of snap.items) {
      const [sx, sy] = this.worldToScreen(camX, camY, zoom, item.x, item.y);
      const color = rarityColor(item.rarity, this.colorblind);
      const legendary = item.rarity === 'legendario';
      const size = (legendary ? 13 : 9) * zoom * this.dpr * 0.5;
      if (legendary) {
        ctx.shadowColor = color;
        ctx.shadowBlur = this.shadows ? 14 * this.dpr : 0;
      }
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = color;
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-size, -size, size * 2, size * 2);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  private drawBullets(snap: SnapshotMsg, camX: number, camY: number, zoom: number): void {
    const { ctx } = this;
    ctx.strokeStyle = '#ffd47a';
    ctx.shadowColor = '#f2b632';
    ctx.shadowBlur = this.shadows ? 6 * this.dpr : 0;
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    for (const b of snap.bullets) {
      const [sx, sy] = this.worldToScreen(camX, camY, zoom, b.x, b.y);
      const len = 12 * this.dpr;
      const vlen = Math.hypot(b.vx, b.vy) || 1;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - (b.vx / vlen) * len, sy - (b.vy / vlen) * len);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  private drawPlayers(
    snap: SnapshotMsg,
    state: RenderState,
    camX: number,
    camY: number,
    zoom: number,
  ): void {
    const { ctx } = this;
    for (const p of snap.players) {
      if (!p.alive) continue;
      const [sx, sy] = this.worldToScreen(camX, camY, zoom, p.x, p.y);
      const u = zoom * this.dpr;
      const isMe = p.id === state.yourId;
      const speed = this.moveSpeeds.get(p.id) ?? 0;
      const walkPhase = this.timeMs / 90 + p.id * 1.7;
      const swing = Math.min(1, speed / 170) * Math.sin(walkPhase);
      const charColor = CHARACTERS[p.characterId]?.color ?? '#38e1c8';

      if (state.wings && !p.prone) {
        this.drawWings(sx, sy, p, u);
      }

      this.drawHumanoid(sx, sy, p, u, swing, charColor, isMe);

      const r = 14 * u * 0.5;
      if (p.hp < 100 || p.shield > 0) {
        const barW = r * 2.6;
        const barY = sy - r - 12 * this.dpr;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(sx - barW / 2, barY, barW, 5 * this.dpr);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(sx - barW / 2, barY, (barW * Math.max(0, p.hp)) / 100, 5 * this.dpr);
        if (p.shield > 0) {
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(sx - barW / 2, barY - 3 * this.dpr, (barW * p.shield) / 100, 2.5 * this.dpr);
        }
      }

      if (p.abilityActive) {
        ctx.strokeStyle = charColor;
        ctx.shadowColor = charColor;
        ctx.shadowBlur = this.shadows ? 10 * this.dpr : 0;
        ctx.lineWidth = 2 * this.dpr;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 1.5 + Math.sin(this.timeMs / 100) * 2 * this.dpr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (isMe || !p.landing) {
        ctx.fillStyle = 'rgba(232, 237, 247, 0.9)';
        ctx.font = `${11 * this.dpr}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(p.name, sx, sy - r - 16 * this.dpr);
      }
    }
  }

  private drawWings(sx: number, sy: number, p: NetPlayer, u: number): void {
    const { ctx } = this;
    const flap = Math.sin(this.timeMs / 140 + p.id) * 0.35;
    const wingLen = 20 * u;
    const spread = 0.55 + flap;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.aim);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(2 * u, -side * 3 * u);
      ctx.quadraticCurveTo(
        -wingLen * 0.6,
        -side * wingLen * spread * 0.7,
        -wingLen,
        -side * wingLen * spread,
      );
      ctx.quadraticCurveTo(
        -wingLen * 0.55,
        -side * wingLen * spread * 0.45,
        0,
        -side * 1.5 * u,
      );
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, 0, -wingLen, -side * wingLen);
      gradient.addColorStop(0, 'rgba(232, 247, 255, 0.75)');
      gradient.addColorStop(1, 'rgba(125, 232, 255, 0.25)');
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = 'rgba(232, 247, 255, 0.55)';
      ctx.lineWidth = 1 * this.dpr;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHumanoid(
    sx: number,
    sy: number,
    p: NetPlayer,
    u: number,
    swing: number,
    charColor: string,
    isMe: boolean,
  ): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.aim);

    if (p.prone) {
      ctx.scale(1.5, 0.55);
    } else if (p.sliding) {
      ctx.scale(1.25, 0.8);
    }

    const outline = isMe ? '#e8fff9' : p.bot ? 'rgba(0,0,0,0.55)' : '#3a1220';

    ctx.strokeStyle = '#2b3550';
    ctx.lineWidth = 3.4 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1 * u, -4.5 * u);
    ctx.lineTo((-3 + swing * 3.5) * u, -5.5 * u);
    ctx.moveTo(-1 * u, 4.5 * u);
    ctx.lineTo((-3 - swing * 3.5) * u, 5.5 * u);
    ctx.stroke();

    ctx.fillStyle = charColor;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.ellipse(0.5 * u, 0, 6.5 * u, 5 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = charColor;
    ctx.lineWidth = 2.6 * u;
    ctx.beginPath();
    ctx.moveTo(2 * u, -4 * u);
    ctx.lineTo(7.5 * u, -1.2 * u);
    ctx.moveTo(2 * u, 4 * u);
    ctx.lineTo(7.5 * u, 1.2 * u);
    ctx.stroke();

    ctx.fillStyle = '#1a2236';
    ctx.fillRect(6.5 * u, -1.1 * u, 8 * u, 2.2 * u);
    ctx.strokeStyle = '#0d1322';
    ctx.lineWidth = 0.8 * u;
    ctx.strokeRect(6.5 * u, -1.1 * u, 8 * u, 2.2 * u);

    ctx.beginPath();
    ctx.arc(1.5 * u, 0, 3.4 * u, 0, Math.PI * 2);
    ctx.fillStyle = '#e8edf7';
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(2.6 * u, 0, 2.1 * u, 0, Math.PI * 2);
    ctx.fillStyle = p.shield > 0 ? '#38bdf8' : charColor;
    ctx.fill();

    ctx.restore();
  }

  private drawMinimap(snap: SnapshotMsg, map: GameMap, yourId: number): void {
    const { ctx, canvas } = this;
    const size = Math.round(150 * this.dpr);
    const pad = 12 * this.dpr;
    const scale = size / MAP_SIZE;
    const ox = canvas.width - size - pad;
    const oy = pad;

    ctx.fillStyle = 'rgba(10, 14, 23, 0.85)';
    ctx.fillRect(ox, oy, size, size);
    ctx.strokeStyle = '#232e47';
    ctx.strokeRect(ox, oy, size, size);

    const toMini = (wx: number, wy: number): [number, number] => [
      ox + (wx + WORLD_RADIUS) * scale,
      oy + (wy + WORLD_RADIUS) * scale,
    ];

    ctx.fillStyle = '#26314e';
    for (const o of map.obstacles) {
      const [mx, my] = toMini(o.x, o.y);
      ctx.fillRect(mx, my, Math.max(1, o.w * scale), Math.max(1, o.h * scale));
    }

    const [zx, zy] = toMini(snap.zone.cx, snap.zone.cy);
    ctx.strokeStyle = '#38e1c8';
    ctx.beginPath();
    ctx.arc(zx, zy, snap.zone.r * scale, 0, Math.PI * 2);
    ctx.stroke();

    for (const p of snap.players) {
      if (!p.alive) continue;
      const [mx, my] = toMini(p.x, p.y);
      ctx.fillStyle = p.id === yourId ? '#38e1c8' : p.bot ? '#8ea0c0' : '#ef5b6b';
      ctx.beginPath();
      ctx.arc(mx, my, 2.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
