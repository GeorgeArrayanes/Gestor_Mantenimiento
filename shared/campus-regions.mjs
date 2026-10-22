// Stable semantic IDs from the approved orthographic Blender scene.
export const CAMPUS_REGIONS = Object.freeze([
  { id: 'administrativo', label: 'Edificio Administrativo', kind: 'building' },
  { id: 'bloque-1', label: 'Edificio Biblioteca', kind: 'building' },
  { id: 'bloque-2', label: 'Edificio Artes', kind: 'building' },
  { id: 'bloque-3', label: 'Edificio Auditorio', kind: 'building' },
  { id: 'bloque-4', label: 'Edificio Ciencias', kind: 'building' },
  { id: 'bloque-atravesado', label: 'Bloque atravesado', kind: 'building' },
  { id: 'preescolar', label: 'Preescolar', kind: 'building' },
  { id: 'bachillerato', label: 'Bachillerato', kind: 'building' },
  { id: 'transicion', label: 'Transición', kind: 'building' },
  { id: 'grado-11', label: 'Salones de grado 11', kind: 'building' },
  { id: 'comedor', label: 'Comedor', kind: 'building' },
  { id: 'economato', label: 'Economato', kind: 'building' },
  { id: 'primeros-auxilios', label: 'Primeros auxilios', kind: 'building' },
  { id: 'danzas-1', label: 'Danzas 1', kind: 'building' },
  { id: 'danzas-2', label: 'Danzas 2', kind: 'building' },
  { id: 'tienda-1', label: 'Tienda 1', kind: 'building' },
  { id: 'gym', label: 'GYM al aire libre', kind: 'outdoor' },
  { id: 'futbol-principal', label: 'Cancha de fútbol principal', kind: 'outdoor' },
  { id: 'futbol-norte', label: 'Cancha de fútbol norte', kind: 'outdoor' },
  { id: 'patio-central', label: 'Patio central y canchas', kind: 'outdoor' },
  // Existing shared spaces retain their association until explicitly reassigned.
  { id: 'bloques-salones', label: 'Salones · espacios compartidos', kind: 'building', legacy: true },
]);
export const CAMPUS_REGION_IDS = Object.freeze(CAMPUS_REGIONS.map(region => region.id));
