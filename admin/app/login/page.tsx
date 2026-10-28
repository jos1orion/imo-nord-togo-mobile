'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!password.trim()) {
      setError('Veuillez entrer le mot de passe du back-office.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Vérification du mot de passe défini dans les variables d'environnement Render
      const res = await fetch('/api/auth/master-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        setError(data.error ?? 'Mot de passe incorrect.');
        return;
      }

      // Connexion de la session sécurisée
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: password.trim(),
      });

      if (signInError || !signInData.user) {
        setLoading(false);
        setError(signInError?.message ?? 'Échec de la connexion.');
        return;
      }

      setLoading(false);
      router.replace('/');
    } catch {
      setLoading(false);
      setError('Erreur réseau ou serveur inaccessible.');
    }
  };

  return (
    <div className="login-shell">
      <section className="login-showcase" aria-label="Imo Prestige, gestion immobilière">
        <div className="login-showcase-brand">
          <span className="login-showcase-mark" aria-hidden="true">IP</span>
          <span>IMO <strong>PRESTIGE</strong></span>
        </div>
        <div className="login-showcase-copy">
          <div className="login-showcase-eyebrow">ESPACE D&apos;ADMINISTRATION</div>
          <h1>Gestion &amp; Pilotage<br /><em>ImoPrestige</em></h1>
          <p>Espace sécurisé réservé à l&apos;administration de la plateforme.</p>
        </div>
        <div className="login-showcase-footer">
          <span className="login-showcase-live" />
          <span>Accès direct sécurisé</span>
          <span className="login-showcase-divider" />
          <span>Serveur Render</span>
        </div>
      </section>

      <div className="login-card">
        <div className="login-card-heading">
          <div className="login-card-eyebrow">ACCÈS DIRECT</div>
          <h2>Connexion au Back-Office</h2>
          <p>Entrez le mot de passe configuré sur le serveur Render.</p>
        </div>

        <div className="form-field">
          <label htmlFor="admin-password">Mot de passe Back-Office</label>
          <input
            id="admin-password"
            type="password"
            placeholder="Entrez votre mot de passe secret"
            value={password}
            onChange={event => setPassword(event.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
        </div>

        {error ? <div className="alert">{error}</div> : null}

        <button
          className="primary-button"
          style={{ width: '100%', marginTop: 16 }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Vérification...' : 'Déverrouiller le Back-Office'}
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
