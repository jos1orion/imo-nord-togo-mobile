'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { isAdminRole } from '../../lib/rbac';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const staffError = useMemo(
    () => searchParams.get('error') === 'staff',
    [searchParams]
  );
  const profileError = useMemo(
    () => searchParams.get('error') === 'profile',
    [searchParams]
  );

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Veuillez renseigner email et mot de passe.');
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !data.user) {
      setLoading(false);
      setError(signInError?.message ?? 'Connexion impossible.');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(`Connexion réussie, mais le profil admin est illisible: ${profileError.message}`);
      return;
    }

    if (!isAdminRole(profile?.role)) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        profile
          ? `Le rôle du compte est « ${profile.role ?? 'non défini'} », mais « ADMIN » est requis.`
          : "Aucun profil correspondant à ce compte n'a été trouvé."
      );
      return;
    }

    setLoading(false);
    router.replace('/');
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600 }}>
            Connexion Admin
          </div>
          <div style={{ color: 'var(--muted)', marginTop: 6 }}>
            Accès réservé exclusivement au rôle Admin.
          </div>
        </div>

        <div className="form-field">
          <label>Adresse email</label>
          <input
            type="email"
            placeholder="admin@imonord.tg"
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
        </div>

        <div className="form-field">
          <label>Mot de passe</label>
          <input
            type="password"
            placeholder="********"
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
        </div>

        {staffError && !error ? (
          <div className="alert">Ce compte n&apos;a pas accès au back-office.</div>
        ) : null}
        {profileError && !error ? (
          <div className="alert">
            Le profil Supabase est inaccessible. Vérifiez les variables Supabase du back-office et les politiques RLS.
          </div>
        ) : null}
        {error ? <div className="alert">{error}</div> : null}

        <button className="primary-button" onClick={handleLogin} disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
        <button
          className="ghost-button"
          onClick={() => supabase.auth.resetPasswordForEmail(email || 'admin@imonord.tg')}
        >
          Mot de passe oublie
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-shell">Chargement...</div>}>
      <LoginForm />
    </Suspense>
  );
}
