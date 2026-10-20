import { supabase } from './supabaseClient';
import { logAdminAction } from './adminAudit';
import { deleteAdminRecord } from './adminMutations';
import { chunkStoragePaths, getPropertyImageStoragePaths } from '../../src/utils/propertyStorage';

export const deleteAdminProperty = async (propertyId: string): Promise<string | null> => {
  const { data: imageRows, error: imageQueryError } = await supabase
    .from('property_images')
    .select('url')
    .eq('property_id', propertyId);
  if (imageQueryError) {
    throw new Error(`Impossible de récupérer les images du bien : ${imageQueryError.message}`);
  }

  await deleteAdminRecord('properties', propertyId);

  let imageCleanupError: string | null = null;
  try {
    await deletePropertyImageFiles((imageRows ?? []).map(image => image.url));
  } catch (error) {
    imageCleanupError = error instanceof Error ? error.message : 'Erreur inconnue lors du nettoyage des images.';
  }
  await logAdminAction('delete_property', 'property', propertyId);
  return imageCleanupError;
};

export const deletePropertyImageFiles = async (imageUrls: readonly string[]) => {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const paths = getPropertyImageStoragePaths(imageUrls, projectUrl);
  for (const batch of chunkStoragePaths(paths)) {
    const { error } = await supabase.storage.from('property-images').remove(batch);
    if (error) {
      throw new Error(`Le bien a été supprimé, mais le nettoyage de ses images a échoué : ${error.message}`);
    }
  }
};
