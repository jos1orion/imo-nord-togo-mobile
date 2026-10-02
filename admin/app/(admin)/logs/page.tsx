'use client';

import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { formatDate } from '../../../lib/format';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import type { ActivityLog } from '../../../lib/types';

export default function LogsPage() {
  const { data, loading } = useSupabaseTable<ActivityLog>('activity_logs', { orderBy: 'created_at' });

  return (
    <div className="grid">
      <SectionHeader title="Logs" subtitle="Historique des actions administratives." />
      {loading ? <div className="card">Chargement...</div> : (
        <DataTable
          rows={data}
          emptyLabel="Aucun log."
          columns={[
            { key: 'created_at', label: 'Date', render: row => formatDate(row.created_at) },
            { key: 'actor_name', label: 'Acteur', render: row => row.actor_name || '—' },
            { key: 'action', label: 'Action' },
            { key: 'entity', label: 'Entité' },
            { key: 'entity_id', label: 'ID', render: row => (row.entity_id ? row.entity_id.slice(0, 8) : '—') },
          ]}
        />
      )}
    </div>
  );
}
