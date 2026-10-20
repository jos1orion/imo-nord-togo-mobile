'use client';

import { useRouter } from 'next/navigation';
import DataTable from '../../../components/DataTable';
import LoadingState from '../../../components/LoadingState';
import SectionHeader from '../../../components/SectionHeader';
import { formatDate } from '../../../lib/format';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import { updateAdminRecord } from '../../../lib/adminMutations';
import { logActivity } from '../../../lib/logActivity';

type ReportRow = {
  id: string;
  property_id: string;
  reason: string;
  message: string;
  status: 'OPEN' | 'RESOLVED';
  created_at: string;
};

export default function ReportsPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useSupabaseTable<ReportRow>('property_reports', { orderBy: 'created_at' });

  const resolve = async (id: string) => {
    try {
      await updateAdminRecord('property_reports', id, { status: 'RESOLVED' });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur inconnue');
      return;
    }
    try {
      await logActivity('resolve', 'report', id);
    } catch (error) {
      alert(
        `Signalement traité, mais le journal d’activité n’a pas été enregistré : ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`
      );
    }
    reload();
  };

  return (
    <div className="grid">
      <SectionHeader title="Signalements" subtitle="Fraude, doublons et contenus inappropriés." />
      {loading ? <LoadingState /> : (
        <DataTable
          loading={loading}
          error={error}
          onRetry={reload}
          rows={data}
          emptyLabel="Aucun signalement."
          columns={[
            { key: 'created_at', label: 'Date', render: row => formatDate(row.created_at) },
            { key: 'reason', label: 'Motif' },
            { key: 'message', label: 'Message' },
            { key: 'status', label: 'Statut' },
            {
              key: 'actions',
              label: '',
              render: row => (
                <div className="pill-row">
                  <button className="ghost-button small" onClick={() => router.push(`/properties/${row.property_id}`)}>Bien</button>
                  {row.status === 'OPEN' ? (
                    <button className="primary-button small" onClick={() => resolve(row.id)}>Traiter</button>
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
