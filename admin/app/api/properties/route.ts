import { NextResponse } from 'next/server';
import { properties } from '../../../lib/mock-data';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Cette route de démonstration est désactivée en production.' }, { status: 503 });
  }
  return NextResponse.json(properties);
}
