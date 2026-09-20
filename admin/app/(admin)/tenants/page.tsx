'use client';

import { useState } from 'react';
import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { supabase } from '../../../lib/supabaseClient';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import { formatDate } from '../../../lib/format';
import type { Tenant, TenantDocumentType } from '../../../lib/types';
import { logAdminAction } from '../../../lib/adminAudit';

const emptyForm = {
  full_name: '',
  phone: '',
  email: '',
  notes: '',
};

export default function TenantsPage() {
  const { data: tenants, loading, reload } = useSupabaseTable<Tenant>('tenants', { orderBy: 'created_at' });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [docFiles, setDocFiles] = useState<FileList | null>(null);
  const [docType, setDocType] = useState<TenantDocumentType>('cni');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.full_name || !form.phone) return;
    setSaving(true);
    if (editingId) {
      const { error } = await supabase
        .from('tenants')
        .update({
          full_name: form.full_name,
          phone: form.phone,
          email: form.email || null,
          notes: form.notes || null,
        })
        .eq('id', editingId);
      if (error) {
        alert(`Erreur locataire: ${error.message}`);
        setSaving(false);
        return;
      }
      await logAdminAction('update_tenant', 'tenant', editingId);
    } else {
      const { data, error } = await supabase
        .from('tenants')
        .insert({
          full_name: form.full_name,
          phone: form.phone,
          email: form.email || null,
          notes: form.notes || null,
        })
        .select()
        .maybeSingle();

      if (!error && data && docFiles?.length) {
        const uploads = Array.from(docFiles).map(async file => {
          const path = `${data.id}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage.from('tenant-documents').upload(path, file);
          if (uploadError) return;
          const { data: publicUrl } = supabase.storage.from('tenant-documents').getPublicUrl(path);
          await supabase.from('tenant_documents').insert({
            tenant_id: data.id,
            type: docType,
            url: publicUrl.publicUrl,
          });
        });
        await Promise.all(uploads);
      }
      if (error) {
        alert(`Erreur locataire: ${error.message}`);
        setSaving(false);
        return;
      }
      if (data) await logAdminAction('create_tenant', 'tenant', data.id);
    }

    setForm(emptyForm);
    setDocFiles(null);
    setEditingId(null);
    setSaving(false);
    reload();
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingId(tenant.id);
    setForm({
      full_name: tenant.full_name,
      phone: tenant.phone,
      email: tenant.email ?? '',
      notes: tenant.notes ?? '',
    });
  };

  const handleDelete = async (tenantId: string) => {
    const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
    if (error) {
      alert(`Erreur suppression: ${error.message}`);
      return;
    }
    await logAdminAction('delete_tenant', 'tenant', tenantId);
    reload();
  };

  return (
    <div className="grid">
      <SectionHeader
        title="Gestion des locataires"
        subtitle="Suivez les profils, documents et historique de location."
        actions={<button className="primary-button">Nouveau locataire</button>}
      />

      <div className="card form-card">
        <div className="form-grid">
          <div className="form-field">
            <label>Nom complet</label>
            <input
              value={form.full_name}
              onChange={event => setForm({ ...form, full_name: event.target.value })}
              placeholder="Koffi Mensah"
            />
          </div>
          <div className="form-field">
            <label>Telephone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={event => setForm({ ...form, phone: event.target.value })}
              placeholder="+228 90 00 00 00"
            />
          </div>
          <div className="form-field">
            <label>Email (optionnel)</label>
            <input
              value={form.email}
              onChange={event => setForm({ ...form, email: event.target.value })}
              placeholder="locataire@email.tg"
            />
          </div>
          <div className="form-field form-span">
            <label>Historique / Notes</label>
            <textarea
              value={form.notes}
              onChange={event => setForm({ ...form, notes: event.target.value })}
              placeholder="Historique de paiement, remarques..."
            />
          </div>
          <div className="form-field">
            <label>Type de document</label>
            <select value={docType} onChange={event => setDocType(event.target.value as TenantDocumentType)}>
              <option value="cni">CNI</option>
              <option value="contract">Contrat</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <div className="form-field">
            <label>Documents (upload)</label>
            <input type="file" multiple onChange={event => setDocFiles(event.target.files)} />
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
        rows={tenants}
        emptyLabel={loading ? 'Chargement...' : 'Aucun locataire'}
        columns={[
          { key: 'full_name', label: 'Locataire' },
          { key: 'phone', label: 'Telephone' },
          { key: 'email', label: 'Email' },
          {
            key: 'created_at',
            label: 'Ajoute le',
            render: row => formatDate(row.created_at),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: row => (
              <div className="table-actions">
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
