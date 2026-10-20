'use client';

import DataTable from '../../../components/DataTable';
import LoadingState from '../../../components/LoadingState';
import SectionHeader from '../../../components/SectionHeader';
import { formatDate } from '../../../lib/format';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import { updateAdminRecord } from '../../../lib/adminMutations';

type ReviewRow = {
  id: string;
  property_id: string;
  rating: number;
  comment: string;
  verified: boolean;
  created_at: string;
};

export default function ReviewsPage() {
  const { data, loading, error, reload } = useSupabaseTable<ReviewRow>('reviews', { orderBy: 'created_at' });

  const toggle = async (row: ReviewRow) => {
    try {
      await updateAdminRecord('reviews', row.id, { verified: !row.verified });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur inconnue');
      return;
    }
    reload();
  };

  return (
    <div className="grid">
      <SectionHeader title="Avis" subtitle="Modération des notes et commentaires." />
      {loading ? <LoadingState /> : (
        <DataTable
          loading={loading}
          error={error}
          onRetry={reload}
          rows={data}
          emptyLabel="Aucun avis. La table reviews est créée par supabase-admin-platform.sql."
          columns={[
            { key: 'created_at', label: 'Date', render: row => formatDate(row.created_at) },
            { key: 'rating', label: 'Note' },
            { key: 'comment', label: 'Commentaire' },
            { key: 'verified', label: 'Modéré', render: row => (row.verified ? 'Oui' : 'Non') },
            {
              key: 'actions',
              label: '',
              render: row => (
                <button className="ghost-button small" onClick={() => toggle(row)}>
                  {row.verified ? 'Retirer' : 'Valider'}
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
