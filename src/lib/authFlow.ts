import type { SupabaseClient } from '@supabase/supabase-js';

export const NATIVE_AUTH_CALLBACK_URL = 'imonordtogo://auth/callback';

export type AuthFailureKind =
  | 'cancelled'
  | 'configuration'
  | 'network'
  | 'invalid_callback'
  | 'missing_profile'
  | 'request_failed';

export type AuthFailureMessageKey =
  | 'profile_auth_google_cancelled'
  | 'profile_auth_google_config'
  | 'profile_auth_google_network'
  | 'profile_auth_google_callback'
  | 'profile_auth_google_profile'
  | 'profile_auth_google_failed';

const AUTH_FAILURE_MESSAGE_KEYS: Record<AuthFailureKind, AuthFailureMessageKey> = {
  cancelled: 'profile_auth_google_cancelled',
  configuration: 'profile_auth_google_config',
  network: 'profile_auth_google_network',
  invalid_callback: 'profile_auth_google_callback',
  missing_profile: 'profile_auth_google_profile',
  request_failed: 'profile_auth_google_failed',
};

export class AuthFlowError extends Error {
  readonly kind: AuthFailureKind;

  constructor(kind: AuthFailureKind) {
    super(kind);
    this.name = 'AuthFlowError';
    this.kind = kind;
  }
}

export const getAuthCallbackUrlForPlatform = (platform: string, origin?: string) => {
  if (platform !== 'web') return NATIVE_AUTH_CALLBACK_URL;
  if (!origin) throw new AuthFlowError('invalid_callback');

  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
      throw new Error('Unsupported callback origin.');
    }
    return new URL('/auth/callback', parsedOrigin.origin).toString();
  } catch {
    throw new AuthFlowError('invalid_callback');
  }
};

export const isValidSupabaseClientConfig = (url: string, anonKey: string) => {
  const candidateUrl = url.trim();
  const candidateKey = anonKey.trim();
  if (!candidateUrl || !candidateKey) return false;
  if (/YOUR_SUPABASE_(URL|ANON_KEY)/i.test(candidateUrl + candidateKey)) return false;
  try {
    const parsedUrl = new URL(candidateUrl);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
};

export const getAuthFailureKind = (error: unknown): AuthFailureKind => {
  if (error instanceof AuthFlowError) return error.kind;
  const details = error && typeof error === 'object'
    ? error as { name?: unknown; code?: unknown; message?: unknown; error?: unknown }
    : { message: error };
  const code = String(details.code ?? details.error ?? '').toLowerCase();
  const message = String(details.message ?? '').toLowerCase();
  const text = `${code} ${message}`;

  if (/access_denied|user_cancel(?:led|ed)?|cancel(?:led|ed)?/.test(text)) {
    return 'cancelled';
  }
  if (/profile (?:row )?not found|missing profile/.test(text)) {
    return 'missing_profile';
  }
  if (
    /supabase.{0,30}not configured|missing.{0,30}(?:supabase|anon key)|invalid api key|provider.{0,30}(?:disabled|not enabled)|redirect(?:_uri|_to|_url)?.{0,30}(?:invalid|not allowed|not permitted)/.test(text)
  ) {
    return 'configuration';
  }
  if (/network|failed to fetch|fetch failed|load failed|timeout|connection/.test(text)) {
    return 'network';
  }
  if (/invalid.{0,20}(?:callback|grant|state|code)|code[_ ]verifier|pkce|no authorization code/.test(text)) {
    return 'invalid_callback';
  }
  if (details.name === 'TypeError' && /fetch|network/.test(message)) return 'network';
  return 'request_failed';
};

export const getAuthFailureMessageKey = (error: unknown): AuthFailureMessageKey =>
  AUTH_FAILURE_MESSAGE_KEYS[getAuthFailureKind(error)];

type CallbackClient = Pick<SupabaseClient, 'auth' | 'from'>;

type CallbackExchangeOptions = {
  requireProfile?: boolean;
};

const authCodeExchanges = new Map<string, Promise<{ error: Error | null }>>();

const clearAuthExchange = (code: string) => {
  setTimeout(() => {
    authCodeExchanges.delete(code);
  }, 1000 * 60 * 5);
};

export const exchangeAuthCallbackWithClient = async (
  client: CallbackClient,
  url: string,
  { requireProfile = false }: CallbackExchangeOptions = {}
) => {
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(url);
  } catch {
    return { error: new AuthFlowError('invalid_callback') };
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
    return { error: new AuthFlowError(getAuthFailureKind({ code: oauthError, message: description })) };
  }

  const code =
    callbackUrl.searchParams.get('code') || fragmentParams.get('code');
  if (!code) return null;

  const existingExchange = authCodeExchanges.get(code);
  if (existingExchange) return existingExchange;

  const exchange = client.auth.exchangeCodeForSession(code).then(
    async ({ data, error }) => {
      clearAuthExchange(code);
      if (error) return { error };
      if (!requireProfile) return { error: null };
      if (!data.session?.user) return { error: new AuthFlowError('invalid_callback') };

      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('id')
        .eq('id', data.session.user.id)
        .maybeSingle();
      if (profileError) return { error: profileError };
      return profile
        ? { error: null }
        : { error: new AuthFlowError('missing_profile') };
    },
    error => {
      clearAuthExchange(code);
      return { error: error instanceof Error ? error : new Error('Authentication request failed.') };
    }
  );
  authCodeExchanges.set(code, exchange);
  return exchange;
};
