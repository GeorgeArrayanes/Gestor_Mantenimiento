export function isAdminRole(role) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isSuperAdminRole(role) {
  return role === 'SUPER_ADMIN';
}
