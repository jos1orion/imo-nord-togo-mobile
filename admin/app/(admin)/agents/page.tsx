'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../components/SectionHeader';
import StatusPill from '../../../components/StatusPill';
import { supabase } from '../../../lib/supabaseClient';

type AgentStatus = 'pending' | 'approved' | 'rejected';
type Agent = {
  id: string; full_name: string | null; email: string | null; phone: string | null;
  agent_status: AgentStatus; agent_rejection_reason: string | null; created_at: string;
  auth_created_at: string | null; last_sign_in_at: string | null;
};
const labels: Record<AgentStatus, string> = { pending: 'En attente', approved: 'Approuvé', rejected: 'Refusé' };

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filter, setFilter] = useState<'all' | AgentStatus>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState<Agent | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [totalAgents, setTotalAgents] = useState(0);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setError('Session admin introuvable.'); setLoading(false); return; }
    const statusQuery = filter === 'all' ? '' : `&status=${filter}`;
    const response = await fetch(`/api/admin/agents?page=${page}&pageSize=${pageSize}${statusQuery}`, { headers: { Authorization: `Bearer ${token}` } });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) { setError(result.error ?? 'Impossible de charger les agents.'); return; }
    setError(null); setAgents(result.agents ?? []); setTotalAgents(result.total ?? 0);
  }, [page, filter]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const updateStatus = async (agent: Agent, status: 'approved' | 'rejected', rejectionReason?: string) => {
    setBusyId(agent.id); setError(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const response = token ? await fetch(`/api/admin/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: "Bearer ${token}" },
      body: JSON.stringify({ status, rejection_reason: rejectionReason }),
    }) : null;
    const result = response ? await response.json() : {};
    setBusyId(null);
    if (!response || !response.ok) { setError(result.error ?? 'Action impossible.'); return; }
    setRejecting(null); setReason(''); await loadAgents();
  };

  const approveSelected = async () => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true); setError(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const response = token ? await fetch('/api/admin/agents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: "Bearer ${token}" },
      body: JSON.stringify({ ids: selectedIds, status: 'approved' }),
    }) : null;
    const result = response ? await response.json() : {};
    setBulkBusy(false);
    if (!response || !response.ok) {
      setError(result.error ?? 'Approbation groupée impossible.');
      return;
    }
    setSelectedIds([]);
    await loadAgents();
  };

  const visibleAgents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return agents.filter(agent => {
      const haystack = [agent.full_name, agent.email, agent.phone].filter(Boolean).join(' ').toLowerCase();
      return (filter === 'all' || agent.agent_status === filter) && (!query || haystack.includes(query));
    });
  }, [agents, filter, search]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [filter]);

  useEffect(() => {
    setSelectedIds(current => current.filter(id => visibleAgents.some(agent => agent.id === id)));
  }, [visibleAgents]);

  const approvableAgents = visibleAgents.filter(agent => agent.agent_status !== 'approved');
  const allApprovableSelected = approvableAgents.length > 0 && approvableAgents.every(agent => selectedIds.includes(agent.id));

  return (
    <div className="grid">
      <SectionHeader title="Demandes agents" subtitle="Validez les demandes d'accès agent et accompagnez vos décisions d'un motif." />
      <div className="card filter-card"><div className="filter-row">
        <div className="filter-field"><label htmlFor="agent-search">Rechercher</label><input id="agent-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nom, email ou téléphone" /></div>
        <div className="filter-field"><label htmlFor="agent-status">Statut</label><select id="agent-status" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
          <option value="all">Tous ({agents.length})</option>
          {(['pending', 'approved', 'rejected'] as AgentStatus[]).map(status => <option key={status} value={status}>{labels[status]} ({agents.filter(agent => agent.agent_status === status).length})</option>)}
        </select></div>
      </div></div>
      {error ? <div className="alert">{error}</div> : null}
      <div className="card table-card">
        <div className="table-toolbar">
          <div>
            <div className="table-toolbar-title">Candidatures</div>
            <div className="table-toolbar-subtitle">Les utilisateurs ayant demandé le statut agent.</div>
          </div>
          <div className="table-toolbar-count">{totalAgents}</div>
        </div>
        {approvableAgents.length > 0 ? (
          <div className="form-actions">
            <button className="primary-button" disabled={bulkBusy || selectedIds.length === 0} onClick={() => void approveSelected()}>
              {bulkBusy ? 'Validation...' : 'Approuver la sélection (' + selectedIds.length + ')'}
            </button>
          </div>
        ) : null}
        {loading ? <div className="table-empty">Chargement...</div> : visibleAgents.length === 0 ? <div className="table-empty">Aucune demande correspondant aux filtres.</div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" aria-label="Sélectionner les agents à approuver" checked={allApprovableSelected} onChange={event => setSelectedIds(event.target.checked ? approvableAgents.map(agent => agent.id) : [])} />
                  </th>
                  <th>Demandeur</th><th>Contact</th><th>Statut</th><th>Demandé le</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleAgents.map(agent => (
                  <tr key={agent.id}>
                    <td>
                      {agent.agent_status !== 'approved' ? (
                        <input type="checkbox" aria-label={'Sélectionner ' + (agent.full_name || 'cet agent')} checked={selectedIds.includes(agent.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...current, agent.id] : current.filter(id => id !== agent.id))} />
                      ) : null}
                    </td>
                    <td><strong>{agent.full_name || 'Sans nom'}</strong>{agent.agent_rejection_reason ? <div className="table-muted">Motif : {agent.agent_rejection_reason}</div> : null}</td>
                    <td>{agent.email || agent.phone || '—'}</td>
                    <td><StatusPill status={labels[agent.agent_status]} variant={agent.agent_status} /></td>
                    <td>{new Date(agent.created_at).toLocaleDateString('fr-FR')}</td>
                    <td>
                      <div className="table-actions">
                        <button className="ghost-button" onClick={() => setSelectedAgent(agent)}>Voir les infos</button>
                        {agent.agent_status !== 'approved' ? <button className="primary-button" disabled={busyId === agent.id} onClick={() => updateStatus(agent, 'approved')}>Approuver</button> : null}
                        {agent.agent_status !== 'rejected' ? <button className="danger-button" disabled={busyId === agent.id} onClick={() => { setRejecting(agent); setReason(''); }}>Refuser</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="pagination">
        <button className="ghost-button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1 || loading}>Précédent</button>
        <div className="pill">Page {page} / {Math.max(1, Math.ceil(totalAgents / pageSize))} · {totalAgents} demandes</div>
        <button className="ghost-button" onClick={() => setPage(current => current + 1)} disabled={loading || page >= Math.max(1, Math.ceil(totalAgents / pageSize))}>Suivant</button>
      </div>
      {rejecting ? <div className="modal-backdrop"><div className="card modal-card"><h2>Refuser la demande</h2><p>Indiquez un motif qui sera visible par le demandeur.</p><textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} rows={5} placeholder="Motif du refus" /><div className="form-actions"><button className="ghost-button" onClick={() => setRejecting(null)}>Annuler</button><button className="danger-button" disabled={!reason.trim() || busyId === rejecting.id} onClick={() => updateStatus(rejecting, 'rejected', reason)}>Confirmer le refus</button></div></div></div> : null}
      {selectedAgent ? <div className="modal-backdrop"><div className="card modal-card"><h2>Vérification de la demande</h2><p>Vérifiez les informations avant de valider le statut agent.</p><div className="detail-grid"><div><strong>Nom complet</strong><span>{selectedAgent.full_name || 'Non renseigné'}</span></div><div><strong>Email</strong><span>{selectedAgent.email || 'Non renseigné'}</span></div><div><strong>Téléphone</strong><span>{selectedAgent.phone || 'Non renseigné'}</span></div><div><strong>Statut</strong><span>{labels[selectedAgent.agent_status]}</span></div><div><strong>Demande créée</strong><span>{new Date(selectedAgent.created_at).toLocaleString('fr-FR')}</span></div><div><strong>Compte Auth créé</strong><span>{selectedAgent.auth_created_at ? new Date(selectedAgent.auth_created_at).toLocaleString('fr-FR') : 'Inconnu'}</span></div><div><strong>Dernière connexion</strong><span>{selectedAgent.last_sign_in_at ? new Date(selectedAgent.last_sign_in_at).toLocaleString('fr-FR') : 'Jamais'}</span></div>{selectedAgent.agent_rejection_reason ? <div><strong>Motif précédent</strong><span>{selectedAgent.agent_rejection_reason}</span></div> : null}</div><div className="form-actions"><button className="ghost-button" onClick={() => setSelectedAgent(null)}>Fermer</button>{selectedAgent.agent_status !== 'approved' ? <button className="primary-button" disabled={busyId === selectedAgent.id} onClick={() => { setSelectedAgent(null); void updateStatus(selectedAgent, 'approved'); }}>Approuver l&apos;agent</button> : null}</div></div></div> : null}
    </div>
  );
}
