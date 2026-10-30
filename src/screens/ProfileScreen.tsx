import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
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
import { THEME_PALETTES } from '../theme/colors';
import { isPublicProperty } from '../utils/propertyVisibility';
import { logger } from '../lib/logger';
import { formatPrice } from '../utils/format';
import type { ThemeMode } from '../theme/colors';
import { baseStyles } from './ProfileScreen.styles';

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
  const [authPasswordConfirmation, setAuthPasswordConfirmation] = useState('');
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
    if (authMode === 'register' && authPassword !== authPasswordConfirmation) {
      setAuthError(t('reset_password_mismatch_message'));
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
    setAuthPasswordConfirmation('');
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
                setAuthPasswordConfirmation('');
                setWantsAgentAccess(false);
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
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('profile_email')}</Text>
            <View style={styles.authInputRow}>
              <Ionicons name="mail-outline" size={19} color={themeColors.onSurfaceMuted} />
              <TextInput
                style={styles.authInput}
                accessibilityLabel={t('profile_email')}
                value={authEmail}
                onChangeText={setAuthEmail}
                placeholder={t('profile_email_placeholder')}
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
          {authMode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('reset_password_confirmation')}</Text>
              <View style={[styles.authInputRow, styles.passwordRow]}>
                <Ionicons name="lock-closed-outline" size={19} color={themeColors.onSurfaceMuted} />
                <TextInput
                  style={[styles.authInput, styles.passwordInput]}
                  accessibilityLabel={t('reset_password_confirmation')}
                  value={authPasswordConfirmation}
                  onChangeText={setAuthPasswordConfirmation}
                  placeholder="********"
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
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
            </View>
          )}

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
      key: 'onboarding',
      icon: 'compass-outline' as const,
      label: 'Revoir le tutoriel',
      description: 'Découvrez la présentation et les fonctionnalités d’Aurelia.',
      onPress: () => navigation.navigate('Onboarding'),
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


export default ProfileScreen;
