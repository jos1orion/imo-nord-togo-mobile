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
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../App';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { PROPERTY_TYPE_LABELS, PROPERTY_TYPE_COLORS, PropertyType } from '../types';
import COLORS from '../theme/colors';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const PublishScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { addProperty, neighborhoods, addMyPropertyId, currentUser, t } = useApp();
  const MAX_IMAGES = 8;
  const [submitting, setSubmitting] = useState(false);
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [step, setStep] = useState(0);
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

  useEffect(() => {
    if (!currentUser) return;
    setFormData(prev => ({
      ...prev,
      clientName: prev.clientName || currentUser.name || '',
      clientPhone: prev.clientPhone || currentUser.phone || '',
      clientEmail: prev.clientEmail || currentUser.email || '',
    }));
  }, [currentUser]);

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

  const handleSubmit = async () => {
    if (submitting) return;
    const priceValue = parseInt(formData.price, 10);
    const contactName = formData.clientName.trim() || currentUser?.name?.trim() || 'Annonceur';
    const contactPhone = formData.clientPhone.trim() || currentUser?.phone?.trim() || '';
    const contactEmail = formData.clientEmail.trim() || currentUser?.email?.trim() || '';
    if (
      !formData.title.trim() ||
      Number.isNaN(priceValue) ||
      !formData.city.trim() ||
      !formData.location.trim() ||
      !contactPhone
    ) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (draftImages.length === 0) {
      Alert.alert('Erreur', 'Ajoutez au moins une photo.');
      return;
    }

    if (!currentUser) {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        Alert.alert('Connexion requise', 'Veuillez vous connecter pour publier une annonce.');
        navigation.navigate('MainTabs', { screen: 'Profile' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const created = await addProperty({
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
      });
      addMyPropertyId(created.id);

      Alert.alert('Annonce envoyée', "Votre annonce est en attente de validation par l'administration.");
      resetForm();
      navigation.goBack();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue';
      Alert.alert('Erreur', message);
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabel = useMemo(() => {
    return ['Infos', 'Photos', 'Localisation', 'Contact'][step] || 'Annonce';
  }, [step]);

  const canContinue = useMemo(() => {
    if (step === 0) {
      return formData.title.trim().length > 0 && !!parseInt(formData.price, 10);
    }
    if (step === 1) {
      return draftImages.length > 0;
    }
    if (step === 2) {
      return formData.city.trim().length > 0 && formData.location.trim().length > 0;
    }
    if (step === 3) {
      return formData.clientPhone.trim().length > 0;
    }
    return true;
  }, [step, formData, draftImages]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Publier une annonce</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>Étape {step + 1}/4  |  {stepLabel}</Text>
          <View style={styles.stepDots}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[styles.stepDot, step >= i && styles.stepDotActive]} />
            ))}
          </View>
        </View>

        {step === 0 && (
          <>
            <Text style={styles.inputLabel}>Titre *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={text => setFormData({ ...formData, title: text })}
              placeholder="Ex: Villa moderne Kara"
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={text => setFormData({ ...formData, description: text })}
              placeholder="Décrivez le bien..."
              multiline
              numberOfLines={4}
            />

            <Text style={styles.inputLabel}>Type de bien</Text>
            <View style={styles.typeSelector}>
              {Object.entries(PROPERTY_TYPE_LABELS).map(([type, label]) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeOption,
                    formData.type === type && { backgroundColor: PROPERTY_TYPE_COLORS[type as PropertyType] },
                  ]}
                  onPress={() => setFormData({ ...formData, type: type as PropertyType })}
                >
                  <Text style={[styles.typeOptionText, formData.type === type && { color: '#fff' }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Prix (FCFA) *</Text>
            <TextInput
              style={styles.input}
              value={formData.price}
              onChangeText={text => setFormData({ ...formData, price: text })}
              placeholder="Ex: 50000000"
              keyboardType="numeric"
            />
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.inputLabel}>Photos *</Text>
            <Text style={styles.photoHint}>Ajoutez jusqu'à {MAX_IMAGES} photos ({draftImages.length}/{MAX_IMAGES}).</Text>
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoButton} onPress={addImageFromCamera}>
                <Ionicons name="camera" size={18} color={COLORS.primary} />
                <Text style={styles.photoButtonText}>Caméra</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={addImageFromLibrary}>
                <Ionicons name="images" size={18} color={COLORS.primary} />
                <Text style={styles.photoButtonText}>Galerie</Text>
              </TouchableOpacity>
            </View>

            {draftImages.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                {draftImages.map(uri => (
                  <View key={uri} style={styles.photoThumbWrap}>
                    <Image source={{ uri }} style={styles.photoThumb} />
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
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.inputLabel}>Localité (Ville) *</Text>
            <TextInput
              style={styles.input}
              value={formData.city}
              onChangeText={text => setFormData({ ...formData, city: text })}
              placeholder="Ex: Kara"
            />

            {neighborhoods.length > 0 && (
              <View style={styles.neighborhoodPicker}>
                <Text style={styles.neighborhoodPickerLabel}>Choisir un quartier</Text>
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

            <Text style={styles.inputLabel}>Quartier *</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={text => setFormData({ ...formData, location: text })}
              placeholder="Ex: Kpoda"
            />

            <Text style={styles.inputLabel}>Surface (m2)</Text>
            <TextInput
              style={styles.input}
              value={formData.area}
              onChangeText={text => setFormData({ ...formData, area: text })}
              placeholder="Ex: 200"
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Chambres</Text>
            <TextInput
              style={styles.input}
              value={formData.bedrooms}
              onChangeText={text => setFormData({ ...formData, bedrooms: text })}
              placeholder="Nombre de chambres"
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Salles de bain</Text>
            <TextInput
              style={styles.input}
              value={formData.bathrooms}
              onChangeText={text => setFormData({ ...formData, bathrooms: text })}
              placeholder="Nombre de salles de bain"
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Équipements (séparés par des virgules)</Text>
            <TextInput
              style={styles.input}
              value={formData.amenities}
              onChangeText={text => setFormData({ ...formData, amenities: text })}
              placeholder="Ex: Piscine, Jardin, Garage"
            />
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.inputLabel}>Téléphone du propriétaire *</Text>
            <TextInput
              style={styles.input}
              value={formData.clientPhone}
              onChangeText={text => setFormData({ ...formData, clientPhone: text })}
              placeholder="Ex: +228 90 12 34 56"
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Nom du propriétaire</Text>
            <TextInput
              style={styles.input}
              value={formData.clientName}
              onChangeText={text => setFormData({ ...formData, clientName: text })}
              placeholder="Ex: Koffi Mensah"
            />

            <Text style={styles.inputLabel}>Email du propriétaire</Text>
            <TextInput
              style={styles.input}
              value={formData.clientEmail}
              onChangeText={text => setFormData({ ...formData, clientEmail: text })}
              placeholder="Ex: contact@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Résumé</Text>
              <Text style={styles.summaryText}>{formData.title || 'Annonce sans titre'}</Text>
              <Text style={styles.summarySub}>
                {formData.location || 'Quartier'}  |  {formData.city || 'Ville'}
              </Text>
              <Text style={styles.summaryPrice}>
                {formData.price ? `${formData.price} FCFA` : 'Prix à définir'}
              </Text>
            </View>
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={[styles.secondaryButton, step === 0 && styles.secondaryDisabled]}
            onPress={() => goStep(Math.max(step - 1, 0))}
            disabled={step === 0}
          >
            <Text style={styles.secondaryText}>Retour</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, (!canContinue || submitting) && styles.submitDisabled]}
            onPress={() => {
              if (step < 3) {
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
              <Text style={styles.submitText}>{step < 3 ? 'Continuer' : "Publier l'annonce"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
  },
  content: {
    flex: 1,
    padding: 16,
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
});

export default PublishScreen;


