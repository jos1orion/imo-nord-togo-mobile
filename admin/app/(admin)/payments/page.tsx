'use client';

import { useEffect, useState } from 'react';
import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import StatusPill from '../../../components/StatusPill';
import { supabase } from '../../../lib/supabaseClient';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import { formatCurrency, formatDate } from '../../../lib/format';
import type { Contract, Payment, PaymentMethod, PaymentStatus, Tenant } from '../../../lib/types';
import { logAdminAction } from '../../../lib/adminAudit';

const emptyForm = {
  contract_id: '',
  amount: '',
  paid_at: '',
  method: 'cash' as PaymentMethod,
  status: 'paid' as PaymentStatus,
};

const printReceipt = (payload: Payment & { tenant?: string }) => {
  const win = window.open('', '_blank', 'width=800,height=700');
  if (!win) return;
  win.document.write(`
    <html>
      <head><title>Recu</title></head>
      <body style="font-family: Arial; padding: 24px;">
        <h2>Recu de paiement</h2>
        <p><strong>Locataire:</strong> ${payload.tenant ?? ''}</p>
        <p><strong>Date:</strong> ${payload.paid_at}</p>
        <p><strong>Montant:</strong> ${payload.amount}</p>
        <p><strong>Mode:</strong> ${payload.method}</p>
        <p><strong>Statut:</strong> ${payload.status}</p>
        <p>Signature: ________________________</p>
      </body>
    </html>
  `);
  win.document.close();
  win.print();
};

export default function PaymentsPage() {
  const { data: payments, loading, reload } = useSupabaseTable<Payment>('payments', { orderBy: 'paid_at' });
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      const [contractRes, tenantRes] = await Promise.all([
        supabase.from('contracts').select('id,tenant_id'),
        supabase.from('tenants').select('id,full_name'),
      ]);
      setContracts((contractRes.data as Contract[]) ?? []);
      setTenants((tenantRes.data as Tenant[]) ?? []);
    };
    loadOptions();
  }, []);

  const handleSubmit = async () => {
    if (!form.contract_id || !form.amount || !form.paid_at) return;
    setSaving(true);
    if (editingId) {
      const { error } = await supabase
        .from('payments')
        .update({
          contract_id: form.contract_id,
          amount: Number(form.amount),
          paid_at: form.paid_at,
          method: form.method,
          status: form.status,
        })
        .eq('id', editingId);
      if (error) {
        alert(`Erreur paiement: ${error.message}`);
        setSaving(false);
        return;
      }
      await logAdminAction('update_payment', 'payment', editingId);
    } else {
      const { data, error } = await supabase.from('payments').insert({
        contract_id: form.contract_id,
        amount: Number(form.amount),
        paid_at: form.paid_at,
        method: form.method,
        status: form.status,
      }).select('id').single();
      if (error) {
        alert(`Erreur paiement: ${error.message}`);
        setSaving(false);
        return;
      }
      await logAdminAction('create_payment', 'payment', data.id);
    }
    setForm(emptyForm);
    setEditingId(null);
    setSaving(false);
    reload();
  };

  const handleEdit = (payment: Payment) => {
    setEditingId(payment.id);
    setForm({
      contract_id: payment.contract_id,
      amount: String(payment.amount),
      paid_at: payment.paid_at,
      method: payment.method,
      status: payment.status,
    });
  };

  const handleDelete = async (paymentId: string) => {
    const { error } = await supabase.from('payments').delete().eq('id', paymentId);
    if (error) {
      alert(`Erreur suppression: ${error.message}`);
      return;
    }
    await logAdminAction('delete_payment', 'payment', paymentId);
    reload();
  };

  const getTenantName = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return 'Locataire';
    return tenants.find(t => t.id === contract.tenant_id)?.full_name ?? 'Locataire';
  };

  return (
    <div className="grid">
      <SectionHeader
        title="Gestion des paiements"
        subtitle="Suivi des loyers, impayes et reçus."
        actions={<button className="primary-button">Nouveau paiement</button>}
      />

      <div className="card form-card">
        <div className="form-grid">
          <div className="form-field">
            <label>Contrat</label>
            <select
              value={form.contract_id}
              onChange={event => setForm({ ...form, contract_id: event.target.value })}
            >
              <option value="">Selectionner un contrat</option>
              {contracts.map(contract => (
                <option key={contract.id} value={contract.id}>
                  {contract.id.slice(0, 8)} - {getTenantName(contract.id)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Montant (FCFA)</label>
            <input
              type="number"
              value={form.amount}
              onChange={event => setForm({ ...form, amount: event.target.value })}
              placeholder="150000"
            />
          </div>
          <div className="form-field">
            <label>Date paiement</label>
            <input
              type="date"
              value={form.paid_at}
              onChange={event => setForm({ ...form, paid_at: event.target.value })}
            />
          </div>
          <div className="form-field">
            <label>Mode</label>
            <select
              value={form.method}
              onChange={event => setForm({ ...form, method: event.target.value as PaymentMethod })}
            >
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile money</option>
            </select>
          </div>
          <div className="form-field">
            <label>Statut</label>
            <select
              value={form.status}
              onChange={event => setForm({ ...form, status: event.target.value as PaymentStatus })}
            >
              <option value="paid">Paye</option>
              <option value="late">En retard</option>
              <option value="pending">En attente</option>
            </select>
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
        rows={payments}
        emptyLabel={loading ? 'Chargement...' : 'Aucun paiement'}
        columns={[
          {
            key: 'contract_id',
            label: 'Locataire',
            render: row => getTenantName(row.contract_id),
          },
          {
            key: 'amount',
            label: 'Montant',
            align: 'right',
            render: row => formatCurrency(row.amount),
          },
          {
            key: 'paid_at',
            label: 'Date',
            render: row => formatDate(row.paid_at),
          },
          {
            key: 'method',
            label: 'Mode',
            render: row => (row.method === 'mobile_money' ? 'Mobile money' : 'Cash'),
          },
          {
            key: 'status',
            label: 'Statut',
            render: row => (
              <StatusPill
                status={
                  row.status === 'paid' ? 'Paye' : row.status === 'late' ? 'En retard' : 'En attente'
                }
                variant={row.status === 'paid' ? 'approved' : row.status === 'late' ? 'rejected' : 'pending'}
              />
            ),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: row => (
              <div className="table-actions">
                <button className="ghost-button" onClick={() => printReceipt({ ...row, tenant: getTenantName(row.contract_id) })}>
                  Recu PDF
                </button>
                <button className="ghost-button" onClick={() => handleEdit(row)}>
                  Modifier
                </button>
                <button className="danger-button" onClick={() => handleDelete(row.id)}>
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
