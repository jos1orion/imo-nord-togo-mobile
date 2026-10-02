import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isStaffRole } from './rbac';
import { fetchStaffProfileAccess } from './profileAccess';

const PUBLIC_PATHS = [
  '/login',
  '/login/mfa',
  '/auth/reset',
  '/delete-account',
  '/privacy',
  '/terms',
  '/api/health',
];

function isPublicPath(path: string) {
  return PUBLIC_PATHS.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicDocument =
    path === '/delete-account' ||
    path.startsWith('/delete-account/') ||
    path === '/privacy' ||
    path.startsWith('/privacy/') ||
    path === '/terms' ||
    path.startsWith('/terms/');

  if (isPublicDocument || path === '/api/health') {
    return NextResponse.next({ request });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return new NextResponse('Authentication service is not configured.', { status: 503 });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    return new NextResponse('Unable to connect to Supabase Auth.', { status: 503 });
  }

  if (!user && !isPublicPath(path) && !path.startsWith('/api/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && !path.startsWith('/api/')) {
    const { data: profile, error: profileError } = await fetchStaffProfileAccess(
      supabase,
      user.id
    );

    if (profileError) {
      return new NextResponse('Unable to verify staff access with Supabase.', { status: 503 });
    }

    if (!isStaffRole(profile?.role) || profile?.account_status === 'suspended') {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set(
        'error',
        profile?.account_status === 'suspended' ? 'suspended' : 'staff'
      );
      return NextResponse.redirect(url);
    }

    if (profile.role === 'ADMIN' && !isPublicPath(path)) {
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError || aal?.currentLevel !== 'aal2') {
        const url = request.nextUrl.clone();
        url.pathname = '/login/mfa';
        return NextResponse.redirect(url);
      }
    }

    if (path === '/login') {
      const url = request.nextUrl.clone();
      url.search = '';
      if (profile.role === 'ADMIN') {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        url.pathname = aal?.currentLevel === 'aal2' ? '/' : '/login/mfa';
      } else {
        url.pathname = '/';
      }
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
