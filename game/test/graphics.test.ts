import { describe, expect, it } from 'vitest';
import {
  QUALITY_PRESETS,
  normalizeQuality,
  timeOfDay,
  damageAngle,
  RARITY_COLORS,
  rarityColor,
  gridLabel,
  canvasFilter,
} from '../src/shared/graphics.js';
import { WORLD_RADIUS } from '../src/shared/constants.js';

describe('gráficos y entorno v1.3.0', () => {
  it('define 4 presets de calidad con objetivos de FPS crecientes', () => {
    expect(Object.keys(QUALITY_PRESETS)).toEqual(['baja', 'media', 'alta', 'ultra']);
    expect(QUALITY_PRESETS.baja.fpsTarget).toBe(30);
    expect(QUALITY_PRESETS.ultra.fpsTarget).toBeGreaterThanOrEqual(90);
    expect(QUALITY_PRESETS.ultra.particles).toBeGreaterThan(QUALITY_PRESETS.baja.particles);
    expect(QUALITY_PRESETS.ultra.dprCap).toBeGreaterThan(QUALITY_PRESETS.baja.dprCap);
  });

  it('normaliza nombres antiguos de calidad', () => {
    expect(normalizeQuality('bajo')).toBe('baja');
    expect(normalizeQuality('alto')).toBe('ultra');
    expect(normalizeQuality('media')).toBe('media');
    expect(normalizeQuality(undefined)).toBe('media');
    expect(normalizeQuality('no-existe')).toBe('media');
  });

  it('el ciclo día-noche recorre las 4 fases', () => {
    const fases = new Set<string>();
    for (let ms = 0; ms < 8 * 60_000; ms += 30_000) fases.add(timeOfDay(ms).phase);
    expect([...fases].sort()).toEqual(['amanecer', 'atardecer', 'dia', 'noche']);
    expect(timeOfDay(0).phase).toBe('dia');
  });

  it('damageAngle apunta hacia el atacante y respeta la mira', () => {
    expect(damageAngle(10, 0, 0, 0, 0)).toBeCloseTo(-Math.PI / 2);
    expect(damageAngle(0, 10, 0, 0, 0)).toBeCloseTo(0);
    expect(damageAngle(10, 0, 0, 0, Math.PI / 2)).toBeCloseTo(-Math.PI);
  });

  it('rareza con 6 colores y soporte daltónico', () => {
    expect(Object.keys(RARITY_COLORS)).toHaveLength(6);
    expect(rarityColor('comun')).toMatch(/#/);
    expect(rarityColor('mitico')).not.toBe(rarityColor('comun'));
    expect(rarityColor('raro', 'deuteranopia')).toBe(rarityColor('raro', 'protanopia'));
    expect(rarityColor('inexistente')).toBe(rarityColor('comun'));
  });

  it('gridLabel usa cuadrícula A1-H8 dentro del mundo', () => {
    expect(gridLabel(0, 0, WORLD_RADIUS)).toMatch(/^[A-H][1-8]$/);
    expect(gridLabel(-WORLD_RADIUS, -WORLD_RADIUS, WORLD_RADIUS)).toBe('A1');
    expect(gridLabel(WORLD_RADIUS, WORLD_RADIUS, WORLD_RADIUS)).toBe('H8');
  });

  it('filtros de color generan CSS válido', () => {
    expect(canvasFilter(1, 'off')).toBe('none');
    expect(canvasFilter(1, 'bn')).toContain('grayscale');
    expect(canvasFilter(1.2, 'calido')).toContain('sepia');
  });
});
