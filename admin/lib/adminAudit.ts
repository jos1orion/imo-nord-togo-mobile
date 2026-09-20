import { supabase } from './supabaseClient';

export async function logAdminAction(
  action: string,
  entity: string,
  entityId?: string,
): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;

  const { error } = await supabase.from('activity_logs').insert({
    actor_id: data.user.id,
    actor_name: data.user.user_metadata?.name ?? data.user.email ?? null,
    action,
    entity,
    entity_id: entityId ?? null,
  });
  if (error) {
    console.error('Admin audit log failed', error.message);
  }
}
