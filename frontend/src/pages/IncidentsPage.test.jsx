import { describe, expect, it } from 'vitest';
import { filterIncidents } from './IncidentsPage.jsx';

const incidents = [
  { id: 1, code: 'MT-2026-001', description: 'Fuga bajo el lavamanos', problem_type: 'PLOMERIA', status: 'PENDING', priority: 'ALTA', assigned_person_id: null, assigned_person_name: null, space_id: 1, space_name: 'Baño Bloque A', space_zone: 'Bloque A' },
  { id: 2, code: 'MT-2026-002', description: 'Revisar la luminaria del tablero', problem_type: 'ILUMINACION', status: 'CLOSED', priority: 'MEDIA', assigned_person_id: 1, assigned_person_name: 'Carlos Rodríguez', space_id: 2, space_name: 'Salón 101', space_zone: 'Bloque A' },
  { id: 3, code: 'MT-2026-003', description: 'Cambiar candado de la puerta principal', problem_type: 'INFRAESTRUCTURA', status: 'ASSIGNED', priority: 'ALTA', assigned_person_id: 2, assigned_person_name: 'Pedro Gómez', space_id: 4, space_name: 'Portería', space_zone: 'Exteriores' },
];

describe('filtros de la vista de incidencias', () => {
  it('combina estado, prioridad, responsable y espacio sin ocultar casos cerrados del registro general', () => {
    expect(filterIncidents(incidents)).toEqual(incidents);
    expect(filterIncidents(incidents, { status: 'ASSIGNED', priority: 'ALTA', person: '2', space: '4' }).map((i) => i.id)).toEqual([3]);
    expect(filterIncidents(incidents, { status: 'CLOSED' }).map((i) => i.id)).toEqual([2]);
    expect(filterIncidents(incidents, { status: 'ASSIGNED', person: '1' })).toEqual([]);
  });

  it.each([[' mt-2026-003 ', 3], ['CANDADO', 3], ['portería', 3], ['exteriores', 3], ['pedro gómez', 3], ['plomería', 1]])('busca %s en los datos del caso', (search, id) => {
    expect(filterIncidents(incidents, { search }).map((i) => i.id)).toEqual([id]);
  });

  it('mantiene una búsqueda combinada dentro del estado seleccionado', () => {
    expect(filterIncidents(incidents, { status: 'PENDING', search: 'candado' })).toEqual([]);
    expect(filterIncidents(incidents, { status: 'PENDING', search: 'lavamanos', space: '1' }).map((i) => i.id)).toEqual([1]);
  });
});
