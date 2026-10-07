import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import IncidentCard, { incidentContact, incidentThumbnail, whatsappDestination } from './IncidentCard.jsx';

const incident = { id: 3, code: 'MT-2026-003', created_at: '2026-10-01T20:10:52.217Z', problem_type: 'INFRAESTRUCTURA', description: 'Se dañó el candado de la puerta principal', space_name: 'Portería', space_zone: 'Exteriores', status: 'ASSIGNED', priority: 'ALTA', assigned_person_id: 2, assigned_person_name: 'Pedro Gómez', assigned_person_phone: '+57 300 111 2233', assigned_person_current_phone: '+57 300 555 2222' };

describe('miniatura de evidencia en el registro', () => {
  const evidence = { id: 9, file_name: 'puerta.webp', file_type: 'image/webp', file_size: 640, category: 'INITIAL', file_url: '/api/evidences/9/download' };

  it('elige exclusivamente la evidencia inicial fotográfica entregada por el listado', () => {
    expect(incidentThumbnail({ ...incident, initial_evidence: evidence })).toBe(evidence);
    expect(incidentThumbnail(incident)).toBeNull();
    expect(incidentThumbnail({ ...incident, initial_evidence: null })).toBeNull();
    expect(incidentThumbnail({ ...incident, initial_evidence: { ...evidence, file_type: 'application/pdf' } })).toBeNull();
    expect(incidentThumbnail({ ...incident, initial_evidence: { ...evidence, category: 'FINAL' } })).toBeNull();
  });

  it('utiliza el componente privado sin exponer el endpoint como src y mantiene la navegación al caso', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><IncidentCard incident={{ ...incident, initial_evidence: evidence }} /></MemoryRouter>);
    expect(markup).toContain('incident-card-evidence');
    expect(markup).toContain('incident-card-case-title');
    expect(markup).toContain(incident.description);
    expect(markup).toContain('aria-label="Ver incidencia MT-2026-003"');
    expect(markup).not.toContain('src="/api/evidences/9/download"');
  });

  it('mantiene un fallback contextual sin fotografía y conserva el dashboard compacto sin miniatura', () => {
    const full = renderToStaticMarkup(<MemoryRouter><IncidentCard incident={incident} /></MemoryRouter>);
    expect(full).toContain('incident-card-placeholder--infraestructura');
    expect(full).not.toContain('<img');
    const compact = renderToStaticMarkup(<MemoryRouter><IncidentCard incident={{ ...incident, initial_evidence: evidence }} compact /></MemoryRouter>);
    expect(compact).not.toContain('incident-card-media');
    expect(compact).not.toContain('incident-card-evidence');
    expect(compact).toContain('incident-card--compact');
  });
});

describe('contacto aplicable a una incidencia', () => {
  it('usa el teléfono actual para una asignación abierta', () => {
    expect(incidentContact(incident)).toEqual({ phone: '573005552222', name: 'Pedro Gómez' });
    expect(incidentContact({ ...incident, assigned_person_current_phone: undefined }).phone).toBe('573001112233');
  });

  it.each([
    { status: 'PENDING' }, { status: 'CLOSED' }, { assigned_person_id: null },
    { assigned_person_name: null }, { assigned_person_current_phone: 'sin teléfono' },
    { assigned_person_current_phone: '' },
  ])('omite contacto si la asignación o el teléfono no lo permiten: %j', (changes) => {
    expect(incidentContact({ ...incident, ...changes })).toBeNull();
  });

  it('ofrece el detalle y enlaces utilizables sin convertir la tarjeta en una acción de envío', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><IncidentCard incident={incident} /></MemoryRouter>);
    expect(markup).toContain('href="/incidencias/3"');
    expect(markup).toContain('href="tel:+573005552222"');
    expect(markup).toContain('Preparar WhatsApp para Pedro Gómez');
    expect(markup).toContain('Infraestructura');
    expect(markup).toContain('Portería');
    expect(markup).not.toContain('href="https://wa.me/');
  });

  it('mantiene el acceso al caso cerrado y omite acciones de contacto, también en modo compacto', () => {
    for (const props of [{ incident: { ...incident, status: 'CLOSED' } }, { incident, compact: true }]) {
      const markup = renderToStaticMarkup(<MemoryRouter><IncidentCard {...props} /></MemoryRouter>);
      expect(markup).toContain('Ver incidencia');
      expect(markup).not.toContain('href="tel:');
      expect(markup).not.toContain('Preparar WhatsApp');
    }
  });
});

describe('destino de WhatsApp preparado por el servidor', () => {
  it('acepta solamente un destino seguro y completo', () => {
    const url = 'https://wa.me/573005552222?text=Incidencia%20de%20mantenimiento';
    expect(whatsappDestination(url)).toBe(url);
  });

  it.each(['javascript:alert(1)', 'http://wa.me/573005552222?text=Hola', 'https://wa.me.ejemplo.com/573005552222?text=Hola', 'https://wa.me/abc?text=Hola', 'https://wa.me/573005552222', 'https://user:password@wa.me/573005552222?text=Hola', 'https://wa.me:8443/573005552222?text=Hola'])('rechaza %s', (value) => {
    expect(() => whatsappDestination(value)).toThrow();
  });
});
