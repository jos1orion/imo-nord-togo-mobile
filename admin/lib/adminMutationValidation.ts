const updateFields: Record<string, Record<string, (value: unknown) => boolean>> = {
  properties: {
    title: value => isString(value, 200),
    type: value => isOneOf(value, ['house', 'apartment', 'land', 'shop']),
    price: value => typeof value === 'number' && Number.isFinite(value) && value > 0,
    location: value => isString(value, 200),
    neighborhood: value => value === null || isString(value, 200),
    description: value => value === null || isString(value, 10000),
    status: value => isOneOf(value, ['available', 'occupied']),
    listing_status: value => isOneOf(value, ['pending', 'approved', 'rejected', 'archived']),
    featured: value => typeof value === 'boolean',
  },
  tenants: {
    full_name: value => isString(value, 200),
    phone: value => value === null || isString(value, 40),
    email: value => value === null || isString(value, 254),
    notes: value => value === null || isString(value, 10000),
  },
  contracts: {
    property_id: isUuid,
    tenant_id: isUuid,
    start_date: isDate,
    end_date: isDate,
    rent_amount: value => typeof value === 'number' && Number.isFinite(value) && value > 0,
    status: value => isOneOf(value, ['active', 'expired']),
  },
  payments: {
    contract_id: isUuid,
    amount: value => typeof value === 'number' && Number.isFinite(value) && value > 0,
    paid_at: isDate,
    method: value => isOneOf(value, ['cash', 'mobile_money']),
    status: value => isOneOf(value, ['paid', 'late', 'pending']),
  },
  neighborhoods: {
    name: value => isString(value, 120),
  },
  profiles: {
    account_status: value => isOneOf(value, ['active', 'suspended', 'pending']),
  },
  reviews: {
    verified: value => typeof value === 'boolean',
  },
  property_reports: {
    status: value => isOneOf(value, ['OPEN', 'RESOLVED']),
  },
  notifications: {
    read: value => typeof value === 'boolean',
  },
};

export const deletableEntities = new Set([
  'properties',
  'tenants',
  'contracts',
  'payments',
  'neighborhoods',
]);

export function validateAdminUpdates(
  entity: string,
  updates: unknown
): Record<string, unknown> | null {
  const fields = updateFields[entity];
  if (!fields || !updates || typeof updates !== 'object' || Array.isArray(updates)) return null;

  const entries = Object.entries(updates);
  if (!entries.length) return null;
  if (entries.some(([key, value]) => !fields[key] || !fields[key](value))) return null;
  return Object.fromEntries(entries);
}

function isString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function isOneOf(value: unknown, options: readonly string[]): boolean {
  return typeof value === 'string' && options.includes(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
