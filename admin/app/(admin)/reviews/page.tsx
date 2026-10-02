'use client';

import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { formatDate } from '../../../lib/format';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import { supabase } from '../../../lib/supabaseClient';

type ReviewRow = {
  id: string;
  property_id: string;
  rating: number;
  comment: string;
  verified: boolean;
  created_at: string;
};

export default function ReviewsPage() {
  const { data, loading, reload } = useSupabaseTable<ReviewRow>('reviews', { orderBy: 'created_at' });

  const toggle = async (row: ReviewRow) => {
    const { error } = await supabase.from('reviews').update({ verified: !row.verified }).eq('id', row.id);
    if (error) {
      alert(error.message);
      return;
    }
    reload();
  };

  return (
    <div className="grid">
      <SectionHeader title="Avis" subtitle="Modération des notes et commentaires." />
      {loading ? <div className="card">Chargement...</div> : (
        <DataTable
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
