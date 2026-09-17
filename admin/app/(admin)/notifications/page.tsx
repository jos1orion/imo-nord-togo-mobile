'use client';

import { useState } from 'react';
import SectionHeader from '../../../components/SectionHeader';
import StatusPill from '../../../components/StatusPill';
import { supabase } from '../../../lib/supabaseClient';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import { formatDate } from '../../../lib/format';
import type { Notification } from '../../../lib/types';

const emptyForm = {
  title: '',
  body: '',
  type: 'rappel',
};

export default function NotificationsPage() {
  const { data: notifications, loading, reload } = useSupabaseTable<Notification>('notifications', {
    orderBy: 'created_at',
  });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.title || !form.body) return;
    setSaving(true);
    await supabase.from('notifications').insert({
      title: form.title,
      body: form.body,
      type: form.type,
      read: false,
    });
    setForm(emptyForm);
    setSaving(false);
    reload();
  };

  const handleToggle = async (notification: Notification) => {
    await supabase.from('notifications').update({ read: !notification.read }).eq('id', notification.id);
    reload();
  };

  return (
    <div className="grid">
      <SectionHeader
        title="Notifications"
        subtitle="Rappels automatiques, alertes fin de contrat et messages admin."
        actions={<button className="primary-button">Nouvelle alerte</button>}
      />

      <div className="card form-card">
        <div className="form-grid">
          <div className="form-field">
            <label>Titre</label>
            <input
              value={form.title}
              onChange={event => setForm({ ...form, title: event.target.value })}
              placeholder="Rappel paiement"
            />
          </div>
          <div className="form-field">
            <label>Type</label>
            <select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>
              <option value="rappel">Rappel</option>
              <option value="contrat">Fin de contrat</option>
              <option value="admin">Alerte admin</option>
            </select>
          </div>
          <div className="form-field form-span">
            <label>Message</label>
            <textarea
              value={form.body}
              onChange={event => setForm({ ...form, body: event.target.value })}
              placeholder="Contenu de la notification..."
            />
          </div>
        </div>
        <div className="form-actions">
          <button className="ghost-button" onClick={() => setForm(emptyForm)}>
            Reinitialiser
          </button>
          <button className="primary-button" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2">
        {!loading && notifications.length === 0 ? (
          <div className="card">Aucune notification pour le moment.</div>
        ) : null}
        {(loading ? [] : notifications).map(notification => (
          <div key={notification.id} className="card">
            <div className="split">
              <div>
                <div style={{ fontWeight: 600 }}>{notification.title}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{notification.body}</div>
              </div>
              <StatusPill
                status={notification.read ? 'Lu' : 'Non lu'}
                variant={notification.read ? 'approved' : 'pending'}
              />
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDate(notification.created_at)}</div>
              <button className="ghost-button" onClick={() => handleToggle(notification)}>
                {notification.read ? 'Marquer non lu' : 'Marquer lu'}
              </button>
            </div>
          </div>
        ))}
        {loading ? <div className="card">Chargement...</div> : null}
      </div>
    </div>
  );
}
