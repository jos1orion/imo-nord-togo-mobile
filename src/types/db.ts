import type {
  ListingStatus,
  PropertyStatus,
  PropertyType,
  ReportReason,
  Message,
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
