import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const redirectWithError = (errorCode: string, errorMessage: string) => {
    if (isFormPost) {
      const loginUrl = new URL('/login', request.url);
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

  const rawAdminEmail = process.env.ADMIN_EMAIL?.trim().replace(/^["']|["']$/g, '') || 'admin@imoprestige.tg';
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
      // Créer le compte admin avec le mot de passe
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
      // Mettre à jour le mot de passe pour qu'il corresponde toujours à masterPassword
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

    // 2. Mettre à jour la table profiles avec le rôle ADMIN
    await supabaseAdmin.from('profiles').upsert(
      {
        id: targetUser.id,
        email: adminEmail,
        full_name: 'Super Admin',
        role: 'ADMIN',
        account_status: 'active',
      },
      { onConflict: 'id' }
    );

    // 3. Obtenir les tokens de session via Supabase Auth
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
      email: adminEmail,
      password: masterPassword,
    });

    if (sessionError || !sessionData.session) {
      return redirectWithError(
        'signin',
        `Authentification Supabase échouée : ${sessionError?.message ?? 'Session introuvable'}`
      );
    }

    // 4. Si soumission via formulaire HTML direct, rediriger avec cookie vers le dashboard
    if (isFormPost) {
      const dashboardUrl = new URL('/', request.url);
      const redirectResponse = NextResponse.redirect(dashboardUrl, 303);

      // On dépose le cookie de session Supabase pour que le middleware le lise directement
      const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
      const sessionString = JSON.stringify([
        sessionData.session.access_token,
        sessionData.session.refresh_token,
        null,
        null,
        null,
      ]);

      redirectResponse.cookies.set(storageKey, sessionString, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
      });

      return redirectResponse;
    }

    return NextResponse.json({
      success: true,
      email: adminEmail,
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    });
  } catch (error) {
    console.error('Master login exception:', error);
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return redirectWithError('server', `Erreur interne serveur : ${message}`);
  }
}
