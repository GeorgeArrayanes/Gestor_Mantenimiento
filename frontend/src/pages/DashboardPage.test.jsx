import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage.jsx';

vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: { name: 'Administrador' } }) }));

describe('cabecera del dashboard', () => {
  it('presenta el estado general y la bienvenida sin repetir Nueva incidencia del topbar', () => {
    const markup = renderToStaticMarkup(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(markup).toContain('Hola, Administrador.');
    expect(markup).toContain('Estado general del colegio');
    expect(markup).not.toContain('Nueva incidencia');
    expect(markup).not.toContain('href="/incidencias/nueva"');
  });
});
