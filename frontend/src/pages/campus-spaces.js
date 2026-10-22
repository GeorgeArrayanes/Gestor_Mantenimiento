import { CAMPUS_REGIONS } from '../../../shared/campus-regions.mjs';
import { activeRecord } from '../utils/maintenance.js';

export function spacesInRegion(spaces, regionId) {
  if (!regionId) return [];
  return spaces.filter(space => space.campus_region_id === regionId)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
}

// Group the single catalogue response once; directory expansion never fetches
// photos, additional models, or a separate response for each building.
export function campusDirectory(regions, spaces, query = '') {
  const groups = new Map();
  for (const space of spaces) {
    if (!groups.has(space.campus_region_id)) groups.set(space.campus_region_id, []);
    groups.get(space.campus_region_id).push(space);
  }
  const legacy = CAMPUS_REGIONS.filter(region => region.legacy && groups.get(region.id)?.length && !regions.some(item => item.id === region.id));
  const search = query.trim().toLocaleLowerCase('es');
  return [...regions, ...legacy].map(region => {
    const items = [...(groups.get(region.id) || [])].sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
    const buildingMatches = region.label.toLocaleLowerCase('es').includes(search);
    const visible = !search || buildingMatches ? items : items.filter(space => `${space.name} ${space.zone || ''}`.toLocaleLowerCase('es').includes(search));
    return { ...region, spaces: visible, totalSpaces: items.length, matches: buildingMatches || visible.length > 0 };
  }).filter(region => !search || region.matches);
}

export function incidentReportUrl(regionId, spaceId = '') {
  const params = new URLSearchParams();
  if (CAMPUS_REGIONS.some(region => region.id === regionId)) params.set('campus_region_id', regionId);
  if (/^[1-9]\d*$/.test(String(spaceId))) params.set('space_id', String(spaceId));
  return `/incidencias/nueva${params.size ? `?${params}` : ''}`;
}

// URL parameters are hints only. A space must still be active, present in the
// authenticated catalogue, and belong to the requested building.
export function reportLocationFromSearch(search, spaces) {
  const params = new URLSearchParams(search);
  const requestedRegion = params.get('campus_region_id') || '';
  const regionId = CAMPUS_REGIONS.some(region => region.id === requestedRegion) ? requestedRegion : '';
  const requestedSpace = params.get('space_id') || '';
  const space = spaces.find(item => String(item.id) === requestedSpace && activeRecord(item));
  if (space && (!requestedRegion || (regionId && space.campus_region_id === regionId))) {
    return { regionId: regionId || (CAMPUS_REGIONS.some(region => region.id === space.campus_region_id) ? space.campus_region_id : ''), spaceId: String(space.id), warning: '' };
  }
  return { regionId, spaceId: '', warning: requestedSpace || (requestedRegion && !regionId) ? 'La ubicación del enlace no está disponible. Selecciona un edificio y un espacio activo.' : '' };
}

export function reportSpaces(spaces, regionId) {
  return spaces.filter(space => activeRecord(space) && (!regionId || space.campus_region_id === regionId))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
}
