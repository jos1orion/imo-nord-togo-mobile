'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getPermissionForPath, hasPermission, isStaffRole } from '../lib/rbac';
import { useSession } from '../lib/useSession';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading } = useSession();

  useEffect(() => {
    if (loading || !profile) return;
    if (!isStaffRole(profile.role) || profile.account_status === 'suspended') {
      router.replace(profile.account_status === 'suspended' ? '/login?error=suspended' : '/login?error=staff');
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
