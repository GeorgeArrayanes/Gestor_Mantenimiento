import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import CampusSpacesPanel from './CampusSpacesPanel.jsx';
import CampusDirectory from './CampusDirectory.jsx';
import { campusDirectory } from './campus-spaces.js';

const regions = [{ id: 'bloque-1', label: 'Edificio Biblioteca' }, { id: 'bloque-2', label: 'Edificio Artes' }];
const spaces = [
  { id: 11, name: 'Salón 101', zone: 'Primer piso', campus_region_id: 'bloque-1', active: true },
  { id: 12, name: 'Baño norte', zone: 'Piso 2', campus_region_id: 'bloque-1', active: false },
  { id: 21, name: 'Salón 201', zone: 'Segundo piso', campus_region_id: 'bloque-2', active: 'true' },
];
const noop = () => {};
function panel(region, selectedSpaceId = '', data = spaces) {
  return renderToStaticMarkup(<MemoryRouter><CampusSpacesPanel region={region} spaces={data} selectedSpaceId={selectedSpaceId} onSelectSpace={noop} onClear={noop} onReload={noop} onCreated={noop} /></MemoryRouter>);
}

describe('acciones de edificio y directorio', () => {
  it('permite reportar un edificio y conserva la selección exacta del espacio desde el directorio', () => {
    expect(panel(regions[0])).toContain('href="/incidencias/nueva?campus_region_id=bloque-1"');
    const selected = panel(regions[0], '11');
    expect(selected).toContain('href="/incidencias/nueva?campus_region_id=bloque-1&amp;space_id=11"');
    expect(selected).toContain('value="11" selected=""');
    expect(selected).toContain('El reporte se registrará en Salón 101.');
    const sameBuildingOtherSpace = panel(regions[0], '12');
    expect(sameBuildingOtherSpace).toContain('value="12" selected=""');
    expect(sameBuildingOtherSpace).toContain('Este espacio está archivado');
  });

  it('no permite reportar espacios archivados ni edificios vacíos y nunca usa otro edificio como respaldo', () => {
    const archived = panel(regions[0], '12');
    expect(archived).not.toContain('href="/incidencias/nueva');
    expect(archived).toContain('Reportar incidencia');
    expect(archived).toContain('disabled=""');
    const empty = panel(regions[1], '', spaces.filter(space => space.campus_region_id !== 'bloque-2'));
    expect(empty).not.toContain('href="/incidencias/nueva');
    expect(empty).toContain('Añade un espacio activo');
    expect(panel(regions[1], '11')).not.toContain('space_id=11');
  });

  it('renderiza listas nativas y la selección de un espacio sin cargar fotografías', () => {
    const markup = renderToStaticMarkup(<CampusDirectory entries={campusDirectory(regions, spaces)} count={2} mapReady query="" onQuery={noop} selectedRegion="bloque-1" selectedSpaceId="11" onSelect={noop} onReload={noop} />);
    expect(markup).toContain('<details');
    expect(markup).toContain('2 espacios internos');
    expect(markup).toContain('Seleccionar Salón 101 en Edificio Biblioteca');
    expect(markup).toContain('Seleccionar Salón 201 en Edificio Artes');
    expect(markup).toContain('Piso 2 · Archivado');
    expect(markup).toContain('aria-pressed="true" aria-label="Seleccionar Salón 101');
    expect(markup).not.toContain('<img');
  });
});
