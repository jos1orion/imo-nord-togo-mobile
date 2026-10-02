'use client';

import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { formatDate } from '../../../lib/format';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';

type DocRow = {
  id: string;
  tenant_id: string;
  type: string;
  url: string;
  created_at: string;
};

export default function DocumentsPage() {
  const { data, loading } = useSupabaseTable<DocRow>('tenant_documents', { orderBy: 'created_at' });

  return (
    <div className="grid">
      <SectionHeader title="Documents" subtitle="Pièces liées aux dossiers locataires." />
      {loading ? <div className="card">Chargement...</div> : (
        <DataTable
          rows={data}
          emptyLabel="Aucun document."
          columns={[
            { key: 'created_at', label: 'Date', render: row => formatDate(row.created_at) },
            { key: 'type', label: 'Type' },
            { key: 'tenant_id', label: 'Locataire', render: row => row.tenant_id.slice(0, 8) },
            {
              key: 'url',
              label: 'Fichier',
              render: row => (
                <a href={row.url} target="_blank" rel="noreferrer">
                  Ouvrir
                </a>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
