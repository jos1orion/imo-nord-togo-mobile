'use client';

import { useRouter } from 'next/navigation';
import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { formatCurrency, formatDate } from '../../../lib/format';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import { supabase } from '../../../lib/supabaseClient';
import { logActivity } from '../../../lib/logActivity';
import type { Property } from '../../../lib/types';

export default function FeaturedPage() {
  const router = useRouter();
  const { data, loading, reload } = useSupabaseTable<Property>('properties', { orderBy: 'created_at' });
  const featured = data.filter(row => row.featured);

  const unfeature = async (id: string) => {
    const { error } = await supabase.from('properties').update({ featured: false }).eq('id', id);
    if (error) {
      alert(error.message);
      return;
    }
    try {
      await logActivity('unfeature', 'property', id);
    } catch (error) {
      alert(
        `Bien mis à jour, mais le journal d’activité n’a pas été enregistré : ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`
      );
    }
    reload();
  };

  return (
    <div className="grid">
      <SectionHeader title="Featured" subtitle="Annonces mises en avant (fenêtre 7 jours côté trigger)." />
      {loading ? <div className="card">Chargement...</div> : (
        <DataTable
          rows={featured}
          emptyLabel="Aucune annonce featured."
          columns={[
            { key: 'title', label: 'Bien' },
            { key: 'location', label: 'Lieu' },
            { key: 'price', label: 'Prix', render: row => formatCurrency(row.price) },
            { key: 'featured_end_at', label: 'Fin', render: row => (row.featured_end_at ? formatDate(row.featured_end_at) : '—') },
            {
              key: 'actions',
              label: '',
              render: row => (
                <div className="pill-row">
                  <button className="ghost-button small" onClick={() => router.push(`/properties/${row.id}`)}>Ouvrir</button>
                  <button className="ghost-button small" onClick={() => unfeature(row.id)}>Retirer</button>
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
