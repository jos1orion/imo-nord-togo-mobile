import { NextResponse } from 'next/server';
import { isValidUuid, recordAdminAction, requireAdmin } from '../../../../../lib/adminApiAuth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string | string[] | undefined }> }) {
  const { id } = await params;
  const userId = Array.isArray(id) ? id[0] : id;
  if (!userId || !isValidUuid(userId)) {
    return NextResponse.json({ error: 'ID utilisateur manquant.' }, { status: 400 });
  }
  const guard = await requireAdmin(request);
  if ('error' in guard) return guard.error;
  const { supabaseAdmin, authUserId } = guard;

  let payload: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });
  }

  const { role, full_name, phone, password } = payload ?? {};

  if (role !== undefined && (typeof role !== 'string' || !['USER', 'ADMIN', 'AGENT', 'ACCOUNTANT'].includes(role))) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }
  if (full_name !== undefined && (typeof full_name !== 'string' || full_name.length > 200)) {
    return NextResponse.json({ error: 'Nom invalide.' }, { status: 400 });
  }
  if (phone !== undefined && (typeof phone !== 'string' || phone.length > 40)) {
    return NextResponse.json({ error: 'Téléphone invalide.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (role !== undefined) {
    updates.role = role;
    if (role === 'AGENT') updates.agent_status = 'approved';
    if (role === 'USER') updates.agent_status = 'none';
  }
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
      return NextResponse.json({ error: 'Profil utilisateur impossible à modifier.' }, { status: 400 });
    }
  }

  if (passwordValue !== undefined) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: passwordValue });
    if (error) {
      return NextResponse.json({ error: 'Mot de passe impossible à modifier.' }, { status: 400 });
    }
  }

  await recordAdminAction(supabaseAdmin, authUserId, 'update_user', 'user', userId);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string | string[] | undefined }> }) {
  const { id } = await params;
  const userId = Array.isArray(id) ? id[0] : id;
  if (!userId || !isValidUuid(userId)) {
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
    return NextResponse.json({ error: 'Utilisateur impossible à supprimer.' }, { status: 400 });
  }

  await recordAdminAction(supabaseAdmin, authUserId, 'delete_user', 'user', userId);
  return NextResponse.json({ success: true });
}
