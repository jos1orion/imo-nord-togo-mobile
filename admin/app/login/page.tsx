'use client';

import { Suspense, useState } from 'react';

function LoginForm() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    const trimmed = password.trim();
    if (!trimmed) {
      setError('Veuillez entrer le mot de passe du back-office.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/master-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmed }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLoading(false);
        setError(data.error || `Erreur serveur (${res.status}).`);
        return;
      }

      // Redirection immédiate vers le dashboard
      window.location.href = '/';
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : 'Erreur réseau de connexion.';
      setError(msg);
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

        <form onSubmit={e => { e.preventDefault(); handleLogin(); }}>
          <div className="form-field">
            <label htmlFor="admin-password">Mot de passe Back-Office</label>
            <input
              id="admin-password"
              type="password"
              placeholder="Entrez votre mot de passe secret"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <div className="alert" style={{ marginTop: 12, display: 'block', visibility: 'visible' }}>
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="primary-button"
            style={{ width: '100%', marginTop: 16 }}
            disabled={loading}
          >
            {loading ? 'Connexion en cours...' : 'Déverrouiller le Back-Office'}
          </button>
        </form>
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
