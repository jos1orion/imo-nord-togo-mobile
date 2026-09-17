'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SectionHeader from '../../../../components/SectionHeader';
import { supabase } from '../../../../lib/supabaseClient';
import { formatCurrency, formatDate } from '../../../../lib/format';
import type { ListingStatus, Property, PropertyStatus } from '../../../../lib/types';

type PropertyRow = Property & { property_images?: { url: string }[] };

type OwnerProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

const PROPERTY_TYPE_LABELS: Record<Property['type'], string> = {
  house: 'Maison',
  apartment: 'Appartement',
  land: 'Terrain',
  shop: 'Boutique',
};

const getListingLabel = (status?: ListingStatus) => {
  if (status === 'pending') return 'En attente';
  if (status === 'approved') return 'Approuvé';
  if (status === 'rejected') return 'Refusé';
  if (status === 'archived') return 'Archivé';
  return 'Approuvé';
};

const getAvailabilityLabel = (status: PropertyStatus) => {
  return status === 'available' ? 'Disponible' : 'Occupé';
};

const getPropertyTypeLabel = (type: Property['type']) => PROPERTY_TYPE_LABELS[type] ?? type;

const isMissingFeaturedColumnError = (message?: string) => {
  const normalized = message?.toLowerCase() ?? '';
  return normalized.includes('featured') && normalized.includes('properties');
};

export default function PropertyDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = typeof params?.id === 'string' ? params.id : '';
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [supportsFeaturedColumn, setSupportsFeaturedColumn] = useState(true);

  const cover = useMemo(() => property?.property_images?.[0]?.url ?? '', [property]);

  useEffect(() => {
    if (!propertyId) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('properties')
        .select('*, property_images(url)')
        .eq('id', propertyId)
        .maybeSingle();
      if (error) {
        console.warn('Property load failed', error.message);
      }
      setProperty((data as PropertyRow) ?? null);
      if (data?.owner_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .eq('id', data.owner_id)
          .maybeSingle();
        setOwner((profile as OwnerProfile) ?? null);
      } else {
        setOwner(null);
      }
      setLoading(false);
    };
    load();
  }, [propertyId]);

  const updateListingStatus = async (nextStatus: ListingStatus) => {
    if (!property) return;
    const { error } = await supabase
      .from('properties')
      .update({ listing_status: nextStatus })
      .eq('id', property.id);
    if (error) {
      alert(`Erreur mise a jour: ${error.message}`);
      return;
    }
    setProperty({ ...property, listing_status: nextStatus });
  };

  const updateAvailability = async (status: PropertyStatus) => {
    if (!property) return;
    const { error } = await supabase
      .from('properties')
      .update({ status })
      .eq('id', property.id);
    if (error) {
      alert(`Erreur mise a jour: ${error.message}`);
      return;
    }
    setProperty({ ...property, status });
  };

  const toggleFeatured = async () => {
    if (!property) return;
    if (!supportsFeaturedColumn) {
      alert("La colonne 'featured' n'existe pas encore dans votre base Supabase.");
      return;
    }
    const { error } = await supabase
      .from('properties')
      .update({ featured: !property.featured })
      .eq('id', property.id);
    if (error) {
      if (isMissingFeaturedColumnError(error.message)) {
        setSupportsFeaturedColumn(false);
        alert("La colonne 'featured' manque dans la base. L'option Vedette est désactivée pour ce bien.");
        return;
      }
      alert(`Erreur mise a jour: ${error.message}`);
      return;
    }
    setProperty({ ...property, featured: !property.featured });
  };

  const handleDelete = async () => {
    if (!property) return;
    const { error } = await supabase.from('properties').delete().eq('id', property.id);
    if (error) {
      alert(`Erreur suppression: ${error.message}`);
      return;
    }
    router.push('/properties');
  };

  if (loading) {
    return <div className="card">Chargement du bien...</div>;
  }

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
        subtitle={`${property.location}${property.neighborhood ? `, ${property.neighborhood}` : ''}`}
        actions={
          <div className="pill-row">
            <div className={`status ${property.listing_status}`}>{getListingLabel(property.listing_status)}</div>
            <button className="ghost-button" onClick={() => router.push(`/properties?edit=${property.id}`)}>
              Modifier
            </button>
            <button className="ghost-button" onClick={() => router.push('/properties')}>
              Retour
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
                  <img key={image.url} src={image.url} alt="thumb" />
                ))}
              </div>
            ) : null}
          </div>

          <div className="card detail-card">
            <div className="detail-section-title">Description</div>
            <div className="detail-text">{property.description || 'Aucune description.'}</div>
          </div>

          <div className="card detail-card">
            <div className="detail-section-title">Détails</div>
            <div className="detail-info-grid">
              <div>
                <span>Type</span>
                <strong>{getPropertyTypeLabel(property.type)}</strong>
              </div>
              <div>
                <span>Prix</span>
                <strong>{formatCurrency(property.price)}</strong>
              </div>
              <div>
                <span>Statut</span>
                <strong>{getAvailabilityLabel(property.status)}</strong>
              </div>
              <div>
                <span>Publication</span>
                <strong>{formatDate(property.created_at)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="detail-right">
          <div className="card detail-card">
            <div className="detail-section-title">Propriétaire / Agent</div>
            <div className="detail-owner">
              <div className="detail-owner-name">{owner?.full_name || 'Non renseigné'}</div>
              <div className="detail-owner-meta">{owner?.phone || 'Aucun contact'}</div>
            </div>
          </div>

          <div className="card detail-card">
            <div className="detail-section-title">Actions</div>
            <div className="detail-actions">
              {property.listing_status !== 'approved' ? (
                <button className="primary-button small" onClick={() => updateListingStatus('approved')}>
                  Approuver
                </button>
              ) : null}
              {property.listing_status !== 'rejected' ? (
                <button className="ghost-button small" onClick={() => updateListingStatus('rejected')}>
                  Refuser
                </button>
              ) : null}
              {property.listing_status !== 'archived' ? (
                <button className="ghost-button small" onClick={() => updateListingStatus('archived')}>
                  Archiver
                </button>
              ) : null}
              <button className="ghost-button small" onClick={toggleFeatured} disabled={!supportsFeaturedColumn}>
                {property.featured ? 'Retirer vedette' : 'Mettre en vedette'}
              </button>
              <button className="ghost-button small" onClick={() => updateAvailability('available')}>
                Mettre disponible
              </button>
              <button className="ghost-button small" onClick={() => updateAvailability('occupied')}>
                Marquer occupé
              </button>
              <button className="danger-button small" onClick={handleDelete}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
