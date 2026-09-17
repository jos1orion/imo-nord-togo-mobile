// Types pour l'application Imo Nord Togo

export type PropertyType = 'house' | 'apartment' | 'land' | 'shop';

export type PropertyStatus = 'available' | 'occupied';
export type ListingStatus = 'pending' | 'approved' | 'rejected' | 'archived';

export interface Property {
  id: string;
  ownerId?: string | null;
  title: string;
  description: string;
  type: PropertyType;
  price: number;
  location: string;
  neighborhood?: string | null;
  city: string;
  area?: number;
  latitude?: number;
  longitude?: number;
  images: string[];
  status: PropertyStatus;
  listingStatus?: ListingStatus;
  amenities: string[];
  bedrooms?: number;
  bathrooms?: number;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  soldAt?: string | null;
  rentedAt?: string | null;
  featuredStartAt?: string | null;
  featuredEndAt?: string | null;
  republishedAt?: string | null;
  clientId: string;
  client?: Client;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

export interface Contract {
  id: string;
  propertyId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  status: 'active' | 'expired';
  createdAt: string;
}

export interface Payment {
  id: string;
  contractId: string;
  amount: number;
  paidAt: string;
  method: 'cash' | 'mobile_money';
  status: 'paid' | 'late' | 'pending';
  createdAt: string;
}

export interface TenantDocument {
  id: string;
  tenantId: string;
  type: 'cni' | 'contract' | 'other';
  url: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
  verified: boolean;
  isAdmin?: boolean;
  createdAt?: string;
}

export interface SearchFilters {
  minPrice: number | null;
  maxPrice: number | null;
  minBedrooms: number | null;
  minBathrooms: number | null;
  minArea: number | null;
}

export interface SavedSearch {
  id: string;
  label: string;
  query: string;
  type: PropertyType | 'ALL';
  filters: SearchFilters;
  createdAt: string;
}

export type ReportReason = 'FRAUD' | 'DUPLICATE' | 'INAPPROPRIATE' | 'OTHER';

export interface Report {
  id: string;
  propertyId: string;
  reason: ReportReason;
  message: string;
  createdAt: string;
  status: 'OPEN' | 'RESOLVED';
}

export interface PropertyStats {
  views: number;
  contacts: number;
  shares: number;
  likes: number;
}

export interface Stats {
  totalProperties: number;
  totalClients: number;
  pendingProperties: number;
  soldProperties: number;
  totalValue: number;
  propertiesByType: { type: PropertyType; count: number }[];
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  house: 'Maison',
  apartment: 'Appartement',
  land: 'Terrain',
  shop: 'Boutique',
};

export const PROPERTY_TYPE_COLORS: Record<PropertyType, string> = {
  house: '#10B981',
  apartment: '#3B82F6',
  land: '#F59E0B',
  shop: '#0EA5A4',
};

// New types for enhanced features
export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  propertyId?: string;
  content: string;
  timestamp: string;
  read: boolean;
  type: 'text' | 'image' | 'property_link';
}

export interface Chat {
  id: string;
  participants: string[]; // user IDs
  propertyId?: string;
  lastMessage?: Message;
  updatedAt: string;
  unreadCount: Record<string, number>; // userId -> count
}

export interface Review {
  id: string;
  propertyId: string;
  reviewerId: string;
  reviewerName: string;
  rating: number; // 1-5 stars
  comment: string;
  createdAt: string;
  verified: boolean; // from actual transaction
}

export interface AgentProfile {
  userId: string;
  bio: string;
  specialties: PropertyType[];
  experience: number; // years
  licenseNumber?: string;
  company?: string;
  portfolio: string[]; // property IDs
  rating: number;
  reviewCount: number;
  totalSales: number;
  totalCommission: number;
  verified: boolean;
}

export interface SearchAlert {
  id: string;
  userId: string;
  label: string;
  filters: SearchFilters;
  type: PropertyType | 'ALL';
  active: boolean;
  lastTriggered?: string;
  createdAt: string;
}

export interface PremiumListing {
  propertyId: string;
  plan: 'BASIC' | 'FEATURED' | 'PREMIUM';
  startDate: string;
  endDate: string;
  price: number;
  features: string[]; // 'highlighted', 'top_search', 'analytics', etc.
}

export interface CommissionRule {
  id: string;
  agentId: string;
  propertyType: PropertyType | 'ALL';
  percentage: number;
  minAmount: number;
  maxAmount: number;
  active: boolean;
}

export interface Transaction {
  id: string;
  propertyId: string;
  buyerId: string;
  sellerId: string;
  agentId?: string;
  amount: number;
  commission?: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  completedAt?: string;
}

export interface MortgageCalculator {
  propertyPrice: number;
  downPayment: number;
  interestRate: number;
  loanTerm: number; // years
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
}

export interface Document {
  id: string;
  propertyId: string;
  name: string;
  type: 'contract' | 'inspection' | 'permit' | 'other';
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

