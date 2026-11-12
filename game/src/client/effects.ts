export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeMs: number;
  maxLifeMs: number;
  size: number;
  color: string;
  glow: boolean;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private rings: Array<{ x: number; y: number; r: number; maxR: number; lifeMs: number; maxLifeMs: number; color: string }> = [];

  get count(): number {
    return this.particles.length;
  }

  burst(
    x: number,
    y: number,
    count: number,
    opts: { speed: number; lifeMs: number; size: number; color: string; glow?: boolean; dir?: number; spread?: number },
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = opts.dir !== undefined ? opts.dir + (Math.random() - 0.5) * (opts.spread ?? Math.PI * 2) : Math.random() * Math.PI * 2;
      const speed = opts.speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifeMs: opts.lifeMs * (0.6 + Math.random() * 0.6),
        maxLifeMs: opts.lifeMs,
        size: opts.size * (0.6 + Math.random() * 0.8),
        color: opts.color,
        glow: opts.glow ?? false,
      });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  ring(x: number, y: number, maxR: number, lifeMs: number, color: string): void {
    this.rings.push({ x, y, r: 0, maxR, lifeMs, maxLifeMs: lifeMs, color });
  }

  muzzleFlash(x: number, y: number, dir: number): void {
    this.burst(x, y, 4, { speed: 130, lifeMs: 110, size: 3.4, color: '#ffd47a', glow: true, dir, spread: 0.7 });
  }

  impactSparks(x: number, y: number, dir: number): void {
    this.burst(x, y, 6, { speed: 170, lifeMs: 240, size: 2.4, color: '#ffb347', glow: true, dir: dir + Math.PI, spread: 1.5 });
  }

  explosion(x: number, y: number): void {
    this.ring(x, y, 95, 480, 'rgba(255, 170, 60, 0.9)');
    this.burst(x, y, 34, { speed: 280, lifeMs: 620, size: 4.2, color: '#ff9d3c', glow: true });
    this.burst(x, y, 16, { speed: 110, lifeMs: 900, size: 6.5, color: 'rgba(90, 90, 90, 0.55)' });
  }

  bloodFreeHit(x: number, y: number, dir: number): void {
    this.burst(x, y, 8, { speed: 150, lifeMs: 300, size: 2.8, color: '#7de3ff', dir, spread: 1.8 });
  }

  pickupGlow(x: number, y: number, color: string): void {
    this.ring(x, y, 34, 360, color);
  }

  update(dtMs: number): void {
    this.particles = this.particles.filter((p) => {
      p.lifeMs -= dtMs;
      p.x += p.vx * (dtMs / 1000);
      p.y += p.vy * (dtMs / 1000);
      p.vx *= 0.96;
      p.vy *= 0.96;
      return p.lifeMs > 0;
    });
    this.rings = this.rings.filter((r) => {
      r.lifeMs -= dtMs;
      r.r = r.maxR * (1 - r.lifeMs / r.maxLifeMs);
      return r.lifeMs > 0;
    });
  }

  draw(ctx: CanvasRenderingContext2D, toScreen: (x: number, y: number) => [number, number], dpr: number): void {
    for (const r of this.rings) {
      const [sx, sy] = toScreen(r.x, r.y);
      const alpha = r.lifeMs / r.maxLifeMs;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath();
      ctx.arc(sx, sy, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const p of this.particles) {
      const [sx, sy] = toScreen(p.x, p.y);
      const alpha = Math.max(0, p.lifeMs / p.maxLifeMs);
      ctx.globalAlpha = alpha;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8 * dpr;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.5, p.size * dpr * alpha), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }
}
