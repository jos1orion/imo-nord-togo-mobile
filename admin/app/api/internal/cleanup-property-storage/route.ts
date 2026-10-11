import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { chunkStoragePaths, getPropertyImageStoragePaths } from '../../../../../src/utils/propertyStorage';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CleanupJob = {
  id: string;
  property_id: string;
  image_urls: string[];
  attempts: number;
};

const hasValidSecret = (provided: string | null, expected: string | undefined): boolean => {
  if (!provided || !expected) return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
};

export async function POST(request: Request) {
  const secret = process.env.PROPERTY_STORAGE_CLEANUP_SECRET;
  if (!secret) {
    console.error('Property storage cleanup secret is not configured.');
    return NextResponse.json({ error: 'Cleanup worker is not configured.' }, { status: 503 });
  }
  if (!hasValidSecret(request.headers.get('x-cleanup-secret'), secret)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  let supabaseAdmin: SupabaseClient;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    console.error('Property storage cleanup Supabase configuration is invalid.', error);
    return NextResponse.json({ error: 'Cleanup worker is not configured.' }, { status: 503 });
  }

  const { data, error: claimError } = await supabaseAdmin.rpc(
    'claim_property_storage_cleanup_jobs',
    { p_limit: 50 }
  );
  if (claimError) {
    console.error('Unable to claim property storage cleanup jobs.', claimError.message);
    return NextResponse.json({ error: 'Unable to claim cleanup jobs.' }, { status: 500 });
  }

  const jobs = (data ?? []) as CleanupJob[];
  let completed = 0;
  const failures: string[] = [];

  for (const job of jobs) {
    try {
      const paths = getPropertyImageStoragePaths(
        job.image_urls,
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
      );
      if (paths.some(path => path.split('/')[1] !== job.property_id)) {
        throw new Error('Property image path does not belong to its cleanup job.');
      }

      for (const batch of chunkStoragePaths(paths)) {
        const { error: removeError } = await supabaseAdmin.storage
          .from('property-images')
          .remove(batch);
        if (removeError) throw removeError;
      }

      const { error: updateError } = await supabaseAdmin
        .from('property_storage_cleanup_jobs')
        .update({
          status: 'completed',
          image_urls: [],
          processing_at: null,
          completed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', job.id);
      if (updateError) throw updateError;
      completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Property storage cleanup failed for job ${job.id}.`, error);
      const { error: updateError } = await supabaseAdmin
        .from('property_storage_cleanup_jobs')
        .update({
          status: 'pending',
          processing_at: null,
          last_error: message.slice(0, 2000),
        })
        .eq('id', job.id);
      if (updateError) {
        console.error(`Unable to requeue property storage cleanup job ${job.id}.`, updateError.message);
      }
      failures.push(job.id);
    }
  }

  return NextResponse.json(
    { claimed: jobs.length, completed, failed: failures },
    { status: failures.length ? 500 : 200 }
  );
}
