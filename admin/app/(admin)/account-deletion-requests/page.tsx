'use client';

import { useCallback, useEffect, useState } from 'react';
import SectionHeader from '../../../components/SectionHeader';
import LoadingState from '../../../components/LoadingState';
import { adminApiRequest } from '../../../lib/adminMutations';
import { formatDate } from '../../../lib/format';

type RequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';
type DeletionRequest = {
  id: string;
  email: string | null;
  status: RequestStatus;
  created_at: string;
  processed_at: string | null;
};

const statusOptions: { value: RequestStatus; label: string }[] = [
  { value: 'pending', label: 'À traiter' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminées' },
  { value: 'rejected', label: 'Refusées' },
];

const statusLabels: Record<RequestStatus, string> = {
  pending: 'À traiter',
  in_progress: 'En cours',
  completed: 'Terminée',
  rejected: 'Refusée',
};

export default function AccountDeletionRequestsPage() {
  const [status, setStatus] = useState<RequestStatus>('pending');
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    try {
      const response = await adminApiRequest(
        `/api/admin/account-deletion-requests?status=${status}&page=${page}&pageSize=25`,
        { cache: 'no-store' }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les demandes.');
      setRequests(result.requests as DeletionRequest[]);
      setTotal(result.total ?? 0);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les demandes.');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    let isCurrentRequest = true;

    const loadRequests = async () => {
      try {
        const response = await adminApiRequest(
          `/api/admin/account-deletion-requests?status=${status}&page=${page}&pageSize=25`,
          { cache: 'no-store' }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les demandes.');
        if (!isCurrentRequest) return;
        setRequests(result.requests as DeletionRequest[]);
        setTotal(result.total ?? 0);
      } catch (requestError) {
        if (isCurrentRequest) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Impossible de charger les demandes.'
          );
        }
      } finally {
        if (isCurrentRequest) setLoading(false);
      }
    };

    void loadRequests();
    return () => {
      isCurrentRequest = false;
    };
  }, [status, page]);

  const updateStatus = async (request: DeletionRequest, nextStatus: 'in_progress' | 'completed' | 'rejected') => {
    if (nextStatus === 'completed' && !window.confirm(
      `Confirmer que le compte ${request.email ?? ''} a été supprimé et que la demande est terminée ?`
    )) return;
    if (nextStatus === 'rejected' && !window.confirm('Confirmer le refus de cette demande ?')) return;

    setBusyId(request.id);
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await adminApiRequest(`/api/admin/account-deletion-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Impossible de mettre à jour la demande.');
      setNotice('Demande mise à jour. Son adresse e-mail est effacée lorsqu’elle est terminée ou refusée.');
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de mettre à jour la demande.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid">
      <SectionHeader
        title="Suppressions de compte"
        subtitle="Vérifiez la demande, supprimez le compte dans Utilisateurs, puis clôturez le dossier."
      />
      <div className="card">
        <p>
          Le formulaire public n’efface pas un compte automatiquement. Vérifiez d’abord que l’adresse
          correspond au compte, puis supprimez celui-ci depuis la page Utilisateurs avant de marquer
          la demande comme terminée. L’adresse est effacée du dossier lorsqu’il est clôturé.
        </p>
        <div className="tabs" role="tablist" aria-label="Filtrer les demandes">
          {statusOptions.map(option => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={status === option.value}
              className={`tab-pill ${status === option.value ? 'active' : ''}`}
              onClick={() => {
                setStatus(option.value);
                setPage(1);
                setLoading(true);
                setError('');
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {error ? <div className="alert error">{error}</div> : null}
      {notice ? <div className="account-deletion-admin-notice" role="status">{notice}</div> : null}
      {loading ? <LoadingState /> : (
        <div className="card table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Adresse associée au compte</th>
                <th>Reçue le</th>
                <th>Statut</th>
                <th>Traitée le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(request => (
                <tr key={request.id}>
                  <td>{request.email ?? 'Adresse effacée'}</td>
                  <td>{formatDate(request.created_at)}</td>
                  <td>{statusLabels[request.status]}</td>
                  <td>{request.processed_at ? formatDate(request.processed_at) : '—'}</td>
                  <td>
                    <div className="pill-row">
                      {request.status === 'pending' ? (
                        <button
                          className="primary-button small"
                          disabled={busyId === request.id}
                          onClick={() => updateStatus(request, 'in_progress')}
                        >
                          Prendre en charge
                        </button>
                      ) : null}
                      {request.status === 'in_progress' ? (
                        <>
                          <button
                            className="primary-button small"
                            disabled={busyId === request.id}
                            onClick={() => updateStatus(request, 'completed')}
                          >
                            Suppression effectuée
                          </button>
                          <button
                            className="ghost-button small"
                            disabled={busyId === request.id}
                            onClick={() => updateStatus(request, 'rejected')}
                          >
                            Refuser
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!requests.length ? (
                <tr>
                  <td colSpan={5}>Aucune demande dans cette catégorie.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {total > 25 ? (
            <div className="pagination">
              <button
                className="ghost-button small"
                disabled={page === 1}
                onClick={() => {
                  setPage(current => current - 1);
                  setLoading(true);
                  setError('');
                }}
              >
                Précédent
              </button>
              <span>Page {page} sur {Math.ceil(total / 25)}</span>
              <button
                className="ghost-button small"
                disabled={page >= Math.ceil(total / 25)}
                onClick={() => {
                  setPage(current => current + 1);
                  setLoading(true);
                  setError('');
                }}
              >
                Suivant
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
