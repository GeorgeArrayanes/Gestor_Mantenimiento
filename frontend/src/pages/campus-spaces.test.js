import { describe, expect, it } from 'vitest';
import { spacesInRegion } from './campus-spaces.js';

describe('espacios internos por edificio', () => {
  it('separa edificios sin adivinar asociaciones por nombre o zona', () => {
    const spaces = [{ id: 1, name: 'Oficina', zone: 'Administrativo', campus_region_id: null }, { id: 2, name: 'Salón 10', campus_region_id: 'bloques-salones' }, { id: 3, name: 'Salón 2', campus_region_id: 'bloques-salones' }, { id: 4, name: 'Oficina', campus_region_id: 'administrativo' }];
    expect(spacesInRegion(spaces, 'bloques-salones').map(space => space.id)).toEqual([3, 2]);
    expect(spacesInRegion(spaces, 'administrativo').map(space => space.id)).toEqual([4]);
    expect(spacesInRegion(spaces, 'preescolar')).toEqual([]);
    expect(spacesInRegion(spaces, null)).toEqual([]);
  });
});
