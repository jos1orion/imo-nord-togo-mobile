export type Role = 'ADMIN' | 'AGENT' | 'ACCOUNTANT';
export type AppRole = Role | 'USER';

export const STAFF_ROLES: Role[] = ['ADMIN', 'AGENT', 'ACCOUNTANT'];

export function isStaffRole(role: string | null | undefined): role is Role {
  return role === 'ADMIN' || role === 'AGENT' || role === 'ACCOUNTANT';
}

export type Permission =
  | 'dashboard.view'
  | 'properties.read'
  | 'properties.write'
  | 'tenants.read'
  | 'tenants.write'
  | 'contracts.read'
  | 'contracts.write'
  | 'payments.read'
  | 'payments.write'
  | 'notifications.read'
  | 'notifications.write'
  | 'admins.read'
  | 'admins.write';

const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: [
    'dashboard.view',
    'properties.read',
    'properties.write',
    'tenants.read',
    'tenants.write',
    'contracts.read',
    'contracts.write',
    'payments.read',
    'payments.write',
    'notifications.read',
    'notifications.write',
    'admins.read',
    'admins.write',
  ],
  AGENT: [
    'dashboard.view',
    'properties.read',
    'properties.write',
    'tenants.read',
    'tenants.write',
    'contracts.read',
    'contracts.write',
    'payments.read',
    'notifications.read',
  ],
  ACCOUNTANT: [
    'dashboard.view',
    'payments.read',
    'payments.write',
    'contracts.read',
    'tenants.read',
  ],
};

export const hasPermission = (role: Role, permission: Permission) =>
  rolePermissions[role]?.includes(permission) ?? false;

export const roleLabels: Record<AppRole, string> = {
  USER: 'Utilisateur',
  ADMIN: 'Admin',
  AGENT: 'Agent',
  ACCOUNTANT: 'Comptable',
};

export function getPermissionForPath(pathname: string): Permission | null {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/' || path === '') return 'dashboard.view';
  if (path.startsWith('/properties')) return 'properties.read';
  if (path.startsWith('/tenants')) return 'tenants.read';
  if (path.startsWith('/contracts')) return 'contracts.read';
  if (path.startsWith('/payments')) return 'payments.read';
  if (path.startsWith('/settings')) return 'admins.read';
  if (path.startsWith('/users')) return 'admins.read';
  if (path.startsWith('/admins')) return 'admins.read';
  if (path.startsWith('/notifications')) return 'notifications.read';
  if (path.startsWith('/neighborhoods')) return 'properties.write';
  return null;
}
