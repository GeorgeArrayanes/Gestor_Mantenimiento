import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { fetchPrivateImageBlob } from '../api.js';

export default function PrivateImage({ src, alt, className = '', imageClassName = '', fallback, lazy = true }) {
  const container = useRef(null);
  const [visible, setVisible] = useState(!lazy);
  const [preview, setPreview] = useState({ key: '', source: '', phase: 'loading' });

  useEffect(() => {
    if (!lazy || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '180px' });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [lazy]);

  useEffect(() => {
    if (!visible) return;
    if (!src) { setPreview({ key: src, source: '', phase: 'error' }); return; }
    const controller = new AbortController();
    let objectUrl;
    setPreview({ key: src, source: '', phase: 'loading' });
    fetchPrivateImageBlob(src, { signal: controller.signal }).then((blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setPreview({ key: src, source: objectUrl, phase: 'loading' });
    }).catch((error) => {
      if (!controller.signal.aborted && error.name !== 'AbortError') setPreview({ key: src, source: '', phase: 'error' });
    });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [visible, src]);

  const current = preview.key === src ? preview : { source: '', phase: 'loading' };
  const failed = !src || current.phase === 'error';
  const loading = !failed && current.phase !== 'ready';
  return <span ref={container} className={`private-image ${failed ? 'is-unavailable' : loading ? 'is-loading' : 'is-ready'} ${className}`} aria-busy={loading || undefined}>
    {failed ? fallback : <>
      {loading && <span className="private-image-skeleton"><ImageIcon size={24} aria-hidden="true" /><span className="visually-hidden">Cargando imagen…</span></span>}
      {current.source && <img className={imageClassName} src={current.source} alt={alt} loading={lazy ? 'lazy' : 'eager'} decoding="async" onLoad={() => setPreview((previous) => previous.key === src ? { ...previous, phase: 'ready' } : previous)} onError={() => setPreview({ key: src, source: '', phase: 'error' })} />}
    </>}
  </span>;
}
