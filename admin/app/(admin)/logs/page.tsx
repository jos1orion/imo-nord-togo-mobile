'use client';

import { useCallback, useEffect, useState } from 'react';
import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { formatDate } from '../../../lib/format';
import { supabase } from '../../../lib/supabaseClient';

type LogRow = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
};

const actionLabels: Record<string, string> = {
  create_user: 'Création de compte',
  update_user: 'Modification de compte',
  delete_user: 'Suppression de compte',
  approve_agent: 'Approbation agent',
  reject_agent: 'Refus agent',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('activity_logs')
      .select('id,actor_id,actor_name,action,entity,entity_id,created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (queryError) {
      setError('Impossible de charger les journaux.');
      setLogs([]);
    } else {
      setError(null);
      setLogs((data as LogRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLogs();
    const channel = supabase
      .channel('admin-activity-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => {
        void loadLogs();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLogs]);

  const columns = [
    {
      key: 'created_at',
      label: 'Date',
      render: (row: LogRow) => formatDate(row.created_at),
    },
    {
      key: 'actor_name',
      label: 'Administrateur',
      render: (row: LogRow) => row.actor_name ?? row.actor_id ?? '—',
    },
    {
      key: 'action',
      label: 'Action',
      render: (row: LogRow) => actionLabels[row.action] ?? row.action,
    },
    {
      key: 'entity',
      label: 'Entité',
      render: (row: LogRow) => row.entity,
    },
    {
      key: 'entity_id',
      label: 'Identifiant',
      render: (row: LogRow) => row.entity_id ?? '—',
    },
  ];

  return (
    <div className="grid">
      <SectionHeader
        title="Journaux d'activité"
        subtitle="Historique des actions administratives."
        actions={
          <button className="ghost-button" onClick={() => void loadLogs()} disabled={loading}>
            Actualiser
          </button>
        }
      />
      {error ? <div className="alert">{error}</div> : null}
      <DataTable
        rows={logs}
        columns={columns}
        emptyLabel={loading ? 'Chargement...' : 'Aucun journal disponible'}
      />
    </div>
  );
}
