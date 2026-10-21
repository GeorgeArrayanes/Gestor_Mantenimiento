export function spacesInRegion(spaces, regionId) {
  if (!regionId) return [];
  return spaces.filter(space => space.campus_region_id === regionId)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
}
