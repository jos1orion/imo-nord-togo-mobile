'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import ActivityFeed from '../../components/ActivityFeed';
import { supabase } from '../../lib/supabaseClient';
import { formatDate } from '../../lib/format';
import { useCurrentTime } from '../../lib/useCurrentTime';
import { useSession } from '../../lib/useSession';

type PropertyRow = {
  id: string;
  owner_id?: string | null;
  status: 'available' | 'occupied';
  listing_status: 'pending' | 'approved' | 'rejected' | 'archived';
  featured?: boolean;
  expires_at?: string | null;
  sold_at?: string | null;
  rented_at?: string | null;
};
type LogRow = { id: string; action: string; entity: string; created_at: string; actor_name: string | null };
type ProfileRow = { id: string; role: string; account_status?: string | null };

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

export default function DashboardPage() {
  const router = useRouter();
  const { profile, user, loading: sessionLoading } = useSession();
  const currentTime = useCurrentTime();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [reportsOpen, setReportsOpen] = useState(0);
  const [pendingAgents, setPendingAgents] = useState(0);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [financeStats, setFinanceStats] = useState({ contracts: 0, payments: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (sessionLoading) return;
    setLoading(true);
    setLoadError(null);

    if (!profile || !user) {
      setLoading(false);
      return;
    }

    if (profile.role === 'ACCOUNTANT') {
      const [contractRes, paymentRes] = await Promise.all([
        supabase.from('contracts').select('id', { count: 'exact', head: true }),
        supabase.from('payments').select('id', { count: 'exact', head: true }),
      ]);
      const errors = [contractRes.error?.message, paymentRes.error?.message].filter(Boolean);
      setFinanceStats({
        contracts: contractRes.count ?? 0,
        payments: paymentRes.count ?? 0,
      });
      setProperties([]);
      setReportsOpen(0);
      setPendingAgents(0);
      setLogs([]);
      setLoadError(errors.length ? errors.join(' ; ') : null);
      setLoading(false);
      return;
    }

    let propertyQuery = supabase
      .from('properties')
      .select('id,owner_id,status,listing_status,featured,expires_at,sold_at,rented_at');
    if (profile.role === 'AGENT') {
      propertyQuery = propertyQuery.eq('owner_id', user.id);
    }
    const propertyPromise = propertyQuery;
    if (profile.role === 'AGENT') {
      const propRes = await propertyPromise;
      setProperties((propRes.data as PropertyRow[]) ?? []);
      setReportsOpen(0);
      setPendingAgents(0);
      setLogs([]);
      setLoadError(propRes.error?.message ?? null);
      setLoading(false);
      return;
    }

    const [propRes, reportRes, profileRes, logRes] = await Promise.all([
      propertyPromise,
      supabase.from('property_reports').select('id', { count: 'exact', head: true }).eq('status', 'OPEN'),
      supabase.from('profiles').select('id,role,account_status'),
      supabase.from('activity_logs').select('id,action,entity,created_at,actor_name').order('created_at', { ascending: false }).limit(8),
    ]);
    const errors = [
      propRes.error?.message,
      reportRes.error?.message,
      profileRes.error?.message,
      logRes.error?.message,
    ].filter(Boolean);
    setProperties((propRes.data as PropertyRow[]) ?? []);
    setReportsOpen(reportRes.count ?? 0);
    const agents = ((profileRes.data as ProfileRow[]) ?? []).filter(row => row.role === 'AGENT');
    setPendingAgents(agents.filter(row => row.account_status === 'pending').length);
    setLogs((logRes.data as LogRow[]) ?? []);
    setLoadError(errors.length ? errors.join(' ; ') : null);
    setLoading(false);
  }, [profile, user, sessionLoading]);

  useEffect(() => {
    void Promise.resolve().then(loadDashboard);
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, loadDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'property_reports' }, loadDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, loadDashboard)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const now = currentTime ?? 0;
    const expiredPendingArchive = properties.filter(p => (
      p.listing_status === 'approved' &&
      p.expires_at !== null &&
      p.expires_at !== undefined &&
      new Date(p.expires_at).getTime() <= now
    )).length;
    const expiringSoon = properties.filter(p => {
      if (p.listing_status !== 'approved' || !p.expires_at) return false;
      const ms = new Date(p.expires_at).getTime() - now;
      return ms >= 0 && ms <= THREE_DAYS;
    }).length;
    return {
      active: properties.filter(p => (
        p.listing_status === 'approved' &&
        p.status === 'available' &&
        (!p.expires_at || new Date(p.expires_at).getTime() > now)
      )).length,
      pending: properties.filter(p => p.listing_status === 'pending').length,
      approved: properties.filter(p => p.listing_status === 'approved').length,
      rejected: properties.filter(p => p.listing_status === 'rejected').length,
      featured: properties.filter(p => p.featured).length,
      expiringSoon,
      expiredPendingArchive,
      expired: properties.filter(p => p.listing_status === 'archived').length,
      sold: properties.filter(p => Boolean(p.sold_at)).length,
      rented: properties.filter(p => Boolean(p.rented_at) && !p.sold_at).length,
      occupied: properties.filter(p => p.status === 'occupied').length,
    };
  }, [properties, currentTime]);

  const actions = [
    ...(profile?.role === 'ADMIN'
      ? [
          { count: stats.pending, label: 'annonces attendent votre validation', href: '/properties?tab=pending' },
          { count: reportsOpen, label: 'signalements nécessitent une intervention', href: '/reports' },
          { count: stats.expiringSoon, label: 'publications expirent dans 3 jours', href: '/publications?filter=expiring' },
          { count: pendingAgents, label: 'agents attendent une validation', href: '/agents' },
        ]
      : profile?.role === 'AGENT'
        ? [{
            count: stats.expiringSoon,
            label: 'de vos publications expirent dans 3 jours',
            href: '/publications?filter=expiring',
          }]
        : []),
  ];

  return (
    <div className="grid dashboard">
      <SectionHeader
        title="Tableau de bord"
        subtitle={
          profile?.role === 'AGENT'
            ? 'Vos annonces et publications.'
            : profile?.role === 'ACCOUNTANT'
              ? 'Suivi des contrats et paiements.'
              : "Aujourd'hui : activité, validations et alertes."
        }
        actions={
          <>
            <button className="ghost-button" onClick={loadDashboard}>Rafraîchir</button>
            {profile?.role !== 'ACCOUNTANT' ? (
              <button
                className="primary-button"
                onClick={() => router.push('/properties')}
              >
                Biens
              </button>
            ) : null}
          </>
        }
      />

      {loading ? <div className="card">Chargement des données...</div> : null}
      {loadError ? (
        <div className="alert" role="alert">
          Impossible de charger toutes les données du tableau de bord : {loadError}
          <button className="ghost-button small" onClick={loadDashboard}>Réessayer</button>
        </div>
      ) : null}

      {!loading && !loadError && profile?.role === 'ACCOUNTANT' ? (
        <>
          <div className="dashboard-section-heading">
            <div>
              <h2>Suivi comptable</h2>
              <p>Contrats et paiements accessibles à votre rôle.</p>
            </div>
            <span className="dashboard-period">Vue d&apos;ensemble</span>
          </div>
          <div className="grid grid-cols-2 dashboard-primary-stats">
            <StatCard label="Contrats" value={`${financeStats.contracts}`} delta="Contrats enregistrés" />
            <StatCard label="Paiements" value={`${financeStats.payments}`} delta="Paiements enregistrés" />
          </div>
        </>
      ) : null}

      {!loading && !loadError && profile?.role !== 'ACCOUNTANT' ? (
      <>
      <div className="dashboard-section-heading">
        <div>
          <h2>Aperçu de l&apos;activité</h2>
          <p>Les chiffres clés de votre portefeuille immobilier.</p>
        </div>
        <span className="dashboard-period">Vue d&apos;ensemble</span>
      </div>
      <div className="grid grid-cols-4 dashboard-primary-stats">
        <StatCard label="Biens actifs" value={`${stats.active}`} delta="Approuvés et disponibles" />
        <StatCard label="En attente" value={`${stats.pending}`} delta="Validation requise" />
        <StatCard label="Approuvés" value={`${stats.approved}`} delta={`${stats.rejected} rejetés`} />
        <StatCard label="Featured" value={`${stats.featured}`} delta={`${stats.expiringSoon} expirent sous 3 jours`} />
      </div>
      {profile?.role === 'ADMIN' ? (
      <div className="grid grid-cols-3 dashboard-secondary-stats">
        <StatCard label="Expirations proches" value={`${stats.expiringSoon}`} delta="Moins de 3 jours" />
        <StatCard label="Signalements ouverts" value={`${reportsOpen}`} delta="Modération" />
        <StatCard label="Occupés" value={`${stats.occupied}`} delta={`${stats.sold} vendus · ${stats.rented} loués`} />
      </div>
      ) : null}

      <div className="grid grid-cols-2 dashboard-panels">
        {profile?.role === 'ADMIN' ? (
          <div className="card dashboard-panel">
            <div className="dashboard-panel-heading">
              <div className="dashboard-panel-icon">⌂</div>
              <div>
                <h3>Publications</h3>
                <p>Répartition des annonces</p>
              </div>
            </div>
            <div className="stat-lines">
              <div><span>Actives</span><strong>{stats.active}</strong></div>
              <div><span>En attente</span><strong>{stats.pending}</strong></div>
              <div><span>Expirées, archivage en attente</span><strong>{stats.expiredPendingArchive}</strong></div>
              <div><span>Expirées</span><strong>{stats.expired}</strong></div>
              <div><span>Vendues</span><strong>{stats.sold}</strong></div>
              <div><span>Louées</span><strong>{stats.rented}</strong></div>
            </div>
          </div>
        ) : null}
        <div className="card dashboard-panel">
          <div className="dashboard-panel-heading">
            <div className="dashboard-panel-icon dashboard-panel-icon-alert">!</div>
            <div>
              <h3>Actions à effectuer</h3>
              <p>Les priorités du jour</p>
            </div>
          </div>
          <div className="action-list">
            {actions.every(item => item.count === 0) ? (
              <div className="action-empty">Aucune action urgente.</div>
            ) : (
              actions.map(item => (
                <button key={item.href} className="action-row" onClick={() => router.push(item.href)}>
                  <strong>{item.count}</strong>
                  <span>{item.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {profile?.role === 'ADMIN' ? (
        <div className="card dashboard-panel dashboard-activity-panel">
          <div className="dashboard-panel-heading">
            <div className="dashboard-panel-icon dashboard-panel-icon-activity">↗</div>
            <div>
              <h3>Activité récente</h3>
              <p>Les dernières opérations effectuées sur la plateforme.</p>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <ActivityFeed
              items={
                logs.length
                  ? logs.map(log => ({
                      title: `${log.action} — ${log.entity}`,
                      meta: `${log.actor_name || 'Système'} · ${formatDate(log.created_at)}`,
                    }))
                  : [{ title: 'Aucune activité récente', meta: 'Les opérations apparaîtront ici.' }]
              }
            />
          </div>
        </div>
      ) : null}
      </>
      ) : null}
    </div>
  );
}
