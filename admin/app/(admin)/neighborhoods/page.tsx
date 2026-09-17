'use client';

import { useMemo, useState } from 'react';
import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { supabase } from '../../../lib/supabaseClient';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import type { Neighborhood } from '../../../lib/types';

const emptyForm = { name: '' };
type PropertyNeighborhoodRow = { id: string; neighborhood: string | null };

export default function NeighborhoodsPage() {
  const { data: neighborhoods, loading, reload } = useSupabaseTable<Neighborhood>('neighborhoods', {
    orderBy: 'name',
    ascending: true,
  });
  const { data: propertyRows } = useSupabaseTable<PropertyNeighborhoodRow>('properties', {
    select: 'id, neighborhood',
    orderBy: 'created_at',
  });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const neighborhoodCounts = useMemo(() => {
    const map = new Map<string, number>();
    propertyRows.forEach(row => {
      if (!row.neighborhood) return;
      const key = row.neighborhood.toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [propertyRows]);

  const handleSubmit = async () => {
    const cleaned = form.name.trim();
    if (!cleaned) return;
    const exists = neighborhoods.some(
      item => item.name.toLowerCase() === cleaned.toLowerCase() && item.id !== editingId
    );
    if (exists) {
      alert('Ce quartier existe deja.');
      return;
    }
    setSaving(true);
    if (editingId) {
      await supabase.from('neighborhoods').update({ name: cleaned }).eq('id', editingId);
    } else {
      await supabase.from('neighborhoods').insert({ name: cleaned });
    }
    setForm(emptyForm);
    setEditingId(null);
    setSaving(false);
    reload();
  };

  const handleEdit = (row: Neighborhood) => {
    setEditingId(row.id);
    setForm({ name: row.name });
  };

  const handleDelete = async (row: Neighborhood) => {
    const count = neighborhoodCounts.get(row.name.toLowerCase()) ?? 0;
    if (count > 0) {
      alert(`Ce quartier est utilise par ${count} bien(s). Deplacez-les avant suppression.`);
      return;
    }
    await supabase.from('neighborhoods').delete().eq('id', row.id);
    await supabase.from('properties').update({ neighborhood: null }).eq('neighborhood', row.name);
    reload();
  };

  return (
    <div className="grid">
      <SectionHeader
        title="Quartiers"
        subtitle="Ajoutez, modifiez ou supprimez les quartiers disponibles."
        actions={
          <button className="primary-button" onClick={() => setEditingId(null)}>
            Nouveau quartier
          </button>
        }
      />

      <div className="card form-card">
        <div className="form-grid">
          <div className="form-field form-span">
            <label>Nom du quartier</label>
            <input
              value={form.name}
              onChange={event => setForm({ name: event.target.value })}
              placeholder="Ex: Kpéwa"
            />
          </div>
        </div>
        <div className="form-actions">
          <button className="ghost-button" onClick={() => setForm(emptyForm)}>
            Reinitialiser
          </button>
          <button className="primary-button" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Enregistrement...' : editingId ? 'Mettre a jour' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <DataTable
        rows={neighborhoods}
        emptyLabel={loading ? 'Chargement...' : 'Aucun quartier enregistre'}
        columns={[
          { key: 'name', label: 'Quartier' },
          {
            key: 'count',
            label: 'Biens',
            align: 'right',
            render: row => neighborhoodCounts.get(row.name.toLowerCase()) ?? 0,
          },
          {
            key: 'created_at',
            label: 'Ajoute le',
            render: row => new Date(row.created_at).toLocaleDateString('fr-FR'),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: row => (
              <div className="table-actions">
                <button className="ghost-button" onClick={() => handleEdit(row)}>
                  Modifier
                </button>
                <button className="danger-button" onClick={() => handleDelete(row)}>
                  Supprimer
                </button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
