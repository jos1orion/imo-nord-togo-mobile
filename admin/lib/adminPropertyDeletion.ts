import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { chunkStoragePaths, getPropertyImageStoragePath } from '../../src/utils/propertyStorage';

type PropertyRecord = {
  id: string;
  owner_id: string | null;
  listing_status: string | null;
};
type PropertyImageRecord = { property_id: string; url: string };
type PropertyDeletionScope = {
  ownerId: string;
  listingStatuses: readonly string[];
};

export class AdminPropertyDeletionError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = 'AdminPropertyDeletionError';
  }
}

export async function deleteAdminProperties(
  supabaseAdmin: SupabaseClient,
  propertyIds: readonly string[],
  scope?: PropertyDeletionScope,
): Promise<{ count: number; warning: string | null }> {
  const ids = Array.from(new Set(propertyIds));
  const { data: properties, error: propertyQueryError } = await supabaseAdmin
    .from('properties')
    .select('id, owner_id, listing_status')
    .in('id', ids);
  if (propertyQueryError) {
    throw new AdminPropertyDeletionError(`Impossible de vérifier les biens : ${propertyQueryError.message}`, 500);
  }
  if (!properties || properties.length !== ids.length) {
    throw new AdminPropertyDeletionError('Un ou plusieurs biens sont introuvables.', 404);
  }
  if (
    scope &&
    (properties as PropertyRecord[]).some(
      property =>
        property.owner_id !== scope.ownerId ||
        !scope.listingStatuses.includes(property.listing_status ?? ''),
    )
  ) {
    throw new AdminPropertyDeletionError(
      'Seuls vos brouillons en attente ou refusés peuvent être supprimés.',
      403,
    );
  }

  const propertyById = new Map(
    (properties as PropertyRecord[]).map(property => [property.id, property]),
  );
  const { data: imageRows, error: imageQueryError } = await supabaseAdmin
    .from('property_images')
    .select('property_id, url')
    .in('property_id', ids);
  if (imageQueryError) {
    throw new AdminPropertyDeletionError(
      `Impossible de récupérer les photos des biens : ${imageQueryError.message}`,
      500,
    );
  }

  const imagePaths = ((imageRows ?? []) as PropertyImageRecord[]).map(image => {
    const path = getPropertyImageStoragePath(
      image.url,
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    );
    const segments = path?.split('/');
    const property = propertyById.get(image.property_id);
    if (
      !path ||
      !property ||
      segments?.length !== 3 ||
      segments[1] !== image.property_id ||
      (property.owner_id && segments[0] !== property.owner_id)
    ) {
      throw new AdminPropertyDeletionError(
        `Le chemin Storage d’une photo du bien ${image.property_id} est invalide. Le bien n’a pas été supprimé.`,
      );
    }
    return path;
  });
  const uniqueImagePaths = Array.from(new Set(imagePaths));

  let deleteQuery = supabaseAdmin
    .from('properties')
    .delete()
    .in('id', ids);
  if (scope) {
    deleteQuery = deleteQuery
      .eq('owner_id', scope.ownerId)
      .in('listing_status', [...scope.listingStatuses]);
  }
  const { data: deletedProperties, error: deleteError } = await deleteQuery.select('id');
  if (deleteError) {
    throw new AdminPropertyDeletionError(
      `Impossible de supprimer les biens : ${deleteError.message}`,
    );
  }
  if (!deletedProperties || deletedProperties.length !== ids.length) {
    throw new AdminPropertyDeletionError('Un ou plusieurs biens n’ont pas été supprimés.', 409);
  }

  const cleanupErrors: string[] = [];
  for (const batch of chunkStoragePaths(uniqueImagePaths)) {
    const { error } = await supabaseAdmin.storage.from('property-images').remove(batch);
    if (error) cleanupErrors.push(error.message);
  }

  return {
    count: deletedProperties.length,
    warning: cleanupErrors.length
      ? `Le bien a été supprimé, mais le nettoyage de certaines photos a échoué : ${cleanupErrors.join('; ')}`
      : null,
  };
}
