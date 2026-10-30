import type { Language, TranslationKey } from '../i18n';
import type { ThemeMode } from '../theme/colors';
import type {
  Property, PropertyCompletionType, Client, PropertyType, PropertyStatus,
  SearchFilters, SavedSearch, Report, PropertyStats, ReportReason, User, Message, Chat,
  Review, AgentProfile, SearchAlert, PremiumListing, CommissionRule, Transaction, Document,
  Contract, Payment, TenantDocument, AppNotification,
} from '../types';

export type SmartGuideMode = 'discovery' | 'normal' | 'expert';

export interface AppContextType {
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
  loadAdminOperationalData: () => Promise<void>;
  propertyStats: Record<string, PropertyStats>;
  myPropertyIds: string[];
  visitorCount: number;
  privacySettings: { hideContact: boolean; hideListings: boolean };
  language: Language;
  setLanguage: (language: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
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
  // Profile completion
  updateProfile: (updates: Partial<Pick<User, 'name' | 'phone'>> & { photoUri?: string }) => Promise<void>;
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
  onboardingProgress: Record<string, boolean>; // Track user progression through SmartGuide walkthroughs
  updateOnboardingProgress: (key: string, value: boolean) => void; // Update user progression state
  getOnboardingProgress: () => Record<string, boolean>; // Retrieve user progression state
  smartGuideMode: SmartGuideMode;
  setSmartGuideMode: (mode: SmartGuideMode) => void;
  smartGuideEnabled: boolean;
  setSmartGuideEnabled: (enabled: boolean) => void;
}
