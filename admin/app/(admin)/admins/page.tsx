'use client';

import { useState } from 'react';
import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import type { Profile } from '../../../lib/useSession';
import { supabase } from '../../../lib/supabaseClient';
import { roleLabels } from '../../../lib/rbac';

const emptyForm = {
  full_name: '',
  email: '',
  phone: '',
  password: '',
  role: 'ADMIN',
};

export default function AdminsPage() {
  const { data: admins, loading, reload } = useSupabaseTable<Profile>('profiles', { orderBy: 'created_at' });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.email || !form.password) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setSaving(false);
      setError('Session admin introuvable.');
      return;
    }
    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(form),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(result.error ?? 'Erreur lors de la creation.');
      return;
    }
    setSuccess('Admin cree avec succes.');
    setForm(emptyForm);
    reload();
  };

  return (
    <div className="grid">
      <SectionHeader
        title="Gestion des admins"
        subtitle="Creer des comptes et definir les roles (Admin, Agent, Comptable)."
        actions={<button className="primary-button">Nouveau compte</button>}
      />

      <div className="card form-card">
        <div className="form-grid">
          <div className="form-field">
            <label>Nom complet</label>
            <input
              value={form.full_name}
              onChange={event => setForm({ ...form, full_name: event.target.value })}
              placeholder="Awa Mensah"
            />
          </div>
          <div className="form-field">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={event => setForm({ ...form, email: event.target.value })}
              placeholder="admin@imonord.tg"
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
            <label>Mot de passe</label>
            <input
              type="password"
              value={form.password}
              onChange={event => setForm({ ...form, password: event.target.value })}
              placeholder="********"
            />
          </div>
          <div className="form-field">
            <label>Role</label>
            <select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>
              <option value="ADMIN">Admin</option>
              <option value="AGENT">Agent</option>
              <option value="ACCOUNTANT">Comptable</option>
            </select>
          </div>
        </div>
        {error ? <div className="alert">{error}</div> : null}
        {success ? <div className="success">{success}</div> : null}
        <div className="form-actions">
          <button className="ghost-button" onClick={() => setForm(emptyForm)}>
            Reinitialiser
          </button>
          <button className="primary-button" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creation...' : 'Creer le compte'}
          </button>
        </div>
      </div>

      <DataTable
        rows={admins}
        emptyLabel={loading ? 'Chargement...' : 'Aucun admin'}
        columns={[
          { key: 'full_name', label: 'Nom' },
          { key: 'phone', label: 'Telephone' },
          {
            key: 'role',
            label: 'Role',
            render: row => roleLabels[row.role],
          },
          {
            key: 'created_at',
            label: 'Cree le',
            render: row => new Date(row.created_at).toLocaleDateString('fr-FR'),
          },
        ]}
      />
    </div>
  );
}
