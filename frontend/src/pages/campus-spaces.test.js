import { describe, expect, it } from 'vitest';
import { campusDirectory, incidentReportUrl, reportLocationFromSearch, reportSpaces, spacesInRegion } from './campus-spaces.js';

describe('espacios internos por edificio', () => {
  it('separa edificios sin adivinar asociaciones por nombre o zona', () => {
    const spaces = [{ id: 1, name: 'Oficina', zone: 'Administrativo', campus_region_id: null }, { id: 2, name: 'Salón 10', campus_region_id: 'bloques-salones' }, { id: 3, name: 'Salón 2', campus_region_id: 'bloques-salones' }, { id: 4, name: 'Oficina', campus_region_id: 'administrativo' }];
    expect(spacesInRegion(spaces, 'bloques-salones').map(space => space.id)).toEqual([3, 2]);
    expect(spacesInRegion(spaces, 'administrativo').map(space => space.id)).toEqual([4]);
    expect(spacesInRegion(spaces, 'preescolar')).toEqual([]);
    expect(spacesInRegion(spaces, null)).toEqual([]);
  });
});

describe('directorio del campus y ubicación del reporte', () => {
  const regions = [{ id: 'bloque-1', label: 'Edificio Biblioteca' }, { id: 'bloque-2', label: 'Edificio Artes' }];
  const spaces = [
    { id: 1, name: 'Salón 201', zone: 'Segundo piso', campus_region_id: 'bloque-1', active: true },
    { id: 2, name: 'Salón 201', zone: 'Segundo piso', campus_region_id: 'bloque-2', active: 'true' },
    { id: 3, name: 'Baño antiguo', zone: 'Piso 1', campus_region_id: 'bloque-1', active: false },
    { id: 4, name: 'Oficina', zone: 'Sin vincular', campus_region_id: null, active: true },
    { id: 5, name: 'Pasillo compartido', zone: 'Patio', campus_region_id: 'bloques-salones', active: true },
  ];

  it('muestra espacios bajo su bloque exacto, mantiene archivos y conserva los anteriores en el grupo legado', () => {
    const entries = campusDirectory(regions, spaces);
    expect(entries.find(item => item.id === 'bloque-1').spaces.map(item => item.id)).toEqual([3, 1]);
    expect(entries.find(item => item.id === 'bloque-2').spaces.map(item => item.id)).toEqual([2]);
    expect(entries.find(item => item.legacy).spaces.map(item => item.id)).toEqual([5]);
    expect(entries.flatMap(item => item.spaces).some(item => item.id === 4)).toBe(false);
  });

  it('incorpora una ubicación añadida sin recargar el catálogo y busca por nombre o piso', () => {
    const newSpace = { id: 6, name: 'Laboratorio', zone: 'Ala oeste', campus_region_id: 'bloque-2', active: true };
    const entries = campusDirectory(regions, [...spaces, newSpace], 'oeste');
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('bloque-2');
    expect(entries[0].spaces.map(item => item.id)).toEqual([6]);
    expect(entries[0].totalSpaces).toBe(2);
    expect(campusDirectory(regions, spaces, 'Edificio Biblioteca')[0].spaces).toHaveLength(2);
  });

  it('construye el enlace del formulario existente y conserva edificio y espacio', () => {
    const url = incidentReportUrl('bloque-1', 1);
    expect(url).toBe('/incidencias/nueva?campus_region_id=bloque-1&space_id=1');
    expect(reportLocationFromSearch(url.split('?')[1], spaces)).toEqual({ regionId: 'bloque-1', spaceId: '1', warning: '' });
    expect(incidentReportUrl('bloque-2')).toBe('/incidencias/nueva?campus_region_id=bloque-2');
    expect(reportLocationFromSearch('space_id=2', spaces)).toEqual({ regionId: 'bloque-2', spaceId: '2', warning: '' });
  });

  it('rechaza enlaces cruzados, edificios desconocidos, espacios borrados o archivados sin seleccionar otra ubicación', () => {
    for (const query of ['campus_region_id=bloque-2&space_id=1', 'campus_region_id=bloque-1&space_id=3', 'campus_region_id=bloque-1&space_id=999', 'campus_region_id=desconocido&space_id=1']) {
      const location = reportLocationFromSearch(query, spaces);
      expect(location.spaceId).toBe('');
      expect(location.warning).toBeTruthy();
    }
    expect(reportLocationFromSearch('campus_region_id=desconocido', spaces).regionId).toBe('');
    expect(reportLocationFromSearch('space_id=4', spaces)).toEqual({ regionId: '', spaceId: '4', warning: '' });
  });

  it('filtra únicamente espacios activos sin mezclar los bloques y permite los no vinculados en la vista completa', () => {
    expect(reportSpaces(spaces, 'bloque-1').map(item => item.id)).toEqual([1]);
    expect(reportSpaces(spaces, 'bloque-2').map(item => item.id)).toEqual([2]);
    expect(reportSpaces(spaces, '').some(item => item.id === 4)).toBe(true);
    expect(reportSpaces(spaces, 'preescolar')).toEqual([]);
  });
});
