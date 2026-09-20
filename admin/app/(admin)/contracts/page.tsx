'use client';

import { useEffect, useState } from 'react';
import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import StatusPill from '../../../components/StatusPill';
import { supabase } from '../../../lib/supabaseClient';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import { formatCurrency, formatDate } from '../../../lib/format';
import type { Contract, ContractStatus, Property, Tenant } from '../../../lib/types';
import { logAdminAction } from '../../../lib/adminAudit';

const emptyForm = {
  property_id: '',
  tenant_id: '',
  start_date: '',
  end_date: '',
  rent_amount: '',
  status: 'active' as ContractStatus,
};

const printContract = (payload: Contract & { property?: string; tenant?: string }) => {
  const win = window.open('', '_blank', 'width=800,height=700');
  if (!win) return;
  win.document.write(`
    <html>
      <head><title>Contrat</title></head>
      <body style="font-family: Arial; padding: 24px;">
        <h2>Contrat de location</h2>
        <p><strong>Bien:</strong> ${payload.property ?? ''}</p>
        <p><strong>Locataire:</strong> ${payload.tenant ?? ''}</p>
        <p><strong>Debut:</strong> ${payload.start_date}</p>
        <p><strong>Fin:</strong> ${payload.end_date}</p>
        <p><strong>Loyer mensuel:</strong> ${payload.rent_amount}</p>
        <p><strong>Statut:</strong> ${payload.status}</p>
        <p>Signature: ________________________</p>
      </body>
    </html>
  `);
  win.document.close();
  win.print();
};

export default function ContractsPage() {
  const { data: contracts, loading, reload } = useSupabaseTable<Contract>('contracts', { orderBy: 'created_at' });
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      const [propRes, tenantRes] = await Promise.all([
        supabase.from('properties').select('id,title,location'),
        supabase.from('tenants').select('id,full_name'),
      ]);
      setProperties((propRes.data as Property[]) ?? []);
      setTenants((tenantRes.data as Tenant[]) ?? []);
    };
    loadOptions();
  }, []);

  const handleSubmit = async () => {
    if (!form.property_id || !form.tenant_id || !form.start_date || !form.end_date || !form.rent_amount) return;
    setSaving(true);
    if (editingId) {
      const { error } = await supabase
        .from('contracts')
        .update({
          property_id: form.property_id,
          tenant_id: form.tenant_id,
          start_date: form.start_date,
          end_date: form.end_date,
          rent_amount: Number(form.rent_amount),
          status: form.status,
        })
        .eq('id', editingId);
      if (error) {
        alert(`Erreur contrat: ${error.message}`);
        setSaving(false);
        return;
      }
      await logAdminAction('update_contract', 'contract', editingId);
    } else {
      const { data, error } = await supabase.from('contracts').insert({
        property_id: form.property_id,
        tenant_id: form.tenant_id,
        start_date: form.start_date,
        end_date: form.end_date,
        rent_amount: Number(form.rent_amount),
        status: form.status,
      }).select('id').single();
      if (error) {
        alert(`Erreur contrat: ${error.message}`);
        setSaving(false);
        return;
      }
      await logAdminAction('create_contract', 'contract', data.id);
    }
    setForm(emptyForm);
    setEditingId(null);
    setSaving(false);
    reload();
  };

  const handleEdit = (contract: Contract) => {
    setEditingId(contract.id);
    setForm({
      property_id: contract.property_id,
      tenant_id: contract.tenant_id,
      start_date: contract.start_date,
      end_date: contract.end_date,
      rent_amount: String(contract.rent_amount),
      status: contract.status,
    });
  };

  const handleDelete = async (contractId: string) => {
    const { error } = await supabase.from('contracts').delete().eq('id', contractId);
    if (error) {
      alert(`Erreur suppression: ${error.message}`);
      return;
    }
    await logAdminAction('delete_contract', 'contract', contractId);
    reload();
  };

  return (
    <div className="grid">
      <SectionHeader
        title="Gestion des contrats"
        subtitle="Creer, suivre et exporter les contrats de location."
        actions={<button className="primary-button">Nouveau contrat</button>}
      />

      <div className="card form-card">
        <div className="form-grid">
          <div className="form-field">
            <label>Bien</label>
            <select
              value={form.property_id}
              onChange={event => setForm({ ...form, property_id: event.target.value })}
            >
              <option value="">Selectionner un bien</option>
              {properties.map(property => (
                <option key={property.id} value={property.id}>
                  {property.title} - {property.location}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Locataire</label>
            <select
              value={form.tenant_id}
              onChange={event => setForm({ ...form, tenant_id: event.target.value })}
            >
              <option value="">Selectionner un locataire</option>
              {tenants.map(tenant => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Date debut</label>
            <input
              type="date"
              value={form.start_date}
              onChange={event => setForm({ ...form, start_date: event.target.value })}
            />
          </div>
          <div className="form-field">
            <label>Date fin</label>
            <input
              type="date"
              value={form.end_date}
              onChange={event => setForm({ ...form, end_date: event.target.value })}
            />
          </div>
          <div className="form-field">
            <label>Loyer mensuel (FCFA)</label>
            <input
              type="number"
              value={form.rent_amount}
              onChange={event => setForm({ ...form, rent_amount: event.target.value })}
              placeholder="200000"
            />
          </div>
          <div className="form-field">
            <label>Statut</label>
            <select
              value={form.status}
              onChange={event => setForm({ ...form, status: event.target.value as ContractStatus })}
            >
              <option value="active">Actif</option>
              <option value="expired">Expire</option>
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
        rows={contracts}
        emptyLabel={loading ? 'Chargement...' : 'Aucun contrat'}
        columns={[
          {
            key: 'property_id',
            label: 'Bien',
            render: row => properties.find(p => p.id === row.property_id)?.title ?? row.property_id,
          },
          {
            key: 'tenant_id',
            label: 'Locataire',
            render: row => tenants.find(t => t.id === row.tenant_id)?.full_name ?? row.tenant_id,
          },
          {
            key: 'rent_amount',
            label: 'Loyer',
            align: 'right',
            render: row => formatCurrency(row.rent_amount),
          },
          {
            key: 'start_date',
            label: 'Debut',
            render: row => formatDate(row.start_date),
          },
          {
            key: 'end_date',
            label: 'Fin',
            render: row => formatDate(row.end_date),
          },
          {
            key: 'status',
            label: 'Statut',
            render: row => (
              <StatusPill status={row.status === 'active' ? 'Actif' : 'Expire'} variant={row.status === 'active' ? 'approved' : 'rejected'} />
            ),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: row => (
              <div className="table-actions">
                <button
                  className="ghost-button"
                  onClick={() =>
                    printContract({
                      ...row,
                      property: properties.find(p => p.id === row.property_id)?.title,
                      tenant: tenants.find(t => t.id === row.tenant_id)?.full_name,
                    })
                  }
                >
                  PDF
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
