import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppAlert as Alert } from '../components/ui/appAlertService';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../App';
import { useApp } from '../context/AppContext';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { formatPrice } from '../utils/format';
import type { PropertyType } from '../types';

type AgentTabs = { Home: undefined; Publish: undefined; Messages: undefined; Agent: undefined; Profile: undefined };
type Navigation = BottomTabNavigationProp<AgentTabs, 'Agent'>;

const isExpired = (expiresAt?: string | null) => {
  if (!expiresAt) return false;
  const expiration = new Date(expiresAt).getTime();
  return Number.isFinite(expiration) && expiration <= Date.now();
};

const isExpiringSoon = (expiresAt?: string | null) => {
  if (!expiresAt) return false;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  return remaining > 0 && remaining <= 14 * 24 * 60 * 60 * 1000;
};

const AGENT_SPECIALTY_OPTIONS: PropertyType[] = ['house', 'apartment', 'land', 'shop'];

const AgentDashboardScreen = () => {
  const styles = useThemedStyles(baseStyles);
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Navigation>();
  const { currentUser, properties, propertyStats, chats, getAgentProfile, createAgentProfile, updateAgentProfile, updateProfile, completeProperty, updateProperty, updatePropertyStatus, deleteProperty, t, tType } = useApp();
  const [listingFilter, setListingFilter] = useState<'published' | 'pending' | 'rejected' | 'completed' | 'archived'>('published');
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [contactNameDraft, setContactNameDraft] = useState('');
  const [contactPhoneDraft, setContactPhoneDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<PropertyType[]>([]);
  const [experienceDraft, setExperienceDraft] = useState('');
  const [companyDraft, setCompanyDraft] = useState('');
  const [licenseNumberDraft, setLicenseNumberDraft] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingListingId, setUpdatingListingId] = useState<string | null>(null);
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null);
  const [completionPropertyId, setCompletionPropertyId] = useState<string | null>(null);
  const [listingActionMode, setListingActionMode] = useState<'complete' | 'reopen'>('complete');
  const [completionOutcome, setCompletionOutcome] = useState<'sold' | 'rented' | null>(null);

  const isAgent = currentUser?.role === 'AGENT' || currentUser?.role === 'ADMIN';
  const listings = useMemo(
    () => (currentUser && isAgent ? properties.filter(property => property.ownerId === currentUser.id) : []),
    [currentUser, isAgent, properties]
  );
  const active = listings.filter(p => p.listingStatus === 'approved' && p.status === 'available' && !isExpired(p.expiresAt));
  const pending = listings.filter(p => p.listingStatus === 'pending');
  const rejected = listings.filter(p => p.listingStatus === 'rejected');
  const completed = listings.filter(p => p.status === 'occupied');
  const archived = listings.filter(p =>
    p.status !== 'occupied' &&
    (p.listingStatus === 'archived' || (p.listingStatus === 'approved' && isExpired(p.expiresAt)))
  );
  const expiring = listings.filter(p => p.listingStatus === 'approved' && p.status === 'available' && isExpiringSoon(p.expiresAt));
  const views = listings.reduce((sum, property) => sum + (propertyStats[property.id]?.views ?? 0), 0);
  const unread = currentUser
    ? chats.filter(chat => chat.participants.includes(currentUser.id)).reduce(
      (sum, chat) => sum + (chat.unreadCount[currentUser.id] ?? 0), 0
    )
    : 0;
  const profile = currentUser ? getAgentProfile(currentUser.id) : null;
  const profileReady = Boolean(currentUser?.name && currentUser?.phone && profile?.bio && profile.specialties.length);
  const setupSteps = [
    { label: t('profile_agent_step_contact'), done: Boolean(currentUser?.name && currentUser?.email && currentUser?.phone) },
    { label: t('profile_agent_step_professional'), done: Boolean(profile?.bio && profile.specialties.length) },
    { label: t('profile_agent_step_verification'), done: Boolean(currentUser?.verified) },
    { label: t('profile_agent_step_first_listing'), done: listings.length > 0 },
  ];
  const completedSetup = setupSteps.filter(step => step.done).length;
  const priority = rejected[0] ?? expiring[0];
  const filteredListings = { published: active, pending, rejected, completed, archived }[listingFilter];
  const actionProperty = completionPropertyId
    ? listings.find(property => property.id === completionPropertyId)
    : undefined;
  const prospects = currentUser
    ? chats.filter(chat => chat.participants.includes(currentUser.id)).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3)
    : [];
  const openPublish = () => {
    navigation.getParent<StackNavigationProp<RootStackParamList>>()?.navigate('Publish');
  };
  const openListing = (propertyId: string) => {
    navigation.getParent<StackNavigationProp<RootStackParamList>>()?.navigate('Publish', { propertyId });
  };
  const closeListingAction = () => {
    setCompletionPropertyId(null);
    setCompletionOutcome(null);
  };
  const saveListingAction = async () => {
    if (!completionPropertyId || (listingActionMode === 'complete' && !completionOutcome)) return;
    setUpdatingListingId(completionPropertyId);
    try {
      if (listingActionMode === 'complete' && completionOutcome) {
        await completeProperty(completionPropertyId, completionOutcome);
      } else {
        if (actionProperty?.listingStatus === 'archived' || isExpired(actionProperty?.expiresAt)) {
          await updateProperty(completionPropertyId, {
            status: 'available',
            listingStatus: 'approved',
            rejectionReason: null,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
        } else {
          await updatePropertyStatus(completionPropertyId, 'available');
        }
      }
      closeListingAction();
    } catch (error) {
      Alert.alert(t('error'), error instanceof Error ? error.message : t('profile_agent_update_listing_failed'));
    } finally {
      setUpdatingListingId(null);
    }
  };
  const confirmDeleteListing = (propertyId: string, title: string) => {
    Alert.alert(
      t('profile_agent_delete_listing_title'),
      t('profile_agent_delete_listing_confirm').replace('{title}', title),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('profile_agent_delete_listing_action'),
          style: 'destructive',
          onPress: async () => {
            setDeletingListingId(propertyId);
            try {
              await deleteProperty(propertyId);
            } catch (error) {
              Alert.alert(
                t('error'),
                error instanceof Error ? error.message : t('profile_agent_delete_listing_failed')
              );
            } finally {
              setDeletingListingId(null);
            }
          },
        },
      ]
    );
  };
  const openProfileEditor = () => {
    setContactNameDraft(currentUser?.name ?? '');
    setContactPhoneDraft(currentUser?.phone ?? '');
    setBioDraft(profile?.bio ?? '');
    setSelectedSpecialties(profile?.specialties ?? []);
    setExperienceDraft(profile ? String(profile.experience) : '0');
    setCompanyDraft(profile?.company ?? '');
    setLicenseNumberDraft(profile?.licenseNumber ?? '');
    setProfileEditorOpen(true);
  };
  const saveProfessionalProfile = async () => {
    if (!currentUser) return;
    const experience = Number(experienceDraft);
    if (!contactNameDraft.trim()) {
      Alert.alert(t('error'), t('profile_agent_name_required'));
      return;
    }
    if (!contactPhoneDraft.trim()) {
      Alert.alert(t('error'), t('profile_agent_phone_required'));
      return;
    }
    if (!bioDraft.trim() || selectedSpecialties.length === 0) {
      Alert.alert(t('error'), t('profile_agent_complete_profile'));
      return;
    }
    if (!Number.isInteger(experience) || experience < 0) {
      Alert.alert(t('error'), t('profile_agent_invalid_experience'));
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({
        name: contactNameDraft.trim(),
        phone: contactPhoneDraft.trim(),
      });

      const updates = {
        bio: bioDraft.trim(),
        specialties: selectedSpecialties,
        experience,
        company: companyDraft.trim(),
        licenseNumber: licenseNumberDraft.trim(),
      };
      if (profile) {
        await updateAgentProfile(currentUser.id, updates);
      } else {
        await createAgentProfile({
          userId: currentUser.id,
          ...updates,
          portfolio: [],
          verified: false,
        });
      }
      setProfileEditorOpen(false);
    } catch (error) {
      Alert.alert(t('error'), error instanceof Error ? error.message : t('error'));
    } finally { setSavingProfile(false); }
  };

  if (!currentUser || !isAgent) {
    return (
      <View style={[styles.gate, { paddingTop: insets.top + 32 }]}>
        <View style={styles.gateIcon}><Ionicons name="briefcase-outline" size={30} color={colors.primary} /></View>
        <Text style={styles.gateTitle}>{t('profile_agent_access_title')}</Text>
        <Text style={styles.gateBody}>{t('profile_agent_access_subtitle')}</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={openPublish}
          accessibilityRole="button"
          accessibilityLabel={t('profile_agent_apply_button')}
        >
          <Text style={styles.primaryButtonText}>{t('profile_agent_apply_button')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.eyebrow}>{t('profile_agent_dashboard')}</Text>
            <Text style={styles.title}>{t('profile_agent_greeting')} {currentUser.name.split(' ')[0]}</Text>
          </View>
          <View style={[styles.verified, { backgroundColor: currentUser.verified ? colors.successContainer : colors.warningContainer }]}>
            <Ionicons name={currentUser.verified ? 'checkmark-circle' : 'alert-circle'} size={15} color={currentUser.verified ? colors.success : colors.warning} />
            <Text style={[styles.verifiedText, { color: currentUser.verified ? colors.onSuccessContainer : colors.onWarningContainer }]}>
              {currentUser.verified ? t('profile_agent_approved') : t('profile_not_verified')}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.publishButton,
            {
              backgroundColor: colors.warningContainer,
              borderColor: colors.gold,
              borderWidth: 1,
            },
          ]}
          onPress={openPublish}
          accessibilityRole="button"
          accessibilityLabel={t('profile_agent_publish')}
        >
          <Ionicons name="add-circle" size={21} color={colors.onWarningContainer} />
          <Text style={[styles.publishButtonText, { color: colors.onWarningContainer }]}>
            {t('profile_agent_publish')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        {[
          {
            icon: 'home-outline' as const,
            value: active.length,
            label: t('profile_agent_active_listings'),
            color: colors.primary,
            onPress: () => setListingFilter('published'),
          },
          {
            icon: 'eye-outline' as const,
            value: views,
            label: t('profile_agent_views'),
            color: colors.info,
            onPress: () => setListingFilter('published'),
          },
          {
            icon: 'chatbubble-ellipses-outline' as const,
            value: unread,
            label: t('profile_agent_unread_messages'),
            color: colors.success,
            onPress: () => navigation.navigate('Messages'),
          },
        ].map(item => (
          <TouchableOpacity
            key={item.label}
            style={styles.stat}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}: ${item.value}`}
          >
            <Ionicons name={item.icon} size={18} color={item.color} />
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {completedSetup < setupSteps.length && (
        <TouchableOpacity style={styles.setupCard} onPress={openProfileEditor} accessibilityRole="button">
          <View style={styles.setupHeader}>
            <View>
              <Text style={styles.setupTitle}>{t('profile_agent_setup')}</Text>
              <Text style={styles.setupSub}>{completedSetup}/{setupSteps.length} {t('profile_agent_step_account').toLowerCase()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${(completedSetup / setupSteps.length) * 100}%` }]} /></View>
          <Text style={styles.setupNext}>{setupSteps.find(step => !step.done)?.label}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t('profile_agent_today')}</Text></View>
      {!profileReady &&       <TouchableOpacity style={styles.todo} onPress={openProfileEditor} accessibilityRole="button" accessibilityLabel={t('profile_agent_complete_profile')}><Ionicons name="person-circle-outline" size={21} color={colors.warning} /><Text style={styles.todoText}>{t('profile_agent_complete_profile')}</Text><Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} /></TouchableOpacity>}
      {unread > 0 && <TouchableOpacity style={styles.todo} onPress={() => navigation.navigate('Messages')} accessibilityRole="button" accessibilityLabel={t('profile_agent_reply_to_prospect')}><Ionicons name="chatbubble-ellipses-outline" size={21} color={colors.primary} /><Text style={styles.todoText}>{t('profile_agent_reply_to_prospect')}</Text><View style={styles.countBadge}><Text style={styles.countBadgeText}>{unread}</Text></View></TouchableOpacity>}
      {priority && <TouchableOpacity style={[styles.todo, styles.priorityTodo]} onPress={() => openListing(priority.id)} accessibilityRole="button" accessibilityLabel={`${priority.listingStatus === 'rejected' ? t('profile_agent_fix_rejected') : t('profile_agent_renew_listing')}: ${priority.title}`}><Ionicons name={priority.listingStatus === 'rejected' ? 'alert-circle-outline' : 'time-outline'} size={21} color={colors.danger} /><Text style={[styles.todoText, styles.priorityTodoText]}>{priority.listingStatus === 'rejected' ? t('profile_agent_fix_rejected') : t('profile_agent_renew_listing')}: {priority.title}</Text><Ionicons name="chevron-forward" size={18} color={colors.danger} /></TouchableOpacity>}
      {profileReady && unread === 0 && !priority && <Text style={styles.caughtUp}>{t('profile_agent_all_caught_up')}</Text>}

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t('profile_agent_manage_listings')}</Text><TouchableOpacity onPress={openPublish} accessibilityRole="button" accessibilityLabel={t('profile_agent_publish')}><Text style={styles.link}>{t('profile_agent_publish')}</Text></TouchableOpacity></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {([
          ['published', t('profile_agent_published'), active.length],
          ['pending', t('profile_agent_pending_listings'), pending.length],
          ['rejected', t('profile_agent_rejected'), rejected.length],
          ['completed', t('profile_agent_completed'), completed.length],
          ['archived', t('profile_agent_archived'), archived.length],
        ] as const).map(([key, label, count]) => <TouchableOpacity key={key} style={[styles.tab, listingFilter === key && styles.tabActive]} onPress={() => setListingFilter(key)} accessibilityRole="tab" accessibilityState={{ selected: listingFilter === key }} accessibilityLabel={`${label} (${count})`}><Text style={[styles.tabText, listingFilter === key && styles.tabTextActive]}>{label} ({count})</Text></TouchableOpacity>)}
      </ScrollView>
      {filteredListings.length === 0 ? (
        <Text style={styles.empty}>{t('profile_agent_no_listings')}</Text>
      ) : filteredListings.map(property => {
        const expired = isExpired(property.expiresAt);
        const isArchived = property.status !== 'occupied' && (property.listingStatus === 'archived' || expired);
        const canComplete = property.listingStatus === 'approved' && property.status === 'available' && !expired;
        const canReopen = (property.listingStatus === 'approved' && property.status === 'occupied') || isArchived;
        const canDelete = property.listingStatus === 'pending' || property.listingStatus === 'rejected';
        const statusLabel = isArchived
          ? t('status_archived')
          : property.listingStatus === 'pending'
          ? t('profile_agent_pending_listings')
          : property.listingStatus === 'rejected'
            ? t('profile_agent_rejected')
            : property.completionType === 'sold'
              ? t('status_sold')
              : property.completionType === 'rented'
                ? t('status_rented')
            : property.status === 'occupied'
              ? t('profile_agent_completed')
              : t('profile_agent_published');
        const statusColor = isArchived
          ? colors.onSurfaceMuted
          : property.listingStatus === 'rejected'
          ? colors.danger
          : property.listingStatus === 'pending'
            ? colors.warning
            : property.status === 'occupied'
              ? colors.onSurfaceMuted
              : colors.success;
        return (
          <View key={property.id} style={styles.listing}>
            <TouchableOpacity
              style={styles.listingMain}
              onPress={() => openListing(property.id)}
              accessibilityRole="button"
              accessibilityLabel={`${t('profile_agent_edit_listing')}: ${property.title}`}
            >
              {property.images[0] ? (
                <Image source={{ uri: property.images[0] }} style={styles.listingImage} />
              ) : (
                <View style={styles.listingImageFallback}>
                  <Ionicons name="home-outline" size={21} color={colors.onSurfaceMuted} />
                </View>
              )}
              <View style={styles.listingCopy}>
                <Text style={styles.listingTitle}>{property.title}</Text>
                <Text style={styles.listingPrice}>{formatPrice(property.price)}</Text>
                <View style={styles.listingStatus}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.listingStatusText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
                <Text style={styles.listingMeta}>
                  {propertyStats[property.id]?.views ?? 0} {t('profile_agent_listing_views')}
                  {' · '}
                  {propertyStats[property.id]?.contacts ?? 0} {t('profile_agent_listing_contacts')}
                </Text>
                {property.listingStatus === 'rejected' && property.rejectionReason ? (
                  <Text style={styles.rejection} numberOfLines={2}>{property.rejectionReason}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
            <View style={styles.listingActions}>
              <TouchableOpacity
                style={[styles.listingActionButton, styles.editListingAction]}
                onPress={() => openListing(property.id)}
                accessibilityRole="button"
                accessibilityLabel={`${t('profile_agent_edit_listing')}: ${property.title}`}
              >
                <Ionicons name="create-outline" size={17} color={colors.primary} />
                <Text style={[styles.listingActionText, { color: colors.primary }]}>
                  {t('profile_agent_edit_action')}
                </Text>
              </TouchableOpacity>
              {canComplete && (
                <TouchableOpacity
                  style={[styles.listingActionButton, styles.completeListingAction, { backgroundColor: colors.primaryContainer }]}
                  onPress={() => {
                    setListingActionMode('complete');
                    setCompletionPropertyId(property.id);
                    setCompletionOutcome(null);
                  }}
                  disabled={updatingListingId === property.id}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile_agent_complete_listing_title')}
                >
                  {updatingListingId === property.id
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Ionicons name="checkmark-done-outline" size={17} color={colors.primary} />}
                  <Text style={[styles.listingActionText, { color: colors.primary }]}>
                    {t('profile_agent_complete_action')}
                  </Text>
                </TouchableOpacity>
              )}
              {canReopen && (
                <TouchableOpacity
                  style={[styles.listingActionButton, styles.completeListingAction, { backgroundColor: colors.infoContainer }]}
                  onPress={() => {
                    setListingActionMode('reopen');
                    setCompletionPropertyId(property.id);
                    setCompletionOutcome(null);
                  }}
                  disabled={updatingListingId === property.id}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile_agent_mark_available')}
                >
                  {updatingListingId === property.id
                    ? <ActivityIndicator size="small" color={colors.info} />
                    : <Ionicons name="refresh-outline" size={17} color={colors.info} />}
                  <Text style={[styles.listingActionText, { color: colors.info }]}>
                    {t('profile_agent_reopen_action')}
                  </Text>
                </TouchableOpacity>
              )}
              {canDelete && (
                <TouchableOpacity
                  style={[styles.listingActionButton, styles.deleteListingAction]}
                  onPress={() => confirmDeleteListing(property.id, property.title)}
                  disabled={deletingListingId === property.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('profile_agent_delete_listing_action')}: ${property.title}`}
                >
                  {deletingListingId === property.id
                    ? <ActivityIndicator size="small" color={colors.danger} />
                    : <Ionicons name="trash-outline" size={17} color={colors.danger} />}
                  <Text style={[styles.listingActionText, { color: colors.danger }]}>
                    {t('profile_agent_delete_listing_action')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t('profile_agent_open_messages')}</Text><TouchableOpacity onPress={() => navigation.navigate('Messages')}><Text style={styles.link}>{t('see_all')}</Text></TouchableOpacity></View>
      {prospects.length === 0 ? <Text style={styles.empty}>{t('profile_agent_all_caught_up')}</Text> : prospects.map(chat => <TouchableOpacity key={chat.id} style={styles.listing} onPress={() => navigation.navigate('Messages')}><View style={styles.listingIcon}><Ionicons name="person-outline" size={18} color={colors.success} /></View><View style={styles.listingCopy}><Text style={styles.listingTitle} numberOfLines={1}>{chat.lastMessage?.content || t('profile_messages_shortcut')}</Text><Text style={styles.listingMeta}>{new Date(chat.updatedAt).toLocaleDateString()}</Text></View>{(chat.unreadCount[currentUser.id] ?? 0) > 0 && <View style={styles.countBadge}><Text style={styles.countBadgeText}>{chat.unreadCount[currentUser.id]}</Text></View>}<Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} /></TouchableOpacity>)}

      <Modal
        visible={completionPropertyId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          closeListingAction();
        }}
      >
        <View style={styles.completionBackdrop}>
          <TouchableOpacity
            style={styles.completionDismissArea}
            activeOpacity={1}
            onPress={closeListingAction}
            accessibilityLabel={t('cancel')}
          />
          <View style={styles.completionSheet}>
            <View style={styles.completionHandle} />
            <View style={styles.completionHeader}>
              <View style={[
                styles.completionHeaderIcon,
                listingActionMode === 'reopen' && styles.reopenHeaderIcon,
              ]}>
                <Ionicons
                  name={listingActionMode === 'reopen'
                    ? 'refresh-outline'
                    : completionOutcome === 'sold'
                      ? 'cash-outline'
                      : completionOutcome === 'rented'
                        ? 'key-outline'
                        : 'checkmark-done-outline'}
                  size={23}
                  color={listingActionMode === 'reopen' ? colors.info : colors.primary}
                />
              </View>
              <View style={styles.completionHeaderCopy}>
                <Text style={styles.completionTitle}>
                  {listingActionMode === 'reopen'
                    ? t('profile_agent_reopen_listing_title')
                    : completionOutcome === 'sold'
                      ? t('profile_agent_sold_listing_title')
                      : completionOutcome === 'rented'
                        ? t('profile_agent_rented_listing_title')
                        : t('profile_agent_complete_listing_title')}
                </Text>
                <Text style={styles.completionSubtitle}>
                  {listingActionMode === 'reopen'
                    ? t('profile_agent_reopen_listing_confirm')
                    : completionOutcome === 'sold'
                      ? t('profile_agent_sold_listing_confirm')
                      : completionOutcome === 'rented'
                        ? t('profile_agent_rented_listing_confirm')
                        : t('profile_agent_completion_choose_subtitle')}
                </Text>
              </View>
            </View>

            {actionProperty && (
              <View style={styles.actionPropertyCard}>
                {actionProperty.images[0] ? (
                  <Image
                    source={{ uri: actionProperty.images[0] }}
                    style={styles.actionPropertyImage}
                  />
                ) : (
                  <View style={styles.actionPropertyImageFallback}>
                    <Ionicons name="home-outline" size={21} color={colors.onSurfaceMuted} />
                  </View>
                )}
                <View style={styles.actionPropertyCopy}>
                  <Text style={styles.actionPropertyLabel}>{t('profile_agent_action_property')}</Text>
                  <Text style={styles.actionPropertyTitle} numberOfLines={2}>
                    {actionProperty.title}
                  </Text>
                </View>
              </View>
            )}

            {listingActionMode === 'complete' && completionOutcome === null ? (
              <View style={styles.completionChoices}>
                <TouchableOpacity
                  style={styles.completionChoice}
                  onPress={() => setCompletionOutcome('sold')}
                  accessibilityRole="button"
                >
                  <View style={[styles.completionChoiceIcon, styles.completionSoldIcon]}>
                    <Ionicons name="cash-outline" size={22} color={colors.success} />
                  </View>
                  <View style={styles.completionChoiceCopy}>
                    <Text style={styles.completionChoiceTitle}>{t('profile_agent_sold_choice_title')}</Text>
                    <Text style={styles.completionChoiceSubtitle}>{t('profile_agent_sold_choice_subtitle')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={colors.onSurfaceMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.completionChoice}
                  onPress={() => setCompletionOutcome('rented')}
                  accessibilityRole="button"
                >
                  <View style={[styles.completionChoiceIcon, styles.completionRentedIcon]}>
                    <Ionicons name="key-outline" size={22} color={colors.info} />
                  </View>
                  <View style={styles.completionChoiceCopy}>
                    <Text style={styles.completionChoiceTitle}>{t('profile_agent_rented_choice_title')}</Text>
                    <Text style={styles.completionChoiceSubtitle}>{t('profile_agent_rented_choice_subtitle')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={colors.onSurfaceMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.completionActions}>
                <TouchableOpacity
                  style={styles.completionSecondaryButton}
                  onPress={() => listingActionMode === 'complete' ? setCompletionOutcome(null) : closeListingAction()}
                  disabled={updatingListingId !== null}
                  accessibilityRole="button"
                >
                  <Text style={styles.completionSecondaryText}>
                    {listingActionMode === 'complete' ? t('back') : t('cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.completionPrimaryButton, updatingListingId !== null && styles.disabled]}
                  onPress={() => void saveListingAction()}
                  disabled={updatingListingId !== null}
                  accessibilityRole="button"
                >
                  {updatingListingId !== null ? (
                    <ActivityIndicator size="small" color={colors.onBrand} />
                  ) : (
                    <Text style={styles.completionPrimaryText}>
                      {listingActionMode === 'reopen'
                        ? t('profile_agent_mark_available')
                        : completionOutcome === 'sold'
                          ? t('profile_agent_mark_sold')
                          : t('profile_agent_mark_rented')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            {listingActionMode === 'complete' && completionOutcome === null && (
              <TouchableOpacity
                style={styles.completionCancel}
                onPress={closeListingAction}
                accessibilityRole="button"
              >
                <Text style={styles.completionCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={profileEditorOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileEditorOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalScrollContent}>
            <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
              <ScrollView
                style={styles.profileFormScroll}
                contentContainerStyle={styles.profileFormContent}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('profile_agent_step_professional')}</Text>
                  <TouchableOpacity
                    onPress={() => setProfileEditorOpen(false)}
                    accessibilityRole="button"
                    accessibilityLabel={t('close')}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={23} color={colors.onSurfaceMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.formSectionTitle}>{t('profile_agent_step_contact')}</Text>
                <Text style={styles.inputLabel}>{t('profile_name')}</Text>
                <TextInput
                  style={styles.input}
                  value={contactNameDraft}
                  onChangeText={setContactNameDraft}
                  accessibilityLabel={t('profile_name')}
                  autoCapitalize="words"
                  placeholderTextColor={colors.onSurfaceMuted}
                />
                <Text style={styles.inputLabel}>{t('profile_phone')}</Text>
                <TextInput
                  style={styles.input}
                  value={contactPhoneDraft}
                  onChangeText={setContactPhoneDraft}
                  accessibilityLabel={t('profile_phone')}
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.onSurfaceMuted}
                />
                <Text style={styles.formSectionTitle}>{t('profile_agent_step_professional')}</Text>
                <Text style={styles.inputLabel}>{t('profile_agent_bio_label')}</Text>
                <TextInput
                  style={styles.input}
                  value={bioDraft}
                  onChangeText={setBioDraft}
                  accessibilityLabel={t('profile_agent_bio_label')}
                  multiline
                  placeholderTextColor={colors.onSurfaceMuted}
                  placeholder={t('profile_agent_bio_placeholder')}
                />
                <Text style={styles.inputLabel}>{t('specialties')}</Text>
                <View style={styles.specialtyOptions}>
                  {AGENT_SPECIALTY_OPTIONS.map(specialty => {
                    const selected = selectedSpecialties.includes(specialty);
                    return (
                      <TouchableOpacity
                        key={specialty}
                        style={[
                          styles.specialtyOption,
                          selected && {
                            backgroundColor: colors.primaryContainer,
                            borderColor: colors.primary,
                          },
                        ]}
                        onPress={() => setSelectedSpecialties(previous =>
                          selected
                            ? previous.filter(item => item !== specialty)
                            : [...previous, specialty]
                        )}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                      >
                        <Ionicons
                          name={selected ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={selected ? colors.primary : colors.onSurfaceMuted}
                        />
                        <Text
                          style={[
                            styles.specialtyOptionText,
                            selected && { color: colors.primary },
                          ]}
                        >
                          {tType(specialty)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.inputLabel}>{t('profile_agent_experience_label')}</Text>
                <TextInput
                  style={styles.input}
                  value={experienceDraft}
                  onChangeText={setExperienceDraft}
                  accessibilityLabel={t('profile_agent_experience_label')}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.onSurfaceMuted}
                  placeholder="0"
                  returnKeyType="done"
                />
                <Text style={styles.inputLabel}>{t('profile_agent_company_label')}</Text>
                <TextInput
                  style={styles.input}
                  value={companyDraft}
                  onChangeText={setCompanyDraft}
                  accessibilityLabel={t('profile_agent_company_label')}
                  autoCapitalize="words"
                  placeholderTextColor={colors.onSurfaceMuted}
                  placeholder={t('profile_agent_optional_field')}
                />
                <Text style={styles.inputLabel}>{t('profile_agent_license_label')}</Text>
                <TextInput
                  style={styles.input}
                  value={licenseNumberDraft}
                  onChangeText={setLicenseNumberDraft}
                  accessibilityLabel={t('profile_agent_license_label')}
                  autoCapitalize="characters"
                  placeholderTextColor={colors.onSurfaceMuted}
                  placeholder={t('profile_agent_optional_field')}
                />
              </ScrollView>
              <View style={styles.profileFormFooter}>
                <TouchableOpacity
                  style={[styles.publishButton, savingProfile && styles.disabled]}
                  onPress={() => void saveProfessionalProfile()}
                  disabled={savingProfile}
                  accessibilityRole="button"
                >
                  <Text style={styles.publishButtonText}>{savingProfile ? '…' : t('confirm')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
};

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background }, content: { padding: SPACING.lg, paddingBottom: 40, gap: 12 },
  hero: { backgroundColor: COLORS.brand, padding: 20, borderRadius: RADIUS.xl, gap: 18 }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: COLORS.brandAccent, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: .6 }, title: { color: COLORS.white, fontSize: 22, fontWeight: '800', marginTop: 4 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, height: 32, borderRadius: RADIUS.full }, verifiedText: { fontSize: 12, fontWeight: '800' },
  publishButton: { minHeight: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, publishButtonText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  stats: { flexDirection: 'row', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingVertical: 14 }, stat: { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 5 }, statValue: { color: COLORS.onSurface, fontSize: 18, fontWeight: '800' }, statLabel: { color: COLORS.onSurfaceMuted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  setupCard: { backgroundColor: COLORS.primaryContainer, borderColor: COLORS.borderStrong, borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, gap: 10 }, setupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, setupTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: '800' }, setupSub: { marginTop: 2, color: COLORS.onSurfaceMuted, fontSize: 12, fontWeight: '600' }, progressTrack: { height: 7, borderRadius: RADIUS.full, overflow: 'hidden', backgroundColor: COLORS.surface }, progressFill: { height: '100%', borderRadius: RADIUS.full, backgroundColor: COLORS.primary }, setupNext: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  sectionHeader: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { color: COLORS.onSurface, fontSize: 17, fontWeight: '800' }, link: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
  todo: { minHeight: 58, backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13 }, todoText: { flex: 1, color: COLORS.onSurface, fontSize: 13, fontWeight: '700' }, countBadge: { minWidth: 23, height: 23, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }, countBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '800' }, caughtUp: { color: COLORS.onSurfaceMuted, fontSize: 13, paddingVertical: 8 },
  priorityTodo: { backgroundColor: COLORS.dangerContainer, borderColor: COLORS.danger },
  priorityTodoText: { color: COLORS.danger },
  tabs: { gap: 8 }, tab: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border }, tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary }, tabText: { color: COLORS.onSurfaceMuted, fontSize: 12, fontWeight: '800' }, tabTextActive: { color: COLORS.white }, empty: { color: COLORS.onSurfaceMuted, fontSize: 13, paddingVertical: 10 }, rejection: { marginTop: 3, color: COLORS.danger, fontSize: 12, fontWeight: '600' },
  listing: { minHeight: 88, backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: RADIUS.lg, gap: SPACING.sm, padding: SPACING.sm },
  listingMain: { width: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  listingIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  listingImage: { width: 68, height: 68, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceAlt },
  listingImageFallback: { width: 68, height: 68, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  listingCopy: { flex: 1, minWidth: 0 },
  listingTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: '800' },
  listingPrice: { color: COLORS.primary, fontSize: 13, fontWeight: '800', marginTop: 2 },
  listingStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  listingStatusText: { fontSize: 12, fontWeight: '700' },
  listingMeta: { color: COLORS.onSurfaceMuted, fontSize: 12, marginTop: 3 },
  listingActions: { flexDirection: 'row', gap: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  listingActionButton: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xs },
  editListingAction: { backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  completeListingAction: { borderWidth: 1, borderColor: COLORS.border },
  deleteListingAction: { backgroundColor: COLORS.dangerContainer, borderWidth: 1, borderColor: COLORS.dangerContainer },
  listingActionText: { fontSize: 12, fontWeight: '800' },
  completionBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.scrimStrong },
  completionDismissArea: { flex: 1 },
  completionSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xl, gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  completionHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: SPACING.xs },
  completionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  completionHeaderIcon: { width: 46, height: 46, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryContainer },
  reopenHeaderIcon: { backgroundColor: COLORS.infoContainer },
  completionHeaderCopy: { flex: 1, gap: 4 },
  completionTitle: { color: COLORS.onSurface, fontSize: 18, lineHeight: 23, fontWeight: '800' },
  completionSubtitle: { color: COLORS.onSurfaceMuted, fontSize: 13, lineHeight: 19 },
  actionPropertyCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  actionPropertyImage: { width: 56, height: 56, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceAlt },
  actionPropertyImageFallback: { width: 56, height: 56, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  actionPropertyCopy: { flex: 1, gap: 4 },
  actionPropertyLabel: { color: COLORS.onSurfaceMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.7 },
  actionPropertyTitle: { color: COLORS.onSurface, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  completionChoices: { gap: SPACING.sm },
  completionChoice: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt },
  completionChoiceIcon: { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  completionSoldIcon: { backgroundColor: COLORS.successContainer },
  completionRentedIcon: { backgroundColor: COLORS.infoContainer },
  completionChoiceCopy: { flex: 1, gap: 4 },
  completionChoiceTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: '800' },
  completionChoiceSubtitle: { color: COLORS.onSurfaceMuted, fontSize: 12, lineHeight: 17 },
  completionActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  completionPrimaryButton: { flex: 1, minHeight: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  completionPrimaryText: { color: COLORS.onBrand, fontSize: 14, fontWeight: '800' },
  completionSecondaryButton: { minWidth: 104, minHeight: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center' },
  completionSecondaryText: { color: COLORS.onSurface, fontSize: 14, fontWeight: '700' },
  completionCancel: { alignItems: 'center', paddingVertical: SPACING.xs },
  completionCancelText: { color: COLORS.onSurfaceMuted, fontSize: 14, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.scrim50 },
  modalScrollContent: { flex: 1, justifyContent: 'flex-end' },
  modalCard: { maxHeight: '90%', backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingTop: 20 },
  profileFormScroll: { flexShrink: 1 },
  profileFormContent: { paddingHorizontal: 20, paddingBottom: 8, gap: 8 },
  profileFormFooter: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { flex: 1, color: COLORS.onSurface, fontSize: 18, fontWeight: '800' },
  formSectionTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: '800', marginTop: 10 },
  inputLabel: { color: COLORS.onSurfaceMuted, fontSize: 12, fontWeight: '800', marginTop: 6 },
  input: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderStrong, color: COLORS.onSurface, fontSize: 14, backgroundColor: COLORS.background },
  specialtyOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specialtyOption: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: COLORS.background },
  specialtyOptionText: { color: COLORS.onSurfaceMuted, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  gate: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 28, alignItems: 'center' }, gateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryContainer, marginBottom: 18 }, gateTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: '800', textAlign: 'center' }, gateBody: { color: COLORS.onSurfaceMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 }, primaryButton: { marginTop: 22, minHeight: 46, paddingHorizontal: 18, justifyContent: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.primary }, primaryButtonText: { color: COLORS.white, fontWeight: '800' },
});

export default AgentDashboardScreen;
