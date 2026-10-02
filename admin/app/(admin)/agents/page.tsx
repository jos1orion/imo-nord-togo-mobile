'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import { supabase } from '../../../lib/supabaseClient';
import { logActivity } from '../../../lib/logActivity';
import type { Profile } from '../../../lib/useSession';
import type { Property } from '../../../lib/types';

export default function AgentsPage() {
  const router = useRouter();
  const { data: profiles, loading, reload } = useSupabaseTable<Profile>('profiles', { orderBy: 'created_at' });
  const { data: properties } = useSupabaseTable<Property>('properties', { orderBy: 'created_at' });
  const agents = profiles.filter(row => row.role === 'AGENT');

  const statsByAgent = useMemo(() => {
    const map = new Map<string, { total: number; active: number; sold: number; rented: number; expired: number }>();
    properties.forEach(property => {
      const owner = property.owner_id;
      if (!owner) return;
      const current = map.get(owner) ?? { total: 0, active: 0, sold: 0, rented: 0, expired: 0 };
      current.total += 1;
      if (property.listing_status === 'approved' && property.status === 'available') current.active += 1;
      if (property.sold_at) current.sold += 1;
      if (property.rented_at) current.rented += 1;
      if (property.listing_status === 'archived') current.expired += 1;
      map.set(owner, current);
    });
    return map;
  }, [properties]);

  const setStatus = async (id: string, account_status: 'active' | 'suspended' | 'pending') => {
    const { error } = await supabase.from('profiles').update({ account_status }).eq('id', id);
    if (error) {
      alert(error.message);
      return;
    }
    try {
      await logActivity(account_status, 'agent', id);
    } catch (error) {
      alert(
        `Statut modifié, mais le journal d’activité n’a pas été enregistré : ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`
      );
    }
    reload();
  };

  return (
    <div className="grid">
      <SectionHeader title="Agents" subtitle="Comptes AGENT, leurs publications, suspension et réactivation." />
      {loading ? <div className="card">Chargement...</div> : (
        <DataTable
          rows={agents}
          emptyLabel="Aucun agent."
          columns={[
            { key: 'full_name', label: 'Agent', render: row => row.full_name || row.id.slice(0, 8) },
            { key: 'account_status', label: 'Statut', render: row => row.account_status ?? 'active' },
            { key: 'total', label: 'Publications', render: row => `${statsByAgent.get(row.id)?.total ?? 0}` },
            { key: 'active', label: 'Actives', render: row => `${statsByAgent.get(row.id)?.active ?? 0}` },
            { key: 'sold', label: 'Vendues', render: row => `${statsByAgent.get(row.id)?.sold ?? 0}` },
            { key: 'expired', label: 'Expirées', render: row => `${statsByAgent.get(row.id)?.expired ?? 0}` },
            {
              key: 'actions',
              label: '',
              render: row => (
                <div className="pill-row">
                  <button className="ghost-button small" onClick={() => router.push(`/properties?owner=${row.id}`)}>Biens</button>
                  {row.account_status === 'suspended' ? (
                    <button className="primary-button small" onClick={() => setStatus(row.id, 'active')}>Réactiver</button>
                  ) : (
                    <button className="ghost-button small" onClick={() => setStatus(row.id, 'suspended')}>Suspendre</button>
                  )}
                  {row.account_status === 'pending' ? (
                    <button className="primary-button small" onClick={() => setStatus(row.id, 'active')}>Valider</button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
