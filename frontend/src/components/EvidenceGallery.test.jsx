import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EvidenceImage, { evidenceUrl, isImageEvidence } from './EvidenceImage.jsx';
import EvidenceGallery from './EvidenceGallery.jsx';

const photo = { id: 1, file_url: '/api/evidences/1/download', file_type: 'image/jpeg', file_name: 'problema.jpg', file_size: 34000 };
const document = { id: 2, file_url: '/api/evidences/2/download', file_type: 'application/pdf', file_name: 'informe.pdf', file_size: 20480 };
afterEach(() => vi.unstubAllGlobals());

describe('clasificación de evidencia fotográfica', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', ' IMAGE/PNG; charset=utf-8 '])('admite MIME de imagen autorizado %s', type => {
    expect(isImageEvidence({ file_type: type })).toBe(true);
  });
  it.each(['image/svg+xml', 'image/gif', 'text/html', 'application/pdf', undefined])('no confunde %s con una fotografía', type => {
    expect(isImageEvidence({ file_name: 'foto.png', file_type: type })).toBe(false);
  });
  it('obtiene un endpoint privado desde ID y conserva la URL explícita para su validación', () => {
    expect(evidenceUrl({ id: 3 })).toBe('/api/evidences/3/download');
    expect(evidenceUrl({ id: '../auth' })).toBe('');
    expect(evidenceUrl({ id: 1, file_url: 'https://untrusted.test' })).toBe('https://untrusted.test');
  });
});

describe('galería de evidencias', () => {
  it('conserva el mensaje vacío de cada etapa sin imágenes inventadas', () => {
    const markup = renderToStaticMarkup(<EvidenceGallery items={[]} emptyMessage="No hay evidencia de solución." />);
    expect(markup).toContain('No hay evidencia de solución.'); expect(markup).not.toContain('<img'); expect(markup).not.toContain('<button');
  });
  it('separa fotografías y PDF, con acciones accesibles de ampliar, abrir y descargar', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const markup = renderToStaticMarkup(<EvidenceGallery items={[photo, document]} label="Evidencia inicial" />);
    expect(markup).toContain('aria-label="Ampliar problema.jpg"');
    expect(markup).not.toContain('Ampliar informe.pdf');
    expect(markup).toContain('Documento PDF');
    expect(markup).toContain('aria-label="Abrir informe.pdf"'); expect(markup).toContain('aria-label="Descargar informe.pdf"');
    expect(markup).not.toContain('src="/api/'); expect(markup).not.toContain('href="/api/');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('mantiene cada fotografía navegable por teclado sin mezclar el botón de descarga en el de vista previa', () => {
    const second = { ...photo, id: 3, file_url: '/api/evidences/3/download', file_name: 'solucion.png', file_type: 'image/png' };
    const markup = renderToStaticMarkup(<EvidenceGallery items={[photo, second]} />);
    expect(markup.match(/class="evidence-photo-preview"/g)).toHaveLength(2);
    expect(markup.match(/aria-label="Descargar /g)).toHaveLength(2);
    const previewButtons = markup.match(/<button class="evidence-photo-preview"[\s\S]*?<\/button>/g);
    for (const button of previewButtons) expect(button.match(/<button/g)).toHaveLength(1);
  });
  it('no utiliza una URL de archivo privado como src antes de la lectura autenticada', () => {
    const markup = renderToStaticMarkup(<EvidenceImage evidence={photo} alt="Fuga bajo el lavamanos" />);
    expect(markup).toContain('Cargando fotografía'); expect(markup).not.toContain('src=');
  });
  it('muestra un fallback controlado para contenido que no puede presentarse como imagen', () => {
    const markup = renderToStaticMarkup(<EvidenceImage evidence={document} alt="Documento" />);
    expect(markup).toContain('Vista previa no disponible'); expect(markup).not.toContain('<img');
    const custom = renderToStaticMarkup(<EvidenceImage evidence={null} fallback={<span>Sin fotografía</span>} />);
    expect(custom).toContain('Sin fotografía'); expect(custom).not.toContain('<img');
  });
});
