import { useId, useState } from 'react';
import { FileText, Image, UploadCloud, X } from 'lucide-react';
import { evidenceError } from '../utils/maintenance.js';

export default function EvidenceUpload({ files, onChange, label = 'Evidencia fotográfica o documental', requiredPhoto = false, disabled = false }) {
  const inputId = useId();
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  function add(selected) {
    const next = [...files];
    for (const file of selected) if (!next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) next.push(file);
    const message = evidenceError(next);
    setError(message);
    if (!message) onChange(next);
  }
  return <div className="evidence-upload">
    <label className="field-label" htmlFor={inputId}>{label}{requiredPhoto && <span className="required-note"> · Al menos una foto</span>}</label>
    <div className={`upload-dropzone${dragging ? ' dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) add(Array.from(event.dataTransfer.files)); }}>
      <UploadCloud size={28} aria-hidden="true" />
      <label className={`upload-picker${disabled ? ' disabled' : ''}`} htmlFor={inputId}>Seleccionar archivos</label>
      <input id={inputId} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple disabled={disabled} aria-describedby={`${inputId}-help${error ? ` ${inputId}-error` : ''}`} onChange={(event) => { add(Array.from(event.target.files)); event.target.value = ''; }} />
      <small id={`${inputId}-help`}>JPG, PNG, WEBP o PDF · máximo 5 MB por archivo. Las fotos se optimizan al guardarlas; los PDF se conservan. También puedes arrastrarlos aquí.</small>
    </div>
    <p className="upload-count">{files.length} de 5 archivos seleccionados.</p>
    {error && <p id={`${inputId}-error`} className="field-error" role="alert">{error}</p>}
    {files.length > 0 && <ul className="selected-files">{files.map((file, index) => <li key={`${file.name}-${file.size}-${index}`}>{file.type.startsWith('image/') ? <Image size={18} aria-hidden="true" /> : <FileText size={18} aria-hidden="true" />}<span>{file.name}<small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span><button type="button" className="icon-button" disabled={disabled} aria-label={`Quitar ${file.name}`} onClick={() => { onChange(files.filter((_, i) => i !== index)); setError(''); }}><X size={17} /></button></li>)}</ul>}
  </div>;
}
