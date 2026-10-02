export type Role = 'ADMIN' | 'AGENT' | 'ACCOUNTANT';
export type AppRole = Role | 'USER';

export const STAFF_ROLES: Role[] = ['ADMIN', 'AGENT', 'ACCOUNTANT'];

export function isStaffRole(role: string | null | undefined): role is Role {
  return role === 'ADMIN' || role === 'AGENT' || role === 'ACCOUNTANT';
}

export function isAdminRole(role: string | null | undefined): role is 'ADMIN' {
  return role === 'ADMIN';
}

export function getStaffRole(role: AppRole | string | null | undefined): Role | null {
  return isStaffRole(role) ? role : null;
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
  | 'admins.write'
  | 'agents.read'
  | 'agents.write';

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
    'agents.read',
    'agents.write',
  ],
  AGENT: ['dashboard.view', 'properties.read', 'properties.write'],
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
  if (path.startsWith('/publications')) return 'properties.read';
  if (path.startsWith('/featured')) return 'admins.read';
  if (path.startsWith('/neighborhoods')) return 'admins.read';
  if (path.startsWith('/tenants')) return 'tenants.read';
  if (path.startsWith('/contracts')) return 'contracts.read';
  if (path.startsWith('/documents')) return 'contracts.read';
  if (path.startsWith('/payments')) return 'payments.read';
  if (path.startsWith('/transactions')) return 'payments.read';
  if (path.startsWith('/messages')) return 'notifications.read';
  if (path.startsWith('/reviews')) return 'notifications.read';
  if (path.startsWith('/reports')) return 'notifications.read';
  if (path.startsWith('/notifications')) return 'notifications.read';
  if (path.startsWith('/users')) return 'admins.read';
  if (path.startsWith('/agents')) return 'admins.read';
  if (path.startsWith('/admins')) return 'admins.read';
  if (path.startsWith('/logs')) return 'admins.read';
  if (path.startsWith('/settings')) return 'admins.read';
  return null;
}
