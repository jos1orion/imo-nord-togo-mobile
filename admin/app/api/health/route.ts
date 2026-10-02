import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const isSchemaError = (code?: string) =>
  code === '42703' || code === '42P01' || code === 'PGRST200' || code === 'PGRST204';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { status: 'degraded', supabase: 'not_configured' },
      { status: 503 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [profileCheck, propertyCheck] = await Promise.all([
    supabase.from('profiles').select('id, role, account_status').limit(0),
    supabase
      .from('properties')
      .select('id, city, client_id, listing_status, contact_name, contact_phone, contact_email')
      .limit(0),
  ]);

  if (profileCheck.error || propertyCheck.error) {
    const schemaIncomplete =
      isSchemaError(profileCheck.error?.code) || isSchemaError(propertyCheck.error?.code);
    return NextResponse.json(
      {
        status: 'degraded',
        supabase: 'reachable',
        schema: schemaIncomplete ? 'incomplete' : 'unknown',
        checks: {
          profiles: profileCheck.error
            ? isSchemaError(profileCheck.error.code)
              ? 'migration_required'
              : 'query_error'
            : 'ok',
          properties: propertyCheck.error
            ? isSchemaError(propertyCheck.error.code)
              ? 'migration_required'
              : 'query_error'
            : 'ok',
        },
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: 'ok',
    supabase: 'connected',
    schema: 'ready',
    timestamp: new Date().toISOString(),
  });
}
