'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { AppRole } from './rbac';

export type Profile = {
  id: string;
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
};

export const useSession = (): SessionState => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setProfile(null);
      return;
    }

    setProfile((data as Profile) ?? null);
    setError(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        fetchProfile(sessionUser.id);
      }
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        fetchProfile(sessionUser.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  return useMemo(() => ({ user, profile, loading, error }), [user, profile, loading, error]);
};
