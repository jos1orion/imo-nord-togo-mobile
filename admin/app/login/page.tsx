'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { isStaffRole } from '../../lib/rbac';
import { fetchStaffProfileAccess } from '../../lib/profileAccess';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authMode, setAuthMode] = useState<'master' | 'credentials'>('master');
  const [masterPassword, setMasterPassword] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const queryError = searchParams.get('error');

  const preset = useMemo(() => {
    if (queryError === 'staff') return "Ce compte n'a pas accès au back-office.";
    if (queryError === 'suspended') return 'Compte suspendu. Contactez un administrateur.';
    if (queryError === 'session') return 'Votre session a expiré. Veuillez vous reconnecter.';
    return null;
  }, [queryError]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Connexion rapide via le mot de passe maître configuré dans Render
  const handleMasterLogin = async () => {
    if (!masterPassword.trim()) {
      setError('Veuillez renseigner le mot de passe administrateur.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch('/api/auth/master-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: masterPassword.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        setError(data.error ?? 'Mot de passe administrateur incorrect.');
        return;
      }

      // Connexion à Supabase avec le compte administrateur synchronisé
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: masterPassword.trim(),
      });

      if (signInError || !signInData.user) {
        setLoading(false);
        setError(signInError?.message ?? 'Échec de la session administrateur.');
        return;
      }

      setLoading(false);
      router.replace('/');
    } catch (err) {
      setLoading(false);
      setError('Erreur réseau ou serveur inaccessible.');
    }
  };

  // Connexion classique (email + mot de passe)
  const handleLogin = async () => {
    if (!email || !password) {
      setError('Veuillez renseigner email et mot de passe.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);

    // Tentative de connexion Supabase classique
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError || !data.user) {
      setLoading(false);
      setError(signInError?.message ?? 'Connexion impossible.');
      return;
    }

    const { data: profile, error: profileError } = await fetchStaffProfileAccess(
      supabase,
      data.user.id
    );

    if (profileError) {
      setLoading(false);
      setError('Impossible de vérifier votre profil staff dans Supabase. Vérifiez le schéma et les politiques RLS.');
      return;
    }

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
      <section className="login-showcase" aria-label="Imo Nord Togo, immobilier dans le Nord du Togo">
        <div className="login-showcase-brand">
          <span className="login-showcase-mark" aria-hidden="true">IN</span>
          <span>IMO NORD <strong>TOGO</strong></span>
        </div>
        <div className="login-showcase-copy">
          <div className="login-showcase-eyebrow">L&apos;immobilier, autrement</div>
          <h1>Le Nord-Togo<br />prend de la <em>hauteur.</em></h1>
          <p>Un espace privilégié pour piloter les biens, accompagner les agents et faire grandir chaque projet immobilier.</p>
        </div>
        <div className="login-showcase-footer">
          <span className="login-showcase-live" />
          <span>Kara · Togo</span>
          <span className="login-showcase-divider" />
          <span>Votre espace de gestion</span>
        </div>
        <div className="login-showcase-orbit" aria-hidden="true">
          <span>IN</span>
        </div>
      </section>
      <div className="login-card">
        <div className="login-card-heading">
          <div className="login-card-eyebrow">ACCÈS SÉCURISÉ</div>
          <h2>Heureux de vous retrouver.</h2>
          <p>Connectez-vous à votre espace professionnel.</p>
        </div>

        {/* Sélecteur de méthode de connexion */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            className={authMode === 'master' ? 'primary-button' : 'ghost-button'}
            style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
            onClick={() => {
              setAuthMode('master');
              setError(null);
            }}
          >
            Mot de passe Admin
          </button>
          <button
            type="button"
            className={authMode === 'credentials' ? 'primary-button' : 'ghost-button'}
            style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
            onClick={() => {
              setAuthMode('credentials');
              setError(null);
            }}
          >
            Email + Mot de passe
          </button>
        </div>

        {authMode === 'master' ? (
          <div>
            <div className="form-field">
              <label htmlFor="master-password">Mot de passe Administrateur Render</label>
              <input
                id="master-password"
                type="password"
                placeholder="Entrez votre mot de passe secret"
                value={masterPassword}
                onChange={event => setMasterPassword(event.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleMasterLogin()}
                autoFocus
              />
              <span style={{ fontSize: '11px', color: '#64777A', marginTop: 4, display: 'block' }}>
                Ce mot de passe est celui défini dans la variable <code>ADMIN_PASSWORD</code> sur Render.
              </span>
            </div>

            {preset && !error ? <div className="alert">{preset}</div> : null}
            {error ? <div className="alert">{error}</div> : null}
            {info ? <div className="success">{info}</div> : null}

            <button
              className="primary-button"
              style={{ width: '100%', marginTop: 12 }}
              onClick={handleMasterLogin}
              disabled={loading}
            >
              {loading ? 'Vérification...' : 'Déverrouiller le Back-Office'}
            </button>
          </div>
        ) : (
          <div>
            <div className="form-field">
              <label htmlFor="staff-email">Adresse e-mail</label>
              <input
                id="staff-email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="staff-password">Mot de passe</label>
              <input
                id="staff-password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            {preset && !error ? <div className="alert">{preset}</div> : null}
            {error ? <div className="alert">{error}</div> : null}
            {info ? <div className="success">{info}</div> : null}

            <button
              className="primary-button"
              style={{ width: '100%', marginTop: 12 }}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
            <button className="ghost-button" onClick={handleReset} disabled={loading} style={{ width: '100%', marginTop: 8 }}>
              Mot de passe oublié ?
            </button>
          </div>
        )}
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
