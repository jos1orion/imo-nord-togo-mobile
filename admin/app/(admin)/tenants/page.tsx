'use client';

import { useRef, useState } from 'react';
import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { supabase } from '../../../lib/supabaseClient';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import { formatDate } from '../../../lib/format';
import type { Tenant, TenantDocumentType } from '../../../lib/types';
import { logAdminAction } from '../../../lib/adminAudit';
import { deleteAdminRecord, updateAdminRecord } from '../../../lib/adminMutations';
import { focusForm } from '../../../lib/formNavigation';
import {
  TENANT_DOCUMENT_MAX_BYTES,
  TENANT_DOCUMENT_MIME_TYPES,
  validateTenantDocuments,
} from '../../../../src/utils/imageUploadValidation';

const emptyForm = {
  full_name: '',
  phone: '',
  email: '',
  notes: '',
};

export default function TenantsPage() {
  const { data: tenants, loading, error, reload } = useSupabaseTable<Tenant>('tenants', { orderBy: 'created_at' });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [docFiles, setDocFiles] = useState<FileList | null>(null);
  const [docType, setDocType] = useState<TenantDocumentType>('cni');
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<'full_name' | 'phone' | 'documents', string>>
  >({});
  const [formMessage, setFormMessage] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const nextErrors: typeof formErrors = {};
    if (!form.full_name.trim()) nextErrors.full_name = 'Le nom complet est obligatoire.';
    if (!form.phone.trim()) nextErrors.phone = 'Le téléphone est obligatoire.';
    const selectedFiles = Array.from(docFiles ?? []);
    const documentError = validateTenantDocuments(selectedFiles);
    if (documentError) nextErrors.documents = documentError;
    setFormErrors(nextErrors);
    setFormMessage('');
    const firstError = (['full_name', 'phone', 'documents'] as const).find(
      field => nextErrors[field]
    );
    if (firstError) {
      const refs = { full_name: nameRef, phone: phoneRef, documents: documentRef };
      requestAnimationFrame(() => {
        const input = refs[firstError].current;
        input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input?.focus();
      });
      return;
    }
    setSaving(true);
    if (editingId) {
      try {
        await updateAdminRecord('tenants', editingId, {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email || null,
          notes: form.notes || null,
        });
      } catch (error) {
        alert(`Erreur locataire: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
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

      if (error) {
        alert(`Erreur locataire: ${error.message}`);
        setSaving(false);
        return;
      }
      if (data && selectedFiles.length) {
        const uploadedPaths: string[] = [];
        try {
          for (const file of selectedFiles) {
            const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'file';
            const path = `${data.id}/${crypto.randomUUID()}.${extension}`;
            const { error: uploadError } = await supabase.storage
              .from('tenant-documents')
              .upload(path, file, { contentType: file.type, upsert: false });
            if (uploadError) throw new Error(uploadError.message);
            uploadedPaths.push(path);
          }
          const { error: documentError } = await supabase.from('tenant_documents').insert(
            uploadedPaths.map(url => ({ tenant_id: data.id, type: docType, url }))
          );
          if (documentError) throw new Error(documentError.message);
        } catch (uploadFailure) {
          let tenantDeleteError: string | null = null;
          try {
            await deleteAdminRecord('tenants', data.id);
          } catch (error) {
            tenantDeleteError = error instanceof Error ? error.message : 'Erreur inconnue';
          }
          const { error: storageCleanupError } = uploadedPaths.length
            ? await supabase.storage.from('tenant-documents').remove(uploadedPaths)
            : { error: null };
          const cleanupErrors = [tenantDeleteError, storageCleanupError?.message]
            .filter(Boolean)
            .join(' ; ');
          setFormErrors(previous => ({
            ...previous,
            documents: uploadFailure instanceof Error ? uploadFailure.message : 'Échec du téléversement.',
          }));
          setFormMessage(
            tenantDeleteError
              ? `Le téléversement a échoué et le locataire n’a pas pu être supprimé. Vérifiez le nettoyage${cleanupErrors ? ` : ${cleanupErrors}` : ''}.`
              : `Le téléversement a échoué ; le locataire créé a été supprimé.${cleanupErrors ? ` Nettoyage incomplet : ${cleanupErrors}` : ''}`
          );
          setSaving(false);
          return;
        }
      }
      if (data) await logAdminAction('create_tenant', 'tenant', data.id);
    }

    setForm(emptyForm);
    setDocFiles(null);
    setEditingId(null);
    setFormErrors({});
    setFormMessage('');
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
    if (!window.confirm('Supprimer ce locataire ? Cette action est irréversible.')) return;
    try {
      await deleteAdminRecord('tenants', tenantId);
      await logAdminAction('delete_tenant', 'tenant', tenantId);
      reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur suppression: erreur inconnue');
    }
  };

  return (
    <div className="grid">
      <SectionHeader
        title="Gestion des locataires"
        subtitle="Suivez les profils, documents et historique de location."
        actions={
          <button
            className="primary-button"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setDocFiles(null);
              setDocType('cni');
              setFormErrors({});
              setFormMessage('');
              if (documentRef.current) documentRef.current.value = '';
              focusForm('tenant-form');
            }}
          >
            Nouveau locataire
          </button>
        }
      />

      <div id="tenant-form" className="card form-card">
        {formMessage ? <p className="form-error-summary" role="alert">{formMessage}</p> : null}
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="tenant-full-name">Nom complet</label>
            <input
              id="tenant-full-name"
              ref={nameRef}
              aria-invalid={Boolean(formErrors.full_name)}
              aria-describedby={formErrors.full_name ? 'tenant-name-error' : undefined}
              value={form.full_name}
              onChange={event => {
                setForm({ ...form, full_name: event.target.value });
                setFormErrors(previous => ({ ...previous, full_name: undefined }));
              }}
              placeholder="Koffi Mensah"
            />
            {formErrors.full_name ? <small id="tenant-name-error" className="field-error">{formErrors.full_name}</small> : null}
          </div>
          <div className="form-field">
            <label htmlFor="tenant-phone">Telephone</label>
            <input
              id="tenant-phone"
              ref={phoneRef}
              aria-invalid={Boolean(formErrors.phone)}
              aria-describedby={formErrors.phone ? 'tenant-phone-error' : undefined}
              type="tel"
              value={form.phone}
              onChange={event => {
                setForm({ ...form, phone: event.target.value });
                setFormErrors(previous => ({ ...previous, phone: undefined }));
              }}
            />
            {formErrors.phone ? <small id="tenant-phone-error" className="field-error">{formErrors.phone}</small> : null}
          </div>
          <div className="form-field">
            <label>Email (optionnel)</label>
            <input
              value={form.email}
              onChange={event => setForm({ ...form, email: event.target.value })}
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
            <label htmlFor="tenant-documents">Documents (PDF, JPEG, PNG, WebP)</label>
            <input
              id="tenant-documents"
              ref={documentRef}
              type="file"
              accept={TENANT_DOCUMENT_MIME_TYPES.join(',')}
              multiple
              disabled={Boolean(editingId)}
              aria-invalid={Boolean(formErrors.documents)}
              aria-describedby={formErrors.documents ? 'tenant-documents-error' : 'tenant-documents-help'}
              onChange={event => {
                const nextFiles = event.target.files;
                setDocFiles(nextFiles);
                setFormErrors(previous => ({
                  ...previous,
                  documents: validateTenantDocuments(Array.from(nextFiles ?? [])) ?? undefined,
                }));
              }}
            />
            <small id="tenant-documents-help" style={{ color: 'var(--muted)' }}>
              Maximum {Math.round(TENANT_DOCUMENT_MAX_BYTES / 1024 / 1024)} Mo par document.
            </small>
            {formErrors.documents ? <small id="tenant-documents-error" className="field-error">{formErrors.documents}</small> : null}
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
        loading={loading}
        error={error}
        onRetry={reload}
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
