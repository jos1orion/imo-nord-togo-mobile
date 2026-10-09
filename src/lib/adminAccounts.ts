import Constants from 'expo-constants';
import { supabase } from './supabase';
import type { User } from '../types';

type AccountRole = NonNullable<User['role']>;
type AccountStatus = NonNullable<User['accountStatus']>;

type AdminAccountRecord = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  account_status: string | null;
  agent_status: string | null;
  agent_rejection_reason: string | null;
  verified: boolean;
  created_at: string | null;
};

type AdminAccountsResponse = {
  users: AdminAccountRecord[];
  total: number;
};

export type AdminAccountUpdates = {
  full_name?: string | null;
  phone?: string | null;
  role?: AccountRole;
  account_status?: AccountStatus;
  verified?: boolean;
};

const adminApiUrl = (
  process.env.EXPO_PUBLIC_ADMIN_API_URL ??
  Constants.expoConfig?.extra?.adminApiUrl ??
  'https://imo-nord-togo-mobile.vercel.app'
).replace(/\/+$/, '');

const accessToken = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.access_token) return data.session.access_token;

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error) throw refreshed.error;
  if (!refreshed.data.session?.access_token) {
    throw new Error('Votre session administrateur a expirÃ©. Reconnectez-vous.');
  }
  return refreshed.data.session.access_token;
};

const requestAdminApi = async <T,>(
  path: string,
  init: RequestInit = {},
  retryUnauthorized = true,
  retryToken?: string,
): Promise<T> => {
  const token = retryToken ?? await accessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${adminApiUrl}${path}`, {
    ...init,
    headers,
  });
  const responseText = await response.text();
  let payload: { error?: string } & T;
  try {
    payload = JSON.parse(responseText) as { error?: string } & T;
  } catch {
    throw new Error(`RÃ©ponse invalide du back-office (${response.status}).`);
  }

  if (response.status === 401 && retryUnauthorized) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    if (refreshed.data.session?.access_token) {
      return requestAdminApi<T>(path, init, false, refreshed.data.session.access_token);
    }
  }
  if (!response.ok) {
    throw new Error(payload.error || `RequÃªte au back-office refusÃ©e (${response.status}).`);
  }
  return payload;
};

const isAccountRole = (role: string | null): role is AccountRole =>
  role === 'USER' || role === 'ADMIN' || role === 'AGENT' || role === 'ACCOUNTANT';

const isAccountStatus = (status: string | null): status is AccountStatus =>
  status === 'active' || status === 'suspended' || status === 'pending';

const mapAccount = (record: AdminAccountRecord): User => {
  const email = record.email ?? '';
  return {
    id: record.id,
    name: record.full_name?.trim() || email || 'Compte sans nom',
    email,
    phone: record.phone ?? '',
    verified: record.verified,
    role: isAccountRole(record.role) ? record.role : 'USER',
    accountStatus: isAccountStatus(record.account_status) ? record.account_status : 'active',
    agentStatus:
      record.agent_status === 'pending' ||
      record.agent_status === 'approved' ||
      record.agent_status === 'rejected'
        ? record.agent_status
        : 'none',
    agentRejectionReason: record.agent_rejection_reason,
    createdAt: record.created_at ?? undefined,
  };
};

export const fetchAdminAccounts = async (): Promise<User[]> => {
  const pageSize = 100;
  const accounts: User[] = [];
  let page = 1;
  let total = 0;

  do {
    const result = await requestAdminApi<AdminAccountsResponse>(
      `/api/admin/users?page=${page}&pageSize=${pageSize}`,
    );
    if (!Array.isArray(result.users) || typeof result.total !== 'number') {
      throw new Error('La liste des comptes renvoyÃ©e par le back-office est invalide.');
    }
    accounts.push(...result.users.map(mapAccount));
    total = result.total;
    page += 1;
  } while (accounts.length < total);

  return accounts;
};

export const updateAdminAccount = async (
  id: string,
  updates: AdminAccountUpdates,
): Promise<void> => {
  await requestAdminApi<{ success: boolean }>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
};
