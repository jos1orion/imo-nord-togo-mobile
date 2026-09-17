import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { safeImpactLight } from '../lib/expoHapticsSafe';
import { Property, PROPERTY_TYPE_COLORS } from '../types';
import { formatPrice } from '../data/mock-data';
import { useApp } from '../context/AppContext';
import COLORS from '../theme/colors';
import { typography } from '../theme/typography';
import LazyImage from './LazyImage';
import { isFeaturedProperty } from '../utils/propertyVisibility';

const { width } = Dimensions.get('window');

interface PropertyCardProps {
  property: Property;
  onPress: () => void;
  compact?: boolean;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property, onPress, compact = false }) => {
  const cardWidth = compact ? width * 0.8 : width - 32;
  const { toggleFavorite, isFavorite, propertyStats, tType, t, language } = useApp();
  const favorite = isFavorite(property.id);
  const likes = propertyStats[property.id]?.likes ?? 0;
  const statusLabel = property.status === 'occupied' ? t('status_occupied') : t('status_available');

  const formatShortDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const locale = language === 'fr' ? 'fr-FR' : 'en-US';
    const month = date.toLocaleString(locale, { month: 'short' });
    return `${day} ${month}`;
  };

  const publishedLabel = formatShortDate(property.publishedAt ?? property.createdAt);
  const createdTime = new Date(property.publishedAt ?? property.createdAt).getTime();
  const isNew = Number.isFinite(createdTime) && Date.now() - createdTime < 7 * 24 * 60 * 60 * 1000;
  const isVerified = (property.listingStatus ?? 'approved') === 'approved';

  const locationLabel = [property.neighborhood, property.location].filter(Boolean).join(', ');
  const neighborhoodLabel = property.neighborhood?.trim();
  const coverImage =
    (property.images || []).find(
      value => typeof value === 'string' && value.trim().length > 0 && value !== 'null'
    ) || 'https://via.placeholder.com/400x300';

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }, compact && styles.compactCard]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${property.title}, ${locationLabel}`}
    >
      <View style={[styles.imageContainer, compact && styles.imageContainerCompact]}>
        <LazyImage uri={coverImage} style={styles.image} resizeMode="cover" />
        <View style={[styles.typeBadge, { backgroundColor: PROPERTY_TYPE_COLORS[property.type] }]}>
          <Text style={styles.typeText}>{tType(property.type)}</Text>
        </View>
        <View style={styles.statusBadgeRow}>
          {isNew && (
            <View style={[styles.statusBadge, styles.statusBadgeNew]}>
              <Text style={styles.statusBadgeText}>{t('card_badge_new')}</Text>
            </View>
          )}
          {isVerified && (
            <View style={[styles.statusBadge, styles.statusBadgeVerified]}>
              <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
              <Text style={styles.statusBadgeText}>{t('card_badge_verified')}</Text>
            </View>
          )}
        </View>
        {property.status === 'occupied' && (
          <View style={styles.occupiedBadge}>
            <Text style={styles.occupiedText}>{t('status_occupied')}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.favoriteButton, favorite && styles.favoriteButtonActive]}
          onPress={(event) => {
            event.stopPropagation?.();
            void safeImpactLight();
            toggleFavorite(property.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={favorite ? t('a11y_remove_favorite') : t('a11y_add_favorite')}
        >
          <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={16} color={favorite ? COLORS.error : COLORS.textMuted} />
        </TouchableOpacity>
        <View style={[styles.likesBadge, likes === 0 && styles.likesBadgeEmpty]}>
          <Text style={[styles.likesText, likes === 0 && styles.likesTextEmpty]}>{likes}</Text>
        </View>
        {isFeaturedProperty(property) && (
          <View style={styles.featuredBadge}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.featuredText}>{t('card_badge_top')}</Text>
          </View>
        )}
      </View>

      <View style={[styles.content, compact && styles.contentCompact]}>
        <Text style={styles.title} numberOfLines={1}>{property.title}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color="#9CA3AF" />
          <Text style={styles.location} numberOfLines={1}>{locationLabel}</Text>
        </View>
        {neighborhoodLabel && (
          <View style={styles.neighborhoodBadge}>
            <Ionicons name="navigate" size={12} color={COLORS.primary} />
            <Text style={styles.neighborhoodBadgeText} numberOfLines={1}>{neighborhoodLabel}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <View style={styles.metaTag}>
            <Ionicons name="pricetag" size={12} color={COLORS.primary} />
            <Text style={styles.metaTagText}>{statusLabel}</Text>
          </View>
          {!compact && publishedLabel.length > 0 && (
            <Text style={styles.metaDate} numberOfLines={1}>
              {t('published_on')} {publishedLabel}
            </Text>
          )}
        </View>

        {!compact && (
          <View style={styles.details}>
            {property.bedrooms !== undefined && (
              <View style={styles.detailItem}>
                <Ionicons name="bed" size={14} color="#9CA3AF" />
                <Text style={styles.detailText}>{property.bedrooms}</Text>
              </View>
            )}
            {property.bathrooms !== undefined && (
              <View style={styles.detailItem}>
                <Ionicons name="water" size={14} color="#9CA3AF" />
                <Text style={styles.detailText}>{property.bathrooms}</Text>
              </View>
            )}
            {property.area !== undefined && (
              <View style={styles.detailItem}>
                <Ionicons name="resize" size={14} color="#9CA3AF" />
                <Text style={styles.detailText}>{property.area} m2</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(property.price)}</Text>
          <View style={styles.priceActions}>
            {!compact && (
              <TouchableOpacity
                style={styles.detailsButton}
                onPress={(event) => {
                  event.stopPropagation?.();
                  onPress();
                }}
              >
                <Text style={styles.detailsButtonText}>{t('view_details')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    marginHorizontal: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
    overflow: 'hidden',
  },
  compactCard: {
    marginVertical: 6,
  },
  imageContainer: {
    position: 'relative',
    height: 170,
  },
  imageContainerCompact: {
    height: 160,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  typeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadgeRow: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusBadgeNew: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderColor: '#F59E0B',
  },
  statusBadgeVerified: {
    backgroundColor: 'rgba(37,99,235,0.15)',
    borderColor: '#93C5FD',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
  },
  occupiedBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  occupiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  featuredBadge: {
    position: 'absolute',
    top: 44,
    right: 12,
    backgroundColor: 'rgba(17,24,39,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '600',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  favoriteButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  likesBadge: {
    position: 'absolute',
    top: 44,
    right: 12,
    backgroundColor: 'rgba(17,24,39,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  likesBadgeEmpty: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  likesText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  likesTextEmpty: {
    color: 'rgba(255,255,255,0.7)',
  },
  content: {
    padding: 14,
    minHeight: 148,
  },
  contentCompact: {
    paddingVertical: 10,
    minHeight: 0,
  },
  title: {
    ...typography.subtitle,
    color: COLORS.text,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  location: {
    fontSize: 12,
    color: COLORS.textMuted,
    flex: 1,
  },
  neighborhoodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  neighborhoodBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    maxWidth: 160,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.infoBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  metaTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  metaDate: {
    fontSize: 11,
    color: '#9CA3AF',
    maxWidth: 110,
    textAlign: 'right',
  },
  details: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  priceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  detailsButton: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  detailsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});

export default React.memo(PropertyCard);



