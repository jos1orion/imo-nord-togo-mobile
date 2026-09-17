import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(request: Request) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Configuration serveur incomplète.';
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const payload = await request.json();
  const { email, password, full_name, role, phone } = payload ?? {};

  if (!email || !password || !role) {
    return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 });
  }

  if (!['ADMIN', 'AGENT', 'ACCOUNTANT'].includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? 'Création impossible.' }, { status: 400 });
  }

  // The database may already create a USER profile through an auth trigger.
  // Upsert keeps account creation idempotent and applies the role selected by the admin.
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: data.user.id,
    full_name: full_name ?? null,
    phone: phone ?? null,
    role,
  }, { onConflict: 'id' });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, userId: data.user.id });
}
