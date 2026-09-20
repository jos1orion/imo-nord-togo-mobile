import { NextResponse } from 'next/server';
import { isValidUuid, recordAdminAction, requireAdmin } from '../../../../../lib/adminApiAuth';

const statuses = ['approved', 'rejected'] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string | string[] | undefined }> },
) {
  const { id } = await params;
  const agentId = Array.isArray(id) ? id[0] : id;
  if (!agentId || !isValidUuid(agentId)) {
    return NextResponse.json({ error: 'ID agent manquant.' }, { status: 400 });
  }

  const guard = await requireAdmin(request);
  if ('error' in guard) return guard.error;

  let payload: { status?: unknown; rejection_reason?: unknown };
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
    }
    payload = parsed as { status?: unknown; rejection_reason?: unknown };
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });
  }

  const status = payload.status;
  const reason = payload.rejection_reason;
  if (typeof status !== 'string' || !statuses.includes(status as (typeof statuses)[number])) {
    return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
  }
  if (status === 'rejected' && (typeof reason !== 'string' || !reason.trim())) {
    return NextResponse.json({ error: 'Un motif est obligatoire pour un refus.' }, { status: 400 });
  }
  if (reason !== undefined && (typeof reason !== 'string' || reason.length > 1000)) {
    return NextResponse.json({ error: 'Motif invalide.' }, { status: 400 });
  }

  const { error } = await guard.supabaseAdmin
    .from('profiles')
    .update({
      agent_status: status,
      agent_rejection_reason: status === 'rejected' ? (reason as string).trim() : null,
      role: status === 'approved' ? 'AGENT' : 'USER',
    })
    .eq('id', agentId);
  if (error) {
    console.error('Admin agent update failed', error.message);
    return NextResponse.json({ error: 'Demande agent impossible à modifier.' }, { status: 400 });
  }

  await recordAdminAction(
    guard.supabaseAdmin,
    guard.authUserId,
    status === 'approved' ? 'approve_agent' : 'reject_agent',
    'agent',
    agentId,
  );
  return NextResponse.json({ success: true });
}
