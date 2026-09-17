import { Property } from '../types';

const OCCUPIED_HIDE_AFTER_MS = 48 * 60 * 60 * 1000;

const hasExpired = (value?: string | null) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now();
};

const getUpdatedTime = (value?: string | null) => {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
};

export const isExpiredProperty = (
  property: Pick<Property, 'status' | 'listingStatus' | 'updatedAt' | 'createdAt'> | null | undefined
) => {
  if (!property || property.status !== 'occupied') return false;
  const time = getUpdatedTime(property.updatedAt) ?? getUpdatedTime(property.createdAt);
  if (!time) return false;
  return Date.now() - time > OCCUPIED_HIDE_AFTER_MS;
};

export const isPublicProperty = (
  property: Pick<Property, 'status' | 'listingStatus' | 'updatedAt' | 'createdAt' | 'expiresAt'> | null | undefined
) => {
  if (!property) return false;
  if (isExpiredProperty(property)) return false;
  // Never default an unknown status to approved: that could expose a draft.
  return property.status === 'available' && property.listingStatus === 'approved' && !hasExpired(property.expiresAt);
};

export const isFeaturedProperty = (
  property: Pick<Property, 'featured' | 'featuredStartAt' | 'featuredEndAt'> | null | undefined
) => {
  if (!property?.featured || hasExpired(property.featuredEndAt)) return false;
  if (!property.featuredStartAt) return true;
  const start = new Date(property.featuredStartAt).getTime();
  return !Number.isFinite(start) || start <= Date.now();
};

export const canViewProperty = (
  property: Pick<Property, 'ownerId' | 'status' | 'listingStatus' | 'updatedAt' | 'createdAt' | 'expiresAt'> | null | undefined,
  userId?: string | null
) => {
  if (!property) return false;
  if (isExpiredProperty(property)) return false;
  return isPublicProperty(property) || (Boolean(userId) && property.ownerId === userId);
};
