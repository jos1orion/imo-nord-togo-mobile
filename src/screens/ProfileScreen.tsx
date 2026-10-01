import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Modal,
  Share,
  TextInput,
  Alert,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';

import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LegalScreen from './SettingsScreen';
import { RootStackParamList } from '../../App';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import PropertyCard from '../components/PropertyCard';
import COLORS from '../theme/colors';
import { isPublicProperty } from '../utils/propertyVisibility';
import {
  getContactEmail,
  getContactPhoneDisplay,
  getContactPhoneUrl,
  getWhatsAppUrl,
} from '../constants/appConfig';

const ProfileScreen: React.FC = () => {
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const {
    properties,
    favorites,
    savedSearches,
    removeSavedSearch,
    getMyProperties,
    searchHistory,
    clearSearchHistory,
    recentViewedIds,
    neighborhoodAlerts,
    toggleNeighborhoodAlert,
    currentUser,
    registerUser,
    loginUser,
    logoutUser,
    updatePropertyStatus,
    setSearchQuery,
    setFilterType,
    resetFilters,
    setFilters,
    theme,
    setTheme,
    t,
    tType,
    notifications,
  } = useApp();
  const secretTapCount = useRef(0);
  const secretTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myProperties = getMyProperties();
  const favoriteProperties = properties.filter(p => favorites.includes(p.id) && isPublicProperty(p));
  const recentViewedProperties = recentViewedIds
    .map(id => properties.find(p => p.id === id))
    .filter((item): item is NonNullable<typeof item> => isPublicProperty(item));
  const myListingsCount = myProperties.length;
  const isAgent = currentUser?.role === 'AGENT' || currentUser?.role === 'ADMIN';
  const hasAgentRequest = currentUser?.agentStatus === 'pending' || currentUser?.agentStatus === 'rejected';
  const listingCounts = useMemo(() => ({
    pending: myProperties.filter(property => property.listingStatus === 'pending').length,
    approved: myProperties.filter(property => property.listingStatus === 'approved').length,
    rejected: myProperties.filter(property => property.listingStatus === 'rejected').length,
    archived: myProperties.filter(property => property.listingStatus === 'archived').length,
  }), [myProperties]);
  const favoritesCount = favoriteProperties.length;
  const alertsCount = neighborhoodAlerts.length;
  const unreadNotifications = notifications.filter(item => !item.read).length;
  const neighborhoodsWithListings = useMemo(() => {
    const names = new Set<string>();
    properties.filter(isPublicProperty).forEach(p => {
      const name = (p.neighborhood ?? p.location ?? '').trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [properties]);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [wantsAgentAccess, setWantsAgentAccess] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [listingActionBusy, setListingActionBusy] = useState<Record<string, boolean>>({});

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(authEmail.trim()),
    [authEmail]
  );
  const passwordValid = useMemo(() => authPassword.trim().length >= 6, [authPassword]);
  const nameValid = useMemo(() => authName.trim().length >= 2, [authName]);
  const phoneValid = useMemo(() => authPhone.trim().length >= 6, [authPhone]);
  const applySavedSearch = (id: string) => {
    const saved = savedSearches.find(s => s.id === id);
    if (!saved) return;
    resetFilters();
    setSearchQuery(saved.query);
    setFilterType(saved.type);
    setFilters(saved.filters);
    InteractionManager.runAfterInteractions(() =>
      navigation.navigate('MainTabs', { screen: 'Home' })
    );
  };

  const applySearchHistory = (query: string) => {
    resetFilters();
    setSearchQuery(query);
    setFilterType('ALL');
    InteractionManager.runAfterInteractions(() =>
      navigation.navigate('MainTabs', { screen: 'Home' })
    );
  };

  const getStatusLabel = (status: string) => {
    if (status === 'available') return t('status_available');
    if (status === 'occupied') return t('status_occupied');
    return status;
  };

  const getListingLabel = (status?: string) => {
    if (status === 'pending') return t('status_pending');
    if (status === 'approved') return t('status_approved');
    if (status === 'rejected') return t('status_rejected');
    if (status === 'archived') return t('status_archived');
    return '';
  };

  const setListingBusy = (id: string, value: boolean) => {
    setListingActionBusy(prev => ({ ...prev, [id]: value }));
  };

  const updateListingStatus = async (
    id: string,
    status: 'available' | 'occupied',
    successMessage: string
  ) => {
    if (listingActionBusy[id]) return;
    setListingBusy(id, true);
    try {
      await updatePropertyStatus(id, status);
      Alert.alert(t('success'), successMessage);
    } catch {
      Alert.alert(t('error'), "Impossible de mettre à jour l'annonce.");
    } finally {
      setListingBusy(id, false);
    }
  };

  const confirmListingStatus = (
    id: string,
    status: 'available' | 'occupied',
    title: string,
    message: string,
    confirmLabel: string,
    confirmStyle: 'default' | 'destructive' = 'default'
  ) => {
    Alert.alert(title, message, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: confirmLabel,
        style: confirmStyle,
        onPress: () => void updateListingStatus(id, status, 'Annonce mise à jour.'),
      },
    ]);
  };

  const handleCall = () => {
    Linking.openURL(getContactPhoneUrl());
  };

  const handleEmail = () => {
    Linking.openURL(`mailto:${getContactEmail()}`);
  };

  const handleAccountDeletionRequest = async () => {
    const subject = encodeURIComponent('Suppression de compte Imo Nord Togo');
    const body = encodeURIComponent(
      `Bonjour,\n\nJe demande la suppression de mon compte Imo Nord Togo et des données personnelles associées.\n\nAdresse e-mail associée au compte : ${currentUser?.email ?? ''}\n\n`
    );
    try {
      await Linking.openURL(`mailto:${getContactEmail()}?subject=${subject}&body=${body}`);
    } catch {
      Alert.alert(t('error'), t('profile_delete_account_email_failed'));
    }
  };

  const handleWhatsApp = () => {
    Linking.openURL(getWhatsAppUrl());
  };

  const resolveApkDownloadUrl = () => {
    const extra =
      ((Constants.expoConfig?.extra ??
        // Classic manifest (Expo Go / older environments)
        (Constants.manifest as any)?.extra ??
        // EAS Updates manifest can carry extra params.
        (() => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const Updates = require('expo-updates');
            return Updates?.manifest?.extra ?? null;
          } catch {
            return null;
          }
        })() ??
        {}) as Record<string, any>);

    return (
      process.env.EXPO_PUBLIC_APK_URL ||
      extra.apkDownloadUrl ||
      extra.apk_url ||
      extra.downloadUrl ||
      null
    );
  };

  const handleInvite = async () => {
    const apkUrl = resolveApkDownloadUrl();
    if (!apkUrl) {
      Alert.alert(t('profile_invite_friend'), t('profile_invite_missing_apk_link'));
      await Share.share({ message: t('profile_invite_message') });
      return;
    }
    await Share.share({
      message: `${t('profile_invite_message')}\n\n${t('profile_invite_download_label')}\n${apkUrl}`,
    });
  };

  const resolveAuthError = (code: string) => {
    const message = (code || '').toLowerCase();
    if (message.includes('already') || message.includes('exists') || message.includes('registered')) {
      return t('profile_auth_email_exists');
    }
    if (message.includes('invalid login') || message.includes('credentials') || message.includes('invalid')) {
      return t('profile_auth_wrong_credentials');
    }
    if (message.includes('not found')) {
      return t('profile_auth_not_found');
    }
    if (message.includes('password') && (message.includes('short') || message.includes('6'))) {
      return t('profile_auth_password_short');
    }
    return t('profile_auth_invalid');
  };

  const handleAuth = async () => {
    if (!emailValid) {
      setAuthError(t('profile_auth_email_invalid'));
      return;
    }
    if (!passwordValid) {
      setAuthError(t('profile_auth_password_short'));
      return;
    }
    if (authMode === 'register' && (!nameValid || !phoneValid)) {
      setAuthError(t('profile_auth_invalid'));
      return;
    }
    setAuthError('');
    setAuthLoading(true);
    if (authMode === 'login') {
      const result = await loginUser(authEmail, authPassword);
      if (!result.ok) {
        setAuthError(resolveAuthError(result.code));
        setAuthLoading(false);
        return;
      }
      setAuthLoading(false);
      return;
    }
    const result = await registerUser({
      name: authName,
      email: authEmail,
      phone: authPhone,
      password: authPassword,
      wantsAgentAccess,
    });
    if (!result.ok) {
      setAuthError(resolveAuthError(result.code));
      setAuthLoading(false);
      return;
    }
    setAuthName('');
    setAuthEmail('');
    setAuthPhone('');
    setAuthPassword('');
    setWantsAgentAccess(false);
    setAuthLoading(false);
  };

  const handleResetPassword = async () => {
    const email = authEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setAuthError(t('profile_auth_email_invalid'));
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
        redirectTo: 'imonordtogo://reset-password',
      });
      if (error) {
        setAuthError(t('profile_auth_reset_failed'));
        return;
      }
      setAuthError('');
      Alert.alert(t('success'), t('profile_reset_link_sent'));
    } catch {
      setAuthError(t('profile_auth_invalid'));
    }
  };

    const handleLogoutPress = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      await logoutUser();
    } catch {
      Alert.alert(t('error'), t('profile_logout_failed'));
    } finally {
      setLogoutLoading(false);
    }
  };
  const handleSecretTap = () => {
    const enableAdminShortcut =
      __DEV__ === true ||
      currentUser?.isAdmin === true ||
      Constants.expoConfig?.extra?.enableAdminShortcut === true;
    if (!enableAdminShortcut) return;
    if (!currentUser?.isAdmin) {
      Alert.alert('Accès refusé', 'Compte administrateur requis.');
      return;
    }

    secretTapCount.current += 1;
    if (secretTapTimer.current) {
      clearTimeout(secretTapTimer.current);
    }
    secretTapTimer.current = setTimeout(() => {
      secretTapCount.current = 0;
    }, 2000);
    if (secretTapCount.current >= 7) {
      secretTapCount.current = 0;
      if (secretTapTimer.current) {
        clearTimeout(secretTapTimer.current);
      }
      navigation.navigate('Admin');
    }
  };

  if (!currentUser) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.authHero}>
          <View style={styles.authHalo} />
          <View style={styles.authHaloTwo} />
          <TouchableOpacity style={styles.logo} onPress={handleSecretTap} activeOpacity={1}>
            <Text style={styles.logoText}>IMO</Text>
          </TouchableOpacity>
          <Text style={styles.authTitle}>Imo Nord Togo</Text>
          <Text style={styles.authSubtitle}>{t('app_tagline')}</Text>
          <View style={styles.authTrustRow}>
            <View style={styles.trustPill}>
              <Ionicons name="shield-checkmark" size={14} color="#0f172a" />
              <Text style={styles.trustText}>{t('profile_trust_verified')}</Text>
            </View>
            <View style={styles.trustPill}>
              <Ionicons name="flash" size={14} color="#0f172a" />
              <Text style={styles.trustText}>{t('profile_trust_fast')}</Text>
            </View>
            <View style={styles.trustPill}>
              <Ionicons name="call" size={14} color="#0f172a" />
              <Text style={styles.trustText}>{t('profile_trust_local')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.authCard}>
          <View style={styles.authTabs}>
            <TouchableOpacity
              style={[styles.authTab, authMode === 'login' && styles.authTabActive]}
              onPress={() => setAuthMode('login')}
            >
              <Text style={[styles.authTabText, authMode === 'login' && styles.authTabTextActive]}>
                {t('profile_login')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authTab, authMode === 'register' && styles.authTabActive]}
              onPress={() => setAuthMode('register')}
            >
              <Text style={[styles.authTabText, authMode === 'register' && styles.authTabTextActive]}>
                {t('profile_register')}
              </Text>
            </TouchableOpacity>
          </View>

          {authMode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile_name')}</Text>
              <TextInput
                style={styles.input}
                value={authName}
                onChangeText={setAuthName}
                placeholder="Ex: Jojo Bandi"
                autoCapitalize="words"
              />
            </View>
          )}
          {authMode === 'register' && (
            <TouchableOpacity
              style={styles.agentOption}
              onPress={() => setWantsAgentAccess(prev => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: wantsAgentAccess }}
            >
              <Ionicons
                name={wantsAgentAccess ? 'checkbox' : 'square-outline'}
                size={22}
                color={wantsAgentAccess ? COLORS.primary : '#64748B'}
              />
              <Text style={styles.agentOptionText}>
                Je suis agent immobilier et je souhaite publier des annonces.
                {'\n'}Mon compte devra être validé par un administrateur avant publication.
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('profile_email')}</Text>
            <TextInput
              style={styles.input}
              value={authEmail}
              onChangeText={setAuthEmail}
              placeholder="email@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          {authMode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile_phone')}</Text>
              <TextInput
                style={styles.input}
                value={authPhone}
                onChangeText={setAuthPhone}
                placeholder="+228 90 00 00 00"
                keyboardType="phone-pad"
              />
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('profile_password')}</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={authPassword}
                onChangeText={setAuthPassword}
                placeholder="********"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword(prev => !prev)}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.passwordHint}>{t('profile_password_min_hint')}</Text>
          </View>

          {authError.length > 0 && (
            <Text style={styles.authError}>{authError}</Text>
          )}

          {authMode === 'login' && (
            <TouchableOpacity style={styles.forgotButton} onPress={handleResetPassword}>
              <Text style={styles.forgotText}>{t('profile_forgot_password')}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.authSteps}>
            {[
              { label: t('profile_onboarding_step1') },
              { label: t('profile_onboarding_step2') },
              { label: t('profile_onboarding_step3') },
            ].map(step => (
              <View key={step.label} style={styles.stepCard}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                <Text style={styles.stepText}>{step.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.authLegal}>{t('profile_legal_consent_short')}</Text>

          <TouchableOpacity
            style={[styles.authButton, authLoading && styles.authButtonDisabled]}
            onPress={handleAuth}
            disabled={authLoading}
          >
            <Text style={styles.authButtonText}>
              {authLoading
                ? t('profile_please_wait')
                : authMode === 'login'
                ? t('profile_login_button')
                : t('profile_register_button')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const accountVerified = currentUser.verified;

  return (
    <>
      <ScrollView
        style={[styles.container, theme === 'dark' && styles.containerDark]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerGlow} />
          <View style={styles.headerGlowTwo} />
          <TouchableOpacity style={styles.logo} onPress={handleSecretTap} activeOpacity={1}>
            <Text style={styles.logoText}>IMO</Text>
          </TouchableOpacity>
          <Text style={styles.appName}>Imo Nord Togo</Text>
          <Text style={styles.tagline}>{t('app_tagline')}</Text>
        </View>

        <View style={styles.accountCard}>
          <View>
            <Text style={styles.accountName}>{currentUser.name}</Text>
            <Text style={styles.accountMeta}>{currentUser.email} ? {currentUser.phone}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} disabled={logoutLoading} onPress={handleLogoutPress}>
            <Ionicons name="log-out" size={18} color={COLORS.primary} />
            <Text style={styles.logoutText}>{logoutLoading ? t('profile_logging_out') : t('profile_logout')}</Text>
            {logoutLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={handleAccountDeletionRequest}
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={17} color={COLORS.error} />
          <Text style={styles.deleteAccountText}>{t('profile_delete_account')}</Text>
        </TouchableOpacity>

        <View style={styles.quickRow}>
          <View style={styles.quickCard}>
            <Ionicons name="home" size={18} color={COLORS.primary} />
            <Text style={styles.quickValue}>{myListingsCount}</Text>
            <Text style={styles.quickLabel}>{t('my_listings')}</Text>
          </View>
          <View style={styles.quickCard}>
            <Ionicons name="heart" size={18} color={COLORS.primary} />
            <Text style={styles.quickValue}>{favoritesCount}</Text>
            <Text style={styles.quickLabel}>{t('favorites')}</Text>
          </View>
          <View style={styles.quickCard}>
            <Ionicons name="notifications" size={18} color={COLORS.primary} />
            <Text style={styles.quickValue}>{alertsCount}</Text>
            <Text style={styles.quickLabel}>{t('profile_neighborhood_alerts')}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.quickMessages}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Messages' })}
        >
          <Ionicons name="chatbubbles" size={18} color="#fff" />
          <Text style={styles.quickMessagesText}>{t('profile_messages_shortcut')}</Text>
        </TouchableOpacity>

        {currentUser.isAdmin && (
          <TouchableOpacity style={styles.adminCta} onPress={() => navigation.navigate('Admin')}>
            <Ionicons name="shield-checkmark-outline" size={19} color="#fff" />
            <Text style={styles.adminCtaText}>Ouvrir l’espace administrateur</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        )}

        <View style={styles.notificationPanel}>
          <View style={styles.notificationHeader}>
            <View style={styles.notificationTitleRow}>
              <Ionicons name="notifications-outline" size={19} color={COLORS.primary} />
              <Text style={styles.notificationTitle}>Notifications</Text>
              {unreadNotifications > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadNotifications}</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
              <Text style={styles.notificationClear}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          {notifications.length === 0 ? (
            <Text style={styles.notificationEmpty}>Aucune notification récente.</Text>
          ) : (
            notifications.slice(0, 5).map(notification => (
              <TouchableOpacity
                key={notification.id}
                style={[styles.notificationItem, !notification.read && styles.notificationItemUnread]}
                onPress={() => navigation.navigate('Notifications')}
              >
                <View style={styles.notificationDot}>
                  <Ionicons name={notification.read ? 'checkmark' : 'ellipse'} size={10} color="#fff" />
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationItemTitle}>{notification.title}</Text>
                  <Text style={styles.notificationItemBody}>{notification.body}</Text>
                  <Text style={styles.notificationDate}>
                    {new Date(notification.createdAt).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <TouchableOpacity
          style={styles.publishCta}
          onPress={() => navigation.navigate('Publish')}
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.publishCtaText}>Publier une annonce</Text>
        </TouchableOpacity>

        {(isAgent || hasAgentRequest) && (
          <View style={styles.agentDashboard}>
            <View style={styles.agentDashboardHeader}>
              <View>
                <Text style={styles.sectionTitle}>Espace agent</Text>
                <Text style={styles.agentDashboardSubtitle}>
                  {isAgent
                    ? 'Suivez vos annonces et leur validation.'
                    : currentUser.agentStatus === 'pending'
                    ? 'Votre demande est en cours de validation.'
                    : `Votre demande agent a été refusée.${currentUser.agentRejectionReason ? ` Motif : ${currentUser.agentRejectionReason}` : ''}`}
                </Text>
              </View>
              <Ionicons name="briefcase-outline" size={24} color={COLORS.primary} />
            </View>
            {isAgent && (
              <View style={styles.agentStatsGrid}>
                <View style={styles.agentStatCard}>
                  <Text style={styles.agentStatValue}>{listingCounts.approved}</Text>
                  <Text style={styles.agentStatLabel}>Publiées</Text>
                </View>
                <View style={styles.agentStatCard}>
                  <Text style={styles.agentStatValue}>{listingCounts.pending}</Text>
                  <Text style={styles.agentStatLabel}>En attente</Text>
                </View>
                <View style={styles.agentStatCard}>
                  <Text style={styles.agentStatValue}>{listingCounts.rejected}</Text>
                  <Text style={styles.agentStatLabel}>Refusées</Text>
                </View>
                <View style={styles.agentStatCard}>
                  <Text style={styles.agentStatValue}>{listingCounts.archived}</Text>
                  <Text style={styles.agentStatLabel}>Archivées</Text>
                </View>
              </View>
            )}
            <View style={styles.agentStatusLine}>
              <Ionicons
                name={isAgent ? 'checkmark-circle' : currentUser.agentStatus === 'pending' ? 'time' : 'close-circle'}
                size={18}
                color={isAgent ? '#16a34a' : currentUser.agentStatus === 'pending' ? '#d97706' : '#dc2626'}
              />
              <Text style={styles.agentStatusText}>
                {isAgent ? 'Compte agent approuvé' : currentUser.agentStatus === 'pending' ? 'Demande en attente' : 'Demande refusée'}
              </Text>
            </View>
          </View>
        )}

        {/* Account Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile_account_status')}</Text>
          <View style={styles.statusCard}>
            <Ionicons
              name={accountVerified ? 'shield-checkmark' : 'alert-circle'}
              size={22}
              color={accountVerified ? '#16a34a' : '#f59e0b'}
            />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {accountVerified ? t('profile_verified') : t('profile_not_verified')}
              </Text>
              <Text style={styles.statusSubtitle}>
                {accountVerified ? t('profile_verified_sub') : t('profile_verify_admin')}
              </Text>
            </View>
          </View>
        </View>

        {/* My Listings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('my_listings')}</Text>
          {myProperties.length === 0 ? (
            <Text style={styles.emptyText}>{t('no_listing')}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
              {myProperties.map(property => {
                const isBusy = listingActionBusy[property.id];
                const isOccupied = property.status === 'occupied';
                return (
                  <View key={property.id} style={styles.myListingCard}>
                    <PropertyCard
                      property={property}
                      onPress={() =>
                        InteractionManager.runAfterInteractions(() =>
                          navigation.navigate('PropertyDetail', { propertyId: property.id })
                        )
                      }
                      compact
                    />
                    <View style={[
                      styles.listingStatusBadge,
                      property.listingStatus === 'rejected'
                        ? styles.listingStatusRejected
                        : property.listingStatus === 'approved'
                          ? styles.listingStatusApproved
                          : styles.listingStatusPending,
                    ]}>
                      <Text style={styles.listingStatusText}>
                        {getListingLabel(property.listingStatus)}
                      </Text>
                    </View>
                    {property.listingStatus === 'rejected' && property.rejectionReason ? (
                      <View style={styles.rejectionReasonBox}>
                        <Text style={styles.rejectionReasonTitle}>Motif du refus</Text>
                        <Text style={styles.rejectionReasonText}>{property.rejectionReason}</Text>
                        <Text style={styles.rejectionReasonHint}>
                          Corrigez l’annonce puis contactez l’administration pour la soumettre à nouveau.
                        </Text>
                        <TouchableOpacity
                          style={styles.editRejectedButton}
                          onPress={() => navigation.navigate('Publish', { propertyId: property.id })}
                        >
                          <Ionicons name="create-outline" size={15} color="#fff" />
                          <Text style={styles.editRejectedButtonText}>Modifier et renvoyer</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    <View style={styles.myListingActions}>
                      {isOccupied ? (
                        <TouchableOpacity
                          style={[styles.myListingButton, styles.myListingButtonPrimary, isBusy && styles.myListingButtonDisabled]}
                          onPress={() =>
                            confirmListingStatus(
                              property.id,
                              'available',
                              'Remettre disponible',
                              "Cette annonce sera visible à nouveau dans l'application.",
                              'Confirmer'
                            )
                          }
                          disabled={isBusy}
                        >
                          {isBusy ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.myListingButtonTextLight}>Remettre disponible</Text>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[styles.myListingButton, styles.myListingButtonDanger, isBusy && styles.myListingButtonDisabled]}
                            onPress={() =>
                              confirmListingStatus(
                                property.id,
                                'occupied',
                                'Déjà vendu',
                                "Cette annonce sera marquée comme vendue et disparaîtra de l'application après 48h.",
                                'Confirmer',
                                'destructive'
                              )
                            }
                            disabled={isBusy}
                          >
                            {isBusy ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.myListingButtonTextLight}>Déjà vendu</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.myListingButton, styles.myListingButtonWarning, isBusy && styles.myListingButtonDisabled]}
                            onPress={() =>
                              confirmListingStatus(
                                property.id,
                                'occupied',
                                'Déjà occupé',
                                "Cette annonce sera marquée comme occupée et disparaîtra de l'application après 48h.",
                                'Confirmer',
                                'destructive'
                              )
                            }
                            disabled={isBusy}
                          >
                            {isBusy ? (
                              <ActivityIndicator size="small" color="#1f2937" />
                            ) : (
                              <Text style={styles.myListingButtonTextDark}>Déjà occupé</Text>
                            )}
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Favorites */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('favorites')}</Text>
          {favoriteProperties.length === 0 ? (
            <Text style={styles.emptyText}>{t('no_favorite')}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
              {favoriteProperties.map(property => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onPress={() => InteractionManager.runAfterInteractions(() => navigation.navigate('PropertyDetail', { propertyId: property.id }))}
                  compact
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Saved Searches */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('saved_searches')}</Text>
          {savedSearches.length === 0 ? (
            <Text style={styles.emptyText}>{t('no_saved_search')}</Text>
          ) : (
            savedSearches.map(saved => (
              <View key={saved.id} style={styles.savedSearchRow}>
                <View style={styles.savedSearchInfo}>
                  <Text style={styles.savedSearchLabel}>{saved.label}</Text>
                  <Text style={styles.savedSearchMeta}>
                    {t('type_label')}: {saved.type === 'ALL' ? t('all_types') : tType(saved.type)}
                  </Text>
                </View>
                <View style={styles.savedSearchActions}>
                  <TouchableOpacity
                    style={styles.savedSearchApply}
                    onPress={() => applySavedSearch(saved.id)}
                  >
                    <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.savedSearchDelete}
                    onPress={() => removeSavedSearch(saved.id)}
                  >
                    <Ionicons name="trash" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Search History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('profile_search_history')}</Text>
            {searchHistory.length > 0 && (
              <TouchableOpacity onPress={clearSearchHistory}>
                <Text style={styles.clearText}>{t('profile_clear_history')}</Text>
              </TouchableOpacity>
            )}
          </View>
          {searchHistory.length === 0 ? (
            <Text style={styles.emptyText}>{t('profile_no_history')}</Text>
          ) : (
            searchHistory.map((query, index) => (
              <TouchableOpacity
                key={`${query}-${index}`}
                style={styles.historyRow}
                onPress={() => applySearchHistory(query)}
              >
                <Text style={styles.historyText}>{query}</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Recent Views */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile_recent_views')}</Text>
          {recentViewedProperties.length === 0 ? (
            <Text style={styles.emptyText}>{t('profile_no_recent')}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
              {recentViewedProperties.map(property => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onPress={() => InteractionManager.runAfterInteractions(() => navigation.navigate('PropertyDetail', { propertyId: property.id }))}
                  compact
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Neighborhood Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile_neighborhood_alerts')}</Text>
          <Text style={styles.helperText}>{t('profile_alert_hint')}</Text>
          {neighborhoodsWithListings.length === 0 ? (
            <Text style={styles.emptyText}>{t('profile_no_recent')}</Text>
          ) : (
            <View style={styles.alertGrid}>
              {neighborhoodsWithListings.map(name => {
                const enabled = neighborhoodAlerts.some(n => n.toLowerCase() === name.toLowerCase());
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.alertChip, enabled && styles.alertChipActive]}
                    onPress={() => toggleNeighborhoodAlert(name)}
                  >
                    <Ionicons
                      name={enabled ? 'notifications' : 'notifications-outline'}
                      size={14}
                      color={enabled ? '#fff' : COLORS.textMuted}
                    />
                    <Text style={[styles.alertText, enabled && styles.alertTextActive]}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Invite Friend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile_invite_friend')}</Text>
          <TouchableOpacity style={styles.inviteButton} onPress={handleInvite}>
            <Ionicons name="share-social" size={18} color="#fff" />
            <Text style={styles.inviteText}>{t('profile_invite_friend')}</Text>
          </TouchableOpacity>
        </View>
        {/* Theme */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('theme')}</Text>
          <View style={styles.languageRow}>
            <TouchableOpacity
              style={[
                styles.languageChip,
                theme === 'light' && styles.languageChipActive,
              ]}
              onPress={() => setTheme('light')}
            >
              <Text
                style={[
                  styles.languageText,
                  theme === 'light' && styles.languageTextActive,
                ]}
              >
                {t('theme_light')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.languageChip,
                theme === 'dark' && styles.languageChipActive,
              ]}
              onPress={() => setTheme('dark')}
            >
              <Text
                style={[
                  styles.languageText,
                  theme === 'dark' && styles.languageTextActive,
                ]}
              >
                {t('theme_dark')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contact Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('contact_us')}</Text>

          <TouchableOpacity style={styles.contactItem} onPress={handleCall}>
            <View style={[styles.contactIcon, { backgroundColor: COLORS.primary }]}>
              <Ionicons name="call" size={20} color="#fff" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>{t('contact_phone')}</Text>
              <Text style={styles.contactValue}>{getContactPhoneDisplay()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactItem} onPress={handleEmail}>
            <View style={[styles.contactIcon, { backgroundColor: '#3B82F6' }]}>
              <Ionicons name="mail" size={20} color="#fff" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>{t('contact_email')}</Text>
              <Text style={styles.contactValue}>{getContactEmail()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactItem} onPress={handleWhatsApp}>
            <View style={[styles.contactIcon, { backgroundColor: '#25D366' }]}>
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>{t('contact_whatsapp')}</Text>
              <Text style={styles.contactValue}>{getContactPhoneDisplay()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about')}</Text>
          <Text style={styles.aboutText}>
            {t('about_text')}
          </Text>
        </View>

        {/* Legal Section - Required for Google Play */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal')}</Text>

          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => setLegalModal('privacy')}
          >
            <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
            <Text style={styles.legalText}>{t('privacy')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => setLegalModal('terms')}
          >
            <Ionicons name="document-text" size={20} color={COLORS.primary} />
            <Text style={styles.legalText}>{t('terms')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Social Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('follow_us')}</Text>
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-facebook" size={24} color="#1877F2" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-instagram" size={24} color="#E4405F" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-twitter" size={24} color="#1DA1F2" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('footer_rights')}</Text>
          <Text style={styles.footerVersion}>{t('version')} 1.0.0</Text>
        </View>
      </ScrollView>

      {/* Legal Modal */}
      <Modal
        visible={legalModal !== null}
        animationType="slide"
        onRequestClose={() => setLegalModal(null)}
      >
        {legalModal && (
          <LegalScreen
            type={legalModal}
            onClose={() => setLegalModal(null)}
          />
        )}
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  content: {
    paddingBottom: 40,
  },
  authContainer: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  authHero: {
    alignItems: 'center',
    padding: 32,
    paddingTop: 60,
    paddingBottom: 80,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  authHalo: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(212,175,55,0.18)',
    top: -80,
    right: -90,
  },
  authHaloTwo: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -70,
    left: -60,
  },
  authTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
  },
  authSubtitle: {
    fontSize: 13,
    color: '#cbd5f5',
    marginTop: 6,
    textAlign: 'center',
  },
  authTrustRow: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  trustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  trustText: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
    padding: 32,
    paddingTop: 60,
    paddingBottom: 90,
    backgroundColor: COLORS.primary,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(212,175,55,0.2)',
    top: -60,
    right: -80,
  },
  headerGlowTwo: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.12)',
    bottom: -60,
    left: -40,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  tagline: {
    fontSize: 14,
    color: COLORS.borderSoft,
    marginTop: 6,
  },
  authCard: {
    backgroundColor: '#fff',
    marginHorizontal: 18,
    marginTop: -40,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  authTabs: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  authTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  authTabActive: {
    backgroundColor: COLORS.primary,
  },
  authTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  authTabTextActive: {
    color: '#fff',
  },
  inputGroup: {
    marginBottom: 12,
  },
  agentOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  agentOptionText: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    fontSize: 14,
    color: '#0F172A',
  },
  authButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  authButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  authError: {
    fontSize: 12,
    color: COLORS.error,
    marginBottom: 8,
  },
  accountCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: -48,
    padding: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  deleteAccountText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '700',
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  accountMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.infoBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
  },
  publishCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 14,
  },
  publishCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  quickMessages: {
    marginTop: 12,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 14,
  },
  quickMessagesText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  adminCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  adminCtaText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  notificationPanel: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  notificationBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  notificationClear: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  notificationEmpty: {
    color: COLORS.textMuted,
    fontSize: 12,
    paddingVertical: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  notificationItemUnread: {
    backgroundColor: '#f8fafc',
  },
  notificationDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationItemTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  notificationItemBody: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  notificationDate: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  quickCard: {
    flex: 1,
    backgroundColor: COLORS.chipBg,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  quickValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 4,
  },
  quickLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  agentDashboard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  agentDashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agentDashboardSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  agentStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  agentStatCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  agentStatValue: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  agentStatLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  agentStatusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  agentStatusText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  cardRow: {
    paddingRight: 16,
    gap: 12,
  },
  myListingCard: {
    alignSelf: 'flex-start',
  },
  listingStatusBadge: {
    alignSelf: 'flex-start',
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  listingStatusPending: { backgroundColor: '#fef3c7' },
  listingStatusApproved: { backgroundColor: '#dcfce7' },
  listingStatusRejected: { backgroundColor: '#fee2e2' },
  listingStatusText: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  rejectionReasonBox: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  rejectionReasonTitle: { fontSize: 12, fontWeight: '700', color: '#9a3412', marginBottom: 3 },
  rejectionReasonText: { fontSize: 12, lineHeight: 17, color: '#7c2d12' },
  rejectionReasonHint: { fontSize: 11, lineHeight: 15, color: '#9a3412', marginTop: 5 },
  editRejectedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  editRejectedButtonText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  myListingActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    marginTop: -2,
  },
  myListingButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myListingButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  myListingButtonDanger: {
    backgroundColor: COLORS.error,
  },
  myListingButtonWarning: {
    backgroundColor: '#f59e0b',
  },
  myListingButtonDisabled: {
    opacity: 0.6,
  },
  myListingButtonTextLight: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  myListingButtonTextDark: {
    color: '#1f2937',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  clearText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  historyText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  alertGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  alertChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
  },
  alertChipActive: {
    backgroundColor: COLORS.primary,
  },
  alertText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  alertTextActive: {
    color: '#fff',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  inviteText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  propertyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.chipBg,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  propertyInfo: {
    flex: 1,
    marginRight: 10,
  },
  propertyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  propertyMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  propertyStats: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  propertyRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  propertyPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  propertyStatus: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  listingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  listingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  listingPending: {
    backgroundColor: '#fef3c7',
  },
  listingApproved: {
    backgroundColor: COLORS.successBg,
  },
  listingRejected: {
    backgroundColor: COLORS.dangerBg,
  },
  listingArchived: {
    backgroundColor: COLORS.borderSoft,
  },
  savedSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.chipBg,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  savedSearchInfo: {
    flex: 1,
    marginRight: 10,
  },
  savedSearchLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  savedSearchMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  savedSearchActions: {
    flexDirection: 'row',
    gap: 8,
  },
  savedSearchApply: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedSearchDelete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  languageChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
  },
  languageChipActive: {
    backgroundColor: COLORS.primary,
  },
  languageText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  languageTextActive: {
    color: '#fff',
  },
  aboutText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.chipBg,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 2,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.chipBg,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  addressInfo: {
    flex: 1,
  },
  addressText: {
    fontSize: 14,
    color: '#475569',
  },
  legalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.chipBg,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  legalText: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceItem: {
    width: '47%',
    backgroundColor: COLORS.chipBg,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  serviceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
  },
  serviceDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  footer: {
    alignItems: 'center',
    padding: 24,
    marginTop: 10,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  footerVersion: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },

  authButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: 10,
  },
  forgotText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 44,
  },
  passwordToggle: {
    position: 'absolute',
    right: 10,
    padding: 6,
  },
  passwordHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
  },
  authSteps: {
    marginTop: 14,
    gap: 8,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  stepText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  authLegal: {
    marginTop: 12,
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export default ProfileScreen;





















