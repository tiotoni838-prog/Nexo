import { describe, expect, it } from 'vitest';
import { WEAPONS, WEAPON_IDS, isWeaponId, EXPLOSION_DAMAGE, EXPLOSION_RADIUS } from '../src/shared/weapons.js';
import type { LootTier } from '../src/shared/map.js';
import { MAP_PRESETS, MAP_PRESET_IDS, isMapPresetId, generateMap } from '../src/shared/map.js';
import { GAME_VERSION, GAME_NAME } from '../src/shared/version.js';

describe('arsenal extendido', () => {
  it('tiene 24 armas con estadísticas coherentes', () => {
    expect(WEAPON_IDS).toHaveLength(24);
    for (const id of WEAPON_IDS) {
      const w = WEAPONS[id];
      expect(w.id).toBe(id);
      expect(w.damage).toBeGreaterThan(0);
      expect(w.fireIntervalMs).toBeGreaterThan(0);
      expect(w.magSize).toBeGreaterThan(0);
      expect(w.range).toBeGreaterThan(0);
    }
  });

  it('el lanzacohetes es explosivo y el resto no', () => {
    expect(WEAPONS.lanzacohetes.explosive).toBe(true);
    for (const id of WEAPON_IDS) {
      if (id !== 'lanzacohetes') expect(WEAPONS[id].explosive).toBeUndefined();
    }
    expect(EXPLOSION_DAMAGE).toBeGreaterThan(0);
    expect(EXPLOSION_RADIUS).toBeGreaterThan(0);
  });

  it('isWeaponId rechaza identificadores desconocidos', () => {
    expect(isWeaponId('fusil')).toBe(true);
    expect(isWeaponId('bazooka-fantasma')).toBe(false);
  });

  it('el arsenal cubre todas las categorías del diseño', () => {
    for (const id of ['pistola-automatica', 'pistola-pesada', 'subfusil-pesado', 'mini-subfusil', 'carabina', 'fusil-rafaga', 'fusil-pesado', 'escopeta-automatica', 'escopeta-tactica', 'cerrojo-pesado', 'francotirador-elite', 'ametralladora-pesada']) {
      expect(isWeaponId(id)).toBe(true);
    }
    expect(WEAPONS['francotirador-elite']!.damage).toBeGreaterThan(WEAPONS.francotirador.damage);
    expect(WEAPONS['cerrojo-pesado']!.damage).toBeGreaterThan(WEAPONS.francotirador.damage);
    expect(WEAPONS['ametralladora-pesada']!.magSize).toBeGreaterThan(WEAPONS.ametralladora.magSize);
    const escopetas = WEAPON_IDS.filter((id) => id.startsWith('escopeta'));
    expect(escopetas).toHaveLength(4);
  });
});

describe('mapas múltiples', () => {
  it('define 3 presets con nombres y paleta propios', () => {
    expect(MAP_PRESET_IDS).toHaveLength(3);
    for (const id of MAP_PRESET_IDS) {
      const preset = MAP_PRESETS[id];
      expect(preset.pois).toHaveLength(8);
      expect(preset.palette.ground).toMatch(/^#/);
      expect(preset.obstacleCount).toBeGreaterThan(0);
    }
  });

  it('cada preset genera un mapa distinto con el mismo seed', () => {
    const a = generateMap(42, 'nexo-urbano');
    const b = generateMap(42, 'desierto-solar');
    const c = generateMap(42, 'volcan-ceniza');
    expect(a.presetId).toBe('nexo-urbano');
    expect(b.presetId).toBe('desierto-solar');
    expect(c.presetId).toBe('volcan-ceniza');
    expect(a.pois[0]!.nameEs).not.toBe(b.pois[0]!.nameEs);
    expect(a.palette.ground).not.toBe(b.palette.ground);
    expect(JSON.stringify(a.obstacles)).not.toBe(JSON.stringify(b.obstacles));
    expect(JSON.stringify(b.obstacles)).not.toBe(JSON.stringify(c.obstacles));
    expect(a.pois).toHaveLength(8);
    expect(b.pois).toHaveLength(8);
    expect(c.pois).toHaveLength(8);
  });

  it('isMapPresetId valida identificadores', () => {
    expect(isMapPresetId('volcan-ceniza')).toBe(true);
    expect(isMapPresetId('luna')).toBe(false);
  });

  it('cada POI tiene nivel de loot y las zonas altas dan más spawns', () => {
    const tiersValidos: LootTier[] = ['alto', 'medio', 'bajo'];
    for (const id of MAP_PRESET_IDS) {
      for (const [, , tier] of MAP_PRESETS[id].pois) {
        expect(tiersValidos).toContain(tier);
      }
    }
    const mapa = generateMap(4242, 'nexo-urbano');
    const altas = mapa.pois.filter((p) => p.lootTier === 'alto');
    const bajas = mapa.pois.filter((p) => p.lootTier === 'bajo');
    expect(altas.length).toBeGreaterThan(0);
    expect(bajas.length).toBeGreaterThan(0);
    const spawnsEn = (poi: (typeof mapa.pois)[number]): number =>
      mapa.lootSpawns.filter(
        (s) => Math.hypot(s.x - poi.center.x, s.y - poi.center.y) <= poi.radius + 20,
      ).length;
    expect(spawnsEn(altas[0]!)).toBeGreaterThan(4);
  });
});

describe('versión del juego', () => {
  it('expone nombre y versión para el sistema de actualizaciones', () => {
    expect(GAME_NAME).toBe('Nexo FPS');
    expect(GAME_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
