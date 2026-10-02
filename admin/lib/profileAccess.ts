import type { SupabaseClient } from '@supabase/supabase-js';

export type StaffProfileAccess = {
  role: string | null;
  account_status?: string | null;
};

const isMissingAccountStatusColumn = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes('account_status') &&
    (normalized.includes('does not exist') || normalized.includes('schema cache'));
};

export const fetchStaffProfileAccess = async (
  supabase: SupabaseClient,
  userId: string
) => {
  const initial = await supabase
    .from('profiles')
    .select('role, account_status')
    .eq('id', userId)
    .maybeSingle();

  if (!initial.error || !isMissingAccountStatusColumn(initial.error.message)) {
    return {
      data: initial.data as StaffProfileAccess | null,
      error: initial.error,
    };
  }

  const fallback = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  return {
    data: fallback.data as StaffProfileAccess | null,
    error: fallback.error,
  };
};
