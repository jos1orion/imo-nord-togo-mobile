import { describe, expect, it } from '@jest/globals';
import {
  PROPERTY_IMAGE_MAX_BYTES,
  PROPERTY_IMAGE_MAX_COUNT,
  TENANT_DOCUMENT_MAX_BYTES,
  validatePropertyImage,
  validatePropertyImages,
  validateTenantDocument,
  validateTenantDocuments,
} from '../imageUploadValidation';

const file = (type: string, size = 1024, name = 'photo'): File =>
  ({ type, size, name }) as File;

describe('property image upload validation', () => {
  it('accepts JPEG, PNG and WebP within the size limit', () => {
    expect(validatePropertyImage(file('image/jpeg'))).toBeNull();
    expect(validatePropertyImage(file('image/png', PROPERTY_IMAGE_MAX_BYTES))).toBeNull();
    expect(validatePropertyImage(file('image/webp'))).toBeNull();
  });

  it('rejects unsupported MIME types, empty files and oversized files', () => {
    expect(validatePropertyImage(file('image/gif'))).toContain('format non accepté');
    expect(validatePropertyImage(file('image/jpeg', 0))).toContain('taille');
    expect(validatePropertyImage(file('image/png', PROPERTY_IMAGE_MAX_BYTES + 1))).toContain('1 Mo');
    expect(validatePropertyImage(file('', 100))).toContain('format non accepté');
  });

  it('enforces the maximum number of selected images', () => {
    const images = Array.from({ length: PROPERTY_IMAGE_MAX_COUNT + 1 }, (_, index) =>
      file('image/jpeg', 100, `photo-${index}.jpg`)
    );
    expect(validatePropertyImages(images)).toContain(`Maximum ${PROPERTY_IMAGE_MAX_COUNT}`);
  });

  it('allows tenant PDFs and supported images but rejects other types and oversized documents', () => {
    expect(validateTenantDocument(file('application/pdf'))).toBeNull();
    expect(validateTenantDocument(file('image/webp', TENANT_DOCUMENT_MAX_BYTES))).toBeNull();
    expect(validateTenantDocument(file('application/msword'))).toContain('format non accepté');
    expect(validateTenantDocument(file('application/pdf', TENANT_DOCUMENT_MAX_BYTES + 1))).toContain('15 Mo');
    expect(validateTenantDocuments([file('application/pdf'), file('image/jpeg')])).toBeNull();
  });
});
