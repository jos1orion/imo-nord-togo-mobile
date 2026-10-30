import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getExternalOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const host = forwardedHost || request.headers.get('host');

  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${forwardedProto}://${host}`;
  }

  return 'https://imo-nord-togo-mobile.onrender.com';
}

export async function POST(request: Request) {
  let password = '';
  const contentType = request.headers.get('content-type') || '';
  const isFormPost = contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');

  if (isFormPost) {
    try {
      const formData = await request.formData();
      password = String(formData.get('password') || '');
    } catch {
      password = '';
    }
  } else {
    try {
      const body = await request.json();
      password = String(body.password || '');
    } catch {
      password = '';
    }
  }

  const inputPassword = password.trim().replace(/^["']|["']$/g, '');
  const rawMasterPassword = process.env.ADMIN_PASSWORD ?? '';
  const masterPassword = rawMasterPassword.trim().replace(/^["']|["']$/g, '');

  const baseOrigin = getExternalOrigin(request);

  const redirectWithError = (errorCode: string, errorMessage: string) => {
    if (isFormPost) {
      const loginUrl = new URL('/login', baseOrigin);
      loginUrl.searchParams.set('error', errorCode);
      loginUrl.searchParams.set('msg', errorMessage);
      return NextResponse.redirect(loginUrl, 303);
    }
    return NextResponse.json({ error: errorMessage }, { status: errorCode === 'missing' ? 503 : 401 });
  };

  if (!masterPassword) {
    return redirectWithError(
      'missing',
      "La variable ADMIN_PASSWORD n'est pas configurée dans l'onglet Environment sur Render."
    );
  }

  if (!inputPassword || inputPassword !== masterPassword) {
    return redirectWithError(
      'password',
      'Mot de passe administrateur incorrect. Vérifiez la variable ADMIN_PASSWORD sur Render.'
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return redirectWithError(
      'config',
      'Variables NEXT_PUBLIC_SUPABASE_URL ou ANON_KEY manquantes sur Render.'
    );
  }

  const rawAdminEmail = process.env.ADMIN_EMAIL?.trim().replace(/^["']|["']$/g, '');
  if (!rawAdminEmail) {
    return redirectWithError('config', 'La variable ADMIN_EMAIL est requise sur Render.');
  }
  const adminEmail = rawAdminEmail.toLowerCase();

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Variables Supabase manquantes.';
    return redirectWithError('config', `Configuration Render : ${message}`);
  }

  try {
    // 1. Chercher si l'utilisateur existe déjà
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('Erreur listUsers:', listError);
      return redirectWithError('auth', `Erreur Supabase Auth: ${listError.message}`);
    }

    let targetUser = usersData.users.find(u => u.email?.toLowerCase() === adminEmail);

    if (!targetUser) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: masterPassword,
        email_confirm: true,
        user_metadata: { full_name: 'Super Admin' },
      });
      if (createError || !newUser.user) {
        return redirectWithError(
          'create',
          `Création admin Supabase refusée : ${createError?.message ?? 'inconnu'}`
        );
      }
      targetUser = newUser.user;
    } else {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        password: masterPassword,
        email_confirm: true,
      });
      if (updateError) {
        return redirectWithError(
          'update',
          `Mise à jour mot de passe Supabase refusée : ${updateError.message}`
        );
      }
    }

    // 2. Mettre à jour la table profiles avec le rôle ADMIN (la table profiles n'a pas de colonne email)
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
      {
        id: targetUser.id,
        full_name: 'Super Admin',
        role: 'ADMIN',
        account_status: 'active',
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      console.error('Erreur upsert profile ADMIN:', profileError);
    }

    // 3. Préparer la réponse de redirection
    const dashboardUrl = new URL('/', baseOrigin);
    const redirectResponse = isFormPost
      ? NextResponse.redirect(dashboardUrl, 303)
      : NextResponse.json({ success: true, email: adminEmail });

    // 4. Utiliser @supabase/ssr pour poser les cookies de session authentiques sur redirectResponse
    const cookieHeader = request.headers.get('cookie') || '';
    const serverSupabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieHeader.split(';').map(c => {
            const [name, ...v] = c.trim().split('=');
            return { name, value: v.join('=') };
          }).filter(c => c.name);
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, {
              ...options,
              path: '/',
              sameSite: 'lax',
              secure: true,
            });
          });
        },
      },
    });

    const { error: sessionError } = await serverSupabase.auth.signInWithPassword({
      email: adminEmail,
      password: masterPassword,
    });

    if (sessionError) {
      return redirectWithError(
        'signin',
        `Authentification Supabase échouée : ${sessionError.message}`
      );
    }

    // 5. Poser le cookie simple render_admin_session pour le middleware et le client React
    redirectResponse.cookies.set('render_admin_session', 'true', {
      path: '/',
      httpOnly: false, // Accessible par le serveur (middleware) et par le client (AuthGate / useSession)
      sameSite: 'lax',
      secure: true,
      maxAge: 60 * 60 * 24 * 7, // 7 jours
    });

    return redirectResponse;
  } catch (error) {
    console.error('Master login exception:', error);
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return redirectWithError('server', `Erreur interne serveur : ${message}`);
  }
}
