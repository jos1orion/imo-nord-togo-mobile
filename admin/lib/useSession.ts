'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { AppRole } from './rbac';

export type Profile = {
  id: string;
  email?: string | null;
  full_name: string | null;
  phone: string | null;
  role: AppRole;
  account_status?: 'active' | 'suspended' | 'pending';
  created_at: string;
};

type SessionState = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  isMasterAdmin: boolean;
};

const MASTER_ADMIN_PROFILE: Profile = {
  id: 'master-admin',
  full_name: 'Super Admin',
  phone: null,
  role: 'ADMIN',
  account_status: 'active',
  created_at: new Date().toISOString(),
};

const MASTER_ADMIN_USER: User = {
  id: 'master-admin',
  app_metadata: { provider: 'master_password' },
  user_metadata: { full_name: 'Super Admin' },
  aud: 'authenticated',
  confirmation_sent_at: '',
  recovery_sent_at: '',
  email_change_sent_at: '',
  new_email: '',
  invited_at: '',
  action_link: '',
  email: 'admin@imoprestige.tg',
  phone: '',
  created_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  email_confirmed_at: new Date().toISOString(),
  phone_confirmed_at: '',
  last_sign_in_at: new Date().toISOString(),
  role: 'authenticated',
  updated_at: new Date().toISOString(),
  identities: [],
  factors: [],
};

function checkHasMasterCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes('render_admin_session=true');
}

export const useSession = (): SessionState => {
  const [hasMasterCookie, setHasMasterCookie] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHasMasterCookie(checkHasMasterCookie());
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      return;
    }

    if (data) {
      setProfile(data as Profile);
      setError(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const sessionUser = data.session?.user ?? null;
      if (sessionUser) {
        setUser(sessionUser);
        await fetchProfile(sessionUser.id);
      }
      if (!mounted) return;
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      if (sessionUser) {
        setUser(sessionUser);
        void fetchProfile(sessionUser.id);
      } else if (!checkHasMasterCookie()) {
        setUser(null);
        setProfile(null);
        setError(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  return useMemo(() => {
    const isMaster = hasMasterCookie || checkHasMasterCookie();
    const effectiveUser = user || (isMaster ? MASTER_ADMIN_USER : null);
    const effectiveProfile = profile || (isMaster ? MASTER_ADMIN_PROFILE : null);
    const effectiveLoading = isMaster ? false : loading;

    return {
      user: effectiveUser,
      profile: effectiveProfile,
      loading: effectiveLoading,
      error,
      isMasterAdmin: isMaster,
    };
  }, [user, profile, loading, error, hasMasterCookie]);
};
