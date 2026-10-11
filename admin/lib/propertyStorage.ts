import { supabase } from './supabaseClient';
import { chunkStoragePaths, getPropertyImageStoragePaths } from '../../src/utils/propertyStorage';

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
