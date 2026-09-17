'use client';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AuthGate from './AuthGate';
import RouteGuard from './RouteGuard';

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <RouteGuard>
        <div className="app-shell">
          <Sidebar />
          <div className="content">
            <Topbar />
            {children}
          </div>
        </div>
      </RouteGuard>
    </AuthGate>
  );
}
