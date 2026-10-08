import { NextResponse } from 'next/server';
import { requireAdminApi } from '../../../../../lib/requireAdminApi';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string | string[] | undefined }> }) {
  const { id } = await params;
  const userId = Array.isArray(id) ? id[0] : id;
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: 'ID utilisateur manquant.' }, { status: 400 });
  }
  const guard = await requireAdminApi(request);
  if ('response' in guard) return guard.response;
  const { supabaseAdmin } = guard;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }
  const body = payload as Record<string, unknown>;
  const { role, full_name, phone, password, account_status, verified } = body;

  if (role !== undefined && (typeof role !== 'string' || !['USER', 'ADMIN', 'AGENT', 'ACCOUNTANT'].includes(role))) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }
  if (account_status !== undefined && !['active', 'suspended', 'pending'].includes(String(account_status))) {
    return NextResponse.json({ error: 'Statut de compte invalide.' }, { status: 400 });
  }
  if (verified !== undefined && typeof verified !== 'boolean') {
    return NextResponse.json({ error: 'État de vérification invalide.' }, { status: 400 });
  }
  if (userId === guard.userId && account_status === 'suspended') {
    return NextResponse.json({ error: 'Impossible de suspendre votre propre compte.' }, { status: 400 });
  }
  if (full_name !== undefined && full_name !== null && (typeof full_name !== 'string' || full_name.length > 120)) {
    return NextResponse.json({ error: 'Nom invalide.' }, { status: 400 });
  }
  if (phone !== undefined && phone !== null && (typeof phone !== 'string' || phone.length > 40)) {
    return NextResponse.json({ error: 'Téléphone invalide.' }, { status: 400 });
  }

  const updates: {
    role?: string;
    account_status?: 'active' | 'suspended' | 'pending';
    full_name?: string | null;
    phone?: string | null;
  } = {};
  if (role !== undefined) updates.role = role;
  if (account_status !== undefined) {
    updates.account_status = account_status as 'active' | 'suspended' | 'pending';
  }
  if (full_name !== undefined) updates.full_name = typeof full_name === 'string' ? full_name.trim() || null : null;
  if (phone !== undefined) updates.phone = typeof phone === 'string' ? phone.trim() || null : null;

  const passwordValue = typeof password === 'string' ? password.trim() : password;
  if (passwordValue !== undefined) {
    if (typeof passwordValue !== 'string' || passwordValue.length < 6 || passwordValue.length > 256) {
      return NextResponse.json({ error: 'Mot de passe invalide (6 caractères minimum).' }, { status: 400 });
    }
  }

  if (!Object.keys(updates).length && passwordValue === undefined && verified === undefined) {
    return NextResponse.json({ error: 'Aucune modification.' }, { status: 400 });
  }

  if (Object.keys(updates).length) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id')
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
  }

  if (passwordValue !== undefined) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: passwordValue });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  if (verified !== undefined) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: verified,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string | string[] | undefined }> }) {
  const { id } = await params;
  const userId = Array.isArray(id) ? id[0] : id;
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: 'ID utilisateur manquant.' }, { status: 400 });
  }
  const guard = await requireAdminApi(request);
  if ('response' in guard) return guard.response;
  const { supabaseAdmin, userId: authUserId } = guard;

  if (userId === authUserId) {
    return NextResponse.json({ error: 'Impossible de supprimer votre compte.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
