'use client';

import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { formatDate } from '../../../lib/format';
import { supabase } from '../../../lib/supabaseClient';
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
  const openDocument = async (path: string) => {
    if (/^https?:\/\//i.test(path)) {
      window.open(path, '_blank', 'noopener,noreferrer');
      return;
    }
    const popup = window.open('', '_blank');
    if (!popup) {
      alert('Autorisez les fenêtres contextuelles pour ouvrir le document.');
      return;
    }
    popup.opener = null;
    try {
      const { data: signed, error } = await supabase.storage
        .from('tenant-documents')
        .createSignedUrl(path, 60);
      if (error) throw error;
      popup.location.replace(signed.signedUrl);
    } catch (error) {
      popup.close();
      alert(`Impossible d’ouvrir le document : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

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
                <a
                  href={row.url.startsWith('http') ? row.url : '#'}
                  onClick={event => {
                    event.preventDefault();
                    void openDocument(row.url);
                  }}
                >
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
