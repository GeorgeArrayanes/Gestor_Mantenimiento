import { useEffect, useMemo, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { ArrowDown, ArrowRight, Building2, Check, ChevronRight, Hand, Info, Layers3, List, LoaderCircle, Map, Maximize, Minus, MousePointer2, Plus, RotateCcw, Search } from 'lucide-react';
import { canSelectMapRegion, moveMapGesture, validateMapRegions } from './campus-map-demo.js';
import { api } from '../api.js';
import CampusSpacesPanel from './CampusSpacesPanel.jsx';
import './campus-map.css';

const ASSETS = '/campus-map/';
function MapControls({ controls, scale, ready, showRegions, onToggleRegions }) {
  return <div className="campus-map-controls" aria-label="Controles del mapa">
    <button type="button" onClick={() => controls.zoomIn(.3)} disabled={!ready || scale >= 3.79} aria-label="Acercar mapa" title="Acercar"><Plus size={18} /></button>
    <span className="campus-zoom-value" aria-label={`Zoom ${Math.round(scale * 100)} por ciento`}>{Math.round(scale * 100)}<small>%</small></span>
    <button type="button" onClick={() => controls.zoomOut(.3)} disabled={!ready || scale <= 1.01} aria-label="Alejar mapa" title="Alejar"><Minus size={18} /></button>
    <span className="campus-control-divider" />
    <button type="button" onClick={() => controls.resetTransform()} disabled={!ready} aria-label="Restablecer vista del mapa" title="Restablecer vista"><Maximize size={17} /></button>
    <button type="button" className={showRegions ? 'active' : ''} onClick={onToggleRegions} disabled={!ready} aria-label="Mostrar todas las zonas seleccionables" aria-pressed={showRegions} title="Mostrar zonas"><Layers3 size={17} /></button>
  </div>;
}

export default function CampusMapPage() {
  const [map, setMap] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [spacesError, setSpacesError] = useState('');
  const [spacesAttempt, setSpacesAttempt] = useState(0);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [scale, setScale] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [showRegions, setShowRegions] = useState(false);
  const [query, setQuery] = useState('');
  const gesture = useRef(null);
  const pointers = useRef(new Set());
  const panelRef = useRef(null);
  const directoryRef = useRef(null);
  const viewportRef = useRef(null);
  const regions = map?.regions || [];
  const region = regions.find(item => item.id === selected);
  const hoverRegion = regions.find(item => item.id === hovered);
  const ready = Boolean(map && imageReady && !imageFailed && !error);
  const visibleRegions = useMemo(() => regions.filter(item => item.label.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))), [regions, query]);

  useEffect(() => {
    const controller = new AbortController();
    setSpacesLoading(true); setSpacesError('');
    api('/spaces', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setSpaces(data.spaces);
    }).catch(cause => {
      if (!controller.signal.aborted) setSpacesError(cause.message);
    }).finally(() => {
      if (!controller.signal.aborted) setSpacesLoading(false);
    });
    return () => controller.abort();
  }, [spacesAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    setError(''); setMap(null);
    fetch(`${ASSETS}regions.json`, { signal: controller.signal }).then(response => { if (!response.ok) throw new Error('No se pudieron cargar las zonas del campus.'); return response.json(); }).then(validateMapRegions).then(data => { if (!controller.signal.aborted) setMap(data); }).catch(() => { if (!controller.signal.aborted) setError('No se pudieron cargar las zonas del campus. Intenta de nuevo.'); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    // A drag can finish outside the canvas; clear pointer bookkeeping there too.
    const end = event => {
      pointers.current.delete(event.pointerId);
      if (gesture.current?.moved) gesture.current.suppressUntil = Date.now() + 350;
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const measure = () => setViewportWidth(viewport.clientWidth);
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(viewport);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  function retry() { setImageFailed(false); setImageReady(false); setAttempt(value => value + 1); }
  function showPanel() {
    panelRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    window.requestAnimationFrame(() => panelRef.current?.querySelector('h2')?.focus({ preventScroll: true }));
  }
  function select(id, fromList = false) {
    setSelected(id); setHovered(null);
    if (fromList && window.matchMedia('(max-width: 1150px)').matches) showPanel();
  }
  function clearSelection() {
    const previous = selected;
    setSelected(null);
    window.requestAnimationFrame(() => document.getElementById(`campus-region-${previous}`)?.focus({ preventScroll: true }));
  }
  function pointerDown(event) {
    if (event.pointerType === 'mouse') pointers.current.clear();
    pointers.current.add(event.pointerId);
    const suppressed = gesture.current?.suppressUntil;
    gesture.current = { x: event.clientX, y: event.clientY, pointer: event.pointerId, moved: pointers.current.size > 1, suppressUntil: suppressed };
  }
  function pointerMove(event) {
    if (!pointers.current.has(event.pointerId)) return;
    gesture.current = moveMapGesture(gesture.current, event.clientX, event.clientY);
    if (gesture.current?.moved) setHovered(null);
  }
  function pointerEnd(event) {
    pointers.current.delete(event.pointerId);
    if (gesture.current?.moved) gesture.current.suppressUntil = Date.now() + 350;
  }

  return <div className="campus-page">
    <header className="campus-page-heading"><div><p className="campus-eyebrow">Descubre nuestras instalaciones</p><h1>Mapa del colegio<span aria-hidden="true">.</span></h1><p>Un recorrido por los espacios que cuidamos cada día.</p></div><div className="campus-heading-aside"><span className="campus-demo-badge">Espacios del campus</span><span>Edificios y ubicaciones internas</span></div></header>
    <div className="campus-demo-notice"><Info size={17} aria-hidden="true" /><p><strong>Todo en su lugar.</strong> Selecciona un edificio, añade sus espacios internos y elige una ubicación desde su lista.</p></div>
    <div className="campus-workspace">
      <section className="campus-map-card" aria-labelledby="campus-map-heading"><div className="campus-map-card-heading"><div><span className="campus-mini-mark"><Map size={18} aria-hidden="true" /></span><div><h2 id="campus-map-heading">Gimnasio Los Arrayanes</h2><p>Vista isométrica del campus</p></div></div><button type="button" className="campus-directory-link" aria-label="Abrir directorio del campus" onClick={() => { directoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); directoryRef.current?.focus({ preventScroll: true }); }}><List size={15} aria-hidden="true" /><span>Directorio</span><ArrowDown size={13} aria-hidden="true" /></button></div>
        <TransformWrapper initialScale={1} minScale={1} maxScale={3.8} centerOnInit centerZoomedOut limitToBounds wheel={{ step: .14 }} doubleClick={{ disabled: true }} panning={{ velocityDisabled: true }} onTransform={(_, state) => setScale(state.scale)} onPinchStart={() => { gesture.current = { ...gesture.current, moved: true, suppressUntil: Date.now() + 350 }; }}>
          {controls => <><div ref={viewportRef} className={`campus-map-viewport${ready ? ' ready' : ''}`} onPointerDownCapture={pointerDown} onPointerMoveCapture={pointerMove} onPointerUpCapture={pointerEnd} onPointerCancelCapture={event => { pointers.current.delete(event.pointerId); gesture.current = { moved: true, suppressUntil: Date.now() + 350 }; }} onMouseLeave={() => setHovered(null)}>
            <TransformComponent wrapperClass="campus-transform-wrapper" contentClass="campus-transform-content" wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%' }}>
              <div className="campus-map-canvas" style={{ aspectRatio: '3200 / 2200' }}>
                <picture key={attempt}><source type="image/webp" srcSet={`${ASSETS}campus-1600.webp 1600w, ${ASSETS}campus-2400.webp 2400w, ${ASSETS}campus-3200.webp 3200w`} sizes={viewportWidth ? `${Math.ceil(viewportWidth * scale)}px` : '(max-width: 600px) 100vw, (max-width: 1150px) 85vw, 70vw'} /><img src={`${ASSETS}campus-1600.webp`} width="3200" height="2200" alt="Escenario isométrico del Gimnasio Los Arrayanes: edificios, cubiertas azules, canchas y zonas verdes." draggable="false" decoding="async" fetchPriority="high" onLoad={() => { setImageReady(true); setImageFailed(false); }} onError={() => setImageFailed(true)} /></picture>
                {ready && <svg className={`campus-map-regions${showRegions ? ' show-regions' : ''}`} viewBox="0 0 3200 2200" width="3200" height="2200" role="group" aria-label="Zonas seleccionables del campus" aria-describedby="campus-map-instructions">{regions.map(item => <path key={item.id} id={`campus-region-${item.id}`} d={item.path} data-region-id={item.id} className={`campus-map-region${selected === item.id ? ' is-selected' : ''}${hovered === item.id ? ' is-hovered' : ''}`} fillRule="evenodd" clipRule="evenodd" vectorEffect="non-scaling-stroke" role="button" tabIndex={0} aria-label={`Seleccionar ${item.label}`} aria-pressed={selected === item.id} onPointerEnter={event => { if (event.pointerType !== 'touch' && (!pointers.current.size || !gesture.current?.moved)) setHovered(item.id); }} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered(item.id)} onBlur={() => setHovered(null)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(item.id); } }} onClick={event => { event.stopPropagation(); if (event.detail === 0 || canSelectMapRegion(gesture.current)) select(item.id); }}><title>{item.label}</title></path>)}</svg>}
              </div>
            </TransformComponent>
            {(!ready || error || imageFailed) && <div className="campus-map-load" role={error || imageFailed ? 'alert' : 'status'} aria-busy={!error && !imageFailed}>{error || imageFailed ? <><Map size={31} strokeWidth={1.3} aria-hidden="true" /><h3>No se pudo abrir el campus</h3><p>{imageFailed ? 'La imagen del campus no está disponible. Intenta cargarla de nuevo.' : error}</p><button type="button" className="campus-retry" onClick={retry}><RotateCcw size={15} aria-hidden="true" />Reintentar</button></> : <><LoaderCircle className="campus-spinner" size={27} aria-hidden="true" /><strong>Preparando el campus</strong><p>Cargando la vista y sus zonas de interacción…</p></>}</div>}
            {ready && <div className={`campus-map-bottom-label${region ? ' has-selection' : ''}`} aria-hidden="true">{hoverRegion || region ? <><span className="campus-hover-dot" />{(hoverRegion || region).label}<ChevronRight size={13} /></> : <><MousePointer2 size={13} /><span>Selecciona una zona para explorar</span></>}</div>}
            {ready && region && <button type="button" className="campus-mobile-panel-link" onClick={showPanel}>Ver ficha<ArrowDown size={13} aria-hidden="true" /></button>}
          </div><div className="campus-map-toolbar"><p id="campus-map-instructions"><Hand size={14} aria-hidden="true" /><span>Arrastra para explorar · Rueda o pellizco para acercarte</span></p><MapControls controls={controls} scale={scale} ready={ready} showRegions={showRegions} onToggleRegions={() => setShowRegions(value => !value)} /></div></>}
        </TransformWrapper>
        <div className="campus-map-credit"><span><span className="campus-credit-dot" />Escenario aprobado · Cámara isométrica original</span><span>Gimnasio Los Arrayanes</span></div>
      </section>
      <div className="campus-panel-anchor" ref={panelRef}><CampusSpacesPanel region={region} spaces={spaces} loading={spacesLoading} error={spacesError} onReload={() => setSpacesAttempt(value => value + 1)} onCreated={space => setSpaces(current => [...current.filter(item => item.id !== space.id), space])} onClear={clearSelection} /></div>
    </div>
    <section className="campus-directory" aria-labelledby="campus-directory-heading" tabIndex={-1} ref={directoryRef}><div className="campus-directory-heading"><div><p className="campus-eyebrow">Otra forma de explorar</p><h2 id="campus-directory-heading">Directorio del campus <span>{regions.length || '—'}</span></h2><p>Selecciona una instalación desde la lista. También puedes usar el teclado.</p></div><label className="campus-directory-search"><Search size={16} aria-hidden="true" /><span className="campus-sr-only">Buscar una instalación</span><input type="search" placeholder="Buscar una instalación" value={query} onChange={event => setQuery(event.target.value)} disabled={!map} /></label></div>{map ? visibleRegions.length ? <ul className="campus-directory-grid">{visibleRegions.map(item => <li key={item.id}><button type="button" aria-pressed={selected === item.id} onClick={() => select(item.id, true)}><span className="campus-directory-icon">{selected === item.id ? <Check size={15} /> : <Building2 size={15} />}</span><span>{item.label}</span><ArrowRight size={14} className="campus-directory-arrow" aria-hidden="true" /></button></li>)}</ul> : <p className="campus-search-empty" role="status">No hay instalaciones que coincidan con «{query}».</p> : <p className="campus-search-empty">{error ? 'El directorio estará disponible cuando se carguen las zonas del mapa.' : 'Cargando el directorio…'}</p>}</section>
    <div className="campus-sr-only" role="status" aria-live="polite" aria-atomic="true">{region ? `${region.label} seleccionada. Elige un espacio interno en su lista.` : 'Vista general del campus. Selecciona una zona.'}</div>
  </div>;
}
