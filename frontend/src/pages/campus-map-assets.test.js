import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAMPUS_REGIONS } from '../../../shared/campus-regions.mjs';
import { validateMapRegions } from './campus-map-demo.js';

describe('activos del mapa publicado', () => {
  it('mantiene cada bloque en una selección propia y coincide con el catálogo de edificios', () => {
    const payload = JSON.parse(fs.readFileSync(new URL('../../public/campus-map/regions.json', import.meta.url), 'utf8'));
    const regions = validateMapRegions(payload).regions;
    expect(regions.map(region => region.id).sort()).toEqual(CAMPUS_REGIONS.filter(region => !region.legacy).map(region => region.id).sort());
    expect(payload.selectionRevision).toBe(2);
    const blockIds = ['bloque-1', 'bloque-2', 'bloque-3', 'bloque-4', 'bloque-atravesado'];
    const blocks = blockIds.map(id => regions.find(region => region.id === id));
    expect(blocks.every(Boolean)).toBe(true);
    expect(new Set(blocks.map(region => region.path)).size).toBe(5);
    expect(new Set(blocks.flatMap(region => region.sourceRegions)).size).toBe(5);
    expect(regions.some(region => region.id === 'bloques-salones')).toBe(false);
  });
});
