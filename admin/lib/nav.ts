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
    title: 'Pilotage',
    items: [
      { href: '/', label: 'Tableau de bord', short: 'DB', icon: '📊', permission: 'dashboard.view' },
      { href: '/properties', label: 'Biens', short: 'BI', icon: '🏠', permission: 'properties.read' },
      { href: '/publications', label: 'Publications', short: 'PU', icon: '🗓️', permission: 'properties.read' },
      { href: '/featured', label: 'Featured', short: 'FE', icon: '🏷️', permission: 'admins.read' },
      { href: '/neighborhoods', label: 'Quartiers', short: 'QT', icon: '📍', permission: 'admins.read' },
    ],
  },
  {
    title: 'Personnes',
    items: [
      { href: '/agents', label: 'Agents', short: 'AG', icon: '🧑‍💼', permission: 'admins.read' },
      { href: '/users', label: 'Utilisateurs', short: 'US', icon: '👥', permission: 'admins.read' },
      { href: '/tenants', label: 'Locataires', short: 'TE', icon: '👤', permission: 'tenants.read' },
    ],
  },
  {
    title: 'Modération',
    items: [
      { href: '/messages', label: 'Messages', short: 'MS', icon: '💬', permission: 'notifications.read' },
      { href: '/reviews', label: 'Avis', short: 'AV', icon: '⭐', permission: 'notifications.read' },
      { href: '/reports', label: 'Signalements', short: 'SI', icon: '🚨', permission: 'notifications.read' },
      { href: '/notifications', label: 'Notifications', short: 'NT', icon: '🔔', permission: 'notifications.read' },
    ],
  },
  {
    title: 'Dossiers',
    items: [
      { href: '/documents', label: 'Documents', short: 'DO', icon: '📎', permission: 'contracts.read' },
      { href: '/contracts', label: 'Contrats', short: 'CT', icon: '📄', permission: 'contracts.read' },
      { href: '/payments', label: 'Paiements', short: 'PA', icon: '€', permission: 'payments.read' },
      { href: '/transactions', label: 'Transactions', short: 'TR', icon: '💳', permission: 'payments.read' },
    ],
  },
  {
    title: 'Système',
    items: [
      { href: '/logs', label: 'Logs', short: 'LG', icon: '🧾', permission: 'admins.read' },
      { href: '/admins', label: 'Administrateurs', short: 'AD', icon: '🔐', permission: 'admins.read' },
      { href: '/settings', label: 'Paramètres', short: 'ST', icon: '⚙️', permission: 'admins.read' },
    ],
  },
];
