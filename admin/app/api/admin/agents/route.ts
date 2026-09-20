import { NextResponse } from 'next/server';
import { isValidUuid, recordAdminAction, requireAdmin } from '../../../../lib/adminApiAuth';

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ('error' in guard) return guard.error;
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const status = url.searchParams.get('status');

  let profileQuery = guard.supabaseAdmin
    .from('profiles')
    .select('id,full_name,phone,role,agent_status,agent_rejection_reason,created_at')
    .neq('agent_status', 'none');
  if (status && ['pending', 'approved', 'rejected'].includes(status)) profileQuery = profileQuery.eq('agent_status', status);
  const { data: profiles, error } = await profileQuery.order('created_at', { ascending: false }).range(from, to);

  if (error) {
    console.error('Admin agents list failed', error.message);
    return NextResponse.json({ error: 'Liste des demandes impossible à charger.' }, { status: 500 });
  }

  const { data: authData, error: authError } = await guard.supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) {
    console.error('Admin agent emails failed', authError.message);
    return NextResponse.json({ error: 'Liste des demandes impossible à charger.' }, { status: 500 });
  }
  let countQuery = guard.supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .neq('agent_status', 'none');
  if (status && ['pending', 'approved', 'rejected'].includes(status)) countQuery = countQuery.eq('agent_status', status);
  const { count, error: countError } = await countQuery;
  if (countError) {
    return NextResponse.json({ error: 'Liste des demandes impossible à charger.' }, { status: 500 });
  }

  const authUsers = new Map(
    (authData.users ?? []).map(user => [
      user.id,
      {
        email: user.email ?? null,
        auth_created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
      },
    ])
  );
  return NextResponse.json({
    agents: (profiles ?? []).map(profile => ({
      ...profile,
      ...(authUsers.get(profile.id) ?? { email: null, auth_created_at: null, last_sign_in_at: null }),
    })),
    total: count ?? 0,
    page,
    pageSize,
  });
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if ('error' in guard) return guard.error;

  let payload: { ids?: unknown; status?: unknown };
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
    }
    payload = parsed as { ids?: unknown; status?: unknown };
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });
  }

  const ids = Array.isArray(payload.ids) ? payload.ids : [];
  if (ids.length === 0 || ids.length > 100 || ids.some(id => typeof id !== 'string' || !isValidUuid(id))) {
    return NextResponse.json({ error: 'Liste d’agents invalide.' }, { status: 400 });
  }
  if (payload.status !== 'approved') {
    return NextResponse.json({ error: 'Seule l’approbation groupée est disponible.' }, { status: 400 });
  }

  const { data, error } = await guard.supabaseAdmin
    .from('profiles')
    .update({ agent_status: 'approved', agent_rejection_reason: null, role: 'AGENT' })
    .in('id', ids)
    .neq('agent_status', 'approved')
    .select('id');
  if (error) {
    console.error('Admin bulk agent approval failed', error.message);
    return NextResponse.json({ error: 'Approbation groupée impossible.' }, { status: 400 });
  }

  await Promise.all(
    (data ?? []).map(agent =>
      recordAdminAction(guard.supabaseAdmin, guard.authUserId, 'approve_agent', 'agent', agent.id),
    ),
  );
  return NextResponse.json({ success: true, count: data?.length ?? 0 });
}
