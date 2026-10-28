import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { password?: string; email?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const inputPassword = (body.password ?? '').trim().replace(/^["']|["']$/g, '');
  const rawMasterPassword = process.env.ADMIN_PASSWORD ?? '';
  const masterPassword = rawMasterPassword.trim().replace(/^["']|["']$/g, '');

  if (!masterPassword) {
    return NextResponse.json(
      { error: "La variable ADMIN_PASSWORD n'est pas configurée dans l'onglet Environment sur Render." },
      { status: 503 }
    );
  }

  if (!inputPassword || inputPassword !== masterPassword) {
    return NextResponse.json(
      { error: 'Mot de passe administrateur incorrect. Vérifiez la variable ADMIN_PASSWORD sur Render.' },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Variables NEXT_PUBLIC_SUPABASE_URL ou ANON_KEY manquantes sur Render.' },
      { status: 503 }
    );
  }

  const rawAdminEmail = process.env.ADMIN_EMAIL?.trim().replace(/^["']|["']$/g, '') || 'admin@imoprestige.tg';
  const adminEmail = (body.email?.trim() || rawAdminEmail).toLowerCase();

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Variables Supabase manquantes.';
    return NextResponse.json(
      { error: `Configuration Render : ${message}` },
      { status: 503 }
    );
  }

  try {
    // 1. Chercher si l'utilisateur existe déjà
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('Erreur listUsers:', listError);
      return NextResponse.json({ error: `Erreur Supabase Auth: ${listError.message}` }, { status: 500 });
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
        return NextResponse.json(
          { error: `Création admin Supabase refusée : ${createError?.message ?? 'inconnu'}` },
          { status: 400 }
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
        return NextResponse.json(
          { error: `Mise à jour mot de passe Supabase refusée : ${updateError.message}` },
          { status: 400 }
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
      return NextResponse.json(
        { error: `Authentification Supabase échouée : ${sessionError?.message ?? 'Session introuvable'}` },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      email: adminEmail,
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    });

    return response;
  } catch (error) {
    console.error('Master login exception:', error);
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json({ error: `Erreur interne serveur : ${message}` }, { status: 500 });
  }
}
