/* eslint-disable react/no-unescaped-entities */

export const metadata = {
  title: 'Accès refusé | ImoPrestige Back-office',
};

const ERROR_MESSAGES = {
  staff: "Accès interdit : ce compte n'a pas les droits nécessaires pour accéder à cette ressource.",
  admin: "Ce compte n'a pas les permissions administratives requises.",
  default: "Accès non autorisé. Vous n'avez pas les permissions requises pour accéder à cette page.",
};

export default function UnauthorizedPage() {
  const errorMessage = ERROR_MESSAGES.default;

  return (
    <div className="login-shell">
      <section className="login-showcase" aria-label="Imo Nord Togo - Espace d'administration">
        <div className="login-showcase-orbit" aria-hidden="true">
          <span>IP</span>
        </div>

        <div className="login-showcase-brand">
          <span className="login-showcase-mark" aria-hidden="true">IP</span>
          <span>IMO&nbsp;<strong>NORD TOGO</strong></span>
        </div>

        <div className="login-showcase-copy">
          <div className="login-showcase-eyebrow">ERREUR D'ACCÈS</div>
          <h1>
            Accès <em>interdit</em>
          </h1>
          <p>
            Vous n'avez pas les droits nécessaires pour accéder à cette ressource du back-office.
            Veuillez contacter un administrateur pour obtenir les permissions requises.
          </p>
        </div>

        <div className="login-showcase-footer">
          <span className="login-showcase-live" aria-hidden="true" />
          <span>Vérification des permissions</span>
          <span className="login-showcase-divider" aria-hidden="true" />
          <span>Render · Supabase</span>
        </div>
      </section>

      <div className="login-card" role="main">
        <div className="login-card-heading">
          <div className="login-card-eyebrow">ACCÈS REFUSÉ</div>
          <h2>Erreur 403 - Permissions insuffisantes</h2>
          <p>Votre session ne vous permet pas d'accéder à cette ressource.</p>
        </div>

        <div
          id="unauthorized-error"
          role="alert"
          className="alert"
          style={{ marginTop: 14, display: 'block' }}
        >
          {errorMessage}
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginTop: 8
        }}>
          <a
            href="/admin"
            className="primary-button"
            style={{
              width: '100%',
              textAlign: 'center',
              display: 'inline-block',
              minHeight: '44px'
            }}
          >
            Retour au Dashboard
          </a>
          <a
            href="/admin/login"
            className="ghost-button"
            style={{
              width: '100%',
              textAlign: 'center',
              display: 'inline-block',
              minHeight: '44px'
            }}
          >
            Retour à la connexion
          </a>
        </div>

        <p style={{
          marginTop: 8,
          fontSize: 11,
          color: '#a0aa-bd',
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
