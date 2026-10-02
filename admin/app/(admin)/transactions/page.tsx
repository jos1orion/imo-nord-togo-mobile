'use client';

import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { formatCurrency, formatDate } from '../../../lib/format';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';

type TxRow = {
  id: string;
  publication_id: string;
  amount: number;
  currency: string;
  provider: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
};

export default function TransactionsPage() {
  const { data, loading } = useSupabaseTable<TxRow>('publication_payments', { orderBy: 'created_at' });

  return (
    <div className="grid">
      <SectionHeader
        title="Transactions"
        subtitle="Historique financier des publications. Prêt pour un paiement externe (Mobile Money) sans portefeuille interne."
      />
      {loading ? <div className="card">Chargement...</div> : (
        <DataTable
          rows={data}
          emptyLabel="Aucune transaction publication. Les loyers restent dans Paiements."
          columns={[
            { key: 'created_at', label: 'Date', render: row => formatDate(row.created_at) },
            { key: 'amount', label: 'Montant', render: row => `${formatCurrency(row.amount)} ${row.currency}` },
            { key: 'provider', label: 'Fournisseur', render: row => row.provider || '—' },
            { key: 'status', label: 'Statut' },
            { key: 'publication_id', label: 'Publication', render: row => row.publication_id.slice(0, 8) },
          ]}
        />
      )}
    </div>
  );
}
