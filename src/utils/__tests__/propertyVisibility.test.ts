import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  canViewProperty,
  isFeaturedProperty,
  isPublicProperty,
} from '../propertyVisibility';

describe('property visibility', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-11T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('exposes only available, approved, unexpired properties publicly', () => {
    expect(isPublicProperty({ status: 'available', listingStatus: 'approved' })).toBe(true);
    expect(isPublicProperty({ status: 'occupied', listingStatus: 'approved' })).toBe(false);
    expect(isPublicProperty({ status: 'available', listingStatus: 'pending' })).toBe(false);
    expect(isPublicProperty({ status: 'available', listingStatus: 'rejected' })).toBe(false);
    expect(isPublicProperty({ status: 'available', listingStatus: 'archived' })).toBe(false);
    expect(isPublicProperty({ status: 'available' })).toBe(false);
  });

  it('hides properties when their expiry time is reached', () => {
    expect(
      isPublicProperty({
        status: 'available',
        listingStatus: 'approved',
        expiresAt: '2026-10-11T10:00:00.000Z',
      })
    ).toBe(false);
    expect(
      isPublicProperty({
        status: 'available',
        listingStatus: 'approved',
        expiresAt: '2026-10-11T10:00:01.000Z',
      })
    ).toBe(true);
  });

  it('allows an owner to view their own non-public property only', () => {
    const pendingProperty = {
      ownerId: 'owner-1',
      status: 'available' as const,
      listingStatus: 'pending' as const,
    };

    expect(canViewProperty(pendingProperty, 'owner-1')).toBe(true);
    expect(canViewProperty(pendingProperty, 'another-user')).toBe(false);
    expect(canViewProperty(pendingProperty)).toBe(false);
    expect(canViewProperty(null, 'owner-1')).toBe(false);
  });

  it('shows a featured property only during its feature period', () => {
    expect(isFeaturedProperty({ featured: false })).toBe(false);
    expect(isFeaturedProperty({ featured: true })).toBe(true);
    expect(
      isFeaturedProperty({
        featured: true,
        featuredStartAt: '2026-10-11T10:00:01.000Z',
      })
    ).toBe(false);
    expect(
      isFeaturedProperty({
        featured: true,
        featuredEndAt: '2026-10-11T10:00:00.000Z',
      })
    ).toBe(false);
  });
});
