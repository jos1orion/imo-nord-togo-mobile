import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  InteractionManager,
  Linking,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { AppAlert as Alert } from '../components/ui/appAlertService';
import TextInput from '../components/ui/AccessibleTextInput';

import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LegalScreen from './SettingsScreen';
import { RootStackParamList } from '../../App';
import { useApp } from '../context/AppContext';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import { authCallbackUrl, exchangeAuthCallback, resetPasswordCallbackUrl, supabase } from '../lib/supabase';
import PropertyCard from '../components/PropertyCard';
import COLORS, { THEME_PALETTES } from '../theme/colors';
import { isPublicProperty } from '../utils/propertyVisibility';
import { RADIUS, SPACING } from '../theme/spacing';
import { typography } from '../theme/typography';
import { logger } from '../lib/logger';
import { formatPrice } from '../utils/format';
import type { ThemeMode } from '../theme/colors';

type ProfileRouteProp = RouteProp<
  { Profile: { authMode?: 'login' | 'register' } | undefined },
  'Profile'
>;

const isExpiringSoon = (expiresAt?: string | null) => {
  if (!expiresAt) return false;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  return remaining > 0 && remaining <= 14 * 24 * 60 * 60 * 1000;
};

const ProfileScreen: React.FC = () => {
  const styles = useThemedStyles(baseStyles);
  const themeColors = useThemeColors();
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<ProfileRouteProp>();
  const insets = useSafeAreaInsets();
  const {
    properties,
    propertyStats,
    favorites,
    savedSearches,
    removeSavedSearch,
    searchHistory,
    clearSearchHistory,
    recentViewedIds,
    getMyProperties,
    getAgentProfile,
    chats,
    currentUser,
    registerUser,
    loginUser,
    logoutUser,
    setSearchQuery,
    setFilterType,
    resetFilters,
    setFilters,
    theme: selectedTheme,
    setTheme,
    t,
    tType,
    notifications,
    setPrivacySetting,
    updateProfile,
  } = useApp();
  const theme = selectedTheme === 'light' ? 'light' : 'dark';
  const secretTapCount = useRef(0);
  const secretTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const authScrollRef = useRef<ScrollView>(null);
  const recentViewedProperties = recentViewedIds
    .map(id => properties.find(p => p.id === id))
    .filter((item): item is NonNullable<typeof item> => isPublicProperty(item));
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [wantsAgentAccess, setWantsAgentAccess] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agentListingFilter, setAgentListingFilter] = useState<
    'pending' | 'published' | 'rejected' | 'completed'
  >('published');
  const [profileName, setProfileName] = useState(currentUser?.name ?? '');
  const [profilePhone, setProfilePhone] = useState(currentUser?.phone ?? '');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [themePreview, setThemePreview] = useState<ThemeMode | null>(null);
  const [expandedActivitySection, setExpandedActivitySection] = useState<
    'favorites' | 'savedSearches' | 'searchHistory' | 'recentViews' | null
  >(null);

  useEffect(() => {
    setProfileName(currentUser?.name ?? '');
    setProfilePhone(currentUser?.phone ?? '');
  }, [currentUser?.name, currentUser?.phone]);

  useEffect(() => {
    if (route.params?.authMode) {
      setAuthMode(route.params.authMode);
      setAuthError('');
      setAuthNotice('');
    }
  }, [route.params?.authMode]);

  // Simple fade‑in animation for premium UI components
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

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
    return t('profile_auth_request_failed');
  };

  const handleAuth = async () => {
    setAuthNotice('');
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
    setAuthPhone('');
    setAuthPassword('');
    setWantsAgentAccess(false);
    setAuthNotice(
      result.confirmationRequired
        ? t('profile_auth_registration_confirm_email')
        : t('profile_auth_registration_success')
    );
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
        redirectTo: resetPasswordCallbackUrl,
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

  const handleGoogleAuth = async () => {
    setAuthError('');
    setAuthLoading(true);
    let authStage = 'requesting Google authorization';
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authCallbackUrl,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });
      if (error) throw error;
      if (Platform.OS === 'web') return;
      if (!data.url) throw new Error('Missing Google OAuth URL.');

      authStage = 'opening the Google sign-in page';
      const result = await WebBrowser.openAuthSessionAsync(data.url, authCallbackUrl);
      if (result.type === 'success') {
        authStage = 'completing the Supabase session';
        const sessionResult = await exchangeAuthCallback(result.url);
        if (!sessionResult) {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!data.session) {
            throw new Error('Google returned no authorization code or session tokens.');
          }
        }
        if (sessionResult?.error) throw sessionResult.error;
      } else if (result.type !== 'cancel' && result.type !== 'dismiss') {
        logger.warn('Google sign-in ended without completing authentication.', {
          resultType: result.type,
        });
      }
    } catch (error) {
      const errorDetails = error instanceof Error
        ? { name: error.name, message: error.message }
        : { message: String(error) };
      logger.error(`Google sign-in failed while ${authStage}.`, errorDetails);
      setAuthError(t('profile_auth_google_failed'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAccountDeletionRequest = async () => {
    try {
      await Linking.openURL('https://imo-nord-togo-mobile.vercel.app/delete-account');
    } catch {
      Alert.alert(
        t('error'),
        `${t('profile_delete_account_email_failed')}\n\nhttps://imo-nord-togo-mobile.vercel.app/delete-account`
      );
    }
  };

  const handleProfileSave = async () => {
    const name = profileName.trim();
    if (!name) {
      Alert.alert(t('error'), t('profile_auth_invalid'));
      return;
    }

    setProfileSaving(true);
    try {
      await updateProfile({ name, phone: profilePhone });
      setIsEditingProfile(false);
      Alert.alert(t('success'), t('profile_update_success'));
    } catch (error) {
      logger.error('Unable to update the profile.', error);
      Alert.alert(t('error'), t('profile_update_failed'));
    } finally {
      setProfileSaving(false);
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
    if (currentUser?.isAdmin !== true && currentUser?.role !== 'ADMIN') return;

    secretTapCount.current += 1;
    if (secretTapTimer.current) {
      clearTimeout(secretTapTimer.current);
    }
    secretTapTimer.current = setTimeout(() => {
      secretTapCount.current = 0;
    }, 4000);
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={authScrollRef}
          style={styles.container}
          contentContainerStyle={[styles.authContainer, { paddingTop: insets.top + 8 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
        <View style={styles.authHero}>
          <TouchableOpacity style={styles.authBrand} onPress={handleSecretTap} activeOpacity={1}>
            <View style={styles.authLogo}>
              <Text style={styles.authLogoText}>IMO</Text>
            </View>
            <View style={styles.authBrandCopy}>
              <Text style={styles.authTitle}>ImoPrestige</Text>
              <Text style={styles.authSubtitle}>{t('app_tagline')}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.authWelcome}>
            <View style={styles.authWelcomeIcon}>
              <Ionicons name="home" size={22} color={themeColors.onSurfaceMuted} />
            </View>
            <View style={styles.authWelcomeCopy}>
              <Text style={styles.authWelcomeSubtitle}>{t('profile_auth_hero_subtitle')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.authCard}>
          <Text style={styles.authCardTitle}>
            {authMode === 'login'
              ? t('profile_auth_login_heading')
              : t('profile_auth_register_heading')}
          </Text>
          <Text style={styles.authCardSubtitle}>
            {authMode === 'login'
              ? t('profile_auth_login_subtitle')
              : t('profile_auth_register_subtitle')}
          </Text>
          <View style={styles.authTabs}>
            <TouchableOpacity
              style={[styles.authTab, authMode === 'login' && styles.authTabActive]}
              onPress={() => {
                setAuthMode('login');
                setAuthError('');
                setAuthNotice('');
              }}
            >
              <Text style={[styles.authTabText, authMode === 'login' && styles.authTabTextActive]}>
                {t('profile_login')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authTab, authMode === 'register' && styles.authTabActive]}
              onPress={() => {
                setAuthMode('register');
                setAuthError('');
                setAuthNotice('');
              }}
            >
              <Text style={[styles.authTabText, authMode === 'register' && styles.authTabTextActive]}>
                {t('profile_register')}
              </Text>
            </TouchableOpacity>
          </View>

          {authMode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile_name')}</Text>
              <View style={styles.authInputRow}>
                <Ionicons name="person-outline" size={19} color={themeColors.onSurfaceMuted} />
                <TextInput
                  style={styles.authInput}
                  accessibilityLabel={t('profile_name')}
                  value={authName}
                  onChangeText={setAuthName}
                  placeholder={t('profile_name_placeholder')}
                  autoCapitalize="words"
                  textContentType="name"
                  returnKeyType="next"
                />
              </View>
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
                color={wantsAgentAccess ? themeColors.primary : themeColors.onSurfaceMuted}
              />
              <Text style={styles.agentOptionText}>
                {t('profile_agent_signup')}
                {'\n'}{t('profile_agent_signup_note')}
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('profile_email')}</Text>
            <View style={styles.authInputRow}>
              <Ionicons name="mail-outline" size={19} color={themeColors.onSurfaceMuted} />
              <TextInput
                style={styles.authInput}
                accessibilityLabel={t('profile_email')}
                value={authEmail}
                onChangeText={setAuthEmail}
                placeholder="email@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
                onFocus={() => setTimeout(() => authScrollRef.current?.scrollToEnd({ animated: true }), 300)}
              />
            </View>
          </View>
          {authMode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile_phone')}</Text>
              <View style={styles.authInputRow}>
                <Ionicons name="call-outline" size={19} color={themeColors.onSurfaceMuted} />
                <TextInput
                  style={styles.authInput}
                  accessibilityLabel={t('profile_phone')}
                  value={authPhone}
                  onChangeText={setAuthPhone}
                  placeholder={t('profile_phone_placeholder')}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  returnKeyType="next"
                  onFocus={() => setTimeout(() => authScrollRef.current?.scrollToEnd({ animated: true }), 300)}
                />
              </View>
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('profile_password')}</Text>
            <View style={[styles.authInputRow, styles.passwordRow]}>
              <Ionicons name="lock-closed-outline" size={19} color={themeColors.onSurfaceMuted} />
              <TextInput
                style={[styles.authInput, styles.passwordInput]}
                accessibilityLabel={t('profile_password')}
                value={authPassword}
                onChangeText={setAuthPassword}
                placeholder="********"
                secureTextEntry={!showPassword}
                textContentType={authMode === 'login' ? 'password' : 'newPassword'}
                autoCapitalize="none"
                returnKeyType="done"
                onFocus={() => setTimeout(() => authScrollRef.current?.scrollToEnd({ animated: true }), 300)}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword(prev => !prev)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? t('profile_password_hide') : t('profile_password_show')}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={themeColors.onSurfaceMuted} />
              </TouchableOpacity>
            </View>
            {authMode === 'register' && (
              <Text style={styles.passwordHint}>{t('profile_password_min_hint')}</Text>
            )}
          </View>

          {authError.length > 0 && (
            <Text style={styles.authError}>{authError}</Text>
          )}
          {authNotice.length > 0 && (
            <Text style={styles.authNotice}>{authNotice}</Text>
          )}

          {authMode === 'login' && (
            <TouchableOpacity style={styles.forgotButton} onPress={handleResetPassword}>
              <Text style={styles.forgotText}>{t('profile_forgot_password')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.authButton, authLoading && styles.authButtonDisabled]}
            onPress={handleAuth}
            disabled={authLoading}
            accessibilityRole="button"
          >
            <Text style={styles.authButtonText}>
              {authLoading
                ? t('profile_please_wait')
                : authMode === 'login'
                ? t('profile_login_button')
                : t('profile_register_button')}
            </Text>
          </TouchableOpacity>

          <View style={styles.authDivider}>
            <View style={styles.authDividerLine} />
            <Text style={styles.authDividerText}>{t('profile_auth_or')}</Text>
            <View style={styles.authDividerLine} />
          </View>
          <TouchableOpacity
            style={[styles.googleButton, authLoading && styles.authButtonDisabled]}
            onPress={() => void handleGoogleAuth()}
            disabled={authLoading}
            accessibilityRole="button"
          >
            <Ionicons name="logo-google" size={18} color={themeColors.socialGoogle} />
            <Text style={styles.googleButtonText}>
              {authLoading ? t('profile_please_wait') : t('profile_auth_google')}
            </Text>
          </TouchableOpacity>

          {authMode === 'register' && (
            <Text style={styles.authLegal}>{t('profile_legal_consent_short')}</Text>
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const accountVerified = currentUser.verified;
  const isAgent = currentUser.role === 'AGENT';
  const hasProfessionalWorkspace = isAgent || currentUser.role === 'ADMIN';
  const canRequestAgentAccess =
    !isAgent &&
    currentUser.role !== 'ADMIN' &&
    currentUser.role !== 'ACCOUNTANT' &&
    (currentUser.agentStatus === undefined ||
      currentUser.agentStatus === 'none' ||
      currentUser.agentStatus === 'pending' ||
      currentUser.agentStatus === 'rejected');
  const agentProperties = isAgent
    ? properties.filter(property => property.ownerId === currentUser.id)
    : [];
  const profileProperties = getMyProperties();
  const favoriteProperties = properties.filter(
    property => favorites.includes(property.id) && isPublicProperty(property)
  );
  const profileViews = profileProperties.reduce(
    (total, property) => total + (propertyStats[property.id]?.views ?? 0),
    0
  );
  const profileContacts = profileProperties.reduce(
    (total, property) => total + (propertyStats[property.id]?.contacts ?? 0),
    0
  );
  const hasProfileViews = profileProperties.some(
    property => typeof propertyStats[property.id]?.views === 'number'
  );
  const hasProfileContacts = profileProperties.some(
    property => typeof propertyStats[property.id]?.contacts === 'number'
  );
  const unreadMessageCount = currentUser
    ? chats
        .filter(chat => chat.participants.includes(currentUser.id))
        .reduce((total, chat) => total + (chat.unreadCount[currentUser.id] ?? 0), 0)
    : 0;
  const activeAgentListings = agentProperties.filter(
    property => property.listingStatus === 'approved' && property.status === 'available'
  ).length;
  const unreadAgentMessages = isAgent
    ? chats
        .filter(chat => chat.participants.includes(currentUser.id))
        .reduce((total, chat) => total + (chat.unreadCount[currentUser.id] ?? 0), 0)
    : 0;
  const agentViews = agentProperties.reduce(
    (total, property) => total + (propertyStats[property.id]?.views ?? 0),
    0
  );
  const agentProfile = isAgent ? getAgentProfile(currentUser.id) : null;
  const agentProfileComplete = Boolean(
    currentUser.name.trim() &&
    currentUser.phone.trim() &&
    currentUser.email.trim() &&
    agentProfile?.bio.trim() &&
    agentProfile.specialties.length > 0
  );
  const agentSetupSteps = [
    { label: t('profile_agent_step_account'), done: true },
    {
      label: t('profile_agent_step_contact'),
      done: Boolean(currentUser.name.trim() && currentUser.email.trim() && currentUser.phone.trim()),
    },
    {
      label: t('profile_agent_step_professional'),
      done: Boolean(agentProfile?.bio.trim() && agentProfile.specialties.length > 0),
    },
    { label: t('profile_agent_step_verification'), done: currentUser.verified },
    { label: t('profile_agent_step_first_listing'), done: agentProperties.length > 0 },
  ];
  const completedAgentSetupSteps = agentSetupSteps.filter(step => step.done).length;
  const agentListingsByStatus = {
    pending: agentProperties.filter(property => property.listingStatus === 'pending'),
    published: agentProperties.filter(
      property => property.listingStatus === 'approved' && property.status === 'available'
    ),
    rejected: agentProperties.filter(property => property.listingStatus === 'rejected'),
    completed: agentProperties.filter(
      property =>
        property.status === 'occupied' ||
        property.listingStatus === 'archived'
    ),
  };
  const selectedAgentListings = agentListingsByStatus[agentListingFilter];
  const profileInitials = currentUser.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase() || 'U';
  const profileRoleKey = currentUser.role === 'AGENT'
    ? 'profile_role_agent'
    : currentUser.role === 'ADMIN'
      ? 'profile_role_admin'
      : currentUser.role === 'ACCOUNTANT'
        ? 'profile_role_accountant'
        : 'profile_client_badge';
  const notificationUnreadCount = notifications.filter(notification => !notification.read).length;
  const profileStats = [
    {
      key: 'listings',
      value: profileProperties.length,
      label: t('my_listings'),
      icon: 'home-outline' as const,
      onPress: () => navigation.navigate(
        'MainTabs',
        {screen: hasProfessionalWorkspace ? 'Agent' : 'Publish'}
      ),
    },
    {
      key: 'favorites',
      value: favoriteProperties.length,
      label: t('favorites'),
      icon: 'heart-outline' as const,
      onPress: () => setExpandedActivitySection('favorites'),
    },
    ...(hasProfileViews
      ? [{
          key: 'views',
          value: profileViews,
          label: t('profile_views_count'),
          icon: 'eye-outline' as const,
          onPress: () => navigation.navigate(
            'MainTabs',
            {screen: hasProfessionalWorkspace ? 'Agent' : 'Publish'}
          ),
        }]
      : []),
    ...(hasProfileContacts
      ? [{
          key: 'contacts',
          value: profileContacts,
          label: t('profile_contacts_count'),
          icon: 'chatbubble-ellipses-outline' as const,
          onPress: () => navigation.navigate('MainTabs', { screen: 'Messages' }),
        }]
      : []),
  ];
  const profileMenuItems = [
    {
      key: 'listings',
      icon: 'home-outline' as const,
      label: t('my_listings'),
      description: t('profile_menu_listings_description'),
      onPress: () => navigation.navigate(
        'MainTabs',
        {screen: hasProfessionalWorkspace ? 'Agent' : 'Publish'}
      ),
    },
    {
      key: 'favorites',
      icon: 'heart-outline' as const,
      label: t('favorites'),
      description: t('profile_menu_favorites_description'),
      count: favoriteProperties.length,
      onPress: () => setExpandedActivitySection('favorites'),
    },
    {
      key: 'messages',
      icon: 'chatbubble-ellipses-outline' as const,
      label: t('messages_inbox_title'),
      description: t('profile_menu_messages_description'),
      count: unreadMessageCount,
      onPress: () => navigation.navigate('MainTabs', { screen: 'Messages' }),
    },
    {
      key: 'notifications',
      icon: 'notifications-outline' as const,
      label: t('notifications_title'),
      description: t('profile_menu_notifications_description'),
      count: notificationUnreadCount,
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      key: 'account',
      icon: 'person-circle-outline' as const,
      label: t('profile_edit_action'),
      description: t('profile_menu_account_description'),
      onPress: () => setIsEditingProfile(true),
    },
    {
      key: 'appearance',
      icon: 'color-palette-outline' as const,
      label: t('profile_theme_section'),
      description: t('profile_menu_appearance_description'),
      onPress: () => setThemePreview(selectedTheme),
    },
    {
      key: 'help',
      icon: 'help-circle-outline' as const,
      label: t('support_title'),
      description: t('profile_menu_help_description'),
      onPress: () => navigation.navigate('MainTabs', { screen: 'Messages' }),
    },
    {
      key: 'privacy',
      icon: 'shield-checkmark-outline' as const,
      label: t('privacy'),
      description: t('profile_menu_privacy_description'),
      onPress: () => setLegalModal('privacy'),
    },
  ];
  const themeOptions: {
    mode: ThemeMode;
    title: string;
    description: string;
    colors: string[];
  }[] = [
    {
      mode: 'dark',
      title: t('theme_dark_elegant'),
      description: t('theme_dark_elegant_description'),
      colors: ['#0B1422', '#1B4F72', '#D4A853'],
    },
    {
      mode: 'light',
      title: t('theme_light_premium'),
      description: t('theme_light_premium_description'),
      colors: ['#FFFFFF', '#087F86', '#DDE8F3'],
    },
    {
      mode: 'nature',
      title: t('theme_nature'),
      description: t('theme_nature_description'),
      colors: ['#0E1914', '#58B887', '#D1B778'],
    },
    {
      mode: 'rose',
      title: t('theme_rose'),
      description: t('theme_rose_description'),
      colors: ['#171321', '#C08AF5', '#F09AC5'],
    },
  ];

  return (
    <>
      <ScrollView
        style={[
          styles.container,
          theme === 'dark' && styles.containerDark,
          { backgroundColor: theme === 'light' ? '#F0F2F5' : themeColors.background },
        ]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        <Animated.View
          style={[
            styles.profilePremiumCard,
            {
              opacity: fadeAnim,
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              }],
            },
          ]}
        >
          <ImageBackground
            source={require('../../assets/branding/hero-case-chaume.jpg')}
            style={styles.profileCover}
            imageStyle={styles.profileCoverImage}
          >
            <View style={styles.profileCoverOverlay}>
              <TouchableOpacity
                style={styles.profileCoverBrand}
                onPress={handleSecretTap}
                activeOpacity={0.75}
                hitSlop={10}
              >
                <View style={styles.profileCoverBrandMark}>
                  <Ionicons name="home" size={16} color={themeColors.onGold} />
                </View>
                <Text style={styles.profileCoverBrandText}>ImoPrestige</Text>
              </TouchableOpacity>
              <Text style={styles.profileCoverSubtitle}>{t('profile_header_subtitle')}</Text>
            </View>
          </ImageBackground>

          <View style={styles.profileIdentity}>
            <View style={styles.profileAvatarLarge}>
              {currentUser.avatarUrl ? (
                <Image source={{ uri: currentUser.avatarUrl }} style={styles.profileAvatarImage} />
              ) : (
                <Text style={styles.profileAvatarText}>{profileInitials}</Text>
              )}
              {accountVerified && (
                <View style={styles.profileAvatarVerified}>
                  <Ionicons name="checkmark" size={12} color={themeColors.white} />
                </View>
              )}
            </View>
            <View style={styles.profileIdentityCopy}>
              <View style={styles.profileNameLine}>
                <Text style={styles.profileUserName} numberOfLines={1}>
                  {currentUser.name || t('profile_personal_space')}
                </Text>
                {accountVerified && (
                  <View style={styles.profileVerifiedBadge}>
                    <Ionicons name="shield-checkmark" size={13} color={themeColors.success} />
                    <Text style={styles.profileVerifiedText}>{t('profile_verified_badge')}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.profileUserEmail} numberOfLines={1}>{currentUser.email}</Text>
              <View style={styles.profileRoleBadge}>
                <Ionicons
                  name={isAgent ? 'briefcase-outline' : 'person-outline'}
                  size={13}
                  color={themeColors.primary}
                />
                <Text style={styles.profileRoleText}>{t(profileRoleKey)}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.profileEditButton}
            onPress={() => setIsEditingProfile(true)}
            accessibilityRole="button"
            activeOpacity={0.78}
          >
            <Ionicons name="create-outline" size={17} color={themeColors.onBrand} />
            <Text style={styles.profileEditButtonText}>{t('profile_edit_action')}</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.profileStatGrid}>
          {profileStats.map(stat => (
            <TouchableOpacity
              key={stat.key}
              style={styles.profileStatCard}
              onPress={stat.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${stat.label}: ${stat.value}`}
              activeOpacity={0.78}
            >
              <View style={styles.profileStatTop}>
                <View style={styles.profileStatIcon}>
                  <Ionicons name={stat.icon} size={18} color={themeColors.primary} />
                </View>
                <Ionicons name="arrow-up-outline" size={15} color={themeColors.onSurfaceSoft} />
              </View>
              <Text style={styles.profileStatValue}>{stat.value}</Text>
              <Text style={styles.profileStatLabel} numberOfLines={1}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Animated.View style={[styles.section, styles.profileMenuSection, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>{t('profile_quick_access')}</Text>
          <Text style={styles.profileMenuSubtitle}>{t('profile_quick_access_description')}</Text>
          <View style={styles.profileMenuList}>
            {profileMenuItems.map(item => (
              <TouchableOpacity
                key={item.key}
                style={styles.profileMenuRow}
                onPress={item.onPress}
                accessibilityRole="button"
                activeOpacity={0.72}
              >
                <View style={styles.profileMenuIcon}>
                  <Ionicons name={item.icon} size={19} color={themeColors.primary} />
                </View>
                <View style={styles.profileMenuCopy}>
                  <Text style={styles.profileMenuTitle}>{item.label}</Text>
                  <Text style={styles.profileMenuDescription} numberOfLines={1}>
                    {item.description}
                  </Text>
                </View>
                {'count' in item && item.count !== undefined && (
                  <Text style={styles.profileMenuCount}>{item.count}</Text>
                )}
                <Ionicons name="chevron-forward" size={18} color={themeColors.onSurfaceSoft} />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {canRequestAgentAccess && (
          <View style={[styles.agentAccessCard, theme === 'dark' && styles.agentAccessCardDark]}>
            <View style={styles.agentAccessTop}>
              <View style={styles.agentAccessIcon}>
                <Ionicons name="briefcase" size={19} color={themeColors.onSurfaceMuted} />
              </View>
              <View style={styles.agentAccessCopy}>
                <Text style={[styles.agentAccessTitle, theme === 'dark' && styles.textLight]}>
                  {currentUser.agentStatus === 'pending'
                    ? t('profile_agent_pending_title')
                    : currentUser.agentStatus === 'rejected'
                      ? t('profile_agent_rejected_title')
                      : t('profile_agent_access_title')}
                </Text>
                <Text style={[styles.agentAccessSubtitle, theme === 'dark' && styles.textMutedDark]}>
                  {currentUser.agentStatus === 'pending'
                    ? t('profile_agent_pending_subtitle')
                    : currentUser.agentStatus === 'rejected'
                      ? currentUser.agentRejectionReason || t('profile_agent_rejected_subtitle')
                      : t('profile_agent_access_subtitle')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.agentAccessButton}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Publish' })}
              accessibilityRole="button"
            >
              <Text style={styles.agentAccessButtonText}>
                {currentUser.agentStatus === 'pending'
                  ? t('profile_agent_pending_button')
                  : currentUser.agentStatus === 'rejected'
                    ? t('profile_agent_reapply_button')
                    : t('profile_agent_apply_button')}
              </Text>
              <Ionicons name="arrow-forward" size={17} color={themeColors.onSurfaceMuted} />
            </TouchableOpacity>
          </View>
        )}

        {isAgent && currentUser && false && (
          <View style={[styles.agentDashboard, theme === 'dark' && styles.agentDashboardDark, { backgroundColor: themeColors.primaryContainer }]}>
            <View style={styles.agentDashboardHeader}>
              <View style={styles.agentDashboardHeading}>
                <View style={styles.agentDashboardIcon}>
                  <Ionicons name="briefcase" size={17} color={themeColors.onSurfaceMuted} />
                </View>
                <View style={styles.agentDashboardTitleWrap}>
                  <Text style={[styles.agentGreeting, theme === 'dark' && styles.textLight]}>
                    {t('profile_agent_greeting')} {currentUser?.name.split(' ')[0] ?? ''}
                  </Text>
                  <Text style={[styles.agentDashboardSubtitle, theme === 'dark' && styles.textMutedDark]}>
                    {t('profile_agent_dashboard')}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.agentApprovedBadge,
                  !currentUser?.verified && styles.agentUnverifiedBadge,
                ]}
              >
                <Ionicons
                  name={currentUser?.verified ? 'checkmark-circle' : 'alert-circle'}
                  size={14}
                  color={currentUser?.verified ? themeColors.success : themeColors.warning}
                />
                <Text
                  style={[
                    styles.agentApprovedText,
                    !currentUser?.verified && styles.agentUnverifiedText,
                  ]}
                >
                  {currentUser?.verified ? t('profile_agent_approved') : t('profile_not_verified')}
                </Text>
              </View>
            </View>

            <View style={styles.agentStatsGrid}>
              {[
                {
                  key: 'active',
                  value: activeAgentListings,
                  label: t('profile_agent_active_listings'),
                  icon: 'home-outline' as const,
                  color: themeColors.primary,
                },
                {
                  key: 'views',
                  value: agentViews,
                  label: t('profile_agent_views'),
                  icon: 'eye-outline' as const,
                  color: themeColors.info,
                },
                {
                  key: 'messages',
                  value: unreadAgentMessages,
                  label: t('profile_agent_unread_messages'),
                  icon: 'chatbubble-ellipses-outline' as const,
                  color: themeColors.success,
                },
              ].map(stat => (
                <View
                  key={stat.key}
                  style={[styles.agentStatCard, theme === 'dark' && styles.agentStatCardDark]}
                >
                  <View style={[styles.agentStatIcon, { backgroundColor: `${stat.color}18` }]}>
                    <Ionicons name={stat.icon} size={17} color={stat.color} />
                  </View>
                  <Text style={[styles.agentStatValue, theme === 'dark' && styles.textLight]}>
                    {stat.value}
                  </Text>
                  <Text style={[styles.agentStatLabel, theme === 'dark' && styles.textMutedDark]}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>

            <Animated.View style={[styles.agentProgressCard, { backgroundColor: themeColors.primaryContainer }, { opacity: fadeAnim }]}>
              <View style={styles.agentListingsHeader}>
                <Text style={[styles.agentTodayTitle, theme === 'dark' && styles.textLight]}>
                  {t('profile_agent_setup')}
                </Text>
                <Text style={styles.agentProgressCount}>
                  {completedAgentSetupSteps}/{agentSetupSteps.length}
                </Text>
              </View>
              <View style={styles.agentProgressTrack}>
                <View
                  style={[
                    styles.agentProgressFill,
                    { width: `${(completedAgentSetupSteps / agentSetupSteps.length) * 100}%` },
                  ]}
                />
              </View>
              {agentSetupSteps.map(step => (
                <View key={step.label} style={styles.agentSetupStep}>
                  <View
                    style={[
                      styles.agentSetupStepIcon,
                      step.done && styles.agentSetupStepIconDone,
                    ]}
                  >
                    <Ionicons
                      name={step.done ? 'checkmark' : 'ellipse-outline'}
                      size={13}
                      color={step.done ? themeColors.onSuccessContainer : themeColors.onSurfaceMuted}
                    />
                  </View>
                  <Text
                    style={[
                      styles.agentTodoText,
                      theme === 'dark' && styles.textMutedDark,
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              ))}
            </Animated.View>

            <View style={styles.agentActions}>
              <TouchableOpacity
                style={styles.agentPrimaryAction}
                onPress={() => navigation.navigate('Publish')}
                accessibilityRole="button"
              >
                <Ionicons name="add" size={18} color={themeColors.onSurfaceMuted} />
                <Text style={styles.agentPrimaryActionText}>{t('profile_agent_publish')}</Text>
              </TouchableOpacity>
              <View style={styles.agentSecondaryActions}>
                <TouchableOpacity
                  style={[styles.agentSecondaryAction, theme === 'dark' && styles.agentSecondaryActionDark]}
                  onPress={() => navigation.navigate('MainTabs', { screen: 'Publish' })}
                  accessibilityRole="button"
                >
                  <Ionicons name="list-outline" size={16} color={theme === 'dark' ? themeColors.onSurfaceMuted : themeColors.primary} />
                  <Text style={[styles.agentSecondaryActionText, theme === 'dark' && styles.agentSecondaryActionTextDark]}>
                    {t('profile_agent_manage_listings')}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={theme === 'dark' ? themeColors.onSurfaceMuted : themeColors.onSurfaceMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.agentSecondaryAction, theme === 'dark' && styles.agentSecondaryActionDark]}
                  onPress={() => navigation.navigate('MainTabs', { screen: 'Messages' })}
                  accessibilityRole="button"
                >
                  <Ionicons name="chatbubbles-outline" size={16} color={theme === 'dark' ? themeColors.onSurfaceMuted : themeColors.primary} />
                  <Text style={[styles.agentSecondaryActionText, theme === 'dark' && styles.agentSecondaryActionTextDark]}>
                    {t('profile_agent_open_messages')}
                  </Text>
                  {unreadAgentMessages > 0 && (
                    <View style={styles.agentUnreadBadge}>
                      <Text style={styles.agentUnreadBadgeText}>{unreadAgentMessages}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={15} color={theme === 'dark' ? themeColors.onSurfaceMuted : themeColors.onSurfaceMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.agentTodaySection}>
              <Text style={[styles.agentTodayTitle, theme === 'dark' && styles.textLight]}>
                {t('profile_agent_today')}
              </Text>
              {!agentProfileComplete && (
                <View style={styles.agentTodoRow}>
                  <Ionicons name="person-circle-outline" size={19} color={themeColors.warning} />
                  <Text style={[styles.agentTodoText, theme === 'dark' && styles.textMutedDark]}>
                    {t('profile_agent_complete_profile')}
                  </Text>
                </View>
              )}
              {unreadAgentMessages > 0 && (
                <TouchableOpacity
                  style={styles.agentTodoRow}
                  onPress={() => navigation.navigate('MainTabs', { screen: 'Messages' })}
                  accessibilityRole="button"
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={19} color={themeColors.primary} />
                  <Text style={[styles.agentTodoText, theme === 'dark' && styles.textMutedDark]}>
                    {t('profile_agent_reply_to_prospect')}
                  </Text>
                  <Ionicons name="chevron-forward" size={17} color={themeColors.onSurfaceMuted} />
                </TouchableOpacity>
              )}
              {agentListingsByStatus.rejected.map(property => (
                <TouchableOpacity
                  key={`rejected-${property.id}`}
                  style={styles.agentTodoRow}
                  onPress={() => navigation.navigate('Publish', { propertyId: property.id })}
                  accessibilityRole="button"
                >
                  <Ionicons name="alert-circle-outline" size={19} color={themeColors.danger} />
                  <Text style={[styles.agentTodoText, theme === 'dark' && styles.textMutedDark]}>
                    {t('profile_agent_fix_rejected')}: {property.title}
                  </Text>
                  <Ionicons name="chevron-forward" size={17} color={themeColors.onSurfaceMuted} />
                </TouchableOpacity>
              ))}
              {agentProperties
                .filter(property => isExpiringSoon(property.expiresAt))
                .map(property => (
                  <TouchableOpacity
                    key={`expiring-${property.id}`}
                    style={styles.agentTodoRow}
                    onPress={() => navigation.navigate('Publish', { propertyId: property.id })}
                    accessibilityRole="button"
                  >
                    <Ionicons name="time-outline" size={19} color={themeColors.warning} />
                    <Text style={[styles.agentTodoText, theme === 'dark' && styles.textMutedDark]}>
                      {t('profile_agent_renew_listing')}: {property.title}
                    </Text>
                    <Ionicons name="chevron-forward" size={17} color={themeColors.onSurfaceMuted} />
                  </TouchableOpacity>
                ))}
              {agentProfileComplete && unreadAgentMessages === 0 &&
                agentListingsByStatus.rejected.length === 0 &&
                !agentProperties.some(property => isExpiringSoon(property.expiresAt)) && (
                  <Text style={[styles.agentTodoText, theme === 'dark' && styles.textMutedDark]}>
                    {t('profile_agent_all_caught_up')}
                  </Text>
                )}
            </View>

            <Animated.View style={[styles.agentListingsSection, { backgroundColor: themeColors.primaryContainer }, { opacity: fadeAnim }]}>
              <View style={styles.agentListingsHeader}>
                <Text style={[styles.agentTodayTitle, theme === 'dark' && styles.textLight]}>
                  {t('profile_agent_manage_listings')}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Publish')}
                  accessibilityRole="button"
                >
                  <Text style={styles.agentSeeAll}>{t('profile_agent_publish')}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.agentStatusTabs}
              >
                {([
                  ['pending', t('profile_agent_pending_listings')],
                  ['published', t('profile_agent_published')],
                  ['rejected', t('profile_agent_rejected')],
                  ['completed', t('profile_agent_completed')],
                ] as const).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.agentStatusTab,
                      agentListingFilter === key && styles.agentStatusTabActive,
                    ]}
                    onPress={() => setAgentListingFilter(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: agentListingFilter === key }}
                  >
                    <Text
                      style={[
                        styles.agentStatusTabText,
                        agentListingFilter === key && styles.agentStatusTabTextActive,
                      ]}
                    >
                      {label} ({agentListingsByStatus[key].length})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {selectedAgentListings.length === 0 ? (
                <Text style={[styles.agentEmptyText, theme === 'dark' && styles.textMutedDark]}>
                  {t('profile_agent_no_listings')}
                </Text>
              ) : (
                selectedAgentListings.map(property => (
                  <View key={property.id} style={styles.agentListingRow}>
                    <TouchableOpacity
                      style={styles.agentListingMain}
                      onPress={() => navigation.navigate('PropertyDetail', { propertyId: property.id })}
                      accessibilityRole="button"
                    >
                      {property.images[0] ? (
                        <Image source={{ uri: property.images[0] }} style={styles.agentListingImage} />
                      ) : (
                        <View style={styles.agentListingImageFallback}>
                          <Ionicons name="home-outline" size={22} color={themeColors.onSurfaceMuted} />
                        </View>
                      )}
                      <View style={styles.agentListingCopy}>
                        <Text style={[styles.agentListingTitle, theme === 'dark' && styles.textLight]}>
                          {property.title}
                        </Text>
                        <Text style={[styles.agentListingPrice, theme === 'dark' && styles.textLight]}>
                          {formatPrice(property.price)}
                        </Text>
                        <Text style={[styles.agentListingMeta, theme === 'dark' && styles.textMutedDark]}>
                          {t('profile_agent_listing_views')}: {propertyStats[property.id]?.views ?? 0}
                          {'  ·  '}
                          {t('profile_agent_listing_contacts')}: {propertyStats[property.id]?.contacts ?? 0}
                        </Text>
                        {property.listingStatus === 'rejected' && property.rejectionReason ? (
                          <Text style={styles.agentListingRejection} numberOfLines={2}>
                            {property.rejectionReason}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.agentListingEdit}
                      onPress={() => navigation.navigate('Publish', { propertyId: property.id })}
                      accessibilityRole="button"
                      accessibilityLabel={t('profile_agent_edit_listing')}
                    >
                      <Ionicons name="create-outline" size={19} color={themeColors.primary} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </Animated.View>
          </View>
        )}

        {isAgent && (
          <TouchableOpacity
            style={[styles.agentWorkspaceLink, theme === 'dark' && styles.agentWorkspaceLinkDark]}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Agent' })}
            accessibilityRole="button"
          >
            <View style={styles.agentWorkspaceLinkIcon}>
              <Ionicons name="briefcase-outline" size={20} color={themeColors.primary} />
            </View>
            <View style={styles.agentWorkspaceLinkCopy}>
              <Text style={[styles.agentWorkspaceLinkTitle, theme === 'dark' && styles.textLight]}>
                {t('profile_agent_dashboard')}
              </Text>
              <Text style={[styles.agentWorkspaceLinkSub, theme === 'dark' && styles.textMutedDark]}>
                {t('profile_agent_manage_listings')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.onSurfaceMuted} />
          </TouchableOpacity>
        )}

        {/* Account Status */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>
            {currentUser.agentStatus === 'pending' || currentUser.agentStatus === 'rejected' || isAgent
              ? t('profile_agent_status')
              : t('profile_account_status')}
          </Text>
          <View style={[styles.statusCard, theme === 'dark' && styles.statusCardDark]}>
            <Ionicons
              name={
                isAgent || currentUser.agentStatus === 'pending'
                  ? 'time'
                  : currentUser.agentStatus === 'rejected'
                    ? 'close-circle'
                    : accountVerified
                      ? 'shield-checkmark'
                      : 'alert-circle'
              }
              size={22}
              color={
                isAgent
                  ? themeColors.accent
                  : currentUser.agentStatus === 'rejected'
                    ? themeColors.danger
                    : currentUser.agentStatus === 'pending' || !accountVerified
                      ? themeColors.gold
                      : themeColors.accent
              }
            />
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, theme === 'dark' && styles.statusTitleDark]}>
                {isAgent
                  ? t('profile_agent_approved')
                  : currentUser.agentStatus === 'pending'
                    ? t('listing_agent_access_pending')
                    : currentUser.agentStatus === 'rejected'
                      ? t('listing_agent_access_rejected')
                      : accountVerified
                        ? t('profile_verified')
                        : t('profile_not_verified')}
              </Text>
              <Text style={[styles.statusSubtitle, theme === 'dark' && styles.statusSubtitleDark]}>
                {isAgent
                  ? t('profile_agent_approved_subtitle')
                  : currentUser.agentStatus === 'pending'
                    ? t('profile_agent_pending_subtitle')
                    : currentUser.agentStatus === 'rejected'
                      ? currentUser.agentRejectionReason || t('profile_agent_rejected_subtitle')
                      : accountVerified
                        ? t('profile_verified_sub')
                        : t('profile_verify_admin')}
              </Text>
            </View>
          </View>
          {!isAgent && currentUser.agentStatus === 'rejected' && (
            <TouchableOpacity
              style={styles.agentStatusAction}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Publish' })}
              accessibilityRole="button"
            >
              <Text style={styles.agentStatusActionText}>{t('profile_agent_request_again')}</Text>
              <Ionicons name="chevron-forward" size={16} color={themeColors.primary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.section, theme === 'dark' && styles.sectionDark, styles.activityAccordion]}>
          <TouchableOpacity
            style={styles.activityAccordionHeader}
            onPress={() => setExpandedActivitySection(
              expandedActivitySection === 'favorites' ? null : 'favorites'
            )}
            accessibilityRole="button"
            accessibilityState={{ expanded: expandedActivitySection === 'favorites' }}
          >
            <View style={styles.activityAccordionTitle}>
              <View style={styles.activityAccordionIcon}>
                <Ionicons name="heart-outline" size={18} color={themeColors.primary} />
              </View>
              <Text style={[styles.activityAccordionText, theme === 'dark' && styles.sectionTitleDark]}>
                {t('favorites')}
              </Text>
            </View>
            <View style={styles.activityAccordionTrailing}>
              <Text style={styles.activityAccordionCount}>{favoriteProperties.length}</Text>
              <Ionicons
                name={expandedActivitySection === 'favorites' ? 'chevron-up' : 'chevron-down'}
                size={19}
                color={themeColors.onSurfaceMuted}
              />
            </View>
          </TouchableOpacity>
          {expandedActivitySection === 'favorites' && (
            <View style={styles.activityAccordionContent}>
              {favoriteProperties.length === 0 ? (
                <View style={styles.profileFavoritesEmpty}>
                  <View style={styles.profileFavoritesEmptyIcon}>
                    <Ionicons name="heart-outline" size={22} color={themeColors.primary} />
                  </View>
                  <Text style={styles.profileFavoritesEmptyTitle}>{t('profile_favorites_empty_title')}</Text>
                  <Text style={styles.profileFavoritesEmptyDescription}>
                    {t('profile_favorites_empty_description')}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cardRow}
                >
                  {favoriteProperties.map(property => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      onPress={() => InteractionManager.runAfterInteractions(
                        () => navigation.navigate('PropertyDetail', { propertyId: property.id })
                      )}
                      compact
                    />
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        <View style={[styles.section, theme === 'dark' && styles.sectionDark, styles.activityAccordion]}>
          <TouchableOpacity
            style={styles.activityAccordionHeader}
            onPress={() => setExpandedActivitySection(
              expandedActivitySection === 'savedSearches' ? null : 'savedSearches'
            )}
            accessibilityRole="button"
            accessibilityState={{ expanded: expandedActivitySection === 'savedSearches' }}
          >
            <View style={styles.activityAccordionTitle}>
              <View style={styles.activityAccordionIcon}>
                <Ionicons name="bookmark-outline" size={18} color={themeColors.primary} />
              </View>
              <Text style={[styles.activityAccordionText, theme === 'dark' && styles.sectionTitleDark]}>
                {t('saved_searches')}
              </Text>
            </View>
            <View style={styles.activityAccordionTrailing}>
              <Text style={styles.activityAccordionCount}>{savedSearches.length}</Text>
              <Ionicons
                name={expandedActivitySection === 'savedSearches' ? 'chevron-up' : 'chevron-down'}
                size={19}
                color={themeColors.onSurfaceMuted}
              />
            </View>
          </TouchableOpacity>
          {expandedActivitySection === 'savedSearches' && (
            <View style={styles.activityAccordionContent}>
              {savedSearches.length === 0 ? (
                <Text style={[styles.emptyText, theme === 'dark' && styles.textMutedDark]}>{t('no_saved_search')}</Text>
              ) : (
                savedSearches.map(saved => (
                  <View key={saved.id} style={[styles.savedSearchRow, theme === 'dark' && styles.savedSearchRowDark]}>
                    <View style={styles.savedSearchInfo}>
                      <Text style={[styles.savedSearchLabel, theme === 'dark' && styles.textLight]}>{saved.label}</Text>
                      <Text style={[styles.savedSearchMeta, theme === 'dark' && styles.textMutedDark]}>
                        {t('type_label')}: {saved.type === 'ALL' ? t('all_types') : tType(saved.type)}
                      </Text>
                    </View>
                    <View style={styles.savedSearchActions}>
                      <TouchableOpacity
                        style={styles.savedSearchApply}
                        onPress={() => applySavedSearch(saved.id)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('saved_search_apply')}: ${saved.label}`}
                      >
                        <Ionicons name="arrow-forward" size={16} color={themeColors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.savedSearchDelete}
                        onPress={() => removeSavedSearch(saved.id)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('saved_search_delete')}: ${saved.label}`}
                      >
                        <Ionicons name="trash" size={16} color={themeColors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        <View style={[styles.section, theme === 'dark' && styles.sectionDark, styles.activityAccordion]}>
          <TouchableOpacity
            style={styles.activityAccordionHeader}
            onPress={() => setExpandedActivitySection(
              expandedActivitySection === 'searchHistory' ? null : 'searchHistory'
            )}
            accessibilityRole="button"
            accessibilityState={{ expanded: expandedActivitySection === 'searchHistory' }}
          >
            <View style={styles.activityAccordionTitle}>
              <View style={styles.activityAccordionIcon}>
                <Ionicons name="time-outline" size={18} color={themeColors.primary} />
              </View>
              <Text style={[styles.activityAccordionText, theme === 'dark' && styles.sectionTitleDark]}>
                {t('profile_search_history')}
              </Text>
            </View>
            <View style={styles.activityAccordionTrailing}>
              <Text style={styles.activityAccordionCount}>{searchHistory.length}</Text>
              <Ionicons
                name={expandedActivitySection === 'searchHistory' ? 'chevron-up' : 'chevron-down'}
                size={19}
                color={themeColors.onSurfaceMuted}
              />
            </View>
          </TouchableOpacity>
          {expandedActivitySection === 'searchHistory' && (
            <View style={styles.activityAccordionContent}>
              {searchHistory.length > 0 && (
                <TouchableOpacity
                  style={styles.clearHistoryButton}
                  onPress={clearSearchHistory}
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={15} color={themeColors.danger} />
                  <Text style={styles.clearText}>{t('profile_clear_history')}</Text>
                </TouchableOpacity>
              )}
              {searchHistory.length === 0 ? (
                <Text style={[styles.emptyText, theme === 'dark' && styles.textMutedDark]}>{t('profile_no_history')}</Text>
              ) : (
                searchHistory.map((query, index) => (
                  <TouchableOpacity
                    key={`${query}-${index}`}
                    style={[styles.historyRow, theme === 'dark' && styles.historyRowDark]}
                    onPress={() => applySearchHistory(query)}
                  >
                    <Text style={[styles.historyText, theme === 'dark' && styles.textLight]}>{query}</Text>
                    <Ionicons name="arrow-forward" size={16} color={themeColors.primary} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        <View style={[styles.section, theme === 'dark' && styles.sectionDark, styles.activityAccordion]}>
          <TouchableOpacity
            style={styles.activityAccordionHeader}
            onPress={() => setExpandedActivitySection(
              expandedActivitySection === 'recentViews' ? null : 'recentViews'
            )}
            accessibilityRole="button"
            accessibilityState={{ expanded: expandedActivitySection === 'recentViews' }}
          >
            <View style={styles.activityAccordionTitle}>
              <View style={styles.activityAccordionIcon}>
                <Ionicons name="eye-outline" size={18} color={themeColors.primary} />
              </View>
              <Text style={[styles.activityAccordionText, theme === 'dark' && styles.sectionTitleDark]}>
                {t('profile_recent_views')}
              </Text>
            </View>
            <View style={styles.activityAccordionTrailing}>
              <Text style={styles.activityAccordionCount}>{recentViewedProperties.length}</Text>
              <Ionicons
                name={expandedActivitySection === 'recentViews' ? 'chevron-up' : 'chevron-down'}
                size={19}
                color={themeColors.onSurfaceMuted}
              />
            </View>
          </TouchableOpacity>
          {expandedActivitySection === 'recentViews' && (
            <View style={styles.activityAccordionContent}>
              {recentViewedProperties.length === 0 ? (
                <Text style={[styles.emptyText, theme === 'dark' && styles.textMutedDark]}>{t('profile_no_recent')}</Text>
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
          )}
        </View>

        {/* About Section */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>{t('about')}</Text>
          <Text style={[styles.aboutText, theme === 'dark' && styles.textMutedDark]}>
            {t('about_text')}
          </Text>
        </View>

        {/* Legal Section - Required for Google Play */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>{t('legal')}</Text>

          <TouchableOpacity
            style={[styles.legalItem, theme === 'dark' && styles.legalItemDark]}
            onPress={() => setLegalModal('privacy')}
          >
            <Ionicons name="shield-checkmark" size={20} color={themeColors.primary} />
            <Text style={[styles.legalText, theme === 'dark' && styles.textLight]}>{t('privacy')}</Text>
            <Ionicons name="chevron-forward" size={20} color={themeColors.onSurfaceMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.legalItem, theme === 'dark' && styles.legalItemDark]}
            onPress={() => setLegalModal('terms')}
          >
            <Ionicons name="document-text" size={20} color={themeColors.primary} />
            <Text style={[styles.legalText, theme === 'dark' && styles.textLight]}>{t('terms')}</Text>
            <Ionicons name="chevron-forward" size={20} color={themeColors.onSurfaceMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={logoutLoading}
          onPress={handleLogoutPress}
          accessibilityRole="button"
        >
          <Ionicons name="log-out" size={18} color={themeColors.danger} />
          <Text style={styles.logoutText}>
            {logoutLoading ? t('profile_logging_out') : t('profile_logout')}
          </Text>
          {logoutLoading && <ActivityIndicator size="small" color={themeColors.danger} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteAccountButton, styles.deleteAccountButtonBottom]}
          onPress={handleAccountDeletionRequest}
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={17} color={themeColors.danger} />
          <Text style={styles.deleteAccountText}>{t('profile_delete_account')}</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, theme === 'dark' && styles.footerTextDark]}>
            {t('footer_rights')}
          </Text>
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

      <Modal
        visible={isEditingProfile}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditingProfile(false)}
      >
        <KeyboardAvoidingView
          style={styles.profileModalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.profileModalCard, { marginTop: insets.top + 16, marginBottom: insets.bottom + 16 }]}>
            <View style={styles.profileModalHeader}>
              <View style={styles.profileModalHeading}>
                <Text style={styles.profileModalTitle}>{t('profile_edit_title')}</Text>
                <Text style={styles.profileModalSubtitle}>{t('profile_menu_account_description')}</Text>
              </View>
              <TouchableOpacity
                style={styles.profileModalClose}
                onPress={() => setIsEditingProfile(false)}
                accessibilityRole="button"
                accessibilityLabel={t('profile_cancel_action')}
              >
                <Ionicons name="close" size={21} color={themeColors.onSurface} />
              </TouchableOpacity>
            </View>
            <Text style={styles.profileEditLabel}>{t('profile_edit_name_label')}</Text>
            <TextInput
              style={styles.profileEditInput}
              value={profileName}
              onChangeText={setProfileName}
              autoCapitalize="words"
              accessibilityLabel={t('profile_edit_name_label')}
            />
            <Text style={styles.profileEditLabel}>{t('profile_edit_phone_label')}</Text>
            <TextInput
              style={styles.profileEditInput}
              value={profilePhone}
              onChangeText={setProfilePhone}
              keyboardType="phone-pad"
              accessibilityLabel={t('profile_edit_phone_label')}
            />
            <View style={styles.profileModalActions}>
              <TouchableOpacity
                style={styles.profileModalCancel}
                onPress={() => setIsEditingProfile(false)}
                disabled={profileSaving}
                accessibilityRole="button"
              >
                <Text style={styles.profileModalCancelText}>{t('profile_cancel_action')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.profileModalSave}
                onPress={() => void handleProfileSave()}
                disabled={profileSaving}
                accessibilityRole="button"
              >
                {profileSaving
                  ? <ActivityIndicator size="small" color={themeColors.onBrand} />
                  : <Ionicons name="checkmark" size={18} color={themeColors.onBrand} />}
                <Text style={styles.profileModalSaveText}>
                  {profileSaving ? t('profile_please_wait') : t('profile_save_action')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={themePreview !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setThemePreview(null)}
      >
        <View style={styles.profileModalBackdrop}>
          <View style={[styles.profileModalCard, styles.profileThemeModal]}>
            <View style={styles.profileModalHeader}>
              <View style={styles.profileModalHeading}>
                <Text style={styles.profileModalTitle}>{t('profile_theme_preview_title')}</Text>
                <Text style={styles.profileModalSubtitle}>{t('profile_theme_preview_description')}</Text>
              </View>
              <TouchableOpacity
                style={styles.profileModalClose}
                onPress={() => setThemePreview(null)}
                accessibilityRole="button"
                accessibilityLabel={t('profile_cancel_action')}
              >
                <Ionicons name="close" size={21} color={themeColors.onSurface} />
              </TouchableOpacity>
            </View>
            <View style={styles.profileThemeOptions}>
              {themeOptions.map(option => (
                <TouchableOpacity
                  key={option.mode}
                  style={[
                    styles.profileThemeOption,
                    themePreview === option.mode && styles.profileThemeOptionSelected,
                  ]}
                  onPress={() => setThemePreview(option.mode)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: themePreview === option.mode }}
                >
                  <View style={styles.profileThemeSwatches}>
                    {option.colors.map(color => (
                      <View key={color} style={[styles.profileThemeSwatch, { backgroundColor: color }]} />
                    ))}
                  </View>
                  <View style={styles.profileThemeOptionCopy}>
                    <Text style={styles.profileThemeOptionTitle}>{option.title}</Text>
                    <Text style={styles.profileThemeOptionDescription}>{option.description}</Text>
                  </View>
                  {themePreview === option.mode && (
                    <Ionicons name="checkmark-circle" size={20} color={themeColors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {themePreview && (
              <View
                style={[
                  styles.profileThemeSample,
                  { backgroundColor: THEME_PALETTES[themePreview].background, borderColor: THEME_PALETTES[themePreview].border },
                ]}
              >
                <View style={[styles.profileThemeSampleMark, { backgroundColor: THEME_PALETTES[themePreview].primaryContainer }]}>
                  <Ionicons name="home" size={17} color={THEME_PALETTES[themePreview].primary} />
                </View>
                <View style={styles.profileThemeSampleCopy}>
                  <Text style={[styles.profileThemeSampleTitle, { color: THEME_PALETTES[themePreview].onSurface }]}>
                    ImoPrestige
                  </Text>
                  <Text style={[styles.profileThemeSampleSubtitle, { color: THEME_PALETTES[themePreview].onSurfaceMuted }]}>
                    {t('profile_theme_selected')}
                  </Text>
                </View>
                <View style={[styles.profileThemeSampleButton, { backgroundColor: THEME_PALETTES[themePreview].primary }]}>
                  <Ionicons name="checkmark" size={15} color={THEME_PALETTES[themePreview].onBrand} />
                </View>
              </View>
            )}
            <View style={styles.profileModalActions}>
              <TouchableOpacity
                style={styles.profileModalCancel}
                onPress={() => setThemePreview(null)}
                accessibilityRole="button"
              >
                <Text style={styles.profileModalCancelText}>{t('profile_cancel_action')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.profileModalSave}
                onPress={() => {
                  if (themePreview) setTheme(themePreview);
                  setThemePreview(null);
                }}
                accessibilityRole="button"
              >
                <Ionicons name="color-palette-outline" size={17} color={themeColors.onBrand} />
                <Text style={styles.profileModalSaveText}>{t('profile_theme_apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  containerDark: {
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 32,
  },
  authContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 28,
    backgroundColor: COLORS.background,
  },
  authHero: {
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  authBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 12,
  },
  authLogo: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  authLogoText: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  authBrandCopy: {
    flex: 1,
  },
  authWelcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: 28,
  },
  authWelcomeIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryContainer,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  authWelcomeCopy: {
    flex: 1,
  },
  authWelcomeSubtitle: {
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  authTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  authSubtitle: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    marginTop: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    padding: 18,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  profilePremiumCard: {
    overflow: 'hidden',
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  profileCover: {
    height: 146,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.premiumDarkBlue,
  },
  profileCoverImage: {
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
  },
  profileCoverOverlay: {
    minHeight: 146,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: COLORS.overlayNavy70,
  },
  profileCoverBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileCoverBrandMark: {
    width: 29,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: COLORS.gold,
  },
  profileCoverBrandText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  profileCoverSubtitle: {
    marginTop: 7,
    color: COLORS.overlayWhite90,
    fontSize: 12,
    fontWeight: '600',
  },
  profileIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 10,
  },
  profileAvatarLarge: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderRadius: 33,
    borderWidth: 3,
    borderColor: COLORS.gold,
    backgroundColor: COLORS.primaryContainer,
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 33,
  },
  profileIdentityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  profileNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  profileVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLORS.successContainer,
  },
  profileVerifiedText: {
    color: COLORS.onSuccessContainer,
    fontSize: 10,
    fontWeight: '700',
  },
  profileIdentityDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.onSurfaceSoft,
  },
  profileRegionText: {
    color: COLORS.onSurfaceMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  profileEditButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 15,
    borderRadius: 13,
    backgroundColor: COLORS.brand,
  },
  profileEditButtonText: {
    color: COLORS.onBrand,
    fontSize: 13,
    fontWeight: '800',
  },
  profileStatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 13,
  },
  profileStatCard: {
    width: '48%',
    minHeight: 104,
    justifyContent: 'space-between',
    padding: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 8,
    elevation: 1,
  },
  profileStatTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileStatIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: COLORS.primaryContainer,
  },
  profileStatValue: {
    marginTop: 8,
    color: COLORS.onSurface,
    fontSize: 21,
    fontWeight: '800',
  },
  profileStatLabel: {
    marginTop: 2,
    color: COLORS.onSurfaceMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  profileMenuSection: {
    paddingTop: 16,
    paddingBottom: 5,
  },
  profileMenuSubtitle: {
    marginTop: -8,
    marginBottom: 6,
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
  },
  profileMenuList: {
    marginTop: 3,
  },
  profileMenuRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  profileMenuIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: COLORS.surfaceAlt,
  },
  profileMenuCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  profileMenuTitle: {
    color: COLORS.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  profileMenuDescription: {
    color: COLORS.onSurfaceMuted,
    fontSize: 11,
  },
  profileMenuCount: {
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: COLORS.primaryContainer,
    color: COLORS.onPrimaryContainer,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
  },
  profileFavoritesEmpty: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  profileFavoritesEmptyIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: COLORS.primaryContainer,
  },
  profileFavoritesEmptyTitle: {
    marginTop: 9,
    color: COLORS.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  profileFavoritesEmptyDescription: {
    marginTop: 4,
    color: COLORS.onSurfaceMuted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  profileModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: COLORS.scrimStrong,
  },
  profileModalCard: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: 19,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  profileModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  profileModalHeading: {
    flex: 1,
    gap: 4,
  },
  profileModalTitle: {
    color: COLORS.onSurface,
    fontSize: 18,
    fontWeight: '800',
  },
  profileModalSubtitle: {
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  profileModalClose: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: COLORS.surfaceAlt,
  },
  profileEditLabel: {
    marginBottom: 6,
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  profileEditInput: {
    minHeight: 48,
    marginBottom: 14,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.onSurface,
    fontSize: 14,
  },
  profileModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  profileModalCancel: {
    minHeight: 46,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
  },
  profileModalCancelText: {
    color: COLORS.onSurface,
    fontSize: 12,
    fontWeight: '700',
  },
  profileModalSave: {
    minHeight: 46,
    minWidth: 130,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
  },
  profileModalSaveText: {
    color: COLORS.onBrand,
    fontSize: 12,
    fontWeight: '800',
  },
  profileThemeModal: {
    maxHeight: '90%',
  },
  profileThemeOptions: {
    gap: 7,
  },
  profileThemeOption: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
  },
  profileThemeOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryContainer,
  },
  profileThemeSwatches: {
    flexDirection: 'row',
    width: 52,
  },
  profileThemeSwatch: {
    width: 22,
    height: 22,
    marginRight: -5,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  profileThemeOptionCopy: {
    flex: 1,
    gap: 3,
  },
  profileThemeOptionTitle: {
    color: COLORS.onSurface,
    fontSize: 12,
    fontWeight: '700',
  },
  profileThemeOptionDescription: {
    color: COLORS.onSurfaceMuted,
    fontSize: 10,
  },
  profileThemeSample: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 13,
    padding: 11,
    borderWidth: 1,
    borderRadius: 14,
  },
  profileThemeSampleMark: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  profileThemeSampleCopy: {
    flex: 1,
  },
  profileThemeSampleTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  profileThemeSampleSubtitle: {
    marginTop: 3,
    fontSize: 10,
  },
  profileThemeSampleButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  profileAvatar: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: COLORS.primaryContainer,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  profileAvatarText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  profileAvatarVerified: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  profileUserDetails: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  profileUserName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  profileUserEmail: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
  },
  profileRoleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryContainer,
  },
  profileRoleText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  profileHeaderAction: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryContainer,
  },
  profileHeroCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    zIndex: 1,
  },
  profileHeroMetric: {
    flex: 1,
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
    borderRadius: RADIUS.lg,
  },
  profileHeroIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  profileHeroValue: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.onSurface,
  },
  profileHeroLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    color: COLORS.onSurfaceMuted,
    textAlign: 'center',
    minHeight: 26,
  },
  profileHeroDivider: {
    width: 1,
    alignSelf: 'center',
    height: '58%',
    backgroundColor: COLORS.border,
  },
  profileBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  profileBrandCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileLogo: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileLogoText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: COLORS.primary,
  },
  profileHeading: {
    color: COLORS.onSurface,
    fontSize: 19,
    fontWeight: '800',
  },
  profileTagline: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    marginTop: 3,
  },
  textLight: {
    color: COLORS.onSurfaceMuted,
  },
  textMutedDark: {
    color: COLORS.onSurfaceMuted,
  },
  authCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginTop: -16,
    padding: SPACING.xxl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  authCardTitle: {
    ...typography.heroTitle,
    color: COLORS.onSurface,
    fontSize: 24,
    fontWeight: '800',
  },
  authCardSubtitle: {
    color: COLORS.onSurfaceMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    marginBottom: 18,
  },
  authTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 3,
    marginBottom: 22,
  },
  authTab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 9,
  },
  authTabActive: {
    backgroundColor: COLORS.brand,
  },
  authTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurfaceMuted,
  },
  authTabTextActive: {
    color: COLORS.white,
  },
  inputGroup: {
    marginBottom: 16,
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
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    marginBottom: 7,
    fontWeight: '700',
  },
  authInputRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  authInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.onSurface,
  },
  authButton: {
    marginTop: 8,
    backgroundColor: COLORS.brand,
    minHeight: 52,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 2,
  },
  authButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  authDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    marginBottom: 14,
  },
  authDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.surfaceAlt,
  },
  authDividerText: {
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
  },
  googleButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  googleButtonText: {
    color: COLORS.onSurfaceMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  authError: {
    fontSize: 12,
    color: COLORS.danger,
    marginBottom: 10,
    backgroundColor: COLORS.dangerContainer,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  authNotice: {
    fontSize: 12,
    color: COLORS.onSuccessContainer,
    marginBottom: 10,
    backgroundColor: COLORS.successContainer,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
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
    borderColor: COLORS.dangerContainer,
    backgroundColor: COLORS.dangerContainer,
  },
  deleteAccountButtonBottom: {
    marginTop: 8,
  },
  deleteAccountText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.dangerContainer,
    marginHorizontal: 16,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.dangerContainer,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
  agentDashboard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 17,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  agentWorkspaceLink: {
    marginHorizontal: 16,
    marginTop: 16,
    minHeight: 76,
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.primaryContainer,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  agentWorkspaceLinkDark: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
  },
  agentWorkspaceLinkIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentWorkspaceLinkCopy: { flex: 1 },
  agentWorkspaceLinkTitle: { fontSize: 15, fontWeight: '800', color: COLORS.onSurface },
  agentWorkspaceLinkSub: { marginTop: 3, fontSize: 12, color: COLORS.onSurfaceMuted },
  agentAccessCard: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.045,
    shadowRadius: 10,
    elevation: 2,
  },
  agentAccessCardDark: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  agentAccessTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  agentAccessIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brand,
  },
  agentAccessCopy: {
    flex: 1,
  },
  agentAccessTitle: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: '800',
  },
  agentAccessSubtitle: {
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  agentAccessButton: {
    minHeight: 44,
    marginTop: 12,
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  agentAccessButtonText: {
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  agentDashboardDark: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  agentDashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  agentDashboardHeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  agentDashboardIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentDashboardTitleWrap: {
    flex: 1,
  },
  agentDashboardTitle: {
    color: COLORS.onSurface,
    fontSize: 16,
    fontWeight: '800',
  },
  agentGreeting: {
    color: COLORS.onSurface,
    fontSize: 17,
    fontWeight: '800',
  },
  agentApprovedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.successContainer,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  agentApprovedText: {
    color: COLORS.onSuccessContainer,
    fontSize: 12,
    fontWeight: '800',
  },
  agentUnverifiedBadge: {
    backgroundColor: COLORS.warningContainer,
  },
  agentUnverifiedText: {
    color: COLORS.onWarningContainer,
  },
  agentDashboardSubtitle: {
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    marginTop: 3,
  },
  agentStatsGrid: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 14,
  },
  agentStatCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 11,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  agentStatCardDark: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  agentStatIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  agentStatValue: {
    color: COLORS.onSurfaceMuted,
    fontSize: 21,
    fontWeight: '800',
  },
  agentStatLabel: {
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  agentProgressCard: {
    marginTop: 14,
    padding: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  agentProgressCount: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  agentProgressTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: COLORS.surfaceMuted,
    marginTop: 10,
    marginBottom: 6,
  },
  agentProgressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  agentSetupStep: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  agentSetupStepIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceMuted,
  },
  agentSetupStepIconDone: {
    backgroundColor: COLORS.successContainer,
  },
  agentTodaySection: {
    marginTop: 16,
    gap: 8,
  },
  agentTodayTitle: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: '800',
  },
  agentTodoRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
  },
  agentTodoText: {
    flex: 1,
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  agentListingsSection: {
    marginTop: 18,
  },
  agentListingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  agentSeeAll: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  agentStatusTabs: {
    gap: 7,
    paddingVertical: 11,
  },
  agentStatusTab: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
  },
  agentStatusTabActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primary,
  },
  agentStatusTabText: {
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  agentStatusTabTextActive: {
    color: COLORS.primary,
  },
  agentEmptyText: {
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    paddingVertical: 10,
  },
  agentListingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  agentListingMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  agentListingImage: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceMuted,
  },
  agentListingImageFallback: {
    width: 68,
    height: 68,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceMuted,
  },
  agentListingCopy: {
    flex: 1,
    gap: 3,
  },
  agentListingTitle: {
    color: COLORS.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  agentListingPrice: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  agentListingMeta: {
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
  },
  agentListingRejection: {
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  agentListingEdit: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryContainer,
  },
  agentActions: {
    marginTop: 13,
    gap: 8,
  },
  agentPrimaryAction: {
    minHeight: 45,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  agentPrimaryActionText: {
    color: COLORS.onSurfaceMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  agentSecondaryActions: {
    gap: 7,
  },
  agentSecondaryAction: {
    minHeight: 43,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
  },
  agentSecondaryActionDark: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  agentSecondaryActionText: {
    flex: 1,
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  agentSecondaryActionTextDark: {
    color: COLORS.onSurfaceMuted,
  },
  agentUnreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentUnreadBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  agentStatusAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderStrong,
  },
  agentStatusActionText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  agentStatusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  agentStatusText: {
    color: COLORS.onSuccessContainer,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 17,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.035,
    shadowRadius: 10,
    elevation: 1,
  },
  sectionDark: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  activityAccordion: {
    paddingVertical: 8,
  },
  activityAccordionHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  activityAccordionTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activityAccordionIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryContainer,
  },
  activityAccordionText: {
    flex: 1,
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: '700',
  },
  activityAccordionTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activityAccordionCount: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 7,
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  activityAccordionContent: {
    paddingTop: 12,
  },
  clearHistoryButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  cardRow: {
    paddingRight: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.onSurface,
    marginBottom: 14,
  },
  sectionTitleCompact: {
    marginBottom: 0,
  },
  sectionTitleDark: {
    color: COLORS.onSurfaceMuted,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  clearText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.onSurfaceMuted,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceAlt,
    padding: 13,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyRowDark: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  historyText: {
    fontSize: 13,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    padding: 14,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusCardDark: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  statusSubtitle: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    marginTop: 2,
  },
  statusTitleDark: {
    color: COLORS.onSurfaceMuted,
  },
  statusSubtitleDark: {
    color: COLORS.onSurfaceMuted,
  },
  propertyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceAlt,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  propertyInfo: {
    flex: 1,
    marginRight: 10,
  },
  propertyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginBottom: 4,
  },
  propertyMeta: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
  },
  propertyStats: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
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
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
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
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  listingPending: {
    backgroundColor: COLORS.warningContainer,
  },
  listingApproved: {
    backgroundColor: COLORS.successContainer,
  },
  listingRejected: {
    backgroundColor: COLORS.dangerContainer,
  },
  listingArchived: {
    backgroundColor: COLORS.borderStrong,
  },
  savedSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceAlt,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  savedSearchRowDark: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  savedSearchInfo: {
    flex: 1,
    marginRight: 10,
  },
  savedSearchLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  savedSearchMeta: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
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
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedSearchDelete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.dangerContainer,
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
    paddingVertical: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  languageChipDark: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  languageChipActive: {
    backgroundColor: COLORS.primary,
  },
  languageText: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    fontWeight: '600',
  },
  languageTextActive: {
    color: COLORS.white,
  },
  languageTextDark: {
    color: COLORS.onSurfaceMuted,
  },
  aboutText: {
    fontSize: 14,
    color: COLORS.onSurfaceMuted,
    lineHeight: 22,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addressInfo: {
    flex: 1,
  },
  addressText: {
    fontSize: 14,
    color: COLORS.onSurfaceMuted,
  },
  legalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  legalItemDark: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  legalText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.onSurface,
    fontWeight: '500',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceItem: {
    width: '47%',
    backgroundColor: COLORS.surfaceAlt,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  serviceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.onSurface,
    textAlign: 'center',
  },
  serviceDesc: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
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
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    marginTop: 4,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.onSurfaceMuted,
  },
  footerTextDark: {
    color: COLORS.onSurfaceMuted,
  },
  footerVersion: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    marginTop: 4,
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  forgotButton: {
    alignItems: 'flex-end',
    marginTop: 0,
    marginBottom: 6,
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
    color: COLORS.onSurfaceMuted,
    marginTop: 6,
  },
  authLegal: {
    marginTop: 16,
    fontSize: 11,
    color: COLORS.onSurfaceMuted,
    textAlign: 'center',
  },
});

export default ProfileScreen;
