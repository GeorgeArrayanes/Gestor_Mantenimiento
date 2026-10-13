import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PersonnelCard from './PersonnelCard.jsx';

const person = { id: 7, name: 'María Torres', specialty: 'Plomería', phone: '+57 300 123 4567', active: true };

describe('perfil del personal', () => {
  it('presenta los datos reales y diferencia carga actual de resoluciones', () => {
    const markup = renderToStaticMarkup(<PersonnelCard person={{ ...person, assigned_count: 3, resolved_count: 12 }} onEdit={() => {}} />);
    expect(markup).toContain('María Torres');
    expect(markup).toContain('Plomería');
    expect(markup).toContain('+57 300 123 4567');
    expect(markup).toContain('<dt>Asignados</dt><dd>3</dd>');
    expect(markup).toContain('<dt>Resueltos</dt><dd>12</dd>');
    expect(markup).toContain('Editar perfil de María Torres');
    expect(markup).toContain('Sin fotografía');
  });

  it('mantiene cero en ambos contadores y el estado inactivo cuando corresponde', () => {
    const markup = renderToStaticMarkup(<PersonnelCard person={{ ...person, active: false, assigned_count: 0, resolved_count: 0 }} onEdit={() => {}} />);
    expect(markup).toContain('<dt>Asignados</dt><dd>0</dd>');
    expect(markup).toContain('<dt>Resueltos</dt><dd>0</dd>');
    expect(markup).toContain('Inactivo');
    expect(markup).not.toContain('>Activo<');
  });
});
