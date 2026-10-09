import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Share,
  TextInput,
  Alert,
  ActivityIndicator,
  InteractionManager,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';

import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LegalScreen from './SettingsScreen';
import { RootStackParamList } from '../../App';
import { useApp } from '../context/AppContext';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import { authCallbackUrl, exchangeAuthCallback, resetPasswordCallbackUrl, supabase } from '../lib/supabase';
import { getContactEmail } from '../constants/appConfig';
import PropertyCard from '../components/PropertyCard';
import COLORS from '../theme/colors';
import { isPublicProperty } from '../utils/propertyVisibility';
import { RADIUS, SPACING } from '../theme/spacing';
import { typography } from '../theme/typography';
import { logger } from '../lib/logger';

type ProfileRouteProp = RouteProp<
  { Profile: { authMode?: 'login' | 'register' } | undefined },
  'Profile'
>;

const ProfileScreen: React.FC = () => {
  const styles = useThemedStyles(baseStyles);
  const themeColors = useThemeColors();
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<ProfileRouteProp>();
  const insets = useSafeAreaInsets();
  const {
    properties,
    savedSearches,
    removeSavedSearch,
    searchHistory,
    clearSearchHistory,
    recentViewedIds,
    getMyProperties,
    chats,
    currentUser,
    registerUser,
    loginUser,
    logoutUser,
    setSearchQuery,
    setFilterType,
    resetFilters,
    setFilters,
    language,
    setLanguage,
    theme,
    setTheme,
    t,
    tType,
    notifications,
  } = useApp();
  const secretTapCount = useRef(0);
  const secretTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  useEffect(() => {
    if (route.params?.authMode) {
      setAuthMode(route.params.authMode);
      setAuthError('');
      setAuthNotice('');
    }
  }, [route.params?.authMode]);

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
      Alert.alert(t('error'), t('profile_admin_required'));
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
              <Text style={styles.authTitle}>Imo Nord Togo</Text>
              <Text style={styles.authSubtitle}>{t('app_tagline')}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.authWelcome}>
            <View style={styles.authWelcomeIcon}>
              <Ionicons name="home" size={22} color={themeColors.onSurfaceMuted} />
            </View>
            <View style={styles.authWelcomeCopy}>
              <Text style={styles.authWelcomeTitle}>{t('profile_auth_hero_title')}</Text>
              <Text style={styles.authWelcomeSubtitle}>{t('profile_auth_hero_subtitle')}</Text>
            </View>
          </View>
          <View style={styles.authSecureNote}>
            <Ionicons name="shield-checkmark" size={15} color={themeColors.onSurfaceMuted} />
            <Text style={styles.authSecureText}>{t('profile_auth_secure')}</Text>
          </View>
          <View style={styles.guestLanguageRow}>
            <Text style={styles.guestLanguageLabel}>{t('language')}</Text>
            {(['fr', 'en'] as const).map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.languageChip,
                  language === option && styles.languageChipActive,
                ]}
                onPress={() => setLanguage(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: language === option }}
              >
                <Text
                  style={[
                    styles.languageText,
                    language === option && styles.languageTextActive,
                  ]}
                >
                  {option === 'fr' ? 'Français' : 'English'}
                </Text>
              </TouchableOpacity>
            ))}
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
  const canRequestAgentAccess =
    !isAgent &&
    currentUser.role !== 'ADMIN' &&
    currentUser.role !== 'ACCOUNTANT' &&
    (currentUser.agentStatus === undefined ||
      currentUser.agentStatus === 'none' ||
      currentUser.agentStatus === 'pending' ||
      currentUser.agentStatus === 'rejected');
  const agentProperties = isAgent ? getMyProperties() : [];
  const profileProperties = getMyProperties();
  const unreadMessageCount = currentUser
    ? chats
        .filter(chat => chat.participants.includes(currentUser.id))
        .reduce((total, chat) => total + (chat.unreadCount[currentUser.id] ?? 0), 0)
    : 0;
  const activeAgentListings = agentProperties.filter(
    property => property.listingStatus === 'approved' && property.status === 'available'
  ).length;
  const pendingAgentListings = agentProperties.filter(
    property => property.listingStatus === 'pending'
  ).length;
  const unreadAgentMessages = isAgent
    ? chats
        .filter(chat => chat.participants.includes(currentUser.id))
        .reduce((total, chat) => total + (chat.unreadCount[currentUser.id] ?? 0), 0)
    : 0;

  return (
    <>
      <ScrollView
        style={[styles.container, theme === 'dark' && styles.containerDark]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        {/* Header */}
        <LinearGradient
          colors={[themeColors.brand, themeColors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeader}
        >
          <TouchableOpacity style={styles.profileBrand} onPress={handleSecretTap} activeOpacity={1}>
            <View style={styles.profileLogo}>
              <Text style={styles.profileLogoText}>IMO</Text>
            </View>
            <View style={styles.profileHeroCard}>
              <View style={styles.profileHeroMetric}>
                <Ionicons name="home-outline" size={17} color={themeColors.primary} />
                <Text style={styles.profileHeroValue}>{profileProperties.length}</Text>
                <Text style={styles.profileHeroLabel}>{t('my_listings')}</Text>
              </View>
              <View style={styles.profileHeroDivider} />
              <View style={styles.profileHeroMetric}>
                <Ionicons name="bookmark-outline" size={17} color={themeColors.info} />
                <Text style={styles.profileHeroValue}>{savedSearches.length}</Text>
                <Text style={styles.profileHeroLabel}>{t('saved_searches')}</Text>
              </View>
              <View style={styles.profileHeroDivider} />
              <View style={styles.profileHeroMetric}>
                <Ionicons name="chatbubble-ellipses-outline" size={17} color={themeColors.success} />
                <Text style={styles.profileHeroValue}>{unreadMessageCount}</Text>
                <Text style={styles.profileHeroLabel}>{t('profile_messages_shortcut')}</Text>
              </View>
            </View>
            <View style={styles.profileBrandCopy}>
              <Text style={[styles.profileHeading, theme === 'dark' && styles.textLight]}>
                {t('tab_profile')}
              </Text>
              <Text style={styles.profileTagline}>
                {isAgent ? t('profile_agent_dashboard') : t('profile_personal_space')}
              </Text>
            </View>
            <View style={styles.profileRoleBadge}>
              <Ionicons
                name={isAgent ? 'briefcase' : 'person'}
                size={13}
                color={isAgent ? themeColors.onSurfaceMuted : themeColors.onBrandMuted}
              />
              <Text style={styles.profileRoleBadgeText}>
                {isAgent ? t('profile_agent_approved') : t('profile_client_badge')}
              </Text>
            </View>
          </TouchableOpacity>
        </LinearGradient>

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

        {isAgent && (
          <View style={[styles.agentDashboard, theme === 'dark' && styles.agentDashboardDark]}>
            <View style={styles.agentDashboardHeader}>
              <View style={styles.agentDashboardHeading}>
                <View style={styles.agentDashboardIcon}>
                  <Ionicons name="briefcase" size={17} color={themeColors.onSurfaceMuted} />
                </View>
                <View style={styles.agentDashboardTitleWrap}>
                  <Text style={[styles.agentDashboardTitle, theme === 'dark' && styles.textLight]}>
                    {t('profile_agent_dashboard')}
                  </Text>
                  <Text style={[styles.agentDashboardSubtitle, theme === 'dark' && styles.textMutedDark]}>
                    {t('profile_agent_dashboard_subtitle')}
                  </Text>
                </View>
              </View>
              <View style={styles.agentApprovedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={themeColors.success} />
                <Text style={styles.agentApprovedText}>{t('profile_agent_approved')}</Text>
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
                  key: 'pending',
                  value: pendingAgentListings,
                  label: t('profile_agent_pending_listings'),
                  icon: 'time-outline' as const,
                  color: themeColors.warning,
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
          </View>
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

        {/* Saved Searches */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>{t('saved_searches')}</Text>
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
                  >
                    <Ionicons name="arrow-forward" size={16} color={themeColors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.savedSearchDelete}
                    onPress={() => removeSavedSearch(saved.id)}
                  >
                    <Ionicons name="trash" size={16} color={themeColors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Search History */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, styles.sectionTitleCompact, theme === 'dark' && styles.sectionTitleDark]}>{t('profile_search_history')}</Text>
            {searchHistory.length > 0 && (
              <TouchableOpacity onPress={clearSearchHistory}>
                <Text style={styles.clearText}>{t('profile_clear_history')}</Text>
              </TouchableOpacity>
            )}
          </View>
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

        {/* Recent Views */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>{t('profile_recent_views')}</Text>
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

        {/* Invite Friend */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>{t('profile_invite_friend')}</Text>
          <TouchableOpacity style={styles.inviteButton} onPress={handleInvite}>
            <Ionicons name="share-social" size={18} color={themeColors.white} />
            <Text style={styles.inviteText}>{t('profile_invite_friend')}</Text>
          </TouchableOpacity>
        </View>
        {/* Theme */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>
            {t('language')}
          </Text>
          <View style={styles.languageRow}>
            {(['fr', 'en'] as const).map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.languageChip,
                  language === option && styles.languageChipActive,
                  theme === 'dark' && language !== option && styles.languageChipDark,
                ]}
                onPress={() => setLanguage(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: language === option }}
              >
                <Text
                  style={[
                    styles.languageText,
                    language === option && styles.languageTextActive,
                    theme === 'dark' && language !== option && styles.languageTextDark,
                  ]}
                >
                  {option === 'fr' ? 'Français' : 'English'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {/* Theme */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>{t('theme')}</Text>
          <View style={styles.languageRow}>
            <TouchableOpacity
              style={[
                styles.languageChip,
                theme === 'light' && styles.languageChipActive,
                theme === 'dark' && styles.languageChipDark,
              ]}
              onPress={() => setTheme('light')}
            >
              <Text
                style={[
                  styles.languageText,
                  theme === 'light' && styles.languageTextActive,
                  theme === 'dark' && styles.languageTextDark,
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

        {/* Social Links */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>{t('follow_us')}</Text>
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-facebook" size={24} color={themeColors.socialFacebook} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-instagram" size={24} color={themeColors.socialInstagram} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-twitter" size={24} color={themeColors.socialTwitter} />
            </TouchableOpacity>
          </View>
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
    paddingBottom: 34,
    backgroundColor: COLORS.brand,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
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
    backgroundColor: COLORS.surfaceAlt,
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
    color: COLORS.onSurfaceMuted,
    letterSpacing: 0.5,
  },
  authBrandCopy: {
    flex: 1,
  },
  authSecureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 18,
  },
  authSecureText: {
    color: COLORS.onBrandMuted,
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: COLORS.overlayGold14,
    borderWidth: 1,
    borderColor: COLORS.overlayGold32,
  },
  authWelcomeCopy: {
    flex: 1,
  },
  authWelcomeTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  authWelcomeSubtitle: {
    color: COLORS.onBrandMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  guestLanguageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  guestLanguageLabel: {
    flex: 1,
    color: COLORS.onBrandMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  authTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  authSubtitle: {
    fontSize: 12,
    color: COLORS.onBrandMuted,
    marginTop: 3,
  },
  profileHeader: {
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 36,
    borderRadius: 22,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
  },
  profileHeroCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: SPACING.lg,
    marginTop: -22,
    marginBottom: SPACING.md,
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
  profileHeroMetric: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  profileHeroValue: {
    ...typography.subtitle,
    color: COLORS.onSurface,
  },
  profileHeroLabel: {
    ...typography.caption,
    color: COLORS.onSurfaceMuted,
    textAlign: 'center',
  },
  profileHeroDivider: {
    width: 1,
    alignSelf: 'center',
    height: '64%',
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
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileLogoText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: COLORS.onSurfaceMuted,
  },
  profileRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.overlayWhite12,
    borderWidth: 1,
    borderColor: COLORS.overlayWhite16,
  },
  profileRoleBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  profileHeading: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: '800',
  },
  profileTagline: {
    fontSize: 11,
    color: COLORS.onBrandMuted,
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
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  agentAccessButton: {
    minHeight: 42,
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
    fontSize: 10,
    fontWeight: '800',
  },
  agentDashboardSubtitle: {
    color: COLORS.onSurfaceMuted,
    fontSize: 11,
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
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
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
    fontSize: 10,
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
    color: COLORS.white,
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
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 11,
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
