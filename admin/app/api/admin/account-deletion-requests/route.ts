import { NextResponse } from 'next/server';
import { requireAdminApi } from '../../../../lib/adminApiAuth';

const requestStatuses = ['pending', 'in_progress', 'completed', 'rejected'] as const;

export async function GET(request: Request) {
  const guard = await requireAdminApi(request);
  if ('response' in guard) return guard.response;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 25));
  const requestedStatus = url.searchParams.get('status') ?? 'pending';
  const status = requestStatuses.includes(requestedStatus as (typeof requestStatuses)[number])
    ? requestedStatus
    : null;
  if (!status) {
    return NextResponse.json({ error: 'Filtre de statut invalide.' }, { status: 400 });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await guard.supabaseAdmin
    .from('account_deletion_requests')
    .select('id,email,status,created_at,updated_at,processed_at,processed_by', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Account deletion request list failed.', error.message);
    return NextResponse.json(
      { error: 'Impossible de charger les demandes de suppression.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ requests: data ?? [], total: count ?? 0, page, pageSize });
}
