import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { isImageEvidence } from './EvidenceImage.jsx';

export function incidentThumbnail(incident) {
  const evidence = incident.initial_evidence;
  return evidence?.category === 'INITIAL' && isImageEvidence(evidence) ? evidence : null;
}

export function needsThumbnailMetadata(incident, compact = false) {
  return !compact && !Object.hasOwn(incident, 'initial_evidence') && /^[1-9]\d*$/.test(String(incident.id || ''));
}

export function watchLegacyIncidentThumbnail(id, element, onThumbnail) {
  const controller = new AbortController();
  let requested = false;
  let observer;
  async function load() {
    if (requested || controller.signal.aborted) return;
    requested = true;
    observer?.disconnect();
    try {
      const result = await api(`/incidents/${id}`, { signal: controller.signal });
      if (controller.signal.aborted || String(result.incident?.id) !== String(id)) return;
      const evidence = Array.isArray(result.evidences) ? result.evidences.find(item => item?.category === 'INITIAL' && isImageEvidence(item)) : null;
      onThumbnail(evidence || null);
    } catch {
      // The contextual card remains usable if optional preview metadata is unavailable.
    }
  }
  if (element && typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.target === element && entry.isIntersecting)) load();
    }, { rootMargin: '160px' });
    observer.observe(element);
  } else load();
  return () => { controller.abort(); observer?.disconnect(); };
}

export default function useIncidentThumbnail(incident, compact = false) {
  const container = useRef(null);
  const [legacy, setLegacy] = useState({ key: '', evidence: null });
  const id = String(incident.id || '');
  const updated = incident.updated_at || '';
  const key = `${id}|${updated}`;
  const needsMetadata = needsThumbnailMetadata(incident, compact);
  useEffect(() => {
    if (!needsMetadata) return;
    // New API lists include nullable initial_evidence, so this compatibility read
    // runs only for visible cards served by an older process still in use.
    return watchLegacyIncidentThumbnail(id, container.current, evidence => setLegacy({ key, evidence }));
  }, [id, key, needsMetadata]);
  const thumbnail = compact ? null : Object.hasOwn(incident, 'initial_evidence') ? incidentThumbnail(incident) : legacy.key === key ? legacy.evidence : null;
  return { thumbnail, container };
}
