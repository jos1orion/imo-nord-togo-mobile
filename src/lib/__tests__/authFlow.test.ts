import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import { translate } from '../../i18n';
import {
  AuthFlowError,
  exchangeAuthCallbackWithClient,
  getAuthCallbackUrlForPlatform,
  getAuthFailureKind,
  getAuthFailureMessageKey,
  isValidSupabaseClientConfig,
  NATIVE_AUTH_CALLBACK_URL,
  type AuthFailureKind,
} from '../authFlow';

type CallbackClientOptions = {
  session?: { user: { id: string } } | null;
  profile?: { id: string } | null;
  exchangeError?: { message: string } | null;
  profileError?: { message: string } | null;
};

const createCallbackClient = (options: CallbackClientOptions = {}) => {
  const {
    session = { user: { id: 'auth-user-1' } },
    profile = { id: 'auth-user-1' },
    exchangeError = null,
    profileError = null,
  } = options;
  const exchangeCalls: string[] = [];
  const tableCalls: string[] = [];
  const maybeSingle = async () => ({ data: profile, error: profileError });
  const eq = (_column: string, _value: string) => ({ maybeSingle });
  const select = (_columns: string) => ({ eq });
  const from = (table: string) => {
    tableCalls.push(table);
    return { select };
  };
  const exchangeCodeForSession = async (code: string) => {
    exchangeCalls.push(code);
    return { data: { session }, error: exchangeError };
  };
  const client = {
    auth: { exchangeCodeForSession },
    from,
  } as unknown as SupabaseClient;
  return { client, exchangeCalls, tableCalls };
};

describe('OAuth callback configuration', () => {
  it('uses the current web origin and the existing native callback scheme', () => {
    expect(getAuthCallbackUrlForPlatform('web', 'https://imo.example/subpath'))
      .toBe('https://imo.example/auth/callback');
    expect(getAuthCallbackUrlForPlatform('android', 'https://ignored.example'))
      .toBe(NATIVE_AUTH_CALLBACK_URL);
  });

  it('rejects invalid web callback origins instead of falling back to the native scheme', () => {
    expect(() => getAuthCallbackUrlForPlatform('web', 'imonordtogo://auth/callback'))
      .toThrow(AuthFlowError);
  });

  it('requires a valid Supabase URL and public anon key', () => {
    expect(isValidSupabaseClientConfig('', '')).toBe(false);
    expect(isValidSupabaseClientConfig('not-a-url', 'public-anon-key')).toBe(false);
    expect(isValidSupabaseClientConfig('https://project.supabase.co', '')).toBe(false);
    expect(isValidSupabaseClientConfig('https://project.supabase.co', 'public-anon-key')).toBe(true);
  });
});

describe('OAuth failure classification', () => {
  const failureCases: [AuthFailureKind, unknown][] = [
    ['cancelled', { code: 'access_denied' }],
    ['configuration', new Error('Supabase is not configured.')],
    ['network', new TypeError('Failed to fetch')],
    ['invalid_callback', new Error('PKCE code verifier not found')],
    ['missing_profile', new AuthFlowError('missing_profile')],
  ];

  it.each(failureCases)('classifies %s without exposing provider details', (kind, error) => {
    expect(getAuthFailureKind(error)).toBe(kind);
    const message = translate('en', getAuthFailureMessageKey(error));
    expect(message).not.toContain('access_denied');
    expect(message).not.toContain('verifier');
  });
});

describe('OAuth callback exchange', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('exchanges the PKCE code and requires a matching app profile when requested', async () => {
    jest.useFakeTimers();
    const { client, exchangeCalls, tableCalls } = createCallbackClient();

    const result = await exchangeAuthCallbackWithClient(
      client,
      'https://imo.example/auth/callback?code=one-time-code',
      { requireProfile: true }
    );

    expect(exchangeCalls).toEqual(['one-time-code']);
    expect(tableCalls).toEqual(['profiles']);
    expect(result).toEqual({ error: null });
  });

  it('reports a missing profile after a successful code exchange', async () => {
    jest.useFakeTimers();
    const { client } = createCallbackClient({ profile: null });

    const result = await exchangeAuthCallbackWithClient(
      client,
      'https://imo.example/auth/callback?code=missing-profile-code',
      { requireProfile: true }
    );

    expect(getAuthFailureKind(result?.error)).toBe('missing_profile');
  });

  it('distinguishes cancellation and malformed callbacks without logging callback data', async () => {
    const { client, exchangeCalls } = createCallbackClient();

    const cancelled = await exchangeAuthCallbackWithClient(
      client,
      'https://imo.example/auth/callback?error=access_denied&error_description=User%20cancelled'
    );
    const invalid = await exchangeAuthCallbackWithClient(client, 'not a callback URL');

    expect(getAuthFailureKind(cancelled?.error)).toBe('cancelled');
    expect(getAuthFailureKind(invalid?.error)).toBe('invalid_callback');
    expect(exchangeCalls).toEqual([]);
  });
});
