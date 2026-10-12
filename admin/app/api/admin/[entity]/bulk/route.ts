import { NextResponse } from 'next/server';
import { isValidUuid, requireAdminApi } from '../../../../../lib/adminApiAuth';
import { deletableEntities, validateAdminUpdates } from '../../../../../lib/adminMutationValidation';

type RouteContext = { params: Promise<{ entity: string | string[] | undefined }> };

async function getEntity(params: RouteContext['params']) {
  const { entity } = await params;
  return Array.isArray(entity) ? entity[0] : entity;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) return null;
  const ids = value.filter((id): id is string => typeof id === 'string');
  if (ids.length !== value.length || ids.some(id => !isValidUuid(id))) return null;
  return Array.from(new Set(ids));
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const entity = await getEntity(params);
  if (!entity) return NextResponse.json({ error: 'Type d’entité manquant.' }, { status: 400 });

  const guard = await requireAdminApi(request);
  if ('response' in guard) return guard.response;

  const payload = await readJson(request);
  if (!isRecord(payload)) {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }
  const ids = parseIds(payload.ids);
  const updates = validateAdminUpdates(entity, payload.updates);
  if (!ids || !updates) {
    return NextResponse.json({ error: 'Identifiants ou modifications invalides.' }, { status: 400 });
  }
  if (
    entity === 'profiles' &&
    ids.includes(guard.userId) &&
    updates.account_status === 'suspended'
  ) {
    return NextResponse.json({ error: 'Impossible de suspendre votre propre compte.' }, { status: 400 });
  }

  const { data, error } = await guard.supabaseAdmin
    .from(entity)
    .update(updates)
    .in('id', ids)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data?.length) return NextResponse.json({ error: 'Aucun enregistrement modifié.' }, { status: 404 });

  return NextResponse.json({ success: true, count: data.length });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const entity = await getEntity(params);
  if (!entity || !deletableEntities.has(entity)) {
    return NextResponse.json({ error: 'Type d’entité non autorisé.' }, { status: 400 });
  }

  const guard = await requireAdminApi(request);
  if ('response' in guard) return guard.response;

  const payload = await readJson(request);
  const ids = isRecord(payload) ? parseIds(payload.ids) : null;
  if (!ids) return NextResponse.json({ error: 'Liste d’identifiants invalide.' }, { status: 400 });

  const { data, error } = await guard.supabaseAdmin
    .from(entity)
    .delete()
    .in('id', ids)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data?.length) return NextResponse.json({ error: 'Aucun enregistrement supprimé.' }, { status: 404 });

  return NextResponse.json({ success: true, count: data.length });
}
