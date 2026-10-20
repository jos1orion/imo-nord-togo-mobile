import { supabase } from './supabaseClient';

const MAX_BULK_MUTATION_SIZE = 500;

export async function getAdminAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token ?? null;

  if (!token) {
    const refreshed = await supabase.auth.refreshSession();
    token = refreshed.data.session?.access_token ?? null;
  }

  return token;
}

async function adminApiRequest(path: string, init: RequestInit): Promise<Response> {
  const token = await getAdminAccessToken();
  if (!token) throw new Error('Session admin introuvable.');

  const send = (accessToken: string) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(path, { ...init, headers });
  };

  let response = await send(token);
  if (response.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    const refreshedToken = refreshed.data.session?.access_token;
    if (refreshedToken) response = await send(refreshedToken);
  }
  return response;
}

export async function deleteAdminRecord(entity: string, id: string): Promise<string | null> {
  const response = await adminApiRequest(`/api/admin/${entity}/${id}`, {
    method: 'DELETE',
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error ?? 'Erreur lors de la suppression.');
  }
  return typeof result?.warning === 'string' ? result.warning : null;
}

export async function deleteAdminPropertyImage(propertyId: string, url: string): Promise<void> {
  const response = await adminApiRequest(`/api/admin/properties/${propertyId}/images`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error ?? 'Erreur lors de la suppression de la photo.');
  }
}

export async function updateAdminRecord(
  entity: string,
  id: string,
  updates: Record<string, unknown>
): Promise<void> {
  const response = await adminApiRequest(`/api/admin/${entity}/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error ?? 'Erreur lors de la mise à jour.');
  }
}

export async function bulkDeleteAdminRecords(entity: string, ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  if (ids.length > MAX_BULK_MUTATION_SIZE) {
    throw new Error(`La suppression groupée est limitée à ${MAX_BULK_MUTATION_SIZE} éléments.`);
  }

  const response = await adminApiRequest(`/api/admin/${entity}/bulk`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error ?? 'Erreur lors de la suppression groupée.');
  }
  return typeof result?.warning === 'string' ? result.warning : null;
}

export async function bulkUpdateAdminRecords(
  entity: string,
  ids: string[],
  updates: Record<string, unknown>
): Promise<void> {
  if (!ids.length) return;
  if (ids.length > MAX_BULK_MUTATION_SIZE) {
    throw new Error(`La mise à jour groupée est limitée à ${MAX_BULK_MUTATION_SIZE} éléments.`);
  }

  const response = await adminApiRequest(`/api/admin/${entity}/bulk`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids, updates }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error ?? 'Erreur lors de la mise à jour groupée.');
  }
}
