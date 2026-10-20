import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

const confirmationMessage =
  'Votre demande a été reçue. L’équipe vérifiera votre identité avant de traiter la suppression. Cette demande ne supprime pas immédiatement votre compte.';

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Formulaire invalide.' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Formulaire invalide.' }, { status: 400 });
  }

  const fields = payload as Record<string, unknown>;
  if (typeof fields.website === 'string' && fields.website.trim()) {
    return NextResponse.json({ success: true, message: confirmationMessage }, { status: 202 });
  }

  const email = typeof fields.email === 'string' ? fields.email.trim().toLowerCase() : '';
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return NextResponse.json({ error: 'Saisissez une adresse e-mail valide.' }, { status: 400 });
  }

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    console.error(
      'Account deletion request storage is unavailable.',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: 'Le formulaire est momentanément indisponible. Réessayez plus tard.' },
      { status: 503 }
    );
  }

  const { error } = await supabaseAdmin
    .from('account_deletion_requests')
    .insert({ email });

  if (error?.code === '23505') {
    return NextResponse.json({ success: true, message: confirmationMessage }, { status: 202 });
  }
  if (error) {
    console.error('Account deletion request insert failed.', error.message);
    return NextResponse.json(
      { error: 'Impossible d’enregistrer la demande. Réessayez plus tard.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: confirmationMessage }, { status: 202 });
}
