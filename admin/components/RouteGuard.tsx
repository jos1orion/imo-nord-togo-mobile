'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getPermissionForPath, hasPermission, isAdminRole } from '../lib/rbac';
import { useSession } from '../lib/useSession';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading } = useSession();

  useEffect(() => {
    if (loading || !profile) return;

    if (!isAdminRole(profile.role)) {
      router.replace('/login?error=staff');
      return;
    }

    const required = getPermissionForPath(pathname);
    if (required === null) {
      router.replace('/');
      return;
    }
    if (!hasPermission('ADMIN', required)) {
      router.replace('/');
    }
  }, [pathname, profile, loading, router]);

  return <>{children}</>;
}
