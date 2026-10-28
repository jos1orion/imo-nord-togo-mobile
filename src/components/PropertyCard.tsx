import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
  Modal,
  FlatList,
  StatusBar,
} from 'react-native';
import { AppAlert as Alert } from './ui/appAlertService';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { safeImpactLight } from '../lib/expoHapticsSafe';
import { Property, PROPERTY_TYPE_COLORS } from '../types';
import { formatPrice } from '../utils/format';
import { useApp } from '../context/AppContext';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { typography } from '../theme/typography';
import LazyImage from './LazyImage';
import PropertyImage from './ui/PropertyImage';
import { isFeaturedProperty } from '../utils/propertyVisibility';

interface PropertyCardProps {
  property: Property;
  onPress: () => void;
  compact?: boolean;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property, onPress, compact = false }) => {
  const styles = useThemedStyles(baseStyles);
  const themeColors = useThemeColors();
  const { width } = useWindowDimensions();
  const cardWidth = compact ? width * 0.8 : width - 32;
  const carouselWidth = cardWidth - 2;
  const { toggleFavorite, isFavorite, propertyStats, tType, t, language } = useApp();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const cardOpacity = useSharedValue(0);
  const favoriteScale = useSharedValue(1);
  const viewerRef = useRef<FlatList<string>>(null);
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
  const imageStatusLabel = property.status === 'occupied'
    ? t('status_occupied')
    : isFeaturedProperty(property)
      ? t('card_badge_top')
      : isVerified
        ? t('card_badge_verified')
        : isNew
          ? t('card_badge_new')
          : null;
  const cardAnimatedStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value }));
  const favoriteAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: favoriteScale.value }],
  }));

  const locationLabel = [property.neighborhood, property.location].filter(Boolean).join(', ');
  const neighborhoodLabel = property.neighborhood?.trim();
  const images = (property.images || []).filter(
    value => typeof value === 'string' && value.trim().length > 0 && value !== 'null'
  );
  const displayImages = images.length ? images : [''];
  const openViewerAt = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  useEffect(() => {
    cardOpacity.value = withTiming(1, { duration: 260 });
  }, [cardOpacity]);

  useEffect(() => {
    if (!viewerOpen) return;
    requestAnimationFrame(() => viewerRef.current?.scrollToIndex({ index: viewerIndex, animated: false }));
  }, [viewerOpen, viewerIndex]);

  return (
    <Animated.View style={[styles.card, { width: cardWidth }, compact && styles.compactCard, cardAnimatedStyle]}>
      <View style={[styles.imageContainer, compact && styles.imageContainerCompact]}>
        <ScrollView
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          onMomentumScrollEnd={event => {
            setActiveImageIndex(Math.round(event.nativeEvent.contentOffset.x / carouselWidth));
          }}
        >
          {displayImages.map((uri, index) => (
            <TouchableOpacity
              key={`${uri}-${index}`}
              activeOpacity={1}
              style={{ width: carouselWidth, height: '100%' }}
              onPress={() => openViewerAt(index)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${property.title}, ${index + 1}/${displayImages.length}`}
            >
              <LazyImage uri={uri} style={styles.image} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={[styles.typeBadge, { backgroundColor: PROPERTY_TYPE_COLORS[property.type] }]}>
          <Text style={styles.typeText}>{tType(property.type)}</Text>
        </View>
        <View style={styles.statusBadgeRow}>
          {imageStatusLabel && (
            <View style={[styles.statusBadge, styles.statusBadgeNew]}>
              <Text style={styles.statusBadgeText} numberOfLines={1}>{imageStatusLabel}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.favoriteButton, favorite && styles.favoriteButtonActive]}
          onPress={(event) => {
            event.stopPropagation?.();
            void safeImpactLight();
            favoriteScale.value = withSequence(
              withTiming(1.2, { duration: 100 }),
              withSpring(1, { damping: 8, stiffness: 220 })
            );
            void toggleFavorite(property.id).catch(error => {
              Alert.alert(t('error'), error instanceof Error ? error.message : t('error'));
            });
          }}
          accessibilityRole="button"
          accessibilityLabel={favorite ? t('a11y_remove_favorite') : t('a11y_add_favorite')}
        >
          <Animated.View style={favoriteAnimatedStyle}>
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={16} color={favorite ? themeColors.danger : themeColors.onSurfaceMuted} />
          </Animated.View>
        </TouchableOpacity>
        <View style={[styles.likesBadge, likes === 0 && styles.likesBadgeEmpty]}>
          <Text style={[styles.likesText, likes === 0 && styles.likesTextEmpty]}>{likes}</Text>
        </View>
        {displayImages.length > 1 && (
          <>
            <View style={styles.imageDots} pointerEvents="none">
              {displayImages.map((_, index) => (
                <View
                  key={`card-dot-${index}`}
                  style={[styles.imageDot, index === activeImageIndex && styles.imageDotActive]}
                />
              ))}
            </View>
            <View style={styles.imageCounter} pointerEvents="none">
              <Text style={styles.imageCounterText}>{activeImageIndex + 1}/{displayImages.length}</Text>
            </View>
          </>
        )}
      </View>

      <TouchableOpacity
        style={[styles.content, compact && styles.contentCompact]}
        onPress={onPress}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`${t('view_details')}: ${property.title}`}
      >
        <Text style={styles.title}>{property.title}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={themeColors.onSurfaceSoft} />
          <Text style={styles.location}>{locationLabel}</Text>
        </View>
        {neighborhoodLabel && (
          <View style={styles.neighborhoodBadge}>
            <Ionicons name="navigate" size={12} color={themeColors.primary} />
            <Text style={styles.neighborhoodBadgeText}>{neighborhoodLabel}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <View style={styles.metaTag}>
            <Ionicons name="pricetag" size={12} color={themeColors.primary} />
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
                <Ionicons name="bed" size={14} color={themeColors.onSurfaceSoft} />
                <Text style={styles.detailText}>{property.bedrooms}</Text>
              </View>
            )}
            {property.bathrooms !== undefined && (
              <View style={styles.detailItem}>
                <Ionicons name="water" size={14} color={themeColors.onSurfaceSoft} />
                <Text style={styles.detailText}>{property.bathrooms}</Text>
              </View>
            )}
            {property.area !== undefined && (
              <View style={styles.detailItem}>
                <Ionicons name="resize" size={14} color={themeColors.onSurfaceSoft} />
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
      </TouchableOpacity>
      <Modal
        visible={viewerOpen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={styles.viewerBackdrop}>
          <StatusBar barStyle="light-content" />
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setViewerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t('close')}
          >
            <Ionicons name="close" size={24} color={themeColors.white} />
          </TouchableOpacity>
          <FlatList
            ref={viewerRef}
            data={displayImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(uri, index) => `property-viewer-${property.id}-${index}-${uri}`}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            onMomentumScrollEnd={event => {
              setViewerIndex(Math.round(event.nativeEvent.contentOffset.x / width));
            }}
            renderItem={({ item }) => (
              <View style={styles.viewerImageWrap}>
                <PropertyImage
                  uri={item}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              </View>
            )}
          />
          <Text style={styles.viewerCounter}>{viewerIndex + 1}/{displayImages.length}</Text>
        </View>
      </Modal>
    </Animated.View>
  );
};

const baseStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    marginHorizontal: 8,
    marginVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  compactCard: {
    marginVertical: 6,
  },
  imageContainer: {
    position: 'relative',
    height: 205,
  },
  imageContainerCompact: {
    height: 176,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageDots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  imageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.overlayWhite55,
  },
  imageDotActive: {
    width: 16,
    backgroundColor: COLORS.surfaceAlt,
  },
  imageCounter: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: COLORS.overlayNavy70,
  },
  imageCounterText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: COLORS.onSurface,
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 52,
    right: 18,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.scrim50,
  },
  viewerImageWrap: {
    width,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width,
    height: '80%',
  },
  viewerCounter: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 36,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    color: COLORS.white,
    backgroundColor: COLORS.scrim50,
    fontSize: 12,
    fontWeight: '700',
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
    color: COLORS.white,
    fontSize: 12,
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
    backgroundColor: COLORS.overlayWhite90,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusBadgeNew: {
    backgroundColor: COLORS.overlayAmber20,
    borderColor: COLORS.gold,
  },
  statusBadgeVerified: {
    backgroundColor: COLORS.overlayBlue15,
    borderColor: COLORS.info,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  occupiedBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  occupiedText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  featuredBadge: {
    position: 'absolute',
    top: 44,
    right: 12,
    backgroundColor: COLORS.overlaySlate70,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredText: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '600',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.overlayWhite95,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  favoriteButtonActive: {
    backgroundColor: COLORS.surfaceAlt,
  },
  likesBadge: {
    position: 'absolute',
    top: 76,
    right: 12,
    backgroundColor: COLORS.overlaySlate75,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  likesBadgeEmpty: {
    backgroundColor: COLORS.scrimSoft,
  },
  likesText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  likesTextEmpty: {
    color: COLORS.overlayWhite70,
  },
  content: {
    padding: SPACING.lg,
    minHeight: 156,
  },
  contentCompact: {
    paddingVertical: 10,
    minHeight: 0,
  },
  title: {
    ...typography.subtitle,
    color: COLORS.onSurface,
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
    color: COLORS.onSurfaceMuted,
    flex: 1,
  },
  neighborhoodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  neighborhoodBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    flexShrink: 1,
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
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  metaTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  metaDate: {
    fontSize: 12,
    color: COLORS.onSurfaceSoft,
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
    color: COLORS.onSurfaceMuted,
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
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  detailsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
});

export default React.memo(PropertyCard);
