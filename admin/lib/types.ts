export type PropertyStatus = 'available' | 'occupied';
export type ListingStatus = 'pending' | 'approved' | 'rejected' | 'archived';
export type PropertyType = 'house' | 'land' | 'apartment' | 'shop';

export type TenantDocumentType = 'cni' | 'contract' | 'other';

export type ContractStatus = 'active' | 'expired';

export type PaymentMethod = 'cash' | 'mobile_money';
export type PaymentStatus = 'paid' | 'late' | 'pending';

export type Property = {
  id: string;
  title: string;
  type: PropertyType;
  price: number;
  location: string;
  neighborhood: string | null;
  description: string | null;
  status: PropertyStatus;
  listing_status: ListingStatus;
  featured?: boolean;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
};

export type Neighborhood = {
  id: string;
  name: string;
  created_at: string;
};

export type Tenant = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
};

export type Contract = {
  id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  status: ContractStatus;
  created_at: string;
};

export type Payment = {
  id: string;
  contract_id: string;
  amount: number;
  paid_at: string;
  method: PaymentMethod;
  status: PaymentStatus;
  created_at: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
};

