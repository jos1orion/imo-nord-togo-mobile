import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const makeNoopError = () => ({ message: 'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.' });

const makeNoopResult = async () => ({ data: null, error: makeNoopError() });

const createNoopQueryBuilder = () => {
  const builder: any = {};

  builder.then = (resolve: (value: { data: null; error: { message: string } }) => void, reject: (reason?: unknown) => void) =>
    makeNoopResult().then(resolve, reject);

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
      getSession: async () => ({ data: { session: null }, error: makeNoopError() }),
      getUser: async () => ({ data: { user: null }, error: makeNoopError() }),
      resetPasswordForEmail: async () => ({ data: null, error: makeNoopError() }),
      signInWithPassword: async () => ({ data: null, error: makeNoopError() }),
      signOut: async () => ({ error: makeNoopError() }),
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
        getPublicUrl: () => ({ data: { publicUrl: '' }, error: makeNoopError() }),
        createSignedUploadUrl: async () => ({ data: null, error: makeNoopError() }),
      }),
    },
  } as unknown as SupabaseClient);

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('YOUR_SUPABASE_URL') && !supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY'));

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : createNoopSupabase();
