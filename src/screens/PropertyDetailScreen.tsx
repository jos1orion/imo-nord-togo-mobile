import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Image,
  Dimensions,
  Linking,
  StatusBar,
  Share,
  Alert,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useApp } from '../context/AppContext';
import { PROPERTY_TYPE_COLORS } from '../types';
import { formatPrice } from '../data/mock-data';
import { RootStackParamList } from '../../App';
import COLORS from '../theme/colors';
import { canViewProperty, isPublicProperty } from '../utils/propertyVisibility';

const { width } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<RootStackParamList>;
type DetailRouteProp = RouteProp<RootStackParamList, 'PropertyDetail'>;

const PropertyDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DetailRouteProp>();
  const {
    properties,
    clients,
    users,
    toggleFavorite,
    isFavorite,
    trackPropertyView,
    trackContact,
    trackShare,
    propertyStats,
    t,
    tType,
    tStatus,
    currentUser,
    updatePropertyStatus,
  } = useApp();

  const property = properties.find(p => p.id === route.params.propertyId);
  const favorite = property ? isFavorite(property.id) : false;
  const stats = property
    ? propertyStats[property.id] || { views: 0, contacts: 0, shares: 0, likes: 0 }
    : null;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const imageScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!property) return;
    trackPropertyView(property.id);
  }, [property?.id, trackPropertyView]);

  useEffect(() => {
    if (!property) return;
    setActiveImageIndex(0);
    setViewerIndex(0);
  }, [property?.id]);

  if (!property || !canViewProperty(property, currentUser?.id)) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('property_not_found')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>{t('back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const agentPhone = useMemo(() => {
    const fromProperty = property.contactPhone ?? property.client?.phone;
    const fromClient = clients.find(c => c.id === property.clientId)?.phone;
    const fromUser = users.find(u => u.id === property.clientId)?.phone;
    return (fromProperty ?? fromClient ?? fromUser ?? '').trim();
  }, [property.contactPhone, property.client?.phone, property.clientId, clients, users]);

  const normalizeDigits = (value: string) => value.replace(/\D/g, '');
  const buildTelUrl = (value: string) => {
    const digits = normalizeDigits(value);
    return digits ? `tel:+${digits}` : '';
  };

  const openExternal = async (primary: string, fallback?: string, errorText?: string) => {
    try {
      const canOpen = await Linking.canOpenURL(primary);
      if (canOpen) {
        await Linking.openURL(primary);
        return;
      }
      if (fallback) {
        const canFallback = await Linking.canOpenURL(fallback);
        if (canFallback) {
          await Linking.openURL(fallback);
          return;
        }
      }
      Alert.alert('Action impossible', errorText || "Impossible d'ouvrir le lien.");
    } catch {
      Alert.alert('Action impossible', errorText || "Impossible d'ouvrir le lien.");
    }
  };

  const handleContactAgent = () => {
    if (!agentPhone) {
      Alert.alert('Contact', "Numéro de l'agent indisponible.");
      return;
    }
    const telUrl = buildTelUrl(agentPhone);
    if (!telUrl) {
      Alert.alert('Contact', "Numéro de l'agent indisponible.");
      return;
    }
    openExternal(telUrl);
    trackContact(property.id);
  };

  const handleWhatsApp = () => {
    if (!agentPhone) {
      Alert.alert('WhatsApp', "Numéro de l'agent indisponible.");
      return;
    }
    const phone = normalizeDigits(agentPhone);
    if (!phone) {
      Alert.alert('WhatsApp', "Numéro de l'agent indisponible.");
      return;
    }
    openExternal(
      `whatsapp://send?phone=${phone}`,
      `https://wa.me/${phone}`,
      "WhatsApp n'est pas installe sur ce telephone."
    );
    trackContact(property.id);
  };

  const handleShare = async () => {
    const locationLabel = [property.neighborhood, property.location].filter(Boolean).join(', ');
    await Share.share({
      message: `${property.title} - ${formatPrice(property.price)} - ${locationLabel}`,
    });
    trackShare(property.id);
  };

  const similarProperties = useMemo(() => {
    return properties
      .filter(p => isPublicProperty(p) && p.id !== property.id && p.type === property.type)
      .slice(0, 6);
  }, [properties, property.id, property.type]);

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      InteractionManager.runAfterInteractions(() =>
        navigation.navigate('MainTabs', { screen: 'Home' })
      );
    }
  };

  const isValidImage = (value?: string | null) =>
    typeof value === 'string' && value.trim().length > 0 && value !== 'null';

  const images = (property.images || []).filter(isValidImage);
  const displayImages = images.length > 0 ? images : ['https://via.placeholder.com/400x300'];
  const createdTime = new Date(property.createdAt).getTime();
  const isNew = Number.isFinite(createdTime) && Date.now() - createdTime < 7 * 24 * 60 * 60 * 1000;
  const isVerified = (property.listingStatus ?? 'approved') === 'approved';
  const isOwner = Boolean(currentUser?.id && property.ownerId === currentUser.id);

  const handleMarkOccupied = (label: 'vendu' | 'occupé') => {
    Alert.alert(
      'Confirmation',
      `Marquer ce bien comme ${label} ? Il restera visible 48h puis disparaîtra de l'app.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            try {
              await updatePropertyStatus(property.id, 'occupied');
              Alert.alert('Statut mis à jour', `Le bien est marqué comme ${label}.`);
            } catch (e) {
              const message = e instanceof Error ? e.message : 'Erreur inconnue';
              Alert.alert('Erreur', message);
            }
          },
        },
      ]
    );
  };

  const handleMarkAvailable = () => {
    Alert.alert('Confirmation', 'Remettre ce bien comme disponible ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        onPress: async () => {
          try {
            await updatePropertyStatus(property.id, 'available');
            Alert.alert('Statut mis à jour', 'Le bien est de nouveau disponible.');
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Erreur inconnue';
            Alert.alert('Erreur', message);
          }
        },
      },
    ]);
  };
  const openViewerAt = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header Image */}
      <View style={styles.imageContainer}>
        <ScrollView
          ref={imageScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          decelerationRate="fast"
          snapToInterval={width}
          snapToAlignment="start"
          onScroll={event => {
            const index = Math.round(event.nativeEvent.contentOffset.x / width);
            setActiveImageIndex(index);
          }}
          onMomentumScrollEnd={event => {
            const index = Math.round(event.nativeEvent.contentOffset.x / width);
            setActiveImageIndex(index);
            openViewerAt(index);
          }}
          scrollEventThrottle={16}
          >
            {displayImages.map((uri, index) => (
              <Pressable
                key={`${uri}-${index}`}
                onPress={() => openViewerAt(index)}
              >
                <Image source={{ uri }} style={styles.image} />
              </Pressable>
            ))}
          </ScrollView>
        <View style={styles.imageOverlay}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.favoriteButton, favorite && styles.favoriteButtonActive]}
            onPress={() => toggleFavorite(property.id)}
          >
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? '#EF4444' : '#111827'} />
          </TouchableOpacity>

          <View style={[styles.typeBadge, { backgroundColor: PROPERTY_TYPE_COLORS[property.type] }]}>
            <Text style={styles.typeText}>{tType(property.type)}</Text>
          </View>
        </View>
        {displayImages.length > 1 && (
          <View style={styles.imageDots}>
            {displayImages.map((_, index) => (
              <View
                key={`dot-${index}`}
                style={[styles.imageDot, index === activeImageIndex && styles.imageDotActive]}
              />
            ))}
          </View>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {displayImages.length > 1 && (
          <View style={styles.thumbsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {displayImages.map((uri, index) => (
                <TouchableOpacity
                  key={`thumb-${uri}-${index}`}
                  style={[
                    styles.thumbWrapper,
                    index === activeImageIndex && styles.thumbWrapperActive,
                  ]}
                  onPress={() => {
                    setActiveImageIndex(index);
                    imageScrollRef.current?.scrollTo({ x: index * width, y: 0, animated: true });
                  }}
                >
                  <Image source={{ uri }} style={styles.thumbImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.detailInfo}>
              <Text style={styles.detailTitle}>{property.title}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={14} color="#9CA3AF" />
                <Text style={styles.location}>
                  {[property.neighborhood, property.location].filter(Boolean).join(', ')}
                </Text>
              </View>
            </View>
            <Text style={styles.detailPrice}>{formatPrice(property.price)}</Text>
          </View>

          <View style={styles.badgeRow}>
            {property.featured && (
              <View style={[styles.tagBadge, styles.tagFeatured]}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.tagText}>Top</Text>
              </View>
            )}
            {isVerified && (
              <View style={[styles.tagBadge, styles.tagVerified]}>
                <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
                <Text style={styles.tagText}>Vérifié</Text>
              </View>
            )}
            {isNew && (
              <View style={[styles.tagBadge, styles.tagNew]}>
                <Ionicons name="sparkles" size={12} color="#F59E0B" />
                <Text style={styles.tagText}>Nouveau</Text>
              </View>
            )}
            <View style={[
              styles.tagBadge,
              property.status === 'available' ? styles.tagAvailable : styles.tagOccupied,
            ]}>
              <Text style={styles.tagText}>{tStatus(property.status)}</Text>
            </View>
          </View>

          <View style={styles.detailStats}>
            {property.bedrooms !== undefined && (
              <View style={styles.detailStat}>
                <Ionicons name="bed" size={16} color={COLORS.primary} />
                <Text style={styles.detailStatText}>{property.bedrooms} chambres</Text>
              </View>
            )}
            {property.bathrooms !== undefined && (
              <View style={styles.detailStat}>
                <Ionicons name="water" size={16} color={COLORS.primary} />
                <Text style={styles.detailStatText}>{property.bathrooms} sdb</Text>
              </View>
            )}
            {property.area !== undefined && (
              <View style={styles.detailStat}>
                <Ionicons name="resize" size={16} color={COLORS.primary} />
                <Text style={styles.detailStatText}>{property.area} m2</Text>
              </View>
            )}
          </View>

          <View style={styles.detailActions}>
            <TouchableOpacity style={styles.primaryCta} onPress={handleContactAgent}>
              <Text style={styles.primaryCtaText}>Vérifier disponibilité</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gestion de votre annonce</Text>
            <Text style={styles.ownerHint}>
              Si le bien est déjà vendu ou occupé, vous pouvez le signaler. Il disparaîtra de l'app après 48h.
            </Text>
            <View style={styles.ownerActions}>
              <TouchableOpacity style={styles.ownerActionPrimary} onPress={() => handleMarkOccupied('vendu')}>
                <Ionicons name="cash" size={16} color="#fff" />
                <Text style={styles.ownerActionTextPrimary}>Déjà vendu</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ownerActionPrimary} onPress={() => handleMarkOccupied('occupé')}>
                <Ionicons name="home" size={16} color="#fff" />
                <Text style={styles.ownerActionTextPrimary}>Déjà occupé</Text>
              </TouchableOpacity>
              {property.status === 'occupied' && (
                <TouchableOpacity style={styles.ownerActionGhost} onPress={handleMarkAvailable}>
                  <Ionicons name="refresh" size={16} color={COLORS.primary} />
                  <Text style={styles.ownerActionTextGhost}>Remettre disponible</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {stats && (
          <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('stats')}</Text>
          <View style={styles.statLine}>
            <Text style={styles.statLineLabel}>{t('views')}</Text>
            <Text style={styles.statLineValue}>{stats.views}</Text>
          </View>
          <View style={styles.statLine}>
            <Text style={styles.statLineLabel}>{t('contacts')}</Text>
            <Text style={styles.statLineValue}>{stats.contacts}</Text>
          </View>
          <View style={styles.statLine}>
            <Text style={styles.statLineLabel}>{t('shares')}</Text>
            <Text style={styles.statLineValue}>{stats.shares}</Text>
          </View>
          <View style={styles.statLine}>
            <Text style={styles.statLineLabel}>{t('likes')}</Text>
            <Text style={styles.statLineValue}>{stats.likes}</Text>
          </View>
        </View>
      )}

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('description')}</Text>
        <Text style={styles.description}>{property.description}</Text>
      </View>

        {/* Amenities */}
        <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('amenities')}</Text>
          <View style={styles.amenities}>
            {property.amenities.map((amenity, index) => (
              <View key={index} style={styles.amenityChip}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                <Text style={styles.amenityText}>{amenity}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Contact Agency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('contact')}</Text>
          <Text style={styles.contactNote}>Contactez l'agent en un clic.</Text>
          <View style={styles.contactButtons}>
            <TouchableOpacity
              style={[styles.contactButton, styles.contactButtonPrimary]}
              onPress={handleContactAgent}
            >
              <Ionicons name="call" size={18} color="#fff" />
              <Text style={[styles.contactButtonText, styles.contactButtonTextOnPrimary]}>
                {t('call_agency')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactButton, styles.contactButtonAccent]}
              onPress={handleWhatsApp}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
              <Text style={[styles.contactButtonText, styles.contactButtonTextOnPrimary]}>
                WhatsApp
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactButton, styles.contactButtonGhost]}
              onPress={handleShare}
            >
              <Ionicons name="share-social" size={18} color={COLORS.primary} />
              <Text style={styles.contactButtonText}>{t('share')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('MortgageCalculator')}
            >
              <Ionicons name="calculator" size={16} color={COLORS.primary} />
              <Text style={styles.actionButtonText}>{t('mortgageCalculator')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {similarProperties.length > 0 && (
          <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('similar')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {similarProperties.map(item => {
                  const cover =
                    (item.images || []).find(isValidImage) || 'https://via.placeholder.com/400x300';
                  return (
                  <View key={item.id} style={styles.similarCard}>
                    <TouchableOpacity onPress={() => InteractionManager.runAfterInteractions(() => navigation.push('PropertyDetail', { propertyId: item.id }))}>
                      <Image source={{ uri: cover }} style={styles.similarImage} />
                      <Text style={styles.similarTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.similarPrice}>{formatPrice(item.price)}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {viewerOpen && (
        <View style={styles.viewerBackdrop}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerOpen(false)}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: viewerIndex * width, y: 0 }}
          >
            {displayImages.map((uri, index) => (
              <ScrollView
                key={`viewer-${uri}-${index}`}
                maximumZoomScale={3}
                minimumZoomScale={1}
                contentContainerStyle={styles.viewerImageWrap}
              >
                <Image source={{ uri }} style={styles.viewerImage} />
              </ScrollView>
            ))}
          </ScrollView>
        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: COLORS.textMuted,
  },
  backLink: {
    fontSize: 16,
    color: COLORS.primary,
    marginTop: 12,
  },
  imageContainer: {
    height: 280,
    position: 'relative',
    backgroundColor: COLORS.text,
  },
  image: {
    width,
    height: 280,
    resizeMode: 'cover',
  },
  imageDots: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  imageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  imageDotActive: {
    backgroundColor: '#ffffff',
    width: 18,
  },
  thumbsRow: {
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 16,
  },
  thumbWrapper: {
    width: 72,
    height: 56,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 10,
    overflow: 'hidden',
  },
  thumbWrapperActive: {
    borderColor: COLORS.primary,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  viewerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0b0f14',
    zIndex: 20,
  },
  viewerClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 30,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImageWrap: {
    width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width,
    height: '80%',
    resizeMode: 'contain',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingTop: 50,
  },
  favoriteButton: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  favoriteButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  typeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.background,
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
  },
  detailCard: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailInfo: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  location: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  detailPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.chipBg,
  },
  tagFeatured: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  tagVerified: {
    backgroundColor: COLORS.infoBg,
    borderColor: COLORS.borderSoft,
  },
  tagNew: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  tagAvailable: {
    backgroundColor: COLORS.successBg,
    borderColor: '#86EFAC',
  },
  tagOccupied: {
    backgroundColor: COLORS.dangerBg,
    borderColor: '#FCA5A5',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  detailStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailStatText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  primaryCta: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  ownerHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  ownerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ownerActionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  ownerActionTextPrimary: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  ownerActionGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.infoBg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  ownerActionTextGhost: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  statLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLineLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  statLineValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  amenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  amenityText: {
    fontSize: 13,
    color: COLORS.primary,
  },
  similarCard: {
    width: 160,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  similarImage: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    marginBottom: 6,
  },
  similarTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  similarPrice: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
    fontWeight: '700',
  },
  saleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  saleBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  contactNote: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  contactButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  contactButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  contactButtonPrimary: {
    backgroundColor: '#1D4ED8',
  },
  contactButtonAccent: {
    backgroundColor: '#22C55E',
  },
  contactButtonGhost: {
    backgroundColor: '#EFF6FF',
  },
  contactButtonTextOnPrimary: {
    color: '#fff',
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
  },
  ownerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  ownerInfo: {
    marginLeft: 12,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  ownerPhone: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  bottomPadding: {
    height: 80,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 10,
  },
  shareButton: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  shareText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  reportButton: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f2',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  reportText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
  },
  contactQuick: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  contactQuickText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  backQuick: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  backQuickText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  messageText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  callButtonDisabled: {
    opacity: 0.5,
  },
  callText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 6,
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
  },
  reasonChipActive: {
    backgroundColor: COLORS.primary,
  },
  reasonChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  reasonChipTextActive: {
    color: '#fff',
  },
  reportInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  modalCancelText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  modalSubmit: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  modalSubmitText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
});

export default PropertyDetailScreen;




