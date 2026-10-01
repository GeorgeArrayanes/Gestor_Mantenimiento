import { describe, expect, it } from 'vitest';
import { formatDate, isPdfResource, parseDateValue } from './formatters.js';

describe('formato de fechas y recursos', () => {
  it('acepta fechas SQL e ISO sin mostrar Invalid Date', () => {
    expect(parseDateValue('2026-01-18')).toBeInstanceOf(Date);
    expect(parseDateValue('2026-01-18T00:00:00.000Z')).toBeInstanceOf(Date);
    expect(parseDateValue('2026-01-18').getDate()).toBe(18);
    expect(parseDateValue(new Date('invalid'))).toBeNull();
    expect(formatDate('fecha-rota')).toBe('Fecha no disponible');
  });

  it('detecta PDF por MIME o por extensión antes de la query', () => {
    expect(isPdfResource({ file_type: 'application/pdf' })).toBe(true);
    expect(isPdfResource('https://files.test/reporte.PDF?token=1')).toBe(true);
    expect(isPdfResource('https://files.test/foto.webp')).toBe(false);
    expect(isPdfResource(null)).toBe(false);
  });
});
