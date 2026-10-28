import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Image,
  Share,
  LayoutAnimation,
  Platform,
  Linking,
} from 'react-native';
import { AppAlert as Alert } from '../components/ui/appAlertService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TextInput from '../components/ui/AccessibleTextInput';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { translateAdmin, type AdminTranslationKey } from '../i18n/admin';
import { supabase } from '../lib/supabase';
import { fetchAdminAccounts, updateAdminAccount } from '../lib/adminAccounts';
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
  CommissionRule,
  TenantDocument,
} from '../types';
import { formatPrice } from '../utils/format';
import Skeleton from '../components/ui/Skeleton';
import { logger } from '../lib/logger';
import { shareContent } from '../lib/shareContent';
import { createAdminTheme, createAdminStyles } from './AdminScreen.styles';
import AdminNavigation, { type AdminTab } from './AdminNavigation';
import { useAdminSupportInbox } from './admin/useAdminSupportInbox';
import AdminAccountsTab from './admin/tabs/AdminAccountsTab';
import AdminSupportInbox from './admin/tabs/AdminSupportInbox';
import AdminGate from './admin/AdminGate';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

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

const createTenantDocumentPath = (tenantId: string, fileName: string) =>
  `${tenantId}/${Date.now()}-${fileName}`;

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

const AdminScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    properties,
    clients,
    currentUser,
    theme: appTheme,
    setTheme,
    hydrated,
    language,
    tType,
    neighborhoods,
    reports,
    loadAdminOperationalData,
    resolveReport,
    updatePropertyStatus,
    deleteProperty,
    addProperty,
    updateProperty,
    updateClient,
    reviewAgentRequest,
    addNeighborhood,
    updateNeighborhood,
    removeNeighborhood,
    replaceData,
    visitorCount,
    // New enhanced features
    messages,
    reviews,
    setReviewVerified,
    premiumListings,
    commissionRules,
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
    toggleCommissionRule,
  } = useApp();
  const tAdmin = useCallback(
    (key: AdminTranslationKey) => translateAdmin(language, key),
    [language]
  );
  const hasAdminAccess = currentUser?.isAdmin === true || currentUser?.role === 'ADMIN';
  const dateLocale = language === 'en' ? 'en-US' : 'fr-FR';
  const formatAdminDate = (value: string | number | Date) =>
    new Date(value).toLocaleDateString(dateLocale);
  const formatAdminDateTime = (value: string | number | Date) =>
    new Date(value).toLocaleString(dateLocale);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const handleTabChange = (tab: AdminTab) => {
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
  const [adminAccounts, setAdminAccounts] = useState<User[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accountUpdateId, setAccountUpdateId] = useState<string | null>(null);
  const [newNeighborhood, setNewNeighborhood] = useState('');
  const [neighborhoodEditModalVisible, setNeighborhoodEditModalVisible] = useState(false);
  const [editingNeighborhoodName, setEditingNeighborhoodName] = useState<string | null>(null);
  const [neighborhoodEditValue, setNeighborhoodEditValue] = useState('');
  const [neighborhoodSaving, setNeighborhoodSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | 'ALL'>('ALL');
  const [listingFilter, setListingFilter] = useState<ListingStatus | 'ALL'>('ALL');
  const [featuredOnly, setFeaturedOnly] = useState(false);
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
  useEffect(() => {
    if (!unlocked || !hasAdminAccess) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      void loadAdminOperationalData().catch(error => {
        if (active) {
          Alert.alert(
            tAdmin("Erreur"),
            error instanceof Error
              ? error.message
              : tAdmin("Impossible de charger les données administratives.")
          );
        }
      });
    });
    return () => {
      active = false;
    };
  }, [hasAdminAccess, loadAdminOperationalData, tAdmin, unlocked]);

  const supportInbox = useAdminSupportInbox({
    active: activeTab === 'messages',
    enabled: unlocked && hasAdminAccess,
    currentUserId: currentUser?.id ?? null,
    translate: tAdmin,
  });
  const {
    conversations: supportConversations,
    selectedConversationId: selectedSupportId,
    setSelectedConversationId: setSelectedSupportId,
    messages: supportMessages,
    reply: supportReply,
    setReply: setSupportReply,
    loading: supportLoading,
    error: supportError,
    sending: supportSending,
    loadConversations: loadSupportConversations,
    sendReply: sendSupportReply,
    toggleConversationStatus: toggleSupportConversationStatus,
  } = supportInbox;

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
      Alert.alert(tAdmin("Erreur"), tAdmin("Veuillez remplir tous les champs."));
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
      Alert.alert(tAdmin("Succes"), editingContractId ? tAdmin("Contrat mis a jour.") : tAdmin("Contrat enregistre."));
      closeContractModal();
      setEditingContractId(null);
    } catch {
      Alert.alert(tAdmin("Erreur"), tAdmin("Impossible d'enregistrer le contrat."));
    }
  };

  const handleSavePayment = async () => {
    const amount = parseFloat(paymentForm.amount);
    if (!paymentForm.contractId || Number.isNaN(amount) || !paymentForm.paidAt) {
      Alert.alert(tAdmin("Erreur"), tAdmin("Veuillez remplir tous les champs."));
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
      Alert.alert(tAdmin("Succes"), editingPaymentId ? tAdmin("Paiement mis a jour.") : tAdmin("Paiement enregistre."));
      closePaymentModal();
      setEditingPaymentId(null);
    } catch {
      Alert.alert(tAdmin("Erreur"), tAdmin("Impossible d'enregistrer le paiement."));
    }
  };

  const pickTenantDocType = () =>
    new Promise<'cni' | 'contract' | 'other' | null>(resolve => {
      Alert.alert(tAdmin("Type de document"), tAdmin("Choisir le type"), [
        { text: tAdmin("CNI"), onPress: () => resolve('cni') },
        { text: tAdmin("Contrat"), onPress: () => resolve('contract') },
        { text: tAdmin("Autre"), onPress: () => resolve('other') },
        { text: tAdmin("Annuler"), style: 'cancel', onPress: () => resolve(null) },
      ]);
    });

  const getContractLabel = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return contractId;
    const property = properties.find(p => p.id === contract.propertyId);
    const tenant = clients.find(c => c.id === contract.tenantId);
    const propertyLabel = property?.title || tAdmin("Bien");
    const tenantLabel = tenant?.name || tAdmin("Locataire");
    return `${propertyLabel} – ${tenantLabel}`;
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

  const loadPrintModule = async () => import('expo-print');

  const printPaymentReceipt = async (payment: Payment) => {
    try {
      const PrintModule = await loadPrintModule();

      const contract = contracts.find(c => c.id === payment.contractId);
      const property = properties.find(p => p.id === contract?.propertyId);
      const tenant = clients.find(c => c.id === contract?.tenantId);

      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: ${theme.text}; }
              h1 { font-size: 20px; margin-bottom: 6px; }
              .muted { color: ${theme.textMuted}; font-size: 12px; }
              .card { border: 1px solid ${theme.border}; border-radius: 12px; padding: 16px; margin-top: 16px; }
              .row { display: flex; justify-content: space-between; margin: 6px 0; }
              .label { color: ${theme.textMuted}; font-size: 12px; }
              .value { font-weight: 700; }
            </style>
          </head>
          <body>
            <h1>${tAdmin("Reçu de paiement")}</h1>
            <div class="muted">Imo Nord Togo - ${formatAdminDate(new Date())}</div>
            <div class="card">
              <div class="row"><div class="label">${tAdmin("Locataire")}</div><div class="value">${escapeHtml(tenant?.name || tAdmin("Locataire"))}</div></div>
              <div class="row"><div class="label">${tAdmin("Bien")}</div><div class="value">${escapeHtml(property?.title || tAdmin("Bien"))}</div></div>
              <div class="row"><div class="label">${tAdmin("Contrat")}</div><div class="value">${escapeHtml(payment.contractId)}</div></div>
              <div class="row"><div class="label">${tAdmin("Montant")}</div><div class="value">${escapeHtml(formatPrice(payment.amount))}</div></div>
              <div class="row"><div class="label">${tAdmin("Date paiement")}</div><div class="value">${escapeHtml(formatAdminDate(payment.paidAt))}</div></div>
              <div class="row"><div class="label">${tAdmin("Mode")}</div><div class="value">${escapeHtml(tAdmin(payment.method === 'cash' ? 'Cash' : 'Mobile Money'))}</div></div>
              <div class="row"><div class="label">${tAdmin("Statut")}</div><div class="value">${escapeHtml(tAdmin(payment.status === 'paid' ? 'Payé' : payment.status === 'pending' ? 'En attente' : 'En retard'))}</div></div>
            </div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        await PrintModule.printAsync({ html });
        return;
      }

      const { uri } = await PrintModule.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        await Share.share({ message: tAdmin("Reçu de paiement"), url: uri });
      }
    } catch (error) {
      logger.error('Unable to generate payment receipt.', error);
      Alert.alert(tAdmin("Erreur"), tAdmin("Impossible de générer le reçu PDF."));
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
      const path = createTenantDocumentPath(tenant.id, safeName);
      const { data: signed, error: signedError } = await supabase.storage
        .from('tenant-documents')
        .createSignedUploadUrl(path);
      if (signedError || !signed?.signedUrl) {
        logger.warn('Signed upload URL error (tenant doc)', {
          error: signedError?.message ?? signedError,
          path,
          tenantId: tenant.id,
        });
        throw signedError ?? new Error('Signed upload error');
      }

      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        if (!response.ok) {
          throw new Error(`Unable to read selected document (${response.status}).`);
        }
        const blob = await response.blob();
        const { error } = await supabase.storage
          .from('tenant-documents')
          .uploadToSignedUrl(path, signed.token, blob, {
            contentType: file.mimeType || blob.type || 'application/octet-stream',
            cacheControl: '3600',
          });
        if (error) {
          logger.warn('Signed upload failed (tenant doc)', {
            error: error.message,
            path,
            tenantId: tenant.id,
          });
          throw error;
        }
      } else {
        const uploadResult = await FileSystem.uploadAsync(signed.signedUrl, file.uri, {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            'Content-Type': file.mimeType || 'application/octet-stream',
            'Cache-Control': '3600',
          },
        });
        if (uploadResult.status < 200 || uploadResult.status >= 300) {
          logger.warn('Signed upload failed (tenant doc)', {
            status: uploadResult.status,
            body: uploadResult.body,
            path,
            tenantId: tenant.id,
          });
          throw new Error(`Upload failed: ${uploadResult.status}`);
        }
      }
      const { data: docRow, error: docError } = await supabase
        .from('tenant_documents')
        .insert({
          tenant_id: tenant.id,
          type: docType,
          url: path,
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
      Alert.alert(tAdmin("Succes"), tAdmin("Document ajoute."));
    } catch (error) {
      logger.error('Unable to upload tenant document.', error);
      Alert.alert(tAdmin("Erreur"), tAdmin("Impossible d'ajouter le document."));
    } finally {
      setUploadingTenantDocId(null);
    }
  };

  const handleSaveClient = () => {
    if (!editingClientId) return;
    if (!clientForm.name.trim() || !clientForm.phone.trim()) {
      Alert.alert(tAdmin("Erreur"), tAdmin("Nom et tlphone sont obligatoires"));
      return;
    }
    updateClient(editingClientId, {
      name: clientForm.name.trim(),
      email: clientForm.email.trim(),
      phone: clientForm.phone.trim(),
    });
    Alert.alert(tAdmin("Succes"), tAdmin("Locataire modifie avec succes."));
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

  const loadAdminAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      setAdminAccounts(await fetchAdminAccounts());
    } catch (error) {
      const message = error instanceof Error ? error.message : tAdmin("Impossible de charger les comptes.");
      setAccountsError(message);
      throw error;
    } finally {
      setAccountsLoading(false);
    }
  }, [tAdmin]);

  useEffect(() => {
    if (!['accounts', 'agents'].includes(activeTab) || !unlocked || !hasAdminAccess) return;
    let active = true;
    queueMicrotask(() => {
      if (active) void loadAdminAccounts().catch(() => {});
    });
    return () => {
      active = false;
    };
  }, [activeTab, hasAdminAccess, loadAdminAccounts, unlocked]);

  const handleSaveUser = async () => {
    if (!editingUserId) return;
    if (!userForm.name.trim() || !userForm.phone.trim()) {
      Alert.alert(tAdmin("Erreur"), tAdmin("Nom et tlphone sont obligatoires"));
      return;
    }
    try {
      await updateAdminAccount(editingUserId, {
        full_name: userForm.name.trim(),
        phone: userForm.phone.trim(),
      });
      setAdminAccounts(previous => previous.map(user => user.id === editingUserId
        ? { ...user, name: userForm.name.trim(), phone: userForm.phone.trim() }
        : user));
      Alert.alert(tAdmin("Succes"), tAdmin("Compte modifie avec succes."));
      closeUserModal();
    } catch (error) {
      Alert.alert(tAdmin("Erreur"), error instanceof Error ? error.message : tAdmin("Impossible de modifier le compte."));
    }
  };

  const handleAddNeighborhood = async () => {
    if (!newNeighborhood.trim()) {
      Alert.alert(tAdmin("Erreur"), tAdmin("Entrez un nom de quartier."));
      return;
    }
    const exists = neighborhoods.some(
      name => name.toLowerCase() === newNeighborhood.trim().toLowerCase()
    );
    if (exists) {
      Alert.alert(tAdmin("Erreur"), tAdmin("Ce quartier existe deja."));
      return;
    }
    try {
      await addNeighborhood(newNeighborhood);
      setNewNeighborhood('');
    } catch (error) {
      Alert.alert(tAdmin("Erreur"), error instanceof Error ? error.message : "Impossible d'ajouter le quartier.");
    }
  };

  const handleRemoveNeighborhood = (name: string) => {
    const usageCount = properties.filter(
      p => (p.neighborhood ?? '').toLowerCase() === name.toLowerCase()
    ).length;
    if (usageCount > 0) {
      Alert.alert(
        tAdmin("Quartier utilise"),
        tAdmin("Ce quartier est utilise par {count} bien(s). Deplacez-les avant suppression.").replace('{count}', String(usageCount))
      );
      return;
    }
    Alert.alert(
      tAdmin("Supprimer le quartier"),
      tAdmin("Supprimer \"{name}\" ?").replace('{name}', name),
      [
        { text: tAdmin("Annuler"), style: 'cancel' },
        {
          text: tAdmin("Supprimer"),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeNeighborhood(name);
            } catch (error) {
              Alert.alert(tAdmin("Erreur"), error instanceof Error ? error.message : "Impossible de supprimer le quartier.");
            }
          },
        },
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
      Alert.alert(tAdmin("Erreur"), tAdmin("Entrez un nom de quartier."));
      return;
    }
    try {
      setNeighborhoodSaving(true);
      await updateNeighborhood(editingNeighborhoodName, cleaned);
      Alert.alert(tAdmin("Succes"), tAdmin("Quartier modifie avec succes."));
      closeEditNeighborhood();
    } catch {
      Alert.alert(tAdmin("Erreur"), tAdmin("Impossible de modifier le quartier."));
    } finally {
      setNeighborhoodSaving(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const pin = Platform.OS === 'web'
          ? await AsyncStorage.getItem('admin_pin')
          : await SecureStore.getItemAsync('admin_pin');
        if (!mounted) return;
        setStoredPin(pin);
      } catch (error) {
        logger.error('Unable to load the admin PIN.', error);
        if (mounted) {
          Alert.alert(tAdmin("Erreur"), tAdmin("Impossible de charger le PIN Admin."));
        }
      } finally {
        if (mounted) setGateLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [tAdmin]);

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
      propertiesByType,
    };
  }, [properties, clients]);

  const dashboardMetrics = useMemo(() => ({
    pendingListings: properties.filter(property => (property.listingStatus ?? 'pending') === 'pending').length,
    unreadMessages: messages.filter(message => !message.read).length,
    pendingTransactions: payments.filter(payment => payment.status === 'pending').length,
    recentProperties: [...properties]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12),
  }), [messages, payments, properties]);

  const { theme, styles } = useMemo(() => {
    const nextTheme = createAdminTheme(appTheme);
    return {
      theme: nextTheme,
      styles: createAdminStyles(nextTheme),
    };
  }, [appTheme]);

  const contractCountByTenant = useMemo(() => {
    const map = new Map<string, number>();
    contracts.forEach(contract => {
      map.set(contract.tenantId, (map.get(contract.tenantId) ?? 0) + 1);
    });
    return map;
  }, [contracts]);

  if (!currentUser || !hasAdminAccess) {
    return (
      <View style={[styles.container, styles.gateContainer]}>
        <View style={styles.gateCard}>
          <Ionicons name="lock-closed" size={28} color={theme.accent} />
          <Text style={styles.gateTitle}>{tAdmin("Accès réservé")}</Text>
          <Text style={styles.gateSubtitle}>
            {tAdmin("Connectez-vous avec un compte administrateur pour accéder au back-office.")}
          </Text>
        </View>
      </View>
    );
  }

  const query = searchQuery.trim().toLowerCase();
  const hasQuery = query.length > 0;

  const scopeToTab: Record<SearchScope, AdminTab | null> = {
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
    { label: tAdmin("Tout"), value: 'ALL' },
    { label: tAdmin("Annonces"), value: 'PROPERTIES' },
    { label: tAdmin("Locataires"), value: 'CLIENTS' },
    { label: tAdmin("Contrats"), value: 'CONTRACTS' },
    { label: tAdmin("Paiements"), value: 'TRANSACTIONS' },
  ];

  const getStatusLabel = (property: Property) => {
    if (property.status === 'available') return tAdmin("Disponible");
    if (property.status === 'occupied') return tAdmin("Occupé");
    return tAdmin("Disponible");
  };

  const getListingLabel = (status?: ListingStatus) => {
    if (status === 'pending') return tAdmin("En attente");
    if (status === 'approved') return tAdmin("Approuvé");
    if (status === 'rejected') return tAdmin("Refusé");
    if (status === 'archived') return tAdmin("Archivé");
    return tAdmin("Approuvé");
  };

  const logAdminAction = async (
    action: string,
    entity: string,
    entityId?: string,
    meta?: Record<string, unknown>
  ) => {
    try {
      const { error } = await supabase.from('activity_logs').insert({
        action,
        entity,
        entity_id: entityId ?? null,
        actor_id: currentUser?.id ?? null,
        actor_name: [currentUser?.name, currentUser?.email].filter(Boolean).join(' — ') || null,
        created_at: new Date().toISOString(),
      });
      if (error) logger.warn('Unable to save the admin activity log:', error.message);
    } catch (error) {
      logger.warn('Unable to save the admin activity log:', error);
    }
  };

  const handleSetListingStatus = async (property: Property, status: ListingStatus) => {
    let rejectionReason: string | null | undefined;
    if (status === 'rejected') {
      rejectionReason = await new Promise<string | null | undefined>(resolve => {
        Alert.alert(tAdmin("Motif du refus"), tAdmin("Choisissez la raison visible par l’agent."), [
          { text: tAdmin("Annuler"), style: 'cancel', onPress: () => resolve(undefined) },
          { text: tAdmin("Informations incomplètes"), onPress: () => resolve(tAdmin("Informations incomplètes.")) },
          { text: tAdmin("Photos ou description à corriger"), onPress: () => resolve(tAdmin("Photos ou description à corriger.")) },
        ]);
      });
      if (rejectionReason === undefined) return;
    } else if (status === 'approved' || status === 'pending') {
      rejectionReason = null;
    }
    await updateProperty(property.id, { listingStatus: status, rejectionReason });
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
    try {
      setAccountUpdateId(user.id);
      await updateAdminAccount(user.id, { verified: value });
      setAdminAccounts(previous => previous.map(account =>
        account.id === user.id ? { ...account, verified: value } : account
      ));
      logAdminAction('verify_user', 'user', user.id, { verified: value });
    } catch (error) {
      Alert.alert(tAdmin("Erreur"), error instanceof Error ? error.message : tAdmin("Impossible de modifier ce compte."));
    } finally {
      setAccountUpdateId(null);
    }
  };

  const handleAccountStatus = async (user: User) => {
    const nextStatus = user.accountStatus === 'suspended' ? 'active' : 'suspended';
    try {
      setAccountUpdateId(user.id);
      await updateAdminAccount(user.id, { account_status: nextStatus });
      setAdminAccounts(previous => previous.map(account =>
        account.id === user.id ? { ...account, accountStatus: nextStatus } : account
      ));
      logAdminAction('account_status', 'user', user.id, { status: nextStatus });
    } catch (error) {
      Alert.alert(tAdmin("Erreur"), error instanceof Error ? error.message : tAdmin("Impossible de modifier ce compte."));
    } finally {
      setAccountUpdateId(null);
    }
  };

  const handleReviewAgent = async (user: User, approved: boolean) => {
    try {
      let reason: string | undefined;
      if (!approved) {
        reason = await new Promise<string | undefined>(resolve => {
          Alert.prompt(
            tAdmin("Motif du refus"),
            tAdmin("Indiquez la raison qui sera visible par le demandeur."),
            [
              { text: tAdmin("Annuler"), style: 'cancel', onPress: () => resolve(undefined) },
              { text: tAdmin("Refuser"), style: 'destructive', onPress: (value?: string) => resolve(value?.trim() || tAdmin("Votre demande doit être complétée.")) },
            ],
            'plain-text'
          );
        });
        if (reason === undefined) return;
      }
      await reviewAgentRequest(user.id, approved, reason);
      await loadAdminAccounts();
      logAdminAction(approved ? 'approve_agent' : 'reject_agent', 'user', user.id);
      Alert.alert(tAdmin('Demande agent'), approved ? tAdmin('Agent approuvé.') : tAdmin('Demande agent refusée.'));
    } catch (error) {
      Alert.alert(tAdmin('Erreur'), error instanceof Error ? error.message : tAdmin('Impossible de traiter la demande.'));
    }
  };

  const confirmSold = (property: Property) => {
    Alert.alert(
      tAdmin("Confirmer occupation"),
      tAdmin('Marquer "{title}" comme {status} ?')
        .replace('{title}', property.title)
        .replace('{status}', tAdmin('Occupé')),
      [
        { text: tAdmin("Annuler"), style: 'cancel' },
        { text: tAdmin('Occupé'), style: 'destructive', onPress: () => handleAvailability(property, 'occupied') },
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

  const handleVerifyReview = async (reviewId: string, verified: boolean) => {
    try {
      await setReviewVerified(reviewId, verified);
    } catch (error) {
      Alert.alert(tAdmin("Erreur"), error instanceof Error ? error.message : tAdmin("Impossible de moderer cet avis."));
    }
  };
  const handleToggleCommission = async (rule: CommissionRule) => {
    try {
      await toggleCommissionRule(rule.id);
    } catch (error) {
      Alert.alert(
        tAdmin("Erreur"),
        error instanceof Error ? error.message : 'Impossible de modifier cette règle de commission.'
      );
    }
  };
  const handleMarkPaid = async (payment: { id: string }) => {
    try {
      await updatePaymentStatus(payment.id, 'paid');
    } catch {
      Alert.alert(tAdmin("Erreur"), tAdmin("Impossible de mettre a jour le paiement."));
    }
  };
  const handleDispute = async (payment: { id: string }) => {
    try {
      await updatePaymentStatus(payment.id, 'late');
    } catch {
      Alert.alert(tAdmin("Erreur"), tAdmin("Impossible de mettre a jour le paiement."));
    }
  };
  const resolveTenantDocumentUrl = async (document: TenantDocument) => {
    if (/^https?:\/\//i.test(document.url)) return document.url;
    const { data, error } = await supabase.storage
      .from('tenant-documents')
      .createSignedUrl(document.url, 60);
    if (error) throw error;
    return data.signedUrl;
  };

  const handleOpenDocument = async (document: TenantDocument) => {
    try {
      await Linking.openURL(await resolveTenantDocumentUrl(document));
    } catch (error) {
      Alert.alert(tAdmin("Erreur"), error instanceof Error ? error.message : tAdmin("Impossible d'ouvrir le document."));
    }
  };

  const handleShareDocument = async (document: TenantDocument) => {
    try {
      const url = await resolveTenantDocumentUrl(document);
      const result = await shareContent({ message: url, url });
      if (result === 'copied') {
        Alert.alert(tAdmin("Succes"), tAdmin("Lien copie dans le presse-papiers."));
      }
    } catch (error) {
      Alert.alert(tAdmin("Erreur"), error instanceof Error ? error.message : tAdmin("Impossible de partager le document."));
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'accounts' || activeTab === 'agents') {
      void loadAdminAccounts()
        .catch(() => {})
        .finally(() => setRefreshing(false));
      return;
    }
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleLock = () => {
    setUnlocked(false);
    setPinInput('');
  };

  const handleSetupPin = async () => {
    if (pinInput.trim().length < 4) {
      Alert.alert(tAdmin("PIN invalide"), tAdmin("Le PIN doit contenir au moins 4 chiffres."));
      return;
    }
    if (pinInput !== pinConfirm) {
      Alert.alert(tAdmin("PIN different"), tAdmin("La confirmation ne correspond pas."));
      return;
    }
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem('admin_pin', pinInput);
      } else {
        await SecureStore.setItemAsync('admin_pin', pinInput);
      }
      setStoredPin(pinInput);
      setUnlocked(true);
      setPinInput('');
      setPinConfirm('');
      Alert.alert(tAdmin("Succes"), tAdmin("PIN Admin enregistre."));
    } catch {
      Alert.alert(tAdmin("Erreur"), tAdmin("Impossible d'enregistrer le PIN sur cet appareil."));
    }
  };

  const handleUnlock = () => {
    if (!storedPin) return;
    if (pinInput === storedPin) {
      setUnlocked(true);
      setPinInput('');
    } else {
      Alert.alert(tAdmin("Acces refuse"), tAdmin("PIN incorrect."));
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
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `imo-nord-togo-backup-${safeDate}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }

      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) throw new Error('NO_FS_DIR');

      const uri = `${baseDir}imo-nord-togo-backup-${safeDate}.json`;
      await FileSystem.writeAsStringAsync(uri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const shareAvailable = await Sharing.isAvailableAsync();
      if (shareAvailable) {
        await Sharing.shareAsync(uri, {
          dialogTitle: tAdmin("Exporter le backup"),
          mimeType: 'application/json',
        });
      } else {
        await Share.share({ message: json });
      }
    } catch {
      Alert.alert(tAdmin("Erreur"), tAdmin("Impossible d'exporter le backup."));
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
        Alert.alert(tAdmin("Erreur"), tAdmin("Fichier non support."));
        return;
      }

      let content: string;
      if (Platform.OS === 'web') {
        const response = await fetch(picked.uri);
        if (!response.ok) throw new Error(`Unable to read selected backup (${response.status}).`);
        content = await response.text();
      } else {
        content = await FileSystem.readAsStringAsync(picked.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }
      const parsed = JSON.parse(content);

      if (!isValidBackup(parsed)) {
        Alert.alert(tAdmin("Backup invalide"), tAdmin("Le fichier ne contient pas les donnes attendues."));
        return;
      }

      Alert.alert(
        tAdmin("Importer backup"),
        tAdmin("Cette action remplacera les donnes actuelles. Continuer ?"),
        [
          { text: tAdmin("Annuler"), style: 'cancel' },
          {
            text: tAdmin("Importer"),
            style: 'destructive',
            onPress: () => {
              replaceData({ properties: parsed.properties, clients: parsed.clients });
              Alert.alert(tAdmin("Succes"), tAdmin("Backup importe."));
            },
          },
        ]
      );
    } catch {
      Alert.alert(tAdmin("Erreur"), tAdmin("Impossible d'importer le backup."));
    }
  };

  const addImageFromLibrary = async () => {
    try {
      const remaining = MAX_PROPERTY_IMAGES - draftImages.length;
      if (remaining <= 0) {
        Alert.alert(tAdmin("Limite atteinte"), tAdmin("Maximum {count} images par bien.").replace('{count}', String(MAX_PROPERTY_IMAGES)));
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(tAdmin("Permission requise"), tAdmin("Autorisez l'acces aux photos pour choisir une image."));
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
      Alert.alert(tAdmin("Erreur"), tAdmin("Impossible d'ouvrir la galerie."));
    }
  };

  const addImageFromCamera = async () => {
    try {
      const remaining = MAX_PROPERTY_IMAGES - draftImages.length;
      if (remaining <= 0) {
        Alert.alert(tAdmin("Limite atteinte"), tAdmin("Maximum {count} images par bien.").replace('{count}', String(MAX_PROPERTY_IMAGES)));
        return;
      }
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(tAdmin("Permission requise"), tAdmin("Autorisez la camra pour prendre une photo."));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
      });
      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (uri) setDraftImages(prev => [uri, ...prev].slice(0, MAX_PROPERTY_IMAGES));
    } catch {
      Alert.alert(tAdmin("Erreur"), tAdmin("Impossible d'ouvrir la camra."));
    }
  };

  const handleAddProperty = async () => {
    if (draftImages.length > MAX_PROPERTY_IMAGES) {
      Alert.alert(tAdmin("Erreur"), tAdmin("Maximum {count} images par bien.").replace('{count}', String(MAX_PROPERTY_IMAGES)));
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
      Alert.alert(tAdmin("Erreur"), tAdmin("Veuillez remplir tous les champs obligatoires"));
      return;
    }

    try {
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

      Alert.alert(tAdmin("Succes"), tAdmin("Annonce modifiee avec succes."));
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

      Alert.alert(tAdmin("Succes"), tAdmin("Annonce ajoutee avec succes."));
      }

      closePropertyModal();
      resetPropertyForm();
    } catch (error) {
      Alert.alert(tAdmin("Erreur"), error instanceof Error ? error.message : "Impossible d'enregistrer l'annonce.");
    }
  };
  const handleDeleteProperty = (id: string, title: string) => {
    Alert.alert(
      tAdmin("Confirmer la suppression"),
      tAdmin("Voulez-vous vraiment supprimer \"{title}\"?").replace('{title}', title),
      [
        { text: tAdmin("Annuler"), style: 'cancel' },
        { text: tAdmin("Supprimer"), style: 'destructive', onPress: async () => {
          await deleteProperty(id);
          logAdminAction('delete', 'property', id, { title });
        } },
      ]
    );
  };

  const renderDashboard = () => {
    const { pendingListings, unreadMessages, pendingTransactions, recentProperties } = dashboardMetrics;

    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 32, 48) }}
        nestedScrollEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <View>
              <Text style={styles.overviewTitle}>{tAdmin("Vue rapide")}</Text>
              <Text style={styles.overviewSubtitle}>{tAdmin("Alertes prioritaires du jour")}</Text>
            </View>
            <View style={styles.overviewBadge}>
              <Text style={styles.overviewBadgeText}>{tAdmin("Live")}</Text>
            </View>
          </View>
          <View style={styles.overviewGrid}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>{tAdmin("Annonces a valider")}</Text>
              <Text style={styles.overviewValue}>{pendingListings}</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>{tAdmin("Messages")}</Text>
              <Text style={styles.overviewValue}>{unreadMessages}</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>{tAdmin("Paiements en attente")}</Text>
              <Text style={styles.overviewValue}>{pendingTransactions}</Text>
            </View>
          </View>
        </View>

      {/* Backup */}
      <View style={styles.backupCard}>
        <View style={styles.backupHeader}>
          <Text style={styles.backupTitle}>{tAdmin("Sauvegarde")}</Text>
          <Text style={styles.backupSub}>{tAdmin("Exporter / importer les donnees")}</Text>
        </View>
        <View style={styles.backupActions}>
          <TouchableOpacity style={styles.backupButton} onPress={handleExportBackup}>
            <Ionicons name="download" size={18} color={theme.onBrand} />
            <Text style={styles.backupButtonText}>{tAdmin("Exporter")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backupButtonSecondary} onPress={handleImportBackup}>
            <Ionicons name="cloud-upload" size={18} color={theme.accentText} />
            <Text style={styles.backupButtonTextSecondary}>{tAdmin("Importer")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Links */}
      <View style={styles.quickLinks}>
        <TouchableOpacity
          style={styles.quickLinkButton}
          onPress={() => handleTabChange('neighborhoods')}
        >
          <Ionicons name="location" size={16} color={theme.accentText} />
          <Text style={styles.quickLinkText}>{tAdmin("Gerer quartiers")}</Text>
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
            <Text style={styles.statMeta}>{tAdmin("Inventaire")}</Text>
          </View>
          <Text style={styles.statNumber}>{stats.totalProperties}</Text>
          <Text style={styles.statLabel}>{tAdmin("Biens")}</Text>
        </View>

        <View style={[styles.statCard, styles.cardElevated]}>
          <View style={[styles.statAccent, { backgroundColor: theme.info }]} />
          <View style={styles.statHeaderRow}>
            <View style={[styles.statIconWrap, { backgroundColor: theme.infoSoft }]}>
              <Ionicons name="people" size={16} color={theme.info} />
            </View>
            <Text style={styles.statMeta}>{tAdmin("Base locataires")}</Text>
          </View>
          <Text style={styles.statNumber}>{stats.totalClients}</Text>
          <Text style={styles.statLabel}>{tAdmin("Locataires")}</Text>
        </View>

        <View style={[styles.statCard, styles.cardElevated]}>
          <View style={[styles.statAccent, { backgroundColor: theme.purple }]} />
          <View style={styles.statHeaderRow}>
            <View style={[styles.statIconWrap, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name="people-circle" size={16} color={theme.text} />
            </View>
            <Text style={styles.statMeta}>{tAdmin("Audience")}</Text>
          </View>
          <Text style={styles.statNumber}>{visitorCount}</Text>
          <Text style={styles.statLabel}>{tAdmin("Visiteurs")}</Text>
        </View>

        <View style={[styles.statCard, styles.cardElevated]}>
          <View style={[styles.statAccent, { backgroundColor: theme.warning }]} />
          <View style={styles.statHeaderRow}>
            <View style={[styles.statIconWrap, { backgroundColor: theme.warningSoft }]}>
              <Ionicons name="time" size={16} color={theme.warning} />
            </View>
            <Text style={styles.statMeta}>{tAdmin("Backlog")}</Text>
          </View>
          <Text style={styles.statNumber}>{stats.pendingProperties}</Text>
          <Text style={styles.statLabel}>{tAdmin("En attente")}</Text>
        </View>

        <View style={[styles.statCard, styles.cardElevated]}>
          <View style={[styles.statAccent, { backgroundColor: theme.headerBg }]} />
          <View style={styles.statHeaderRow}>
            <View style={[styles.statIconWrap, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name="checkmark-circle" size={16} color={theme.text} />
            </View>
            <Text style={styles.statMeta}>{tAdmin("Clotures")}</Text>
          </View>
          <Text style={styles.statNumber}>{stats.soldProperties}</Text>
          <Text style={styles.statLabel}>{tAdmin("Vendus/Loues")}</Text>
        </View>
      </ScrollView>

      {/* Properties by Type */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>{tAdmin("Repartition par type")}</Text>
          <Text style={styles.sectionSubtitle}>{tAdmin("Lecture rapide du mix d'annonces.")}</Text>
        </View>
      </View>
      <View style={styles.typeBreakdown}>
        {stats.propertiesByType.map(item => (
          <View key={item.type} style={styles.typeRow}>
            <View style={styles.typeInfo}>
              <View style={[styles.typeDot, { backgroundColor: PROPERTY_TYPE_COLORS[item.type] }]} />
              <Text style={styles.typeName}>{tType(item.type)}</Text>
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
          <Text style={styles.sectionTitle}>{tAdmin("Activite recente")}</Text>
          <Text style={styles.sectionSubtitle}>{tAdmin("Dernieres actions sur les annonces.")}</Text>
        </View>
        {properties.length > recentProperties.length && (
          <TouchableOpacity onPress={() => handleTabChange('properties')}>
            <Text style={styles.sectionLink}>{tAdmin("Voir tout")}</Text>
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
          <Text style={styles.activityDate}>{formatAdminDate(property.createdAt)}</Text>
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
            <Text style={styles.sectionTitle}>{tAdmin("Annonces")}</Text>
            <Text style={styles.sectionSubtitle}>{tAdmin("Validation, priorite et qualite.")}</Text>
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
                  ? tAdmin("Tous")
                  : status === 'available'
                  ? tAdmin("Disponibles")
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
                  ? tAdmin("Validation")
                  : status === 'pending'
                  ? tAdmin("En attente")
                  : status === 'approved'
                  ? tAdmin("Approuvé")
                  : status === 'rejected'
                  ? tAdmin("Refusé")
                  : tAdmin("Archivé")}
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
              {tAdmin("Vedette")}
            </Text>
          </TouchableOpacity>
        </View>
        {searchedProperties.length === 0 && (
          <Text style={styles.emptyText}>{tAdmin("Aucune annonce pour ce filtre.")}</Text>
        )}
      </View>
    );

    return (
      <FlatList
        style={styles.propertyListViewport}
        contentContainerStyle={[
          styles.propertyListContent,
          { paddingBottom: Math.max(insets.bottom + 32, 48) },
        ]}
        data={visibleProperties}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <>
            <View style={styles.propertyListChrome}>{renderAdminChrome()}</View>
            {listHeader}
          </>
        }
        ListFooterComponent={
          hasMoreProperties ? (
            <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('properties')}>
              <Text style={styles.loadMoreText}>{tAdmin("Charger plus")}</Text>
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
                    <Text style={styles.featuredBadgeText}>{tAdmin("Vedette")}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.propertyHeaderRow}>
                <View style={[styles.propertyTypeBadge, { backgroundColor: PROPERTY_TYPE_COLORS[property.type] }]}>
                  <Text style={styles.propertyTypeText}>{tType(property.type)}</Text>
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

              <Text style={styles.propertyTitle}>{property.title}</Text>
              <Text style={styles.propertyLocation}>
                {[property.neighborhood, property.location].filter(Boolean).join(' | ')}
              </Text>
              <Text style={styles.propertyPrice}>{formatPrice(property.price)}</Text>

              <View style={styles.actionGrid}>
                <ActionButton
                  label={tAdmin("VIP")}
                  icon={property.featured ? 'star' : 'star-outline'}
                  onPress={() => handleToggleFeatured(property)}
                  style={property.featured ? styles.actionVipActive : styles.actionVip}
                  color={property.featured ? theme.warning : theme.textMuted}
                />
                {listingStatus !== 'approved' && (
                  <ActionButton
                    label={tAdmin("Valider")}
                    icon="checkmark-circle"
                    onPress={() => handleSetListingStatus(property, 'approved')}
                    style={styles.actionApprove}
                    color={theme.success}
                  />
                )}
                {listingStatus !== 'rejected' && (
                  <ActionButton
                    label={tAdmin("Refuser")}
                    icon="close-circle"
                    onPress={() => handleSetListingStatus(property, 'rejected')}
                    style={styles.actionReject}
                    color={theme.danger}
                  />
                )}
                {listingStatus !== 'archived' && (
                  <ActionButton
                    label={tAdmin("Archiver")}
                    icon="archive"
                    onPress={() => handleSetListingStatus(property, 'archived')}
                    style={styles.actionArchive}
                    color={theme.textMuted}
                  />
                )}
                <ActionButton
                  label={tAdmin("Editer")}
                  icon="create-outline"
                  onPress={() => openEditPropertyModal(property)}
                  style={styles.actionEdit}
                  color={theme.accent}
                />
                {property.status !== 'available' && (
                  <ActionButton
                    label={tAdmin("Disponible")}
                    icon="checkmark"
                    onPress={() => handleAvailability(property, 'available')}
                    style={styles.actionApprove}
                    color={theme.success}
                  />
                )}
                {property.status !== 'occupied' && (
                  <ActionButton
                    label={tAdmin("Occupé")}
                    icon="key-outline"
                    onPress={() => confirmSold(property)}
                    style={styles.actionSold}
                    color={theme.warning}
                  />
                )}
                <ActionButton
                  label={tAdmin("Supprimer")}
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
          <Text style={styles.sectionTitle}>{tAdmin("Locataires")}</Text>
          <Text style={styles.sectionSubtitle}>{tAdmin("Contacts et contrats en cours.")}</Text>
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
              <Text style={styles.loadMoreText}>{tAdmin("Charger plus")}</Text>
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
                {contractCountByTenant.get(client.id) ?? 0} {tAdmin("Contrats").toLowerCase()}
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
    return (
      <AdminAccountsTab
        accounts={adminAccounts}
        currentUserId={currentUser?.id ?? ''}
        search={includesQuery}
        searching={shouldFilter}
        limit={listLimits.users}
        onLoadMore={() => increaseLimit('users')}
        loading={accountsLoading}
        error={accountsError}
        refreshing={refreshing}
        onRefresh={onRefresh}
        accountUpdateId={accountUpdateId}
        onAccountStatus={user => void handleAccountStatus(user)}
        onReviewAgent={(user, approved) => void handleReviewAgent(user, approved)}
        onVerify={(user, verified) => void handleVerifyUser(user, verified)}
        onEdit={openEditUserModal}
        translate={tAdmin}
        theme={theme}
        styles={styles}
      />
    );
  };

  const renderNeighborhoods = () => {
    const filteredNeighborhoods = shouldFilter
      ? neighborhoods.filter(name => includesQuery(name))
      : neighborhoods;
    const sortedNeighborhoods = [...filteredNeighborhoods].sort((a, b) =>
        a.localeCompare(b, language === 'en' ? 'en' : 'fr', { sensitivity: 'base' })
    );

      return (
        <FlatList
          style={styles.tabContent}
          data={sortedNeighborhoods}
          keyExtractor={name => name}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          ListHeaderComponent={
            <>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>{tAdmin("Quartiers")}</Text>
                  <Text style={styles.sectionSubtitle}>{tAdmin("Zones principales de publication.")}</Text>
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
                  placeholder={tAdmin("Ajouter un quartier")}
                  placeholderTextColor={theme.textSoft}
                />
                <TouchableOpacity style={styles.neighborhoodAddButton} onPress={handleAddNeighborhood}>
                  <Ionicons name="add" size={18} color={theme.onBrand} />
                </TouchableOpacity>
              </View>
            </>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>{tAdmin("Aucun quartier pour le moment.")}</Text>}
          renderItem={({ item: name }) => {
            const count = properties.filter(
              property => (property.neighborhood ?? '').toLowerCase() === name.toLowerCase()
            ).length;
            return (
              <View style={styles.neighborhoodChipRow}>
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
                  <TouchableOpacity style={styles.neighborhoodEdit} onPress={() => openEditNeighborhood(name)}>
                    <Ionicons name="create-outline" size={16} color={theme.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.neighborhoodDelete} onPress={() => handleRemoveNeighborhood(name)}>
                    <Ionicons name="trash" size={16} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
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
      <FlatList
        style={styles.tabContent}
        data={visibleReports}
        keyExtractor={report => report.id}
        ListHeaderComponent={
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>{tAdmin("Signalements")}</Text>
              <Text style={styles.sectionSubtitle}>{tAdmin("Moderation et alertes fraude.")}</Text>
            </View>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{filteredReports.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{tAdmin("Aucun signalement pour le moment.")}</Text>}
        ListFooterComponent={hasMoreReports ? (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('reports')}>
            <Text style={styles.loadMoreText}>{tAdmin("Charger plus")}</Text>
          </TouchableOpacity>
        ) : null}
        renderItem={({ item: report }) => {
          const property = properties.find(p => p.id === report.propertyId);
          return (
            <View style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportTitle}>{property?.title || tAdmin("Annonce supprimee")}</Text>
                <View style={[styles.reportStatus, report.status === 'OPEN' ? styles.reportOpen : styles.reportResolved]}>
                  <Text style={styles.reportStatusText}>
                    {report.status === 'OPEN' ? tAdmin("Ouvert") : tAdmin("Resolue")}
                  </Text>
                </View>
              </View>
              <Text style={styles.reportMeta}>
                {[property?.neighborhood, property?.location].filter(Boolean).join(' | ') || tAdmin("Localité inconnue")}
              </Text>
              <Text style={styles.reportReason}>
                {tAdmin("Raison:")} {report.reason === 'FRAUD'
                  ? tAdmin("Fraude")
                  : report.reason === 'DUPLICATE'
                  ? tAdmin("Doublon")
                  : report.reason === 'INAPPROPRIATE'
                  ? tAdmin("Inapproprie")
                  : tAdmin("Autre")}
              </Text>
              {report.message ? <Text style={styles.reportMessage}>{report.message}</Text> : null}
              {report.status === 'OPEN' && (
                <TouchableOpacity style={styles.reportResolve} onPress={() => resolveReport(report.id)}>
                  <Ionicons name="checkmark" size={16} color={theme.accent} />
                  <Text style={styles.reportResolveText}>{tAdmin("Marquer comme resolu")}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
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
    const supportInbox = (
      <AdminSupportInbox
        conversations={supportConversations}
        selectedConversationId={selectedSupportId}
        messages={supportMessages}
        currentUserId={currentUser?.id ?? ''}
        reply={supportReply}
        loading={supportLoading}
        error={supportError}
        sending={supportSending}
        onRefresh={() => void loadSupportConversations()}
        onSelectConversation={setSelectedSupportId}
        onToggleStatus={conversation => void toggleSupportConversationStatus(conversation)}
        onReplyChange={setSupportReply}
        onSend={() => void sendSupportReply()}
        formatDateTime={formatAdminDateTime}
        translate={tAdmin}
        theme={theme}
        styles={styles}
      />
    );

    return (
      <FlatList
        style={styles.tabContent}
        data={visibleMessages}
        keyExtractor={message => message.id}
        ListHeaderComponent={
          <View>
            {supportInbox}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>{tAdmin("Messages")}</Text>
                <Text style={styles.sectionSubtitle}>{tAdmin("Suivi des conversations en cours.")}</Text>
              </View>
              <View style={styles.sectionCount}>
                <Text style={styles.sectionCountText}>{filteredMessages.length}</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{tAdmin("Aucun message pour le moment.")}</Text>}
        ListFooterComponent={hasMoreMessages ? (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('messages')}>
            <Text style={styles.loadMoreText}>{tAdmin("Charger plus")}</Text>
          </TouchableOpacity>
        ) : null}
        renderItem={({ item: message }) => (
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle} numberOfLines={1}>{message.content}</Text>
              <View style={[styles.badge, message.read ? styles.badgeMuted : styles.badgeAccent]}>
                <Text style={[styles.badgeText, message.read ? styles.badgeTextMuted : styles.badgeTextAccent]}>
                  {message.read ? tAdmin("Lu") : tAdmin("Non lu")}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{tAdmin("De:")} {message.senderId}</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{tAdmin("A:")} {message.receiverId}</Text>
              </View>
              {message.propertyId ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>{tAdmin("Bien:")} {message.propertyId}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.infoMeta}>{formatAdminDateTime(message.timestamp)}</Text>
          </View>
        )}
      />
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
      <FlatList
        style={styles.tabContent}
        data={visibleReviews}
        keyExtractor={review => review.id}
        ListHeaderComponent={
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>{tAdmin("Avis")}</Text>
              <Text style={styles.sectionSubtitle}>{tAdmin("Qualite, confiance et moderation.")}</Text>
            </View>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{filteredReviews.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{tAdmin("Aucun avis pour le moment.")}</Text>}
        ListFooterComponent={hasMoreReviews ? (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('reviews')}>
            <Text style={styles.loadMoreText}>{tAdmin("Charger plus")}</Text>
          </TouchableOpacity>
        ) : null}
        renderItem={({ item: review }) => (
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle}>{tAdmin("Note:")} {review.rating}/5</Text>
              <View style={[styles.badge, review.verified ? styles.badgeSuccess : styles.badgeWarning]}>
                <Text style={[styles.badgeText, review.verified ? styles.badgeTextSuccess : styles.badgeTextWarning]}>
                  {review.verified ? tAdmin("Vérifié") : tAdmin("À vérifier")}
                </Text>
              </View>
            </View>
            <Text style={styles.infoMeta}>{tAdmin("Bien:")} {review.propertyId}</Text>
            {review.comment ? <Text style={styles.reportMessage}>{review.comment}</Text> : null}
            <Text style={styles.infoMeta}>{formatAdminDateTime(review.createdAt)}</Text>
            <View style={styles.quickActionsRow}>
              <QuickAction
                label={review.verified ? tAdmin("Retirer") : tAdmin("Verifier")}
                icon="shield-checkmark-outline"
                tone="primary"
                onPress={() => void handleVerifyReview(review.id, !review.verified)}
              />
            </View>
          </View>
        )}
      />
    );
  };
  const renderAgents = () => {
    const filteredAgents = shouldFilter
      ? adminAccounts.filter(user => user.role === 'AGENT').filter(user => {
          return (
            includesQuery(user.id) ||
            includesQuery(user.name) ||
            includesQuery(user.email) ||
            includesQuery(user.phone)
          );
        })
      : adminAccounts.filter(user => user.role === 'AGENT');
    const visibleAgents = filteredAgents.slice(0, listLimits.agents);
    const hasMoreAgents = filteredAgents.length > listLimits.agents;

    return (
      <FlatList
        style={styles.tabContent}
        data={visibleAgents}
        keyExtractor={user => user.id}
        refreshControl={<RefreshControl refreshing={refreshing || accountsLoading} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>{tAdmin("Profils agents")}</Text>
              <Text style={styles.sectionSubtitle}>{tAdmin("Comptes agents et statut de validation.")}</Text>
            </View>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{filteredAgents.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          accountsLoading && !adminAccounts.length ? (
            <View style={styles.accountsLoading}>
              <ActivityIndicator color={theme.accent} />
              <Text style={styles.accountMeta}>{tAdmin("Chargement des comptes...")}</Text>
            </View>
          ) : accountsError ? (
            <Text style={styles.accountsError}>{accountsError}</Text>
          ) : (
            <Text style={styles.emptyText}>{tAdmin("Aucun profil d'agent pour le moment.")}</Text>
          )
        }
        ListFooterComponent={hasMoreAgents ? (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('agents')}>
            <Text style={styles.loadMoreText}>{tAdmin("Charger plus")}</Text>
          </TouchableOpacity>
        ) : null}
        renderItem={({ item: user }) => {
          const agentProperties = properties.filter(property => property.ownerId === user.id);
          const activeProperties = agentProperties.filter(property =>
            property.listingStatus === 'approved' && property.status === 'available'
          ).length;
          const soldProperties = agentProperties.filter(property => property.soldAt).length;
          const archivedProperties = agentProperties.filter(property =>
            property.listingStatus === 'archived'
          ).length;
          return (
            <View style={styles.clientItem}>
              <View style={styles.clientAvatar}>
                <Text style={styles.clientInitials}>{user.name.charAt(0).toUpperCase() || '?'}</Text>
              </View>
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{user.name || tAdmin("Utilisateur inconnu")}</Text>
                <Text style={styles.clientEmail}>{user.email}</Text>
                <Text style={styles.clientPhone}>{user.phone}</Text>
                <Text style={styles.clientPhone}>{tAdmin(user.agentStatus === 'approved'
                  ? "Approuvé"
                  : user.agentStatus === 'rejected' ? "Refusé" : "Demande agent en attente")}</Text>
                <Text style={styles.clientPhone}>
                  {tAdmin("Biens:")} {agentProperties.length} · {tAdmin("Actifs:")} {activeProperties} · {tAdmin("Vendus:")} {soldProperties} · {tAdmin("Archivés:")} {archivedProperties}
                </Text>
              </View>
            </View>
          );
        }}
      />
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
      <FlatList
        style={styles.tabContent}
        data={visiblePremium}
        keyExtractor={premium => premium.propertyId}
        ListHeaderComponent={
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>{tAdmin("Annonces premium")}</Text>
              <Text style={styles.sectionSubtitle}>{tAdmin("Mise en avant et dates actives.")}</Text>
            </View>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{filteredPremium.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{tAdmin("Aucune annonce premium pour le moment.")}</Text>}
        ListFooterComponent={hasMorePremium ? (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('premium')}>
            <Text style={styles.loadMoreText}>{tAdmin("Charger plus")}</Text>
          </TouchableOpacity>
        ) : null}
        renderItem={({ item: premium }) => (
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle}>{tAdmin("Bien:")} {premium.propertyId}</Text>
              <View style={[styles.badge, styles.badgeAccent]}>
                <Text style={[styles.badgeText, styles.badgeTextAccent]}>{premium.plan}</Text>
              </View>
            </View>
            <Text style={styles.infoMeta}>
              {tAdmin("Du {start} au {end}")
                .replace('{start}', formatAdminDate(premium.startDate))
                .replace('{end}', formatAdminDate(premium.endDate))}
            </Text>
            <View style={styles.quickActionsRow}>
              <QuickAction
                label={tAdmin("Detail")}
                icon="open-outline"
                onPress={() => Alert.alert(
                  tAdmin("Premium"),
                  tAdmin("Plan {plan} actif jusqu'au {date}")
                    .replace('{plan}', premium.plan)
                    .replace('{date}', formatAdminDate(premium.endDate))
                )}
              />
            </View>
          </View>
        )}
      />
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
      <FlatList
        style={styles.tabContent}
        data={visibleCommissions}
        keyExtractor={rule => rule.id}
        ListHeaderComponent={
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>{tAdmin("Regles de commission")}</Text>
              <Text style={styles.sectionSubtitle}>{tAdmin("Taux et seuils par agent.")}</Text>
            </View>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{filteredCommissions.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{tAdmin("Aucune regle de commission pour le moment.")}</Text>}
        ListFooterComponent={hasMoreCommissions ? (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('commissions')}>
            <Text style={styles.loadMoreText}>{tAdmin("Charger plus")}</Text>
          </TouchableOpacity>
        ) : null}
        renderItem={({ item: rule }) => (
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle}>{tAdmin("Agent:")} {rule.agentId}</Text>
              <View style={[styles.badge, rule.active ? styles.badgeSuccess : styles.badgeMuted]}>
                <Text style={[styles.badgeText, rule.active ? styles.badgeTextSuccess : styles.badgeTextMuted]}>
                  {rule.active ? tAdmin("Actif") : tAdmin("Inactif")}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{tAdmin("Taux:")} {rule.percentage}%</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{tAdmin("Min:")} {rule.minAmount} XOF</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{tAdmin("Max:")} {rule.maxAmount} XOF</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{tAdmin("Type:")} {rule.propertyType === 'ALL' ? tAdmin("Tout") : tType(rule.propertyType)}</Text>
              </View>
            </View>
            <View style={styles.quickActionsRow}>
              <QuickAction
                label={rule.active ? tAdmin("Desactiver") : tAdmin("Activer")}
                icon={rule.active ? 'pause-circle-outline' : 'play-circle-outline'}
                tone={rule.active ? 'danger' : 'primary'}
                onPress={() => handleToggleCommission(rule)}
              />
              <QuickAction
                label={tAdmin("Detail")}
                icon="information-circle-outline"
                onPress={() => Alert.alert(
                  tAdmin("Commission"),
                  `${tAdmin('Taux')} ${rule.percentage}% | ${tAdmin('Type')} ${rule.propertyType === 'ALL' ? tAdmin('Tout') : tType(rule.propertyType)}`
                )}
              />
            </View>
          </View>
        )}
      />
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
      <FlatList
        style={styles.tabContent}
        data={visiblePayments}
        keyExtractor={payment => payment.id}
        ListHeaderComponent={
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>{tAdmin("Paiements")}</Text>
              <Text style={styles.sectionSubtitle}>{tAdmin("Suivi des loyers et reglements.")}</Text>
            </View>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{filteredPayments.length}</Text>
            </View>
            <TouchableOpacity style={styles.sectionActionButton} onPress={openPaymentModal} hitSlop={6} accessibilityRole="button" accessibilityLabel={tAdmin("Ajouter un paiement")}>
              <Ionicons name="add" size={18} color={theme.onBrand} />
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{tAdmin("Aucun paiement pour le moment.")}</Text>}
        ListFooterComponent={hasMorePayments ? (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('payments')}>
            <Text style={styles.loadMoreText}>{tAdmin("Charger plus")}</Text>
          </TouchableOpacity>
        ) : null}
        renderItem={({ item: payment }) => (
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle}>{payment.amount} XOF</Text>
              <View style={[
                styles.badge,
                payment.status === 'paid'
                  ? styles.badgeSuccess
                  : payment.status === 'pending'
                  ? styles.badgeWarning
                  : styles.badgeDanger,
              ]}>
                <Text style={[
                  styles.badgeText,
                  payment.status === 'paid'
                    ? styles.badgeTextSuccess
                    : payment.status === 'pending'
                    ? styles.badgeTextWarning
                    : styles.badgeTextDanger,
                ]}>
                  {tAdmin(payment.status === 'paid' ? 'Payé' : payment.status === 'pending' ? 'En attente' : 'En retard')}
                </Text>
              </View>
            </View>
            <Text style={styles.infoMeta}>{tAdmin("Contrat:")} {getContractLabel(payment.contractId)}</Text>
            <Text style={styles.infoMeta}>{tAdmin("Mode:")} {tAdmin(payment.method === 'cash' ? 'Cash' : 'Mobile Money')}</Text>
            <Text style={styles.infoMeta}>{formatAdminDateTime(payment.paidAt)}</Text>
            <View style={styles.quickActionsRow}>
              <QuickAction label={tAdmin("Editer")} icon="create-outline" onPress={() => openEditPayment(payment)} />
              <QuickAction label={tAdmin("Recu PDF")} icon="document-text-outline" tone="primary" onPress={() => printPaymentReceipt(payment)} />
              <QuickAction label={tAdmin("Marquer paye")} icon="checkmark-circle-outline" tone="primary" onPress={() => handleMarkPaid(payment)} />
              <QuickAction label={tAdmin("Litige")} icon="alert-circle-outline" tone="danger" onPress={() => handleDispute(payment)} />
            </View>
          </View>
        )}
      />
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
      <FlatList
        style={styles.tabContent}
        data={visibleContracts}
        keyExtractor={contract => contract.id}
        ListHeaderComponent={
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>{tAdmin("Contrats")}</Text>
              <Text style={styles.sectionSubtitle}>{tAdmin("Baux en cours et historiques.")}</Text>
            </View>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{filteredContracts.length}</Text>
            </View>
            <TouchableOpacity style={styles.sectionActionButton} onPress={openContractModal} hitSlop={6} accessibilityRole="button" accessibilityLabel={tAdmin("Ajouter un contrat")}>
              <Ionicons name="add" size={18} color={theme.onBrand} />
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{tAdmin("Aucun contrat pour le moment.")}</Text>}
        ListFooterComponent={hasMoreContracts ? (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('contracts')}>
            <Text style={styles.loadMoreText}>{tAdmin("Charger plus")}</Text>
          </TouchableOpacity>
        ) : null}
        renderItem={({ item: contract }) => {
          const property = properties.find(p => p.id === contract.propertyId);
          const tenant = clients.find(c => c.id === contract.tenantId);
          return (
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoTitle}>{property?.title || tAdmin("Bien")}</Text>
                <View style={[styles.badge, contract.status === 'active' ? styles.badgeSuccess : styles.badgeMuted]}>
                  <Text style={[styles.badgeText, contract.status === 'active' ? styles.badgeTextSuccess : styles.badgeTextMuted]}>
                    {tAdmin(contract.status === 'active' ? 'Actif' : 'Expire')}
                  </Text>
                </View>
              </View>
              <Text style={styles.infoMeta}>{tAdmin("Locataire:")} {tenant?.name || contract.tenantId}</Text>
              <Text style={styles.infoMeta}>
                {tAdmin("Periode:")} {formatAdminDate(contract.startDate)} – {formatAdminDate(contract.endDate)}
              </Text>
              <Text style={styles.infoMeta}>{tAdmin("Loyer:")} {contract.rentAmount} XOF</Text>
              <View style={styles.quickActionsRow}>
                <QuickAction label={tAdmin("Editer")} icon="create-outline" onPress={() => openEditContract(contract)} />
                {contract.status !== 'active' && (
                  <QuickAction
                    label={tAdmin("Activer")}
                    icon="checkmark-circle-outline"
                    tone="primary"
                    onPress={() => updateContractStatus(contract.id, 'active')}
                  />
                )}
                {contract.status !== 'expired' && (
                  <QuickAction
                    label={tAdmin("Expirer")}
                    icon="time-outline"
                    tone="danger"
                    onPress={() => updateContractStatus(contract.id, 'expired')}
                  />
                )}
              </View>
            </View>
          );
        }}
      />
    );
  };
  const renderDocuments = () => {
    const filteredDocuments = shouldFilter
      ? tenantDocuments.filter(document =>
          includesQuery(clients.find(client => client.id === document.tenantId)?.name) ||
          includesQuery(document.type) ||
          includesQuery(document.tenantId)
        )
      : tenantDocuments;
    const visibleDocuments = filteredDocuments.slice(0, listLimits.documents);
    const hasMoreDocuments = filteredDocuments.length > listLimits.documents;

    return (
      <FlatList
        style={styles.tabContent}
        data={visibleDocuments}
        keyExtractor={document => document.id}
        ListHeaderComponent={
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>{tAdmin("Documents")}</Text>
              <Text style={styles.sectionSubtitle}>{tAdmin("Pièces liées aux dossiers locataires.")}</Text>
            </View>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{filteredDocuments.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{tAdmin("Aucun document pour le moment.")}</Text>}
        ListFooterComponent={hasMoreDocuments ? (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => increaseLimit('documents')}>
            <Text style={styles.loadMoreText}>{tAdmin("Charger plus")}</Text>
          </TouchableOpacity>
        ) : null}
        renderItem={({ item: document }) => {
          const tenant = clients.find(client => client.id === document.tenantId);
          return (
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoTitle}>{tenant?.name || document.tenantId.slice(0, 8)}</Text>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>
                    {document.type === 'cni'
                      ? tAdmin('CNI')
                      : document.type === 'contract' ? tAdmin('Contrat') : tAdmin('Autre')}
                  </Text>
                </View>
              </View>
              <Text style={styles.infoMeta}>{tAdmin("Locataire:")} {document.tenantId.slice(0, 8)}</Text>
              <Text style={styles.infoMeta}>{tAdmin("Upload:")} {formatAdminDateTime(document.createdAt)}</Text>
              <View style={styles.quickActionsRow}>
                <QuickAction
                  label={tAdmin("Ouvrir")}
                  icon="document-text-outline"
                  tone="primary"
                  onPress={() => void handleOpenDocument(document)}
                />
                <QuickAction
                  label={tAdmin("Partager")}
                  icon="share-social-outline"
                  onPress={() => void handleShareDocument(document)}
                />
              </View>
            </View>
          );
        }}
      />
    );
  };
  const renderAdminChrome = () => (
    <>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 16, 48) }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerBadgeRow}>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{tAdmin("Mini Admin")}</Text>
            </View>
            <Text style={styles.headerEyebrow}>{tAdmin("Back office mobile")}</Text>
          </View>
          <Text style={styles.headerTitle}>{tAdmin("Console Admin")}</Text>
          <Text style={styles.headerSubtitle}>{tAdmin("Actions rapides et supervision quotidienne.")}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.themeButton}
            onPress={() => setTheme(appTheme === 'dark' ? 'light' : 'dark')}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={appTheme === 'dark' ? tAdmin("Activer le thème clair") : tAdmin("Activer le thème sombre")}
          >
            <Ionicons
              name={appTheme === 'dark' ? 'sunny' : 'moon'}
              size={18}
              color={theme.accent}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.lockButton} onPress={handleLock} hitSlop={4} accessibilityRole="button" accessibilityLabel={tAdmin("Verrouiller l’administration")}>
            <Ionicons name="lock-closed" size={18} color={theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={openNewPropertyModal} hitSlop={4} accessibilityRole="button" accessibilityLabel={tAdmin("Ajouter un bien")}>
            <Ionicons name="add" size={22} color={theme.onBrand} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.toolbarCard}>
        <View style={styles.toolbarHeader}>
          <Text style={styles.toolbarTitle}>{tAdmin("Recherche & filtres")}</Text>
          <View style={styles.toolbarBadge}>
            <Text style={styles.toolbarBadgeText}>{tAdmin("Global")}</Text>
          </View>
        </View>
        <View style={[styles.searchBar, styles.searchBarShadow, styles.searchBarCompact]}>
          <Ionicons name="search" size={16} color={theme.textSoft} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={tAdmin("Rechercher partout...")}
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
                if (nextTab) handleTabChange(nextTab);
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

      <AdminNavigation
        activeTab={activeTab}
        onChange={handleTabChange}
        theme={theme}
        styles={styles}
        labels={{
          dashboard: tAdmin("Dashboard"),
          properties: tAdmin("Annonces"),
          clients: tAdmin("Locataires"),
          accounts: tAdmin("Comptes"),
          neighborhoods: tAdmin("Quartiers"),
          reports: tAdmin("Signalements"),
          add: tAdmin("Autres"),
          messages: tAdmin("Messages"),
          reviews: tAdmin("Avis"),
          agents: tAdmin("Profils agents"),
          premium: tAdmin("Premium"),
          commissions: tAdmin("Regles de commission"),
          transactions: tAdmin("Paiements"),
          contracts: tAdmin("Contrats"),
          documents: tAdmin("Documents"),
        }}
        closeLabel={tAdmin("Fermer")}
      />
    </>
  );

  if (!hydrated || gateLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Skeleton style={styles.loadingHeaderSkeleton} />
        <Skeleton style={styles.loadingSummarySkeleton} />
        {[0, 1, 2].map(item => (
          <Skeleton key={item} style={styles.loadingRowSkeleton} />
        ))}
      </View>
    );
  }

  if (!storedPin) {
    return (
      <AdminGate
        mode="setup"
        pinInput={pinInput}
        setPinInput={setPinInput}
        pinConfirm={pinConfirm}
        setPinConfirm={setPinConfirm}
        onSetup={handleSetupPin}
        onUnlock={handleUnlock}
        translate={tAdmin}
        theme={theme}
        styles={styles}
      />
    );
  }

  if (!unlocked) {
    return (
      <AdminGate
        mode="unlock"
        pinInput={pinInput}
        setPinInput={setPinInput}
        pinConfirm={pinConfirm}
        setPinConfirm={setPinConfirm}
        onSetup={handleSetupPin}
        onUnlock={handleUnlock}
        translate={tAdmin}
        theme={theme}
        styles={styles}
      />
    );
  }

  return (
    <View style={styles.container}>
      {activeTab !== 'properties' && renderAdminChrome()}

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
            <Text style={styles.modalTitle}>{editingPropertyId ? tAdmin("Modifier annonce") : tAdmin("Nouvelle annonce")}</Text>
            <TouchableOpacity onPress={handleAddProperty}>
              <Ionicons name="checkmark" size={24} color={theme.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >
            <Text style={styles.inputLabel}>{tAdmin("Titre *")}</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={text => setFormData({ ...formData, title: text })}
              placeholder={tAdmin("Ex: Villa moderne  Kara")}
            />

            <Text style={styles.inputLabel}>{tAdmin("Description")}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={text => setFormData({ ...formData, description: text })}
              placeholder={tAdmin("Dcrivez le bien...")}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.inputLabel}>{tAdmin("Photos")} ({draftImages.length}/{MAX_PROPERTY_IMAGES})</Text>
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoButton} onPress={addImageFromCamera}>
                <Ionicons name="camera" size={18} color={theme.accentText} />
                <Text style={styles.photoButtonText}>{tAdmin("Camra")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={addImageFromLibrary}>
                <Ionicons name="images" size={18} color={theme.accentText} />
                <Text style={styles.photoButtonText}>{tAdmin("Galerie")}</Text>
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
                      <Ionicons name="close" size={14} color={theme.onBrand} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <Text style={styles.inputLabel}>{tAdmin("Type de bien")}</Text>
            <View style={styles.typeSelector}>
              {Object.keys(PROPERTY_TYPE_LABELS).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeOption,
                    formData.type === type && { backgroundColor: PROPERTY_TYPE_COLORS[type as PropertyType] },
                  ]}
                  onPress={() => setFormData({ ...formData, type: type as PropertyType })}
                >
                  <Text style={[styles.typeOptionText, formData.type === type && { color: theme.accent }]}>
                    {tType(type as PropertyType)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>{tAdmin("Prix (FCFA) *")}</Text>
            <TextInput
              style={styles.input}
              value={formData.price}
              onChangeText={text => setFormData({ ...formData, price: text })}
              placeholder={tAdmin("Ex: 50000000")}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>{tAdmin("Localité (Ville) *")}</Text>
            <TextInput
              style={styles.input}
              value={formData.city}
              onChangeText={text => setFormData({ ...formData, city: text })}
              placeholder={tAdmin("Ex: Kara")}
            />

            <Text style={styles.inputLabel}>{tAdmin("Téléphone du propriétaire *")}</Text>
            <TextInput
              style={styles.input}
              value={formData.clientPhone}
              onChangeText={text => setFormData({ ...formData, clientPhone: text })}
              placeholder={tAdmin("Ex: +228 90 12 34 56")}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>{tAdmin("Nom du propriétaire")}</Text>
            <TextInput
              style={styles.input}
              value={formData.clientName}
              onChangeText={text => setFormData({ ...formData, clientName: text })}
              placeholder={tAdmin("Ex: Koffi Mensah")}
            />

            <Text style={styles.inputLabel}>{tAdmin("Email du propriétaire")}</Text>
            <TextInput
              style={styles.input}
              value={formData.clientEmail}
              onChangeText={text => setFormData({ ...formData, clientEmail: text })}
              placeholder={tAdmin("Ex: contact@example.com")}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>{tAdmin("Surface (m2)")}</Text>
            <TextInput
              style={styles.input}
              value={formData.area}
              onChangeText={text => setFormData({ ...formData, area: text })}
              placeholder={tAdmin("Ex: 200")}
              keyboardType="numeric"
            />

            {neighborhoods.length > 0 && (
              <View style={styles.neighborhoodPicker}>
                <Text style={styles.neighborhoodPickerLabel}>{tAdmin("Choisir un quartier")}</Text>
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

            <Text style={styles.inputLabel}>{tAdmin("Quartier *")}</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={text => setFormData({ ...formData, location: text })}
              placeholder={tAdmin("Ex: Quartier Kpod")}
            />

            <Text style={styles.inputLabel}>{tAdmin("Chambres")}</Text>
            <TextInput
              style={styles.input}
              value={formData.bedrooms}
              onChangeText={text => setFormData({ ...formData, bedrooms: text })}
              placeholder={tAdmin("Nombre de chambres")}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>{tAdmin("Équipements (séparés par des virgules)")}</Text>
            <TextInput
              style={styles.input}
              value={formData.amenities}
              onChangeText={text => setFormData({ ...formData, amenities: text })}
              placeholder={tAdmin("Ex: Piscine, Jardin, Garage")}
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
            <Text style={styles.modalTitle}>{tAdmin("Modifier locataire")}</Text>
            <TouchableOpacity onPress={handleSaveClient}>
              <Ionicons name="checkmark" size={24} color={theme.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >
            <Text style={styles.inputLabel}>{tAdmin("Nom *")}</Text>
            <TextInput
              style={styles.input}
              value={clientForm.name}
              onChangeText={text => setClientForm({ ...clientForm, name: text })}
              placeholder={tAdmin("Nom du locataire")}
            />

            <Text style={styles.inputLabel}>{tAdmin("Tlphone *")}</Text>
            <TextInput
              style={styles.input}
              value={clientForm.phone}
              onChangeText={text => setClientForm({ ...clientForm, phone: text })}
              placeholder="+228 90 12 34 56"
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>{tAdmin("Email")}</Text>
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
              <Text style={styles.modalTitle}>{tAdmin("Modifier quartier")}</Text>
              <TouchableOpacity onPress={handleUpdateNeighborhood} disabled={neighborhoodSaving}>
                {neighborhoodSaving ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Ionicons name="checkmark" size={24} color={theme.accent} />
                )}
              </TouchableOpacity>
            </View>

          <ScrollView
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >
            <Text style={styles.inputLabel}>{tAdmin("Nom du quartier")}</Text>
            <TextInput
              style={styles.input}
              value={neighborhoodEditValue}
              onChangeText={setNeighborhoodEditValue}
              placeholder={tAdmin("Nom du quartier")}
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
            <Text style={styles.modalTitle}>{editingContractId ? tAdmin("Modifier contrat") : tAdmin("Nouveau contrat")}</Text>
            <TouchableOpacity onPress={handleSaveContract}>
              <Ionicons name="checkmark" size={24} color={theme.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >
            <Text style={styles.inputLabel}>{tAdmin("Bien *")}</Text>
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

            <Text style={styles.inputLabel}>{tAdmin("Locataire *")}</Text>
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

            <Text style={styles.inputLabel}>{tAdmin("Date debut *")}</Text>
            <TextInput
              style={styles.input}
              value={contractForm.startDate}
              onChangeText={text => setContractForm({ ...contractForm, startDate: text })}
              placeholder="YYYY-MM-DD"
            />

            <Text style={styles.inputLabel}>{tAdmin("Date fin *")}</Text>
            <TextInput
              style={styles.input}
              value={contractForm.endDate}
              onChangeText={text => setContractForm({ ...contractForm, endDate: text })}
              placeholder="YYYY-MM-DD"
            />

            <Text style={styles.inputLabel}>{tAdmin("Loyer (XOF) *")}</Text>
            <TextInput
              style={styles.input}
              value={contractForm.rentAmount}
              onChangeText={text => setContractForm({ ...contractForm, rentAmount: text })}
              placeholder={tAdmin("Montant")}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>{tAdmin("Statut")}</Text>
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
                    {status === 'active' ? tAdmin("Actif") : tAdmin("Expire")}
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
            <Text style={styles.modalTitle}>{editingPaymentId ? tAdmin("Modifier paiement") : tAdmin("Nouveau paiement")}</Text>
            <TouchableOpacity onPress={handleSavePayment}>
              <Ionicons name="checkmark" size={24} color={theme.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >
            <Text style={styles.inputLabel}>{tAdmin("Contrat *")}</Text>
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

            <Text style={styles.inputLabel}>{tAdmin("Montant (XOF) *")}</Text>
            <TextInput
              style={styles.input}
              value={paymentForm.amount}
              onChangeText={text => setPaymentForm({ ...paymentForm, amount: text })}
              placeholder={tAdmin("Montant")}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>{tAdmin("Date paiement *")}</Text>
            <TextInput
              style={styles.input}
              value={paymentForm.paidAt}
              onChangeText={text => setPaymentForm({ ...paymentForm, paidAt: text })}
              placeholder="YYYY-MM-DD"
            />

            <Text style={styles.inputLabel}>{tAdmin("Mode")}</Text>
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
                    {method === 'cash' ? tAdmin("Cash") : tAdmin("Mobile Money")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>{tAdmin("Statut")}</Text>
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
                    {status === 'paid' ? tAdmin("Payé") : status === 'pending' ? tAdmin("En attente") : tAdmin("En retard")}
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
            <Text style={styles.modalTitle}>{tAdmin("Documents locataire")}</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >
            {tenantDocuments.filter(d => d.tenantId === activeTenantId).length === 0 ? (
              <Text style={styles.emptyText}>{tAdmin("Aucun document pour ce locataire.")}</Text>
            ) : (
              tenantDocuments
                .filter(d => d.tenantId === activeTenantId)
                .map(doc => (
                  <View key={doc.id} style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                      <Text style={styles.infoTitle}>{tAdmin(doc.type === 'cni' ? 'CNI' : doc.type === 'contract' ? 'Contrat' : 'Autre')}</Text>
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipText}>
                          {formatAdminDate(doc.createdAt)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.quickActionsRow}>
                      <QuickAction
                        label={tAdmin("Ouvrir")}
                        icon="document-text-outline"
                        tone="primary"
                        onPress={async () => {
                          const { data, error } = await supabase.storage
                            .from('tenant-documents')
                            .createSignedUrl(doc.url, 60);
                          if (error || !data?.signedUrl) {
                            Alert.alert(tAdmin("Erreur"), tAdmin("Impossible d'ouvrir ce document."));
                            return;
                          }
                          await Linking.openURL(data.signedUrl);
                        }}
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
            <Text style={styles.modalTitle}>{tAdmin("Modifier compte")}</Text>
            <TouchableOpacity onPress={handleSaveUser}>
              <Ionicons name="checkmark" size={24} color={theme.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >
            <Text style={styles.inputLabel}>{tAdmin("Nom *")}</Text>
            <TextInput
              style={styles.input}
              value={userForm.name}
              onChangeText={text => setUserForm({ ...userForm, name: text })}
              placeholder={tAdmin("Nom complet")}
            />

            <Text style={styles.inputLabel}>{tAdmin("Tlphone *")}</Text>
            <TextInput
              style={styles.input}
              value={userForm.phone}
              onChangeText={text => setUserForm({ ...userForm, phone: text })}
              placeholder="+228 90 12 34 56"
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>{tAdmin("Email")}</Text>
            <TextInput
              style={styles.input}
              value={userForm.email}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};


export default AdminScreen;
