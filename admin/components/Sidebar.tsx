'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { navGroups } from '../lib/nav';
import { hasPermission, isStaffRole } from '../lib/rbac';
import { useSession } from '../lib/useSession';

const isActive = (pathname: string, href: string) => {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
};

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark" aria-hidden="true">IN</div>
        <div className="sidebar-brand-copy">
          <small>BACK-OFFICE</small>
          <span>Imo Nord Togo</span>
        </div>
        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="admin-navigation"
          onClick={() => setMobileMenuOpen(open => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <nav id="admin-navigation" className="sidebar-navigation" aria-label="Navigation principale">
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
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="nav-badge">{item.icon}</div>
                  <div>{item.label}</div>
                </Link>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-copy">
          <strong>Gestion immobilière</strong>
          <span>Kara · Togo</span>
        </div>
        <div className="pill">v1.0</div>
      </div>
    </aside>
  );
}
