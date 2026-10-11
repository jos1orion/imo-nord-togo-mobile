import { Property } from '../types';

const hasExpired = (value?: string | null) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now();
};

export const isPublicProperty = (
  property: Pick<Property, 'status' | 'listingStatus' | 'expiresAt'> | null | undefined
) => {
  if (!property) return false;
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
  property: Pick<Property, 'ownerId' | 'status' | 'listingStatus' | 'expiresAt'> | null | undefined,
  userId?: string | null
) => {
  if (!property) return false;
  if (Boolean(userId) && property.ownerId === userId) return true;
  return isPublicProperty(property);
};
