import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../App';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { PROPERTY_TYPE_COLORS, Property, PropertyType } from '../types';
import COLORS from '../theme/colors';

type NavigationProp = StackNavigationProp<RootStackParamList>;
type PublishRouteProp = RouteProp<RootStackParamList, 'Publish'>;

const PublishScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PublishRouteProp>();
  const {
    addProperty,
    neighborhoods,
    addMyPropertyId,
    currentUser,
    properties,
    updateProperty,
    t,
    tType,
  } = useApp();
  const editingProperty = route.params?.propertyId
    ? properties.find(property => property.id === route.params?.propertyId)
    : undefined;
  const isEditing = Boolean(editingProperty);
  const MAX_IMAGES = 8;
  const [submitting, setSubmitting] = useState(false);
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [draftLoaded, setDraftLoaded] = useState(false);
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

  const hasDraftContent = (data: typeof formData, images: string[]) => {
    const contactFields = new Set(['clientName', 'clientPhone', 'clientEmail']);
    return (
      Object.entries(data).some(([key, value]) => !contactFields.has(key) && value.trim()) ||
      images.length > 0
    );
  };

  const draftKey = currentUser ? `imo:publish-draft:${currentUser.id}` : null;

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
          Alert.alert(
            'Brouillon disponible',
            'Voulez-vous reprendre votre annonce en cours ?',
            [
              {
                text: 'Non',
                style: 'cancel',
                onPress: () => {
                  void AsyncStorage.removeItem(draftKey);
                  setDraftLoaded(true);
                },
              },
              {
                text: 'Reprendre',
                onPress: () => {
                  if (draft.formData) setFormData(draft.formData);
                  if (draft.draftImages) setDraftImages(draft.draftImages);
                  if (typeof draft.step === 'number') setStep(Math.min(Math.max(draft.step, 0), 4));
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
    if (uri) setDraftImages(prev => [uri, ...prev]);
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
    if (draftKey) void AsyncStorage.removeItem(draftKey);
  };

  const clearDraft = () => {
    if (!draftKey || !hasDraftContent(formData, draftImages)) return;
    Alert.alert('Supprimer le brouillon ?', 'Toutes les informations saisies seront effacées.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: resetForm },
    ]);
  };

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const goStep = (next: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(next);
  };

  const numericInput = (value: string) => value.replace(/[^\d]/g, '');

  const handleSubmit = async () => {
    if (submitting) return;
    const priceValue = parseInt(formData.price, 10);
    const contactName = formData.clientName.trim() || currentUser?.name?.trim() || t('publish_advertiser');
    const contactPhone = formData.clientPhone.trim() || currentUser?.phone?.trim() || '';
    const contactEmail = formData.clientEmail.trim() || currentUser?.email?.trim() || '';
    if (
      !formData.title.trim() ||
      Number.isNaN(priceValue) ||
      priceValue <= 0 ||
      !formData.city.trim() ||
      !contactPhone
    ) {
      Alert.alert(t('error'), t('publish_required_error'));
      return;
    }

    if (draftImages.length === 0) {
      Alert.alert(t('error'), t('publish_photo_required_error'));
      return;
    }

    if (!currentUser) {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        Alert.alert(t('loginRequired'), t('publish_login_required'));
        navigation.navigate('MainTabs', { screen: 'Profile' });
        return;
      }
    }
    if (!currentUser || (currentUser.role !== 'AGENT' && currentUser.role !== 'ADMIN')) {
      Alert.alert(
        'Compte agent non validé',
        'Votre demande agent doit être validée par un administrateur avant la publication.'
      );
      return;
    }

    setSubmitting(true);
    try {
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
        status: 'available',
        listingStatus: 'pending',
        amenities: formData.amenities
          .split(',')
          .map(a => a.trim())
          .filter(Boolean),
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms, 10) : undefined,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms, 10) : undefined,
        featured: false,
        clientId: currentUser?.id ?? '',
        client: {
          id: currentUser?.id ?? `local-${Date.now()}`,
          name: contactName,
          email: contactEmail,
          phone: contactPhone,
          createdAt: new Date().toISOString(),
        },
      };
      if (editingProperty) {
        await updateProperty(editingProperty.id, { ...propertyData, listingStatus: 'pending', rejectionReason: null });
        addMyPropertyId(editingProperty.id);
      } else {
        const created = await addProperty(propertyData);
        addMyPropertyId(created.id);
      }

      Alert.alert(t('publish_success_title'), t('publish_success_message'));
      resetForm();
      navigation.goBack();
    } catch (e) {
      const message = e instanceof Error ? e.message : t('publish_unknown_error');
      Alert.alert(t('error'), message);
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabel = useMemo(() => {
    return [
      t('publish_step_info'),
      t('publish_step_photos'),
      t('publish_step_location'),
      t('publish_step_contact'),
    ][step] || t('publish_step_listing');
  }, [step, t]);

  const canContinue = useMemo(() => {
    if (step === 0) {
      return formData.title.trim().length > 0 && !!parseInt(formData.price, 10);
    }
    if (step === 1) {
      return draftImages.length > 0;
    }
    if (step === 2) {
      return formData.city.trim().length > 0;
    }
    if (step === 3) {
      return formData.clientPhone.trim().length > 0;
    }
    if (step === 4) {
      return Boolean(formData.title.trim() && formData.city.trim() && draftImages.length);
    }
    return true;
  }, [step, formData, draftImages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('publish_title')}</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={styles.contentContainer}
      >
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
              style={styles.input}
              value={formData.title}
              onChangeText={text => setFormData({ ...formData, title: text })}
              placeholder={t('publish_title_placeholder')}
            />

            <Text style={styles.inputLabel}>{t('publish_description_label')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
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
                  <Text style={[styles.typeOptionText, formData.type === type && { color: '#fff' }]}>
                    {tType(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>{t('publish_price_label')}</Text>
            <TextInput
              style={styles.input}
              value={formData.price}
              onChangeText={text => setFormData({ ...formData, price: text })}
              placeholder={t('publish_price_placeholder')}
              keyboardType="numeric"
            />
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.inputLabel}>{t('publish_photo_label')}</Text>
            <Text style={styles.photoHint}>
              {t('publish_photo_hint').replace(/\{\{max\}\}/g, String(MAX_IMAGES)).replace('{{count}}', String(draftImages.length))}
            </Text>
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoButton} onPress={addImageFromCamera}>
                <Ionicons name="camera" size={18} color={COLORS.primary} />
                <Text style={styles.photoButtonText}>{t('publish_camera')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={addImageFromLibrary}>
                <Ionicons name="images" size={18} color={COLORS.primary} />
                <Text style={styles.photoButtonText}>{t('publish_gallery')}</Text>
              </TouchableOpacity>
            </View>

            {draftImages.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                {draftImages.map(uri => (
                  <View key={uri} style={styles.photoThumbWrap}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <View style={styles.photoOrderActions}>
                      <TouchableOpacity
                        style={styles.photoOrderButton}
                        onPress={() => moveImage(uri, 'left')}
                        accessibilityLabel="Déplacer la photo vers la gauche"
                      >
                        <Ionicons name="chevron-back" size={13} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.photoOrderButton}
                        onPress={() => moveImage(uri, 'right')}
                        accessibilityLabel="Déplacer la photo vers la droite"
                      >
                        <Ionicons name="chevron-forward" size={13} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => setDraftImages(prev => prev.filter(x => x !== uri))}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            {draftImages.length > 0 && (
              <Text style={styles.photoMainHint}>
                La première photo est utilisée comme photo principale de l&apos;annonce.
              </Text>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.inputLabel}>{t('publish_city_label')}</Text>
            <TextInput
              style={styles.input}
              value={formData.city}
              onChangeText={text => setFormData({ ...formData, city: text })}
              placeholder={t('publish_city_placeholder')}
            />

            {neighborhoods.length > 0 && (
              <View style={styles.neighborhoodPicker}>
                <Text style={styles.neighborhoodPickerLabel}>{t('publish_choose_neighborhood')}</Text>
                <View style={styles.neighborhoodPickerList}>
                  {neighborhoods.map(name => (
                    <TouchableOpacity
                      key={name}
                      style={[
                        styles.neighborhoodPickerChip,
                        formData.location === name && styles.neighborhoodPickerChipActive,
                      ]}
                      onPress={() => setFormData({ ...formData, location: name })}
                    >
                      <Text
                        style={[
                          styles.neighborhoodPickerText,
                          formData.location === name && styles.neighborhoodPickerTextActive,
                        ]}
                      >
                        {name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.inputLabel}>{t('publish_neighborhood_label')}</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={text => setFormData({ ...formData, location: text })}
              placeholder={t('publish_neighborhood_placeholder')}
            />

            <Text style={styles.inputLabel}>{t('publish_area_label')}</Text>
            <TextInput
              style={styles.input}
              value={formData.area}
              onChangeText={text => setFormData({ ...formData, area: text })}
              placeholder={t('publish_area_placeholder')}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>{t('publish_bedrooms_label')}</Text>
            <TextInput
              style={styles.input}
              value={formData.bedrooms}
              onChangeText={text => setFormData({ ...formData, bedrooms: text })}
              placeholder={t('publish_bedrooms_placeholder')}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>{t('publish_bathrooms_label')}</Text>
            <TextInput
              style={styles.input}
              value={formData.bathrooms}
              onChangeText={text => setFormData({ ...formData, bathrooms: text })}
              placeholder={t('publish_bathrooms_placeholder')}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>{t('publish_amenities_label')}</Text>
            <TextInput
              style={styles.input}
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
              style={styles.input}
              value={formData.clientPhone}
              onChangeText={text => setFormData({ ...formData, clientPhone: text })}
              placeholder={t('publish_owner_phone_placeholder')}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>{t('publish_owner_name_label')}</Text>
            <TextInput
              style={styles.input}
              value={formData.clientName}
              onChangeText={text => setFormData({ ...formData, clientName: text })}
              placeholder={t('publish_owner_name_placeholder')}
            />

            <Text style={styles.inputLabel}>{t('publish_owner_email_label')}</Text>
            <TextInput
              style={styles.input}
              value={formData.clientEmail}
              onChangeText={text => setFormData({ ...formData, clientEmail: text })}
              placeholder={t('publish_owner_email_placeholder')}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{t('publish_summary')}</Text>
              <Text style={styles.summaryText}>{formData.title || t('publish_untitled')}</Text>
              <Text style={styles.summarySub}>
                {formData.location || t('publish_neighborhood_fallback')}  |  {formData.city || t('publish_city_fallback')}
              </Text>
              <Text style={styles.summaryPrice}>
                {formData.price ? `${formData.price} FCFA` : t('publish_price_to_define')}
              </Text>
            </View>
          </>
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
                if (!canContinue) return;
                goStep(step + 1);
                return;
              }
              handleSubmit();
            }}
            disabled={!canContinue || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{step < 3 ? t('publish_continue') : t('publish_submit')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  clearDraftButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
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
    color: COLORS.text,
    marginBottom: 8,
  },
  photoHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  stepHeader: {
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: COLORS.borderSoft,
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 14,
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
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMainHint: {
    color: COLORS.textMuted,
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
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  neighborhoodPicker: {
    marginBottom: 10,
  },
  neighborhoodPickerLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  neighborhoodPickerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  neighborhoodPickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  neighborhoodPickerChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  neighborhoodPickerText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  neighborhoodPickerTextActive: {
    color: '#fff',
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
    backgroundColor: '#fff',
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
    color: COLORS.text,
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
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  summaryCard: {
    marginTop: 12,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  summarySub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  summaryPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 8,
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  previewHint: {
    fontSize: 12,
    color: COLORS.textMuted,
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
    color: COLORS.text,
  },
  previewPrice: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 6,
  },
  previewMeta: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 5,
  },
  previewDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
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
    color: COLORS.textMuted,
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
    color: COLORS.text,
    marginBottom: 5,
  },
  locationPrivacyHint: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
    marginTop: -2,
    marginBottom: 8,
  },
});

export default PublishScreen;
