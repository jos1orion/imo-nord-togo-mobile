/* eslint-disable react/no-unescaped-entities */
'use client';

import LoadingState from '../../../components/LoadingState';
import { useSession } from '../../../lib/useSession';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card" role="region" aria-label={label}>
      <div className="stat-card-title">{label}</div>
      <div className="stat-card-value">{value}</div>
    </div>
  );
}

export default function SmartGuidePage() {
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
    <div className="page-container" aria-label="Smart Guide - Espace guide">
      <header className="page-header">
        <h1 className="page-title">Smart Guide</h1>
        <p className="page-description">
          Intelligences artificielles et conseils pour optimiser vos ventes
        </p>
      </header>

      <section className="page-section" aria-labelledby="insights-heading">
        <h2 id="insights-heading" className="section-title">Conseils intelligents</h2>
        <p className="section-description">
          Cette section fournit des recommandations basées sur l'analyse des données de propriétés.
        </p>
        <div className="dashboard-grid">
          <StatCard label="Biens mieux vendus" value="3" />
          <StatCard label="Prix moyen" value="15M FCFA" />
          <StatCard label="Durée moyenne de vente" value="45 jours" />
        </div>
      </section>
    </div>
  );
}
