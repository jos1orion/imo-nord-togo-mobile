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
} from 'react-native';

import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LegalScreen from './SettingsScreen';
import { RootStackParamList } from '../../App';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { getContactEmail } from '../constants/appConfig';
import PropertyCard from '../components/PropertyCard';
import COLORS from '../theme/colors';
import { isPublicProperty } from '../utils/propertyVisibility';

type ProfileRouteProp = RouteProp<
  { Profile: { authMode?: 'login' | 'register' } | undefined },
  'Profile'
>;

const ProfileScreen: React.FC = () => {
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
  const [authLoading, setAuthLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (route.params?.authMode) {
      setAuthMode(route.params.authMode);
      setAuthError('');
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
      <ScrollView style={styles.container} contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
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
          <View style={styles.authSecureNote}>
            <Ionicons name="shield-checkmark" size={15} color={COLORS.primary} />
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
                <Ionicons name="person-outline" size={19} color="#64748B" />
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
            <View style={styles.authInputRow}>
              <Ionicons name="mail-outline" size={19} color="#64748B" />
              <TextInput
                style={styles.authInput}
                value={authEmail}
                onChangeText={setAuthEmail}
                placeholder="email@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
              />
            </View>
          </View>
          {authMode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile_phone')}</Text>
              <View style={styles.authInputRow}>
                <Ionicons name="call-outline" size={19} color="#64748B" />
                <TextInput
                  style={styles.authInput}
                  value={authPhone}
                  onChangeText={setAuthPhone}
                  placeholder={t('profile_phone_placeholder')}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  returnKeyType="next"
                />
              </View>
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('profile_password')}</Text>
            <View style={[styles.authInputRow, styles.passwordRow]}>
              <Ionicons name="lock-closed-outline" size={19} color="#64748B" />
              <TextInput
                style={[styles.authInput, styles.passwordInput]}
                value={authPassword}
                onChangeText={setAuthPassword}
                placeholder="********"
                secureTextEntry={!showPassword}
                textContentType={authMode === 'login' ? 'password' : 'newPassword'}
                autoCapitalize="none"
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword(prev => !prev)}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            {authMode === 'register' && (
              <Text style={styles.passwordHint}>{t('profile_password_min_hint')}</Text>
            )}
          </View>

          {authError.length > 0 && (
            <Text style={styles.authError}>{authError}</Text>
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

          {authMode === 'register' && (
            <Text style={styles.authLegal}>{t('profile_legal_consent_short')}</Text>
          )}
        </View>
      </ScrollView>
    );
  }

  const accountVerified = currentUser.verified;

  return (
    <>
      <ScrollView
        style={[styles.container, theme === 'dark' && styles.containerDark]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity style={styles.profileBrand} onPress={handleSecretTap} activeOpacity={1}>
            <View style={styles.profileLogo}>
              <Text style={styles.profileLogoText}>IMO</Text>
            </View>
            <View>
              <Text style={[styles.profileHeading, theme === 'dark' && styles.textLight]}>
                {t('tab_profile')}
              </Text>
              <Text style={[styles.profileTagline, theme === 'dark' && styles.textMutedDark]}>
                Imo Nord Togo
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.accountCard, theme === 'dark' && styles.accountCardDark]}>
          <View style={[styles.accountAvatar, theme === 'dark' && styles.accountAvatarDark]}>
            <Text style={styles.accountInitial}>
              {currentUser.name.trim().charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.accountDetails}>
            <Text style={[styles.accountName, theme === 'dark' && styles.accountNameDark]}>
              {currentUser.name}
            </Text>
            <Text style={[styles.accountMeta, theme === 'dark' && styles.accountMetaDark]}>
              {currentUser.email}
            </Text>
            {currentUser.phone ? (
              <Text style={[styles.accountMeta, theme === 'dark' && styles.accountMetaDark]}>
                {currentUser.phone}
              </Text>
            ) : null}
          </View>
          <Ionicons
            name={accountVerified ? 'shield-checkmark' : 'person-circle-outline'}
            size={21}
            color={accountVerified ? '#16a34a' : theme === 'dark' ? '#94A3B8' : COLORS.textMuted}
          />
        </View>

        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={handleAccountDeletionRequest}
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={17} color={COLORS.error} />
          <Text style={styles.deleteAccountText}>{t('profile_delete_account')}</Text>
        </TouchableOpacity>

        {/* Account Status */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>{t('profile_account_status')}</Text>
          <View style={[styles.statusCard, theme === 'dark' && styles.statusCardDark]}>
            <Ionicons
              name={accountVerified ? 'shield-checkmark' : 'alert-circle'}
              size={22}
              color={accountVerified ? '#16a34a' : '#f59e0b'}
            />
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, theme === 'dark' && styles.statusTitleDark]}>
                {accountVerified ? t('profile_verified') : t('profile_not_verified')}
              </Text>
              <Text style={[styles.statusSubtitle, theme === 'dark' && styles.statusSubtitleDark]}>
                {accountVerified ? t('profile_verified_sub') : t('profile_verify_admin')}
              </Text>
            </View>
          </View>
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
                <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
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
            <Ionicons name="share-social" size={18} color="#fff" />
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
            <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
            <Text style={[styles.legalText, theme === 'dark' && styles.textLight]}>{t('privacy')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.legalItem, theme === 'dark' && styles.legalItemDark]}
            onPress={() => setLegalModal('terms')}
          >
            <Ionicons name="document-text" size={20} color={COLORS.primary} />
            <Text style={[styles.legalText, theme === 'dark' && styles.textLight]}>{t('terms')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Social Links */}
        <View style={[styles.section, theme === 'dark' && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, theme === 'dark' && styles.sectionTitleDark]}>{t('follow_us')}</Text>
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

        <TouchableOpacity
          style={styles.logoutButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={logoutLoading}
          onPress={handleLogoutPress}
          accessibilityRole="button"
        >
          <Ionicons name="log-out" size={18} color={COLORS.error} />
          <Text style={styles.logoutText}>
            {logoutLoading ? t('profile_logging_out') : t('profile_logout')}
          </Text>
          {logoutLoading && <ActivityIndicator size="small" color={COLORS.error} />}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  content: {
    paddingBottom: 32,
  },
  authContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 28,
    backgroundColor: '#F4F7FB',
  },
  authHero: {
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    backgroundColor: '#F4F7FB',
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
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authLogoText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  authBrandCopy: {
    flex: 1,
  },
  authSecureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 20,
  },
  authSecureText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  guestLanguageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  guestLanguageLabel: {
    flex: 1,
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  authTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  authSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  profileHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  profileBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileLogo: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileLogoText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: '#fff',
  },
  profileHeading: {
    color: '#0F172A',
    fontSize: 23,
    fontWeight: '800',
  },
  profileTagline: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  textLight: {
    color: '#F8FAFC',
  },
  textMutedDark: {
    color: '#94A3B8',
  },
  authCard: {
    backgroundColor: '#fff',
    marginHorizontal: 18,
    marginTop: 0,
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  authCardTitle: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '800',
  },
  authCardSubtitle: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    marginBottom: 18,
  },
  authTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
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
    backgroundColor: COLORS.primary,
  },
  authTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  authTabTextActive: {
    color: '#fff',
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
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 7,
    fontWeight: '700',
  },
  authInputRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  authInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  authButton: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
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
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  authError: {
    fontSize: 12,
    color: COLORS.error,
    marginBottom: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  accountCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E8EDF4',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  accountAvatar: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: COLORS.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInitial: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  accountAvatarDark: {
    backgroundColor: '#1E3A5F',
  },
  accountDetails: {
    flex: 1,
    minWidth: 0,
  },
  accountNameDark: {
    color: '#F8FAFC',
  },
  accountMetaDark: {
    color: '#94A3B8',
  },
  accountCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
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
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  accountMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.dangerBg,
    marginHorizontal: 16,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.error,
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
    marginTop: 14,
    padding: 17,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8EDF4',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.035,
    shadowRadius: 10,
    elevation: 1,
  },
  sectionDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  cardRow: {
    paddingRight: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  sectionTitleCompact: {
    marginBottom: 0,
  },
  sectionTitleDark: {
    color: '#F8FAFC',
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
    color: COLORS.textMuted,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.chipBg,
    padding: 13,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  historyRowDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  historyText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.chipBg,
    padding: 14,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  statusCardDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
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
  statusTitleDark: {
    color: '#F8FAFC',
  },
  statusSubtitleDark: {
    color: '#94A3B8',
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
  savedSearchRowDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
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
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  languageChipDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
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
  languageTextDark: {
    color: '#CBD5E1',
  },
  aboutText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
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
  legalItemDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    marginTop: 4,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  footerTextDark: {
    color: '#94A3B8',
  },
  footerVersion: {
    fontSize: 12,
    color: '#94A3B8',
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
    color: '#94A3B8',
    marginTop: 6,
  },
  authLegal: {
    marginTop: 16,
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export default ProfileScreen;






