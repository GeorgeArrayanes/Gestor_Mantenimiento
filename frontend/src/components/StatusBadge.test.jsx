import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge.jsx';

describe('estados accesibles de mantenimiento', () => {
  it.each([['PENDING', 'Pendiente'], ['ASSIGNED', 'Asignada'], ['CLOSED', 'Cerrada'], ['INACTIVO', 'Inactivo']])('presenta %s mediante texto legible', (value, label) => {
    const markup = renderToStaticMarkup(<StatusBadge value={value} />);
    expect(markup).toContain(`status-${value}`);
    expect(markup).toContain(label);
  });

  it.each([['ALTA', 'Alta'], ['MEDIA', 'Media'], ['BAJA', 'Baja']])('identifica prioridad %s sin depender sólo del color', (value, label) => {
    const markup = renderToStaticMarkup(<StatusBadge value={value} urgency />);
    expect(markup).toContain(`priority-${value}`);
    expect(markup).toContain(label);
  });
});
