import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Alert, Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { supabase, supabaseAnonKey, supabaseUrl } from '../lib/supabase';
import { safeRegisterExpoPushToken, safeScheduleLocalNotification } from '../lib/expoNotificationsSafe';
import {
  Property,
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
  MortgageCalculator,
} from '../types';
import { Language, TranslationKey, setCurrentLanguage, translate, translateStatus, translateType } from '../i18n';
import { isExpiredProperty, isPublicProperty } from '../utils/propertyVisibility';

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
  markPropertySold: (id: string) => Promise<void>;
  clearSoldStatus: (id: string) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Promise<Client>;
  updateClient: (id: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>) => Promise<void>;
  addNeighborhood: (name: string) => void;
  updateNeighborhood: (oldName: string, newName: string) => Promise<void>;
  removeNeighborhood: (name: string) => void;
  addMyPropertyId: (id: string) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  addSavedSearch: (data: Omit<SavedSearch, 'id' | 'createdAt'>) => void;
  removeSavedSearch: (id: string) => void;
  addSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  toggleNeighborhoodAlert: (name: string) => void;
  setPrivacySetting: (key: 'hideContact' | 'hideListings', value: boolean) => void;
  registerUser: (data: { name: string; email: string; phone: string; password: string }) => Promise<{ ok: true } | { ok: false; code: string }>;
  loginUser: (email: string, password: string) => Promise<{ ok: true } | { ok: false; code: string }>;
  logoutUser: () => Promise<void>;
  verifyUser: (id: string, value: boolean) => Promise<void>;
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
  addTenantDocumentRecord: (doc: TenantDocument) => void;
  addContract: (data: Omit<Contract, 'id' | 'createdAt'>) => Promise<Contract>;
  updateContract: (id: string, updates: Partial<Omit<Contract, 'id' | 'createdAt'>>) => Promise<void>;
  updateContractStatus: (id: string, status: Contract['status']) => Promise<void>;
  addPayment: (data: Omit<Payment, 'id' | 'createdAt'>) => Promise<Payment>;
  updatePayment: (id: string, updates: Partial<Omit<Payment, 'id' | 'createdAt'>>) => Promise<void>;
  updatePaymentStatus: (id: string, status: Payment['status']) => Promise<void>;
  // Messaging functions
  sendMessage: (receiverId: string, content: string, propertyId?: string) => { message: Message; chatId: string };
  getChatMessages: (chatId: string) => Message[];
  markMessagesAsRead: (chatId: string, userId: string) => void;
  // Review functions
  addReview: (propertyId: string, rating: number, comment: string) => Promise<Review>;
  getPropertyReviews: (propertyId: string) => Review[];
  getAverageRating: (propertyId: string) => number;
  // Agent profile functions
  createAgentProfile: (data: Omit<AgentProfile, 'rating' | 'reviewCount' | 'totalSales' | 'totalCommission'>) => void;
  updateAgentProfile: (userId: string, updates: Partial<AgentProfile>) => void;
  getAgentProfile: (userId: string) => AgentProfile | null;
  // Search alerts
  createSearchAlert: (data: Omit<SearchAlert, 'id' | 'createdAt'>) => SearchAlert;
  updateSearchAlert: (id: string, updates: Partial<SearchAlert>) => void;
  deleteSearchAlert: (id: string) => void;
  checkSearchAlerts: (newProperty: Property) => void;
  // Premium listings
  createPremiumListing: (propertyId: string, plan: 'BASIC' | 'FEATURED' | 'PREMIUM') => PremiumListing;
  getPremiumFeatures: (propertyId: string) => string[];
  isPremium: (propertyId: string) => boolean;
  // Commission system
  createCommissionRule: (data: Omit<CommissionRule, 'id'>) => CommissionRule;
  calculateCommission: (propertyId: string, salePrice: number) => number;
  // Transactions
  createTransaction: (data: Omit<Transaction, 'id' | 'createdAt'>) => Transaction;
  updateTransactionStatus: (id: string, status: Transaction['status']) => void;
  // Documents
  addDocument: (data: Omit<Document, 'id' | 'uploadedAt'>) => Document;
  getPropertyDocuments: (propertyId: string) => Document[];
  // Mortgage calculator
  calculateMortgage: (data: Omit<MortgageCalculator, 'monthlyPayment' | 'totalPayment' | 'totalInterest'>) => MortgageCalculator;
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
  agentProfiles: 'imo:agentProfiles',
  searchAlerts: 'imo:searchAlerts',
  premiumListings: 'imo:premiumListings',
  commissionRules: 'imo:commissionRules',
  transactions: 'imo:transactions',
  documents: 'imo:documents',
  contracts: 'imo:contracts',
  payments: 'imo:payments',
  tenantDocuments: 'imo:tenantDocuments',
};

const DEFAULT_FILTERS: SearchFilters = {
  minPrice: null,
  maxPrice: null,
  minBedrooms: null,
  minBathrooms: null,
  minArea: null,
};

const normalizeNeighborhoods = (values: Array<string | null | undefined>): string[] => {
  const map = new Map<string, string>();
  values.forEach(value => {
    const cleaned = value?.trim();
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (!map.has(key)) {
      map.set(key, cleaned);
    }
  });
  return Array.from(map.values());
};

const extractMissingPropertiesColumn = (message?: string): string | null => {
  if (!message) return null;
  const match = message.match(/Could not find the '([^']+)' column of 'properties'/i);
  return match?.[1] ?? null;
};

  const mapPropertyRow = (row: any): Property => {
    const isValidImage = (value?: string | null) =>
      typeof value === 'string' && value.trim().length > 0 && value !== 'null';
    const images = Array.isArray(row?.property_images)
      ? row.property_images.map((img: any) => img?.url).filter(isValidImage)
      : [];

  return {
    id: row.id,
    ownerId: row.owner_id ?? null,
    title: row.title ?? '',
    description: row.description ?? '',
    type: row.type,
    price: Number(row.price ?? 0),
    location: row.location ?? '',
    neighborhood: row.neighborhood ?? null,
    city: row.location ?? '',
    area: row.area ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    images,
    status: row.status === 'occupied' ? 'occupied' : 'available',
    listingStatus: ['pending', 'approved', 'rejected', 'archived'].includes(row.listing_status)
      ? row.listing_status
      : 'pending',
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    bedrooms: row.bedrooms ?? undefined,
    bathrooms: row.bathrooms ?? undefined,
    featured: row.featured ?? false,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    submittedAt: row.submitted_at ?? null,
    approvedAt: row.approved_at ?? null,
    publishedAt: row.published_at ?? null,
    expiresAt: row.expires_at ?? null,
    soldAt: row.sold_at ?? null,
    rentedAt: row.rented_at ?? null,
    featuredStartAt: row.featured_start_at ?? null,
    featuredEndAt: row.featured_end_at ?? null,
    republishedAt: row.republished_at ?? null,
    clientId: row.client_id ?? '',
    client:
      row.contact_name || row.contact_phone || row.contact_email
        ? {
            id: row.client_id ?? row.owner_id ?? row.id,
            name: row.contact_name ?? '',
            phone: row.contact_phone ?? '',
            email: row.contact_email ?? '',
            createdAt: row.created_at ?? new Date().toISOString(),
          }
        : undefined,
    contactName: row.contact_name ?? null,
    contactPhone: row.contact_phone ?? null,
    contactEmail: row.contact_email ?? null,
  };
};

const dedupeProperties = (items: Property[]): Property[] => {
  const map = new Map<string, Property>();
  items.forEach(item => {
    if (!item?.id) return;
    map.set(item.id, item);
  });
  return Array.from(map.values());
};
const mapMessageRow = (row: any): Message => ({
  id: row.id,
  senderId: row.sender_id,
  receiverId: row.receiver_id,
  propertyId: row.property_id ?? undefined,
  content: row.content ?? '',
  timestamp: row.created_at ?? new Date().toISOString(),
  read: row.read ?? false,
  type: (row.type as Message['type']) ?? 'text',
});

const mapReviewRow = (row: any): Review => ({
  id: row.id,
  propertyId: row.property_id,
  reviewerId: row.user_id ?? '',
  // The public review policy deliberately does not expose profile contact data.
  reviewerName: row.reviewer_name ?? 'Utilisateur',
  rating: Number(row.rating ?? 0),
  comment: row.comment ?? '',
  createdAt: row.created_at ?? new Date().toISOString(),
  verified: row.verified ?? false,
});

const mapReportRow = (row: any): Report => ({
  id: row.id,
  propertyId: row.property_id,
  reason: row.reason as ReportReason,
  message: row.message ?? '',
  status: row.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN',
  createdAt: row.created_at ?? new Date().toISOString(),
});

const buildChatsFromMessages = (items: Message[]): Chat[] => {
  const map = new Map<string, Chat>();
  items.forEach(message => {
    const participants = [message.senderId, message.receiverId].sort();
    const key = `${participants.join('|')}|${message.propertyId ?? ''}`;
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
const memoryStore = new Map<string, string>();
const storage = {
  async getItem(key: string) {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null) return value;
    } catch {
      // Ignore secure store failures and fallback to memory
    }
    return memoryStore.get(key) ?? null;
  },
  async setItem(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      // Ignore secure store failures and fallback to memory
    }
    memoryStore.set(key, value);
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
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>([]);
  const [searchAlerts, setSearchAlerts] = useState<SearchAlert[]>([]);
  const [premiumListings, setPremiumListings] = useState<PremiumListing[]>([]);
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenantDocuments, setTenantDocuments] = useState<TenantDocument[]>([]);
  const [filters, setFiltersState] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [filterType, setFilterType] = useState<PropertyType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const visitRecorded = useRef(false);
  const listingStatusRef = useRef<Record<string, ListingStatus | undefined>>({});

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
          } catch {
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
        setAgentProfiles(parse<AgentProfile[]>(STORAGE_KEYS.agentProfiles, []));
        setSearchAlerts(parse<SearchAlert[]>(STORAGE_KEYS.searchAlerts, []));
        setPremiumListings(parse<PremiumListing[]>(STORAGE_KEYS.premiumListings, []));
        setCommissionRules(parse<CommissionRule[]>(STORAGE_KEYS.commissionRules, []));
        setTransactions(parse<Transaction[]>(STORAGE_KEYS.transactions, []));
        setDocuments(parse<Document[]>(STORAGE_KEYS.documents, []));
        setContracts(parse<Contract[]>(STORAGE_KEYS.contracts, []));
        setPayments(parse<Payment[]>(STORAGE_KEYS.payments, []));
        setTenantDocuments(parse<TenantDocument[]>(STORAGE_KEYS.tenantDocuments, []));
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
    storage.setItem(STORAGE_KEYS.agentProfiles, JSON.stringify(agentProfiles));
  }, [agentProfiles, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.searchAlerts, JSON.stringify(searchAlerts));
  }, [searchAlerts, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.premiumListings, JSON.stringify(premiumListings));
  }, [premiumListings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.commissionRules, JSON.stringify(commissionRules));
  }, [commissionRules, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
  }, [transactions, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEYS.documents, JSON.stringify(documents));
  }, [documents, hydrated]);

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
  const mapAuthUser = useCallback((user: any, isAdmin = false): User => {
    const email = String(user.email || '').trim();
    const metadata = user.user_metadata ?? {};
    const name = [
      metadata.name,
      metadata.full_name,
      metadata.display_name,
      metadata.username,
      metadata.user_name,
    ].find(value => typeof value === 'string' && value.trim())?.trim() ?? '';
    return ({
      id: user.id,
      name,
      email,
      phone: String(metadata.phone || '').trim(),
      verified: user.email_confirmed_at ? true : false,
      isAdmin,
    });
  }, []);

  const hydrateAuthenticatedUser = useCallback(async (authUser: any) => {
    if (!authUser) {
      setCurrentUser(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .maybeSingle();
    // Failing closed prevents a temporary profile/RLS error from granting admin access.
    setCurrentUser(mapAuthUser(authUser, !error && data?.role === 'ADMIN'));
  }, [mapAuthUser]);

  const notifyLocal = useCallback(async (title: string, body: string) => {
    await safeScheduleLocalNotification(title, body);
  }, []);

  const registerPushToken = useCallback(async () => {
    if (!currentUser) return;
    await safeRegisterExpoPushToken(async token => {
      await supabase.from('user_push_tokens').upsert({
        user_id: currentUser.id,
        token,
        updated_at: new Date().toISOString(),
      });
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
    if (!currentUser) return;
    registerPushToken();
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
      const { data: props, error } = await supabase
        .from('properties')
        .select('*, property_images(url)')
        .order('created_at', { ascending: false })
        .range(0, 99);
      if (error) {
        console.warn('Properties fetch error', error.message);
        setSyncError('Une erreur est survenue. Veuillez réessayer.');
        return;
      }
      if (props) {
        const mapped = dedupeProperties(props.map(mapPropertyRow));
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
            const next = normalizeNeighborhoods(mapped.map(p => p.neighborhood ?? p.location));
            const merged = new Map<string, string>();
            [...prev, ...next].forEach(name => {
              const key = name.toLowerCase();
              if (!merged.has(key)) merged.set(key, name);
            });
            return Array.from(merged.values());
          });
        }
      }, [currentUser, notifyLocal]);

  const loadFavoritesFromSupabase = useCallback(async () => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('favorites')
      .select('property_id')
      .eq('user_id', currentUser.id);
    if (error) return;
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
    if (error) return;
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
    if (error) {
      console.warn('Reviews fetch error', error.message);
      return;
    }
    setReviews((data ?? []).map(mapReviewRow));
  }, []);

  const loadReportsFromSupabase = useCallback(async () => {
    if (!currentUser) {
      setReports([]);
      return;
    }
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('Reports fetch error', error.message);
      return;
    }
    setReports((data ?? []).map(mapReportRow));
  }, [currentUser]);

    const fetchData = useCallback(async () => {
      if (!hydrated) return;
      setSyncError(null);
      try {
        let baseNeighborhoods: string[] | null = null;
        const { data: neighborhoodRows, error: neighborhoodError } = await supabase
          .from('neighborhoods')
          .select('name')
          .order('name', { ascending: true });
        if (neighborhoodError) {
          console.warn('Neighborhoods fetch error', neighborhoodError.message);
          setSyncError('Une erreur est survenue. Veuillez réessayer.');
        }
        if (neighborhoodRows) {
          baseNeighborhoods = normalizeNeighborhoods(neighborhoodRows.map(row => row.name));
          if (baseNeighborhoods.length > 0) {
            setNeighborhoods(baseNeighborhoods);
          }
        }
        await reloadProperties();
        await loadReviewsFromSupabase();
        await loadReportsFromSupabase();
        if (currentUser) {
          await loadFavoritesFromSupabase();
          await loadMessagesFromSupabase();
        }
        if (baseNeighborhoods && baseNeighborhoods.length > 0) {
          setNeighborhoods(prev => {
            const merged = new Map<string, string>();
            prev.forEach(name => merged.set(name.toLowerCase(), name));
            baseNeighborhoods!.forEach(name => merged.set(name.toLowerCase(), name));
            return Array.from(merged.values());
          });
        }
        const { data: tenants } = await supabase.from('tenants').select('*');
        if (tenants) {
          const mappedTenants: Client[] = tenants.map(t => ({
            id: t.id,
            name: t.full_name ?? '',
            email: t.email ?? '',
            phone: t.phone ?? '',
            createdAt: t.created_at ?? new Date().toISOString(),
          }));
          setClients(mappedTenants);
        }
        const { data: contractRows } = await supabase
          .from('contracts')
          .select('*')
          .order('created_at', { ascending: false });
        if (contractRows) {
          const mappedContracts: Contract[] = contractRows.map(c => ({
            id: c.id,
            propertyId: c.property_id,
            tenantId: c.tenant_id,
            startDate: c.start_date,
            endDate: c.end_date,
            rentAmount: Number(c.rent_amount ?? 0),
            status: c.status,
            createdAt: c.created_at ?? new Date().toISOString(),
          }));
          setContracts(mappedContracts);
        }
        const { data: paymentRows } = await supabase
          .from('payments')
          .select('*')
          .order('created_at', { ascending: false });
        if (paymentRows) {
          const mappedPayments: Payment[] = paymentRows.map(p => ({
            id: p.id,
            contractId: p.contract_id,
            amount: Number(p.amount ?? 0),
            paidAt: p.paid_at,
            method: p.method,
            status: p.status,
            createdAt: p.created_at ?? new Date().toISOString(),
          }));
          setPayments(mappedPayments);
        }
        const { data: docRows } = await supabase
          .from('tenant_documents')
          .select('*')
          .order('created_at', { ascending: false });
        if (docRows) {
          const mappedDocs: TenantDocument[] = docRows.map(d => ({
            id: d.id,
            tenantId: d.tenant_id,
            type: d.type,
            url: d.url,
            createdAt: d.created_at ?? new Date().toISOString(),
          }));
          setTenantDocuments(mappedDocs);
        }
      } catch (e) {
        console.error('Failed to fetch from Supabase', e);
        setSyncError('Une erreur est survenue. Veuillez réessayer.');
      }
    }, [hydrated, reloadProperties, loadReviewsFromSupabase, loadReportsFromSupabase, currentUser, loadFavoritesFromSupabase, loadMessagesFromSupabase]);

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
      listing_status: propertyData.listingStatus ?? 'pending',
      submitted_at: new Date().toISOString(),
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
      for (const rawUri of uris) {
        if (!rawUri) continue;
        if (rawUri.startsWith('http')) {
          uploaded.push(rawUri);
          continue;
        }
        try {
          const uri = await ensureFileUri(rawUri);
          const info = await FileSystem.getInfoAsync(uri);
          if (!info.exists) {
            console.warn('Upload skipped, file not found', { uri, propertyId });
            continue;
          }

          const extMatch = uri.split('.').pop();
          const ext = extMatch && extMatch.length <= 5 ? extMatch.toLowerCase() : 'jpg';
          const path = `${resolvedOwnerId}/${propertyId}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.${ext}`;

          const contentType =
            ext === 'png'
              ? 'image/png'
              : ext === 'webp'
              ? 'image/webp'
              : ext === 'heic'
              ? 'image/heic'
              : ext === 'heif'
              ? 'image/heif'
              : 'image/jpeg';

          // Signed upload to avoid Blob/ArrayBuffer limitations in Expo Go
          const { data: signed, error: signedError } = await supabase
            .storage
            .from('property-images')
            .createSignedUploadUrl(path);

          if (signedError || !signed?.signedUrl) {
            console.warn('Signed upload URL error', {
              error: signedError?.message ?? signedError,
              path,
              propertyId,
            });
            continue;
          }

          let uploadOk = false;
          for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
              const uploadResult = await FileSystem.uploadAsync(signed.signedUrl, uri, {
                httpMethod: 'PUT',
                uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': '3600',
                },
              });
              uploadOk = uploadResult.status >= 200 && uploadResult.status < 300;
              if (!uploadOk) {
                console.warn('Signed upload failed', {
                  attempt,
                  status: uploadResult.status,
                  body: uploadResult.body,
                  path,
                  propertyId,
                });
              }
            } catch (uploadError) {
              console.warn('Signed upload exception', {
                attempt,
                error: uploadError,
                path,
                propertyId,
              });
            }
            if (uploadOk) break;
            await new Promise(resolve => setTimeout(resolve, 800 * attempt));
          }

          if (!uploadOk) {
            continue;
          }

          const { data } = supabase.storage.from('property-images').getPublicUrl(path);
          if (data?.publicUrl) {
            uploaded.push(data.publicUrl);
            const { error: insertError } = await supabase
              .from('property_images')
              .insert({ property_id: propertyId, url: data.publicUrl });
            if (insertError) {
              console.warn('Insert property_image failed', {
                error: insertError.message ?? insertError,
                propertyId,
                url: data.publicUrl,
              });
            }
          }
        } catch (err) {
          console.warn('Upload image exception', {
            error: err,
            propertyId,
          });
        }
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
      const uploadedImages = propertyData.images?.length
        ? await uploadPropertyImages(base.id, propertyData.images, ownerId)
        : [];
      if (propertyData.images?.length && uploadedImages.length === 0) {
        await supabase.from('properties').delete().eq('id', base.id);
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
    addNeighborhood(next.neighborhood ?? next.location);
    return next;
    }, [resolveAuthUserId, uploadPropertyImages, omitUnsupportedPropertyColumns]);

    const updateProperty = useCallback(async (id: string, updates: Partial<Omit<Property, 'id' | 'createdAt'>>) => {
    let payload = toDbPropertyUpdates(updates);
    while (true) {
      const { error } = await supabase.from('properties').update(payload).eq('id', id);
      if (!error) break;

      const missingColumn = extractMissingPropertiesColumn(error.message);
      if (!missingColumn || !(missingColumn in payload)) {
        throw error;
      }

      unsupportedPropertyColumnsRef.current.add(missingColumn);
      payload = omitUnsupportedPropertyColumns(payload);
    }
    setProperties(prev =>
      prev.map(p =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      )
    );
    if (updates.neighborhood || updates.location) {
      addNeighborhood((updates.neighborhood ?? updates.location) as string);
    }
  }, [omitUnsupportedPropertyColumns]);

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
              soldAt: lifecycle?.sold_at ?? (status === 'occupied' ? new Date().toISOString() : null),
              rentedAt: lifecycle?.rented_at ?? null,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  }, []);

  const markPropertySold = useCallback(async (id: string) => {
    await updatePropertyStatus(id, 'occupied');
  }, [updatePropertyStatus]);

  const clearSoldStatus = useCallback(async (id: string) => {
    await updatePropertyStatus(id, 'available');
  }, [updatePropertyStatus]);

  const deleteProperty = useCallback(async (id: string) => {
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) throw error;
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

  const addNeighborhood = (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return;
    setNeighborhoods(prev => {
      const exists = prev.some(n => n.toLowerCase() === cleaned.toLowerCase());
      return exists ? prev : [...prev, cleaned];
    });
    void (async () => {
      try {
        await supabase
          .from('neighborhoods')
          .upsert({ name: cleaned }, { onConflict: 'name' });
      } catch {
        // ignore network errors for offline mode
      }
    })();
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

  const removeNeighborhood = (name: string) => {
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
    setNeighborhoods(prev => prev.filter(n => n.toLowerCase() !== name.toLowerCase()));
    setProperties(prev =>
      prev.map(p =>
        (p.neighborhood ?? '').toLowerCase() === name.toLowerCase()
          ? { ...p, neighborhood: null }
          : p
      )
    );
    void (async () => {
      try {
        await supabase.from('neighborhoods').delete().eq('name', name);
        await supabase.from('properties').update({ neighborhood: null }).eq('neighborhood', name);
      } catch {
        // ignore network errors for offline mode
      }
    })();
  };

  const addMyPropertyId = (id: string) => {
    setMyPropertyIds(prev => (prev.includes(id) ? prev : [id, ...prev]));
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const wasFavorite = prev.includes(id);
      if (currentUser?.id) {
        if (wasFavorite) {
          supabase.from('favorites').delete().match({ user_id: currentUser.id, property_id: id });
        } else {
          supabase.from('favorites').insert({ user_id: currentUser.id, property_id: id });
        }
      }
      setPropertyStats(statsPrev => {
        const current = statsPrev[id] || { views: 0, contacts: 0, shares: 0, likes: 0 };
        const currentLikes = typeof current.likes === 'number' ? current.likes : 0;
        const nextLikes = Math.max(0, currentLikes + (wasFavorite ? -1 : 1));
        return {
          ...statsPrev,
          [id]: { ...current, likes: nextLikes },
        };
      });
      return wasFavorite ? prev.filter(x => x !== id) : [id, ...prev];
    });
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

  const registerUser = useCallback(async (data: { name: string; email: string; phone: string; password: string }) => {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          phone: data.phone,
        }
      }
    });
    if (error) {
      return { ok: false, code: error.message } as { ok: false; code: string };
    }
    return { ok: true } as { ok: true };
  }, []);

  const loginUser = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return { ok: false, code: error.message } as { ok: false; code: string };
    }
    return { ok: true } as { ok: true };
  }, []);

  const logoutUser = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const verifyUser = async (id: string, value: boolean) => {
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, verified: value } : u)));
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
      .from('reports')
      .insert({ property_id: data.propertyId, reporter_id: reporterId, reason: data.reason, message: data.message })
      .select()
      .single();
    if (error) throw error;
    const report = mapReportRow(row);
    setReports(prev => [report, ...prev.filter(item => item.id !== report.id)]);
    return report;
  }, [resolveAuthUserId]);

  const resolveReport = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('reports').update({ status: 'RESOLVED' }).eq('id', id);
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
      const base = currentUser?.id
        ? properties.filter(p => p.ownerId === currentUser.id)
        : properties.filter(p => myPropertyIds.includes(p.id));
      return base.filter(p => !isExpiredProperty(p));
    };

  // Enhanced features implementations

  // Messaging functions
  const sendMessage = useCallback((receiverId: string, content: string, propertyId?: string): { message: Message; chatId: string } => {
    if (!currentUser) throw new Error('User not logged in');

    const message: Message = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      receiverId,
      propertyId,
      content,
      timestamp: new Date().toISOString(),
      read: false,
      type: propertyId ? 'property_link' : 'text',
    };

    let resolvedChatId = '';

    setMessages(prev => [...prev, message]);

    setChats(prev => {
      const existingChat = prev.find(chat =>
        chat.participants.includes(currentUser!.id) && chat.participants.includes(receiverId)
      );

      if (existingChat) {
        resolvedChatId = existingChat.id;
        return prev.map(chat =>
          chat.id === existingChat.id
            ? {
                ...chat,
                lastMessage: message,
                updatedAt: message.timestamp,
                unreadCount: {
                  ...chat.unreadCount,
                  [receiverId]: (chat.unreadCount[receiverId] || 0) + 1,
                },
              }
            : chat
        );
      }

      resolvedChatId = Date.now().toString();
      const newChat: Chat = {
        id: resolvedChatId,
        participants: [currentUser!.id, receiverId],
        propertyId,
        lastMessage: message,
        updatedAt: message.timestamp,
        unreadCount: { [receiverId]: 1 },
      };
      return [...prev, newChat];
    });

    supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: receiverId,
      property_id: propertyId ?? null,
      content,
      read: false,
      type: propertyId ? 'property_link' : 'text',
    });

    return { message, chatId: resolvedChatId };
  }, [currentUser]);

  const getChatMessages = useCallback((chatId: string): Message[] => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return [];

    return messages.filter(m =>
      (m.senderId === chat.participants[0] && m.receiverId === chat.participants[1]) ||
      (m.senderId === chat.participants[1] && m.receiverId === chat.participants[0])
    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [chats, messages]);

  const markMessagesAsRead = useCallback((chatId: string, userId: string) => {
    setChats(prev =>
      prev.map(chat =>
        chat.id === chatId
          ? { ...chat, unreadCount: { ...chat.unreadCount, [userId]: 0 } }
          : chat
      )
    );
    const chat = chats.find(c => c.id === chatId);
    const otherUserId = chat?.participants.find(id => id !== userId);
    if (otherUserId) {
      supabase
        .from('messages')
        .update({ read: true })
        .match({ receiver_id: userId, sender_id: otherUserId });
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
  const createAgentProfile = useCallback((data: Omit<AgentProfile, 'rating' | 'reviewCount' | 'totalSales' | 'totalCommission'>) => {
    const profile: AgentProfile = {
      ...data,
      rating: 0,
      reviewCount: 0,
      totalSales: 0,
      totalCommission: 0,
    };
    setAgentProfiles(prev => [...prev, profile]);
  }, []);

  const updateAgentProfile = useCallback((userId: string, updates: Partial<AgentProfile>) => {
    setAgentProfiles(prev =>
      prev.map(profile =>
        profile.userId === userId ? { ...profile, ...updates } : profile
      )
    );
  }, []);

  const getAgentProfile = useCallback((userId: string): AgentProfile | null => {
    return agentProfiles.find(profile => profile.userId === userId) || null;
  }, [agentProfiles]);

  // Search alerts
  const createSearchAlert = useCallback((data: Omit<SearchAlert, 'id' | 'createdAt'>): SearchAlert => {
    const alert: SearchAlert = {
      ...data,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setSearchAlerts(prev => [...prev, alert]);
    return alert;
  }, []);

  const updateSearchAlert = useCallback((id: string, updates: Partial<SearchAlert>) => {
    setSearchAlerts(prev =>
      prev.map(alert =>
        alert.id === id ? { ...alert, ...updates } : alert
      )
    );
  }, []);

  const deleteSearchAlert = useCallback((id: string) => {
    setSearchAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  const checkSearchAlerts = useCallback((newProperty: Property) => {
    // This would trigger notifications for matching alerts
    // For now, just update lastTriggered
    setSearchAlerts(prev =>
      prev.map(alert => {
        const matches =
          (alert.type === 'ALL' || alert.type === newProperty.type) &&
          (!alert.filters.minPrice || newProperty.price >= alert.filters.minPrice) &&
          (!alert.filters.maxPrice || newProperty.price <= alert.filters.maxPrice) &&
          (!alert.filters.minArea || (newProperty.area ?? 0) >= alert.filters.minArea);

        if (matches && alert.active) {
          return { ...alert, lastTriggered: new Date().toISOString() };
        }
        return alert;
      })
    );
  }, []);

  // Premium listings
  const createPremiumListing = useCallback((propertyId: string, plan: 'BASIC' | 'FEATURED' | 'PREMIUM'): PremiumListing => {
    const plans = {
      BASIC: { price: 5000, features: ['highlighted'] },
      FEATURED: { price: 15000, features: ['highlighted', 'top_search'] },
      PREMIUM: { price: 25000, features: ['highlighted', 'top_search', 'analytics'] },
    };

    const planData = plans[plan];
    const listing: PremiumListing = {
      propertyId,
      plan,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      price: planData.price,
      features: planData.features,
    };

    setPremiumListings(prev => [...prev, listing]);
    return listing;
  }, []);

  const getPremiumFeatures = useCallback((propertyId: string): string[] => {
    const listing = premiumListings.find(p => p.propertyId === propertyId);
    return listing?.features || [];
  }, [premiumListings]);

  const isPremium = useCallback((propertyId: string): boolean => {
    return premiumListings.some(p => p.propertyId === propertyId);
  }, [premiumListings]);

  // Commission system
  const createCommissionRule = useCallback((data: Omit<CommissionRule, 'id'>): CommissionRule => {
    const rule: CommissionRule = {
      ...data,
      id: Date.now().toString(),
    };
    setCommissionRules(prev => [...prev, rule]);
    return rule;
  }, []);

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
  const createTransaction = useCallback((data: Omit<Transaction, 'id' | 'createdAt'>): Transaction => {
    const transaction: Transaction = {
      ...data,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setTransactions(prev => [...prev, transaction]);
    return transaction;
  }, []);

  const updateTransactionStatus = useCallback((id: string, status: Transaction['status']) => {
    setTransactions(prev =>
      prev.map(t =>
        t.id === id
          ? {
              ...t,
              status,
              completedAt: status === 'COMPLETED' ? new Date().toISOString() : t.completedAt
            }
          : t
      )
    );
  }, []);

  // Documents
  const addDocument = useCallback((data: Omit<Document, 'id' | 'uploadedAt'>): Document => {
    if (!currentUser) throw new Error('User not logged in');

    const document: Document = {
      ...data,
      id: Date.now().toString(),
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentUser.id,
    };
    setDocuments(prev => [...prev, document]);
    return document;
  }, [currentUser]);

  const getPropertyDocuments = useCallback((propertyId: string): Document[] => {
    return documents.filter(d => d.propertyId === propertyId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }, [documents]);

  // Mortgage calculator
  const calculateMortgage = useCallback((data: Omit<MortgageCalculator, 'monthlyPayment' | 'totalPayment' | 'totalInterest'>): MortgageCalculator => {
    const { propertyPrice, downPayment, interestRate, loanTerm } = data;
    const loanAmount = propertyPrice - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = loanTerm * 12;

    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
                          (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

    const totalPayment = monthlyPayment * numberOfPayments;
    const totalInterest = totalPayment - loanAmount;

    return {
      ...data,
      monthlyPayment,
      totalPayment,
      totalInterest,
    };
  }, []);

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
        logoutUser,
        verifyUser,
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
        calculateCommission,
        createTransaction,
        updateTransactionStatus,
        addDocument,
        getPropertyDocuments,
        calculateMortgage,
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
