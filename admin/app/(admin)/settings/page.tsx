import SectionHeader from '../../../components/SectionHeader';

export default function SettingsPage() {
  return (
    <div className="grid">
      <SectionHeader
        title="Paramètres"
        subtitle="Seul le rôle ADMIN a accès à ce back-office."
      />

      <div className="grid grid-cols-2">
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Rôles</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            USER, AGENT et ACCOUNTANT restent des rôles métier de l&apos;application. Seul ADMIN peut ouvrir ce back-office.
          </div>
          <div className="chip-row">
            <div className="chip">USER</div>
            <div className="chip">Admin</div>
            <div className="chip">Agent</div>
            <div className="chip">Comptable</div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Intégrations</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            Auth, Storage et RLS sont gérés dans Supabase. Ce panneau n&apos;enregistre pas de configuration.
          </div>
          <div className="chip-row">
            <div className="chip">Supabase Auth</div>
            <div className="chip">Storage</div>
            <div className="chip">RLS</div>
          </div>
        </div>
      </div>
    </div>
  );
}
