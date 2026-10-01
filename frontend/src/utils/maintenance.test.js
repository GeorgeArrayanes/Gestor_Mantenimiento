import { describe, expect, it } from 'vitest';
import { evidenceError, formatAverageResolutionHours, formatDate, normalizePhone, problemLabel, sortIncidents } from './maintenance.js';

describe('utilidades de mantenimiento', () => {
  it.each([
    [null, '—'], [undefined, '—'],
    [0, '< 1 h'], [0.00001, '< 1 h'], [0.04, '< 1 h'], [0.9999, '< 1 h'],
    [1, '1 h'], [1.04, '1 h'], [1.05, '1,1 h'], [2.44, '2,4 h'], ['2.4', '2,4 h'],
    [1234.56, '1.234,6 h'], [-1, '—'], [NaN, '—'], [Infinity, '—'], ['', '—'], ['sin datos', '—'],
  ])('presenta el promedio %s sin confundir una reparación rápida con ausencia de datos', (value, expected) => {
    expect(formatAverageResolutionHours(value)).toBe(expected);
  });
  it('muestra problemas en el lenguaje del colegio', () => {
    expect(problemLabel('PLOMERIA')).toBe('Plomería');
    expect(problemLabel('ILUMINACION')).toBe('Iluminación');
    expect(problemLabel('OTRO')).toBe('Otro');
  });

  it.each([
    ['300 222 3344', '573002223344'], ['+57 (300) 222-3344', '573002223344'],
    ['0057 300 222 3344', '573002223344'], ['573002223344', '573002223344'],
    ['+1 202 555 0123', '12025550123'], ['0044 7700 900123', '447700900123'],
    ['601 555 1234', '576015551234'], ['+30 0222 3344', '3002223344'],
    ['sin teléfono', ''], ['', ''], ['123', ''], ['3002223344 ext 9', '']
  ])('normaliza %s respetando un código internacional existente', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('presenta la hora de Colombia y maneja fechas inválidas', () => {
    expect(formatDate('2026-10-01T03:00:00Z')).toMatch(/30.*(?:09|sep)/i);
    expect(formatDate('fecha-rota')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });

  it('explica límites y exige una foto final sin impedir documentos iniciales', () => {
    const photo = { name: 'foto.png', type: 'image/png', size: 100 };
    const document = { name: 'acta.pdf', type: 'application/pdf', size: 100 };
    expect(evidenceError([photo], true)).toBe('');
    expect(evidenceError([document])).toBe('');
    expect(evidenceError([document], true)).toMatch(/foto/i);
    expect(evidenceError([], true)).toMatch(/foto/i);
    expect(evidenceError(Array(6).fill(photo))).toMatch(/5/);
    expect(evidenceError([{ ...photo, size: 5 * 1024 * 1024 + 1 }])).toMatch(/5 MB/);
    expect(evidenceError([{ ...photo, size: 0 }])).toMatch(/1 byte/);
    expect(evidenceError([{ ...photo, type: 'image/svg+xml' }])).toMatch(/JPG.*PNG.*WEBP.*PDF/);
  });

  it('pone las incidencias activas y urgentes primero sin modificar la colección recibida', () => {
    const rows = [
      { id: 1, status: 'CLOSED', priority: 'ALTA', created_at: '2026-10-01' },
      { id: 2, status: 'ASSIGNED', priority: 'BAJA', created_at: '2026-09-01' },
      { id: 3, status: 'PENDING', priority: 'ALTA', created_at: '2026-10-01' },
      { id: 4, status: 'PENDING', priority: 'ALTA', created_at: '2026-10-02' }
    ];
    expect(sortIncidents(rows).map((row) => row.id)).toEqual([4, 3, 2, 1]);
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3, 4]);
  });
});
