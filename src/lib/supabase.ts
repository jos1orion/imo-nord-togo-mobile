import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  '';
export const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  '';

export const authCallbackUrl = 'imonordtogo://auth/callback';

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
  const builder: any = {};

  builder.then = (
    resolve: (value: NoopResult) => void,
    reject: (reason?: unknown) => void
  ) => makeNotConfiguredResponse().then(resolve, reject);

  // Common query builder chain methods used across the app.
  const chain = () => builder;
  builder.select = chain;
  builder.insert = chain;
  builder.update = chain;
  builder.delete = chain;
  builder.upsert = chain;
  builder.eq = chain;
  builder.neq = chain;
  builder.match = chain;
  builder.or = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.range = chain;
  builder.in = chain;
  builder.contains = chain;
  builder.gte = chain;
  builder.lte = chain;
  builder.gt = chain;
  builder.lt = chain;
  builder.is = chain;
  builder.not = chain;
  builder.filter = chain;
  builder.textSearch = chain;
  builder.throwOnError = chain;
  builder.returns = chain;
  builder.single = chain;
  builder.maybeSingle = chain;

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
      resetPasswordForEmail: async () => ({ data: null, error: makeNotConfiguredError() }),
      signUp: async () => ({ data: null, error: makeNotConfiguredError() }),
      signInWithPassword: async () => ({ data: null, error: makeNotConfiguredError() }),
      signOut: async () => ({ error: makeNotConfiguredError() }),
    },
    from: () => createNoopQueryBuilder(),
    channel: () => {
      const channel: any = {};
      channel.on = () => channel;
      channel.subscribe = () => channel;
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
        detectSessionInUrl: false,
        storage: supabaseStorage,
      },
    })
  : createNoopSupabase();

const authCodeExchanges = new Map<
  string,
  Promise<{ error: Error | null }>
>();

export const exchangeAuthCallback = async (url: string) => {
  const code = new URL(url).searchParams.get('code');
  if (!code) return null;

  const existingExchange = authCodeExchanges.get(code);
  if (existingExchange) return existingExchange;

  const exchange = supabase.auth.exchangeCodeForSession(code).then(({ error }) => ({
    error: error ?? null,
  }));
  authCodeExchanges.set(code, exchange);
  return exchange;
};

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable backend features.'
  );
}
