import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Property } from '../../types';
import {
  getRecentProperties,
  RECENT_LISTING_LIMIT,
  RECENT_LISTING_WINDOW_MS,
} from '../recentProperties';

const now = Date.parse('2026-10-11T10:00:00.000Z');

const makeProperty = (id: string, publishedAt: string, updates: Partial<Property> = {}): Property => ({
  id,
  ownerId: `owner-${id}`,
  title: `Property ${id}`,
  description: '',
  type: 'house',
  price: 100_000,
  location: 'Kara',
  city: 'Kara',
  images: [],
  status: 'available',
  listingStatus: 'approved',
  amenities: [],
  featured: false,
  createdAt: publishedAt,
  publishedAt,
  updatedAt: publishedAt,
  clientId: `owner-${id}`,
  ...updates,
});

describe('getRecentProperties', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns at most five public listings published within the last 24 hours', () => {
    const properties = Array.from({ length: 7 }, (_, index) =>
      makeProperty(
        String(index + 1),
        new Date(now - (index + 1) * 60 * 60 * 1000).toISOString()
      )
    );

    const recent = getRecentProperties(properties, now);

    expect(recent).toHaveLength(RECENT_LISTING_LIMIT);
    expect(recent.map(property => property.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(
      Date.parse(recent[0].publishedAt!) - Date.parse(recent[4].publishedAt!)
    ).toBeLessThan(RECENT_LISTING_WINDOW_MS);
  });

  it('removes listings at the 24-hour boundary and listings published in the future', () => {
    const boundary = makeProperty(
      'boundary',
      new Date(now - RECENT_LISTING_WINDOW_MS).toISOString()
    );
    const future = makeProperty('future', new Date(now + 1).toISOString());
    const justInside = makeProperty(
      'inside',
      new Date(now - RECENT_LISTING_WINDOW_MS + 1).toISOString()
    );

    expect(getRecentProperties([boundary, future, justInside], now)).toEqual([justInside]);
  });

  it('uses publication time instead of creation time when available', () => {
    const property = makeProperty('republished', '2026-10-01T10:00:00.000Z', {
      publishedAt: new Date(now - 60 * 60 * 1000).toISOString(),
    });

    expect(getRecentProperties([property], now)).toEqual([property]);
  });

  it('excludes unpublished, occupied and expired properties', () => {
    const properties = [
      makeProperty('pending', new Date(now - 1_000).toISOString(), {
        listingStatus: 'pending',
      }),
      makeProperty('occupied', new Date(now - 1_000).toISOString(), {
        status: 'occupied',
      }),
      makeProperty('expired', new Date(now - 1_000).toISOString(), {
        expiresAt: new Date(now).toISOString(),
      }),
    ];

    expect(getRecentProperties(properties, now)).toEqual([]);
  });

  it('excludes malformed publication dates', () => {
    expect(getRecentProperties([makeProperty('invalid', 'not-a-date')], now)).toEqual([]);
  });
});
