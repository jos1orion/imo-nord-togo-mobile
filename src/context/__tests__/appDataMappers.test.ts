import { describe, expect, it } from '@jest/globals';
import type { PropertyRow } from '../../types/db';
import {
  extractMissingPropertiesColumn,
  mapPropertyRow,
  normalizeNeighborhoods,
} from '../appDataMappers';

const propertyRow: PropertyRow = {
  id: 'property-1',
  owner_id: 'owner-1',
  title: 'Maison à Kara',
  description: null,
  type: 'house',
  price: '250000',
  location: 'Kara',
  neighborhood: 'Tchitchao',
  area: null,
  latitude: null,
  longitude: null,
  property_images: [{ url: 'https://example.test/photo.jpg' }, { url: 'null' }, { url: null }],
  status: 'available',
  listing_status: 'approved',
  amenities: ['eau'],
  bedrooms: null,
  bathrooms: null,
  featured: null,
  created_at: '2026-10-01T12:00:00.000Z',
  updated_at: null,
  submitted_at: null,
  approved_at: null,
  published_at: null,
  expires_at: null,
  sold_at: null,
  rented_at: null,
  completion_type: 'invalid',
  featured_start_at: null,
  featured_end_at: null,
  republished_at: null,
  client_id: null,
  contact_name: null,
  contact_phone: null,
  contact_email: null,
};

describe('app data mappers', () => {
  it('normalizes neighborhood names and keeps the first display spelling', () => {
    expect(normalizeNeighborhoods([' Kara ', 'kara', '', null, 'Tchitchao'])).toEqual([
      'Kara',
      'Tchitchao',
    ]);
  });

  it('maps property rows defensively and rejects unsupported listing statuses', () => {
    const property = mapPropertyRow({ ...propertyRow, listing_status: 'unexpected' });

    expect(property).toMatchObject({
      id: 'property-1',
      price: 250000,
      listingStatus: 'pending',
      images: ['https://example.test/photo.jpg'],
      amenities: ['eau'],
      completionType: null,
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
    });
  });

  it('extracts missing property columns from Supabase compatibility errors', () => {
    expect(
      extractMissingPropertiesColumn(
        "Could not find the 'completion_type' column of 'properties' in the schema cache"
      )
    ).toBe('completion_type');
    expect(extractMissingPropertiesColumn('network unavailable')).toBeNull();
  });
});
