import { useEffect, useRef, useState } from 'react';
import { ImageOff, Image as ImageIcon } from 'lucide-react';
import { fetchEvidenceBlob } from '../api.js';
import './evidence-gallery.css';

export function isImageEvidence(evidence) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(String(evidence?.file_type || '').split(';')[0].trim().toLowerCase());
}

export function evidenceUrl(evidence) {
  if (evidence?.file_url) return evidence.file_url;
  const id = String(evidence?.id || '');
  return /^[1-9]\d*$/.test(id) ? `/api/evidences/${id}/download` : '';
}

export default function EvidenceImage({ evidence, alt, lazy = true, className = '', imageClassName = '', fallback }) {
  const container = useRef(null);
  const [visible, setVisible] = useState(!lazy);
  const [preview, setPreview] = useState({ key: '', source: '', phase: 'loading' });
  const url = evidenceUrl(evidence);
  const image = isImageEvidence(evidence);
  const key = `${url}|${image}`;

  useEffect(() => {
    if (!lazy || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '160px' });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [lazy]);

  useEffect(() => {
    if (!visible) return;
    if (!image || !url) { setPreview({ key, source: '', phase: 'error' }); return; }
    const controller = new AbortController();
    let source;
    setPreview({ key, source: '', phase: 'loading' });
    fetchEvidenceBlob(url, { signal: controller.signal, imageOnly: true }).then((blob) => {
      if (controller.signal.aborted) return;
      source = URL.createObjectURL(blob);
      setPreview({ key, source, phase: 'loading' });
    }).catch((error) => {
      if (!controller.signal.aborted && error.name !== 'AbortError') setPreview({ key, source: '', phase: 'error' });
    });
    return () => { controller.abort(); if (source) URL.revokeObjectURL(source); };
  }, [visible, key, image, url]);

  const current = preview.key === key ? preview : { source: '', phase: 'loading' };
  const failed = current.phase === 'error' || !image || !url;
  const loading = !failed && current.phase !== 'ready';

  return <span ref={container} className={`evidence-image ${failed ? 'is-unavailable' : loading ? 'is-loading' : 'is-ready'} ${className}`} aria-busy={loading || undefined}>
    {failed ? fallback || <span className="evidence-image-unavailable"><ImageOff size={26} aria-hidden="true" /><span>Vista previa no disponible</span></span> : <>
      {loading && <span className="evidence-image-skeleton"><ImageIcon size={27} aria-hidden="true" /><span className="visually-hidden">Cargando fotografía…</span></span>}
      {current.source && <img key={current.source} className={imageClassName} src={current.source} alt={alt || evidence?.file_name || 'Evidencia fotográfica'} loading={lazy ? 'lazy' : 'eager'} decoding="async" onLoad={() => setPreview(previous => previous.key === key ? { ...previous, phase: 'ready' } : previous)} onError={(event) => { event.currentTarget.style.visibility = 'hidden'; URL.revokeObjectURL(current.source); setPreview(previous => previous.key === key ? { key, source: '', phase: 'error' } : previous); }} />}
    </>}
  </span>;
}
