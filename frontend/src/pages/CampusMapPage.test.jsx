import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CampusMapPage from './CampusMapPage.jsx';
import { canSelectMapRegion, getRegionDemo, moveMapGesture, summarizeDemo, validateMapRegions } from './campus-map-demo.js';

describe('prototipo interactivo del campus', () => {
  it('distingue un clic de un arrastre incluso al volver al origen', () => {
    const start = { x: 10, y: 10, moved: false };
    expect(canSelectMapRegion(moveMapGesture(start, 12, 12))).toBe(true);
    const dragged = moveMapGesture(start, 35, 20);
    expect(canSelectMapRegion(dragged)).toBe(false);
    expect(canSelectMapRegion(moveMapGesture(dragged, 10, 10))).toBe(false);
    expect(canSelectMapRegion({ moved: false, suppressUntil: 300 }, 200)).toBe(false);
  });

  it('cuenta solo estados reales del sistema y conserva las zonas vacías', () => {
    expect(summarizeDemo(getRegionDemo('administrativo').incidents)).toEqual({ PENDING: 1, ASSIGNED: 1, CLOSED: 1 });
    expect(getRegionDemo('gym')).toEqual({ spaces: [], incidents: [] });
    expect(summarizeDemo(getRegionDemo('bachillerato').incidents)).toEqual({ PENDING: 0, ASSIGNED: 0, CLOSED: 0 });
  });

  it('rechaza coordenadas incompatibles o identificadores duplicados', () => {
    const region = { id: 'admin', label: 'Administrativo', path: 'M0 0L1 0L1 1Z' };
    expect(validateMapRegions({ width: 3200, height: 2200, regions: [region] }).regions).toHaveLength(1);
    expect(() => validateMapRegions({ width: 1600, height: 1100, regions: [region] })).toThrow();
    expect(() => validateMapRegions({ width: 3200, height: 2200, regions: [region, region] })).toThrow();
  });

  it('ofrece carga accesible y selección de espacios sin cargar incidencias', () => {
    const markup = renderToStaticMarkup(<CampusMapPage />);
    expect(markup).toContain('Mapa del colegio');
    expect(markup).toContain('Espacios del campus');
    expect(markup).toContain('espacios internos');
    expect(markup).toContain('Preparando el campus');
    expect(markup).not.toContain('href="/incidencias');
  });
});
