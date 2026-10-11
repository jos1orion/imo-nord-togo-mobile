import type { Property } from '../types';
import { isPublicProperty } from './propertyVisibility';

export const RECENT_LISTING_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RECENT_LISTING_LIMIT = 5;

export const getRecentProperties = (
  properties: Property[],
  now = Date.now()
): Property[] =>
  properties
    .filter(property => {
      if (!isPublicProperty(property)) return false;
      const publishedAt = new Date(property.publishedAt ?? property.createdAt).getTime();
      const age = now - publishedAt;
      return Number.isFinite(publishedAt) && age >= 0 && age < RECENT_LISTING_WINDOW_MS;
    })
    .sort(
      (a, b) =>
        new Date(b.publishedAt ?? b.createdAt).getTime() -
        new Date(a.publishedAt ?? a.createdAt).getTime()
    )
    .slice(0, RECENT_LISTING_LIMIT);
