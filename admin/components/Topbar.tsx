'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { roleLabels } from '../lib/rbac';
import { useSession } from '../lib/useSession';

export default function Topbar() {
  const { profile, user } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      router.push('/properties');
      return;
    }
    router.push(`/properties?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="topbar">
      <form className="topbar-search" onSubmit={onSearch}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher un bien (titre, lieu, quartier)…"
          aria-label="Recherche biens"
        />
      </form>
      <div className="topbar-actions">
        <div className="topbar-chip">Temps réel</div>
        <div className="user-chip">
          <div className="user-name">{profile?.full_name || user?.email || 'Admin'}</div>
          <div className="user-role">{profile?.role ? roleLabels[profile.role] : 'Compte'}</div>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          }}
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}
