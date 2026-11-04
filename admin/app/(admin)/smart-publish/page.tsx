'use client';

import LoadingState from '../../../components/LoadingState';
import { useSession } from '../../../lib/useSession';

export default function SmartPublishPage() {
  const { profile, loading } = useSession();

  if (loading) return <LoadingState />;

  if (!profile) return null;

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
          Fonctionnalité en cours de développement.
        </p>
      </section>
    </div>
  );
}
