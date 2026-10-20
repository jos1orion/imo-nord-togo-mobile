'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DataTable from '../../../components/DataTable';
import LoadingState from '../../../components/LoadingState';
import SectionHeader from '../../../components/SectionHeader';
import { formatDate } from '../../../lib/format';
import { useCurrentTime } from '../../../lib/useCurrentTime';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import type { Publication } from '../../../lib/types';

type PublicationRow = Publication & {
  property?: { title: string; location: string } | null;
};

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

export default function PublicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTime = useCurrentTime();
  const filter = searchParams.get('filter');
  const { data, loading, error, reload } = useSupabaseTable<PublicationRow>('publications', {
    select: '*, property:properties!publications_property_id_fkey(title, location)',
    orderBy: 'created_at',
  });
  const [status, setStatus] = useState('ALL');

  const rows = useMemo(() => {
    return data.filter(row => {
      if (status !== 'ALL' && row.status !== status) return false;
      if (filter === 'expiring') {
        if (currentTime === null || !row.expires_at || row.status !== 'approved') return false;
        const ms = new Date(row.expires_at).getTime() - currentTime;
        return ms >= 0 && ms <= THREE_DAYS;
      }
      return true;
    });
  }, [data, status, filter, currentTime]);

  return (
    <div className="grid">
      <SectionHeader
        title="Publications"
        subtitle="Cycles de 30 jours. Un bien peut avoir plusieurs publications dans le temps. Le paiement sera branché ici plus tard (pending → paid → validation)."
      />
      <div className="pill-row">
        {['ALL', 'pending', 'approved', 'archived', 'rejected'].map(key => (
          <button key={key} className={status === key ? 'primary-button small' : 'ghost-button small'} onClick={() => setStatus(key)}>
            {key}
          </button>
        ))}
      </div>
      {loading ? <LoadingState /> : error ? (
        <div className="card">
          <div className="alert">
            Impossible de charger les publications : {error}
          </div>
          <p>
            La requête utilise le lien de l’annonce vers le bien. Si l’erreur persiste après
            actualisation, vérifiez les relations de la table <code>publications</code> dans Supabase.
          </p>
          <button className="ghost-button" onClick={() => void reload()}>
            Réessayer
          </button>
        </div>
      ) : (
        <DataTable
          loading={loading}
          rows={rows}
          emptyLabel={
            data.length === 0
              ? 'Aucune publication enregistrée. Si des biens existent, vérifiez que supabase/migrations/0006_admin_platform.sql a été appliquée.'
              : filter === 'expiring'
                ? 'Aucune publication n’expire dans les trois prochains jours.'
                : status === 'ALL'
                  ? 'Aucune publication enregistrée.'
                  : `Aucune publication avec le statut « ${status} ».`
          }
          columns={[
            { key: 'id', label: 'ID', render: row => row.id.slice(0, 8) },
            { key: 'title', label: 'Bien', render: row => row.property?.title ?? row.property_id.slice(0, 8) },
            { key: 'status', label: 'Statut' },
            { key: 'payment_status', label: 'Paiement' },
            { key: 'submitted_at', label: 'Début', render: row => formatDate(row.submitted_at) },
            { key: 'expires_at', label: 'Fin', render: row => (row.expires_at ? formatDate(row.expires_at) : '—') },
            {
              key: 'open',
              label: '',
              render: row => (
                <button className="ghost-button small" onClick={() => router.push(`/properties/${row.property_id}`)}>
                  Fiche
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
