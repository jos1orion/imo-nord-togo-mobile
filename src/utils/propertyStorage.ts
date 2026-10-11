export const getPropertyImageStoragePath = (
  imageUrl: string,
  supabaseUrl: string
): string | null => {
  try {
    const image = new URL(imageUrl);
    const project = new URL(supabaseUrl);
    const prefix = '/storage/v1/object/public/property-images/';
    const rawPath = imageUrl.match(/^https?:\/\/[^/?#]+([^?#]*)/i)?.[1];
    if (image.origin !== project.origin || !rawPath?.startsWith(prefix)) return null;

    const path = decodeURIComponent(rawPath.slice(prefix.length));
    const segments = path.split('/');
    if (
      !path ||
      path.includes('\\') ||
      path.includes('\0') ||
      segments.some(segment => !segment || segment === '.' || segment === '..')
    ) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
};

export const getPropertyImageStoragePaths = (
  imageUrls: readonly string[],
  supabaseUrl: string
): string[] =>
  [...new Set(
    imageUrls
      .map(imageUrl => getPropertyImageStoragePath(imageUrl, supabaseUrl))
      .filter((path): path is string => path !== null)
  )];

export const PROPERTY_STORAGE_REMOVE_BATCH_SIZE = 1000;

export const chunkStoragePaths = (
  paths: readonly string[],
  batchSize = PROPERTY_STORAGE_REMOVE_BATCH_SIZE
): string[][] => {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('Storage batch size must be a positive integer.');
  }

  const batches: string[][] = [];
  for (let index = 0; index < paths.length; index += batchSize) {
    batches.push(paths.slice(index, index + batchSize));
  }
  return batches;
};
