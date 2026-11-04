type LoginPageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const errorMsg = typeof resolvedParams.msg === 'string' ? resolvedParams.msg : null;
  const errorCode = typeof resolvedParams.error === 'string' ? resolvedParams.error : null;

  const displayError = errorMsg || (
    errorCode === 'password'
      ? 'Mot de passe incorrect. Vérifiez la variable ADMIN_PASSWORD sur Render.'
      : errorCode === 'missing'
      ? "La variable ADMIN_PASSWORD n'est pas encore configurée sur Render."
      : errorCode === 'staff'
      ? "Ce compte n'a pas accès au back-office."
      : errorCode === 'suspended'
      ? "Ce compte est suspendu. Contactez un super-administrateur."
      : errorCode === 'session'
      ? "Votre session a expiré. Reconnectez-vous."
      : errorCode === 'config'
      ? "Configuration serveur incomplète. Vérifiez les variables d'environnement sur Render."
      : errorCode
      ? `Erreur d'authentification (${errorCode}). Réessayez.`
      : null
  );

  return (
    <div className="login-shell">

      {/* ── Panneau gauche : présentation ── */}
      <section className="login-showcase" aria-label="Imo Nord Togo — Espace d'administration">

        {/* Décoration : cercle orbital */}
        <div className="login-showcase-orbit" aria-hidden="true">
          <span>IP</span>
        </div>

        {/* Logo / marque */}
        <div className="login-showcase-brand">
          <span className="login-showcase-mark" aria-hidden="true">IP</span>
          <span>IMO&nbsp;<strong>NORD TOGO</strong></span>
        </div>

        {/* Titre principal */}
        <div className="login-showcase-copy">
          <div className="login-showcase-eyebrow">ESPACE D&apos;ADMINISTRATION</div>
          <h1>
            Gestion &amp; Pilotage<br />
            <em>Imo Nord Togo</em>
          </h1>
          <p>
            Back-office sécurisé réservé aux administrateurs de la plateforme immobilière.
            Gérez les annonces, les agents et les utilisateurs depuis un seul espace.
          </p>
        </div>

        {/* Pied de page showcase */}
        <div className="login-showcase-footer">
          <span className="login-showcase-live" aria-hidden="true" />
          <span>Accès direct sécurisé</span>
          <span className="login-showcase-divider" aria-hidden="true" />
          <span>Render · Supabase</span>
        </div>
      </section>

      {/* ── Panneau droit : formulaire de connexion ── */}
      <div className="login-card" role="main">
        <div className="login-card-heading">
          <div className="login-card-eyebrow">ACCÈS ADMINISTRATEUR</div>
          <h2>Connexion au Back-Office</h2>
          <p>Entrez le mot de passe unique configuré dans les variables d&apos;environnement Render.</p>
        </div>

        {/* Formulaire HTML natif — fonctionne sans JS côté client */}
        <form action="/api/auth/master-login" method="POST" autoComplete="off">
          <div className="form-field">
            <label htmlFor="admin-password">Mot de passe Back-Office</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              placeholder="••••••••••••"
              autoFocus
              required
              autoComplete="current-password"
              aria-describedby={displayError ? 'login-error' : undefined}
              aria-invalid={displayError ? true : undefined}
            />
          </div>

          {displayError ? (
            <div
              id="login-error"
              role="alert"
              className="alert"
              style={{ marginTop: 14, display: 'block' }}
            >
              {displayError}
            </div>
          ) : null}

          <button
            type="submit"
            className="primary-button"
            style={{ width: '100%', marginTop: 20 }}
          >
            Déverrouiller le Back-Office
          </button>
        </form>

        {/* Note de sécurité */}
        <p style={{
          marginTop: 8,
          fontSize: 11,
          color: 'rgba(160,170,185,0.7)',
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          Accès réservé aux administrateurs autorisés.<br />
          Session valide 7 jours.
        </p>
      </div>
    </div>
  );
}
