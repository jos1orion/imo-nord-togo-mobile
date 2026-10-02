'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isStaffRole } from '../lib/rbac';
import { useSession } from '../lib/useSession';
import { supabase } from '../lib/supabaseClient';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, loading, error } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (profile && (!isStaffRole(profile.role) || profile.account_status === 'suspended')) {
      void supabase.auth.signOut().then(() =>
        router.replace(profile.account_status === 'suspended' ? '/login?error=suspended' : '/login?error=staff')
      );
    }
  }, [loading, user, profile, router]);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="card" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
          Chargement de la session...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!profile) {
    return (
      <div className="page-loading">
        <div className="card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontWeight: 600 }}>
            {error ? 'Impossible de lire le profil Supabase' : 'Profil administrateur manquant'}
          </div>
          <div style={{ color: 'var(--muted)', marginTop: 6 }}>
            Ce compte n&apos;a pas accès au back-office. Demandez à un administrateur de vous attribuer un rôle staff.
          </div>
          {error ? (
            <div className="alert" style={{ marginTop: 12 }}>
              {error}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (!isStaffRole(profile.role) || profile.account_status === 'suspended') {
    return null;
  }

  return <>{children}</>;
}
