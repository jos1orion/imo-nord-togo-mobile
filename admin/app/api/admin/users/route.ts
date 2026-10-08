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

  const [{ data: profiles, error: profilesError }, { count, error: countError }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id,full_name,phone,role,account_status,agent_status,agent_rejection_reason,created_at')
      .order('created_at', { ascending: false })
      .range(from, to),
    supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
  ]);

  if (profilesError || countError) {
    console.error('Admin users list failed', {
      profilesError: profilesError?.message,
      countError: countError?.message,
    });
    return NextResponse.json({ error: 'Liste des utilisateurs impossible à charger.' }, { status: 500 });
  }

  const authUsers: { id: string; email?: string; email_confirmed_at?: string | null }[] = [];
  for (let authPage = 1; ; authPage += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: authPage,
      perPage: 1000,
    });
    if (error) {
      console.error('Admin users auth lookup failed', error.message);
      return NextResponse.json({ error: 'Liste des utilisateurs impossible à charger.' }, { status: 500 });
    }
    const pageUsers = data.users ?? [];
    authUsers.push(...pageUsers);
    if (pageUsers.length < 1000) break;
  }

  const authUsersById = new Map(authUsers.map(user => [
    user.id,
    {
      email: user.email ?? null,
      verified: Boolean(user.email_confirmed_at),
    },
  ]));
  return NextResponse.json({
    users: (profiles ?? []).map(profile => ({
      ...profile,
      email: authUsersById.get(profile.id)?.email ?? null,
      verified: authUsersById.get(profile.id)?.verified ?? false,
    })),
    total: count ?? 0,
    page,
    pageSize,
  });
}
