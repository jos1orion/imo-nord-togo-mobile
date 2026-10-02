'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SectionHeader from '../../../../components/SectionHeader';
import { supabase } from '../../../../lib/supabaseClient';
import { formatCurrency, formatDate } from '../../../../lib/format';
import { logActivity } from '../../../../lib/logActivity';
import type { ListingEvent, ListingStatus, Property, PropertyStatus, Publication } from '../../../../lib/types';

type PropertyRow = Property & { property_images?: { url: string }[] };
type OwnerProfile = { id: string; full_name: string | null; phone: string | null };

const EVENT_LABELS: Record<string, string> = {
  submitted: 'Soumission',
  approved: 'Validation',
  published: 'Publication',
  featured: 'Featured',
  featured_end: 'Fin Featured',
  expired: 'Expiration',
  rejected: 'Rejet',
};

export default function PropertyDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = typeof params?.id === 'string' ? params.id : '';
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [events, setEvents] = useState<ListingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const cover = useMemo(() => property?.property_images?.[0]?.url ?? '', [property]);

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    const { data } = await supabase.from('properties').select('*, property_images(url)').eq('id', propertyId).maybeSingle();
    setProperty((data as PropertyRow) ?? null);
    if (data?.owner_id) {
      const { data: profile } = await supabase.from('profiles').select('id, full_name, phone').eq('id', data.owner_id).maybeSingle();
      setOwner((profile as OwnerProfile) ?? null);
    } else {
      setOwner(null);
    }
    const [pubRes, eventRes] = await Promise.all([
      supabase.from('publications').select('*').eq('property_id', propertyId).order('created_at', { ascending: false }),
      supabase.from('listing_events').select('*').eq('property_id', propertyId).order('created_at', { ascending: true }),
    ]);
    setPublications((pubRes.data as Publication[]) ?? []);
    setEvents((eventRes.data as ListingEvent[]) ?? []);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateListingStatus = async (nextStatus: ListingStatus) => {
    if (!property) return;
    const { error } = await supabase.from('properties').update({ listing_status: nextStatus }).eq('id', property.id);
    if (error) {
      alert(error.message);
      return;
    }
    try {
      await logActivity(nextStatus, 'property', property.id);
    } catch (error) {
      alert(
        `Statut modifié, mais le journal d’activité n’a pas été enregistré : ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`
      );
    }
    await load();
  };

  const updateAvailability = async (status: PropertyStatus) => {
    if (!property) return;
    const { error } = await supabase.from('properties').update({ status }).eq('id', property.id);
    if (error) {
      alert(error.message);
      return;
    }
    await load();
  };

  const toggleFeatured = async () => {
    if (!property) return;
    const { error } = await supabase.from('properties').update({ featured: !property.featured }).eq('id', property.id);
    if (error) {
      alert(error.message);
      return;
    }
    try {
      await logActivity(property.featured ? 'unfeature' : 'feature', 'property', property.id);
    } catch (error) {
      alert(
        `Bien mis à jour, mais le journal d’activité n’a pas été enregistré : ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`
      );
    }
    await load();
  };

  if (loading) return <div className="card">Chargement du bien...</div>;
  if (!property) {
    return (
      <div className="card">
        <div style={{ fontWeight: 600 }}>Bien introuvable</div>
        <button className="ghost-button" style={{ marginTop: 12 }} onClick={() => router.push('/properties')}>
          Retour aux biens
        </button>
      </div>
    );
  }

  return (
    <div className="grid">
      <SectionHeader
        title={property.title}
        subtitle={`${property.location}${property.neighborhood ? ` · ${property.neighborhood}` : ''}`}
        actions={
          <div className="pill-row">
            <div className={`status ${property.listing_status}`}>{property.listing_status}</div>
            <button className="ghost-button" onClick={() => router.push(`/properties?edit=${property.id}`)}>
              Modifier
            </button>
          </div>
        }
      />

      <div className="detail-grid">
        <div className="detail-left">
          <div className="card detail-card">
            <div className="detail-cover">
              {cover ? <img src={cover} alt={property.title} /> : <div className="detail-cover-empty">Aucune image</div>}
            </div>
            {property.property_images && property.property_images.length > 1 ? (
              <div className="detail-thumbs">
                {property.property_images.map(image => (
                  <img key={image.url} src={image.url} alt="" />
                ))}
              </div>
            ) : null}
            <div className="detail-info-grid" style={{ marginTop: 16 }}>
              <div><span>Statut</span><strong>{property.listing_status.toUpperCase()}</strong></div>
              <div><span>Agent</span><strong>{owner?.full_name || 'Non renseigné'}</strong></div>
              <div><span>Prix</span><strong>{formatCurrency(property.price)}</strong></div>
              <div><span>Quartier</span><strong>{property.neighborhood || property.location}</strong></div>
              <div><span>Publiée le</span><strong>{property.published_at ? formatDate(property.published_at) : '—'}</strong></div>
              <div><span>Expire le</span><strong>{property.expires_at ? formatDate(property.expires_at) : '—'}</strong></div>
            </div>
            <div className="detail-actions" style={{ marginTop: 16 }}>
              <button className="primary-button small" onClick={() => updateListingStatus('approved')}>Approuver</button>
              <button className="ghost-button small" onClick={() => updateListingStatus('rejected')}>Rejeter</button>
              <button className="ghost-button small" onClick={() => router.push(`/properties?edit=${property.id}`)}>Modifier</button>
              <button className="ghost-button small" onClick={toggleFeatured}>
                {property.featured ? 'Retirer Featured' : 'Mettre Featured'}
              </button>
              <button className="ghost-button small" onClick={() => updateAvailability('occupied')}>Marquer occupé</button>
            </div>
          </div>

          <div className="card">
            <div className="detail-section-title">Publications (cycles 30 jours)</div>
            {publications.length === 0 ? (
              <div style={{ color: 'var(--muted)', marginTop: 8 }}>
                Aucune ligne publications. Exécutez docs/supabase-admin-platform.sql.
              </div>
            ) : (
              <div className="pub-list">
                {publications.map(pub => (
                  <div key={pub.id} className="pub-item">
                    <div>
                      <strong>Publication {pub.id.slice(0, 8)}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                        {formatDate(pub.submitted_at)}
                        {pub.expires_at ? ` → ${formatDate(pub.expires_at)}` : ''}
                      </div>
                    </div>
                    <div className={`status ${pub.status}`}>{pub.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="detail-right">
          <div className="card">
            <div className="detail-section-title">Historique</div>
            <ol className="timeline">
              {events.length === 0 ? (
                <li className="timeline-item">
                  <span>{property.created_at ? formatDate(property.created_at) : ''}</span>
                  <strong>Soumission</strong>
                </li>
              ) : (
                events.map(event => (
                  <li key={event.id} className="timeline-item">
                    <span>{formatDate(event.created_at)}</span>
                    <strong>{EVENT_LABELS[event.event] ?? event.event}</strong>
                  </li>
                ))
              )}
            </ol>
          </div>
          <div className="card">
            <div className="detail-section-title">Contact agent</div>
            <div>{owner?.full_name || '—'}</div>
            <div style={{ color: 'var(--muted)' }}>{owner?.phone || 'Aucun téléphone'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
