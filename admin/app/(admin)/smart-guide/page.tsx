/* eslint-disable react/no-unescaped-entities */
'use client';

import LoadingState from '../../../components/LoadingState';
import { useSession } from '../../../lib/useSession';

function StatCard({ title, value, icon }: { title: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="stat-card" role="region" aria-label={title}>
      <div className="stat-card-icon" aria-hidden="true">{icon}</div>
      <div className="stat-card-content">
        <div className="stat-card-title">{title}</div>
        <div className="stat-card-value">{value}</div>
      </div>
    </div>
  );
}

export default function SmartGuidePage() {
  const { profile, loading } = useSession();

  if (loading) return <LoadingState />;

  if (!profile) return null;

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
          <StatCard
            title="Biens mieux vendus"
            value="3"
            icon={<span aria-hidden="true">📈</span>}
          />
          <StatCard
            title="Prix moyen"
            value="15M FCFA"
            icon={<span aria-hidden="true">💰</span>}
          />
          <StatCard
            title="Durée moyenne de vente"
            value="45 jours"
            icon={<span aria-hidden="true">⏱️</span>}
          />
        </div>
      </section>
    </div>
  );
}
