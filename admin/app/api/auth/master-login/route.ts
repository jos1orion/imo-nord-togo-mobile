import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBaseOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const host = forwardedHost || request.headers.get('host') || '';
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${forwardedProto}://${host}`;
  }
  return 'http://localhost:3000';
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  const isFormPost =
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');

  // ── 1. Lire le mot de passe saisi ──
  let inputPassword = '';
  if (isFormPost) {
    try {
      const formData = await request.formData();
      inputPassword = String(formData.get('password') || '').trim();
    } catch {
      inputPassword = '';
    }
  } else {
    try {
      const body = await request.json();
      inputPassword = String(body.password || '').trim();
    } catch {
      inputPassword = '';
    }
  }

  const baseOrigin = getBaseOrigin(request);

  const redirectError = (code: string, msg: string) => {
    if (isFormPost) {
      const url = new URL('/login', baseOrigin);
      url.searchParams.set('error', code);
      url.searchParams.set('msg', msg);
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ error: msg }, { status: code === 'missing' ? 503 : 401 });
  };

  // ── 2. Lire le mot de passe configuré sur Render ──
  const masterPassword = (process.env.ADMIN_PASSWORD ?? '').trim().replace(/^["']|["']$/g, '');

  if (!masterPassword) {
    return redirectError(
      'missing',
      "La variable ADMIN_PASSWORD n'est pas configurée dans l'onglet Environment sur Render."
    );
  }

  // ── 3. Comparer les mots de passe ──
  if (!inputPassword || inputPassword !== masterPassword) {
    return redirectError(
      'password',
      'Mot de passe incorrect. Vérifiez la variable ADMIN_PASSWORD sur Render.'
    );
  }

  // ── 4. Authentification réussie : poser le cookie de session ──
  const dashboardUrl = new URL('/', baseOrigin);
  const response = isFormPost
    ? NextResponse.redirect(dashboardUrl, 303)
    : NextResponse.json({ success: true });

  response.cookies.set('render_admin_session', 'true', {
    path: '/',
    httpOnly: false,   // Lisible par le middleware et AuthGate côté client
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  });

  return response;
}
