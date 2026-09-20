import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/adminApiAuth';

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ('error' in guard) return guard.error;
  const { supabaseAdmin } = guard;
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [{ data: profiles, error: profilesError }, { data: authData, error: authError }] =
    await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id,full_name,phone,role,agent_status,created_at')
        .order('created_at', { ascending: false })
        .range(from, to),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

  if (profilesError || authError) {
    console.error('Admin users list failed', {
      profilesError: profilesError?.message,
      authError: authError?.message,
    });
    return NextResponse.json({ error: 'Liste des utilisateurs impossible à charger.' }, { status: 500 });
  }

  const emails = new Map((authData.users ?? []).map(user => [user.id, user.email ?? null]));
  const { count, error: countError } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  if (countError) {
    return NextResponse.json({ error: 'Liste des utilisateurs impossible à charger.' }, { status: 500 });
  }
  return NextResponse.json({
    users: (profiles ?? []).map(profile => ({
      ...profile,
      email: emails.get(profile.id) ?? null,
    })),
    total: count ?? 0,
    page,
    pageSize,
  });
}
