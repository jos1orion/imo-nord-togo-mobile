import { describe, expect, it } from '@jest/globals';
import {
  chunkStoragePaths,
  getPropertyImageStoragePath,
  getPropertyImageStoragePaths,
} from '../propertyStorage';

const projectUrl = 'https://example.supabase.co';

describe('property image storage paths', () => {
  it('extracts and decodes image paths from this project public URLs', () => {
    expect(
      getPropertyImageStoragePath(
        `${projectUrl}/storage/v1/object/public/property-images/user/property/photo%20one.webp`,
        projectUrl
      )
    ).toBe('user/property/photo one.webp');
  });

  it('does not extract paths from another project or bucket', () => {
    expect(
      getPropertyImageStoragePath(
        'https://other.supabase.co/storage/v1/object/public/property-images/user/property/photo.webp',
        projectUrl
      )
    ).toBeNull();
    expect(
      getPropertyImageStoragePath(
        `${projectUrl}/storage/v1/object/public/tenant-documents/user/document.pdf`,
        projectUrl
      )
    ).toBeNull();
  });

  it('rejects invalid paths and removes duplicates', () => {
    expect(
      getPropertyImageStoragePath(
        `${projectUrl}/storage/v1/object/public/property-images/user/%2E%2E/photo.webp`,
        projectUrl
      )
    ).toBeNull();
    expect(
      getPropertyImageStoragePaths(
        [
          `${projectUrl}/storage/v1/object/public/property-images/user/property/photo.webp`,
          `${projectUrl}/storage/v1/object/public/property-images/user/property/photo.webp`,
          'https://external.example/photo.webp',
        ],
        projectUrl
      )
    ).toEqual(['user/property/photo.webp']);
  });

  it('chunks storage removals without exceeding the API batch size', () => {
    expect(chunkStoragePaths(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
    expect(() => chunkStoragePaths(['a'], 0)).toThrow('positive integer');
  });
});
