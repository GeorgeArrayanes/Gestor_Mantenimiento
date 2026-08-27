export const ADMIN_ROLES = Object.freeze(['ADMIN', 'SUPER_ADMIN']);

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function isSuperAdminRole(role) {
  return role === 'SUPER_ADMIN';
}

export function roleCanAccess(actualRole, allowedRoles) {
  return allowedRoles.includes(actualRole)
    || (isSuperAdminRole(actualRole) && allowedRoles.includes('ADMIN'));
}
