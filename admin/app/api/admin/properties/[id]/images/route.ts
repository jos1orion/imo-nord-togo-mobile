import { NextResponse } from 'next/server';
import { isValidUuid, recordAdminAction, requireAdminApi } from '../../../../../../lib/adminApiAuth';
import { getPropertyImageStoragePaths } from '../../../../../../../src/utils/propertyStorage';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Identifiant du bien invalide.' }, { status: 400 });
  }

  const guard = await requireAdminApi(request);
  if ('response' in guard) return guard.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('url' in payload) ||
    typeof payload.url !== 'string' ||
    payload.url.length > 2048
  ) {
    return NextResponse.json({ error: 'Adresse de photo invalide.' }, { status: 400 });
  }

  const { data: image, error: imageError } = await guard.supabaseAdmin
    .from('property_images')
    .select('url')
    .eq('property_id', id)
    .eq('url', payload.url)
    .maybeSingle();
  if (imageError) {
    console.error('Unable to verify property image before deletion.', imageError.message);
    return NextResponse.json({ error: 'Impossible de vérifier cette photo.' }, { status: 500 });
  }
  if (!image) {
    return NextResponse.json({ error: 'Photo introuvable pour ce bien.' }, { status: 404 });
  }

  const paths = getPropertyImageStoragePaths(
    [image.url],
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  );
  const pathSegments = paths[0]?.split('/');
  if (
    paths.length !== 1 ||
    pathSegments?.length !== 3 ||
    pathSegments[1] !== id
  ) {
    return NextResponse.json({ error: 'Adresse de stockage de photo invalide.' }, { status: 400 });
  }

  const { error: storageError } = await guard.supabaseAdmin.storage
    .from('property-images')
    .remove(paths);
  if (storageError) {
    console.error('Unable to remove property image from Storage.', storageError.message);
    return NextResponse.json({ error: 'La suppression du fichier photo a échoué.' }, { status: 500 });
  }

  const { error: rowError } = await guard.supabaseAdmin
    .from('property_images')
    .delete()
    .eq('property_id', id)
    .eq('url', image.url);
  if (rowError) {
    console.error('Storage image deleted but its database reference remains.', rowError.message);
    return NextResponse.json(
      { error: 'Fichier supprimé, mais la référence de la photo n’a pas pu être supprimée.' },
      { status: 500 }
    );
  }

  await recordAdminAction(guard.supabaseAdmin, guard.userId, 'delete_property_image', 'property', id);
  return NextResponse.json({ success: true });
}
