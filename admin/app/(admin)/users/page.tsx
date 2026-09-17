'use client';

import { useEffect, useState } from 'react';
import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import { supabase } from '../../../lib/supabaseClient';
import type { Profile } from '../../../lib/useSession';
import { roleLabels, STAFF_ROLES, type AppRole, type Role } from '../../../lib/rbac';

const roleOptions: AppRole[] = ['USER', 'ADMIN', 'AGENT', 'ACCOUNTANT'];

type DraftUser = {
  full_name: string;
  phone: string;
  role: AppRole;
};

const emptyForm = {
  full_name: '',
  email: '',
  phone: '',
  password: '',
  role: 'AGENT' as Role,
};

export default function UsersPage() {
  const { data: users, loading, reload } = useSupabaseTable<Profile>('profiles', { orderBy: 'created_at' });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftUsers, setDraftUsers] = useState<Record<string, DraftUser>>({});
  const [draftPasswords, setDraftPasswords] = useState<Record<string, string>>({});
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDraftUsers(prev => {
      const next = { ...prev };
      users.forEach(user => {
        if (!next[user.id]) {
          next[user.id] = {
            full_name: user.full_name ?? '',
            phone: user.phone ?? '',
            role: user.role,
          };
        }
      });
      return next;
    });
  }, [users]);

  const updateDraft = (id: string, values: Partial<DraftUser>) => {
    setDraftUsers(prev => {
      const existing = prev[id] ?? { full_name: '', phone: '', role: 'USER' as AppRole };
      return { ...prev, [id]: { ...existing, ...values } };
    });
  };

  const updateDraftPassword = (id: string, password: string) => {
    setDraftPasswords(prev => ({ ...prev, [id]: password }));
  };

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.role) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const token = await getAccessToken();
    if (!token) {
      setSaving(false);
      setError('Session admin introuvable.');
      return;
    }
    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(result.error ?? 'Erreur lors de la création.');
      return;
    }
    setSuccess('Utilisateur créé avec succès.');
    setForm(emptyForm);
    reload();
  };

  const handleUpdateUser = async (id: string) => {
    const draft = draftUsers[id];
    if (!draft) return;
    const fullName = draft.full_name.trim();
    const phone = draft.phone.trim();
    const password = (draftPasswords[id] ?? '').trim();
    if (password.length > 0 && password.length < 6) {
      setError('Mot de passe invalide (6 caractères minimum).');
      return;
    }
    setRowBusy(prev => ({ ...prev, [id]: true }));
    setError(null);
    setSuccess(null);
    const token = await getAccessToken();
    if (!token) {
      setRowBusy(prev => ({ ...prev, [id]: false }));
      setError('Session admin introuvable.');
      return;
    }
    const response = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        role: draft.role,
        full_name: fullName.length ? fullName : null,
        phone: phone.length ? phone : null,
        ...(password.length ? { password } : {}),
      }),
    });
    const result = await response.json();
    setRowBusy(prev => ({ ...prev, [id]: false }));
    if (!response.ok) {
      setError(result.error ?? 'Erreur lors de la mise à jour.');
      return;
    }
    setSuccess('Utilisateur mis à jour.');
    if (password.length) {
      setDraftPasswords(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    setRowBusy(prev => ({ ...prev, [id]: true }));
    setError(null);
    setSuccess(null);
    const token = await getAccessToken();
    if (!token) {
      setRowBusy(prev => ({ ...prev, [id]: false }));
      setError('Session admin introuvable.');
      return;
    }
    const response = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    setRowBusy(prev => ({ ...prev, [id]: false }));
    if (!response.ok) {
      setError(result.error ?? 'Erreur lors de la suppression.');
      return;
    }
    setSuccess('Utilisateur supprimé.');
    reload();
  };

  const columns = [
    {
      key: 'full_name',
      label: 'Nom',
      render: (row: Profile) => {
        const draft = draftUsers[row.id];
        return (
          <input
            type="text"
            value={draft?.full_name ?? row.full_name ?? ''}
            onChange={event => updateDraft(row.id, { full_name: event.target.value })}
            placeholder="Nom complet"
            disabled={rowBusy[row.id]}
            style={{ width: 160 }}
          />
        );
      },
    },
    {
      key: 'phone',
      label: 'Téléphone',
      render: (row: Profile) => {
        const draft = draftUsers[row.id];
        return (
          <input
            type="tel"
            value={draft?.phone ?? row.phone ?? ''}
            onChange={event => updateDraft(row.id, { phone: event.target.value })}
            placeholder="+228 90 00 00 00"
            disabled={rowBusy[row.id]}
            style={{ width: 140 }}
          />
        );
      },
    },
    {
      key: 'role',
      label: 'Rôle',
      render: (row: Profile) => (
        <select
          value={draftUsers[row.id]?.role ?? row.role}
          onChange={event => updateDraft(row.id, { role: event.target.value as AppRole })}
          disabled={rowBusy[row.id]}
        >
          {roleOptions.map(role => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'password',
      label: 'Nouveau mot de passe',
      render: (row: Profile) => (
        <input
          type="password"
          value={draftPasswords[row.id] ?? ''}
          onChange={event => updateDraftPassword(row.id, event.target.value)}
          placeholder="Laisser vide"
          disabled={rowBusy[row.id]}
          style={{ width: 160 }}
        />
      ),
    },
    {
      key: 'created_at',
      label: 'Créé le',
      render: (row: Profile) => new Date(row.created_at).toLocaleDateString('fr-FR'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Profile) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="ghost-button"
            onClick={() => handleUpdateUser(row.id)}
            disabled={rowBusy[row.id]}
          >
            Mettre à jour
          </button>
          <button
            className="danger-button"
            onClick={() => handleDelete(row.id)}
            disabled={rowBusy[row.id]}
          >
            Supprimer
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid">
      <SectionHeader
        title="Utilisateurs"
        subtitle="Création, rôles et suppression des comptes."
        actions={<button className="primary-button">Nouvel utilisateur</button>}
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
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={event => setForm({ ...form, email: event.target.value })}
              placeholder="user@imonord.tg"
            />
          </div>
          <div className="form-field">
            <label>Téléphone</label>
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
            <label>Rôle</label>
            <select value={form.role} onChange={event => setForm({ ...form, role: event.target.value as Role })}>
              {STAFF_ROLES.map(role => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error ? <div className="alert">{error}</div> : null}
        {success ? <div className="success">{success}</div> : null}
        <div className="form-actions">
          <button className="ghost-button" onClick={() => setForm(emptyForm)}>
            Réinitialiser
          </button>
          <button className="primary-button" onClick={handleCreate} disabled={saving}>
            {saving ? 'Création...' : 'Créer le compte'}
          </button>
        </div>
      </div>

      <DataTable
        rows={users}
        emptyLabel={loading ? 'Chargement...' : 'Aucun utilisateur'}
        columns={columns}
      />
    </div>
  );
}
