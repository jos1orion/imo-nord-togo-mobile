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
  const displayName = profile?.full_name || user?.email || 'Admin';
  const initials = displayName
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');

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
        <div className="topbar-chip"><span className="online-indicator" /> Temps réel</div>
        <div className="user-chip">
          <div className="user-avatar" aria-hidden="true">{initials || 'A'}</div>
          <div className="user-details">
            <div className="user-name">{displayName}</div>
            <div className="user-role">{profile?.role ? roleLabels[profile.role] : 'Compte'}</div>
          </div>
        </div>
        <button
          type="button"
          className="ghost-button topbar-logout"
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          }}
        >
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
