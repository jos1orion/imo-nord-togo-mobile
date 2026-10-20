import { NextResponse } from 'next/server';
import { isValidUuid, recordAdminAction, requireAdminApi } from '../../../../../lib/adminApiAuth';

type RouteContext = {
  params: Promise<{ id: string | string[] | undefined }>;
};

const validNextStatuses = ['in_progress', 'completed', 'rejected'] as const;

export async function PATCH(request: Request, { params }: RouteContext) {
  const param = (await params).id;
  const id = Array.isArray(param) ? param[0] : param;
  if (!id || !isValidUuid(id)) {
    return NextResponse.json({ error: 'Identifiant de demande invalide.' }, { status: 400 });
  }

  const guard = await requireAdminApi(request);
  if ('response' in guard) return guard.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }
  const status =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).status
      : null;
  if (
    typeof status !== 'string' ||
    !validNextStatuses.includes(status as (typeof validNextStatuses)[number])
  ) {
    return NextResponse.json({ error: 'Statut de traitement invalide.' }, { status: 400 });
  }

  const { data: current, error: lookupError } = await guard.supabaseAdmin
    .from('account_deletion_requests')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (lookupError) {
    console.error('Account deletion request lookup failed.', lookupError.message);
    return NextResponse.json({ error: 'Impossible de vérifier la demande.' }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
  }
  if (
    (status === 'in_progress' && current.status !== 'pending') ||
    ((status === 'completed' || status === 'rejected') && current.status !== 'in_progress')
  ) {
    return NextResponse.json(
      { error: 'Cette demande a déjà été traitée ou doit d’abord être prise en charge.' },
      { status: 409 }
    );
  }

  const finished = status === 'completed' || status === 'rejected';
  const { data, error } = await guard.supabaseAdmin
    .from('account_deletion_requests')
    .update({
      status,
      ...(finished ? { email: null } : {}),
      processed_at: finished ? new Date().toISOString() : null,
      processed_by: guard.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', current.status)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('Account deletion request update failed.', error.message);
    return NextResponse.json({ error: 'Impossible de mettre à jour la demande.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: 'La demande a été modifiée par un autre administrateur.' },
      { status: 409 }
    );
  }

  await recordAdminAction(
    guard.supabaseAdmin,
    guard.userId,
    `account_deletion_request_${status}`,
    'account_deletion_request',
    id
  );
  return NextResponse.json({ success: true });
}
