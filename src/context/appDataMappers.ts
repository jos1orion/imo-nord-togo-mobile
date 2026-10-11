import type {
  AgentProfile,
  CommissionRule,
  Document,
  ListingStatus,
  Message,
  PremiumListing,
  Property,
  Report,
  ReportReason,
  Review,
  SearchAlert,
  Transaction,
} from '../types';
import type {
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

const LISTING_STATUSES: ListingStatus[] = ['pending', 'approved', 'rejected', 'archived'];

export const normalizeNeighborhoods = (
  values: (string | null | undefined)[]
): string[] => {
  const map = new Map<string, string>();
  values.forEach(value => {
    const cleaned = value?.trim();
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (!map.has(key)) map.set(key, cleaned);
  });
  return Array.from(map.values());
};

export const extractMissingPropertiesColumn = (message?: string): string | null => {
  if (!message) return null;
  const match = message.match(/Could not find the '([^']+)' column of 'properties'/i);
  return match?.[1] ?? null;
};

export const dedupeProperties = (items: Property[]): Property[] => {
  const map = new Map<string, Property>();
  items.forEach(item => {
    if (item?.id) map.set(item.id, item);
  });
  return Array.from(map.values());
};

export const mapPropertyRow = (row: PropertyRow): Property => {
  const isValidImage = (value: string | null | undefined): value is string =>
    typeof value === 'string' && value.trim().length > 0 && value !== 'null';
  const images = Array.isArray(row.property_images)
    ? row.property_images.map(image => image.url).filter(isValidImage)
    : [];
  const listingStatus = LISTING_STATUSES.find(status => status === row.listing_status) ?? 'pending';
  const createdAt = row.created_at ?? new Date().toISOString();

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
    listingStatus,
    amenities: Array.isArray(row.amenities)
      ? row.amenities.filter((item): item is string => typeof item === 'string')
      : [],
    bedrooms: row.bedrooms ?? undefined,
    bathrooms: row.bathrooms ?? undefined,
    featured: row.featured ?? false,
    createdAt,
    updatedAt: row.updated_at ?? createdAt,
    submittedAt: row.submitted_at ?? null,
    approvedAt: row.approved_at ?? null,
    publishedAt: row.published_at ?? null,
    expiresAt: row.expires_at ?? null,
    soldAt: row.sold_at ?? null,
    rentedAt: row.rented_at ?? null,
    completionType:
      row.completion_type === 'sold' || row.completion_type === 'rented'
        ? row.completion_type
        : null,
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
            createdAt,
          }
        : undefined,
    contactName: row.contact_name ?? null,
    contactPhone: row.contact_phone ?? null,
    contactEmail: row.contact_email ?? null,
  };
};

export const mapMessageRow = (row: MessageRow): Message => ({
  id: row.id,
  senderId: row.sender_id,
  receiverId: row.receiver_id,
  propertyId: row.property_id ?? undefined,
  content: row.content ?? '',
  timestamp: row.created_at ?? new Date().toISOString(),
  read: row.read ?? false,
  type: (row.type as Message['type']) ?? 'text',
});

export const mapReviewRow = (row: ReviewRow): Review => ({
  id: row.id,
  propertyId: row.property_id,
  reviewerId: row.user_id ?? '',
  reviewerName: row.reviewer_name ?? 'Utilisateur',
  rating: Number(row.rating ?? 0),
  comment: row.comment ?? '',
  createdAt: row.created_at ?? new Date().toISOString(),
  verified: row.verified ?? false,
});

export const mapReportRow = (row: ReportRow): Report => ({
  id: row.id,
  propertyId: row.property_id,
  reason: row.reason as ReportReason,
  message: row.message ?? '',
  status: row.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN',
  createdAt: row.created_at ?? new Date().toISOString(),
});

export const mapAgentProfileRow = (row: AgentProfileRow): AgentProfile => ({
  userId: row.user_id,
  bio: row.bio,
  specialties: row.specialties,
  experience: row.experience,
  licenseNumber: row.license_number ?? undefined,
  company: row.company ?? undefined,
  portfolio: row.portfolio,
  verified: row.verified,
  rating: Number(row.rating),
  reviewCount: row.review_count,
  totalSales: row.total_sales,
  totalCommission: Number(row.total_commission),
});

export const mapSearchAlertRow = (row: SearchAlertRow): SearchAlert => ({
  id: row.id,
  userId: row.user_id,
  label: row.label,
  filters: {
    minPrice: typeof row.filters.minPrice === 'number' ? row.filters.minPrice : null,
    maxPrice: typeof row.filters.maxPrice === 'number' ? row.filters.maxPrice : null,
    minBedrooms: typeof row.filters.minBedrooms === 'number' ? row.filters.minBedrooms : null,
    minBathrooms: typeof row.filters.minBathrooms === 'number' ? row.filters.minBathrooms : null,
    minArea: typeof row.filters.minArea === 'number' ? row.filters.minArea : null,
  },
  type: row.property_type,
  active: row.active,
  lastTriggered: row.last_triggered ?? undefined,
  createdAt: row.created_at,
});

export const mapPremiumListingRow = (row: PremiumListingRow): PremiumListing => ({
  propertyId: row.property_id,
  plan: row.plan,
  startDate: row.start_date,
  endDate: row.end_date,
  price: Number(row.price),
  features: row.features,
});

export const mapCommissionRuleRow = (row: CommissionRuleRow): CommissionRule => ({
  id: row.id,
  agentId: row.agent_id,
  propertyType: row.property_type,
  percentage: Number(row.percentage),
  minAmount: Number(row.min_amount),
  maxAmount: Number(row.max_amount),
  active: row.active,
});

export const mapTransactionRow = (row: TransactionRow): Transaction => ({
  id: row.id,
  propertyId: row.property_id,
  buyerId: row.buyer_id,
  sellerId: row.seller_id,
  agentId: row.agent_id ?? undefined,
  amount: Number(row.amount),
  commission: row.commission === null ? undefined : Number(row.commission),
  status: row.status,
  createdAt: row.created_at,
  completedAt: row.completed_at ?? undefined,
});

export const mapPropertyDocumentRow = (row: PropertyDocumentRow): Document => ({
  id: row.id,
  propertyId: row.property_id,
  name: row.name,
  type: row.type,
  url: row.url,
  uploadedBy: row.uploaded_by,
  uploadedAt: row.uploaded_at,
});
