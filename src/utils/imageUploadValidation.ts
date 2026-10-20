export const PROPERTY_IMAGE_MAX_COUNT = 8;
export const PROPERTY_IMAGE_MAX_BYTES = 200 * 1024;
export const PROPERTY_IMAGE_MAX_TOTAL_BYTES = PROPERTY_IMAGE_MAX_BYTES * PROPERTY_IMAGE_MAX_COUNT;
export const PROPERTY_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const TENANT_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export const TENANT_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  ...PROPERTY_IMAGE_MIME_TYPES,
] as const;

type UploadFile = Pick<File, 'name' | 'size' | 'type'>;

export const validatePropertyImageSelection = (
  files: readonly UploadFile[],
  existingImageCount = 0
): string | null => {
  if (files.length + existingImageCount > PROPERTY_IMAGE_MAX_COUNT) {
    return `Maximum ${PROPERTY_IMAGE_MAX_COUNT} images par bien.`;
  }
  return files.map(file => {
    if (!PROPERTY_IMAGE_MIME_TYPES.includes(file.type as (typeof PROPERTY_IMAGE_MIME_TYPES)[number])) {
      return `${file.name}: format non accepté. Utilisez JPEG, PNG ou WebP.`;
    }
    if (file.size <= 0) {
      return `${file.name}: la taille doit être supérieure à 0 octet.`;
    }
    return null;
  }).find(Boolean) ?? null;
};

export const validatePropertyImage = (file: UploadFile): string | null => {
  if (!PROPERTY_IMAGE_MIME_TYPES.includes(file.type as (typeof PROPERTY_IMAGE_MIME_TYPES)[number])) {
    return `${file.name}: format non accepté. Utilisez JPEG, PNG ou WebP.`;
  }
  if (file.size <= 0 || file.size > PROPERTY_IMAGE_MAX_BYTES) {
    return `${file.name}: la taille doit être comprise entre 1 octet et ${Math.round(
      PROPERTY_IMAGE_MAX_BYTES / 1024
    )} Ko.`;
  }
  return null;
};

export const validatePropertyImages = (
  files: readonly UploadFile[],
  existingImageCount = 0
): string | null => {
  const selectionError = validatePropertyImageSelection(files, existingImageCount);
  if (selectionError) return selectionError;
  const imageError = files.map(validatePropertyImage).find(Boolean);
  if (imageError) return imageError;
  if (files.reduce((total, image) => total + image.size, 0) > PROPERTY_IMAGE_MAX_TOTAL_BYTES) {
    return `La taille totale des photos ne doit pas dépasser ${(
      PROPERTY_IMAGE_MAX_TOTAL_BYTES / 1_000_000
    ).toFixed(1).replace('.', ',')} Mo.`;
  }
  return null;
};

export const validateTenantDocument = (file: UploadFile): string | null => {
  if (!TENANT_DOCUMENT_MIME_TYPES.includes(file.type as (typeof TENANT_DOCUMENT_MIME_TYPES)[number])) {
    return `${file.name}: format non accepté. Utilisez PDF, JPEG, PNG ou WebP.`;
  }
  if (file.size <= 0 || file.size > TENANT_DOCUMENT_MAX_BYTES) {
    return `${file.name}: la taille maximale est de 15 Mo.`;
  }
  return null;
};

export const validateTenantDocuments = (files: readonly UploadFile[]): string | null =>
  files.map(validateTenantDocument).find(Boolean) ?? null;
