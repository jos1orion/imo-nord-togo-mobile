import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
  Share,
  LayoutAnimation,
  Platform,
  UIManager,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPE_COLORS,
  PropertyType,
  PropertyStatus,
  ListingStatus,
  Property,
  Client,
  User,
  Contract,
  Payment,
  Message,
  PremiumListing,
  CommissionRule,
  Document,
} from '../types';
import { formatPrice } from '../data/mock-data';
import COLORS from '../theme/colors';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

type TabType = 'dashboard' | 'properties' | 'clients' | 'accounts' | 'neighborhoods' | 'reports' | 'add' | 'messages' | 'reviews' | 'agents' | 'premium' | 'commissions' | 'transactions' | 'contracts' | 'documents';
type SearchScope =
  | 'ALL'
  | 'PROPERTIES'
  | 'CLIENTS'
  | 'USERS'
  | 'REPORTS'
  | 'MESSAGES'
  | 'CONTRACTS'
  | 'PAYMENTS'
  | 'REVIEWS'
  | 'AGENTS'
  | 'PREMIUM'
  | 'COMMISSIONS'
  | 'TRANSACTIONS'
  | 'DOCUMENTS';
type ListLimitKey =
  | 'properties'
  | 'clients'
  | 'users'
  | 'reports'
  | 'messages'
  | 'reviews'
  | 'agents'
  | 'premium'
  | 'commissions'
  | 'payments'
  | 'contracts'
  | 'documents';

const LIST_PAGE_SIZE = 20;

type AdminTheme = {
  name: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textSoft: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  headerBg: string;
  headerText: string;
  headerMuted: string;
  badgeBg: string;
  badgeText: string;
  shadow: string;
};

const lightTheme: AdminTheme = {
  name: 'light',
  bg: '#f1f5f9',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  surfaceMuted: '#f1f5f9',
  border: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#64748b',
  textSoft: '#94a3b8',
  accent: COLORS.primary,
  accentSoft: COLORS.infoBg,
  accentText: COLORS.primary,
  warning: '#b45309',
  warningSoft: '#fef9c3',
  info: '#1d4ed8',
  infoSoft: '#dbeafe',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  success: COLORS.accent,
  successSoft: COLORS.successBg,
  headerBg: '#ffffff',
  headerText: '#0f172a',
  headerMuted: '#64748b',
  badgeBg: '#eff6ff',
  badgeText: '#334155',
  shadow: '#0f172a',
};

const darkTheme: AdminTheme = {
  name: 'dark',
  bg: '#0a0f16',
  surface: '#0f172a',
  surfaceAlt: '#111c31',
  surfaceMuted: '#0b1220',
  border: '#1f2a3a',
  text: '#e5ecf6',
  textMuted: '#9aa7bd',
  textSoft: '#7c8aa5',
  accent: '#3B82F6',
  accentSoft: '#0B1B36',
  accentText: '#93C5FD',
  warning: '#fbbf24',
  warningSoft: '#3a2a12',
  info: '#22d3ee',
  infoSoft: '#102a34',
  danger: '#fb7185',
  dangerSoft: '#3a1a1a',
  success: COLORS.accent,
  successSoft: 'rgba(34,197,94,0.18)',
  headerBg: '#0a0f16',
  headerText: '#e5ecf6',
  headerMuted: '#9aa7bd',
  badgeBg: '#0f172a',
  badgeText: '#cbd5f5',
  shadow: '#0f172a',
};

const AdminScreen: React.FC = () => {
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);
  const {
    properties,
    clients,
    users,
    currentUser,
    neighborhoods,
    reports,
    resolveReport,
    updatePropertyStatus,
    deleteProperty,
    addProperty,
    addClient,
    updateProperty,
    updateClient,
    updateUser,
    verifyUser,
    addNeighborhood,
    updateNeighborhood,
    removeNeighborhood,
    replaceData,
    visitorCount,
    // New enhanced features
    messages,
    chats,
    reviews,
    agentProfiles,
    searchAlerts,
    premiumListings,
    commissionRules,
    documents,
    contracts,
    payments,
    addContract,
    updateContractStatus,
    addPayment,
    updatePaymentStatus,
    updateContract,
    updatePayment,
    tenantDocuments,
    addTenantDocumentRecord,
  } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const handleTabChange = (tab: TabType) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  };
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [contractModalVisible, setContractModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [uploadingTenantDocId, setUploadingTenantDocId] = useState<string | null>(null);
  const [tenantDocsModalVisible, setTenantDocsModalVisible] = useState(false);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState({ name: '', email: '', phone: '' });
  const [contractForm, setContractForm] = useState({
    propertyId: '',
    tenantId: '',
    startDate: '',
    endDate: '',
    rentAmount: '',
    status: 'active' as 'active' | 'expired',
  });
  const [paymentForm, setPaymentForm] = useState({
    contractId: '',
    amount: '',
    paidAt: '',
    method: 'cash' as 'cash' | 'mobile_money',
    status: 'paid' as 'paid' | 'late' | 'pending',
  });
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', phone: '' });
  const [newNeighborhood, setNewNeighborhood] = useState('');
  const [neighborhoodEditModalVisible, setNeighborhoodEditModalVisible] = useState(false);
  const [editingNeighborhoodName, setEditingNeighborhoodName] = useState<string | null>(null);
  const [neighborhoodEditValue, setNeighborhoodEditValue] = useState('');
  const [neighborhoodSaving, setNeighborhoodSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | 'ALL'>('ALL');
  const [listingFilter, setListingFilter] = useState<ListingStatus | 'ALL'>('ALL');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [adminTheme, setAdminTheme] = useState<'light' | 'dark'>('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('ALL');
  const [listLimits, setListLimits] = useState<Record<ListLimitKey, number>>({
    properties: LIST_PAGE_SIZE,
    clients: LIST_PAGE_SIZE,
    users: LIST_PAGE_SIZE,
    reports: LIST_PAGE_SIZE,
    messages: LIST_PAGE_SIZE,
    reviews: LIST_PAGE_SIZE,
    agents: LIST_PAGE_SIZE,
    premium: LIST_PAGE_SIZE,
    commissions: LIST_PAGE_SIZE,
    payments: LIST_PAGE_SIZE,
    contracts: LIST_PAGE_SIZE,
    documents: LIST_PAGE_SIZE,
  });

  const increaseLimit = (key: ListLimitKey) => {
    setListLimits(prev => ({ ...prev, [key]: prev[key] + LIST_PAGE_SIZE }));
  };

  // Admin gate (PIN) for backoffice + backup
  const [gateLoading, setGateLoading] = useState(true);
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  // Form state
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

  const [draftImages, setDraftImages] = useState<string[]>([]);
  const MAX_PROPERTY_IMAGES = 8;

  const resetPropertyForm = () => {
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
  };

  const openNewPropertyModal = () => {
    setEditingPropertyId(null);
    resetPropertyForm();
    setModalVisible(true);
  };

  const closePropertyModal = () => {
    setModalVisible(false);
    setEditingPropertyId(null);
  };

  const openEditPropertyModal = (property: Property) => {
    const client = clients.find(c => c.id === property.clientId);
    setEditingPropertyId(property.id);
    setFormData({
      title: property.title,
      description: property.description,
      type: property.type,
      price: String(property.price),
      area: property.area ? String(property.area) : '',
      city: property.location || '',
      location: property.neighborhood || '',
      clientName: client?.name || '',
      clientPhone: client?.phone || '',
      clientEmail: client?.email || '',
      bedrooms: property.bedrooms ? String(property.bedrooms) : '',
      bathrooms: property.bathrooms ? String(property.bathrooms) : '',
      amenities: property.amenities.join(', '),
    });
    setDraftImages(property.images || []);
    setModalVisible(true);
  };

  const openEditClientModal = (client: Client) => {
    setEditingClientId(client.id);
    setClientForm({
      name: client.name,
      email: client.email,
      phone: client.phone,
    });
    setClientModalVisible(true);
  };

  const closeClientModal = () => {
    setClientModalVisible(false);
    setEditingClientId(null);
    setClientForm({ name: '', email: '', phone: '' });
  };

  const openContractModal = () => {
    setEditingContractId(null);
    setContractForm({
      propertyId: properties[0]?.id || '',
      tenantId: clients[0]?.id || '',
      startDate: '',
      endDate: '',
      rentAmount: '',
      status: 'active',
    });
    setContractModalVisible(true);
  };

  const closeContractModal = () => {
    setContractModalVisible(false);
    setEditingContractId(null);
  };

  const openPaymentModal = () => {
    setEditingPaymentId(null);
    setPaymentForm({
      contractId: contracts[0]?.id || '',
      amount: '',
      paidAt: new Date().toISOString().slice(0, 10),
      method: 'cash',
      status: 'paid',
    });
    setPaymentModalVisible(true);
  };

  const closePaymentModal = () => {
    setPaymentModalVisible(false);
    setEditingPaymentId(null);
  };

  const openTenantDocs = (tenantId: string) => {
    setActiveTenantId(tenantId);
    setTenantDocsModalVisible(true);
  };

  const closeTenantDocs = () => {
    setTenantDocsModalVisible(false);
    setActiveTenantId(null);
  };

  const openEditContract = (contract: Contract) => {
    setEditingContractId(contract.id);
    setContractForm({
      propertyId: contract.propertyId,
      tenantId: contract.tenantId,
      startDate: contract.startDate,
      endDate: contract.endDate,
      rentAmount: String(contract.rentAmount),
      status: contract.status,
    });
    setContractModalVisible(true);
  };

  const openEditPayment = (payment: Payment) => {
    setEditingPaymentId(payment.id);
    setPaymentForm({
      contractId: payment.contractId,
      amount: String(payment.amount),
      paidAt: payment.paidAt,
      method: payment.method,
      status: payment.status,
    });
    setPaymentModalVisible(true);
  };

  const handleSaveContract = async () => {
    const rentAmount = parseFloat(contractForm.rentAmount);
    if (!contractForm.propertyId || !contractForm.tenantId || !contractForm.startDate || !contractForm.endDate || Number.isNaN(rentAmount)) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    try {
      if (editingContractId) {
        await updateContract(editingContractId, {
          propertyId: contractForm.propertyId,
          tenantId: contractForm.tenantId,
          startDate: contractForm.startDate,
          endDate: contractForm.endDate,
          rentAmount,
          status: contractForm.status,
        });
      } else {
        await addContract({
          propertyId: contractForm.propertyId,
          tenantId: contractForm.tenantId,
          startDate: contractForm.startDate,
          endDate: contractForm.endDate,
          rentAmount,
          status: contractForm.status,
        });
      }
      Alert.alert('Succes', editingContractId ? 'Contrat mis a jour.' : 'Contrat enregistre.');
      closeContractModal();
      setEditingContractId(null);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer le contrat.");
    }
  };

  const handleSavePayment = async () => {
    const amount = parseFloat(paymentForm.amount);
    if (!paymentForm.contractId || Number.isNaN(amount) || !paymentForm.paidAt) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    try {
      if (editingPaymentId) {
        await updatePayment(editingPaymentId, {
          contractId: paymentForm.contractId,
          amount,
          paidAt: paymentForm.paidAt,
          method: paymentForm.method,
          status: paymentForm.status,
        });
      } else {
        await addPayment({
          contractId: paymentForm.contractId,
          amount,
          paidAt: paymentForm.paidAt,
          method: paymentForm.method,
          status: paymentForm.status,
        });
      }
      Alert.alert('Succes', editingPaymentId ? 'Paiement mis a jour.' : 'Paiement enregistre.');
      closePaymentModal();
      setEditingPaymentId(null);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer le paiement.");
    }
  };

  const pickTenantDocType = () =>
    new Promise<'cni' | 'contract' | 'other' | null>(resolve => {
      Alert.alert('Type de document', 'Choisir le type', [
        { text: 'CNI', onPress: () => resolve('cni') },
        { text: 'Contrat', onPress: () => resolve('contract') },
        { text: 'Autre', onPress: () => resolve('other') },
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(null) },
      ]);
    });

  const getContractLabel = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return contractId;
    const property = properties.find(p => p.id === contract.propertyId);
    const tenant = clients.find(c => c.id === contract.tenantId);
    const propertyLabel = property?.title || 'Bien';
    const tenantLabel = tenant?.name || 'Locataire';
    return `${propertyLabel} ? ${tenantLabel}`;
  };

  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, char => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return map[char] ?? char;
    });

  const loadPrintModule = () => {
    try {
      return require('expo-print');
    } catch {
      return null;
    }
  };

  const printPaymentReceipt = async (payment: Payment) => {
    try {
      const PrintModule = loadPrintModule();
      if (!PrintModule?.printToFileAsync) {
        Alert.alert(
          'Recu PDF',
          "L'impression PDF n'est pas disponible dans Expo Go. Utilise un dev build."
        );
        return;
      }

      const contract = contracts.find(c => c.id === payment.contractId);
      const property = properties.find(p => p.id === contract?.propertyId);
      const tenant = clients.find(c => c.id === contract?.tenantId);

      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
              h1 { font-size: 20px; margin-bottom: 6px; }
              .muted { color: #64748b; font-size: 12px; }
              .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-top: 16px; }
              .row { display: flex; justify-content: space-between; margin: 6px 0; }
              .label { color: #475569; font-size: 12px; }
              .value { font-weight: 700; }
            </style>
          </head>
          <body>
            <h1>Reçu de paiement</h1>
            <div class="muted">Imo Nord Togo - ${new Date().toLocaleDateString('fr-FR')}</div>
            <div class="card">
              <div class="row"><div class="label">Locataire</div><div class="value">${escapeHtml(tenant?.name || 'Locataire')}</div></div>
              <div class="row"><div class="label">Bien</div><div class="value">${escapeHtml(property?.title || 'Bien')}</div></div>
              <div class="row"><div class="label">Contrat</div><div class="value">${escapeHtml(payment.contractId)}</div></div>
              <div class="row"><div class="label">Montant</div><div class="value">${escapeHtml(formatPrice(payment.amount))}</div></div>
              <div class="row"><div class="label">Date paiement</div><div class="value">${escapeHtml(new Date(payment.paidAt).toLocaleDateString('fr-FR'))}</div></div>
              <div class="row"><div class="label">Mode</div><div class="value">${escapeHtml(payment.method)}</div></div>
              <div class="row"><div class="label">Statut</div><div class="value">${escapeHtml(payment.status)}</div></div>
            </div>
          </body>
        </html>
      `;

      const normalizedHtml = html
        .replace(/Re\S* de paiement/u, 'Recu de paiement')
        .replace(/Imo Nord Togo[^<]*/u, value => {
          const date = value.match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
          return date ? `Imo Nord Togo - ${date}` : 'Imo Nord Togo';
        });

      const { uri } = await PrintModule.printToFileAsync({ html: normalizedHtml });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        await Share.share({ message: 'Recu de paiement', url: uri });
      }
    } catch {
      Alert.alert('Erreur', "Impossible de générer le reçu PDF.");
    }
  };

  const handleUploadTenantDocument = async (tenant: Client) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file?.uri) return;

      const docType = await pickTenantDocType();
      if (!docType) return;

      setUploadingTenantDocId(tenant.id);
      const safeName = (file.name || 'document').replace(/\s+/g, '-');
      const path = `${tenant.id}/${Date.now()}-${safeName}`;
      const { data: signed, error: signedError } = await supabase.storage
        .from('tenant-documents')
        .createSignedUploadUrl(path);
      if (signedError || !signed?.signedUrl) {
        console.warn('Signed upload URL error (tenant doc)', {
          error: signedError?.message ?? signedError,
          path,
          tenantId: tenant.id,
        });
        throw signedError ?? new Error('Signed upload error');
      }

      const uploadResult = await FileSystem.uploadAsync(signed.signedUrl, file.uri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': file.mimeType || 'application/octet-stream',
          'Cache-Control': '3600',
        },
      });
      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        console.warn('Signed upload failed (tenant doc)', {
          status: uploadResult.status,
          body: uploadResult.body,
          path,
          tenantId: tenant.id,
        });
        throw new Error(`Upload failed: ${uploadResult.status}`);
      }
      const { data: publicUrl } = supabase.storage.from('tenant-documents').getPublicUrl(path);
      const { data: docRow, error: docError } = await supabase
        .from('tenant_documents')
        .insert({
          tenant_id: tenant.id,
          type: docType,
          url: publicUrl.publicUrl,
        })
        .select()
        .single();
      if (docError) throw docError;
      if (docRow) {
        addTenantDocumentRecord({
          id: docRow.id,
          tenantId: docRow.tenant_id,
          type: docRow.type,
          url: docRow.url,
          createdAt: docRow.created_at ?? new Date().toISOString(),
        });
      }
      Alert.alert('Succes', 'Document ajoute.');
    } catch (err) {
      Alert.alert('Erreur', "Impossible d'ajouter le document.");
    } finally {
      setUploadingTenantDocId(null);
    }
  };

  const handleSaveClient = () => {
    if (!editingClientId) return;
    if (!clientForm.name.trim() || !clientForm.phone.trim()) {
      Alert.alert('Erreur', 'Nom et tlphone sont obligatoires');
      return;
    }
    updateClient(editingClientId, {
      name: clientForm.name.trim(),
      email: clientForm.email.trim(),
      phone: clientForm.phone.trim(),
    });
    Alert.alert('Succes', 'Locataire modifie avec succes.');
    closeClientModal();
  };

  const openEditUserModal = (user: User) => {
    setEditingUserId(user.id);
    setUserForm({
      name: user.name,
      email: user.email,
      phone: user.phone,
    });
    setUserModalVisible(true);
  };

  const closeUserModal = () => {
    setUserModalVisible(false);
    setEditingUserId(null);
    setUserForm({ name: '', email: '', phone: '' });
  };

  const handleSaveUser = () => {
    if (!editingUserId) return;
    if (!userForm.name.trim() || !userForm.phone.trim()) {
      Alert.alert('Erreur', 'Nom et tlphone sont obligatoires');
      return;
    }
    updateUser(editingUserId, {
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      phone: userForm.phone.trim(),
    });
    Alert.alert('Succes', 'Compte modifie avec succes.');
    closeUserModal();
  };

  const handleAddNeighborhood = () => {
    if (!newNeighborhood.trim()) {
      Alert.alert('Erreur', 'Entrez un nom de quartier.');
      return;
    }
    const exists = neighborhoods.some(
      name => name.toLowerCase() === newNeighborhood.trim().toLowerCase()
    );
    if (exists) {
      Alert.alert('Erreur', 'Ce quartier existe deja.');
      return;
    }
    addNeighborhood(newNeighborhood);
    setNewNeighborhood('');
  };

  const handleRemoveNeighborhood = (name: string) => {
    const usageCount = properties.filter(
      p => (p.neighborhood ?? '').toLowerCase() === name.toLowerCase()
    ).length;
    if (usageCount > 0) {
      Alert.alert(
        'Quartier utilise',
        `Ce quartier est utilise par ${usageCount} bien(s). Deplacez-les avant suppression.`
      );
      return;
    }
    Alert.alert(
      'Supprimer le quartier',
      `Supprimer "${name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => removeNeighborhood(name) },
      ]
    );
  };

  const openEditNeighborhood = (name: string) => {
    setEditingNeighborhoodName(name);
    setNeighborhoodEditValue(name);
    setNeighborhoodEditModalVisible(true);
  };

  const closeEditNeighborhood = () => {
    setNeighborhoodEditModalVisible(false);
    setEditingNeighborhoodName(null);
    setNeighborhoodEditValue('');
    setNeighborhoodSaving(false);
  };

  const handleUpdateNeighborhood = async () => {
    if (!editingNeighborhoodName) return;
    if (neighborhoodSaving) return;
    const cleaned = neighborhoodEditValue.trim();
    if (!cleaned) {
      Alert.alert('Erreur', 'Entrez un nom de quartier.');
      return;
    }
    try {
      setNeighborhoodSaving(true);
      await updateNeighborhood(editingNeighborhoodName, cleaned);
      Alert.alert('Succes', 'Quartier modifie avec succes.');
      closeEditNeighborhood();
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : "Impossible de modifier le quartier.";
      Alert.alert('Erreur', message);
    } finally {
      setNeighborhoodSaving(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const pin = await SecureStore.getItemAsync('admin_pin');
        if (!mounted) return;
        setStoredPin(pin);
      } finally {
        if (mounted) setGateLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const pending = properties.filter(p => p.status === 'available');
    const sold = properties.filter(p => p.status === 'occupied');

    const types: PropertyType[] = ['house', 'apartment', 'land', 'shop'];
    const propertiesByType = types.map(type => ({
      type,
      count: properties.filter(p => p.type === type).length,
    }));

    return {
      totalProperties: properties.length,
      totalClients: clients.length,
      pendingProperties: pending.length,
      soldProperties: sold.length,
      totalValue: properties.reduce((sum, p) => sum + p.price, 0),
      propertiesByType,
    };
  }, [properties, clients]);

  const theme = useMemo(() => (adminTheme === 'dark' ? darkTheme : lightTheme), [adminTheme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const contractCountByTenant = useMemo(() => {
    const map = new Map<string, number>();
    contracts.forEach(contract => {
      map.set(contract.tenantId, (map.get(contract.tenantId) ?? 0) + 1);
    });
    return map;
  }, [contracts]);

  if (!currentUser || !currentUser.isAdmin) {
    return (
      <View style={[styles.container, styles.gateContainer]}>
        <View style={styles.gateCard}>
          <Ionicons name="lock-closed" size={28} color={theme.accent} />
          <Text style={styles.gateTitle}>Accès réservé</Text>
          <Text style={styles.gateSubtitle}>
            Connectez-vous avec un compte administrateur pour accéder au back-office.
          </Text>
        </View>
      </View>
    );
  }

  const query = searchQuery.trim().toLowerCase();
  const hasQuery = query.length > 0;

  const scopeToTab: Record<SearchScope, TabType | null> = {
    ALL: null,
    PROPERTIES: 'properties',
    CLIENTS: 'clients',
    USERS: 'accounts',
    REPORTS: 'reports',
    MESSAGES: 'messages',
    CONTRACTS: 'contracts',
    PAYMENTS: 'transactions',
    REVIEWS: 'reviews',
    AGENTS: 'agents',
    PREMIUM: 'premium',
    COMMISSIONS: 'commissions',
    TRANSACTIONS: 'transactions',
    DOCUMENTS: 'documents',
  };

  const shouldFilter = hasQuery && (searchScope === 'ALL' || scopeToTab[searchScope] === activeTab);
  const includesQuery = (value: string | number | null | undefined) => {
    if (!shouldFilter || value === null || value === undefined) return true;
    return value.toString().toLowerCase().includes(query);
  };

  const searchScopes: { label: string; value: SearchScope }[] = [
    { label: 'Tout', value: 'ALL' },
    { label: 'Annonces', value: 'PROPERTIES' },
    { label: 'Locataires', value: 'CLIENTS' },
    { label: 'Contrats', value: 'CONTRACTS' },
    { label: 'Paiements', value: 'TRANSACTIONS' },
  ];

  const getStatusLabel = (property: Property) => {
    if (property.status === 'available') return 'Disponible';
    if (property.status === 'occupied') return 'Occupé';
    return property.status;
  };

  const getListingLabel = (status?: ListingStatus) => {
    if (status === 'pending') return 'En attente';
    if (status === 'approved') return 'Approuvé';
    if (status === 'rejected') return 'Refusé';
    if (status === 'archived') return 'Archivé';
    return status ?? 'Approuvé';
  };

  const logAdminAction = async (
    action: string,
    entity: string,
    entityId?: string,
    meta?: Record<string, unknown>
  ) => {
    try {
      await supabase.from('activity_logs').insert({
        action,
        entity,
        entity_id: entityId ?? null,
        actor_id: currentUser?.id ?? null,
        actor_name: [currentUser?.name, currentUser?.email].filter(Boolean).join(' — ') || null,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Ignore logging failures to avoid blocking admin actions.
    }
  };

  const handleSetListingStatus = async (property: Property, status: ListingStatus) => {
    await updateProperty(property.id, { listingStatus: status });
    logAdminAction('listing_status', 'property', property.id, { status });
  };

  const handleToggleFeatured = async (property: Property) => {
    const next = !property.featured;
    await updateProperty(property.id, { featured: next });
    logAdminAction('featured_toggle', 'property', property.id, { featured: next });
  };

  const handleAvailability = async (property: Property, status: PropertyStatus) => {
    await updatePropertyStatus(property.id, status);
    logAdminAction('availability', 'property', property.id, { status });
  };

  const handleVerifyUser = async (user: User, value: boolean) => {
    await verifyUser(user.id, value);
    logAdminAction('verify_user', 'user', user.id, { verified: value });
  };

  const confirmSold = (property: Property) => {
    Alert.alert(
      'Confirmer occupation',
      `Marquer "${property.title}" comme Occupé ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Occupé', style: 'destructive', onPress: () => handleAvailability(property, 'occupied') },
      ]
    );
  };

  const ActionButton = ({
    label,
    icon,
    onPress,
    style,
    color,
  }: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    style?: object;
    color: string;
  }) => (
    <TouchableOpacity style={[styles.actionButton, style]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );

  const QuickAction = ({
    label,
    icon,
    onPress,
    tone,
  }: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    tone?: 'primary' | 'danger';
  }) => (
    <TouchableOpacity
      style={[
        styles.quickActionButton,
        tone === 'primary' && styles.quickActionPrimary,
        tone === 'danger' && styles.quickActionDanger,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={14}
        color={tone === 'primary' ? theme.accentText : tone === 'danger' ? theme.danger : theme.textMuted}
      />
      <Text
        style={[
          styles.quickActionText,
          tone === 'primary' && styles.quickActionTextPrimary,
          tone === 'danger' && styles.quickActionTextDanger,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const handleQuickReply = (_message: Message) => {};
  const handleCloseMessage = (_messageId: string) => {};
  const handleVerifyReview = (_reviewId: string) => {};
  const handleHideReview = (_reviewId: string) => {};
  const handleRenewPremium = (_premium: PremiumListing) => {};
  const handleToggleCommission = (_rule: CommissionRule) => {};
  const handleMarkPaid = async (payment: { id: string }) => {
    try {
      await updatePaymentStatus(payment.id, 'paid');
    } catch {
      Alert.alert('Erreur', "Impossible de mettre a jour le paiement.");
    }
  };
  const handleDispute = async (payment: { id: string }) => {
    try {
      await updatePaymentStatus(payment.id, 'late');
    } catch {
      Alert.alert('Erreur', "Impossible de mettre a jour le paiement.");
    }
  };
  const handleOpenDocument = (_document: Document) => {};
  const handleShareDocument = (_document: Document) => {};

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleLock = () => {
    setUnlocked(false);
    setPinInput('');
  };

  const handleSetupPin = async () => {
    if (pinInput.trim().length < 4) {
      Alert.alert('PIN invalide', 'Le PIN doit contenir au moins 4 chiffres.');
      return;
    }
    if (pinInput !== pinConfirm) {
      Alert.alert('PIN different', 'La confirmation ne correspond pas.');
      return;
    }
    try {
      await SecureStore.setItemAsync('admin_pin', pinInput);
      setStoredPin(pinInput);
      setUnlocked(true);
      setPinInput('');
      setPinConfirm('');
      Alert.alert('Succes', 'PIN Admin enregistre.');
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer le PIN sur cet appareil.");
    }
  };

  const handleUnlock = () => {
    if (!storedPin) return;
    if (pinInput === storedPin) {
      setUnlocked(true);
      setPinInput('');
    } else {
      Alert.alert('Acces refuse', 'PIN incorrect.');
    }
  };

  const handleExportBackup = async () => {
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        properties,
        clients,
      };

      const json = JSON.stringify(payload, null, 2);
      const safeDate = new Date().toISOString().replace(/[:.]/g, '-');
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) throw new Error('NO_FS_DIR');

      const uri = `${baseDir}imo-nord-togo-backup-${safeDate}.json`;
      await FileSystem.writeAsStringAsync(uri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const shareAvailable = await Sharing.isAvailableAsync();
      if (shareAvailable) {
        await Sharing.shareAsync(uri, {
          dialogTitle: 'Exporter le backup',
          mimeType: 'application/json',
        });
      } else {
        await Share.share({ message: json });
      }
    } catch {
      Alert.alert('Erreur', "Impossible d'exporter le backup.");
    }
  };

  const isValidBackup = (data: any): data is { properties: any[]; clients: any[] } => {
    return data && typeof data === 'object' && Array.isArray(data.properties) && Array.isArray(data.clients);
  };

  const handleImportBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;

      const picked = result.assets?.[0];
      if (!picked?.uri) {
        Alert.alert('Erreur', 'Fichier non support.');
        return;
      }

      const content = await FileSystem.readAsStringAsync(picked.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const parsed = JSON.parse(content);

      if (!isValidBackup(parsed)) {
        Alert.alert('Backup invalide', 'Le fichier ne contient pas les donnes attendues.');
        return;
      }

      Alert.alert(
        'Importer backup',
        "Cette action remplacera les donnes actuelles. Continuer ?",
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Importer',
            style: 'destructive',
            onPress: () => {
              replaceData({ properties: parsed.properties, clients: parsed.clients });
              Alert.alert('Succes', 'Backup importe.');
            },
          },
        ]
      );
    } catch {
      Alert.alert('Erreur', "Impossible d'importer le backup.");
    }
  };

  const addImageFromLibrary = async () => {
    try {
      const remaining = MAX_PROPERTY_IMAGES - draftImages.length;
      if (remaining <= 0) {
        Alert.alert('Limite atteinte', `Maximum ${MAX_PROPERTY_IMAGES} images par bien.`);
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission requise', "Autorisez l'acces aux photos pour choisir une image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.7,
      });
      if (result.canceled) return;

      const uris = (result.assets ?? [])
        .map(asset => asset.uri)
        .filter(Boolean)
        .slice(0, remaining);
      if (uris.length > 0) {
        setDraftImages(prev => [...uris, ...prev].slice(0, MAX_PROPERTY_IMAGES));
      }
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir la galerie.");
    }
  };

  const addImageFromCamera = async () => {
    try {
      const remaining = MAX_PROPERTY_IMAGES - draftImages.length;
      if (remaining <= 0) {
        Alert.alert('Limite atteinte', `Maximum ${MAX_PROPERTY_IMAGES} images par bien.`);
        return;
      }
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission requise', 'Autorisez la camra pour prendre une photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
      });
      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (uri) setDraftImages(prev => [uri, ...prev].slice(0, MAX_PROPERTY_IMAGES));
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir la camra.");
    }
  };

  const handleAddProperty = async () => {
    if (draftImages.length > MAX_PROPERTY_IMAGES) {
      Alert.alert('Erreur', `Maximum ${MAX_PROPERTY_IMAGES} images par bien.`);
      return;
    }
    const priceValue = parseInt(formData.price, 10);
    if (
      !formData.title.trim() ||
      Number.isNaN(priceValue) ||
      !formData.city.trim() ||
      !formData.location.trim() ||
      !formData.clientPhone.trim()
    ) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (draftImages.length === 0) {
      Alert.alert('Erreur', 'Ajoutez au moins une photo pour publier cette annonce.');
      return;
    }

    addNeighborhood(formData.location.trim());

    if (editingPropertyId) {
      const existingProperty = properties.find(p => p.id === editingPropertyId);

      await updateProperty(editingPropertyId, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        price: priceValue,
        area: parseInt(formData.area, 10) || 0,
        location: formData.city.trim(),
        neighborhood: formData.location.trim() || undefined,
        city: formData.city.trim(),
        images: draftImages,
        amenities: formData.amenities
          .split(',')
          .map(a => a.trim())
          .filter(Boolean),
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms, 10) : undefined,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms, 10) : undefined,
        featured: existingProperty?.featured ?? false,
        status: existingProperty?.status ?? 'available',
        // client_id references auth.users in Supabase; a tenant id must never be written here.
        clientId: currentUser?.id ?? existingProperty?.clientId ?? '',
        contactName: formData.clientName.trim() || null,
        contactPhone: formData.clientPhone.trim() || null,
        contactEmail: formData.clientEmail.trim() || null,
      });
      logAdminAction('update', 'property', editingPropertyId, {
        title: formData.title.trim(),
      });

      Alert.alert('Succes', 'Annonce modifiee avec succes.');
    } else {
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
        amenities: formData.amenities
          .split(',')
          .map(a => a.trim())
          .filter(Boolean),
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms, 10) : undefined,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms, 10) : undefined,
        featured: false,
        // Keep tenant data separate from the authenticated listing owner.
        clientId: currentUser?.id ?? '',
        contactName: formData.clientName.trim() || null,
        contactPhone: formData.clientPhone.trim() || null,
        contactEmail: formData.clientEmail.trim() || null,
      });
      logAdminAction('create', 'property', created.id, { title: created.title });

      Alert.alert('Succes', 'Annonce ajoutee avec succes.');
    }

    closePropertyModal();
    resetPropertyForm();
  };
  const handleDeleteProperty = (id: string, title: string) => {
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment supprimer "${title}"?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          await deleteProperty(id);
          logAdminAction('delete', 'property', id, { title });
        } },
      ]
    );
  };

  const renderDashboard = () => {
    const pendingListings = properties.filter(p => (p.listingStatus ?? 'pending') === 'pending').length;
    const unreadMessages = messages.filter(m => !m.read).length;
    const pendingTransactions = payments.filter(p => p.status === 'pending').length;
    const recentProperties = [...properties]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <View>
              <Text style={styles.overviewTitle}>Vue rapide</Text>
              <Text style={styles.overviewSubtitle}>Alertes prioritaires du jour</Text>
            </View>
            <View style={styles.overviewBadge}>
              <Text style={styles.overviewBadgeText}>Live</Text>
            </View>
          </View>
          <View style={styles.overviewGrid}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Annonces a valider</Text>
              <Text style={styles.overviewValue}>{pendingListings}</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Messages</Text>
              <Text style={styles.overviewValue}>{unreadMessages}</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Paiements en attente</Text>
              <Text style={styles.overviewValue}>{pendingTransactions}</Text>
            </View>
          </View>
        </View>

      {/* Backup */}
      <View style={styles.backupCard}>
        <View style={styles.backupHeader}>
          <Text style={styles.backupTitle}>Sauvegarde</Text>
          <Text style={styles.backupSub}>Exporter / importer les donnees</Text>
        </View>
        <View style={styles.backupActions}>
          <TouchableOpacity style={styles.backupButton} onPress={handleExportBackup}>
            <Ionicons name="download" size={18} color="#fff" />
            <Text style={styles.backupButtonText}>Exporter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backupButtonSecondary} onPress={handleImportBackup}>
            <Ionicons name="cloud-upload" size={18} color={theme.accentText} />
            <Text style={styles.backupButtonTextSecondary}>Importer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Links */}
      <View style={styles.quickLinks}>
        <TouchableOpacity
          style={styles.quickLinkButton}
          onPress={() => setActiveTab('neighborhoods')}
        >
          <Ionicons name="location" size={16} color={theme.accentText} />
          <Text style={styles.quickLinkText}>Gerer quartiers</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsGrid}
        contentContainerStyle={styles.statsGridContent}
      >
        <View style={[styles.statCard, styles.cardElevated]}>
          <View style={[styles.statAccent, { backgroundColor: theme.accentSoft }]} />
          <View style={styles.statHeaderRow}>
            <View style={[styles.statIconWrap, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="home" size={16} color={theme.accentText} />
            </View>
            <Text style={styles.statMeta}>Inventaire</Text>
          </View>
          <Text style={styles.statNumber}>{stats.totalProperties}</Text>
          <Text style={styles.statLabel}>Biens</Text>
        </View>

        <View style={[styles.statCard, styles.cardElevated]}>
          <View style={[styles.statAccent, { backgroundColor: theme.info }]} />
          <View style={styles.statHeaderRow}>
            <View style={[styles.statIconWrap, { backgroundColor: theme.infoSoft }]}>
              <Ionicons name="people" size={16} color={theme.info} />
            </View>
            <Text style={styles.statMeta}>Base locataires</Text>
          </View>
          <Text style={styles.statNumber}>{stats.totalClients}</Text>
          <Text style={styles.statLabel}>Locataires</Text>
        </View>

        <View style={[styles.statCard, styles.cardElevated]}>
          <View style={[styles.statAccent, { backgroundColor: '#4f46e5' }]} />
          <View style={styles.statHeaderRow}>
            <View style={[styles.statIconWrap, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name="people-circle" size={16} color={theme.text} />
            </View>
            <Text style={styles.statMeta}>Audience</Text>
          </View>
          <Text style={styles.statNumber}>{visitorCount}</Text>
          <Text style={styles.statLabel}>Visiteurs</Text>
        </View>

        <View style={[styles.statCard, styles.cardElevated]}>
          <View style={[styles.statAccent, { backgroundColor: theme.warning }]} />
          <View style={styles.statHeaderRow}>
            <View style={[styles.statIconWrap, { backgroundColor: theme.warningSoft }]}>
              <Ionicons name="time" size={16} color={theme.warning} />
            </View>
            <Text style={styles.statMeta}>Backlog</Text>
          </View>
          <Text style={styles.statNumber}>{stats.pendingProperties}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>

        <View style={[styles.statCard, styles.cardElevated]}>
          <View style={[styles.statAccent, { backgroundColor: theme.headerBg }]} />
          <View style={styles.statHeaderRow}>
            <View style={[styles.statIconWrap, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name="checkmark-circle" size={16} color={theme.text} />
            </View>
            <Text style={styles.statMeta}>Clotures</Text>
          </View>
          <Text style={styles.statNumber}>{stats.soldProperties}</Text>
          <Text style={styles.statLabel}>Vendus/Loues</Text>
        </View>
      </ScrollView>

      {/* Value Card */}
      <View style={styles.valueCard}>
        <Text style={styles.valueLabel}>Valeur totale du portefeuille</Text>
        <Text style={styles.valueAmount}>{formatPrice(stats.totalValue)}</Text>
      </View>

      {/* Properties by Type */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Repartition par type</Text>
          <Text style={styles.sectionSubtitle}>Lecture rapide du mix d'annonces.</Text>
        </View>
      </View>
      <View style={styles.typeBreakdown}>
        {stats.propertiesByType.map(item => (
          <View key={item.type} style={styles.typeRow}>
            <View style={styles.typeInfo}>
              <View style={[styles.typeDot, { backgroundColor: PROPERTY_TYPE_COLORS[item.type] }]} />
              <Text style={styles.typeName}>{PROPERTY_TYPE_LABELS[item.type]}</Text>
            </View>
            <View style={styles.typeBar}>
              <View
                style={[
                  styles.typeBarFill,
                  {
                    backgroundColor: PROPERTY_TYPE_COLORS[item.type],
                    width: ((item.count / stats.totalProperties) * 100 + '%') as `${number}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.typeCount}>{item.count}</Text>
          </View>
        ))}
      </View>

      {/* Recent Activity */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Activite recente</Text>
          <Text style={styles.sectionSubtitle}>Dernieres actions sur les annonces.</Text>
        </View>
        {properties.length > recentProperties.length && (
          <TouchableOpacity onPress={() => setActiveTab('properties')}>
            <Text style={styles.sectionLink}>Voir tout</Text>
          </TouchableOpacity>
        )}
      </View>
      {recentProperties.map(property => (
        <View key={property.id} style={styles.activityItem}>
          <View style={[styles.activityIcon, { backgroundColor: PROPERTY_TYPE_COLORS[property.type] + '20' }]}>
            <Ionicons name="home" size={16} color={PROPERTY_TYPE_COLORS[property.type]} />
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle} numberOfLines={1}>{property.title}</Text>
            <Text style={styles.activitySubtitle}>{formatPrice(property.price)}</Text>
          </View>
          <Text style={styles.activityDate}>
            {new Date(property.createdAt).toLocaleDateString('fr-FR')}
          </Text>
        </View>
      ))}
      </ScrollView>
    );

  };

  const renderProperties = () => {
    let filteredProperties =
      statusFilter === 'ALL' ? properties : properties.filter(p => p.status === statusFilter);
    if (listingFilter !== 'ALL') {
      filteredProperties = filteredProperties.filter(
        p => (p.listingStatus ?? 'approved') === listingFilter
      );
    }
    if (featuredOnly) {
      filteredProperties = filteredProperties.filter(p => p.featured);
    }
    const searchedProperties = shouldFilter
      ? filteredProperties.filter(p =>
          includesQuery(p.title) ||
          includesQuery(p.location) ||
          includesQuery(p.neighborhood ?? '') ||
          includesQuery(p.city ?? '') ||
          includesQuery(p.id)
        )
      : filteredProperties;
    const visibleProperties = searchedProperties.slice(0, listLimits.properties);
    const hasMoreProperties = searchedProperties.length > listLimits.properties;

    const listHeader = (
      <View>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Annonces</Text>
            <Text style={styles.sectionSubtitle}>Validation, priorite et qualite.</Text>
          </View>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{searchedProperties.length}</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
          {(['ALL', 'available', 'occupied'] as const).map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterTab,
                statusFilter === status && styles.filterTabActive,
              ]}
              onPress={() => setStatusFilter(status)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  statusFilter === status && styles.filterTabTextActive,
                ]}
              >
                {status === 'ALL'
                  ? 'Tous'
                  : status === 'available'
                  ? 'Disponibles'
                  : 'Occupés'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
          {(['ALL', 'pending', 'approved', 'rejected', 'archived'] as const).map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterTab,
                listingFilter === status && styles.filterTabActive,
              ]}
              onPress={() => setListingFilter(status)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  listingFilter === status && styles.filterTabTextActive,
                ]}
              >
                {status === 'ALL'
                  ? 'Validation'
                  : status === 'pending'
                  ? 'En attente'
                  : status === 'approved'
                  ? 'Approuvé'
                  : status === 'rejected'
                  ? 'Refusé'
                  : 'Archivé'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.filterToggleRow}>
          <TouchableOpacity
            style={[styles.filterToggle, featuredOnly && styles.filterToggleActive]}
            onPress={() => setFeaturedOnly(prev => !prev)}
          >
            <Ionicons
              name={featuredOnly ? 'star' : 'star-outline'}
              size={14}
              color={featuredOnly ? theme.warning : theme.textMuted}
            />
            <Text style={[styles.filterToggleText, featuredOnly && styles.filterToggleTextActive]}>
              Vedette
            </Text>
          </TouchableOpacity>
        </View>
        {searchedProperties.length === 0 && (
          <Text style={styles.emptyText}>Aucune annonce pour ce filtre.</Text>
        )}
      </View>
    );

    return (
      <FlatList
        style={styles.tabContent}
        data={visibleProperties}
        keyExtractor={item => item.id}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          hasMoreProperties ? (
            <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('properties')}>
              <Text style={styles.loadMoreText}>Charger plus</Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item: property }) => {
          const cover =
            (property.images || []).find(
              value => typeof value === 'string' && value.trim().length > 0 && value !== 'null'
            ) ?? null;
          const listingStatus = property.listingStatus ?? 'approved';
          return (
            <View style={styles.propertyCard}>
              <View style={styles.propertyImageWrap}>
                {cover ? (
                  <Image source={{ uri: cover }} style={styles.propertyImage} />
                ) : (
                  <View style={styles.propertyImageFallback}>
                    <Ionicons name="image-outline" size={18} color={theme.textMuted} />
                  </View>
                )}
                {property.featured ? (
                  <View style={styles.featuredBadge}>
                    <Ionicons name="star" size={12} color={theme.warning} />
                    <Text style={styles.featuredBadgeText}>Vedette</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.propertyHeaderRow}>
                <View style={[styles.propertyTypeBadge, { backgroundColor: PROPERTY_TYPE_COLORS[property.type] }]}>
                  <Text style={styles.propertyTypeText}>{PROPERTY_TYPE_LABELS[property.type]}</Text>
                </View>
                <View style={styles.statusStack}>
                  <View
                    style={[
                      styles.statusBadge,
                      property.status === 'available' && styles.statusAvailable,
                      property.status === 'occupied' && styles.statusOccupied,
                    ]}
                  >
                    <Text style={styles.statusText}>{getStatusLabel(property)}</Text>
                  </View>
                  <View
                    style={[
                      styles.listingBadge,
                      listingStatus === 'pending' && styles.listingPending,
                      listingStatus === 'approved' && styles.listingApproved,
                      listingStatus === 'rejected' && styles.listingRejected,
                      listingStatus === 'archived' && styles.listingArchived,
                    ]}
                  >
                    <Text style={styles.listingText}>{getListingLabel(listingStatus)}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.propertyTitle} numberOfLines={1}>{property.title}</Text>
              <Text style={styles.propertyLocation}>
                {[property.neighborhood, property.location].filter(Boolean).join(' | ')}
              </Text>
              <Text style={styles.propertyPrice}>{formatPrice(property.price)}</Text>

              <View style={styles.actionGrid}>
                <ActionButton
                  label="VIP"
                  icon={property.featured ? 'star' : 'star-outline'}
                  onPress={() => handleToggleFeatured(property)}
                  style={property.featured ? styles.actionVipActive : styles.actionVip}
                  color={property.featured ? theme.warning : theme.textMuted}
                />
                {listingStatus !== 'approved' && (
                  <ActionButton
                    label="Valider"
                    icon="checkmark-circle"
                    onPress={() => handleSetListingStatus(property, 'approved')}
                    style={styles.actionApprove}
                    color={theme.success}
                  />
                )}
                {listingStatus !== 'rejected' && (
                  <ActionButton
                    label="Refuser"
                    icon="close-circle"
                    onPress={() => handleSetListingStatus(property, 'rejected')}
                    style={styles.actionReject}
                    color={theme.danger}
                  />
                )}
                {listingStatus !== 'archived' && (
                  <ActionButton
                    label="Archiver"
                    icon="archive"
                    onPress={() => handleSetListingStatus(property, 'archived')}
                    style={styles.actionArchive}
                    color={theme.textMuted}
                  />
                )}
                <ActionButton
                  label="Editer"
                  icon="create-outline"
                  onPress={() => openEditPropertyModal(property)}
                  style={styles.actionEdit}
                  color={theme.accent}
                />
                {property.status !== 'available' && (
                  <ActionButton
                    label="Disponible"
                    icon="checkmark"
                    onPress={() => handleAvailability(property, 'available')}
                    style={styles.actionApprove}
                    color={theme.success}
                  />
                )}
                {property.status !== 'occupied' && (
                  <ActionButton
                    label="Occupé"
                    icon="key-outline"
                    onPress={() => confirmSold(property)}
                    style={styles.actionSold}
                    color={theme.warning}
                  />
                )}
                <ActionButton
                  label="Supprimer"
                  icon="trash"
                  onPress={() => handleDeleteProperty(property.id, property.title)}
                  style={styles.actionDelete}
                  color={theme.textMuted}
                />
              </View>
            </View>
          );
        }}
      />
    );
  };

  const renderClients = () => {
    const filteredClients = shouldFilter
      ? clients.filter(client =>
          includesQuery(client.name) ||
          includesQuery(client.email) ||
          includesQuery(client.phone) ||
          includesQuery(client.id)
        )
      : clients;
    const visibleClients = filteredClients.slice(0, listLimits.clients);
    const hasMoreClients = filteredClients.length > listLimits.clients;

    const listHeader = (
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Locataires</Text>
          <Text style={styles.sectionSubtitle}>Contacts et contrats en cours.</Text>
        </View>
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{filteredClients.length}</Text>
        </View>
      </View>
    );

    return (
      <FlatList
        style={styles.tabContent}
        data={visibleClients}
        keyExtractor={item => item.id}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          hasMoreClients ? (
            <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('clients')}>
              <Text style={styles.loadMoreText}>Charger plus</Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item: client }) => (
          <View style={styles.clientItem}>
            <View style={styles.clientAvatar}>
              <Text style={styles.clientInitials}>{client.name.charAt(0)}</Text>
            </View>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{client.name}</Text>
              <Text style={styles.clientEmail}>{client.email}</Text>
              <Text style={styles.clientPhone}>{client.phone}</Text>
            </View>
            <View style={styles.clientStats}>
              <Text style={styles.clientPropertyCount}>
                {contractCountByTenant.get(client.id) ?? 0} contrats
              </Text>
              <TouchableOpacity
                style={styles.clientEditButton}
                onPress={() => handleUploadTenantDocument(client)}
              >
                {uploadingTenantDocId === client.id ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Ionicons name="document-attach-outline" size={16} color={theme.accent} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.clientEditButton}
                onPress={() => openTenantDocs(client.id)}
              >
                <Ionicons name="folder-open-outline" size={16} color={theme.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.clientEditButton}
                onPress={() => openEditClientModal(client)}
              >
                <Ionicons name="create-outline" size={16} color={theme.accent} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    );
  };

  const renderAccounts = () => {
    const filteredUsers = shouldFilter
      ? users.filter(user =>
          includesQuery(user.name) ||
          includesQuery(user.email) ||
          includesQuery(user.phone) ||
          includesQuery(user.id)
        )
      : users;
    const visibleUsers = filteredUsers.slice(0, listLimits.users);
    const hasMoreUsers = filteredUsers.length > listLimits.users;

    const listHeader = (
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Comptes</Text>
          <Text style={styles.sectionSubtitle}>Verification et acces utilisateurs.</Text>
        </View>
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{filteredUsers.length}</Text>
        </View>
      </View>
    );

    return (
      <FlatList
        style={styles.tabContent}
        data={visibleUsers}
        keyExtractor={item => item.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun compte pour le moment.</Text>}
        ListFooterComponent={
          hasMoreUsers ? (
            <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('users')}>
              <Text style={styles.loadMoreText}>Charger plus</Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item: user }) => (
          <View style={styles.accountItem}>
            <View style={styles.accountAvatar}>
              <Text style={styles.accountInitials}>{user.name.charAt(0)}</Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{user.name}</Text>
              <Text style={styles.accountMeta}>{user.email}</Text>
              <Text style={styles.accountMeta}>{user.phone}</Text>
            </View>
            <View style={styles.accountActions}>
              <TouchableOpacity
                style={[
                  styles.accountVerifyButton,
                  user.verified ? styles.accountVerifyOff : styles.accountVerifyOn,
                ]}
                onPress={() => handleVerifyUser(user, !user.verified)}
              >
                <Text style={[
                  styles.accountVerifyText,
                  user.verified && { color: theme.textMuted },
                ]}>
                  {user.verified ? 'Retirer' : 'Verifier'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.accountEditButton}
                onPress={() => openEditUserModal(user)}
              >
                <Ionicons name="create-outline" size={16} color={theme.accent} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    );
  };

  const renderNeighborhoods = () => {
    const filteredNeighborhoods = shouldFilter
      ? neighborhoods.filter(name => includesQuery(name))
      : neighborhoods;
    const sortedNeighborhoods = [...filteredNeighborhoods].sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'base' })
    );

      return (
        <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Quartiers</Text>
            <Text style={styles.sectionSubtitle}>Zones principales de publication.</Text>
          </View>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{filteredNeighborhoods.length}</Text>
          </View>
        </View>
        <View style={styles.neighborhoodInputRow}>
          <TextInput
            style={[styles.input, styles.neighborhoodInput]}
            value={newNeighborhood}
            onChangeText={setNewNeighborhood}
            placeholder="Ajouter un quartier"
            placeholderTextColor={theme.textSoft}
          />
          <TouchableOpacity style={styles.neighborhoodAddButton} onPress={handleAddNeighborhood}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.neighborhoodList}>
          {sortedNeighborhoods.length === 0 && (
            <Text style={styles.emptyText}>Aucun quartier pour le moment.</Text>
          )}
            {sortedNeighborhoods.map(name => {
              const count = properties.filter(
                p => (p.neighborhood ?? '').toLowerCase() === name.toLowerCase()
              ).length;
              return (
                <View key={name} style={styles.neighborhoodChipRow}>
                  <TouchableOpacity
                    style={styles.neighborhoodChip}
                    onPress={() => openEditNeighborhood(name)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.neighborhoodChipText}>{name}</Text>
                    <View style={styles.neighborhoodCount}>
                      <Text style={styles.neighborhoodCountText}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.neighborhoodActions}>
                    <TouchableOpacity
                      style={styles.neighborhoodEdit}
                      onPress={() => openEditNeighborhood(name)}
                    >
                      <Ionicons name="create-outline" size={16} color={theme.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.neighborhoodDelete}
                      onPress={() => handleRemoveNeighborhood(name)}
                    >
                      <Ionicons name="trash" size={16} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

        </View>
      </ScrollView>
    );
  };

  const renderReports = () => {
    const filteredReports = shouldFilter
      ? reports.filter(report => {
          const property = properties.find(p => p.id === report.propertyId);
          return (
            includesQuery(report.reason) ||
            includesQuery(report.message) ||
            includesQuery(report.propertyId) ||
            includesQuery(property?.title) ||
            includesQuery(property?.location)
          );
        })
      : reports;
    const visibleReports = filteredReports.slice(0, listLimits.reports);
    const hasMoreReports = filteredReports.length > listLimits.reports;

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Signalements</Text>
            <Text style={styles.sectionSubtitle}>Moderation et alertes fraude.</Text>
          </View>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{filteredReports.length}</Text>
          </View>
        </View>
        {filteredReports.length === 0 ? (
          <Text style={styles.emptyText}>Aucun signalement pour le moment.</Text>
        ) : (
          visibleReports.map(report => {
            const property = properties.find(p => p.id === report.propertyId);
            return (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportTitle}>{property?.title || 'Annonce supprimee'}</Text>
                  <View
                    style={[
                      styles.reportStatus,
                      report.status === 'OPEN' ? styles.reportOpen : styles.reportResolved,
                    ]}
                  >
                    <Text style={styles.reportStatusText}>
                      {report.status === 'OPEN' ? 'Ouvert' : 'Resolue'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.reportMeta}>
                  {[property?.neighborhood, property?.location].filter(Boolean).join(' | ') || 'Localité inconnue'}
                </Text>
                <Text style={styles.reportReason}>
                  Raison: {report.reason === 'FRAUD'
                    ? 'Fraude'
                    : report.reason === 'DUPLICATE'
                    ? 'Doublon'
                    : report.reason === 'INAPPROPRIATE'
                    ? 'Inapproprie'
                    : 'Autre'}
                </Text>
                {report.message ? <Text style={styles.reportMessage}>{report.message}</Text> : null}
                {report.status === 'OPEN' && (
                  <TouchableOpacity
                    style={styles.reportResolve}
                    onPress={() => resolveReport(report.id)}
                  >
                    <Ionicons name="checkmark" size={16} color={theme.accent} />
                    <Text style={styles.reportResolveText}>Marquer comme resolu</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
        {hasMoreReports && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('reports')}>
            <Text style={styles.loadMoreText}>Charger plus</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  const renderMessages = () => {
    const filteredMessages = shouldFilter
      ? messages.filter(message =>
          includesQuery(message.content) ||
          includesQuery(message.senderId) ||
          includesQuery(message.receiverId) ||
          includesQuery(message.propertyId)
        )
      : messages;
    const visibleMessages = filteredMessages.slice(0, listLimits.messages);
    const hasMoreMessages = filteredMessages.length > listLimits.messages;

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Messages</Text>
            <Text style={styles.sectionSubtitle}>Suivi des conversations en cours.</Text>
          </View>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{filteredMessages.length}</Text>
          </View>
        </View>
        {filteredMessages.length === 0 ? (
          <Text style={styles.emptyText}>Aucun message pour le moment.</Text>
        ) : (
          visibleMessages.map(message => (
            <View key={message.id} style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoTitle} numberOfLines={1}>{message.content}</Text>
                <View style={[styles.badge, message.read ? styles.badgeMuted : styles.badgeAccent]}>
                  <Text style={[styles.badgeText, message.read ? styles.badgeTextMuted : styles.badgeTextAccent]}>
                    {message.read ? 'Lu' : 'Non lu'}
                  </Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>De: {message.senderId}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>A: {message.receiverId}</Text>
                </View>
                {message.propertyId ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>Bien: {message.propertyId}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.infoMeta}>
                {new Date(message.timestamp).toLocaleString('fr-FR')}
              </Text>
              <View style={styles.quickActionsRow}>
                <QuickAction
                  label="Repondre"
                  icon="chatbubble-ellipses-outline"
                  tone="primary"
                  onPress={() => handleQuickReply(message)}
                />
                <QuickAction
                  label="Clore"
                  icon="checkmark-done-outline"
                  onPress={() => handleCloseMessage(message.id)}
                />
              </View>
            </View>
          ))
        )}
        {hasMoreMessages && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('messages')}>
            <Text style={styles.loadMoreText}>Charger plus</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };
  const renderReviews = () => {
    const filteredReviews = shouldFilter
      ? reviews.filter(review =>
          includesQuery(review.comment) ||
          includesQuery(review.propertyId) ||
          includesQuery(review.reviewerName)
        )
      : reviews;
    const visibleReviews = filteredReviews.slice(0, listLimits.reviews);
    const hasMoreReviews = filteredReviews.length > listLimits.reviews;

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Avis</Text>
            <Text style={styles.sectionSubtitle}>Qualite, confiance et moderation.</Text>
          </View>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{filteredReviews.length}</Text>
          </View>
        </View>
        {filteredReviews.length === 0 ? (
          <Text style={styles.emptyText}>Aucun avis pour le moment.</Text>
        ) : (
          visibleReviews.map(review => (
            <View key={review.id} style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoTitle}>Note: {review.rating}/5</Text>
                <View style={[styles.badge, review.verified ? styles.badgeSuccess : styles.badgeWarning]}>
                  <Text style={[styles.badgeText, review.verified ? styles.badgeTextSuccess : styles.badgeTextWarning]}>
                    {review.verified ? 'Verifie' : 'A verifier'}
                  </Text>
                </View>
              </View>
              <Text style={styles.infoMeta}>Bien: {review.propertyId}</Text>
              {review.comment ? <Text style={styles.reportMessage}>{review.comment}</Text> : null}
              <Text style={styles.infoMeta}>
                {new Date(review.createdAt).toLocaleString('fr-FR')}
              </Text>
              <View style={styles.quickActionsRow}>
                <QuickAction
                  label="Verifier"
                  icon="shield-checkmark-outline"
                  tone="primary"
                  onPress={() => handleVerifyReview(review.id)}
                />
                <QuickAction
                  label="Masquer"
                  icon="eye-off-outline"
                  tone="danger"
                  onPress={() => handleHideReview(review.id)}
                />
              </View>
            </View>
          ))
        )}
        {hasMoreReviews && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('reviews')}>
            <Text style={styles.loadMoreText}>Charger plus</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };
  const renderAgents = () => {
    const filteredAgents = shouldFilter
      ? agentProfiles.filter(agent => {
          const user = users.find(u => u.id === agent.userId);
          return (
            includesQuery(agent.userId) ||
            includesQuery(agent.bio) ||
            includesQuery(user?.name) ||
            includesQuery(agent.specialties?.join(' '))
          );
        })
      : agentProfiles;
    const visibleAgents = filteredAgents.slice(0, listLimits.agents);
    const hasMoreAgents = filteredAgents.length > listLimits.agents;

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Profils agents</Text>
            <Text style={styles.sectionSubtitle}>Performance, specialites et ventes.</Text>
          </View>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{filteredAgents.length}</Text>
          </View>
        </View>
        {filteredAgents.length === 0 ? (
          <Text style={styles.emptyText}>Aucun profil d'agent pour le moment.</Text>
        ) : (
          visibleAgents.map(agent => {
            const user = users.find(u => u.id === agent.userId);
            return (
              <View key={agent.userId} style={styles.clientItem}>
                <View style={styles.clientAvatar}>
                  <Text style={styles.clientInitials}>
                    {user?.name.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{user?.name || 'Utilisateur inconnu'}</Text>
                  <Text style={styles.clientEmail}>
                    Ventes: {agent.totalSales} | Commission: {agent.totalCommission} XOF
                  </Text>
                  <Text style={styles.clientPhone}>
                    Note: {agent.rating.toFixed(1)} ({agent.reviewCount} avis)
                  </Text>
                </View>
              </View>
            );
          })
        )}
        {hasMoreAgents && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('agents')}>
            <Text style={styles.loadMoreText}>Charger plus</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };
  const renderPremium = () => {
    const filteredPremium = shouldFilter
      ? premiumListings.filter(premium =>
          includesQuery(premium.propertyId) ||
          includesQuery(premium.plan)
        )
      : premiumListings;
    const visiblePremium = filteredPremium.slice(0, listLimits.premium);
    const hasMorePremium = filteredPremium.length > listLimits.premium;

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Annonces premium</Text>
            <Text style={styles.sectionSubtitle}>Mise en avant et dates actives.</Text>
          </View>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{filteredPremium.length}</Text>
          </View>
        </View>
        {filteredPremium.length === 0 ? (
          <Text style={styles.emptyText}>Aucune annonce premium pour le moment.</Text>
        ) : (
          visiblePremium.map(premium => (
            <View key={premium.propertyId} style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoTitle}>Bien: {premium.propertyId}</Text>
                <View style={[styles.badge, styles.badgeAccent]}>
                  <Text style={[styles.badgeText, styles.badgeTextAccent]}>{premium.plan}</Text>
                </View>
              </View>
              <Text style={styles.infoMeta}>
                Du {new Date(premium.startDate).toLocaleDateString('fr-FR')} au {new Date(premium.endDate).toLocaleDateString('fr-FR')}
              </Text>
              <View style={styles.quickActionsRow}>
                <QuickAction
                  label="Renouveler"
                  icon="refresh-outline"
                  tone="primary"
                  onPress={() => handleRenewPremium(premium)}
                />
                <QuickAction
                  label="Detail"
                  icon="open-outline"
                  onPress={() => Alert.alert(
                    'Premium',
                    'Plan ' +
                      premium.plan +
                      " actif jusqu'au " +
                      new Date(premium.endDate).toLocaleDateString('fr-FR')
                  )}
                />
              </View>
            </View>
          ))
        )}
        {hasMorePremium && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('premium')}>
            <Text style={styles.loadMoreText}>Charger plus</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };
  const renderCommissions = () => {
    const filteredCommissions = shouldFilter
      ? commissionRules.filter(rule =>
          includesQuery(rule.agentId) ||
          includesQuery(rule.propertyType) ||
          includesQuery(rule.percentage) ||
          includesQuery(rule.minAmount) ||
          includesQuery(rule.maxAmount)
        )
      : commissionRules;
    const visibleCommissions = filteredCommissions.slice(0, listLimits.commissions);
    const hasMoreCommissions = filteredCommissions.length > listLimits.commissions;

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Regles de commission</Text>
            <Text style={styles.sectionSubtitle}>Taux et seuils par agent.</Text>
          </View>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{filteredCommissions.length}</Text>
          </View>
        </View>
        {filteredCommissions.length === 0 ? (
          <Text style={styles.emptyText}>Aucune regle de commission pour le moment.</Text>
        ) : (
          visibleCommissions.map(rule => (
            <View key={rule.id} style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoTitle}>Agent: {rule.agentId}</Text>
                <View style={[styles.badge, rule.active ? styles.badgeSuccess : styles.badgeMuted]}>
                  <Text style={[styles.badgeText, rule.active ? styles.badgeTextSuccess : styles.badgeTextMuted]}>
                    {rule.active ? 'Actif' : 'Inactif'}
                  </Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>Taux: {rule.percentage}%</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>Min: {rule.minAmount} XOF</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>Max: {rule.maxAmount} XOF</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>Type: {rule.propertyType}</Text>
                </View>
              </View>
              <View style={styles.quickActionsRow}>
                <QuickAction
                  label={rule.active ? 'Desactiver' : 'Activer'}
                  icon={rule.active ? 'pause-circle-outline' : 'play-circle-outline'}
                  tone={rule.active ? 'danger' : 'primary'}
                  onPress={() => handleToggleCommission(rule)}
                />
                <QuickAction
                  label="Detail"
                  icon="information-circle-outline"
                  onPress={() => Alert.alert(
                    'Commission',
                    'Taux ' + rule.percentage + '% | Type ' + rule.propertyType
                  )}
                />
              </View>
            </View>
          ))
        )}
        {hasMoreCommissions && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('commissions')}>
            <Text style={styles.loadMoreText}>Charger plus</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };
  const renderPayments = () => {
    const filteredPayments = shouldFilter
      ? payments.filter(payment =>
          includesQuery(payment.contractId) ||
          includesQuery(payment.status) ||
          includesQuery(payment.method)
        )
      : payments;
    const visiblePayments = filteredPayments.slice(0, listLimits.payments);
    const hasMorePayments = filteredPayments.length > listLimits.payments;

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Paiements</Text>
            <Text style={styles.sectionSubtitle}>Suivi des loyers et reglements.</Text>
          </View>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{filteredPayments.length}</Text>
          </View>
          <TouchableOpacity style={styles.sectionActionButton} onPress={openPaymentModal}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        {filteredPayments.length === 0 ? (
          <Text style={styles.emptyText}>Aucun paiement pour le moment.</Text>
        ) : (
          visiblePayments.map(payment => (
            <View key={payment.id} style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoTitle}>{payment.amount} XOF</Text>
                <View
                  style={[
                    styles.badge,
                    payment.status === 'paid'
                      ? styles.badgeSuccess
                      : payment.status === 'pending'
                      ? styles.badgeWarning
                      : styles.badgeDanger,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      payment.status === 'paid'
                        ? styles.badgeTextSuccess
                        : payment.status === 'pending'
                        ? styles.badgeTextWarning
                        : styles.badgeTextDanger,
                    ]}
                  >
                    {payment.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.infoMeta}>
                Contrat: {getContractLabel(payment.contractId)}
              </Text>
              <Text style={styles.infoMeta}>
                Mode: {payment.method}
              </Text>
              <Text style={styles.infoMeta}>
                {new Date(payment.paidAt).toLocaleString('fr-FR')}
              </Text>
              <View style={styles.quickActionsRow}>
                <QuickAction
                  label="Editer"
                  icon="create-outline"
                  onPress={() => openEditPayment(payment)}
                />
                <QuickAction
                  label="Recu PDF"
                  icon="document-text-outline"
                  tone="primary"
                  onPress={() => printPaymentReceipt(payment)}
                />
                <QuickAction
                  label="Marquer paye"
                  icon="checkmark-circle-outline"
                  tone="primary"
                  onPress={() => handleMarkPaid(payment)}
                />
                <QuickAction
                  label="Litige"
                  icon="alert-circle-outline"
                  tone="danger"
                  onPress={() => handleDispute(payment)}
                />
              </View>
            </View>
          ))
        )}
        {hasMorePayments && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('payments')}>
            <Text style={styles.loadMoreText}>Charger plus</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };
  const renderContracts = () => {
    const filteredContracts = shouldFilter
      ? contracts.filter(contract =>
          includesQuery(contract.propertyId) ||
          includesQuery(contract.tenantId) ||
          includesQuery(contract.status)
        )
      : contracts;
    const visibleContracts = filteredContracts.slice(0, listLimits.contracts);
    const hasMoreContracts = filteredContracts.length > listLimits.contracts;

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Contrats</Text>
            <Text style={styles.sectionSubtitle}>Baux en cours et historiques.</Text>
          </View>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{filteredContracts.length}</Text>
          </View>
          <TouchableOpacity style={styles.sectionActionButton} onPress={openContractModal}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        {filteredContracts.length === 0 ? (
          <Text style={styles.emptyText}>Aucun contrat pour le moment.</Text>
        ) : (
          visibleContracts.map(contract => {
            const property = properties.find(p => p.id === contract.propertyId);
            const tenant = clients.find(c => c.id === contract.tenantId);
            return (
              <View key={contract.id} style={styles.infoCard}>
                <View style={styles.infoHeader}>
                  <Text style={styles.infoTitle}>{property?.title || 'Bien'}</Text>
                  <View style={[
                    styles.badge,
                    contract.status === 'active' ? styles.badgeSuccess : styles.badgeMuted,
                  ]}>
                    <Text style={[
                      styles.badgeText,
                      contract.status === 'active' ? styles.badgeTextSuccess : styles.badgeTextMuted,
                    ]}>
                      {contract.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.infoMeta}>
                  Locataire: {tenant?.name || contract.tenantId}
                </Text>
                <Text style={styles.infoMeta}>
                  Periode: {contract.startDate} ? {contract.endDate}
                </Text>
                <Text style={styles.infoMeta}>
                  Loyer: {contract.rentAmount} XOF
                </Text>
                <View style={styles.quickActionsRow}>
                  <QuickAction
                    label="Editer"
                    icon="create-outline"
                    onPress={() => openEditContract(contract)}
                  />
                  {contract.status !== 'active' && (
                    <QuickAction
                      label="Activer"
                      icon="checkmark-circle-outline"
                      tone="primary"
                      onPress={() => updateContractStatus(contract.id, 'active')}
                    />
                  )}
                  {contract.status !== 'expired' && (
                    <QuickAction
                      label="Expirer"
                      icon="time-outline"
                      tone="danger"
                      onPress={() => updateContractStatus(contract.id, 'expired')}
                    />
                  )}
                </View>
              </View>
            );
          })
        )}
        {hasMoreContracts && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('contracts')}>
            <Text style={styles.loadMoreText}>Charger plus</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };
  const renderDocuments = () => {
    const filteredDocuments = shouldFilter
      ? documents.filter(document =>
          includesQuery(document.name) ||
          includesQuery(document.type) ||
          includesQuery(document.propertyId)
        )
      : documents;
    const visibleDocuments = filteredDocuments.slice(0, listLimits.documents);
    const hasMoreDocuments = filteredDocuments.length > listLimits.documents;

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Documents</Text>
            <Text style={styles.sectionSubtitle}>Contrats, pieces et preuves.</Text>
          </View>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{filteredDocuments.length}</Text>
          </View>
        </View>
        {filteredDocuments.length === 0 ? (
          <Text style={styles.emptyText}>Aucun document pour le moment.</Text>
        ) : (
          visibleDocuments.map(document => (
            <View key={document.id} style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoTitle}>{document.name}</Text>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>{document.type}</Text>
                </View>
              </View>
              <Text style={styles.infoMeta}>
                Propriete: {document.propertyId}
              </Text>
              <Text style={styles.infoMeta}>
                Upload: {new Date(document.uploadedAt).toLocaleString('fr-FR')}
              </Text>
              <View style={styles.quickActionsRow}>
                <QuickAction
                  label="Ouvrir"
                  icon="document-text-outline"
                  tone="primary"
                  onPress={() => handleOpenDocument(document)}
                />
                <QuickAction
                  label="Partager"
                  icon="share-social-outline"
                  onPress={() => handleShareDocument(document)}
                />
              </View>
            </View>
          ))
        )}
        {hasMoreDocuments && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('documents')}>
            <Text style={styles.loadMoreText}>Charger plus</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };
  if (gateLoading) {
    return (
      <View style={[styles.container, styles.gateContainer]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.gateSubtitle}>Chargement...</Text>
      </View>
    );
  }

  if (!storedPin) {
    return (
      <View style={[styles.container, styles.gateContainer]}>
        <View style={styles.gateCard}>
          <Ionicons name="lock-closed" size={28} color={theme.accent} />
          <Text style={styles.gateTitle}>Creer un PIN Admin</Text>
          <Text style={styles.gateSubtitle}>
            Ce PIN protege l'acces au back-office et la sauvegarde.
          </Text>

          <TextInput
            style={styles.gateInput}
            value={pinInput}
            onChangeText={setPinInput}
            placeholder="Nouveau PIN (min 4)"
            keyboardType="number-pad"
            secureTextEntry
          />
          <TextInput
            style={styles.gateInput}
            value={pinConfirm}
            onChangeText={setPinConfirm}
            placeholder="Confirmer le PIN"
            keyboardType="number-pad"
            secureTextEntry
          />

          <TouchableOpacity style={styles.gateButton} onPress={handleSetupPin}>
            <Text style={styles.gateButtonText}>Enregistrer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!unlocked) {
    return (
      <View style={[styles.container, styles.gateContainer]}>
        <View style={styles.gateCard}>
          <Ionicons name="shield-checkmark" size={28} color={theme.accent} />
          <Text style={styles.gateTitle}>Acces Admin</Text>
          <Text style={styles.gateSubtitle}>Saisie securisee pour acceder au mini back-office.</Text>

          <TextInput
            style={styles.gateInput}
            value={pinInput}
            onChangeText={setPinInput}
            placeholder="PIN"
            keyboardType="number-pad"
            secureTextEntry
          />

          <TouchableOpacity style={styles.gateButton} onPress={handleUnlock}>
            <Text style={styles.gateButtonText}>Deverrouiller</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerBadgeRow}>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>Mini Admin</Text>
            </View>
            <Text style={styles.headerEyebrow}>Back office mobile</Text>
          </View>
          <Text style={styles.headerTitle}>Console Admin</Text>
          <Text style={styles.headerSubtitle}>Actions rapides et supervision quotidienne.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.themeButton}
            onPress={() => setAdminTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
          >
            <Ionicons
              name={adminTheme === 'dark' ? 'sunny' : 'moon'}
              size={18}
              color={theme.accent}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.lockButton} onPress={handleLock}>
            <Ionicons name="lock-closed" size={18} color={theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={openNewPropertyModal}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.toolbarCard}>
        <View style={styles.toolbarHeader}>
          <Text style={styles.toolbarTitle}>Recherche & filtres</Text>
          <View style={styles.toolbarBadge}>
            <Text style={styles.toolbarBadgeText}>Global</Text>
          </View>
        </View>
        <View style={[styles.searchBar, styles.searchBarShadow, styles.searchBarCompact]}>
          <Ionicons name="search" size={16} color={theme.textSoft} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher partout..."
            placeholderTextColor={theme.textSoft}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.textSoft} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.searchScopes}
          contentContainerStyle={styles.searchScopesContent}
        >
          {searchScopes.map(scope => (
            <TouchableOpacity
              key={scope.value}
              style={[
                styles.searchChip,
                searchScope === scope.value && styles.searchChipActive,
              ]}
              onPress={() => {
                setSearchScope(scope.value);
                const nextTab = scopeToTab[scope.value];
                if (nextTab) setActiveTab(nextTab);
              }}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.searchChipText,
                  searchScope === scope.value && styles.searchChipTextActive,
                ]}
              >
                {scope.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Navigation */}
      <View style={styles.navCard}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={styles.tabsContent}
        >
          {[
            { id: 'dashboard' as TabType, label: 'Dashboard', icon: 'stats-chart' },
            { id: 'properties' as TabType, label: 'Annonces', icon: 'list' },
            { id: 'clients' as TabType, label: 'Locataires', icon: 'people' },
            { id: 'contracts' as TabType, label: 'Contrats', icon: 'document-text' },
            { id: 'transactions' as TabType, label: 'Paiements', icon: 'card' },
            { id: 'neighborhoods' as TabType, label: 'Quartiers', icon: 'location' },
            { id: 'accounts' as TabType, label: 'Comptes', icon: 'person-circle' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => handleTabChange(tab.id)}
            >
              <Ionicons
                name={tab.icon as any}
                size={13}
                color={activeTab === tab.id ? theme.headerText : theme.textMuted}
              />
              <Text
                numberOfLines={1}
                style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'properties' && renderProperties()}
      {activeTab === 'clients' && renderClients()}
      {activeTab === 'accounts' && renderAccounts()}
      {activeTab === 'neighborhoods' && renderNeighborhoods()}
      {activeTab === 'reports' && renderReports()}
      {activeTab === 'messages' && renderMessages()}
      {activeTab === 'reviews' && renderReviews()}
      {activeTab === 'agents' && renderAgents()}
      {activeTab === 'premium' && renderPremium()}
      {activeTab === 'commissions' && renderCommissions()}
      {activeTab === 'transactions' && renderPayments()}
      {activeTab === 'contracts' && renderContracts()}
      {activeTab === 'documents' && renderDocuments()}

      {/* Add Property Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={closePropertyModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closePropertyModal}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingPropertyId ? 'Modifier annonce' : 'Nouvelle annonce'}</Text>
            <TouchableOpacity onPress={handleAddProperty}>
              <Ionicons name="checkmark" size={24} color={theme.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Titre *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={text => setFormData({ ...formData, title: text })}
              placeholder="Ex: Villa moderne  Kara"
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={text => setFormData({ ...formData, description: text })}
              placeholder="Dcrivez le bien..."
              multiline
              numberOfLines={4}
            />

            <Text style={styles.inputLabel}>Photos ({draftImages.length}/{MAX_PROPERTY_IMAGES})</Text>
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoButton} onPress={addImageFromCamera}>
                <Ionicons name="camera" size={18} color={theme.accentText} />
                <Text style={styles.photoButtonText}>Camra</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={addImageFromLibrary}>
                <Ionicons name="images" size={18} color={theme.accentText} />
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
                  <Text style={[styles.typeOptionText, formData.type === type && { color: theme.accent }]}>
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

            <Text style={styles.inputLabel}>Localité (Ville) *</Text>
            <TextInput
              style={styles.input}
              value={formData.city}
              onChangeText={text => setFormData({ ...formData, city: text })}
              placeholder="Ex: Kara"
            />

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

            <Text style={styles.inputLabel}>Surface (m2)</Text>
            <TextInput
              style={styles.input}
              value={formData.area}
              onChangeText={text => setFormData({ ...formData, area: text })}
              placeholder="Ex: 200"
              keyboardType="numeric"
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
              placeholder="Ex: Quartier Kpod"
            />

            <Text style={styles.inputLabel}>Chambres</Text>
            <TextInput
              style={styles.input}
              value={formData.bedrooms}
              onChangeText={text => setFormData({ ...formData, bedrooms: text })}
              placeholder="Nombre de chambres"
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Équipements (séparés par des virgules)</Text>
            <TextInput
              style={styles.input}
              value={formData.amenities}
              onChangeText={text => setFormData({ ...formData, amenities: text })}
              placeholder="Ex: Piscine, Jardin, Garage"
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Tenant Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={clientModalVisible}
        onRequestClose={closeClientModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeClientModal}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Modifier locataire</Text>
            <TouchableOpacity onPress={handleSaveClient}>
              <Ionicons name="checkmark" size={24} color={theme.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Nom *</Text>
            <TextInput
              style={styles.input}
              value={clientForm.name}
              onChangeText={text => setClientForm({ ...clientForm, name: text })}
              placeholder="Nom du locataire"
            />

            <Text style={styles.inputLabel}>Tlphone *</Text>
            <TextInput
              style={styles.input}
              value={clientForm.phone}
              onChangeText={text => setClientForm({ ...clientForm, phone: text })}
              placeholder="+228 90 12 34 56"
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={clientForm.email}
              onChangeText={text => setClientForm({ ...clientForm, email: text })}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Neighborhood Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={neighborhoodEditModalVisible}
        onRequestClose={closeEditNeighborhood}
      >
        <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeEditNeighborhood}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Modifier quartier</Text>
              <TouchableOpacity onPress={handleUpdateNeighborhood} disabled={neighborhoodSaving}>
                {neighborhoodSaving ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Ionicons name="checkmark" size={24} color={theme.accent} />
                )}
              </TouchableOpacity>
            </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Nom du quartier</Text>
            <TextInput
              style={styles.input}
              value={neighborhoodEditValue}
              onChangeText={setNeighborhoodEditValue}
              placeholder="Nom du quartier"
              placeholderTextColor={theme.textSoft}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* New Contract Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={contractModalVisible}
        onRequestClose={closeContractModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeContractModal}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingContractId ? 'Modifier contrat' : 'Nouveau contrat'}</Text>
            <TouchableOpacity onPress={handleSaveContract}>
              <Ionicons name="checkmark" size={24} color={theme.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Bien *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectRow}>
              {properties.map(property => (
                <TouchableOpacity
                  key={property.id}
                  style={[
                    styles.selectChip,
                    contractForm.propertyId === property.id && styles.selectChipActive,
                  ]}
                  onPress={() => setContractForm({ ...contractForm, propertyId: property.id })}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.selectChipText,
                      contractForm.propertyId === property.id && styles.selectChipTextActive,
                    ]}
                  >
                    {property.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Locataire *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectRow}>
              {clients.map(client => (
                <TouchableOpacity
                  key={client.id}
                  style={[
                    styles.selectChip,
                    contractForm.tenantId === client.id && styles.selectChipActive,
                  ]}
                  onPress={() => setContractForm({ ...contractForm, tenantId: client.id })}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.selectChipText,
                      contractForm.tenantId === client.id && styles.selectChipTextActive,
                    ]}
                  >
                    {client.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Date debut *</Text>
            <TextInput
              style={styles.input}
              value={contractForm.startDate}
              onChangeText={text => setContractForm({ ...contractForm, startDate: text })}
              placeholder="YYYY-MM-DD"
            />

            <Text style={styles.inputLabel}>Date fin *</Text>
            <TextInput
              style={styles.input}
              value={contractForm.endDate}
              onChangeText={text => setContractForm({ ...contractForm, endDate: text })}
              placeholder="YYYY-MM-DD"
            />

            <Text style={styles.inputLabel}>Loyer (XOF) *</Text>
            <TextInput
              style={styles.input}
              value={contractForm.rentAmount}
              onChangeText={text => setContractForm({ ...contractForm, rentAmount: text })}
              placeholder="Montant"
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Statut</Text>
            <View style={styles.selectRow}>
              {(['active', 'expired'] as const).map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.selectChip,
                    contractForm.status === status && styles.selectChipActive,
                  ]}
                  onPress={() => setContractForm({ ...contractForm, status })}
                >
                  <Text
                    style={[
                      styles.selectChipText,
                      contractForm.status === status && styles.selectChipTextActive,
                    ]}
                  >
                    {status === 'active' ? 'Actif' : 'Expire'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* New Payment Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={paymentModalVisible}
        onRequestClose={closePaymentModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closePaymentModal}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingPaymentId ? 'Modifier paiement' : 'Nouveau paiement'}</Text>
            <TouchableOpacity onPress={handleSavePayment}>
              <Ionicons name="checkmark" size={24} color={theme.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Contrat *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectRow}>
              {contracts.map(contract => (
                <TouchableOpacity
                  key={contract.id}
                  style={[
                    styles.selectChip,
                    paymentForm.contractId === contract.id && styles.selectChipActive,
                  ]}
                  onPress={() => setPaymentForm({ ...paymentForm, contractId: contract.id })}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.selectChipText,
                      paymentForm.contractId === contract.id && styles.selectChipTextActive,
                    ]}
                  >
                    {getContractLabel(contract.id)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Montant (XOF) *</Text>
            <TextInput
              style={styles.input}
              value={paymentForm.amount}
              onChangeText={text => setPaymentForm({ ...paymentForm, amount: text })}
              placeholder="Montant"
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Date paiement *</Text>
            <TextInput
              style={styles.input}
              value={paymentForm.paidAt}
              onChangeText={text => setPaymentForm({ ...paymentForm, paidAt: text })}
              placeholder="YYYY-MM-DD"
            />

            <Text style={styles.inputLabel}>Mode</Text>
            <View style={styles.selectRow}>
              {(['cash', 'mobile_money'] as const).map(method => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.selectChip,
                    paymentForm.method === method && styles.selectChipActive,
                  ]}
                  onPress={() => setPaymentForm({ ...paymentForm, method })}
                >
                  <Text
                    style={[
                      styles.selectChipText,
                      paymentForm.method === method && styles.selectChipTextActive,
                    ]}
                  >
                    {method === 'cash' ? 'Cash' : 'Mobile Money'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Statut</Text>
            <View style={styles.selectRow}>
              {(['paid', 'pending', 'late'] as const).map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.selectChip,
                    paymentForm.status === status && styles.selectChipActive,
                  ]}
                  onPress={() => setPaymentForm({ ...paymentForm, status })}
                >
                  <Text
                    style={[
                      styles.selectChipText,
                      paymentForm.status === status && styles.selectChipTextActive,
                    ]}
                  >
                    {status === 'paid' ? 'Pay?' : status === 'pending' ? 'En attente' : 'En retard'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Tenant Documents Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={tenantDocsModalVisible}
        onRequestClose={closeTenantDocs}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeTenantDocs}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Documents locataire</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {tenantDocuments.filter(d => d.tenantId === activeTenantId).length === 0 ? (
              <Text style={styles.emptyText}>Aucun document pour ce locataire.</Text>
            ) : (
              tenantDocuments
                .filter(d => d.tenantId === activeTenantId)
                .map(doc => (
                  <View key={doc.id} style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                      <Text style={styles.infoTitle}>{doc.type}</Text>
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipText}>
                          {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.quickActionsRow}>
                      <QuickAction
                        label="Ouvrir"
                        icon="document-text-outline"
                        tone="primary"
                        onPress={() => Linking.openURL(doc.url)}
                      />
                    </View>
                  </View>
                ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={userModalVisible}
        onRequestClose={closeUserModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeUserModal}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Modifier compte</Text>
            <TouchableOpacity onPress={handleSaveUser}>
              <Ionicons name="checkmark" size={24} color={theme.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Nom *</Text>
            <TextInput
              style={styles.input}
              value={userForm.name}
              onChangeText={text => setUserForm({ ...userForm, name: text })}
              placeholder="Nom complet"
            />

            <Text style={styles.inputLabel}>Tlphone *</Text>
            <TextInput
              style={styles.input}
              value={userForm.phone}
              onChangeText={text => setUserForm({ ...userForm, phone: text })}
              placeholder="+228 90 12 34 56"
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={userForm.email}
              onChangeText={text => setUserForm({ ...userForm, email: text })}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (theme: AdminTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  gateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  gateCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  gateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
    marginTop: 10,
  },
  gateSubtitle: {
    fontSize: 11,
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  gateInput: {
    width: '100%',
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: theme.text,
    marginTop: 12,
  },
  gateButton: {
    width: '100%',
    marginTop: 14,
    backgroundColor: theme.accentSoft,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  gateButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 14,
    backgroundColor: theme.headerBg,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  headerBadge: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  headerBadgeText: {
    color: theme.accentText,
    fontSize: 10,
    fontWeight: '700',
  },
  headerEyebrow: {
    color: theme.headerMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.headerText,
  },
  headerSubtitle: {
    fontSize: 10,
    color: theme.headerMuted,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lockButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchBarCompact: {
    marginHorizontal: 0,
    marginTop: 0,
  },
  searchBarShadow: {
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: theme.text,
  },
  toolbarCard: {
    marginHorizontal: 16,
    marginTop: -14,
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  toolbarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  toolbarTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.text,
  },
  toolbarBadge: {
    backgroundColor: theme.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: theme.border,
  },
  toolbarBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.textMuted,
  },
  searchScopes: {
    marginTop: 10,
  },
  searchScopesContent: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  searchChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchChipActive: {
    backgroundColor: theme.accentSoft,
    borderColor: theme.accentSoft,
  },
  searchChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.textMuted,
  },
  searchChipTextActive: {
    color: theme.accent,
  },
  tabs: {
    backgroundColor: 'transparent',
    paddingVertical: 6,
  },
  navCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  tabsContent: {
    paddingHorizontal: 12,
    gap: 6,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
    backgroundColor: theme.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tabActive: {
    backgroundColor: theme.accentSoft,
    borderColor: theme.accentSoft,
  },
  tabText: {
    fontSize: 9,
    color: theme.textMuted,
    fontWeight: '600',
    maxWidth: 64,
  },
  tabTextActive: {
    color: theme.accent,
  },
  tabContent: {
    flex: 1,
    padding: 16,
    paddingBottom: 140,
  },
  backupCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  quickLinks: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  quickLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.accentSoft,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.accentSoft,
  },
  quickLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.accentText,
  },
  backupHeader: {
    marginBottom: 10,
  },
  backupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  backupSub: {
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 4,
  },
  backupActions: {
    flexDirection: 'row',
    gap: 8,
  },
  backupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  backupButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  backupButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  backupButtonTextSecondary: {
    color: theme.accentText,
    fontSize: 10,
    fontWeight: '700',
  },
  statsGrid: {
    marginBottom: 12,
  },
  statsGridContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  statCard: {
    width: 120,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'flex-start',
    overflow: 'hidden',
    position: 'relative',
  },
  cardElevated: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  statAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statMeta: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: theme.textSoft,
    fontWeight: '700',
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 9,
    color: theme.textMuted,
    marginTop: 1,
  },
  valueCard: {
    backgroundColor: theme.surface,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  overviewCard: {
    backgroundColor: theme.headerBg,
    borderRadius: 12,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  overviewTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.accent,
  },
  overviewSubtitle: {
    fontSize: 8,
    color: theme.headerMuted,
    marginTop: 4,
  },
  overviewBadge: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  overviewBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: theme.accentText,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  overviewItem: {
    width: '48%',
    backgroundColor: theme.surfaceAlt,
    borderRadius: 12,
    padding: 6,
  },
  overviewLabel: {
    fontSize: 7,
    color: theme.headerMuted,
  },
  overviewValue: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.warning,
    marginTop: 4,
  },
  valueLabel: {
    fontSize: 9,
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  valueAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 0,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 2,
  },
  sectionLink: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.accentText,
  },
  sectionCount: {
    backgroundColor: theme.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sectionActionButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.text,
  },
  typeBreakdown: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
    gap: 8,
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  typeName: {
    fontSize: 11,
    color: theme.textMuted,
  },
  typeBar: {
    flex: 1,
    height: 8,
    backgroundColor: theme.surfaceAlt,
    borderRadius: 4,
    marginHorizontal: 12,
  },
  typeBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  typeCount: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.text,
    width: 30,
    textAlign: 'right',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
  },
  activitySubtitle: {
    fontSize: 10,
    color: theme.accentText,
    marginTop: 2,
  },
  activityDate: {
    fontSize: 9,
    color: theme.textSoft,
  },
  filterTabs: {
    marginBottom: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: theme.surfaceAlt,
    borderRadius: 10,
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: theme.accentSoft,
  },
  filterTabText: {
    fontSize: 10,
    color: theme.textMuted,
  },
  filterTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  filterToggleRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterToggleActive: {
    backgroundColor: theme.warningSoft,
    borderColor: theme.warning,
  },
  filterToggleText: {
    fontSize: 10,
    color: theme.textMuted,
    fontWeight: '600',
  },
  filterToggleTextActive: {
    color: theme.warning,
  },
  propertyCard: {
    backgroundColor: theme.surfaceAlt,
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  propertyImageWrap: {
    width: '100%',
    height: 130,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 10,
  },
  propertyImage: {
    width: '100%',
    height: '100%',
  },
  propertyImageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.warning,
  },
  featuredBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.warning,
  },
  propertyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  propertyTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  propertyTypeText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '600',
  },
  propertyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  propertyLocation: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  propertyPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accentText,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: theme.surfaceAlt,
  },
  statusStack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusAvailable: {
    backgroundColor: theme.successSoft,
  },
  statusOccupied: {
    backgroundColor: theme.dangerSoft,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.text,
  },
  listingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: theme.surfaceAlt,
  },
  listingPending: {
    backgroundColor: theme.warningSoft,
    borderWidth: 1,
    borderColor: theme.warning,
  },
  listingApproved: {
    backgroundColor: theme.successSoft,
    borderWidth: 1,
    borderColor: theme.success,
  },
  listingRejected: {
    backgroundColor: theme.dangerSoft,
    borderWidth: 1,
    borderColor: theme.danger,
  },
  listingArchived: {
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  listingText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.text,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.surfaceAlt,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionVip: {
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  actionVipActive: {
    backgroundColor: theme.warningSoft,
    borderWidth: 1,
    borderColor: theme.warning,
  },
  actionEdit: {
    backgroundColor: theme.accentSoft,
    borderWidth: 1,
    borderColor: theme.accentSoft,
  },
  actionApprove: {
    backgroundColor: theme.successSoft,
    borderWidth: 1,
    borderColor: theme.success,
  },
  actionReject: {
    backgroundColor: theme.dangerSoft,
    borderWidth: 1,
    borderColor: theme.danger,
  },
  actionArchive: {
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  actionSold: {
    backgroundColor: theme.warningSoft,
    borderWidth: 1,
    borderColor: theme.warning,
  },
  actionRented: {
    backgroundColor: theme.infoSoft,
    borderWidth: 1,
    borderColor: theme.info,
  },
  actionReset: {
    backgroundColor: theme.accentSoft,
    borderWidth: 1,
    borderColor: theme.accentSoft,
  },
  actionDelete: {
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  clientItem: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  clientAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  clientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clientName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
  clientEmail: {
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 2,
  },
  clientPhone: {
    fontSize: 10,
    color: theme.accentText,
    marginTop: 2,
  },
  clientStats: {
    alignItems: 'flex-end',
  },
  clientPropertyCount: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.accentText,
  },
  accountItem: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  accountAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  accountInfo: {
    flex: 1,
    marginLeft: 12,
  },
  accountName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
  accountMeta: {
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 2,
  },
  accountActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  accountVerifyButton: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
  },
  accountVerifyOn: {
    backgroundColor: theme.accentSoft,
  },
  accountVerifyOff: {
    backgroundColor: theme.surfaceAlt,
  },
  accountVerifyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  accountEditButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 6,
  },
  reportCard: {
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 10,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  infoCard: {
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 10,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: theme.text,
    marginRight: 8,
  },
  infoMeta: {
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  metaChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  metaChipText: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.textMuted,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.badgeBg,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.badgeText,
  },
  badgeAccent: {
    backgroundColor: theme.accentSoft,
    borderColor: theme.accent,
  },
  badgeTextAccent: {
    color: theme.accentText,
  },
  badgeSuccess: {
    backgroundColor: theme.successSoft,
    borderColor: theme.success,
  },
  badgeTextSuccess: {
    color: theme.success,
  },
  badgeWarning: {
    backgroundColor: theme.warningSoft,
    borderColor: theme.warning,
  },
  badgeTextWarning: {
    color: theme.warning,
  },
  badgeDanger: {
    backgroundColor: theme.dangerSoft,
    borderColor: theme.danger,
  },
  badgeTextDanger: {
    color: theme.danger,
  },
  badgeMuted: {
    backgroundColor: theme.surfaceAlt,
    borderColor: theme.border,
  },
  badgeTextMuted: {
    color: theme.textMuted,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  quickActionText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.textMuted,
  },
  quickActionPrimary: {
    backgroundColor: theme.accentSoft,
    borderColor: theme.accent,
  },
  quickActionTextPrimary: {
    color: theme.accentText,
  },
  quickActionDanger: {
    backgroundColor: theme.dangerSoft,
    borderColor: theme.danger,
  },
  quickActionTextDanger: {
    color: theme.danger,
  },
  loadMoreButton: {
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.accentSoft,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  loadMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.accentText,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reportTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.text,
    flex: 1,
    marginRight: 8,
  },
  reportStatus: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reportOpen: {
    backgroundColor: theme.warningSoft,
  },
  reportResolved: {
    backgroundColor: theme.successSoft,
  },
  reportStatusText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.text,
  },
  reportMeta: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 4,
  },
  reportReason: {
    fontSize: 10,
    color: theme.text,
    fontWeight: '600',
    marginBottom: 6,
  },
  reportMessage: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 10,
  },
  reportResolve: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.accentSoft,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  reportResolveText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.accentText,
  },
  neighborhoodInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  neighborhoodInput: {
    flex: 1,
    marginBottom: 0,
  },
  neighborhoodAddButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neighborhoodList: {
    marginTop: 14,
    gap: 10,
  },
  neighborhoodChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  neighborhoodChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  neighborhoodChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
  },
  neighborhoodCount: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  neighborhoodCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textMuted,
  },
  neighborhoodActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  neighborhoodEdit: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neighborhoodDelete: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: theme.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neighborhoodPicker: {
    marginBottom: 10,
  },
  neighborhoodPickerLabel: {
    fontSize: 11,
    color: theme.textMuted,
    marginBottom: 8,
  },
  neighborhoodPickerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  neighborhoodPickerChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: theme.surfaceAlt,
    borderRadius: 10,
  },
  neighborhoodPickerChipActive: {
    backgroundColor: theme.accentSoft,
  },
  neighborhoodPickerText: {
    fontSize: 11,
    color: theme.text,
    fontWeight: '600',
  },
  neighborhoodPickerTextActive: {
    color: theme.accent,
  },
  clientEditButton: {
    marginTop: 6,
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 11,
    fontSize: 13,
    color: theme.text,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  selectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  selectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  selectChipActive: {
    backgroundColor: theme.accentSoft,
    borderColor: theme.accentSoft,
  },
  selectChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
  },
  selectChipTextActive: {
    color: '#fff',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: theme.surfaceAlt,
    borderRadius: 10,
  },
  typeOptionText: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: '500',
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
    backgroundColor: theme.accentSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  photoButtonText: {
    color: theme.accentText,
    fontSize: 12,
    fontWeight: '600',
  },
  photoStrip: {
    marginBottom: 14,
  },
  photoThumbWrap: {
    marginRight: 10,
  },
  photoThumb: {
    width: 84,
    height: 64,
    borderRadius: 8,
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
});

export default AdminScreen;













