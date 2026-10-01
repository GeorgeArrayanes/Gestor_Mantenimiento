import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import IncidentListView from './IncidentListView.jsx';

const incidents = [
  { id: 1, code: 'MT-2026-001', description: 'Fuga debajo del lavamanos', space_name: 'Baño Bloque A', space_zone: 'Bloque A', problem_type: 'PLOMERIA', priority: 'ALTA', status: 'ASSIGNED', assigned_person_name: 'Carlos Rodríguez', created_at: '2026-10-01T14:00:00Z' },
  { id: 2, code: 'MT-2026-002', description: 'Revisar iluminación de la biblioteca', space_name: 'Biblioteca', space_zone: 'Bloque B', problem_type: 'ILUMINACION', priority: 'MEDIA', status: 'PENDING', assigned_person_name: null, created_at: '2026-10-01T15:00:00Z' },
];

describe('incidencias recientes y listado compartido', () => {
  it('incluye responsable o ausencia de asignación en las siete columnas de cada registro', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><IncidentListView incidents={incidents} /></MemoryRouter>);
    const table = markup.match(/<table\b[^>]*>([\s\S]*?)<\/table>/)[1];
    expect(table).toContain('<th scope="col">Responsable</th>');
    expect(table).toContain('Carlos Rodríguez');
    expect(table).toContain('Sin asignar');
    expect(table.match(/<th\b/g)).toHaveLength(7);
    const rows = table.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].match(/<tr>[\s\S]*?<\/tr>/g);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.match(/<td\b/g)).toHaveLength(7);
  });

  it('conserva el responsable y el acceso al detalle en las tarjetas para pantallas pequeñas', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><IncidentListView incidents={incidents} /></MemoryRouter>);
    const cards = markup.slice(markup.indexOf('<div class="incident-mobile-list">'));
    expect(cards).toContain('Carlos Rodríguez');
    expect(cards).toContain('Pendiente de asignación');
    expect(cards).toContain('href="/incidencias/1"');
    expect(cards).toContain('Ver MT-2026-001: Fuga debajo del lavamanos');
  });
});
