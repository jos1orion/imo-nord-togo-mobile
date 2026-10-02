'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { isStaffRole } from '../../lib/rbac';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const queryError = searchParams.get('error');

  const preset = useMemo(() => {
    if (queryError === 'staff') return "Ce compte n'a pas accès au back-office.";
    if (queryError === 'suspended') return 'Compte suspendu. Contactez un administrateur.';
    return null;
  }, [queryError]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Veuillez renseigner email et mot de passe.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !data.user) {
      setLoading(false);
      setError(signInError?.message ?? 'Connexion impossible.');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, account_status')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profile?.account_status === 'suspended') {
      await supabase.auth.signOut();
      setLoading(false);
      setError('Compte suspendu. Contactez un administrateur.');
      return;
    }

    if (!isStaffRole(profile?.role)) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Ce compte n'a pas accès au back-office. Le rôle est attribué uniquement par un administrateur.");
      return;
    }

    if (profile.role === 'ADMIN') {
      setLoading(false);
      router.replace('/login/mfa');
      return;
    }

    setLoading(false);
    router.replace('/');
  };

  const handleReset = async () => {
    const trimmed = email.trim();
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      setError('Entrez votre e-mail pour recevoir le lien de récupération.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${origin}/auth/reset`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setInfo('Un lien de récupération a été envoyé par e-mail.');
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600 }}>
            Connexion staff
          </div>
          <div style={{ color: 'var(--muted)', marginTop: 6 }}>
            E-mail et mot de passe gérés par Supabase Auth. Session conservée. Un USER ne peut pas s&apos;attribuer AGENT.
          </div>
        </div>

        <div className="form-field">
          <label>Adresse email</label>
          <input type="email" value={email} onChange={event => setEmail(event.target.value)} />
        </div>
        <div className="form-field">
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={event => setPassword(event.target.value)} />
        </div>

        {preset && !error ? <div className="alert">{preset}</div> : null}
        {error ? <div className="alert">{error}</div> : null}
        {info ? <div className="success">{info}</div> : null}

        <button className="primary-button" onClick={handleLogin} disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
        <button className="ghost-button" onClick={handleReset} disabled={loading}>
          Mot de passe oublié ?
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
