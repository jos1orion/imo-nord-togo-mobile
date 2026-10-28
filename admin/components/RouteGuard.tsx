'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getPermissionForPath, hasPermission, isStaffRole } from '../lib/rbac';
import { useSession } from '../lib/useSession';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading, isMasterAdmin } = useSession();

  useEffect(() => {
    // Si c'est l'administrateur Render, accès total à toutes les pages du back-office
    if (isMasterAdmin) return;
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
    if (!hasPermission(profile.role, required)) {
      router.replace('/');
    }
  }, [pathname, profile, loading, router, isMasterAdmin]);

  return <>{children}</>;
}
