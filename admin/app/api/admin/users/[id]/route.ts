import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabaseAdmin';

const requireAdmin = async (request: Request) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Configuration serveur incomplète.';
    return { error: NextResponse.json({ error: message }, { status: 503 }) };
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { error: NextResponse.json({ error: 'Non autorisé.' }, { status: 401 }) };
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: NextResponse.json({ error: 'Session invalide.' }, { status: 401 }) };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Accès refusé.' }, { status: 403 }) };
  }

  return { supabaseAdmin, authUserId: authData.user.id };
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string | string[] | undefined }> }) {
  const { id } = await params;
  const userId = Array.isArray(id) ? id[0] : id;
  if (!userId) {
    return NextResponse.json({ error: 'ID utilisateur manquant.' }, { status: 400 });
  }
  const guard = await requireAdmin(request);
  if ('error' in guard) return guard.error;
  const { supabaseAdmin } = guard;

  const payload = await request.json();
  const { role, full_name, phone, password } = payload ?? {};

  if (role && !['USER', 'ADMIN', 'AGENT', 'ACCOUNTANT'].includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (full_name !== undefined) updates.full_name = full_name;
  if (phone !== undefined) updates.phone = phone;

  const passwordValue = typeof password === 'string' ? password.trim() : password;
  if (passwordValue !== undefined) {
    if (typeof passwordValue !== 'string' || passwordValue.length < 6) {
      return NextResponse.json({ error: 'Mot de passe invalide (6 caractères minimum).' }, { status: 400 });
    }
  }

  if (!Object.keys(updates).length && passwordValue === undefined) {
    return NextResponse.json({ error: 'Aucune modification.' }, { status: 400 });
  }

  if (Object.keys(updates).length) {
    const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  if (passwordValue !== undefined) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: passwordValue });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string | string[] | undefined }> }) {
  const { id } = await params;
  const userId = Array.isArray(id) ? id[0] : id;
  if (!userId) {
    return NextResponse.json({ error: 'ID utilisateur manquant.' }, { status: 400 });
  }
  const guard = await requireAdmin(request);
  if ('error' in guard) return guard.error;
  const { supabaseAdmin, authUserId } = guard;

  if (userId === authUserId) {
    return NextResponse.json({ error: 'Impossible de supprimer votre compte.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
