'use client';

import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { formatDate } from '../../../lib/format';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';

type MessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
};

export default function MessagesPage() {
  const { data, loading } = useSupabaseTable<MessageRow>('messages', { orderBy: 'created_at' });

  return (
    <div className="grid">
      <SectionHeader title="Messages" subtitle="Suivi et modération des conversations." />
      {loading ? <div className="card">Chargement...</div> : (
        <DataTable
          rows={data}
          emptyLabel="Aucun message."
          columns={[
            { key: 'created_at', label: 'Date', render: row => formatDate(row.created_at) },
            { key: 'sender_id', label: 'De', render: row => row.sender_id.slice(0, 8) },
            { key: 'receiver_id', label: 'Vers', render: row => row.receiver_id.slice(0, 8) },
            { key: 'content', label: 'Aperçu' },
            { key: 'read', label: 'Lu', render: row => (row.read ? 'Oui' : 'Non') },
          ]}
        />
      )}
    </div>
  );
}
