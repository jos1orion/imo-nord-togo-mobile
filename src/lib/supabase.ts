import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { logger } from './logger';

export const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  '';
export const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  '';

export const authCallbackUrl = 'imonordtogo://auth/callback';
export const resetPasswordCallbackUrl = 'imonordtogo://reset-password';

export const getAuthCallbackUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      return new URL('/auth/callback', window.location.origin).toString();
    } catch (e) {
      return authCallbackUrl;
    }
  }
  return authCallbackUrl;
};

export const getResetPasswordCallbackUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      return new URL('/reset-password', window.location.origin).toString();
    } catch (e) {
      return resetPasswordCallbackUrl;
    }
  }
  return resetPasswordCallbackUrl;
};

export const matchesAuthCallbackUrl = (url: string | null, callbackUrl: string) => {
  if (!url) return false;
  try {
    const parsedUrl = new URL(url);
    const parsedCallback = new URL(callbackUrl);
    return (
      parsedUrl.origin === parsedCallback.origin &&
      parsedUrl.pathname === parsedCallback.pathname
    );
  } catch (e) {
    return url === callbackUrl || url.startsWith(`${callbackUrl}?`) || url.startsWith(`${callbackUrl}#`);
  }
};

const isValidHttpUrl = (value: string) => {
  if (!value) return false;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    if (typeof URL !== 'undefined') {
      const url = new URL(trimmed);
      return url.protocol === 'http:' || url.protocol === 'https:';
    }
  } catch {
    return false;
  }
  return true;
};

const isSupabaseConfigured =
  isValidHttpUrl(supabaseUrl) &&
  supabaseAnonKey.length > 0 &&
  !supabaseUrl.includes('YOUR_SUPABASE_URL') &&
  !supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY');

const makeNotConfiguredError = () => ({
  message: 'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
});

type NoopResult = { data: null; error: { message: string } };
type NoopChainMethod =
  | 'select'
  | 'insert'
  | 'update'
  | 'delete'
  | 'upsert'
  | 'eq'
  | 'neq'
  | 'match'
  | 'or'
  | 'order'
  | 'limit'
  | 'range'
  | 'in'
  | 'contains'
  | 'gte'
  | 'lte'
  | 'gt'
  | 'lt'
  | 'is'
  | 'not'
  | 'filter'
  | 'textSearch'
  | 'throwOnError'
  | 'returns'
  | 'single'
  | 'maybeSingle';
type NoopQueryBuilder = PromiseLike<NoopResult> & {
  [Method in NoopChainMethod]: (...args: unknown[]) => NoopQueryBuilder;
};
type NoopRealtimeChannel = {
  on: (...args: unknown[]) => NoopRealtimeChannel;
  subscribe: (...args: unknown[]) => NoopRealtimeChannel;
};

const makeNotConfiguredResponse = async (): Promise<NoopResult> => ({
  data: null,
  error: makeNotConfiguredError(),
});

/**
 * Supabase query builders are "thenables" (awaitable) and chainable.
 * When Supabase isn't configured, we return a chainable thenable that never crashes
 * even if the app calls methods like `.order()`, `.or()`, `.match()`, `.upsert()`, etc.
 */
const createNoopQueryBuilder = () => {
  let builder: NoopQueryBuilder;
  const chain = (..._args: unknown[]): NoopQueryBuilder => builder;
  builder = {
    then: (onfulfilled, onrejected) =>
      makeNotConfiguredResponse().then(onfulfilled, onrejected),
    select: chain,
    insert: chain,
    update: chain,
    delete: chain,
    upsert: chain,
    eq: chain,
    neq: chain,
    match: chain,
    or: chain,
    order: chain,
    limit: chain,
    range: chain,
    in: chain,
    contains: chain,
    gte: chain,
    lte: chain,
    gt: chain,
    lt: chain,
    is: chain,
    not: chain,
    filter: chain,
    textSearch: chain,
    throwOnError: chain,
    returns: chain,
    single: chain,
    maybeSingle: chain,
  };
  return builder;
};

const createNoopSupabase = (): SupabaseClient =>
  ({
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      getSession: async () => ({ data: { session: null }, error: makeNotConfiguredError() }),
      getUser: async () => ({ data: { user: null }, error: makeNotConfiguredError() }),
      setSession: async () => ({
        data: { session: null, user: null },
        error: makeNotConfiguredError(),
      }),
      resetPasswordForEmail: async () => ({ data: null, error: makeNotConfiguredError() }),
      signUp: async () => ({ data: null, error: makeNotConfiguredError() }),
      signInWithPassword: async () => ({ data: null, error: makeNotConfiguredError() }),
      signOut: async () => ({ error: makeNotConfiguredError() }),
    },
    from: () => createNoopQueryBuilder(),
    channel: () => {
      const channel: NoopRealtimeChannel = {
        on: () => channel,
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: () => {},
    storage: {
      from: () => ({
        getPublicUrl: () => ({ data: { publicUrl: '' }, error: makeNotConfiguredError() }),
        createSignedUploadUrl: async () => ({ data: null, error: makeNotConfiguredError() }),
      }),
    },
  } as unknown as SupabaseClient);

const ExpoSecureStore = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// expo-secure-store is native-only. Its Web shim can load but does not expose
// the storage methods used by Supabase, which prevents every data request.
const supabaseStorage = Platform.OS === 'web' ? AsyncStorage : ExpoSecureStore;

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
        detectSessionInUrl: false,
        storage: supabaseStorage,
      },
    })
  : createNoopSupabase();

const authCodeExchanges = new Map<
  string,
  Promise<{ error: Error | null }>
>();

const clearAuthExchange = (code: string) => {
  setTimeout(() => {
    authCodeExchanges.delete(code);
  }, 1000 * 60 * 5); // Clear after 5 minutes
};

export const exchangeAuthCallback = async (url: string) => {
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(url);
  } catch (e) {
    return { error: new Error('Invalid callback URL') };
  }
  const fragmentParams = new URLSearchParams(callbackUrl.hash.slice(1));
  const oauthError =
    callbackUrl.searchParams.get('error') || fragmentParams.get('error');
  if (oauthError) {
    const description =
      callbackUrl.searchParams.get('error_description') ||
      fragmentParams.get('error_description') ||
      callbackUrl.searchParams.get('error_code') ||
      fragmentParams.get('error_code') ||
      oauthError;
    return { error: new Error(description) };
  }

  const code =
    callbackUrl.searchParams.get('code') || fragmentParams.get('code');
  if (code) {
    const existingExchange = authCodeExchanges.get(code);
    if (existingExchange) return existingExchange;

    const exchange = supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      clearAuthExchange(code);
      return {
        error: error ?? null,
      };
    });
    authCodeExchanges.set(code, exchange);
    return exchange;
  }

  return null;
};

if (!isSupabaseConfigured) {
  logger.warn(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable backend features.'
  );
}
