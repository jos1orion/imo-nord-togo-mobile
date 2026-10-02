'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import ActivityFeed from '../../components/ActivityFeed';
import { supabase } from '../../lib/supabaseClient';
import { formatDate } from '../../lib/format';
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
  const { profile } = useSession();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [reportsOpen, setReportsOpen] = useState(0);
  const [pendingAgents, setPendingAgents] = useState(0);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const [propRes, reportRes, profileRes, logRes] = await Promise.all([
      supabase.from('properties').select('id,owner_id,status,listing_status,featured,expires_at,sold_at,rented_at'),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'OPEN'),
      supabase.from('profiles').select('id,role,account_status'),
      supabase.from('activity_logs').select('id,action,entity,created_at,actor_name').order('created_at', { ascending: false }).limit(8),
    ]);
    setProperties((propRes.data as PropertyRow[]) ?? []);
    setReportsOpen(reportRes.count ?? 0);
    const agents = ((profileRes.data as ProfileRow[]) ?? []).filter(row => row.role === 'AGENT');
    setPendingAgents(agents.filter(row => row.account_status === 'pending').length);
    setLogs((logRes.data as LogRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, loadDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, loadDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, loadDashboard)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const now = Date.now();
    const expiringSoon = properties.filter(p => {
      if (p.listing_status !== 'approved' || !p.expires_at) return false;
      const ms = new Date(p.expires_at).getTime() - now;
      return ms >= 0 && ms <= THREE_DAYS;
    }).length;
    return {
      active: properties.filter(p => p.listing_status === 'approved' && p.status === 'available').length,
      pending: properties.filter(p => p.listing_status === 'pending').length,
      approved: properties.filter(p => p.listing_status === 'approved').length,
      rejected: properties.filter(p => p.listing_status === 'rejected').length,
      featured: properties.filter(p => p.featured).length,
      expiringSoon,
      expired: properties.filter(p => p.listing_status === 'archived').length,
      sold: properties.filter(p => Boolean(p.sold_at)).length,
      rented: properties.filter(p => Boolean(p.rented_at) && !p.sold_at).length,
      occupied: properties.filter(p => p.status === 'occupied').length,
    };
  }, [properties]);

  const actions = [
    { count: stats.pending, label: 'annonces attendent votre validation', href: '/properties?tab=pending' },
    { count: reportsOpen, label: 'signalements nécessitent une intervention', href: '/reports' },
    { count: stats.expiringSoon, label: 'publications expirent dans 3 jours', href: '/publications?filter=expiring' },
    { count: pendingAgents, label: 'agents attendent une validation', href: '/agents' },
  ].filter(item => profile?.role === 'AGENT' ? item.href.startsWith('/properties') || item.href.startsWith('/publications') : true);

  return (
    <div className="grid">
      <SectionHeader
        title="Tableau de bord"
        subtitle={profile?.role === 'AGENT' ? 'Vos annonces et publications.' : "Aujourd'hui : activité, validations et alertes."}
        actions={
          <>
            <button className="ghost-button" onClick={loadDashboard}>Rafraîchir</button>
            {profile?.role !== 'ACCOUNTANT' ? (
              <button className="primary-button" onClick={() => router.push('/properties')}>Biens</button>
            ) : null}
          </>
        }
      />

      {loading ? <div className="card">Chargement des données...</div> : null}

      <h3 className="section-kicker">Aujourd&apos;hui</h3>
      <div className="grid grid-cols-4">
        <StatCard label="Biens actifs" value={`${stats.active}`} delta="Approuvés et disponibles" />
        <StatCard label="En attente" value={`${stats.pending}`} delta="Validation requise" />
        <StatCard label="Approuvés" value={`${stats.approved}`} delta={`${stats.rejected} rejetés`} />
        <StatCard label="Featured" value={`${stats.featured}`} delta={`${stats.expiringSoon} expirent sous 3 jours`} />
      </div>
      <div className="grid grid-cols-3">
        <StatCard label="Expirations proches" value={`${stats.expiringSoon}`} delta="Moins de 3 jours" />
        <StatCard label="Signalements ouverts" value={`${reportsOpen}`} delta="Modération" />
        <StatCard label="Occupés" value={`${stats.occupied}`} delta={`${stats.sold} vendus · ${stats.rented} loués`} />
      </div>

      <div className="grid grid-cols-2">
        <div className="card">
          <div style={{ fontWeight: 600 }}>Publications</div>
          <div className="stat-lines">
            <div><span>Actives</span><strong>{stats.active}</strong></div>
            <div><span>En attente</span><strong>{stats.pending}</strong></div>
            <div><span>Expirées</span><strong>{stats.expired}</strong></div>
            <div><span>Vendues</span><strong>{stats.sold}</strong></div>
            <div><span>Louées</span><strong>{stats.rented}</strong></div>
          </div>
        </div>
        <div className="card">
          <div className="split">
            <div>
              <div style={{ fontWeight: 600 }}>Actions à effectuer</div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Priorités du jour</div>
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

      <div className="card">
        <div style={{ fontWeight: 600 }}>Activité récente</div>
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
    </div>
  );
}
