import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { Image, Linking } from 'react-native';
import { AppAlert as Alert } from '../components/ui/appAlertService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  authCallbackUrl,
  exchangeAuthCallback,
  supabase,
  supabaseAnonKey,
  supabaseUrl,
} from '../lib/supabase';
import {
  PROPERTY_IMAGE_MAX_BYTES,
  PROPERTY_IMAGE_MAX_COUNT,
  PROPERTY_IMAGE_MAX_TOTAL_BYTES,
} from '../utils/imageUploadValidation';
import { safeRegisterExpoPushToken, safeScheduleLocalNotification } from '../lib/expoNotificationsSafe';
import { chunkStoragePaths, getPropertyImageStoragePaths } from '../utils/propertyStorage';
import {
  Property,
  PropertyCompletionType,
  Client,
  PropertyType,
  PropertyStatus,
  ListingStatus,
  SearchFilters,
  SavedSearch,
  Report,
  PropertyStats,
  ReportReason,
  User,
  Message,
  Chat,
  Review,
  AgentProfile,
  SearchAlert,
  PremiumListing,
  CommissionRule,
  Transaction,
  Document,
  Contract,
  Payment,
  TenantDocument,
  AppNotification,
} from '../types';
import { Language, TranslationKey, setCurrentLanguage, translate, translateStatus, translateType } from '../i18n';
import { isPublicProperty } from '../utils/propertyVisibility';
import { isDirectPublishingEnabled } from '../lib/publishing';
import {
  dedupeProperties,
  extractMissingPropertiesColumn,
  mapAgentProfileRow,
  mapCommissionRuleRow,
  mapMessageRow,
  mapPremiumListingRow,
  mapPropertyDocumentRow,
  mapPropertyRow,
  mapReportRow,
  mapReviewRow,
  mapSearchAlertRow,
  mapTransactionRow,
  normalizeNeighborhoods,
} from './appDataMappers';
import {
  AgentProfileRow,
  CommissionRuleRow,
  MessageRow,
  PremiumListingRow,
  PropertyDocumentRow,
  PropertyRow,
  ReportRow,
  ReviewRow,
  SearchAlertRow,
  TransactionRow,
} from '../types/db';
import { logger } from '../lib/logger';

interface AppContextType {
  properties: Property[];
  clients: Client[];
  neighborhoods: string[];
  favorites: string[];
  savedSearches: SavedSearch[];
  searchHistory: string[];
  recentViewedIds: string[];
  neighborhoodAlerts: string[];
  users: User[];
  currentUser: User | null;
  hydrated: boolean;
  syncError: string | null;
  retrySync: () => void;
  reports: Report[];
  propertyStats: Record<string, PropertyStats>;
  myPropertyIds: string[];
  visitorCount: number;
  privacySettings: { hideContact: boolean; hideListings: boolean };
  language: Language;
  setLanguage: (language: Language) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  t: (key: TranslationKey) => string;
  tType: (type: PropertyType) => string;
  tStatus: (status: PropertyStatus) => string;
  filters: SearchFilters;
  selectedProperty: Property | null;
  setSelectedProperty: (property: Property | null) => void;
  filterType: PropertyType | 'ALL';
  setFilterType: (type: PropertyType | 'ALL') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setFilters: (updates: Partial<SearchFilters>) => void;
  resetFilters: () => void;
  addProperty: (property: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Property>;
  updateProperty: (id: string, updates: Partial<Omit<Property, 'id' | 'createdAt'>>) => Promise<void>;
  updatePropertyStatus: (id: string, status: PropertyStatus) => Promise<void>;
  completeProperty: (id: string, completionType: PropertyCompletionType) => Promise<void>;
  markPropertySold: (id: string) => Promise<void>;
  clearSoldStatus: (id: string) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Promise<Client>;
  updateClient: (id: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>) => Promise<void>;
  addNeighborhood: (name: string) => Promise<void>;
  updateNeighborhood: (oldName: string, newName: string) => Promise<void>;
  removeNeighborhood: (name: string) => Promise<void>;
  addMyPropertyId: (id: string) => void;
  toggleFavorite: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean;
  addSavedSearch: (data: Omit<SavedSearch, 'id' | 'createdAt'>) => void;
  removeSavedSearch: (id: string) => void;
  addSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  toggleNeighborhoodAlert: (name: string) => void;
  setPrivacySetting: (key: 'hideContact' | 'hideListings', value: boolean) => void;
  registerUser: (data: { name: string; email: string; phone: string; password: string; wantsAgentAccess: boolean }) => Promise<{ ok: true; confirmationRequired: boolean } | { ok: false; code: string }>;
  loginUser: (email: string, password: string) => Promise<{ ok: true } | { ok: false; code: string }>;
  requestAgentAccess: () => Promise<void>;
  logoutUser: () => Promise<void>;
  verifyUser: (id: string, value: boolean) => Promise<void>;
  reviewAgentRequest: (id: string, approved: boolean, reason?: string) => Promise<void>;
  updateUser: (id: string, updates: Partial<Pick<User, 'name' | 'email' | 'phone'>>) => void;
  addReport: (data: { propertyId: string; reason: ReportReason; message: string }) => Promise<Report>;
  resolveReport: (id: string) => Promise<void>;
  trackPropertyView: (id: string) => void;
  trackContact: (id: string) => void;
  trackShare: (id: string) => void;
  replaceData: (data: { properties: Property[]; clients: Client[] }) => void;
  getFilteredProperties: () => Property[];
  getMyProperties: () => Property[];
  // New enhanced features
  messages: Message[];
  chats: Chat[];
  reviews: Review[];
  agentProfiles: AgentProfile[];
  searchAlerts: SearchAlert[];
  premiumListings: PremiumListing[];
  commissionRules: CommissionRule[];
  transactions: Transaction[];
  documents: Document[];
  contracts: Contract[];
  payments: Payment[];
  tenantDocuments: TenantDocument[];
  notifications: AppNotification[];
  markNotificationRead: (id: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
  addTenantDocumentRecord: (doc: TenantDocument) => void;
  addContract: (data: Omit<Contract, 'id' | 'createdAt'>) => Promise<Contract>;
  updateContract: (id: string, updates: Partial<Omit<Contract, 'id' | 'createdAt'>>) => Promise<void>;
  updateContractStatus: (id: string, status: Contract['status']) => Promise<void>;
  addPayment: (data: Omit<Payment, 'id' | 'createdAt'>) => Promise<Payment>;
  updatePayment: (id: string, updates: Partial<Omit<Payment, 'id' | 'createdAt'>>) => Promise<void>;
  updatePaymentStatus: (id: string, status: Payment['status']) => Promise<void>;
  // Messaging functions
  sendMessage: (receiverId: string, content: string, propertyId?: string) => Promise<{ message: Message; chatId: string }>;
  getChatMessages: (chatId: string) => Message[];
  markMessagesAsRead: (chatId: string, userId: string) => Promise<void>;
  // Review functions
  addReview: (propertyId: string, rating: number, comment: string) => Promise<Review>;
  setReviewVerified: (id: string, verified: boolean) => Promise<void>;
  getPropertyReviews: (propertyId: string) => Review[];
  getAverageRating: (propertyId: string) => number;
  // Agent profile functions
  createAgentProfile: (data: Omit<AgentProfile, 'rating' | 'reviewCount' | 'totalSales' | 'totalCommission'>) => Promise<void>;
  updateAgentProfile: (userId: string, updates: Partial<AgentProfile>) => Promise<void>;
  getAgentProfile: (userId: string) => AgentProfile | null;
  // Search alerts
  createSearchAlert: (data: Omit<SearchAlert, 'id' | 'createdAt'>) => Promise<SearchAlert>;
  updateSearchAlert: (id: string, updates: Partial<SearchAlert>) => Promise<void>;
  deleteSearchAlert: (id: string) => Promise<void>;
  checkSearchAlerts: (newProperty: Property) => Promise<void>;
  // Premium listings
  createPremiumListing: (propertyId: string, plan: 'BASIC' | 'FEATURED' | 'PREMIUM') => Promise<PremiumListing>;
  getPremiumFeatures: (propertyId: string) => string[];
  isPremium: (propertyId: string) => boolean;
  // Commission system
  createCommissionRule: (data: Omit<CommissionRule, 'id'>) => Promise<CommissionRule>;
  toggleCommissionRule: (id: string) => Promise<void>;
  calculateCommission: (propertyId: string, salePrice: number) => number;
  // Transactions
  createTransaction: (data: Omit<Transaction, 'id' | 'createdAt'>) => Promise<Transaction>;
  updateTransactionStatus: (id: string, status: Transaction['status']) => Promise<void>;
  // Documents
  addDocument: (data: Omit<Document, 'id' | 'uploadedAt'>) => Promise<Document>;
  getPropertyDocuments: (propertyId: string) => Document[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  properties: 'imo:properties',
  favorites: 'imo:favorites',
  savedSearches: 'imo:savedSearches',
  reports: 'imo:reports',
  propertyStats: 'imo:propertyStats',
  myPropertyIds: 'imo:myPropertyIds',
  language: 'imo:language',
  theme: 'imo:theme',
  visits: 'imo:visits',
  searchHistory: 'imo:searchHistory',
  recentViewed: 'imo:recentViewed',
  neighborhoodAlerts: 'imo:neighborhoodAlerts',
  neighborhoods: 'imo:neighborhoods',
  privacySettings: 'imo:privacySettings',
  users: 'imo:users',
  // New storage keys for enhanced features
  messages: 'imo:messages',
  chats: 'imo:chats',
  reviews: 'imo:reviews',
  contracts: 'imo:contracts',
  payments: 'imo:payments',
  tenantDocuments: 'imo:tenantDocuments',
  notifications: 'imo:notifications',
};

const DEFAULT_FILTERS: SearchFilters = {
  minPrice: null,
  maxPrice: null,
  minBedrooms: null,
  minBathrooms: null,
  minArea: null,
};

const getChatKey = (participants: string[], propertyId?: string) =>
  JSON.stringify([[...participants].sort(), propertyId ?? null]);

const buildChatsFromMessages = (items: Message[]): Chat[] => {
  const map = new Map<string, Chat>();
  items.forEach(message => {
    const participants = [message.senderId, message.receiverId].sort();
    const key = getChatKey(participants, message.propertyId);
    const existing = map.get(key);
    const unreadCount = existing?.unreadCount ? { ...existing.unreadCount } : {};
    if (!message.read) {
      unreadCount[message.receiverId] = (unreadCount[message.receiverId] || 0) + 1;
    }
    const lastMessage =
      !existing?.lastMessage ||
      new Date(message.timestamp).getTime() > new Date(existing.lastMessage.timestamp).getTime()
        ? message
        : existing.lastMessage;
    const updatedAt =
      !existing?.updatedAt ||
      new Date(message.timestamp).getTime() > new Date(existing.updatedAt).getTime()
        ? message.timestamp
        : existing.updatedAt;
    map.set(key, {
      id: existing?.id ?? key,
      participants,
      propertyId: message.propertyId,
      lastMessage,
      updatedAt,
      unreadCount,
    });
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
};
const storage = {
  async getItem(key: string) {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      logger.warn(`Unable to read persisted app data for "${key}".`, error);
      throw error;
    }
  },
  async setItem(key: string, value: string) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      logger.error(`Unable to persist app data for "${key}".`, error);
    }
  },
  async multiGet(keys: string[]) {
    return Promise.all(keys.map(async key => [key, await storage.getItem(key)] as const));
  },
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [recentViewedIds, setRecentViewedIds] = useState<string[]>([]);
  const [neighborhoodAlerts, setNeighborhoodAlerts] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [propertyStats, setPropertyStats] = useState<Record<string, PropertyStats>>({});
  const [myPropertyIds, setMyPropertyIds] = useState<string[]>([]);
  const [visitorCount, setVisitorCount] = useState(0);
  const [privacySettings, setPrivacySettings] = useState<{ hideContact: boolean; hideListings: boolean }>({
    hideContact: false,
    hideListings: false,
  });
  const [language, setLanguage] = useState<Language>('fr');
  useEffect(() => {
    setCurrentLanguage(language);
  }, [language]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const unsupportedPropertyColumnsRef = useRef<Set<string>>(new Set());
  // New state variables for enhanced features
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const businessDataRequestRef = useRef(0);
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>([]);
  const [searchAlerts, setSearchAlerts] = useState<SearchAlert[]>([]);
  const [premiumListings, setPremiumListings] = useState<PremiumListing[]>([]);
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenantDocuments, setTenantDocuments] = useState<TenantDocument[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filters, setFiltersState] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [filterType, setFilterType] = useState<PropertyType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const visitRecorded = useRef(false);
  const listingStatusRef = useRef<Record<string, ListingStatus | undefined>>({});
  const remoteNotificationIdsRef = useRef<Set<string>>(new Set());
  const suspendedAccountNotice = useRef<string | null>(null);

  useEffect(() => {
    const loadPersisted = async () => {
      try {
        const entries = await storage.multiGet(Object.values(STORAGE_KEYS));
        const map = new Map(entries);
        const parse = <T,>(key: string, fallback: T): T => {
          const raw = map.get(key);
          if (!raw) return fallback;
          try {
            return JSON.parse(raw) as T;
          } catch (error) {
            logger.warn(`Unable to parse persisted app data for "${key}".`, error);
            return fallback;
          }
        };

        setFavorites(parse<string[]>(STORAGE_KEYS.favorites, []));
        setSavedSearches(parse<SavedSearch[]>(STORAGE_KEYS.savedSearches, []));
        setSearchHistory(parse<string[]>(STORAGE_KEYS.searchHistory, []));
        setRecentViewedIds(parse<string[]>(STORAGE_KEYS.recentViewed, []));
        setNeighborhoodAlerts(parse<string[]>(STORAGE_KEYS.neighborhoodAlerts, []));
        setNeighborhoods(parse<string[]>(STORAGE_KEYS.neighborhoods, []));
        setUsers(parse<User[]>(STORAGE_KEYS.users, []));
        setNotifications(parse<AppNotification[]>(STORAGE_KEYS.notifications, []));
        setReports(parse<Report[]>(STORAGE_KEYS.reports, []));
        const rawStats = parse<Record<string, PropertyStats>>(STORAGE_KEYS.propertyStats, {});
        const normalizedStats: Record<string, PropertyStats> = Object.fromEntries(
          Object.entries(rawStats).map(([id, stats]) => [
            id,
            {
              views: stats.views ?? 0,
              contacts: stats.contacts ?? 0,
              shares: stats.shares ?? 0,
              likes: stats.likes ?? 0,
            },
          ])
        );
        setPropertyStats(normalizedStats);
        const cachedProperties = parse<Property[]>(STORAGE_KEYS.properties, []);
        if (cachedProperties.length > 0) {
          setProperties(cachedProperties);
          if (neighborhoods.length === 0) {
            setNeighborhoods(
              normalizeNeighborhoods(cachedProperties.map(p => p.neighborhood ?? p.location))
            );
          }
        }
        setMyPropertyIds(parse<string[]>(STORAGE_KEYS.myPropertyIds, []));
        setVisitorCount(parse<number>(STORAGE_KEYS.visits, 0));
        setPrivacySettings(parse<{ hideContact: boolean; hideListings: boolean }>(
          STORAGE_KEYS.privacySettings,
          { hideContact: false, hideListings: false }
        ));
        setLanguage(parse<Language>(STORAGE_KEYS.language, 'fr'));
        setTheme(parse<'light' | 'dark'>(STORAGE_KEYS.theme, 'light'));
        // Load new enhanced features data
        setMessages(parse<Message[]>(STORAGE_KEYS.messages, []));
        setChats(parse<Chat[]>(STORAGE_KEYS.chats, []));
        setReviews(parse<Review[]>(STORAGE_KEYS.reviews, []));
        setContracts(parse<Contract[]>(STORAGE_KEYS.contracts, []));
        setPayments(parse<Payment[]>(STORAGE_KEYS.payments, []));
        setTenantDocuments(parse<TenantDocument[]>(STORAGE_KEYS.tenantDocuments, []));
        void AsyncStorage.multiRemove([
          'imo:agentProfiles',
          'imo:searchAlerts',
          'imo:premiumListings',
          'imo:commissionRules',
          'imo:transactions',
          'imo:documents',
        ]).catch(error => logger.warn('Unable to remove obsolete local business data.', error));
      } catch (error) {
        logger.error('Unable to load persisted app data.', error);
      } finally {
        setHydrated(true);
      }
    };

    loadPersisted();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favorites));
  }, [favorites, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.savedSearches, JSON.stringify(savedSearches));
  }, [savedSearches, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.reports, JSON.stringify(reports));
  }, [reports, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.searchHistory, JSON.stringify(searchHistory));
  }, [searchHistory, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.recentViewed, JSON.stringify(recentViewedIds));
  }, [recentViewedIds, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.neighborhoodAlerts, JSON.stringify(neighborhoodAlerts));
  }, [neighborhoodAlerts, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.neighborhoods, JSON.stringify(neighborhoods));
  }, [neighborhoods, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  }, [users, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.propertyStats, JSON.stringify(propertyStats));
  }, [propertyStats, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.properties, JSON.stringify(properties));
  }, [properties, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.myPropertyIds, JSON.stringify(myPropertyIds));
  }, [myPropertyIds, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.visits, JSON.stringify(visitorCount));
  }, [visitorCount, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.privacySettings, JSON.stringify(privacySettings));
  }, [privacySettings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.language, JSON.stringify(language));
  }, [language, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.theme, JSON.stringify(theme));
  }, [theme, hydrated]);

  // Persistence for new enhanced features
  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
  }, [messages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.chats, JSON.stringify(chats));
  }, [chats, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.reviews, JSON.stringify(reviews));
  }, [reviews, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.contracts, JSON.stringify(contracts));
  }, [contracts, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.payments, JSON.stringify(payments));
  }, [payments, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.tenantDocuments, JSON.stringify(tenantDocuments));
  }, [tenantDocuments, hydrated]);

  useEffect(() => {
    if (!hydrated || visitRecorded.current) return;
    visitRecorded.current = true;
    setVisitorCount(prev => prev + 1);
  }, [hydrated]);

  // The database role is the source of truth. Never grant admin access from an email hard-coded in the APK.
  const mapAuthUser = useCallback((
    user: SupabaseAuthUser,
    role: User['role'] = 'USER',
    agentStatus: User['agentStatus'] = 'none',
    agentRejectionReason?: string | null,
    profile?: {
      full_name?: string | null;
      phone?: string | null;
      account_status?: 'active' | 'suspended' | 'pending' | null;
    }
  ): User => {
    const email = String(user.email || '').trim();
    const metadata = user.user_metadata ?? {};
    const name = [
      metadata.name,
      metadata.full_name,
      metadata.display_name,
      metadata.username,
      metadata.user_name,
    ].find(value => typeof value === 'string' && value.trim())?.trim()
      ?? profile?.full_name?.trim()
      ?? '';
    return ({
      id: user.id,
      name,
      email,
      phone: String(metadata.phone || profile?.phone || '').trim(),
      verified: user.email_confirmed_at ? true : false,
      isAdmin: role === 'ADMIN',
      role,
      accountStatus:
        profile?.account_status === 'suspended' || profile?.account_status === 'pending'
          ? profile.account_status
          : 'active',
      agentStatus,
      agentRejectionReason: agentRejectionReason ?? null,
    });
  }, []);

  const hydrateAuthenticatedUser = useCallback(async (authUser: SupabaseAuthUser | null) => {
    if (!authUser) {
      setCurrentUser(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, phone, role, account_status, agent_status, agent_rejection_reason')
      .eq('id', authUser.id)
      .maybeSingle();
    if (!error && data?.account_status === 'suspended') {
      setCurrentUser(null);
      if (suspendedAccountNotice.current !== authUser.id) {
        suspendedAccountNotice.current = authUser.id;
        Alert.alert(
          language === 'en' ? 'Account suspended' : 'Compte suspendu',
          language === 'en'
            ? 'An administrator has suspended this account. Contact support for assistance.'
            : 'Un administrateur a suspendu ce compte. Contactez le support pour obtenir de l’aide.'
        );
      }
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) logger.error('Unable to sign out suspended account.', signOutError.message);
      return;
    }
    suspendedAccountNotice.current = null;
    // Failing closed prevents a temporary profile/RLS error from granting admin access.
    setCurrentUser(mapAuthUser(
      authUser,
      error ? 'USER' : data?.role ?? 'USER',
      error ? 'none' : data?.agent_status ?? 'none',
      error ? null : data?.agent_rejection_reason,
      error || !data ? undefined : data
    ));
  }, [language, mapAuthUser]);

  const notifyLocal = useCallback(async (title: string, body: string) => {
    const notification: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      body,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [notification, ...prev].slice(0, 50));
    await safeScheduleLocalNotification(title, body);
  }, []);

  const loadNotificationsFromSupabase = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('id,title,body,read,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Notifications are optional for older installations. Keep the local
    // inbox intact when the table or its user-scoped policies are unavailable.
    if (error || !data) {
      if (error) logger.warn('Notifications fetch error:', error.message);
      return;
    }

    const remoteNotifications: AppNotification[] = data.map(row => ({
      id: row.id,
      title: row.title,
      body: row.body,
      createdAt: row.created_at ?? new Date().toISOString(),
      read: Boolean(row.read),
    }));
    remoteNotificationIdsRef.current = new Set(remoteNotifications.map(item => item.id));
    setNotifications(previous => [
      ...remoteNotifications,
      ...previous.filter(item => !remoteNotificationIdsRef.current.has(item.id)),
    ].slice(0, 50));
  }, []);

  useEffect(() => {
    if (hydrated) void storage.setItem(STORAGE_KEYS.notifications, JSON.stringify(notifications));
  }, [notifications, hydrated]);

  const markNotificationRead = useCallback(async (id: string) => {
    if (remoteNotificationIdsRef.current.has(id)) {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw error;
    }
    setNotifications(prev => prev.map(item => item.id === id ? { ...item, read: true } : item));
  }, []);

  const clearNotifications = useCallback(async () => {
    if (currentUser?.id) {
      const { error } = await supabase.from('notifications').delete().eq('user_id', currentUser.id);
      if (error) throw error;
    }
    setNotifications([]);
  }, [currentUser]);

  const registerPushToken = useCallback(async () => {
    if (!currentUser) return;
    await safeRegisterExpoPushToken(async token => {
      const { error } = await supabase.from('user_push_tokens').upsert({
        user_id: currentUser.id,
        token,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    });
  }, [currentUser]);

    useEffect(() => {
      let mounted = true;
      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        const sessionUser = data.session?.user ?? null;
        void hydrateAuthenticatedUser(sessionUser);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      void hydrateAuthenticatedUser(sessionUser);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateAuthenticatedUser]);

  useEffect(() => {
    const completeAuthCallback = async (url: string | null) => {
      if (
        !url ||
        !(
          url === authCallbackUrl ||
          url.startsWith(`${authCallbackUrl}?`) ||
          url.startsWith(`${authCallbackUrl}#`)
        )
      ) {
        return;
      }
      try {
        const result = await exchangeAuthCallback(url);
        if (result?.error) {
          logger.error('Unable to complete the mobile auth callback.', result.error.message);
          Alert.alert(
            translate(language, 'error'),
            translate(language, 'profile_auth_callback_failed')
          );
        }
      } catch (error) {
        logger.error('Unable to complete the mobile auth callback.', error);
        Alert.alert(
          translate(language, 'error'),
          translate(language, 'profile_auth_callback_failed')
        );
      }
    };

    void Linking.getInitialURL()
      .then(completeAuthCallback)
      .catch(error => logger.error('Unable to read the initial auth callback URL.', error));
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void completeAuthCallback(url);
    });
    return () => subscription.remove();
  }, [language]);

  useEffect(() => {
    if (!currentUser) return;
    void registerPushToken().catch(error => {
      logger.warn('Push token registration failed:', error);
    });
  }, [currentUser, registerPushToken]);

    const resolveAuthUserId = useCallback(async () => {
      if (currentUser?.id) return currentUser.id;
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        throw new Error('User not logged in');
      }
      void hydrateAuthenticatedUser(data.user);
      return data.user.id;
    }, [currentUser, hydrateAuthenticatedUser]);

  const reloadProperties = useCallback(async () => {
    const pageSize = 100;
    let rows: PropertyRow[] = [];
    let cursor: { createdAt: string; id: string } | null = null;
    while (true) {
      let query = supabase
        .from('properties')
        .select('*, property_images(url)')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      if (cursor) {
        query = query.or(
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
        );
      }
      const { data, error } = await query.limit(pageSize);
      if (error) throw error;
      const page: PropertyRow[] = data ?? [];
      rows = rows.concat(page);
      if (page.length < pageSize) break;
      const lastRow = page[page.length - 1];
      if (!lastRow.created_at) {
        throw new Error(`Property ${lastRow.id} is missing its created_at pagination cursor.`);
      }
      cursor = { createdAt: lastRow.created_at, id: lastRow.id };
    }

    const mapped = dedupeProperties(rows.map(mapPropertyRow));
    const previous = listingStatusRef.current || {};
    if (currentUser?.id) {
      mapped.forEach(item => {
        const prevStatus = previous[item.id];
        if (prevStatus && prevStatus !== item.listingStatus && item.ownerId === currentUser.id) {
          const statusLabel =
            item.listingStatus === 'approved'
              ? 'approuvée'
              : item.listingStatus === 'rejected'
              ? 'refusée'
              : item.listingStatus === 'archived'
              ? 'archivée'
              : 'en attente';
          notifyLocal('Annonce mise à jour', `Votre annonce "${item.title}" est ${statusLabel}.`);
        }
      });
    }
    setProperties(mapped);
    listingStatusRef.current = mapped.reduce<Record<string, ListingStatus | undefined>>(
      (acc, item) => {
        acc[item.id] = item.listingStatus;
        return acc;
      },
      listingStatusRef.current ?? {}
    );
    setNeighborhoods(prev => {
      const next = normalizeNeighborhoods(mapped.map(property => property.neighborhood ?? property.location));
      const merged = new Map<string, string>();
      [...prev, ...next].forEach(name => {
        const key = name.toLowerCase();
        if (!merged.has(key)) merged.set(key, name);
      });
      return Array.from(merged.values());
    });
  }, [currentUser, notifyLocal]);

  const loadFavoritesFromSupabase = useCallback(async () => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('favorites')
      .select('property_id')
      .eq('user_id', currentUser.id);
    if (error) throw error;
    if (data) {
      setFavorites(data.map(row => row.property_id));
    }
  }, [currentUser]);

  const loadMessagesFromSupabase = useCallback(async () => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (data) {
      const mapped = data.map(mapMessageRow);
      setMessages(mapped);
      setChats(buildChatsFromMessages(mapped));
    }
  }, [currentUser]);

  const loadReviewsFromSupabase = useCallback(async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setReviews((data ?? []).map(mapReviewRow));
  }, []);

  const loadReportsFromSupabase = useCallback(async () => {
    if (!currentUser) {
      setReports([]);
      return;
    }
    const { data, error } = await supabase
      .from('property_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setReports((data ?? []).map(mapReportRow));
  }, [currentUser]);

  const loadBusinessFeaturesFromSupabase = useCallback(async () => {
    const requestId = ++businessDataRequestRef.current;
    if (!currentUser) {
      setAgentProfiles([]);
      setSearchAlerts([]);
      setPremiumListings([]);
      setCommissionRules([]);
      setTransactions([]);
      setDocuments([]);
      return;
    }
    setAgentProfiles([]);
    setSearchAlerts([]);
    setPremiumListings([]);
    setCommissionRules([]);
    setTransactions([]);
    setDocuments([]);

    const [
      agentProfilesResult,
      searchAlertsResult,
      premiumListingsResult,
      commissionRulesResult,
      transactionsResult,
      documentsResult,
    ] = await Promise.all([
      supabase.from('agent_profiles').select('*'),
      supabase.from('search_alerts').select('*').order('created_at', { ascending: false }),
      supabase.from('premium_listings').select('*'),
      supabase.from('commission_rules').select('*').order('created_at', { ascending: false }),
      supabase.from('property_transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('property_documents').select('*').order('uploaded_at', { ascending: false }),
    ]);
    if (requestId !== businessDataRequestRef.current) return;

    const queryError = [
      agentProfilesResult.error,
      searchAlertsResult.error,
      premiumListingsResult.error,
      commissionRulesResult.error,
      transactionsResult.error,
      documentsResult.error,
    ].find(Boolean);
    if (queryError) throw queryError;

    setAgentProfiles((agentProfilesResult.data ?? []).map((row: AgentProfileRow) => mapAgentProfileRow(row)));
    setSearchAlerts((searchAlertsResult.data ?? []).map((row: SearchAlertRow) => mapSearchAlertRow(row)));
    setPremiumListings((premiumListingsResult.data ?? []).map((row: PremiumListingRow) => mapPremiumListingRow(row)));
    setCommissionRules((commissionRulesResult.data ?? []).map((row: CommissionRuleRow) => mapCommissionRuleRow(row)));
    setTransactions((transactionsResult.data ?? []).map((row: TransactionRow) => mapTransactionRow(row)));
    setDocuments((documentsResult.data ?? []).map((row: PropertyDocumentRow) => mapPropertyDocumentRow(row)));
  }, [currentUser]);

    const fetchData = useCallback(async () => {
      if (!hydrated) return;
      setSyncError(null);
      try {
        // The home screen depends only on neighbourhoods and listings. Optional
        // modules may not exist yet on an older Supabase project, so they must
        // not make the whole catalogue appear unavailable.
        const coreTasks: Promise<void>[] = [
          (async () => {
            const { data, error } = await supabase
              .from('neighborhoods')
              .select('name')
              .order('name', { ascending: true });
            if (error) throw error;
            const names = normalizeNeighborhoods((data ?? []).map(row => row.name));
            if (names.length > 0) {
              setNeighborhoods(previous => {
                const merged = new Map(previous.map(name => [name.toLowerCase(), name]));
                names.forEach(name => merged.set(name.toLowerCase(), name));
                return Array.from(merged.values());
              });
            }
          })(),
          reloadProperties(),
        ];
        const optionalTasks: Promise<void>[] = [
          loadReviewsFromSupabase(),
          loadReportsFromSupabase(),
          loadBusinessFeaturesFromSupabase(),
        ];

        if (currentUser) {
          optionalTasks.push(
            loadFavoritesFromSupabase(),
            loadMessagesFromSupabase(),
            loadNotificationsFromSupabase(currentUser.id)
          );
        }

        if (currentUser?.role === 'ADMIN') {
          optionalTasks.push(
            (async () => {
              const { data, error } = await supabase.from('tenants').select('*');
              if (error) throw error;
              setClients((data ?? []).map(tenant => ({
                id: tenant.id,
                name: tenant.full_name ?? '',
                email: tenant.email ?? '',
                phone: tenant.phone ?? '',
                createdAt: tenant.created_at ?? new Date().toISOString(),
              })));
            })(),
            (async () => {
              const { data, error } = await supabase
                .from('contracts')
                .select('*')
                .order('created_at', { ascending: false });
              if (error) throw error;
              setContracts((data ?? []).map(contract => ({
                id: contract.id,
                propertyId: contract.property_id,
                tenantId: contract.tenant_id,
                startDate: contract.start_date,
                endDate: contract.end_date,
                rentAmount: Number(contract.rent_amount ?? 0),
                status: contract.status,
                createdAt: contract.created_at ?? new Date().toISOString(),
              })));
            })(),
            (async () => {
              const { data, error } = await supabase
                .from('payments')
                .select('*')
                .order('created_at', { ascending: false });
              if (error) throw error;
              setPayments((data ?? []).map(payment => ({
                id: payment.id,
                contractId: payment.contract_id,
                amount: Number(payment.amount ?? 0),
                paidAt: payment.paid_at,
                method: payment.method,
                status: payment.status,
                createdAt: payment.created_at ?? new Date().toISOString(),
              })));
            })(),
            (async () => {
              const { data, error } = await supabase
                .from('tenant_documents')
                .select('*')
                .order('created_at', { ascending: false });
              if (error) throw error;
              setTenantDocuments((data ?? []).map(document => ({
                id: document.id,
                tenantId: document.tenant_id,
                type: document.type,
                url: document.url,
                createdAt: document.created_at ?? new Date().toISOString(),
              })));
            })()
          );
        } else {
          setClients([]);
          setContracts([]);
          setPayments([]);
          setTenantDocuments([]);
        }

        await Promise.all(coreTasks);
        const optionalResults = await Promise.allSettled(optionalTasks);
        optionalResults.forEach(result => {
          if (result.status === 'rejected') {
            logger.warn('Optional Supabase module could not be loaded.', result.reason);
          }
        });
      } catch (error) {
        logger.error('Failed to fetch from Supabase', error);
        setSyncError('Une erreur est survenue. Veuillez réessayer.');
      }
    }, [
      hydrated,
      reloadProperties,
      loadReviewsFromSupabase,
      loadReportsFromSupabase,
      loadBusinessFeaturesFromSupabase,
      currentUser,
      loadFavoritesFromSupabase,
      loadMessagesFromSupabase,
      loadNotificationsFromSupabase,
    ]);

    const retrySync = useCallback(() => {
      fetchData();
    }, [fetchData]);

    // Fetch data from Supabase
    useEffect(() => {
      if (!hydrated) return;
      fetchData();
    }, [fetchData, hydrated]);

    // Realtime sync for properties + images
    useEffect(() => {
      if (!hydrated) return;
      const debounceRef = { current: null as ReturnType<typeof setTimeout> | null };
      const scheduleReload = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          reloadProperties();
        }, 400);
      };
      const channel = supabase
        .channel('properties-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, scheduleReload)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'property_images' }, scheduleReload)
        .subscribe();
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        supabase.removeChannel(channel);
      };
    }, [hydrated, reloadProperties]);

    // Realtime sync for messages
    useEffect(() => {
      if (!hydrated || !currentUser) return;
      const channel = supabase
        .channel('messages-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
          const next = payload.new as { sender_id?: string; receiver_id?: string; content?: string } | null;
          if (!next) return;
          if (next.sender_id === currentUser.id || next.receiver_id === currentUser.id) {
            loadMessagesFromSupabase();
            if (next.receiver_id === currentUser.id && next.content) {
              notifyLocal('Nouveau message', next.content);
            }
          }
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }, [hydrated, currentUser, loadMessagesFromSupabase, notifyLocal]);

    // Keep the signed-in user's server notifications current without
    // exposing notifications addressed to another account.
    useEffect(() => {
      if (!hydrated || !currentUser) return;
      const channel = supabase
        .channel(`notifications-realtime-${currentUser.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` },
          payload => {
            if (payload.eventType === 'DELETE') {
              const deletedId = (payload.old as { id?: string } | null)?.id;
              if (deletedId) {
                remoteNotificationIdsRef.current.delete(deletedId);
                setNotifications(previous => previous.filter(item => item.id !== deletedId));
              }
              return;
            }

            const row = payload.new as {
              id?: string;
              title?: string;
              body?: string;
              read?: boolean;
              created_at?: string;
              user_id?: string;
            } | null;
            if (!row?.id || row.user_id !== currentUser.id || !row.title || !row.body) return;
            const notification: AppNotification = {
              id: row.id,
              title: row.title,
              body: row.body,
              createdAt: row.created_at ?? new Date().toISOString(),
              read: Boolean(row.read),
            };
            remoteNotificationIdsRef.current.add(notification.id);
            setNotifications(previous => [
              notification,
              ...previous.filter(item => item.id !== notification.id),
            ].slice(0, 50));
          }
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }, [hydrated, currentUser]);

    // Notify the current account when an administrator changes its role or
    // agent approval status.
    useEffect(() => {
      if (!hydrated || !currentUser) return;
      const channel = supabase
        .channel(`profile-status-${currentUser.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${currentUser.id}` },
          payload => {
            const next = payload.new as {
              role?: User['role'];
              account_status?: User['accountStatus'];
              agent_status?: User['agentStatus'];
              agent_rejection_reason?: string | null;
            } | null;
            const previous = payload.old as { role?: User['role']; agent_status?: User['agentStatus'] } | null;
            if (!next) return;

            if (next.account_status === 'suspended') {
              setCurrentUser(null);
              if (suspendedAccountNotice.current !== currentUser.id) {
                suspendedAccountNotice.current = currentUser.id;
                Alert.alert(
                  language === 'en' ? 'Account suspended' : 'Compte suspendu',
                  language === 'en'
                    ? 'An administrator has suspended this account. Contact support for assistance.'
                    : 'Un administrateur a suspendu ce compte. Contactez le support pour obtenir de l’aide.'
                );
              }
              void supabase.auth.signOut().then(({ error }) => {
                if (error) logger.error('Unable to sign out suspended account.', error.message);
              });
              return;
            }

            setCurrentUser(prev => prev ? {
              ...prev,
              role: next.role ?? prev.role,
              isAdmin: (next.role ?? prev.role) === 'ADMIN',
              accountStatus: next.account_status ?? prev.accountStatus,
              agentStatus: next.agent_status ?? prev.agentStatus,
              agentRejectionReason: next.agent_rejection_reason ?? prev.agentRejectionReason,
            } : prev);

            if (next.agent_status === 'approved' && previous?.agent_status !== 'approved') {
              void notifyLocal('Demande agent approuvée', 'Votre compte agent est maintenant actif.');
            } else if (next.agent_status === 'rejected' && previous?.agent_status !== 'rejected') {
              void notifyLocal('Demande agent refusée', 'Votre demande agent a été refusée.');
            }
          }
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }, [hydrated, currentUser, language, notifyLocal]);

  const setFilters = (updates: Partial<SearchFilters>) => {
    setFiltersState(prev => ({ ...prev, ...updates }));
  };

  const resetFilters = () => {
    setFiltersState(DEFAULT_FILTERS);
  };

  const omitUnsupportedPropertyColumns = useCallback((payload: Record<string, any>) => {
    const next = { ...payload };
    unsupportedPropertyColumnsRef.current.forEach(column => {
      delete next[column];
    });
    return next;
  }, []);

  const toDbPropertyPayload = (
    propertyData: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>,
    ownerId?: string
  ) => {
    const submittedAt = new Date().toISOString();
    const listingStatus =
      propertyData.listingStatus ??
      (isDirectPublishingEnabled(currentUser) ? 'approved' : 'pending');
    const contactName = propertyData.client?.name?.trim() || currentUser?.name?.trim() || null;
    const contactPhone = propertyData.client?.phone?.trim() || currentUser?.phone?.trim() || null;
    const contactEmail = propertyData.client?.email?.trim() || currentUser?.email?.trim() || null;

    return omitUnsupportedPropertyColumns({
      title: propertyData.title,
      type: propertyData.type,
      price: propertyData.price,
      location: propertyData.location,
      neighborhood: propertyData.neighborhood ?? null,
      description: propertyData.description ?? null,
      status: propertyData.status,
      listing_status: listingStatus,
      submitted_at: submittedAt,
      approved_at: listingStatus === 'approved' ? submittedAt : null,
      published_at: listingStatus === 'approved' ? submittedAt : null,
      owner_id: ownerId ?? currentUser?.id ?? null,
      featured: propertyData.featured ?? false,
      area: propertyData.area ?? null,
      bedrooms: propertyData.bedrooms ?? null,
      bathrooms: propertyData.bathrooms ?? null,
      amenities: propertyData.amenities ?? [],
      client_id: propertyData.clientId || ownerId || currentUser?.id || null,
      contact_name: contactName,
      contact_phone: contactPhone,
      contact_email: contactEmail,
    });
  };

  const toDbPropertyUpdates = (updates: Partial<Omit<Property, 'id' | 'createdAt'>>) => {
    const payload: Record<string, any> = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.price !== undefined) payload.price = updates.price;
    if (updates.location !== undefined) payload.location = updates.location;
    if (updates.neighborhood !== undefined) payload.neighborhood = updates.neighborhood ?? null;
    if (updates.description !== undefined) payload.description = updates.description ?? null;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.listingStatus !== undefined) payload.listing_status = updates.listingStatus ?? null;
    if (updates.listingStatus !== undefined) {
      const isApproved = updates.listingStatus === 'approved';
      const now = isApproved ? new Date().toISOString() : null;
      payload.approved_at = now;
      payload.published_at = now;
    }
    if (updates.rejectionReason !== undefined) payload.rejection_reason = updates.rejectionReason ?? null;
    if (updates.area !== undefined) payload.area = updates.area ?? null;
    if (updates.bedrooms !== undefined) payload.bedrooms = updates.bedrooms ?? null;
    if (updates.bathrooms !== undefined) payload.bathrooms = updates.bathrooms ?? null;
    if (updates.amenities !== undefined) payload.amenities = updates.amenities ?? [];
    if (updates.featured !== undefined) payload.featured = updates.featured;
    if (updates.expiresAt !== undefined) payload.expires_at = updates.expiresAt ?? null;
    if (updates.clientId !== undefined) payload.client_id = updates.clientId || null;
    if (updates.contactName !== undefined) payload.contact_name = updates.contactName ?? null;
    if (updates.contactPhone !== undefined) payload.contact_phone = updates.contactPhone ?? null;
    if (updates.contactEmail !== undefined) payload.contact_email = updates.contactEmail ?? null;
    return omitUnsupportedPropertyColumns(payload);
  };

  const uploadPropertyImages = useCallback(
    async (propertyId: string, uris: string[], ownerId?: string): Promise<string[]> => {
      if (uris.length > PROPERTY_IMAGE_MAX_COUNT) {
        throw new Error(`Maximum ${PROPERTY_IMAGE_MAX_COUNT} photos par bien.`);
      }
      const localImageCount = uris.filter(uri => !uri.startsWith('http')).length;
      const maxImageBytes = Math.min(
        PROPERTY_IMAGE_MAX_BYTES,
        Math.floor(PROPERTY_IMAGE_MAX_TOTAL_BYTES / Math.max(localImageCount, 1))
      );
      const resolvedOwnerId = ownerId ?? (await resolveAuthUserId());
      if (!resolvedOwnerId) {
        throw new Error('User not logged in');
      }

      const ensureFileUri = async (rawUri: string) => {
        if (rawUri.startsWith('file://')) return rawUri;
        if (rawUri.startsWith('content://')) {
          const extMatch = rawUri.split('.').pop();
          const ext = extMatch && extMatch.length <= 5 ? extMatch.toLowerCase() : 'jpg';
          const target = `${FileSystem.cacheDirectory}upload-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.${ext}`;
          await FileSystem.copyAsync({ from: rawUri, to: target });
          return target;
        }
        return rawUri;
      };

      const uploaded: string[] = [];
      const uploadedStoragePaths: string[] = [];
      const insertedImageUrls: string[] = [];
      const failures: string[] = [];
      for (const rawUri of uris) {
        if (!rawUri) continue;
        if (rawUri.startsWith('http')) {
          const { error: insertError } = await supabase
            .from('property_images')
            .insert({ property_id: propertyId, url: rawUri });
          if (insertError) {
            logger.warn('Insert existing property image failed', {
              error: insertError.message,
              propertyId,
              url: rawUri,
            });
            failures.push(insertError.message);
          } else {
            uploaded.push(rawUri);
            insertedImageUrls.push(rawUri);
          }
          continue;
        }
        let sourceUriToDelete: string | null = null;
        try {
          const uri = await ensureFileUri(rawUri);
          if (rawUri.startsWith('content://')) sourceUriToDelete = uri;
          const info = await FileSystem.getInfoAsync(uri);
          if (!info.exists) {
            failures.push('Une photo sélectionnée est introuvable sur le téléphone.');
            continue;
          }
          const dimensions = await new Promise<{ width: number; height: number } | null>(resolve => {
            Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve(null));
          });
          const compressionAttempts = [
            { maxDimension: 1600, compress: 0.72 },
            { maxDimension: 1400, compress: 0.64 },
            { maxDimension: 1200, compress: 0.56 },
            { maxDimension: 1100, compress: 0.5 },
            { maxDimension: 1000, compress: 0.44 },
            { maxDimension: 900, compress: 0.38 },
            { maxDimension: 800, compress: 0.33 },
            { maxDimension: 720, compress: 0.29 },
          ];
          let uploadUri: string | null = null;
          for (const attempt of compressionAttempts) {
            const resizeAction = dimensions && Math.max(dimensions.width, dimensions.height) > attempt.maxDimension
              ? [{
                  resize: dimensions.width >= dimensions.height
                    ? { width: attempt.maxDimension }
                    : { height: attempt.maxDimension },
                }]
              : [];
            const optimized = await ImageManipulator.manipulateAsync(uri, resizeAction, {
              compress: attempt.compress,
              format: ImageManipulator.SaveFormat.JPEG,
            });
            const optimizedInfo = await FileSystem.getInfoAsync(optimized.uri);
            if ('size' in optimizedInfo && typeof optimizedInfo.size === 'number' && optimizedInfo.size <= maxImageBytes) {
              uploadUri = optimized.uri;
              break;
            }
            await FileSystem.deleteAsync(optimized.uri, { idempotent: true });
          }
          if (!uploadUri) {
            throw new Error(
              'Impossible de réduire cette photo sous 200 Ko. Choisissez une autre photo.'
            );
          }

          const contentType = 'image/jpeg';
          let uploadOk = false;
          let lastUploadFailure = '';
          let successfulPath = '';
          const attemptedPaths: string[] = [];
          for (let attempt = 1; attempt <= 2; attempt += 1) {
            const path = `${resolvedOwnerId}/${propertyId}/${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}.jpg`;
            let signed: { signedUrl: string; token: string; path: string } | null = null;
            let signedError: { message: string } | null = null;
            try {
              const result = await supabase
                .storage
                .from('property-images')
                .createSignedUploadUrl(path);
              signed = result.data;
              signedError = result.error;
            } catch (error) {
              lastUploadFailure = error instanceof Error
                ? error.message
                : 'Impossible de préparer l’envoi d’une photo.';
              logger.warn('Signed upload URL exception', { error, path, propertyId });
              break;
            }
            if (signedError || !signed?.signedUrl) {
              lastUploadFailure = signedError?.message ?? 'Impossible de préparer l’envoi d’une photo.';
              logger.warn('Signed upload URL error', {
                error: signedError?.message ?? signedError,
                path,
                propertyId,
              });
              break;
            }
            attemptedPaths.push(path);
            try {
              const uploadResult = await FileSystem.uploadAsync(signed.signedUrl, uploadUri, {
                httpMethod: 'PUT',
                uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': '3600',
                },
              });
              uploadOk = uploadResult.status >= 200 && uploadResult.status < 300;
              if (uploadOk) {
                successfulPath = path;
                break;
              }
              if (!uploadOk) {
                const responseBody = uploadResult.body?.trim();
                lastUploadFailure = [
                  `Échec de l’envoi de la photo (HTTP ${uploadResult.status}).`,
                  responseBody ? responseBody.slice(0, 300) : '',
                ].filter(Boolean).join(' ');
                logger.warn('Signed upload failed', {
                  attempt,
                  status: uploadResult.status,
                  body: uploadResult.body,
                  path,
                  propertyId,
                });
                const retryableStatus =
                  uploadResult.status === 408 ||
                  uploadResult.status === 429 ||
                  uploadResult.status >= 500;
                if (!retryableStatus) break;
              }
            } catch (uploadError) {
              lastUploadFailure = uploadError instanceof Error
                ? uploadError.message
                : 'La connexion a interrompu l’envoi de la photo.';
              logger.warn('Signed upload exception', {
                attempt,
                error: uploadError,
                path,
                propertyId,
              });
            }
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 800 * attempt));
          }

          uploadedStoragePaths.push(...(uploadOk ? [successfulPath] : attemptedPaths));
          try {
            await FileSystem.deleteAsync(uploadUri, { idempotent: true });
          } catch (cleanupError) {
            logger.warn('Unable to remove the optimized temporary image.', cleanupError);
          }
          if (!uploadOk) {
            failures.push(lastUploadFailure || 'L’envoi d’une photo a échoué. Vérifiez votre connexion et réessayez.');
            continue;
          }

          const failedAttemptPaths = attemptedPaths.filter(path => path !== successfulPath);
          if (failedAttemptPaths.length) {
            const { error: cleanupError } = await supabase.storage
              .from('property-images')
              .remove(failedAttemptPaths);
            if (cleanupError) {
              logger.warn('Unable to clean up retried property image uploads.', cleanupError);
            }
          }
          const { data } = supabase.storage.from('property-images').getPublicUrl(successfulPath);
          if (data?.publicUrl) {
            const { error: insertError } = await supabase
              .from('property_images')
              .insert({ property_id: propertyId, url: data.publicUrl });
            if (insertError) {
              logger.warn('Insert property_image failed', {
                error: insertError.message ?? insertError,
                propertyId,
                url: data.publicUrl,
              });
              failures.push(insertError.message);
              continue;
            }
            uploaded.push(data.publicUrl);
            insertedImageUrls.push(data.publicUrl);
          } else {
            failures.push('Impossible de récupérer l’adresse d’une photo envoyée.');
          }
        } catch (err) {
          logger.warn('Upload image exception', {
            error: err,
            propertyId,
          });
          failures.push(err instanceof Error ? err.message : 'Une photo n’a pas pu être envoyée.');
        } finally {
          if (sourceUriToDelete) {
            try {
              await FileSystem.deleteAsync(sourceUriToDelete, { idempotent: true });
            } catch (cleanupError) {
              logger.warn('Unable to remove the temporary source image.', cleanupError);
            }
          }
        }
      }
      if (failures.length) {
        if (insertedImageUrls.length) {
          const { error: cleanupError } = await supabase
            .from('property_images')
            .delete()
            .eq('property_id', propertyId)
            .in('url', insertedImageUrls);
          if (cleanupError) {
            logger.warn('Unable to clean up partially saved property images.', cleanupError);
          }
        }
        if (uploadedStoragePaths.length) {
          const { error: cleanupError } = await supabase
            .storage
            .from('property-images')
            .remove(uploadedStoragePaths);
          if (cleanupError) {
            logger.warn('Unable to clean up partially uploaded property images.', cleanupError);
          }
        }
        throw new Error([...new Set(failures)].join('\n'));
      }
      return uploaded;
    },
    [resolveAuthUserId]
  );

      const addProperty = useCallback(async (propertyData: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>): Promise<Property> => {
        const ownerId = await resolveAuthUserId();
        let payload = toDbPropertyPayload(propertyData, ownerId);
        let data: any = null;
        let error: any = null;

        while (true) {
          const result = await supabase
            .from('properties')
            .insert(payload)
            .select('*, property_images(url)')
            .single();
          data = result.data;
          error = result.error;
          if (!error) break;

          const missingColumn = extractMissingPropertiesColumn(error.message);
          if (!missingColumn || !(missingColumn in payload)) {
            throw error;
          }

          unsupportedPropertyColumnsRef.current.add(missingColumn);
          payload = omitUnsupportedPropertyColumns(payload);
        }

    const base = mapPropertyRow(data);
      let uploadedImages: string[] = [];
      try {
        uploadedImages = propertyData.images?.length
          ? await uploadPropertyImages(base.id, propertyData.images, ownerId)
          : [];
      } catch (uploadError) {
        const { error: cleanupError } = await supabase.from('properties').delete().eq('id', base.id);
        if (cleanupError) {
          logger.warn('Unable to remove property after image upload failed.', cleanupError);
        }
        throw uploadError;
      }
      if (propertyData.images?.length && uploadedImages.length === 0) {
        const { error: cleanupError } = await supabase.from('properties').delete().eq('id', base.id);
        if (cleanupError) {
          logger.warn('Unable to remove property without uploaded images.', cleanupError);
        }
        throw new Error("Aucune image n'a pu être envoyée. Réessayez.");
      }
    const next: Property = {
      ...base,
      images: uploadedImages.length ? uploadedImages : base.images,
      area: propertyData.area ?? base.area,
      bedrooms: propertyData.bedrooms ?? base.bedrooms,
      bathrooms: propertyData.bathrooms ?? base.bathrooms,
      amenities: propertyData.amenities ?? [],
      featured: propertyData.featured ?? false,
      clientId: propertyData.clientId ?? '',
      client: propertyData.client,
      contactName: propertyData.client?.name ?? base.contactName ?? null,
      contactPhone: propertyData.client?.phone ?? base.contactPhone ?? null,
      contactEmail: propertyData.client?.email ?? base.contactEmail ?? null,
    };

      setProperties(prev => dedupeProperties([next, ...prev]));
    void addNeighborhood(next.neighborhood ?? next.location).catch(error => {
      logger.warn('Unable to save the property neighborhood:', error);
    });
    return next;
    }, [resolveAuthUserId, uploadPropertyImages, omitUnsupportedPropertyColumns]);

    const updateProperty = useCallback(async (id: string, updates: Partial<Omit<Property, 'id' | 'createdAt'>>) => {
    let payload = toDbPropertyUpdates(updates);
      let updatedProperty: { id: string } | null = null;
      while (true) {
        const result = await supabase
          .from('properties')
          .update(payload)
          .eq('id', id)
          .select('id')
          .maybeSingle();
        updatedProperty = result.data;
        if (!result.error) break;

        const missingColumn = extractMissingPropertiesColumn(result.error.message);
        if (!missingColumn || !(missingColumn in payload)) {
          throw result.error;
        }

      unsupportedPropertyColumnsRef.current.add(missingColumn);
      payload = omitUnsupportedPropertyColumns(payload);
    }
    if (!updatedProperty) {
      throw new Error('L’annonce n’a pas été modifiée. Vérifiez vos droits ou réessayez.');
    }
    setProperties(prev =>
      prev.map(p =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      )
    );
    if (updates.neighborhood || updates.location) {
      void addNeighborhood((updates.neighborhood ?? updates.location) as string).catch(error => {
        logger.warn('Unable to save the property neighborhood:', error);
      });
    }
  }, [omitUnsupportedPropertyColumns]);

  const completeProperty = useCallback(async (id: string, completionType: PropertyCompletionType) => {
    const { data, error } = await supabase.rpc('complete_property_transaction', {
      p_property_id: id,
      p_outcome: completionType,
    });
    if (error) throw error;
    const lifecycle = Array.isArray(data) ? data[0] : data;
    const completedAt = lifecycle?.updated_at ?? new Date().toISOString();
    setProperties(prev =>
      prev.map(property =>
        property.id === id
          ? {
              ...property,
              status: 'occupied',
              soldAt: lifecycle?.sold_at ?? (completionType === 'sold' ? completedAt : null),
              rentedAt: lifecycle?.rented_at ?? (completionType === 'rented' ? completedAt : null),
              completionType,
              updatedAt: completedAt,
            }
          : property
      )
    );
  }, []);

  const updatePropertyStatus = useCallback(async (id: string, status: PropertyStatus) => {
    const { data, error } = await supabase.rpc('set_property_occupancy', {
      p_property_id: id,
      p_status: status,
    });
    if (error) throw error;
    const lifecycle = Array.isArray(data) ? data[0] : data;
    setProperties(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
              status,
              soldAt: lifecycle?.sold_at ?? (status === 'occupied' ? p.soldAt : null),
              rentedAt: lifecycle?.rented_at ?? (status === 'occupied' ? p.rentedAt : null),
              completionType: status === 'available' ? null : p.completionType,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  }, []);

  const markPropertySold = useCallback(async (id: string) => {
    await completeProperty(id, 'sold');
  }, [completeProperty]);

  const clearSoldStatus = useCallback(async (id: string) => {
    await updatePropertyStatus(id, 'available');
  }, [updatePropertyStatus]);

  const deleteProperty = useCallback(async (id: string) => {
    const { data: imageRows, error: imageQueryError } = await supabase
      .from('property_images')
      .select('url')
      .eq('property_id', id);
    if (imageQueryError) throw imageQueryError;

    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) throw error;

    const imagePaths = getPropertyImageStoragePaths(
      (imageRows ?? []).map(image => image.url),
      supabaseUrl
    );
    for (const batch of chunkStoragePaths(imagePaths)) {
      const { error: storageError } = await supabase.storage.from('property-images').remove(batch);
      if (storageError) {
        throw new Error(`Bien supprimé, mais le nettoyage de ses images a échoué : ${storageError.message}`);
      }
    }

    setProperties(prev => {
      const next = prev.filter(p => p.id !== id);
      setNeighborhoods(current => {
        const remaining = new Set(
          normalizeNeighborhoods(next.map(p => p.neighborhood ?? p.location)).map(name => name.toLowerCase())
        );
        return current.filter(n => remaining.has(n.toLowerCase()));
      });
      return next;
    });
  }, []);

  const addClient = useCallback(async (clientData: Omit<Client, 'id' | 'createdAt'>): Promise<Client> => {
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        full_name: clientData.name,
        phone: clientData.phone,
        email: clientData.email || null,
      })
      .select()
      .single();
    if (error) throw error;
    const client: Client = {
      id: data.id,
      name: data.full_name ?? clientData.name,
      email: data.email ?? clientData.email ?? '',
      phone: data.phone ?? clientData.phone ?? '',
      createdAt: data.created_at ?? new Date().toISOString(),
    };
    setClients(prev => [client, ...prev]);
    return client;
  }, []);

  const updateClient = useCallback(async (id: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>) => {
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.full_name = updates.name;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.email !== undefined) payload.email = updates.email || null;
    const { error } = await supabase.from('tenants').update(payload).eq('id', id);
    if (error) throw error;
    setClients(prev =>
      prev.map(c =>
        c.id === id ? { ...c, ...updates } : c
      )
    );
  }, []);

  const addContract = useCallback(async (data: Omit<Contract, 'id' | 'createdAt'>): Promise<Contract> => {
    const { data: row, error } = await supabase
      .from('contracts')
      .insert({
        property_id: data.propertyId,
        tenant_id: data.tenantId,
        start_date: data.startDate,
        end_date: data.endDate,
        rent_amount: data.rentAmount,
        status: data.status,
      })
      .select()
      .single();
    if (error) throw error;
    const contract: Contract = {
      id: row.id,
      propertyId: row.property_id,
      tenantId: row.tenant_id,
      startDate: row.start_date,
      endDate: row.end_date,
      rentAmount: Number(row.rent_amount ?? 0),
      status: row.status,
      createdAt: row.created_at ?? new Date().toISOString(),
    };
    setContracts(prev => [contract, ...prev]);
    return contract;
  }, []);

  const updateContract = useCallback(async (id: string, updates: Partial<Omit<Contract, 'id' | 'createdAt'>>) => {
    const payload: Record<string, any> = {};
    if (updates.propertyId !== undefined) payload.property_id = updates.propertyId;
    if (updates.tenantId !== undefined) payload.tenant_id = updates.tenantId;
    if (updates.startDate !== undefined) payload.start_date = updates.startDate;
    if (updates.endDate !== undefined) payload.end_date = updates.endDate;
    if (updates.rentAmount !== undefined) payload.rent_amount = updates.rentAmount;
    if (updates.status !== undefined) payload.status = updates.status;
    const { error } = await supabase.from('contracts').update(payload).eq('id', id);
    if (error) throw error;
    setContracts(prev =>
      prev.map(c => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  const updateContractStatus = useCallback(async (id: string, status: Contract['status']) => {
    const { error } = await supabase.from('contracts').update({ status }).eq('id', id);
    if (error) throw error;
    setContracts(prev => prev.map(c => (c.id === id ? { ...c, status } : c)));
  }, []);

  const addPayment = useCallback(async (data: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> => {
    const { data: row, error } = await supabase
      .from('payments')
      .insert({
        contract_id: data.contractId,
        amount: data.amount,
        paid_at: data.paidAt,
        method: data.method,
        status: data.status,
      })
      .select()
      .single();
    if (error) throw error;
    const payment: Payment = {
      id: row.id,
      contractId: row.contract_id,
      amount: Number(row.amount ?? 0),
      paidAt: row.paid_at,
      method: row.method,
      status: row.status,
      createdAt: row.created_at ?? new Date().toISOString(),
    };
    setPayments(prev => [payment, ...prev]);
    return payment;
  }, []);

  const updatePayment = useCallback(async (id: string, updates: Partial<Omit<Payment, 'id' | 'createdAt'>>) => {
    const payload: Record<string, any> = {};
    if (updates.contractId !== undefined) payload.contract_id = updates.contractId;
    if (updates.amount !== undefined) payload.amount = updates.amount;
    if (updates.paidAt !== undefined) payload.paid_at = updates.paidAt;
    if (updates.method !== undefined) payload.method = updates.method;
    if (updates.status !== undefined) payload.status = updates.status;
    const { error } = await supabase.from('payments').update(payload).eq('id', id);
    if (error) throw error;
    setPayments(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const updatePaymentStatus = useCallback(async (id: string, status: Payment['status']) => {
    const { error } = await supabase.from('payments').update({ status }).eq('id', id);
    if (error) throw error;
    setPayments(prev => prev.map(p => (p.id === id ? { ...p, status } : p)));
  }, []);

  const addTenantDocumentRecord = (doc: TenantDocument) => {
    setTenantDocuments(prev => [doc, ...prev]);
  };

  const addNeighborhood = async (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return;
    const { error } = await supabase
      .from('neighborhoods')
      .upsert({ name: cleaned }, { onConflict: 'name' });
    if (error) throw error;
    setNeighborhoods(prev => {
      const exists = prev.some(n => n.toLowerCase() === cleaned.toLowerCase());
      return exists ? prev : [...prev, cleaned];
    });
  };

  const updateNeighborhood = async (oldName: string, newName: string) => {
    const cleaned = newName.trim();
    if (!cleaned) return;
    const exists = neighborhoods.some(
      item => item.toLowerCase() === cleaned.toLowerCase()
    );
    if (exists && cleaned.toLowerCase() !== oldName.toLowerCase()) {
      throw new Error('Neighborhood already exists');
    }
    const { error: neighborhoodError } = await supabase
      .from('neighborhoods')
      .update({ name: cleaned })
      .eq('name', oldName);
    if (neighborhoodError) {
      throw neighborhoodError;
    }
    const { error: propertiesError } = await supabase
      .from('properties')
      .update({ neighborhood: cleaned })
      .eq('neighborhood', oldName);
    if (propertiesError) {
      throw propertiesError;
    }
    setNeighborhoods(prev =>
      prev.map(n => (n.toLowerCase() === oldName.toLowerCase() ? cleaned : n))
    );
    setProperties(prev =>
      prev.map(p =>
        (p.neighborhood ?? '').toLowerCase() === oldName.toLowerCase()
          ? { ...p, neighborhood: cleaned }
          : p
      )
    );
  };

  const removeNeighborhood = async (name: string) => {
    const usageCount = properties.filter(
      p => (p.neighborhood ?? '').toLowerCase() === name.toLowerCase()
    ).length;
    if (usageCount > 0) {
      throw new Error(`Neighborhood "${name}" is used by ${usageCount} property(ies).`);
    }
    const { error: propertiesError } = await supabase
      .from('properties')
      .update({ neighborhood: null })
      .eq('neighborhood', name);
    if (propertiesError) throw propertiesError;
    const { error: deleteError } = await supabase.from('neighborhoods').delete().eq('name', name);
    if (deleteError) throw deleteError;
    setNeighborhoods(prev => prev.filter(n => n.toLowerCase() !== name.toLowerCase()));
    setProperties(prev =>
      prev.map(p =>
        (p.neighborhood ?? '').toLowerCase() === name.toLowerCase()
          ? { ...p, neighborhood: null }
          : p
      )
    );
  };

  const addMyPropertyId = (id: string) => {
    setMyPropertyIds(prev => (prev.includes(id) ? prev : [id, ...prev]));
  };

  const toggleFavorite = async (id: string) => {
    const wasFavorite = favorites.includes(id);
    setFavorites(prev => wasFavorite ? prev.filter(x => x !== id) : [id, ...prev]);
    setPropertyStats(statsPrev => {
      const current = statsPrev[id] || { views: 0, contacts: 0, shares: 0, likes: 0 };
      const currentLikes = typeof current.likes === 'number' ? current.likes : 0;
      return {
        ...statsPrev,
        [id]: { ...current, likes: Math.max(0, currentLikes + (wasFavorite ? -1 : 1)) },
      };
    });
    try {
      if (currentUser?.id) {
        const result = wasFavorite
          ? await supabase.from('favorites').delete().match({ user_id: currentUser.id, property_id: id })
          : await supabase.from('favorites').insert({ user_id: currentUser.id, property_id: id });
        if (result.error) throw result.error;
      }
    } catch (error) {
      setFavorites(prev => wasFavorite ? [id, ...prev.filter(item => item !== id)] : prev.filter(item => item !== id));
      setPropertyStats(statsPrev => {
        const current = statsPrev[id] || { views: 0, contacts: 0, shares: 0, likes: 0 };
        return {
          ...statsPrev,
          [id]: {
            ...current,
            likes: Math.max(0, current.likes + (wasFavorite ? 1 : -1)),
          },
        };
      });
      throw error;
    }
  };

  const isFavorite = (id: string) => favorites.includes(id);

  const addSavedSearch = (data: Omit<SavedSearch, 'id' | 'createdAt'>) => {
    const saved: SavedSearch = {
      ...data,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setSavedSearches(prev => [saved, ...prev]);
  };

  const removeSavedSearch = (id: string) => {
    setSavedSearches(prev => prev.filter(s => s.id !== id));
  };

  const addSearchHistory = useCallback((query: string) => {
    const cleaned = query.trim();
    if (!cleaned) return;
    setSearchHistory(prev => {
      const next = [cleaned, ...prev.filter(item => item.toLowerCase() !== cleaned.toLowerCase())];
      return next.slice(0, 10);
    });
  }, []);

  const clearSearchHistory = () => {
    setSearchHistory([]);
  };

  const toggleNeighborhoodAlert = (name: string) => {
    setNeighborhoodAlerts(prev => {
      const exists = prev.some(n => n.toLowerCase() === name.toLowerCase());
      if (exists) {
        return prev.filter(n => n.toLowerCase() !== name.toLowerCase());
      }
      return [...prev, name];
    });
  };

  const setPrivacySetting = (key: 'hideContact' | 'hideListings', value: boolean) => {
    setPrivacySettings(prev => ({ ...prev, [key]: value }));
  };

  const registerUser = useCallback(async (data: { name: string; email: string; phone: string; password: string; wantsAgentAccess: boolean }) => {
    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return { ok: false, code: 'invalid email' } as { ok: false; code: string };
    }
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password: data.password,
      options: {
        emailRedirectTo: authCallbackUrl,
        data: {
          name: data.name,
          phone: data.phone,
          wants_agent_access: data.wantsAgentAccess,
        }
      }
    });
    if (error) {
      return { ok: false, code: error.message } as { ok: false; code: string };
    }
    return { ok: true as const, confirmationRequired: !authData.session };
  }, []);

  const loginUser = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail)) {
      return { ok: false, code: 'invalid email' } as { ok: false; code: string };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) {
      return { ok: false, code: error.message } as { ok: false; code: string };
    }
    return { ok: true } as { ok: true };
  }, []);

  const requestAgentAccess = useCallback(async () => {
    if (!currentUser) throw new Error('Une connexion est requise pour demander le statut agent.');
    if (currentUser.role === 'AGENT' || currentUser.role === 'ADMIN') return;
    if (currentUser.agentStatus === 'pending') return;

    const { error } = await supabase.rpc('request_agent_access');
    if (error) throw error;
    setCurrentUser(previous =>
      previous && previous.id === currentUser.id
        ? { ...previous, agentStatus: 'pending', agentRejectionReason: null }
        : previous
    );
  }, [currentUser]);

  const logoutUser = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const verifyUser = async (id: string, value: boolean) => {
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, verified: value } : u)));
  };

  const reviewAgentRequest = async (id: string, approved: boolean, reason?: string) => {
    if (!currentUser?.isAdmin) throw new Error('Accès administrateur requis.');
    const updates = approved
      ? { role: 'AGENT' as const, agent_status: 'approved' as const, agent_rejection_reason: null }
      : { role: 'USER' as const, agent_status: 'rejected' as const, agent_rejection_reason: reason?.trim() || 'Votre demande doit être complétée.' };
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) throw error;
    setUsers(prev => prev.map(user => (
      user.id === id
        ? { ...user, role: updates.role, agentStatus: updates.agent_status, agentRejectionReason: updates.agent_rejection_reason, verified: approved }
        : user
    )));
  };

  const updateUser = (id: string, updates: Partial<Pick<User, 'name' | 'email' | 'phone'>>) => {
    setUsers(prev =>
      prev.map(u => (u.id === id ? { ...u, ...updates } : u))
    );
  };

  useEffect(() => {
    if (!hydrated) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => {
      addSearchHistory(trimmed);
    }, 700);
    return () => clearTimeout(timer);
  }, [searchQuery, hydrated, addSearchHistory]);

  useEffect(() => {
    if (!hydrated) return;
    const channel = supabase
      .channel('neighborhoods-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'neighborhoods' },
        payload => {
          if (payload.eventType === 'INSERT') {
            const name = (payload.new as { name?: string })?.name?.trim();
            if (!name) return;
            setNeighborhoods(prev => {
              const exists = prev.some(n => n.toLowerCase() === name.toLowerCase());
              return exists ? prev : [...prev, name];
            });
          } else if (payload.eventType === 'UPDATE') {
            const nextName = (payload.new as { name?: string })?.name?.trim();
            const oldName = (payload.old as { name?: string })?.name?.trim();
            if (!nextName) return;
            setNeighborhoods(prev => {
              const updated = prev.map(n =>
                oldName && n.toLowerCase() === oldName.toLowerCase() ? nextName : n
              );
              const exists = updated.some(n => n.toLowerCase() === nextName.toLowerCase());
              return exists ? updated : [...updated, nextName];
            });
          } else if (payload.eventType === 'DELETE') {
            const oldName = (payload.old as { name?: string })?.name?.trim();
            if (!oldName) return;
            setNeighborhoods(prev => prev.filter(n => n.toLowerCase() !== oldName.toLowerCase()));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const urls = properties
      .flatMap(p => p.images || [])
      .filter(value => typeof value === 'string' && value.trim().length > 0 && value !== 'null')
      .slice(0, 24);
    urls.forEach(url => {
      Image.prefetch(url).catch(() => undefined);
    });
  }, [properties, hydrated]);

  const addReport = useCallback(async (data: { propertyId: string; reason: ReportReason; message: string }): Promise<Report> => {
    const reporterId = await resolveAuthUserId();
    const { data: row, error } = await supabase
      .from('property_reports')
      .insert({ property_id: data.propertyId, user_id: reporterId, reason: data.reason, message: data.message })
      .select()
      .single();
    if (error) throw error;
    const report = mapReportRow(row);
    setReports(prev => [report, ...prev.filter(item => item.id !== report.id)]);
    return report;
  }, [resolveAuthUserId]);

  const resolveReport = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('property_reports').update({ status: 'RESOLVED' }).eq('id', id);
    if (error) throw error;
    setReports(prev => prev.map(report => (report.id === id ? { ...report, status: 'RESOLVED' } : report)));
  }, []);

  const bumpStat = useCallback((id: string, key: keyof PropertyStats) => {
    setPropertyStats(prev => {
      const current = prev[id] || { views: 0, contacts: 0, shares: 0, likes: 0 };
      const currentValue = typeof current[key] === 'number' ? current[key] : 0;
      return {
        ...prev,
        [id]: { ...current, [key]: currentValue + 1 },
      };
    });
  }, []);

  const trackPropertyView = useCallback((id: string) => {
    bumpStat(id, 'views');
    setRecentViewedIds(prev => {
      const next = [id, ...prev.filter(item => item !== id)];
      return next.slice(0, 10);
    });
  }, [bumpStat]);
  const trackContact = useCallback((id: string) => bumpStat(id, 'contacts'), [bumpStat]);
  const trackShare = useCallback((id: string) => bumpStat(id, 'shares'), [bumpStat]);

  const t = useCallback((key: TranslationKey) => translate(language, key), [language]);
  const tType = useCallback((type: PropertyType) => translateType(language, type), [language]);
  const tStatus = useCallback((status: PropertyStatus) => translateStatus(language, status), [language]);

  const replaceData = (data: { properties: Property[]; clients: Client[] }) => {
    setProperties(data.properties);
    setClients(data.clients);
    setNeighborhoods(normalizeNeighborhoods(data.properties.map(p => p.neighborhood ?? p.location)));
    setSelectedProperty(null);
  };

  const getFilteredProperties = (): Property[] => {
      let filtered = properties.filter(isPublicProperty);

    if (filterType !== 'ALL') {
      filtered = filtered.filter(p => p.type === filterType);
    }

    if (filters.minPrice !== null) {
      filtered = filtered.filter(p => p.price >= filters.minPrice!);
    }
    if (filters.maxPrice !== null) {
      filtered = filtered.filter(p => p.price <= filters.maxPrice!);
    }
    if (filters.minBedrooms !== null) {
      filtered = filtered.filter(p => (p.bedrooms ?? 0) >= filters.minBedrooms!);
    }
    if (filters.minBathrooms !== null) {
      filtered = filtered.filter(p => (p.bathrooms ?? 0) >= filters.minBathrooms!);
    }
    if (filters.minArea !== null) {
      filtered = filtered.filter(p => (p.area ?? 0) >= filters.minArea!);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.title.toLowerCase().includes(query) ||
          p.location.toLowerCase().includes(query) ||
          (p.neighborhood ?? '').toLowerCase().includes(query) ||
          (p.city ?? '').toLowerCase().includes(query) ||
          (p.description ?? '').toLowerCase().includes(query)
      );
    }

    return filtered;
  };

    const getMyProperties = (): Property[] => {
      return currentUser?.id
        ? properties.filter(p => p.ownerId === currentUser.id)
        : properties.filter(p => myPropertyIds.includes(p.id));
    };

  // Enhanced features implementations

  // Messaging functions
  const sendMessage = useCallback(async (receiverId: string, content: string, propertyId?: string): Promise<{ message: Message; chatId: string }> => {
    if (!currentUser) throw new Error('User not logged in');

    const participants = [currentUser.id, receiverId].sort();
    const chatId = getChatKey(participants, propertyId);
    const existingChat = chats.find(chat =>
      getChatKey(chat.participants, chat.propertyId) === chatId
    );
    const optimisticMessage: Message = {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderId: currentUser.id,
      receiverId,
      propertyId,
      content,
      timestamp: new Date().toISOString(),
      read: false,
      type: propertyId ? 'property_link' : 'text',
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setChats(prev => {
      const currentChat = prev.find(chat =>
        getChatKey(chat.participants, chat.propertyId) === chatId
      );
      if (currentChat) {
        return prev.map(chat => getChatKey(chat.participants, chat.propertyId) === chatId
          ? {
              ...chat,
              id: chatId,
              lastMessage: optimisticMessage,
              updatedAt: optimisticMessage.timestamp,
              unreadCount: {
                ...chat.unreadCount,
                [receiverId]: (chat.unreadCount[receiverId] || 0) + 1,
              },
            }
          : chat
        );
      }
      const newChat: Chat = {
        id: chatId,
        participants,
        propertyId,
        lastMessage: optimisticMessage,
        updatedAt: optimisticMessage.timestamp,
        unreadCount: { [receiverId]: 1 },
      };
      return [...prev, newChat];
    });
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: receiverId,
          property_id: propertyId ?? null,
          content,
          read: false,
          type: propertyId ? 'property_link' : 'text',
        })
        .select()
        .single();
      if (error) throw error;

      const message = mapMessageRow(data);
      setMessages(prev => prev.map(item => item.id === optimisticMessage.id ? message : item));
      setChats(prev => prev.map(chat => {
        if (getChatKey(chat.participants, chat.propertyId) !== chatId) return chat;
        const isLatest = !chat.lastMessage ||
          new Date(message.timestamp).getTime() >= new Date(chat.lastMessage.timestamp).getTime();
        return {
          ...chat,
          id: chatId,
          ...(isLatest ? { lastMessage: message, updatedAt: message.timestamp } : {}),
        };
      }));
      return { message, chatId };
    } catch (error) {
      setMessages(prev => prev.filter(item => item.id !== optimisticMessage.id));
      setChats(prev => {
        const currentChat = prev.find(chat =>
          getChatKey(chat.participants, chat.propertyId) === chatId
        );
        if (!currentChat) return prev;

        const unreadCount = {
          ...currentChat.unreadCount,
          [receiverId]: Math.max(0, (currentChat.unreadCount[receiverId] ?? 0) - 1),
        };
        if (currentChat.lastMessage?.id !== optimisticMessage.id) {
          return prev.map(chat =>
            getChatKey(chat.participants, chat.propertyId) === chatId
              ? { ...chat, unreadCount }
              : chat
          );
        }

        if (!existingChat) {
          return prev.filter(chat =>
            getChatKey(chat.participants, chat.propertyId) !== chatId
          );
        }

        return prev.map(chat =>
          getChatKey(chat.participants, chat.propertyId) === chatId
            ? {
                ...chat,
                id: chatId,
                lastMessage: existingChat.lastMessage,
                updatedAt: existingChat.updatedAt,
                unreadCount,
              }
            : chat
        );
      });
      throw error;
    }
  }, [chats, currentUser]);

  const getChatMessages = useCallback((chatId: string): Message[] => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return [];

    return messages.filter(m =>
      (
        (m.senderId === chat.participants[0] && m.receiverId === chat.participants[1]) ||
        (m.senderId === chat.participants[1] && m.receiverId === chat.participants[0])
      ) &&
      (m.propertyId ?? null) === (chat.propertyId ?? null)
    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [chats, messages]);

  const markMessagesAsRead = useCallback(async (chatId: string, userId: string) => {
    const chat = chats.find(c => c.id === chatId);
    const otherUserId = chat?.participants.find(id => id !== userId);
    if (!chat || !otherUserId || chat.unreadCount[userId] === 0) return;
    setChats(prev =>
      prev.map(item =>
        item.id === chatId
          ? { ...item, unreadCount: { ...item.unreadCount, [userId]: 0 } }
          : item
      )
    );
    try {
      let query = supabase
          .from('messages')
          .update({ read: true })
          .match({ receiver_id: userId, sender_id: otherUserId });
      query = chat.propertyId === undefined
          ? query.is('property_id', null)
          : query.eq('property_id', chat.propertyId);
      const { error } = await query;
      if (error) throw error;
      setMessages(prev => prev.map(message =>
        message.receiverId === userId &&
        message.senderId === otherUserId &&
        (message.propertyId ?? null) === (chat.propertyId ?? null)
          ? { ...message, read: true }
          : message
      ));
    } catch (error) {
      setChats(prev =>
          prev.map(item =>
            item.id === chatId
              ? {
                  ...item,
                  unreadCount: {
                    ...item.unreadCount,
                    [userId]: (item.unreadCount[userId] ?? 0) + (chat.unreadCount[userId] ?? 0),
                  },
                }
              : item
          )
      );
      throw error;
    }
  }, [chats]);

  // Review functions
  const addReview = useCallback(async (propertyId: string, rating: number, comment: string): Promise<Review> => {
    if (!currentUser) throw new Error('User not logged in');
    const { data, error } = await supabase
      .from('reviews')
      .insert({ property_id: propertyId, user_id: currentUser.id, rating, comment })
      .select()
      .single();
    if (error) throw error;
    const review = mapReviewRow(data);
    setReviews(prev => [review, ...prev.filter(item => item.id !== review.id)]);
    return review;
  }, [currentUser]);

  const setReviewVerified = useCallback(async (id: string, verified: boolean) => {
    const { error } = await supabase.from('reviews').update({ verified }).eq('id', id);
    if (error) throw error;
    setReviews(previous => previous.map(review =>
      review.id === id ? { ...review, verified } : review
    ));
  }, []);

  const getPropertyReviews = useCallback((propertyId: string): Review[] => {
    return reviews.filter(r => r.propertyId === propertyId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reviews]);

  const getAverageRating = useCallback((propertyId: string): number => {
    const propertyReviews = getPropertyReviews(propertyId);
    if (propertyReviews.length === 0) return 0;
    const sum = propertyReviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / propertyReviews.length;
  }, [getPropertyReviews]);

  // Agent profile functions
  const createAgentProfile = useCallback(async (
    data: Omit<AgentProfile, 'rating' | 'reviewCount' | 'totalSales' | 'totalCommission'>
  ) => {
    if (!currentUser) throw new Error('User not logged in');
    if (data.userId !== currentUser.id) throw new Error('Cannot create another user’s agent profile');
    const { data: row, error } = await supabase
      .from('agent_profiles')
      .insert({
        user_id: currentUser.id,
        bio: data.bio,
        specialties: data.specialties,
        experience: data.experience,
        license_number: data.licenseNumber ?? null,
        company: data.company ?? null,
        portfolio: data.portfolio,
      })
      .select('*')
      .single();
    if (error) throw error;
    const profile = mapAgentProfileRow(row as AgentProfileRow);
    setAgentProfiles(prev => [...prev.filter(item => item.userId !== profile.userId), profile]);
  }, [currentUser]);

  const updateAgentProfile = useCallback(async (userId: string, updates: Partial<AgentProfile>) => {
    if (!currentUser) throw new Error('User not logged in');
    if (userId !== currentUser.id) throw new Error('Cannot update another user’s agent profile');
    const payload = {
      ...(updates.bio !== undefined ? { bio: updates.bio } : {}),
      ...(updates.specialties !== undefined ? { specialties: updates.specialties } : {}),
      ...(updates.experience !== undefined ? { experience: updates.experience } : {}),
      ...(updates.licenseNumber !== undefined ? { license_number: updates.licenseNumber } : {}),
      ...(updates.company !== undefined ? { company: updates.company } : {}),
      ...(updates.portfolio !== undefined ? { portfolio: updates.portfolio } : {}),
    };
    if (Object.keys(payload).length === 0) return;
    const { data: row, error } = await supabase
      .from('agent_profiles')
      .update(payload)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    const profile = mapAgentProfileRow(row as AgentProfileRow);
    setAgentProfiles(prev => prev.map(item => item.userId === userId ? profile : item));
  }, [currentUser]);

  const getAgentProfile = useCallback((userId: string): AgentProfile | null => {
    return agentProfiles.find(profile => profile.userId === userId) || null;
  }, [agentProfiles]);

  // Search alerts
  const createSearchAlert = useCallback(async (
    data: Omit<SearchAlert, 'id' | 'createdAt'>
  ): Promise<SearchAlert> => {
    if (!currentUser) throw new Error('User not logged in');
    const { data: row, error } = await supabase
      .from('search_alerts')
      .insert({
        user_id: currentUser.id,
        label: data.label,
        filters: data.filters,
        property_type: data.type,
        active: data.active,
        last_triggered: data.lastTriggered ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    const alert = mapSearchAlertRow(row as SearchAlertRow);
    setSearchAlerts(prev => [alert, ...prev]);
    return alert;
  }, [currentUser]);

  const updateSearchAlert = useCallback(async (id: string, updates: Partial<SearchAlert>) => {
    if (!currentUser) throw new Error('User not logged in');
    const payload = {
      ...(updates.label !== undefined ? { label: updates.label } : {}),
      ...(updates.filters !== undefined ? { filters: updates.filters } : {}),
      ...(updates.type !== undefined ? { property_type: updates.type } : {}),
      ...(updates.active !== undefined ? { active: updates.active } : {}),
      ...(updates.lastTriggered !== undefined ? { last_triggered: updates.lastTriggered } : {}),
    };
    if (Object.keys(payload).length === 0) return;
    const { data: row, error } = await supabase
      .from('search_alerts')
      .update(payload)
      .eq('id', id)
      .eq('user_id', currentUser.id)
      .select('*')
      .single();
    if (error) throw error;
    const alert = mapSearchAlertRow(row as SearchAlertRow);
    setSearchAlerts(prev => prev.map(item => item.id === id ? alert : item));
  }, [currentUser]);

  const deleteSearchAlert = useCallback(async (id: string) => {
    if (!currentUser) throw new Error('User not logged in');
    const { error } = await supabase
      .from('search_alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);
    if (error) throw error;
    setSearchAlerts(prev => prev.filter(alert => alert.id !== id));
  }, [currentUser]);

  const checkSearchAlerts = useCallback(async (newProperty: Property) => {
    const matchingAlerts = searchAlerts.filter(alert =>
      alert.active &&
      (alert.type === 'ALL' || alert.type === newProperty.type) &&
      (alert.filters.minPrice === null || newProperty.price >= alert.filters.minPrice) &&
      (alert.filters.maxPrice === null || newProperty.price <= alert.filters.maxPrice) &&
      (alert.filters.minArea === null || (newProperty.area ?? 0) >= alert.filters.minArea)
    );
    if (matchingAlerts.length === 0) return;
    const lastTriggered = new Date().toISOString();
    const results = await Promise.all(matchingAlerts.map(async alert => {
      const { error } = await supabase
        .from('search_alerts')
        .update({ last_triggered: lastTriggered })
        .eq('id', alert.id)
        .select('id')
        .single();
      return { id: alert.id, error };
    }));
    const successfulIds = new Set(results.filter(result => !result.error).map(result => result.id));
    setSearchAlerts(prev => prev.map(alert =>
      successfulIds.has(alert.id) ? { ...alert, lastTriggered } : alert
    ));
    const failed = results.find(result => result.error);
    if (failed?.error) throw failed.error;
  }, [searchAlerts]);

  // Premium listings
  const createPremiumListing = useCallback(async (
    _propertyId: string,
    _plan: 'BASIC' | 'FEATURED' | 'PREMIUM'
  ): Promise<PremiumListing> => {
    throw new Error('Premium listings require a verified server-side payment');
  }, []);

  const getPremiumFeatures = useCallback((propertyId: string): string[] => {
    const listing = premiumListings.find(p => p.propertyId === propertyId);
    return listing && new Date(listing.endDate).getTime() > Date.now()
      ? listing.features
      : [];
  }, [premiumListings]);

  const isPremium = useCallback((propertyId: string): boolean => {
    return premiumListings.some(p =>
      p.propertyId === propertyId && new Date(p.endDate).getTime() > Date.now()
    );
  }, [premiumListings]);

  // Commission system
  const createCommissionRule = useCallback(async (
    data: Omit<CommissionRule, 'id'>
  ): Promise<CommissionRule> => {
    if (!currentUser) throw new Error('User not logged in');
    if (data.agentId !== currentUser.id && currentUser.role !== 'ADMIN') {
      throw new Error('Cannot create a commission rule for another agent');
    }
    const { data: row, error } = await supabase
      .from('commission_rules')
      .insert({
        agent_id: data.agentId,
        property_type: data.propertyType,
        percentage: data.percentage,
        min_amount: data.minAmount,
        max_amount: data.maxAmount,
        active: data.active,
      })
      .select('*')
      .single();
    if (error) throw error;
    const rule = mapCommissionRuleRow(row as CommissionRuleRow);
    setCommissionRules(prev => [rule, ...prev]);
    return rule;
  }, [currentUser]);

  const toggleCommissionRule = useCallback(async (id: string) => {
    if (!currentUser) throw new Error('User not logged in');
    const rule = commissionRules.find(item => item.id === id);
    if (!rule) throw new Error('Commission rule not found');
    const { data: row, error } = await supabase
      .from('commission_rules')
      .update({ active: !rule.active })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    const updatedRule = mapCommissionRuleRow(row as CommissionRuleRow);
    setCommissionRules(prev => prev.map(item => item.id === id ? updatedRule : item));
  }, [commissionRules, currentUser]);

  const calculateCommission = useCallback((propertyId: string, salePrice: number): number => {
    const property = properties.find(p => p.id === propertyId);
    if (!property) return 0;

    const rule = commissionRules.find(r =>
      r.agentId === property.clientId &&
      (r.propertyType === property.type || r.propertyType === 'ALL') &&
      r.active &&
      salePrice >= r.minAmount &&
      salePrice <= r.maxAmount
    );

    return rule ? (salePrice * rule.percentage) / 100 : 0;
  }, [properties, commissionRules]);

  // Transactions
  const createTransaction = useCallback(async (
    data: Omit<Transaction, 'id' | 'createdAt'>
  ): Promise<Transaction> => {
    if (!currentUser) throw new Error('User not logged in');
    const { data: row, error } = await supabase
      .from('property_transactions')
      .insert({
        property_id: data.propertyId,
        buyer_id: currentUser.id,
        seller_id: data.sellerId,
        agent_id: data.agentId ?? null,
        amount: data.amount,
        commission: data.commission ?? null,
        status: 'PENDING',
      })
      .select('*')
      .single();
    if (error) throw error;
    const transaction = mapTransactionRow(row as TransactionRow);
    setTransactions(prev => [transaction, ...prev]);
    return transaction;
  }, [currentUser]);

  const updateTransactionStatus = useCallback(async (
    id: string,
    status: Transaction['status']
  ) => {
    if (!currentUser) throw new Error('User not logged in');
    if (currentUser.role !== 'ADMIN') throw new Error('Only administrators can update transaction status');
    const { data: row, error } = await supabase
      .from('property_transactions')
      .update({
        status,
        completed_at: status === 'COMPLETED' ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    const transaction = mapTransactionRow(row as TransactionRow);
    setTransactions(prev => prev.map(item => item.id === id ? transaction : item));
  }, [currentUser]);

  // Documents
  const addDocument = useCallback(async (
    data: Omit<Document, 'id' | 'uploadedAt'>
  ): Promise<Document> => {
    if (!currentUser) throw new Error('User not logged in');
    const { data: row, error } = await supabase
      .from('property_documents')
      .insert({
        property_id: data.propertyId,
        name: data.name,
        type: data.type,
        url: data.url,
        uploaded_by: currentUser.id,
      })
      .select('*')
      .single();
    if (error) throw error;
    const document = mapPropertyDocumentRow(row as PropertyDocumentRow);
    setDocuments(prev => [document, ...prev]);
    return document;
  }, [currentUser]);

  const getPropertyDocuments = useCallback((propertyId: string): Document[] => {
    return documents.filter(d => d.propertyId === propertyId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }, [documents]);

  return (
    <AppContext.Provider
        value={{
          properties,
          clients,
          neighborhoods,
          favorites,
          savedSearches,
          searchHistory,
          recentViewedIds,
          neighborhoodAlerts,
        users,
        currentUser,
        hydrated,
        syncError,
        retrySync,
        reports,
        propertyStats,
        myPropertyIds,
        visitorCount,
        privacySettings,
        language,
        setLanguage,
        theme,
        setTheme,
        t,
        tType,
        tStatus,
        filters,
        selectedProperty,
        setSelectedProperty,
        filterType,
        setFilterType,
        searchQuery,
        setSearchQuery,
        setFilters,
        resetFilters,
        addProperty,
        updateProperty,
        updatePropertyStatus,
        completeProperty,
        markPropertySold,
        clearSoldStatus,
        deleteProperty,
        addClient,
        updateClient,
        addNeighborhood,
        updateNeighborhood,
        removeNeighborhood,
        addMyPropertyId,
        toggleFavorite,
        isFavorite,
        addSavedSearch,
        removeSavedSearch,
        addSearchHistory,
        clearSearchHistory,
        toggleNeighborhoodAlert,
        setPrivacySetting,
        registerUser,
        loginUser,
        requestAgentAccess,
        logoutUser,
        verifyUser,
        reviewAgentRequest,
        updateUser,
        addReport,
        resolveReport,
        trackPropertyView,
        trackContact,
        trackShare,
        replaceData,
        getFilteredProperties,
        getMyProperties,
        // New enhanced features
        messages,
        chats,
        reviews,
        agentProfiles,
        searchAlerts,
        premiumListings,
        commissionRules,
        transactions,
        documents,
        contracts,
        payments,
        tenantDocuments,
        notifications,
        markNotificationRead,
        clearNotifications,
        addContract,
        updateContract,
        updateContractStatus,
        addPayment,
        updatePayment,
        updatePaymentStatus,
        addTenantDocumentRecord,
        sendMessage,
        getChatMessages,
        markMessagesAsRead,
        addReview,
        setReviewVerified,
        getPropertyReviews,
        getAverageRating,
        createAgentProfile,
        updateAgentProfile,
        getAgentProfile,
        createSearchAlert,
        updateSearchAlert,
        deleteSearchAlert,
        checkSearchAlerts,
        createPremiumListing,
        getPremiumFeatures,
        isPremium,
        createCommissionRule,
        toggleCommissionRule,
        calculateCommission,
        createTransaction,
        updateTransactionStatus,
        addDocument,
        getPropertyDocuments,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
