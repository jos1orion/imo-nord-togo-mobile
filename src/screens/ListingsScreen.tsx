import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppAlert as Alert } from '../components/ui/appAlertService';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RootStackParamList } from '../../App';
import PropertyCard from '../components/PropertyCard';
import Skeleton from '../components/ui/Skeleton';
import { useApp } from '../context/AppContext';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import COLORS from '../theme/colors';
import { isPublicProperty } from '../utils/propertyVisibility';
import { RADIUS, SPACING } from '../theme/spacing';
import { typography } from '../theme/typography';
import { logger } from '../lib/logger';
import { isDirectPublishingEnabled } from '../lib/publishing';

type ListingsTabParamList = {
  Home: undefined;
  Publish: undefined;
  Messages: undefined;
  Profile: { authMode?: 'login' | 'register' } | undefined;
};

type NavigationProp = BottomTabNavigationProp<ListingsTabParamList, 'Publish'>;

const ListingsScreen: React.FC = () => {
  const styles = useThemedStyles(baseStyles);
  const themeColors = useThemeColors();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const {
    properties,
    favorites,
    getMyProperties,
    neighborhoodAlerts,
    toggleNeighborhoodAlert,
    updatePropertyStatus,
    completeProperty,
    currentUser,
    hydrated,
    requestAgentAccess,
    t,
  } = useApp();
  const [busyListings, setBusyListings] = useState<Record<string, boolean>>({});
  const [requestingAgentAccess, setRequestingAgentAccess] = useState(false);
  const myProperties = getMyProperties();
  const favoriteCount = properties.filter(
    property => favorites.includes(property.id) && isPublicProperty(property)
  ).length;
  const favoriteProperties = properties.filter(
    property => favorites.includes(property.id) && isPublicProperty(property)
  );
  const neighborhoods = useMemo(() => {
    const names = new Set<string>();
    properties.filter(isPublicProperty).forEach(property => {
      const name = (property.neighborhood ?? property.location ?? '').trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'base' })
    );
  }, [properties]);

  const openProperty = (propertyId: string) => {
    InteractionManager.runAfterInteractions(() =>
      navigation.getParent<StackNavigationProp<RootStackParamList>>()?.navigate('PropertyDetail', {
        propertyId,
      })
    );
  };

  const openAuthentication = (authMode: 'login' | 'register') => {
    navigation.getParent<StackNavigationProp<RootStackParamList>>()?.navigate('MainTabs', {
      screen: 'Profile',
      params: { authMode },
    });
  };

  const hasTemporaryPublishingAccess =
    isDirectPublishingEnabled(currentUser) &&
    currentUser?.role === 'USER' &&
    (currentUser.agentStatus === 'pending' || currentUser.agentStatus === 'rejected');
  const agentAccessState = !currentUser
    ? 'guest'
    : currentUser.role === 'ADMIN' || currentUser.role === 'AGENT'
      ? 'approved'
      : currentUser.role && currentUser.role !== 'USER'
        ? 'ineligible'
      : hasTemporaryPublishingAccess
        ? 'temporary'
      : currentUser.agentStatus === 'pending'
        ? 'pending'
        : currentUser.agentStatus === 'rejected'
          ? 'rejected'
          : 'none';
  const agentAccessMessageKey = {
    guest: 'listing_agent_access_guest',
    none: 'listing_agent_access_none',
    pending: 'listing_agent_access_pending',
    rejected: 'listing_agent_access_rejected',
    approved: 'listing_agent_access_approved',
    temporary: 'listing_agent_access_temporary',
    ineligible: 'listing_agent_access_ineligible',
  } as const;

  const handleAgentAccessRequest = async () => {
    if (requestingAgentAccess) return;
    setRequestingAgentAccess(true);
    try {
      await requestAgentAccess();
      Alert.alert(t('success'), t('listing_agent_request_sent'));
    } catch (error) {
      logger.error('Unable to submit agent access request.', error);
      Alert.alert(t('error'), t('listing_agent_request_error'));
    } finally {
      setRequestingAgentAccess(false);
    }
  };

  const openPublishOrRequestAccess = () => {
    if (agentAccessState === 'guest') {
      openAuthentication('register');
      return;
    }
    if (agentAccessState === 'approved' || agentAccessState === 'temporary') {
      navigation.getParent<StackNavigationProp<RootStackParamList>>()?.navigate('Publish');
      return;
    }
    if (agentAccessState === 'pending') {
      Alert.alert(t('listing_agent_access_title'), t('listing_agent_access_pending'));
      return;
    }
    if (agentAccessState === 'ineligible') {
      Alert.alert(t('listing_agent_access_title'), t('listing_agent_access_ineligible'));
      return;
    }
    void handleAgentAccessRequest();
  };

  const confirmListingStatus = (
    id: string,
    status: 'available' | 'occupied',
    title: string,
    message: string,
    confirmStyle: 'default' | 'destructive' = 'default'
  ) => {
    Alert.alert(title, message, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        style: confirmStyle,
        onPress: () => {
          if (busyListings[id]) return;
          setBusyListings(previous => ({ ...previous, [id]: true }));
          void updatePropertyStatus(id, status)
            .then(() => Alert.alert(t('success'), t('listing_update_success')))
            .catch(() => Alert.alert(t('error'), t('listing_update_error')))
            .finally(() =>
              setBusyListings(previous => ({ ...previous, [id]: false }))
            );
        },
      },
    ]);
  };

  const confirmListingCompletion = (
    id: string,
    completionType: 'sold' | 'rented',
    title: string,
    message: string
  ) => {
    Alert.alert(title, message, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        style: 'destructive',
        onPress: () => {
          if (busyListings[id]) return;
          setBusyListings(previous => ({ ...previous, [id]: true }));
          void completeProperty(id, completionType)
            .then(() => Alert.alert(t('success'), t('listing_update_success')))
            .catch(() => Alert.alert(t('error'), t('listing_update_error')))
            .finally(() => setBusyListings(previous => ({ ...previous, [id]: false })));
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { backgroundColor: themeColors.brand, paddingTop: Math.max(insets.top, 12) + 8 },
        ]}
      >
        <View>
          <Text style={styles.title}>{t('tab_activity')}</Text>
          <Text style={styles.subtitle}>{t('activity_subtitle')}</Text>
        </View>
        <TouchableOpacity
          style={styles.publishButton}
          activeOpacity={0.85}
          accessibilityRole="button"
          onPress={openPublishOrRequestAccess}
        >
          <Ionicons name="add" size={20} color={themeColors.white} />
          <Text style={styles.publishButtonText}>
            {agentAccessState === 'approved' || agentAccessState === 'temporary'
              ? t('home_publish_card_title')
              : agentAccessState === 'guest'
                ? t('profile_register')
                : agentAccessState === 'pending'
                  ? t('listing_agent_access_pending_button')
                  : agentAccessState === 'rejected'
                    ? t('listing_agent_access_retry')
                    : agentAccessState === 'ineligible'
                      ? t('listing_agent_access_title')
                      : t('listing_agent_access_request')}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.heroFloatingCard}>
        <View style={styles.heroFloatingMetric}>
          <Ionicons name="home-outline" size={17} color={themeColors.primary} />
          <Text style={styles.heroFloatingValue}>{myProperties.length}</Text>
          <Text style={styles.heroFloatingLabel}>{t('my_listings')}</Text>
        </View>
        <View style={styles.heroFloatingDivider} />
        <View style={styles.heroFloatingMetric}>
          <Ionicons name="heart-outline" size={17} color={themeColors.danger} />
          <Text style={styles.heroFloatingValue}>{favoriteCount}</Text>
          <Text style={styles.heroFloatingLabel}>{t('favorites')}</Text>
        </View>
      </View>

      <FlatList
        style={styles.listScroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        data={hydrated ? neighborhoods : []}
        keyExtractor={name => name}
        numColumns={2}
        columnWrapperStyle={styles.alertGrid}
        renderItem={({ item: name }) => {
          const enabled = neighborhoodAlerts.some(
            neighborhood => neighborhood.toLowerCase() === name.toLowerCase()
          );
          return (
            <TouchableOpacity
              style={[styles.alertChip, enabled && styles.alertChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: enabled }}
              onPress={() => toggleNeighborhoodAlert(name)}
            >
              <Ionicons
                name={enabled ? 'notifications' : 'notifications-outline'}
                size={14}
                color={enabled ? themeColors.white : themeColors.onSurfaceMuted}
              />
              <Text style={[styles.alertText, enabled && styles.alertTextActive]}>{name}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={(
          <View style={styles.section}>
            {hydrated ? (
              <Text style={styles.emptyText}>{t('profile_no_recent')}</Text>
            ) : (
              <View style={styles.alertSkeletonGrid}>
                <Skeleton style={styles.alertSkeleton} />
                <Skeleton style={styles.alertSkeleton} />
                <Skeleton style={styles.alertSkeleton} />
              </View>
            )}
          </View>
        )}
        ListHeaderComponent={(
          <>
        <View style={styles.section}>
          <View style={styles.agentStatusHeader}>
            <Ionicons
              name={agentAccessState === 'approved' ? 'checkmark-circle' : 'information-circle'}
              size={22}
              color={agentAccessState === 'approved' ? themeColors.accent : themeColors.primary}
            />
            <Text style={styles.sectionTitle}>{t('listing_agent_access_title')}</Text>
          </View>
          <Text style={styles.helperText}>
            {t(agentAccessMessageKey[agentAccessState])}
          </Text>
          {agentAccessState === 'guest' && (
            <View style={styles.authActions}>
              <TouchableOpacity
                style={[styles.accessButton, styles.authActionButton, styles.loginButton]}
                accessibilityRole="button"
                onPress={() => openAuthentication('login')}
              >
                <Text style={[styles.accessButtonText, styles.loginButtonText]}>
                  {t('profile_login')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.accessButton, styles.authActionButton, styles.registerButton]}
                accessibilityRole="button"
                onPress={() => openAuthentication('register')}
              >
                <Text style={styles.accessButtonText}>{t('profile_register')}</Text>
              </TouchableOpacity>
            </View>
          )}
          {agentAccessState === 'none' && (
            <TouchableOpacity
              style={[styles.accessButton, requestingAgentAccess && styles.disabled]}
              accessibilityRole="button"
              disabled={requestingAgentAccess}
              onPress={() => void handleAgentAccessRequest()}
            >
              {requestingAgentAccess ? (
                <ActivityIndicator size="small" color={themeColors.white} />
              ) : (
                <Text style={styles.accessButtonText}>{t('listing_agent_access_request')}</Text>
              )}
            </TouchableOpacity>
          )}
          {agentAccessState === 'rejected' && (
            <>
              {currentUser?.agentRejectionReason ? (
                <Text style={styles.rejectionReason}>
                  {t('listing_agent_access_rejection_reason').replace(
                    '{{reason}}',
                    currentUser.agentRejectionReason
                  )}
                </Text>
              ) : null}
              <TouchableOpacity
                style={[styles.accessButton, requestingAgentAccess && styles.disabled]}
                accessibilityRole="button"
                disabled={requestingAgentAccess}
                onPress={() => void handleAgentAccessRequest()}
              >
                {requestingAgentAccess ? (
                  <ActivityIndicator size="small" color={themeColors.white} />
                ) : (
                  <Text style={styles.accessButtonText}>{t('listing_agent_access_retry')}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Ionicons name="home-outline" size={18} color={themeColors.primary} />
            <Text style={styles.summaryValue}>{myProperties.length}</Text>
            <Text style={styles.summaryLabel}>{t('my_listings')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="heart-outline" size={18} color={themeColors.primary} />
            <Text style={styles.summaryValue}>{favoriteCount}</Text>
            <Text style={styles.summaryLabel}>{t('favorites')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="notifications-outline" size={18} color={themeColors.primary} />
            <Text style={styles.summaryValue}>{neighborhoodAlerts.length}</Text>
            <Text style={styles.summaryLabel}>{t('profile_neighborhood_alerts')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('my_listings')}</Text>
          {myProperties.length === 0 ? (
            <Text style={styles.emptyText}>{t('no_listing')}</Text>
          ) : (
            <FlatList
              horizontal
              data={myProperties}
              keyExtractor={property => property.id}
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardRow}
              renderItem={({ item: property }) => {
                const isBusy = busyListings[property.id] ?? false;
                const isOccupied = property.status === 'occupied';

                return (
                  <View style={styles.myListingCard}>
                    <PropertyCard
                      property={property}
                      onPress={() => openProperty(property.id)}
                      compact
                    />
                    <View style={styles.myListingActions}>
                      {isOccupied ? (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.actionPrimary, isBusy && styles.disabled]}
                          disabled={isBusy}
                          onPress={() =>
                            confirmListingStatus(
                              property.id,
                              'available',
                              t('listing_confirm_restore_title'),
                              t('listing_confirm_restore_message')
                            )
                          }
                        >
                          {isBusy ? (
                            <ActivityIndicator size="small" color={themeColors.white} />
                          ) : (
                            <Text style={styles.actionTextLight}>{t('property_restore_available')}</Text>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.actionDanger, isBusy && styles.disabled]}
                            disabled={isBusy}
                            onPress={() =>
                              confirmListingCompletion(
                                property.id,
                                'sold',
                                t('listing_confirm_sold_title'),
                                t('listing_confirm_sold_message')
                              )
                            }
                          >
                            {isBusy ? (
                              <ActivityIndicator size="small" color={themeColors.white} />
                            ) : (
                              <Text style={styles.actionTextLight}>{t('property_mark_sold')}</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.actionWarning, isBusy && styles.disabled]}
                            disabled={isBusy}
                            onPress={() =>
                              confirmListingCompletion(
                                property.id,
                                'rented',
                                t('listing_confirm_rented_title'),
                                t('listing_confirm_rented_message')
                              )
                            }
                          >
                            {isBusy ? (
                              <ActivityIndicator size="small" color={themeColors.onSurface} />
                            ) : (
                              <Text style={styles.actionTextDark}>{t('status_rented')}</Text>
                            )}
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('favorites')}</Text>
          {favoriteProperties.length === 0 ? (
            <Text style={styles.emptyText}>{t('no_favorite')}</Text>
          ) : (
            <FlatList
              horizontal
              data={favoriteProperties}
              keyExtractor={property => property.id}
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardRow}
              renderItem={({ item: property }) => (
                <PropertyCard
                  property={property}
                  onPress={() => openProperty(property.id)}
                  compact
                />
              )}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile_neighborhood_alerts')}</Text>
          <Text style={styles.helperText}>{t('profile_alert_hint')}</Text>
        </View>
          </>
        )}
      />
    </View>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listScroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 38,
    backgroundColor: COLORS.brand,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
  },
  title: {
    ...typography.heroTitle,
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  subtitle: {
    color: COLORS.onBrandMuted,
    fontSize: 13,
    marginTop: 4,
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroFloatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: -24,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    zIndex: 1,
  },
  heroFloatingMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  heroFloatingValue: {
    ...typography.subtitle,
    color: COLORS.onSurface,
  },
  heroFloatingLabel: {
    ...typography.caption,
    color: COLORS.onSurfaceMuted,
  },
  heroFloatingDivider: {
    width: 1,
    height: 48,
    backgroundColor: COLORS.border,
  },
  publishButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 2,
  },
  summaryCard: {
    flex: 1,
    minHeight: 90,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    marginTop: 3,
    textAlign: 'center',
  },
  section: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginBottom: 14,
  },
  agentStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accessButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginTop: 12,
  },
  authActions: {
    flexDirection: 'row',
    gap: 10,
  },
  authActionButton: {
    flex: 1,
  },
  loginButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  registerButton: {
    backgroundColor: COLORS.primary,
  },
  accessButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  loginButtonText: {
    color: COLORS.primary,
  },
  rejectionReason: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.danger,
    marginTop: 6,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.onSurfaceMuted,
  },
  cardRow: {
    paddingRight: 16,
    gap: 12,
  },
  myListingCard: {
    alignSelf: 'flex-start',
  },
  myListingActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    marginTop: -2,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: {
    backgroundColor: COLORS.primary,
  },
  actionDanger: {
    backgroundColor: COLORS.danger,
  },
  actionWarning: {
    backgroundColor: COLORS.gold,
  },
  disabled: {
    opacity: 0.6,
  },
  actionTextLight: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionTextDark: {
    color: COLORS.onSurface,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  helperText: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    marginBottom: 10,
  },
  alertGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  alertSkeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  alertSkeleton: {
    width: '47%',
    height: 34,
  },
  alertChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 16,
  },
  alertChipActive: {
    backgroundColor: COLORS.primary,
  },
  alertText: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    fontWeight: '600',
  },
  alertTextActive: {
    color: COLORS.white,
  },
});

export default ListingsScreen;
