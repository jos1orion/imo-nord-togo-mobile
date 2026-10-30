import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  TextInput,
  Image,
  Keyboard,
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
} from 'react-native';
import { AppAlert as Alert } from '../components/ui/appAlertService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../App';
import { useApp } from '../context/AppContext';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import { supabase } from '../lib/supabase';
import { isDirectPublishingEnabled } from '../lib/publishing';
import { canActivateSmartPublish } from '../lib/smartPublishAccess';
import {
  getFirstIncompletePublishStep,
  getFirstInvalidProgressionStep,
  getPublishStepErrors,
  type PublishField,
} from '../lib/smartPublishValidation';
import { SmartPublishAssistant } from '../components/SmartPublishAssistant';
import { PROPERTY_TYPE_COLORS, Property, PropertyType } from '../types';
import COLORS from '../theme/colors';
import { safeImpactLight } from '../lib/expoHapticsSafe';
import { typography } from '../theme/typography';
import { RADIUS, SPACING } from '../theme/spacing';
import { logger } from '../lib/logger';

type NavigationProp = StackNavigationProp<RootStackParamList>;
type PublishRouteProp = RouteProp<RootStackParamList, 'Publish'>;
type PublishAccessStatus = 'checking' | 'ready' | 'unauthenticated' | 'inactive' | 'unauthorized' | 'error';
type PublishRole = 'USER' | 'AGENT' | 'ADMIN' | 'ACCOUNTANT';
type AgentStatus = 'none' | 'pending' | 'approved' | 'rejected';

const getPublishErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error === 'object' && error !== null) {
    const messages = ['message', 'details', 'hint']
      .map(key => Reflect.get(error, key))
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (messages.length) return [...new Set(messages)].join('\n');
  }
  return fallback;
};

const isAuthSessionError = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return false;
  const status = Reflect.get(error, 'status');
  const name = Reflect.get(error, 'name');
  return status === 401 || name === 'AuthSessionMissingError';
};

const PublishScreen: React.FC = () => {
  const styles = useThemedStyles(baseStyles);
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PublishRouteProp>();
  const isFocused = useIsFocused();
  const {
    addProperty,
    neighborhoods,
    addMyPropertyId,
    currentUser,
    properties,
    updateProperty,
    t,
    tType,
    theme,
    language,
  } = useApp();
  const isDark = theme === 'dark';
  const editingProperty = route.params?.propertyId
    ? properties.find(property => property.id === route.params?.propertyId)
    : undefined;
  const isEditing = Boolean(editingProperty);
  const MAX_IMAGES = 8;
  const [submitting, setSubmitting] = useState(false);
  const [smartPublishVisible, setSmartPublishVisible] = useState(false);
  const [smartPublishTechnicalError, setSmartPublishTechnicalError] = useState<string | null>(null);
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [neighborhoodPickerOpen, setNeighborhoodPickerOpen] = useState(false);
  const [neighborhoodQuery, setNeighborhoodQuery] = useState('');
  const [customNeighborhood, setCustomNeighborhood] = useState(false);
  const submitInProgress = useRef(false);
  const confirmingSubmitRef = useRef(false);
  const submissionCompletedRef = useRef(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PublishField, string>>>({});
  const [publishAccessStatus, setPublishAccessStatus] = useState<PublishAccessStatus>('checking');
  const [verifiedAuthUserId, setVerifiedAuthUserId] = useState<string | null>(null);
  const [verifiedProfile, setVerifiedProfile] = useState<{
    id: string;
    accountStatus: 'active' | 'pending' | 'suspended';
    role: PublishRole;
    agentStatus: AgentStatus;
  } | null>(null);
  const fieldRefs = useRef<Partial<Record<PublishField, TextInput>>>({});
  const contentScrollRef = useRef<ScrollView>(null);
  const verificationRunRef = useRef(0);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'house' as PropertyType,
    price: '',
    area: '',
    city: '',
    location: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    bedrooms: '',
    bathrooms: '',
    amenities: '',
  });
  const verifiedAuthUserIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | undefined>(currentUser?.id);
  const latestDraftRef = useRef({ formData, draftImages, step });
  const openSmartPublish = useCallback(() => setSmartPublishVisible(true), []);
  const closeSmartPublish = useCallback(() => setSmartPublishVisible(false), []);
  useEffect(() => {
    currentUserIdRef.current = currentUser?.id;
    latestDraftRef.current = { formData, draftImages, step };
  }, [currentUser?.id, draftImages, formData, step]);
  const availableNeighborhoods = useMemo(
    () => [...new Map(neighborhoods.map(name => [name.trim().toLocaleLowerCase(), name.trim()]))
      .values()]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, language === 'en' ? 'en' : 'fr', { sensitivity: 'base' })),
    [language, neighborhoods]
  );
  const filteredNeighborhoods = useMemo(() => {
    const query = neighborhoodQuery.trim().toLocaleLowerCase();
    return query
      ? availableNeighborhoods.filter(name => name.toLocaleLowerCase().includes(query))
      : availableNeighborhoods;
  }, [availableNeighborhoods, neighborhoodQuery]);

  useEffect(() => {
    const neighborhood = formData.location.trim().toLocaleLowerCase();
    if (!neighborhood) return;
    setCustomNeighborhood(Boolean(
      availableNeighborhoods.length > 0 &&
      !availableNeighborhoods.some(name => name.toLocaleLowerCase() === neighborhood)
    ));
  }, [availableNeighborhoods, formData.location]);

  const hasDraftContent = (data: typeof formData, images: string[]) => {
    const contactFields = new Set(['clientName', 'clientPhone', 'clientEmail']);
    return (
      Object.entries(data).some(([key, value]) => !contactFields.has(key) && value.trim()) ||
      images.length > 0
    );
  };

  const draftKey = verifiedAuthUserId ? `imo:publish-draft:${verifiedAuthUserId}` : null;

  const persistDraftForUser = useCallback(async (userId: string) => {
    const draft = latestDraftRef.current;
    const contactFields = new Set(['clientName', 'clientPhone', 'clientEmail']);
    const hasContent =
      Object.entries(draft.formData).some(([key, value]) => !contactFields.has(key) && value.trim()) ||
      draft.draftImages.length > 0;
    if (!hasContent) return;
    try {
      await AsyncStorage.setItem(
        `imo:publish-draft:${userId}`,
        JSON.stringify(draft)
      );
    } catch (error) {
      logger.warn('Unable to preserve the publishing draft after authentication changed.', error);
    }
  }, []);

  useEffect(() => {
    if (!isFocused) return;

    let active = true;
    let authCheckTimeout: ReturnType<typeof setTimeout> | null = null;
    const verifySession = async () => {
      const runId = ++verificationRunRef.current;

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          if (active && runId === verificationRunRef.current) {
            verifiedAuthUserIdRef.current = null;
            setVerifiedAuthUserId(null);
            setVerifiedProfile(null);
            setPublishAccessStatus('unauthenticated');
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, account_status, role, agent_status')
          .eq('id', authData.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!active || runId !== verificationRunRef.current) return;
        if (!profile) {
          setPublishAccessStatus('error');
          return;
        }

        const accountStatus = profile.account_status;
        if (accountStatus !== 'active' && accountStatus !== 'pending' && accountStatus !== 'suspended') {
          setPublishAccessStatus('error');
          return;
        }
        const role = profile.role;
        if (role !== 'USER' && role !== 'AGENT' && role !== 'ADMIN' && role !== 'ACCOUNTANT') {
          setPublishAccessStatus('error');
          return;
        }
        const agentStatus = profile.agent_status;
        if (
          agentStatus !== 'none' &&
          agentStatus !== 'pending' &&
          agentStatus !== 'approved' &&
          agentStatus !== 'rejected'
        ) {
          setPublishAccessStatus('error');
          return;
        }
        verifiedAuthUserIdRef.current = authData.user.id;
        setVerifiedAuthUserId(authData.user.id);
        setVerifiedProfile({ id: profile.id, accountStatus, role, agentStatus });
        if (accountStatus !== 'active') {
          setPublishAccessStatus('inactive');
          return;
        }
        const authorizedRole = role === 'ADMIN' || (
          role === 'AGENT' &&
          (
            agentStatus === 'approved' ||
            isDirectPublishingEnabled({ role, agentStatus, accountStatus })
          )
        );
        setPublishAccessStatus(authorizedRole ? 'ready' : 'unauthorized');
      } catch (error) {
        if (!active || runId !== verificationRunRef.current) return;
        logger.warn('Unable to verify the publishing session.', error);
        if (isAuthSessionError(error)) {
          const previousUserId = verifiedAuthUserIdRef.current ?? currentUserIdRef.current;
          verifiedAuthUserIdRef.current = null;
          setVerifiedAuthUserId(null);
          setVerifiedProfile(null);
          setPublishAccessStatus('unauthenticated');
          if (previousUserId) void persistDraftForUser(previousUserId);
        } else {
          setPublishAccessStatus('error');
        }
      }
    };

    void verifySession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        const previousUserId = verifiedAuthUserIdRef.current ?? currentUserIdRef.current;
        verificationRunRef.current += 1;
        verifiedAuthUserIdRef.current = null;
        setVerifiedAuthUserId(null);
        setVerifiedProfile(null);
        setPublishAccessStatus('unauthenticated');
        setSmartPublishVisible(false);
        if (previousUserId) void persistDraftForUser(previousUserId);
        return;
      }

      verifiedAuthUserIdRef.current = null;
      setVerifiedAuthUserId(null);
      setVerifiedProfile(null);
      setPublishAccessStatus('checking');
      if (authCheckTimeout) clearTimeout(authCheckTimeout);
      authCheckTimeout = setTimeout(() => {
        void verifySession();
      }, 0);
    });

    return () => {
      active = false;
      verificationRunRef.current += 1;
      verifiedAuthUserIdRef.current = null;
      if (authCheckTimeout) clearTimeout(authCheckTimeout);
      subscription.unsubscribe();
    };
  }, [isFocused, persistDraftForUser]);

  useEffect(() => {
    if (!isFocused || publishAccessStatus === 'checking' || publishAccessStatus === 'ready') return;
    if (publishAccessStatus === 'unauthenticated') {
      Alert.alert(t('loginRequired'), t('publish_login_required'));
      navigation.replace('MainTabs', { screen: 'Profile', params: { authMode: 'login' } });
      return;
    }
    if (publishAccessStatus === 'inactive') {
      Alert.alert(t('error'), t('publish_account_inactive'));
      navigation.goBack();
      return;
    }
    if (publishAccessStatus === 'unauthorized') {
      Alert.alert(t('error'), t('publish_agent_only'));
      navigation.goBack();
      return;
    }
    Alert.alert(t('error'), t('publish_session_check_failed'));
    navigation.goBack();
  }, [isFocused, navigation, publishAccessStatus, t]);

  const isSmartPublishActive = isFocused && publishAccessStatus === 'ready' &&
    currentUser?.id === verifiedAuthUserId &&
    currentUser.accountStatus === 'active' &&
    currentUser.role === verifiedProfile?.role &&
    currentUser.agentStatus === verifiedProfile?.agentStatus &&
    canActivateSmartPublish({
      inPublicationArea: true,
      verifiedAuthUserId,
      profileUserId: verifiedProfile?.id ?? null,
      accountStatus: verifiedProfile?.accountStatus ?? null,
      role: verifiedProfile?.role ?? null,
      agentApproved: verifiedProfile?.agentStatus === 'approved',
      directPublishingEnabled: verifiedProfile
        ? isDirectPublishingEnabled({
          role: verifiedProfile.role,
          agentStatus: verifiedProfile.agentStatus,
          accountStatus: verifiedProfile.accountStatus,
        })
        : false,
    });

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      const previousUserId = verifiedAuthUserIdRef.current;
      if (previousUserId && !submissionCompletedRef.current) {
        void persistDraftForUser(previousUserId);
      }
      verificationRunRef.current += 1;
      verifiedAuthUserIdRef.current = null;
      setVerifiedAuthUserId(null);
      setVerifiedProfile(null);
      setPublishAccessStatus('checking');
      setSmartPublishVisible(false);
    });
    return unsubscribe;
  }, [navigation, persistDraftForUser]);

  useEffect(() => {
    if (!draftKey || isEditing) {
      if (isEditing) setDraftLoaded(true);
      return;
    }
    let cancelled = false;
    setDraftLoaded(false);
    AsyncStorage.getItem(draftKey)
      .then(raw => {
        if (cancelled || !raw) {
          if (!cancelled) setDraftLoaded(true);
          return;
        }
        try {
          const draft = JSON.parse(raw) as {
            formData?: typeof formData;
            draftImages?: string[];
            step?: number;
          };
          const hasContent = Boolean(
            draft.formData && hasDraftContent(draft.formData, draft.draftImages || [])
          );
          if (!hasContent) {
            setDraftLoaded(true);
            return;
          }
          void safeImpactLight();
          Alert.alert(
            t('publish_draft_available_title'),
            t('publish_draft_available_message'),
            [
              {
                text: t('publish_draft_decline_action'),
                style: 'cancel',
                onPress: () => {
                  void AsyncStorage.removeItem(draftKey);
                  setDraftLoaded(true);
                },
              },
              {
                text: t('publish_draft_resume_action'),
                onPress: () => {
                  if (draft.formData) setFormData(draft.formData);
                  if (draft.draftImages) setDraftImages(draft.draftImages);
                  if (typeof draft.step === 'number' && draft.formData) {
                    const images = draft.draftImages ?? [];
                    const messages = {
                      title: t('publish_title_required_error'),
                      price: t('publish_price_invalid_error'),
                      images: images.length > MAX_IMAGES
                        ? t('publish_photo_limit_max_message').replace('{{n}}', String(MAX_IMAGES))
                        : t('publish_photo_required_error'),
                      city: t('publish_city_required_error'),
                      location: t('publish_location_required_error'),
                      clientPhone: t('publish_phone_required_error'),
                    };
                    const firstIncomplete = getFirstIncompletePublishStep(
                      draft.formData,
                      currentUser?.phone ?? '',
                      images.length,
                      MAX_IMAGES,
                      messages,
                    );
                    setStep(Math.min(Math.max(draft.step, 0), firstIncomplete, 4));
                  }
                  setDraftLoaded(true);
                },
              },
            ]
          );
        } catch {
          void AsyncStorage.removeItem(draftKey);
          setDraftLoaded(true);
        }
      })
      .catch(() => setDraftLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [draftKey, isEditing]);

  useEffect(() => {
    if (!draftKey || !draftLoaded || isEditing) return;
    const hasContent = hasDraftContent(formData, draftImages);
    const timer = setTimeout(() => {
      if (hasContent) {
        void AsyncStorage.setItem(draftKey, JSON.stringify({ formData, draftImages, step }));
      } else {
        void AsyncStorage.removeItem(draftKey);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [draftKey, draftLoaded, formData, draftImages, step, isEditing]);

  useEffect(() => {
    if (!currentUser) return;
    setFormData(prev => ({
      ...prev,
      clientName: prev.clientName || currentUser.name || '',
      clientPhone: prev.clientPhone || currentUser.phone || '',
      clientEmail: prev.clientEmail || currentUser.email || '',
    }));
  }, [currentUser]);

  useEffect(() => {
    if (!editingProperty) return;
    setFormData({
      title: editingProperty.title,
      description: editingProperty.description,
      type: editingProperty.type,
      price: String(editingProperty.price || ''),
      area: String(editingProperty.area || ''),
      city: editingProperty.city || editingProperty.location,
      location: editingProperty.neighborhood || '',
      clientName: editingProperty.contactName || editingProperty.client?.name || currentUser?.name || '',
      clientPhone: editingProperty.contactPhone || editingProperty.client?.phone || currentUser?.phone || '',
      clientEmail: editingProperty.contactEmail || editingProperty.client?.email || currentUser?.email || '',
      bedrooms: String(editingProperty.bedrooms || ''),
      bathrooms: String(editingProperty.bathrooms || ''),
      amenities: editingProperty.amenities.join(', '),
    });
    setDraftImages(editingProperty.images);
    setStep(0);
    setDraftLoaded(true);
  }, [editingProperty?.id]);

  const addImageFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('publish_perm_gallery_title'), t('publish_perm_gallery_message'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
    });
    if (result.canceled) return;
    const uris = result.assets?.map(a => a.uri).filter(Boolean) as string[];
    if (!uris.length) return;
    const remaining = MAX_IMAGES - draftImages.length;
    if (remaining <= 0) {
      Alert.alert(
        t('publish_photo_limit_title'),
        t('publish_photo_limit_max_message').replace('{{n}}', String(MAX_IMAGES))
      );
      return;
    }
    const next = uris.slice(0, remaining);
    if (next.length < uris.length) {
      Alert.alert(
        t('publish_photo_limit_title'),
        t('publish_photo_limit_partial_message').replace('{{n}}', String(MAX_IMAGES))
      );
    }
    setDraftImages(prev => [...next, ...prev]);
    if (next.length) setFieldErrors(previous => ({ ...previous, images: undefined }));
  };

  const addImageFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('publish_perm_camera_title'), t('publish_perm_camera_message'));
      return;
    }
    if (draftImages.length >= MAX_IMAGES) {
      Alert.alert(
        t('publish_photo_limit_title'),
        t('publish_photo_limit_max_message').replace('{{n}}', String(MAX_IMAGES))
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (uri) {
      setDraftImages(prev => [uri, ...prev]);
      setFieldErrors(previous => ({ ...previous, images: undefined }));
    }
  };

  const moveImage = (uri: string, direction: 'left' | 'right') => {
    setDraftImages(prev => {
      const index = prev.indexOf(uri);
      const nextIndex = direction === 'left' ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const resetForm = () => {
    setFieldErrors({});
    setFormData({
      title: '',
      description: '',
      type: 'house',
      price: '',
      area: '',
      city: '',
      location: '',
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      bedrooms: '',
      bathrooms: '',
      amenities: '',
    });
    setDraftImages([]);
    setStep(0);
    setCustomNeighborhood(false);
    if (draftKey) void AsyncStorage.removeItem(draftKey);
  };

  const clearDraft = () => {
    if (!draftKey || !hasDraftContent(formData, draftImages)) return;
    Alert.alert(t('publish_draft_discard_title'), t('publish_draft_discard_message'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('publish_draft_discard_action'), style: 'destructive', onPress: resetForm },
    ]);
  };

  const numericInput = (value: string) => value.replace(/[^\d]/g, '');

  const validationMessages = {
    title: t('publish_title_required_error'),
    price: t('publish_price_invalid_error'),
    images: draftImages.length > MAX_IMAGES
      ? t('publish_photo_limit_max_message').replace('{{n}}', String(MAX_IMAGES))
      : t('publish_photo_required_error'),
    city: t('publish_city_required_error'),
    location: t('publish_location_required_error'),
    clientPhone: t('publish_phone_required_error'),
  };
  const getStepErrors = (targetStep: number) => getPublishStepErrors(
    targetStep,
    formData,
    currentUser?.phone ?? '',
    draftImages.length,
    MAX_IMAGES,
    validationMessages,
  );

  const validateStep = (targetStep: number, includeAll = false) => {
    const errors = getStepErrors(includeAll ? 4 : targetStep);
    setFieldErrors(errors);
    const firstInvalid = (['title', 'price', 'images', 'city', 'location', 'clientPhone'] as const)
      .find(field => errors[field]);
    if (firstInvalid && firstInvalid !== 'images') {
      requestAnimationFrame(() => fieldRefs.current[firstInvalid]?.focus());
    }
    if (Object.keys(errors).length) setSmartPublishVisible(true);
    return Object.keys(errors).length === 0;
  };

  const goStep = (next: number) => {
    if (!Number.isInteger(next) || next < 0 || next > 4) return false;
    const invalidStep = getFirstInvalidProgressionStep(step, next, validateStep);
    if (invalidStep !== null) return false;
    Keyboard.dismiss();
    setFieldErrors({});
    setSmartPublishTechnicalError(null);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(next);
    return true;
  };

  const submitPublication = async () => {
    if (submitting || submitInProgress.current) return;
    setSmartPublishTechnicalError(null);
    const priceValue = parseInt(formData.price, 10);
    const contactName = formData.clientName.trim() || currentUser?.name?.trim() || t('publish_advertiser');
    const contactPhone = formData.clientPhone.trim() || currentUser?.phone?.trim() || '';
    const contactEmail = formData.clientEmail.trim() || currentUser?.email?.trim() || '';
    if (!isSmartPublishActive || !validateStep(4, true)) {
      return;
    }
    if (!contactPhone) return;

    submitInProgress.current = true;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const authenticatedUser = data.user;
      if (!authenticatedUser) {
        Alert.alert(t('loginRequired'), t('publish_login_required'));
        navigation.replace('MainTabs', { screen: 'Profile', params: { authMode: 'login' } });
        return;
      }
      if (
        !isSmartPublishActive ||
        authenticatedUser.id !== verifiedAuthUserId ||
        currentUser?.id !== authenticatedUser.id ||
        currentUser.accountStatus !== 'active'
      ) {
        Alert.alert(t('error'), t('publish_session_check_failed'));
        if (verifiedAuthUserId) void persistDraftForUser(verifiedAuthUserId);
        navigation.replace('MainTabs', { screen: 'Profile', params: { authMode: 'login' } });
        return;
      }
      const directPublishing = isDirectPublishingEnabled(currentUser);
      const preserveListingState = editingProperty?.status === 'occupied';
      const isRenewal = Boolean(
        editingProperty &&
        !preserveListingState &&
        (
          editingProperty.listingStatus === 'archived' ||
          (editingProperty.expiresAt && new Date(editingProperty.expiresAt).getTime() <= Date.now())
        )
      );
      const listingStatusOnSave = preserveListingState
        ? editingProperty?.listingStatus ?? 'pending'
        : directPublishing ? 'approved' : 'pending';
      if (
        !currentUser ||
        (currentUser.role !== 'AGENT' && currentUser.role !== 'ADMIN') ||
        (
          currentUser.role === 'AGENT' &&
          currentUser.agentStatus !== 'approved' &&
          !directPublishing
        )
      ) {
        Alert.alert(
          t('error'),
          t('publish_agent_only')
        );
        return;
      }

      const propertyData: Omit<Property, 'id' | 'createdAt' | 'updatedAt'> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        price: priceValue,
        area: parseInt(formData.area, 10) || 0,
        location: formData.city.trim(),
        neighborhood: formData.location.trim() || undefined,
        city: formData.city.trim(),
        images: draftImages,
        status: preserveListingState ? editingProperty?.status ?? 'available' : 'available',
        listingStatus: listingStatusOnSave,
        expiresAt: isRenewal ? null : editingProperty?.expiresAt,
        amenities: formData.amenities
          .split(',')
          .map(a => a.trim())
          .filter(Boolean),
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms, 10) : undefined,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms, 10) : undefined,
        featured: false,
        clientId: authenticatedUser.id,
        client: {
          id: authenticatedUser.id,
          name: contactName,
          email: contactEmail,
          phone: contactPhone,
          createdAt: new Date().toISOString(),
        },
      };
      let savedListingStatus: Property['listingStatus'];
      if (editingProperty) {
        await updateProperty(editingProperty.id, {
          ...propertyData,
          listingStatus: listingStatusOnSave,
          rejectionReason: preserveListingState ? editingProperty.rejectionReason : null,
        });
        const { data: savedProperty, error: savedPropertyError } = await supabase
          .from('properties')
          .select('listing_status')
          .eq('id', editingProperty.id)
          .single();
        if (savedPropertyError) throw savedPropertyError;
        savedListingStatus = savedProperty.listing_status;
        addMyPropertyId(editingProperty.id);
      } else {
        const created = await addProperty(propertyData);
        savedListingStatus = created.listingStatus;
        addMyPropertyId(created.id);
      }

      const publishedImmediately = savedListingStatus === 'approved';
      Alert.alert(
        publishedImmediately ? t('publish_direct_success_title') : t('publish_success_title'),
        publishedImmediately ? t('publish_direct_success_message') : t('publish_success_message')
      );
      submissionCompletedRef.current = true;
      resetForm();
      navigation.goBack();
    } catch (e) {
      if (isAuthSessionError(e)) {
        logger.warn('Publishing stopped because the authenticated session expired.', e);
        if (verifiedAuthUserId) void persistDraftForUser(verifiedAuthUserId);
        Alert.alert(t('loginRequired'), t('publish_login_required'));
        setPublishAccessStatus('unauthenticated');
        navigation.replace('MainTabs', { screen: 'Profile', params: { authMode: 'login' } });
        return;
      }
      if (
        typeof e === 'object' &&
        e !== null &&
        (Reflect.get(e, 'code') === '42501' ||
          /row-level security|permission denied/i.test(getPublishErrorMessage(e, '')))
      ) {
        const message = t('publish_agent_only');
        setSmartPublishTechnicalError(message);
        setSmartPublishVisible(true);
        Alert.alert(t('error'), message);
        return;
      }
      const message = getPublishErrorMessage(e, t('publish_unknown_error'));
      setSmartPublishTechnicalError(message);
      setSmartPublishVisible(true);
    } finally {
      submitInProgress.current = false;
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (submitting || submitInProgress.current || confirmingSubmitRef.current) return;
    if (!isSmartPublishActive || !validateStep(4, true)) return;
    confirmingSubmitRef.current = true;
    Alert.alert(t('publish_confirm_title'), t('publish_confirm_message'), [
      {
        text: t('cancel'),
        style: 'cancel',
        onPress: () => {
          confirmingSubmitRef.current = false;
        },
      },
      {
        text: t('publish_submit'),
        onPress: () => {
          confirmingSubmitRef.current = false;
          void submitPublication();
        },
      },
    ]);
  };

  const stepLabel = useMemo(() => {
    return [
      t('publish_step_info'),
      t('publish_step_photos'),
      t('publish_step_location'),
      t('publish_step_contact'),
      t('publish_step_review'),
    ][step] || t('publish_step_listing');
  }, [step, t]);

  const currentStepErrors = getStepErrors(step);
  const canContinue = Object.keys(currentStepErrors).length === 0;
  const stepLabels = [
    t('publish_step_info'),
    t('publish_step_photos'),
    t('publish_step_location'),
    t('publish_step_contact'),
    t('publish_step_review'),
  ];
  const smartPublishSteps = stepLabels.map((label, index) => {
    const complete = Object.keys(getStepErrors(index)).length === 0;
    return {
      label,
      status: index === step ? 'current' as const : complete ? 'complete' as const : 'upcoming' as const,
    };
  });
  const fieldLabelKeys = {
    title: 'publish_title_label',
    price: 'publish_price_label',
    images: 'publish_photo_label',
    city: 'publish_city_label',
    location: 'publish_neighborhood_label',
    clientPhone: 'publish_owner_phone_label',
  } as const;
  const smartPublishIssues = (Object.entries(currentStepErrors) as [PublishField, string][])
    .map(([field, message]) => ({
      field,
      message,
      label: t(fieldLabelKeys[field]),
    }));

  const fieldError = (field: PublishField) => fieldErrors[field] ?? currentStepErrors[field];

  const renderFieldError = (field: PublishField) => fieldError(field) ? (
    <Text style={styles.fieldError} accessibilityLiveRegion="polite">
      {fieldError(field)}
    </Text>
  ) : null;

  if (!isSmartPublishActive) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={themeColors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={themeColors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('publish_title')}</Text>
      </View>

      <ScrollView
        ref={contentScrollRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
        contentContainerStyle={styles.contentContainer}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('smart_publish_open')}
          onPress={openSmartPublish}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            padding: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: themeColors.primary,
            backgroundColor: themeColors.primaryContainer,
          }}
        >
          <Ionicons name="sparkles" size={22} color={themeColors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: themeColors.onPrimaryContainer, fontWeight: '700', fontSize: 14 }}>
              {t('smart_publish_title')}
            </Text>
            <Text style={{ color: themeColors.onPrimaryContainer, fontSize: 12, marginTop: 2 }}>
              {t('smart_publish_description')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={themeColors.primary} />
        </TouchableOpacity>

        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>{t('publish_step').replace('{{step}}', String(step + 1))}  |  {stepLabel}</Text>
          <View style={styles.stepDots}>
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={[styles.stepDot, step >= i && styles.stepDotActive]} />
            ))}
          </View>
        </View>

        {step === 0 && (
          <>
            <Text style={styles.inputLabel}>{t('publish_title_label')}</Text>
            <TextInput
              ref={input => { fieldRefs.current.title = input ?? undefined; }}
              style={[styles.input, fieldError('title') && styles.inputInvalid]}
              accessibilityLabel={t('publish_title_label')}
              accessibilityHint={fieldError('title')}
              value={formData.title}
              onChangeText={text => {
                setFormData(previous => ({ ...previous, title: text }));
                if (text.trim()) setFieldErrors(previous => ({ ...previous, title: undefined }));
              }}
              placeholder={t('publish_title_placeholder')}
            />
            {renderFieldError('title')}

            <Text style={styles.inputLabel}>{t('publish_description_label')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              accessibilityLabel={t('publish_description_label')}
              value={formData.description}
              onChangeText={text => setFormData({ ...formData, description: text })}
              placeholder={t('publish_description_placeholder')}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.inputLabel}>{t('publish_type_label')}</Text>
            <View style={styles.typeSelector}>
              {(['house', 'apartment', 'land', 'shop'] as PropertyType[]).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeOption,
                    formData.type === type && { backgroundColor: PROPERTY_TYPE_COLORS[type as PropertyType] },
                  ]}
                  onPress={() => setFormData({ ...formData, type: type as PropertyType })}
                >
                  <Text style={[styles.typeOptionText, formData.type === type && { color: themeColors.white }]}>
                    {tType(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>{t('publish_price_label')}</Text>
            <TextInput
              ref={input => { fieldRefs.current.price = input ?? undefined; }}
              style={[styles.input, fieldError('price') && styles.inputInvalid]}
              accessibilityLabel={t('publish_price_label')}
              accessibilityHint={fieldError('price')}
              value={formData.price}
              onChangeText={text => {
                setFormData(previous => ({ ...previous, price: numericInput(text) }));
                if ((parseInt(text, 10) || 0) > 0) {
                  setFieldErrors(previous => ({ ...previous, price: undefined }));
                }
              }}
              placeholder={t('publish_price_placeholder')}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            {renderFieldError('price')}
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.inputLabel}>{t('publish_photo_label')}</Text>
            <Text style={styles.photoHint}>
              {t('publish_photo_hint').replace(/\{\{max\}\}/g, String(MAX_IMAGES)).replace('{{count}}', String(draftImages.length))}
            </Text>
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={[styles.photoButton, fieldError('images') && styles.inputInvalid]}
                onPress={addImageFromCamera}
                accessibilityRole="button"
                accessibilityLabel={t('publish_camera')}
              >
                <Ionicons name="camera" size={18} color={themeColors.primary} />
                <Text style={styles.photoButtonText}>{t('publish_camera')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoButton, fieldError('images') && styles.inputInvalid]}
                onPress={addImageFromLibrary}
                accessibilityRole="button"
                accessibilityLabel={t('publish_gallery')}
              >
                <Ionicons name="images" size={18} color={themeColors.primary} />
                <Text style={styles.photoButtonText}>{t('publish_gallery')}</Text>
              </TouchableOpacity>
            </View>
            {renderFieldError('images')}

            {draftImages.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                {draftImages.map(uri => (
                  <View key={uri} style={styles.photoThumbWrap}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <View style={styles.photoOrderActions}>
                      <TouchableOpacity
                        style={styles.photoOrderButton}
                        onPress={() => moveImage(uri, 'left')}
                        accessibilityRole="button"
                        accessibilityLabel={t('publish_move_photo_left')}
                      >
                        <Ionicons name="chevron-back" size={13} color={themeColors.white} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.photoOrderButton}
                        onPress={() => moveImage(uri, 'right')}
                        accessibilityRole="button"
                        accessibilityLabel={t('publish_move_photo_right')}
                      >
                        <Ionicons name="chevron-forward" size={13} color={themeColors.white} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => setDraftImages(prev => prev.filter(x => x !== uri))}
                      accessibilityRole="button"
                      accessibilityLabel={t('publish_remove_photo')}
                    >
                      <Ionicons name="close" size={14} color={themeColors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            {draftImages.length > 0 && (
              <Text style={styles.photoMainHint}>
                {t('publish_main_photo_hint')}
              </Text>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.inputLabel}>{t('publish_city_label')}</Text>
            <TextInput
              ref={input => { fieldRefs.current.city = input ?? undefined; }}
              style={[styles.input, fieldError('city') && styles.inputInvalid]}
              accessibilityLabel={t('publish_city_label')}
              accessibilityHint={fieldError('city')}
              value={formData.city}
              onChangeText={text => {
                setFormData(previous => ({ ...previous, city: text }));
                if (text.trim()) setFieldErrors(previous => ({ ...previous, city: undefined }));
              }}
              placeholder={t('publish_city_placeholder')}
            />
            {renderFieldError('city')}

            <Text style={styles.inputLabel}>{t('publish_neighborhood_label')}</Text>
            {availableNeighborhoods.length > 0 ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.input,
                    styles.neighborhoodSelect,
                    fieldError('location') && styles.inputInvalid,
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setNeighborhoodQuery('');
                    setNeighborhoodPickerOpen(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={formData.location || t('publish_choose_neighborhood')}
                  accessibilityHint={fieldError('location')}
                >
                  <Text style={formData.location ? styles.neighborhoodSelected : styles.neighborhoodPlaceholder}>
                    {formData.location || t('publish_choose_neighborhood')}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={themeColors.onSurfaceMuted} />
                </TouchableOpacity>
                {customNeighborhood && (
                  <TextInput
                    ref={input => { fieldRefs.current.location = input ?? undefined; }}
                    style={[styles.input, fieldError('location') && styles.inputInvalid]}
                    accessibilityLabel={t('publish_neighborhood_label')}
                    accessibilityHint={fieldError('location')}
                    value={formData.location}
                    onChangeText={text => {
                      setFormData(previous => ({ ...previous, location: text }));
                      if (text.trim()) setFieldErrors(previous => ({ ...previous, location: undefined }));
                    }}
                    placeholder={t('publish_neighborhood_placeholder')}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                )}
              </>
            ) : (
              <TextInput
                ref={input => { fieldRefs.current.location = input ?? undefined; }}
                style={[styles.input, fieldError('location') && styles.inputInvalid]}
                accessibilityLabel={t('publish_neighborhood_label')}
                accessibilityHint={fieldError('location')}
                value={formData.location}
                onChangeText={text => {
                  setFormData(previous => ({ ...previous, location: text }));
                  if (text.trim()) setFieldErrors(previous => ({ ...previous, location: undefined }));
                }}
                placeholder={t('publish_neighborhood_placeholder')}
              />
            )}
            {renderFieldError('location')}

            <Text style={styles.inputLabel}>{t('publish_area_label')}</Text>
            <TextInput
              style={styles.input}
              accessibilityLabel={t('publish_area_label')}
              value={formData.area}
              onChangeText={text => setFormData(previous => ({ ...previous, area: numericInput(text) }))}
              placeholder={t('publish_area_placeholder')}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            <Text style={styles.inputLabel}>{t('publish_bedrooms_label')}</Text>
            <TextInput
              style={styles.input}
              accessibilityLabel={t('publish_bedrooms_label')}
              value={formData.bedrooms}
              onChangeText={text => setFormData(previous => ({ ...previous, bedrooms: numericInput(text) }))}
              placeholder={t('publish_bedrooms_placeholder')}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            <Text style={styles.inputLabel}>{t('publish_bathrooms_label')}</Text>
            <TextInput
              style={styles.input}
              accessibilityLabel={t('publish_bathrooms_label')}
              value={formData.bathrooms}
              onChangeText={text => setFormData(previous => ({ ...previous, bathrooms: numericInput(text) }))}
              placeholder={t('publish_bathrooms_placeholder')}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            <Text style={styles.inputLabel}>{t('publish_amenities_label')}</Text>
            <TextInput
              style={styles.input}
              accessibilityLabel={t('publish_amenities_label')}
              value={formData.amenities}
              onChangeText={text => setFormData({ ...formData, amenities: text })}
              placeholder={t('publish_amenities_placeholder')}
            />
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.inputLabel}>{t('publish_owner_phone_label')}</Text>
            <TextInput
              ref={input => { fieldRefs.current.clientPhone = input ?? undefined; }}
              style={[styles.input, fieldError('clientPhone') && styles.inputInvalid]}
              accessibilityLabel={t('publish_owner_phone_label')}
              accessibilityHint={fieldError('clientPhone')}
              value={formData.clientPhone}
              onChangeText={text => {
                setFormData(previous => ({ ...previous, clientPhone: text }));
                if (text.trim()) setFieldErrors(previous => ({ ...previous, clientPhone: undefined }));
              }}
              placeholder={t('publish_owner_phone_placeholder')}
              keyboardType="phone-pad"
            />
            {renderFieldError('clientPhone')}

            <Text style={styles.inputLabel}>{t('publish_owner_name_label')}</Text>
            <TextInput
              style={styles.input}
              accessibilityLabel={t('publish_owner_name_label')}
              value={formData.clientName}
              onChangeText={text => setFormData({ ...formData, clientName: text })}
              placeholder={t('publish_owner_name_placeholder')}
            />

            <Text style={styles.inputLabel}>{t('publish_owner_email_label')}</Text>
            <TextInput
              style={styles.input}
              accessibilityLabel={t('publish_owner_email_label')}
              value={formData.clientEmail}
              onChangeText={text => setFormData({ ...formData, clientEmail: text })}
              placeholder={t('publish_owner_email_placeholder')}
              keyboardType="email-address"
              autoCapitalize="none"
            />

          </>
        )}

        {step === 4 && (
          <View style={[styles.reviewCard, isDark && styles.reviewCardDark]}>
            <Text style={styles.reviewTitle}>{t('publish_summary')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewPhotos}>
              {draftImages.map((uri, index) => (
                <Image key={`${uri}-${index}`} source={{ uri }} style={styles.reviewPhoto} />
              ))}
            </ScrollView>
            <Text style={[styles.reviewPropertyTitle, isDark && styles.reviewTextDark]}>{formData.title}</Text>
            <Text style={styles.reviewType}>{tType(formData.type)}</Text>
            <Text style={styles.reviewPrice}>
              {`${parseInt(formData.price, 10).toLocaleString(language === 'en' ? 'en' : 'fr')} FCFA`}
            </Text>
            <View style={styles.reviewDivider} />
            <Text style={styles.reviewSectionTitle}>{t('publish_review_location')}</Text>
            <Text style={styles.reviewText}>{`${formData.location}, ${formData.city}`}</Text>
            <Text style={styles.reviewSectionTitle}>{t('publish_review_details')}</Text>
            <Text style={styles.reviewText}>{formData.description.trim() || t('publish_no_description')}</Text>
            {formData.area && <Text style={styles.reviewText}>{t('publish_review_area').replace('{{value}}', formData.area)}</Text>}
            {(formData.bedrooms || formData.bathrooms) && (
              <Text style={styles.reviewText}>
                {[
                  formData.bedrooms && t('publish_review_bedrooms').replace('{{value}}', formData.bedrooms),
                  formData.bathrooms && t('publish_review_bathrooms').replace('{{value}}', formData.bathrooms),
                ].filter(Boolean).join(' · ')}
              </Text>
            )}
            {!!formData.amenities.trim() && <Text style={styles.reviewText}>{formData.amenities.trim()}</Text>}
            <Text style={styles.reviewSectionTitle}>{t('publish_review_contact')}</Text>
            <Text style={styles.reviewText}>{formData.clientName.trim() || currentUser?.name || t('publish_advertiser')}</Text>
            <Text style={styles.reviewText}>{formData.clientPhone.trim() || currentUser?.phone}</Text>
            {!!(formData.clientEmail.trim() || currentUser?.email) && (
              <Text style={styles.reviewText}>{formData.clientEmail.trim() || currentUser?.email}</Text>
            )}
          </View>
        )}

        <View style={[styles.bottomPadding, { height: 120 + insets.bottom }]} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={[styles.secondaryButton, step === 0 && styles.secondaryDisabled]}
            onPress={() => goStep(Math.max(step - 1, 0))}
            disabled={step === 0}
          >
            <Text style={styles.secondaryText}>{t('publish_back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, (!canContinue || submitting) && styles.submitDisabled]}
            onPress={() => {
              if (step < 4) {
                goStep(step + 1);
                return;
              }
              handleSubmit();
            }}
            disabled={!canContinue || submitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canContinue || submitting }}
          >
            {submitting ? (
              <ActivityIndicator color={themeColors.white} />
            ) : (
              <Text style={styles.submitText}>{step < 4 ? t('publish_continue') : t('publish_submit')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <Modal
        visible={neighborhoodPickerOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setNeighborhoodPickerOpen(false)}
      >
        <Pressable
          style={styles.neighborhoodModalBackdrop}
          onPress={() => setNeighborhoodPickerOpen(false)}
        >
          <KeyboardAvoidingView
            style={styles.neighborhoodKeyboardAvoiding}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable
              style={[styles.neighborhoodModal, isDark && styles.neighborhoodModalDark]}
              onPress={event => event.stopPropagation()}
            >
              <View style={styles.neighborhoodModalHeader}>
                <Text style={[styles.neighborhoodModalTitle, isDark && styles.reviewTextDark]}>
                  {t('publish_choose_neighborhood')}
                </Text>
                <TouchableOpacity
                  onPress={() => setNeighborhoodPickerOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel={t('close')}
                >
                  <Ionicons name="close" size={24} color={isDark ? themeColors.surfaceAlt : themeColors.onSurface} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.neighborhoodSearch}
                accessibilityLabel={t('publish_search_neighborhood')}
                value={neighborhoodQuery}
                onChangeText={setNeighborhoodQuery}
                placeholder={t('publish_search_neighborhood')}
                autoCorrect={false}
                returnKeyType="search"
              />
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                contentContainerStyle={styles.neighborhoodModalContent}
                showsVerticalScrollIndicator={true}
              >
                {filteredNeighborhoods.map(name => (
                  <TouchableOpacity
                    key={name}
                    style={styles.neighborhoodOption}
                    onPress={() => {
                      Keyboard.dismiss();
                      setFormData(previous => ({ ...previous, location: name }));
                      setCustomNeighborhood(false);
                      setNeighborhoodPickerOpen(false);
                      setNeighborhoodQuery('');
                    }}
                  >
                    <Text style={[styles.neighborhoodOptionText, isDark && styles.reviewTextDark]}>{name}</Text>
                    {formData.location === name && <Ionicons name="checkmark" size={20} color={themeColors.primary} />}
                  </TouchableOpacity>
                ))}
                {filteredNeighborhoods.length === 0 && (
                  <Text style={styles.neighborhoodEmpty}>{t('publish_no_neighborhood_match')}</Text>
                )}
                <TouchableOpacity
                  style={styles.neighborhoodOption}
                  onPress={() => {
                    Keyboard.dismiss();
                    setFormData(previous => ({ ...previous, location: '' }));
                    setCustomNeighborhood(true);
                    setNeighborhoodPickerOpen(false);
                    setNeighborhoodQuery('');
                  }}
                >
                  <Text style={[styles.neighborhoodOptionText, styles.neighborhoodCustomText]}>
                    {t('publish_enter_custom_neighborhood')}
                  </Text>
                  <Ionicons name="create-outline" size={18} color={themeColors.primary} />
                </TouchableOpacity>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
      <SmartPublishAssistant
        active={isSmartPublishActive}
        visible={smartPublishVisible}
        step={step}
        totalSteps={5}
        stepLabel={stepLabel}
        steps={smartPublishSteps}
        issues={smartPublishIssues}
        technicalError={smartPublishTechnicalError}
        onOpen={openSmartPublish}
        onClose={closeSmartPublish}
        onFix={field => {
          const fieldSteps: Record<PublishField, number> = {
            title: 0,
            price: 0,
            images: 1,
            city: 2,
            location: 2,
            clientPhone: 3,
          };
          const targetStep = fieldSteps[field];
          if (targetStep !== step) goStep(targetStep);
          if (field === 'location' && availableNeighborhoods.length > 0 && !customNeighborhood) {
            setNeighborhoodPickerOpen(true);
            return;
          }
          contentScrollRef.current?.scrollTo({ y: 0, animated: true });
          requestAnimationFrame(() => fieldRefs.current[field]?.focus());
        }}
        onRetry={handleSubmit}
      />
    </KeyboardAvoidingView>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingTop: 50,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    ...typography.title,
    color: COLORS.onSurface,
    flex: 1,
  },
  clearDraftButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.dangerContainer,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.onSurface,
    marginBottom: 8,
  },
  photoHint: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    marginBottom: 12,
  },
  stepHeader: {
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginBottom: 8,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: COLORS.borderStrong,
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  stepDotActive: {
    backgroundColor: COLORS.primary,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: COLORS.onSurface,
    marginBottom: 14,
  },
  inputInvalid: {
    borderColor: COLORS.danger,
    borderWidth: 2,
  },
  fieldError: {
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -10,
    marginBottom: 12,
  },
  neighborhoodSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  neighborhoodSelected: {
    color: COLORS.onSurface,
    fontSize: 15,
  },
  neighborhoodPlaceholder: {
    color: COLORS.onSurfaceMuted,
    fontSize: 15,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  photoButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  photoStrip: {
    marginBottom: 14,
  },
  photoThumbWrap: {
    marginRight: 10,
  },
  photoThumb: {
    width: 90,
    height: 70,
    borderRadius: 10,
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.scrimStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOrderActions: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    gap: 4,
  },
  photoOrderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.scrimHeavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMainHint: {
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeOptionText: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    fontWeight: '600',
  },
  neighborhoodModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.overlayNavy55,
  },
  neighborhoodKeyboardAvoiding: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  neighborhoodModal: {
    maxHeight: '85%',
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 28,
  },
  neighborhoodModalContent: {
    paddingBottom: 60,
  },
  neighborhoodModalDark: {
    backgroundColor: COLORS.onSurface,
  },
  neighborhoodModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  neighborhoodModalTitle: {
    color: COLORS.onSurface,
    fontSize: 18,
    fontWeight: '700',
  },
  neighborhoodSearch: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: COLORS.onSurface,
    marginBottom: 10,
  },
  neighborhoodOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  neighborhoodOptionText: {
    color: COLORS.onSurface,
    fontSize: 15,
  },
  neighborhoodCustomText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  neighborhoodEmpty: {
    color: COLORS.onSurfaceMuted,
    textAlign: 'center',
    paddingVertical: 18,
  },
  bottomPadding: {
    height: 120,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  secondaryDisabled: {
    opacity: 0.5,
  },
  secondaryText: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: COLORS.primaryDark,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  reviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  reviewCardDark: {
    backgroundColor: COLORS.onSurface,
    borderColor: COLORS.onSurfaceMuted,
  },
  reviewTitle: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  reviewPhotos: {
    marginBottom: 12,
  },
  reviewPhoto: {
    width: 112,
    height: 84,
    borderRadius: 10,
    marginRight: 8,
  },
  reviewPropertyTitle: {
    color: COLORS.onSurface,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  reviewType: {
    color: COLORS.onSurfaceMuted,
    fontSize: 13,
    marginTop: 4,
  },
  reviewPrice: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
  },
  reviewDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },
  reviewSectionTitle: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  reviewText: {
    color: COLORS.onSurfaceMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  reviewTextDark: {
    color: COLORS.surfaceAlt,
  },
  previewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  previewHint: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    marginTop: 5,
    marginBottom: 14,
  },
  previewImages: {
    marginHorizontal: -4,
    marginBottom: 14,
  },
  previewImage: {
    width: 180,
    height: 130,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  previewPropertyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  previewPrice: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 6,
  },
  previewMeta: {
    fontSize: 13,
    color: COLORS.onSurfaceMuted,
    marginTop: 5,
  },
  previewDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.onSurface,
    marginTop: 14,
  },
  previewDetails: {
    gap: 4,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  previewDetail: {
    fontSize: 13,
    color: COLORS.onSurfaceMuted,
  },
  previewContact: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  previewContactTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginBottom: 5,
  },
  locationPrivacyHint: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.onSurfaceMuted,
    marginTop: -2,
    marginBottom: 8,
  },
});

export default PublishScreen;
