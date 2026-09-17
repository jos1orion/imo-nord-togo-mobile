'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ActivityFeed from '../../components/ActivityFeed';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import { supabase } from '../../lib/supabaseClient';
import { formatCurrency, formatDate } from '../../lib/format';
import { useRouter } from 'next/navigation';

type PropertyRow = { id: string; status: 'available' | 'occupied'; listing_status: 'pending' | 'approved' | 'rejected' | 'archived' };
type PaymentRow = { id: string; amount: number; paid_at: string; status: 'paid' | 'late' | 'pending' };
type LogRow = { id: string; action: string; entity: string; created_at: string; actor_name: string | null };

type DashboardStats = {
  totalProperties: number;
  pendingApproval: number;
  occupancyRate: number;
  monthRevenue: number;
};

const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export default function DashboardPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const [propRes, payRes, logRes] = await Promise.all([
      supabase.from('properties').select('id,status,listing_status'),
      supabase.from('payments').select('id,amount,paid_at,status'),
      supabase
        .from('activity_logs')
        .select('id,action,entity,created_at,actor_name')
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

    setProperties((propRes.data as PropertyRow[]) ?? []);
    setPayments((payRes.data as PaymentRow[]) ?? []);
    setLogs((logRes.data as LogRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, loadDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, loadDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, loadDashboard)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

  const stats = useMemo<DashboardStats>(() => {
    const now = new Date();
    const monthKey = getMonthKey(now);
    const monthPayments = payments.filter(
      payment => payment.status === 'paid' && getMonthKey(new Date(payment.paid_at)) === monthKey
    );
    const monthRevenue = monthPayments.reduce((acc, p) => acc + p.amount, 0);

    return {
      totalProperties: properties.length,
      pendingApproval: properties.filter(p => p.listing_status === 'pending').length,
      occupancyRate: properties.length
        ? Math.round((properties.filter(p => p.status === 'occupied').length / properties.length) * 100)
        : 0,
      monthRevenue,
    };
  }, [properties, payments]);

  const revenueSeries = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index));
      return date;
    });

    return months.map(date => {
      const key = getMonthKey(date);
      const total = payments
        .filter(payment => payment.status === 'paid' && getMonthKey(new Date(payment.paid_at)) === key)
        .reduce((acc, payment) => acc + payment.amount, 0);
      return {
        label: date.toLocaleDateString('fr-FR', { month: 'short' }),
        value: total,
      };
    });
  }, [payments]);

  const maxRevenue = Math.max(1, ...revenueSeries.map(item => item.value));

  return (
    <div className="grid">
      <SectionHeader
        title="Tableau de bord"
        subtitle="Vue temps reel : biens, loyers, impayes et activites."
        actions={
          <>
            <button className="ghost-button" onClick={loadDashboard}>
              Rafraichir
            </button>
            <button className="primary-button" onClick={() => router.push('/properties')}>
              Nouveau bien
            </button>
          </>
        }
      />

      {loading ? <div className="card">Chargement des donnees...</div> : null}

      <div className="grid grid-cols-4">
        <StatCard label="Total biens" value={`${stats.totalProperties}`} delta="Inventaire global" />
        <StatCard label="En attente" value={`${stats.pendingApproval}`} delta="Validation requise" />
        <StatCard label="Revenus mensuels" value={formatCurrency(stats.monthRevenue)} delta="Ce mois-ci" />
        <StatCard label="Taux d'occupation" value={`${stats.occupancyRate}%`} delta="Performance" />
      </div>

      <div className="grid grid-cols-2">
        <div className="card">
          <div className="split">
            <div>
              <div style={{ fontWeight: 600 }}>Revenus (6 derniers mois)</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>Suivi des loyers encaisses.</div>
            </div>
            <div className="pill">Temps reel</div>
          </div>
          <div className="chart" style={{ marginTop: 16 }}>
            {revenueSeries.map(item => (
              <div key={item.label} className="chart-bar">
                <div
                  className="chart-bar-fill"
                  style={{ height: `${(item.value / maxRevenue) * 100}%` }}
                />
                <div className="chart-bar-value">{formatCurrency(item.value)}</div>
                <div className="chart-bar-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="split">
            <div>
              <div style={{ fontWeight: 600 }}>Activites recentes</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>Suivi des operations sensibles.</div>
            </div>
            <div className="pill">{stats.pendingApproval} biens en attente</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <ActivityFeed
              items={
                logs.length
                  ? logs.map(log => ({
                      title: `${log.action} - ${log.entity}`,
                      meta: `${log.actor_name || 'Système'} | ${formatDate(log.created_at)}`,
                    }))
                  : [
                      {
                        title: 'Aucune activite recente',
                        meta: 'Les operations apparaitront ici.',
                      },
                    ]
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
