import { supabase } from './supabaseClient';

export async function logActivity(action: string, entity: string, entityId?: string | null) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Impossible de vérifier la session admin : ${authError.message}`);
  if (!auth.user) throw new Error('Aucun administrateur connecté pour journaliser cette action.');

  const { error } = await supabase.from('activity_logs').insert({
    actor_id: auth.user.id,
    actor_name: auth.user.email ?? auth.user.id,
    action,
    entity,
    entity_id: entityId ?? null,
  });
  if (error) throw new Error(`Impossible d’enregistrer l’activité admin : ${error.message}`);
}
