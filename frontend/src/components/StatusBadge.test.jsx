import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge.jsx';

describe('StatusBadge', () => {
  it('presenta estados y urgencias con texto comprensible', () => {
    const status = renderToStaticMarkup(<StatusBadge value="PENDIENTE_VALIDACION" />);
    expect(status).toContain('status-PENDIENTE_VALIDACION');
    expect(status).toContain('Por validar');
    const urgency = renderToStaticMarkup(<StatusBadge value="ALTA" urgency />);
    expect(urgency).toContain('urgency-ALTA');
    expect(urgency).toContain('ALTA');
    const account = renderToStaticMarkup(<StatusBadge value="INACTIVO" />);
    expect(account).toContain('status-INACTIVO');
    expect(account).toContain('Inactivo');
  });
});
