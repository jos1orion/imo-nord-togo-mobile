import type { Permission } from './rbac';

export type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: string;
  permission: Permission;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { href: '/', label: 'Tableau de bord', short: 'DB', icon: '📊', permission: 'dashboard.view' },
      { href: '/properties', label: 'Biens', short: 'PR', icon: '🏠', permission: 'properties.read' },
      { href: '/neighborhoods', label: 'Quartiers', short: 'QT', icon: '📍', permission: 'properties.write' },
      { href: '/users', label: 'Utilisateurs', short: 'US', icon: '👥', permission: 'admins.read' },
      { href: '/tenants', label: 'Locataires', short: 'TE', icon: '👤', permission: 'tenants.read' },
      { href: '/contracts', label: 'Contrats', short: 'CT', icon: '📄', permission: 'contracts.read' },
      { href: '/payments', label: 'Paiements', short: 'PA', icon: '€', permission: 'payments.read' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { href: '/notifications', label: 'Notifications', short: 'NT', icon: '🔔', permission: 'notifications.read' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { href: '/admins', label: 'Administrateurs', short: 'AD', icon: '🔐', permission: 'admins.read' },
    ],
  },
  {
    title: 'Système',
    items: [{ href: '/settings', label: 'Paramètres', short: 'ST', icon: '⚙️', permission: 'admins.read' }],
  },
];
