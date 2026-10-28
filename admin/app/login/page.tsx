'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const searchParams = useSearchParams();
  const errorMsg = searchParams.get('msg');
  const errorCode = searchParams.get('error');

  const displayError = errorMsg || (
    errorCode === 'password'
      ? 'Mot de passe administrateur incorrect. Vérifiez la variable ADMIN_PASSWORD sur Render.'
      : errorCode === 'missing'
      ? "La variable ADMIN_PASSWORD n'est pas encore configurée sur Render."
      : errorCode === 'staff'
      ? "Ce compte n'a pas accès au back-office."
      : null
  );

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

        {/* Formulaire HTML standard direct : fonctionne sans aucune dépendance JS */}
        <form action="/api/auth/master-login" method="POST">
          <div className="form-field">
            <label htmlFor="admin-password">Mot de passe Back-Office</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              placeholder="Entrez votre mot de passe secret"
              autoFocus
              required
              autoComplete="current-password"
            />
          </div>

          {displayError ? (
            <div
              className="alert"
              style={{
                marginTop: 14,
                display: 'block',
                background: '#fee2e2',
                color: '#991b1b',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                border: '1px solid #f87171',
              }}
            >
              {displayError}
            </div>
          ) : null}

          <button
            type="submit"
            className="primary-button"
            style={{ width: '100%', marginTop: 18 }}
          >
            Déverrouiller le Back-Office
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
