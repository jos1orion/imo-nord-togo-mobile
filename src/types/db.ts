import type {
  ListingStatus,
  PropertyStatus,
  PropertyType,
  ReportReason,
  Message,
  Transaction,
  Document,
} from './index';

export interface PropertyRow {
  id: string;
  owner_id: string | null;
  title: string | null;
  description: string | null;
  type: PropertyType;
  price: number | string | null;
  location: string | null;
  neighborhood: string | null;
  area: number | null;
  latitude: number | null;
  longitude: number | null;
  property_images?: { url: string | null }[] | null;
  status: PropertyStatus | string | null;
  listing_status: ListingStatus | string | null;
  amenities: string[] | null;
  bedrooms: number | null;
  bathrooms: number | null;
  featured: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  expires_at: string | null;
  sold_at: string | null;
  rented_at: string | null;
  completion_type?: string | null;
  featured_start_at: string | null;
  featured_end_at: string | null;
  republished_at: string | null;
  client_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

export interface MessageRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  property_id: string | null;
  content: string | null;
  created_at: string | null;
  read: boolean | null;
  type: Message['type'] | null;
}

export interface ReviewRow {
  id: string;
  property_id: string;
  user_id: string | null;
  reviewer_name: string | null;
  rating: number | string | null;
  comment: string | null;
  created_at: string | null;
  verified: boolean | null;
}

export interface ReportRow {
  id: string;
  property_id: string;
  reason: ReportReason;
  message: string | null;
  status: 'OPEN' | 'RESOLVED' | string | null;
  created_at: string | null;
}

export interface AgentProfileRow {
  user_id: string;
  bio: string;
  specialties: PropertyType[];
  experience: number;
  license_number: string | null;
  company: string | null;
  portfolio: string[];
  verified: boolean;
  rating: number | string;
  review_count: number;
  total_sales: number;
  total_commission: number | string;
}

export interface SearchAlertRow {
  id: string;
  user_id: string;
  label: string;
  filters: Record<string, unknown>;
  property_type: PropertyType | 'ALL';
  active: boolean;
  last_triggered: string | null;
  created_at: string;
}

export interface PremiumListingRow {
  property_id: string;
  plan: 'BASIC' | 'FEATURED' | 'PREMIUM';
  start_date: string;
  end_date: string;
  price: number | string;
  features: string[];
}

export interface CommissionRuleRow {
  id: string;
  agent_id: string;
  property_type: PropertyType | 'ALL';
  percentage: number | string;
  min_amount: number | string;
  max_amount: number | string;
  active: boolean;
}

export interface TransactionRow {
  id: string;
  property_id: string;
  buyer_id: string;
  seller_id: string;
  agent_id: string | null;
  amount: number | string;
  commission: number | string | null;
  status: Transaction['status'];
  created_at: string;
  completed_at: string | null;
}

export interface PropertyDocumentRow {
  id: string;
  property_id: string;
  name: string;
  type: Document['type'];
  url: string;
  uploaded_by: string;
  uploaded_at: string;
}
