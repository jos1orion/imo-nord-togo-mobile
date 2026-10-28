import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hasValidSecret = (provided: string, expected: string): boolean => {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
};

export async function POST(request: Request) {
  let body: { password?: string; email?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Données invalides.' }, { status: 400 });
  }

  const { password, email } = body;
  const masterPassword = process.env.ADMIN_PASSWORD?.trim();

  if (!masterPassword) {
    return NextResponse.json(
      { error: "La variable ADMIN_PASSWORD n'est pas encore configurée sur Render. Ajoutez-la dans Environment Variables." },
      { status: 503 }
    );
  }

  if (!password || !hasValidSecret(password.trim(), masterPassword)) {
    return NextResponse.json({ error: 'Mot de passe administrateur incorrect.' }, { status: 401 });
  }

  const adminEmail = (email?.trim() || process.env.ADMIN_EMAIL?.trim() || 'admin@imoprestige.tg').toLowerCase();

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    return NextResponse.json(
      { error: 'Supabase admin non configuré.' },
      { status: 503 }
    );
  }

  try {
    // 1. Chercher si l'administrateur existe déjà dans Supabase Auth
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('Erreur listUsers:', listError);
      return NextResponse.json({ error: 'Erreur lors de la vérification du compte admin.' }, { status: 500 });
    }

    let targetUser = usersData.users.find(u => u.email?.toLowerCase() === adminEmail);

    if (!targetUser) {
      // Créer le compte admin avec le mot de passe maître
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: masterPassword,
        email_confirm: true,
        user_metadata: { full_name: 'Super Admin' },
      });
      if (createError || !newUser.user) {
        return NextResponse.json({ error: createError?.message ?? 'Impossible de créer le compte admin.' }, { status: 500 });
      }
      targetUser = newUser.user;
    } else {
      // Mettre à jour le mot de passe pour qu'il corresponde toujours à ADMIN_PASSWORD
      await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        password: masterPassword,
        email_confirm: true,
      });
    }

    // 2. S'assurer que le rôle dans profiles est ADMIN et actif
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

    return NextResponse.json({
      success: true,
      email: adminEmail,
    });
  } catch (error) {
    console.error('Master login error:', error);
    return NextResponse.json({ error: 'Erreur serveur lors de la connexion.' }, { status: 500 });
  }
}

