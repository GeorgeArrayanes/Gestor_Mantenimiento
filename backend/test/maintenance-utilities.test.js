import { describe, expect, it } from 'vitest';
import { buildWhatsApp, normalizePhone, parseId } from '../src/utils/maintenance.js';

describe('destino WhatsApp y referencias seguras', () => {
  it.each([
    ['300 222 3344', '573002223344'], ['+57 (300) 222-3344', '573002223344'],
    ['0057 300 222 3344', '573002223344'], ['573002223344', '573002223344'],
    ['+1 202 555 0123', '12025550123'], ['0044 7700 900123', '447700900123'],
    ['601 555 1234', '576015551234'], ['+30 0222 3344', '3002223344']
  ])('normaliza %s sin duplicar el indicativo internacional', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', 'sin teléfono', '123', '3002223344 ext 9', '+000123456'])('rechaza teléfono mal formado: %s', (input) => {
    expect(() => normalizePhone(input)).toThrow(/teléfono/);
  });

  it.each(['0', '-1', '1 OR 1=1', 'abc', '2.5', '9007199254740992'])('rechaza identificador inválido: %s', (input) => {
    expect(() => parseId(input)).toThrow(/inválido/);
  });

  it('codifica caracteres, líneas y signos reservados sin convertirlos en parámetros del enlace', () => {
    const incident = { assigned_person_id: 1, assigned_person_name: 'Carlos Rodríguez', assigned_person_phone: '+57 300 222 3344', status: 'ASSIGNED', code: 'MT-2026-001', space_name: 'Baño A', space_zone: 'Bloque A', description: 'Fuga & agua + tubería #1?\nRevisar', priority: 'ALTA' };
    const output = buildWhatsApp(incident);
    const url = new URL(output.url);
    expect(url.pathname).toBe('/573002223344');
    expect(output.message.startsWith('🔧 Nueva incidencia de mantenimiento\n\n')).toBe(true);
    expect([...url.searchParams.keys()]).toEqual(['text']);
    expect(url.searchParams.get('text')).toContain(incident.description);
    expect(url.searchParams.get('text')).toContain(incident.code);
    expect(output).not.toHaveProperty('delivered');
  });
});
