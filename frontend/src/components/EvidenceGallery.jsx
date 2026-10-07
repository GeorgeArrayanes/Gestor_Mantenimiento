import { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Expand, ExternalLink, FileText, X } from 'lucide-react';
import { downloadEvidence, openEvidence } from '../api.js';
import EvidenceImage, { evidenceUrl, isImageEvidence } from './EvidenceImage.jsx';
import Modal from './Modal.jsx';
import './evidence-gallery.css';

function fileSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function EvidenceGallery({ items = [], emptyMessage = 'No se adjuntaron archivos en esta etapa.', label = 'Galería de evidencias' }) {
  const titleId = useId();
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState(null);
  const mounted = useRef(false);
  const pending = useRef(null);
  const evidences = Array.isArray(items) ? items.filter(Boolean) : [];
  const images = evidences.filter(isImageEvidence);
  const files = evidences.filter(item => !isImageEvidence(item));
  const current = selected === null ? null : images[selected];

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pending.current?.abort(); };
  }, []);

  async function useFile(evidence, action) {
    if (busy) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(`${action}-${evidence.id}`); setFeedback(null);
    try {
      if (action === 'open') {
        const result = await openEvidence(evidenceUrl(evidence), evidence.file_name, { signal: controller.signal });
        if (mounted.current && !controller.signal.aborted && result === 'downloaded') setFeedback({ error: false, text: 'La ventana no se pudo abrir. El archivo se descargó para que puedas consultarlo.' });
      } else await downloadEvidence(evidenceUrl(evidence), evidence.file_name, { signal: controller.signal });
    } catch (error) {
      if (mounted.current && !controller.signal.aborted && error.name !== 'AbortError') setFeedback({ error: true, text: error.message });
    } finally {
      if (mounted.current && !controller.signal.aborted) setBusy('');
      if (pending.current === controller) pending.current = null;
    }
  }

  function controls(evidence, compact = false) {
    return <span className={`evidence-file-actions${compact ? ' is-compact' : ''}`}>
      <button type="button" onClick={() => useFile(evidence, 'open')} disabled={Boolean(busy)} aria-label={`Abrir ${evidence.file_name || 'evidencia'}`} title="Abrir archivo"><ExternalLink size={15} aria-hidden="true" />{!compact && 'Abrir'}</button>
      <button type="button" onClick={() => useFile(evidence, 'download')} disabled={Boolean(busy)} aria-label={`Descargar ${evidence.file_name || 'evidencia'}`} title="Descargar archivo"><Download size={15} aria-hidden="true" />{!compact && 'Descargar'}</button>
    </span>;
  }

  function move(direction) { setSelected(index => Math.max(0, Math.min(images.length - 1, index + direction))); }

  if (!evidences.length) return <p className="no-evidence evidence-gallery-empty">{emptyMessage}</p>;

  return <div className="evidence-gallery" aria-label={label}>
    {images.length > 0 && <div className={`evidence-gallery-images${images.length === 1 ? ' has-one-image' : ''}`}>{images.map((evidence, index) => <figure className="evidence-photo" key={evidence.id}>
      <button className="evidence-photo-preview" type="button" onClick={() => { setSelected(index); setFeedback(null); }} aria-label={`Ampliar ${evidence.file_name || `fotografía ${index + 1}`}`}><EvidenceImage evidence={evidence} alt={`${label}: ${evidence.file_name || `fotografía ${index + 1}`}`} /><span className="evidence-photo-expand" aria-hidden="true"><Expand size={16} /></span></button>
      <figcaption><span className="evidence-photo-caption"><strong title={evidence.file_name}>{evidence.file_name || `Fotografía ${index + 1}`}</strong><small>{fileSize(evidence.file_size)}</small></span>{controls(evidence, true)}</figcaption>
    </figure>)}</div>}
    {files.length > 0 && <div className="evidence-gallery-files">{files.map(evidence => <article className="evidence-document" key={evidence.id}><span className="evidence-document-icon"><FileText size={25} aria-hidden="true" /></span><div className="evidence-document-copy"><strong>{evidence.file_name || 'Archivo adjunto'}</strong><small>{evidence.file_type === 'application/pdf' ? 'Documento PDF' : 'Archivo'}{fileSize(evidence.file_size) && ` · ${fileSize(evidence.file_size)}`}</small></div>{controls(evidence)}</article>)}</div>}
    {busy && <p className="evidence-gallery-feedback" role="status">Preparando archivo…</p>}
    {feedback && !current && <p className={`evidence-gallery-feedback${feedback.error ? ' is-error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
    {current && <Modal className="modal evidence-viewer" labelledBy={titleId} onClose={() => setSelected(null)} onKeyDown={(event) => { if (images.length > 1 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); } }}>
      <header className="evidence-viewer-head"><div><p>{label}</p><h2 id={titleId}>{current.file_name || `Fotografía ${selected + 1}`}</h2></div><button data-autofocus className="evidence-viewer-close" type="button" onClick={() => setSelected(null)} aria-label="Cerrar fotografía"><X size={22} aria-hidden="true" /></button></header>
      <div className="evidence-viewer-stage"><EvidenceImage key={current.id} evidence={current} alt={`${label}: ${current.file_name || `fotografía ${selected + 1}`}`} lazy={false} /></div>
      <footer className="evidence-viewer-footer">{images.length > 1 ? <div className="evidence-viewer-navigation"><button type="button" onClick={() => move(-1)} disabled={selected === 0} aria-label="Fotografía anterior"><ChevronLeft size={21} aria-hidden="true" /></button><span aria-live="polite">{selected + 1} de {images.length}</span><button type="button" onClick={() => move(1)} disabled={selected === images.length - 1} aria-label="Fotografía siguiente"><ChevronRight size={21} aria-hidden="true" /></button></div> : <span className="evidence-viewer-single">Fotografía</span>}{controls(current)}</footer>
      {busy && <p className="evidence-gallery-feedback" role="status">Preparando archivo…</p>}
      {feedback && <p className={`evidence-gallery-feedback${feedback.error ? ' is-error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
    </Modal>}
  </div>;
}
