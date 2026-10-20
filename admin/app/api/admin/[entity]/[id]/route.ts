import { NextResponse } from 'next/server';
import { isValidUuid, recordAdminAction, requireAdminApi } from '../../../../../lib/adminApiAuth';
import {
  AdminPropertyDeletionError,
  deleteAdminProperties,
} from '../../../../../lib/adminPropertyDeletion';
import { deletableEntities, validateAdminUpdates } from '../../../../../lib/adminMutationValidation';

type RouteContext = {
  params: Promise<{ entity: string | string[] | undefined; id: string | string[] | undefined }>;
};

function getRouteIds(params: Awaited<RouteContext['params']>) {
  const entity = Array.isArray(params.entity) ? params.entity[0] : params.entity;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return { entity, id };
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  const { entity, id } = getRouteIds(await params);
  if (!entity || !id || !isValidUuid(id)) {
    return NextResponse.json({ error: 'Identifiant ou type d’entité invalide.' }, { status: 400 });
  }

  const guard = await requireAdminApi(request, { allowPropertyAgent: true });
  if ('response' in guard) return guard.response;
  if (guard.userRole === 'AGENT' && entity !== 'properties') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const updates = validateAdminUpdates(entity, payload);
  if (!updates) {
    return NextResponse.json({ error: 'Modifications invalides ou non autorisées.' }, { status: 400 });
  }
  if (
    guard.userRole === 'AGENT' &&
    Object.keys(updates).some(
      key => !['title', 'type', 'price', 'location', 'neighborhood', 'description'].includes(key),
    )
  ) {
    return NextResponse.json(
      { error: 'Un agent peut uniquement corriger le contenu de son brouillon.' },
      { status: 403 },
    );
  }
  if (entity === 'profiles' && id === guard.userId && updates.account_status === 'suspended') {
    return NextResponse.json({ error: 'Impossible de suspendre votre propre compte.' }, { status: 400 });
  }

  let updateQuery = guard.supabaseAdmin
    .from(entity)
    .update(updates)
    .eq('id', id);
  if (guard.userRole === 'AGENT') {
    updateQuery = updateQuery
      .eq('owner_id', guard.userId)
      .in('listing_status', ['pending', 'rejected']);
  }
  const { data, error } = await updateQuery.select('id').maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json(
      {
        error:
          guard.userRole === 'AGENT'
            ? 'Brouillon introuvable ou non modifiable.'
            : 'Enregistrement introuvable.',
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { entity, id } = getRouteIds(await params);
  if (!entity || !deletableEntities.has(entity) || !id || !isValidUuid(id)) {
    return NextResponse.json({ error: 'Identifiant ou type d’entité invalide.' }, { status: 400 });
  }

  const guard = await requireAdminApi(request, { allowPropertyAgent: true });
  if ('response' in guard) return guard.response;
  if (guard.userRole === 'AGENT' && entity !== 'properties') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  if (entity === 'properties') {
    try {
      const result = await deleteAdminProperties(
        guard.supabaseAdmin,
        [id],
        guard.userRole === 'AGENT'
          ? { ownerId: guard.userId, listingStatuses: ['pending', 'rejected'] }
          : undefined,
      );
      await recordAdminAction(guard.supabaseAdmin, guard.userId, 'delete_property', 'property', id);
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue lors de la suppression.';
      const status = error instanceof AdminPropertyDeletionError ? error.status : 500;
      console.error('Admin property deletion failed.', message);
      return NextResponse.json({ error: message }, { status });
    }
  }

  const { data, error } = await guard.supabaseAdmin
    .from(entity)
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: 'Enregistrement introuvable.' }, { status: 404 });

  return NextResponse.json({ success: true });
}
