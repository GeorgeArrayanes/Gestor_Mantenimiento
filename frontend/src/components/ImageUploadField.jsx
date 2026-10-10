import { useEffect, useId, useState } from 'react';
import { Image as ImageIcon, RefreshCw, Trash2, Upload } from 'lucide-react';
import PrivateImage from './PrivateImage.jsx';
import { MAX_EVIDENCE_SIZE } from '../utils/maintenance.js';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function imageFileError(file) {
  if (!file) return '';
  if (!IMAGE_TYPES.includes(file.type)) return 'Selecciona una imagen JPG, PNG o WEBP.';
  if (!file.size || file.size > MAX_EVIDENCE_SIZE) return 'La imagen debe pesar entre 1 byte y 5 MB.';
  return '';
}

export default function ImageUploadField({ file, existingUrl, alt, disabled, removed, onChange, onRemove, onError }) {
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState('');
  useEffect(() => {
    if (!file) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const hasExisting = Boolean(existingUrl && !removed && !file);
  const hasImage = Boolean(file || hasExisting);
  function select(event) {
    const next = event.target.files?.[0] || null;
    event.target.value = '';
    const error = imageFileError(next);
    onError(error);
    if (!error) onChange(next);
  }
  return <div className="directory-image-field full">
    <span className="field-label">Imagen <small>(opcional)</small></span>
    <div className={`directory-image-picker${hasImage ? ' has-image' : ''}`}>
      <div className="directory-image-preview">
        {previewUrl ? <img src={previewUrl} alt={`Vista previa: ${alt || 'imagen seleccionada'}`} /> : hasExisting ? <PrivateImage src={existingUrl} alt={alt} lazy={false} fallback={<span className="directory-image-placeholder"><ImageIcon aria-hidden="true" /><span>Imagen no disponible</span></span>} /> : <span className="directory-image-placeholder"><ImageIcon aria-hidden="true" /><span>Añade una foto para personalizar la tarjeta</span></span>}
      </div>
      <div className="directory-image-picker-copy"><strong>{file ? file.name : hasExisting ? 'Imagen actual' : 'Selecciona una imagen'}</strong><p>JPG, PNG o WEBP. Máximo 5 MB.</p><div className="directory-image-actions"><label className={`secondary-button${disabled ? ' is-disabled' : ''}`} htmlFor={inputId}>{hasImage ? <RefreshCw size={15} aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}{hasImage ? 'Cambiar imagen' : 'Subir imagen'}</label>{hasImage && <button className="directory-remove-image" type="button" onClick={onRemove} disabled={disabled}><Trash2 size={15} aria-hidden="true" />Quitar</button>}</div></div>
      <input id={inputId} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={select} disabled={disabled} />
    </div>
  </div>;
}
