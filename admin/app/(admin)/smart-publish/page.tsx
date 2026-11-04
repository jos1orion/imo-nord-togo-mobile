/* eslint-disable react/no-unescaped-entities */
'use client';

import LoadingState from '../../../components/LoadingState';
import { useSession } from '../../../lib/useSession';

export default function SmartPublishPage() {
  const { profile, loading } = useSession();

  if (loading) return <LoadingState />;

  if (!profile) {
    return (
      <div className="page-container" role="main" aria-label="Écran d'accès non disponible">
        <h1>Accès non disponible</h1>
        <p>Votre session a expiré ou vous n'avez pas les droits nécessaires.</p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <a href="/admin/login" className="primary-button">Se reconnecter</a>
          <a href="/admin" className="ghost-button">Retour au Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" aria-label="Smart Publish - Publication de biens">
      <header className="page-header">
        <h1 className="page-title">Smart Publish</h1>
        <p className="page-description">
          Publiez vos biens immobiliers avec nos outils optimisés
        </p>
      </header>

      <section className="page-section" aria-labelledby="publish-title">
        <h2 id="publish-title" className="section-title">Publication</h2>
        <p>
          Cette page permet de publier et gérer les biens immobiliers.
          <br />
          <em>Cette fonctionnalité sera bientôt disponible.</em>
        </p>
      </section>
    </div>
  );
}
