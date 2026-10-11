import { cache } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { formatCurrency } from '../../../lib/format';

type PublicProperty = {
  id: string;
  title: string;
  type: 'house' | 'apartment' | 'land' | 'shop';
  price: number;
  location: string;
  neighborhood: string | null;
  description: string | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  property_images: { url: string | null }[] | null;
};

const publicPropertyTypes: Record<PublicProperty['type'], string> = {
  house: 'Maison',
  apartment: 'Appartement',
  land: 'Terrain',
  shop: 'Boutique',
};

const getPublicProperty = cache(async (id: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Public property pages require the Supabase URL and anon key.');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('properties')
    .select('id,title,type,price,location,neighborhood,description,area,bedrooms,bathrooms,property_images(url)')
    .eq('id', id)
    .eq('listing_status', 'approved')
    .eq('status', 'available')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle();

  if (error) throw error;
  return (data as PublicProperty | null) ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const property = await getPublicProperty(id);
  if (!property) return { title: 'Annonce indisponible | Imo Nord Togo' };

  const images = property.property_images?.flatMap(image => image.url ? [image.url] : []) ?? [];
  const description = property.description?.slice(0, 160) ?? `${property.type} à ${property.location}`;
  return {
    title: `${property.title} | Imo Nord Togo`,
    description,
    openGraph: {
      title: property.title,
      description,
      url: `https://imo-nord-togo-mobile.vercel.app/property/${encodeURIComponent(id)}`,
      images,
    },
  };
}

export default async function PublicPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await getPublicProperty(id);
  if (!property) notFound();

  const images = property.property_images?.flatMap(image => image.url ? [image.url] : []) ?? [];
  const location = [property.neighborhood, property.location].filter(Boolean).join(', ');
  const appLink = `imonordtogo://property/${encodeURIComponent(property.id)}`;

  return (
    <main className="public-property">
      <header className="public-property-header">
        <Link href="/privacy" className="public-property-brand">Imo Nord Togo</Link>
        <a className="public-property-open-app" href={appLink}>Ouvrir dans l’application</a>
      </header>
      <article className="public-property-card">
        {images[0] ? (
          <Image
            className="public-property-cover"
            src={images[0]}
            alt={property.title}
            width={1200}
            height={800}
            priority
            unoptimized
          />
        ) : (
          <div className="public-property-cover-placeholder">Imo Nord Togo</div>
        )}
        <div className="public-property-content">
          <p className="public-property-eyebrow">{publicPropertyTypes[property.type]} · {location}</p>
          <h1>{property.title}</h1>
          <p className="public-property-price">{formatCurrency(property.price)}</p>
          <dl className="public-property-facts">
            {property.area != null && <div><dt>Surface</dt><dd>{property.area} m²</dd></div>}
            {property.bedrooms != null && <div><dt>Chambres</dt><dd>{property.bedrooms}</dd></div>}
            {property.bathrooms != null && <div><dt>Salles de bain</dt><dd>{property.bathrooms}</dd></div>}
          </dl>
          {property.description && (
            <section className="public-property-description">
              <h2>Description</h2>
              <p>{property.description}</p>
            </section>
          )}
          {images.length > 1 && (
            <div className="public-property-gallery" aria-label="Photos du bien">
              {images.slice(1).map((image, index) => (
                <Image
                  key={`${image}-${index}`}
                  src={image}
                  alt={`${property.title} - photo ${index + 2}`}
                  width={360}
                  height={240}
                  unoptimized
                />
              ))}
            </div>
          )}
        </div>
      </article>
      <footer className="public-property-footer">
        <Link href="/privacy">Confidentialité</Link>
        <span>Les disponibilités peuvent évoluer.</span>
      </footer>
    </main>
  );
}
