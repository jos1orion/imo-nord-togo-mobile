'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navGroups } from '../lib/nav';
import { getStaffRole, hasPermission, isStaffRole } from '../lib/rbac';
import { useSession } from '../lib/useSession';

const isActive = (pathname: string, href: string) => {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
};

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useSession();
  const staffRole = profile ? getStaffRole(profile.role) : null;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <small>Back-office</small>
        <span>Imo Nord Togo</span>
      </div>

      {navGroups.map(group => {
        const role = profile?.role;
        const items =
          role && isStaffRole(role)
            ? group.items.filter(item => hasPermission(role, item.permission))
            : [];
        if (items.length === 0) return null;
        return (
          <div key={group.title} className="nav-section">
            <div className="nav-title">{group.title}</div>
            {items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive(pathname, item.href) ? 'active' : ''}`}
              >
                <div className="nav-badge">{item.icon}</div>
                <div>{item.label}</div>
              </Link>
            ))}
          </div>
        );
      })}

      <div className="sidebar-footer">
        <div className="pill">v1.0</div>
      </div>
    </aside>
  );
}
