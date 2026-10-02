'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionHeader from '../../../components/SectionHeader';
import { formatCurrency, formatDate } from '../../../lib/format';
import { supabase } from '../../../lib/supabaseClient';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import { useSession } from '../../../lib/useSession';
import type { ListingStatus, Neighborhood, Property, PropertyStatus } from '../../../lib/types';
import { logAdminAction } from '../../../lib/adminAudit';
import { useRouter, useSearchParams } from 'next/navigation';

type PropertyRow = Property & {
  property_images?: { url: string }[];
  owner_id?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area?: number | null;
  client_id?: string | null;
};

const PROPERTY_TYPE_LABELS: Record<Property['type'], string> = {
  house: 'Maison',
  apartment: 'Appartement',
  land: 'Terrain',
  shop: 'Boutique',
};

const PROPERTY_TYPE_OPTIONS: Property['type'][] = ['house', 'apartment', 'land', 'shop'];

const emptyForm = {
  title: '',
  type: 'house' as Property['type'],
  price: '',
  location: '',
  neighborhood: '',
  description: '',
  status: 'available' as PropertyStatus,
  listingStatus: 'pending' as ListingStatus,
  featured: false,
};

const listingTabs: Array<{ key: 'ALL' | ListingStatus; label: string }> = [
  { key: 'ALL', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'approved', label: 'Approuvé' },
  { key: 'archived', label: 'Archivé' },
];

const getListingLabel = (status: ListingStatus) => {
  if (status === 'pending') return 'En attente';
  if (status === 'approved') return 'Approuvé';
  if (status === 'rejected') return 'Refusé';
  return 'Archivé';
};

const getAvailabilityLabel = (status: PropertyStatus) => {
  return status === 'available' ? 'Disponible' : 'Occupé';
};

const getPropertyTypeLabel = (type: Property['type']) => PROPERTY_TYPE_LABELS[type] ?? type;

const isMissingFeaturedColumnError = (message?: string) => {
  const normalized = message?.toLowerCase() ?? '';
  return normalized.includes('featured') && normalized.includes('properties');
};

export default function PropertiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useSession();
  const { data: properties, loading, reload } = useSupabaseTable<PropertyRow>('properties', {
    select: '*, property_images(url)',
    orderBy: 'created_at',
  });
  const { data: neighborhoods } = useSupabaseTable<Neighborhood>('neighborhoods', {
    orderBy: 'name',
    ascending: true,
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState<FileList | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ALL' | ListingStatus>('ALL');
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<Property['type'] | 'ALL'>('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'title' | 'location' | 'price' | 'listing_status' | 'status' | 'created_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [didInitEdit, setDidInitEdit] = useState(false);
  const canSetAdminListingFields = profile?.role === 'ADMIN';
  const canUseBulkActions = profile?.role === 'ADMIN';
  const [supportsFeaturedColumn, setSupportsFeaturedColumn] = useState(true);
  const previewImages = useMemo(
    () =>
      files
        ? Array.from(files).map(file => ({
            name: file.name,
            url: URL.createObjectURL(file),
          }))
        : [],
    [files]
  );

  useEffect(() => {
    return () => {
      previewImages.forEach(image => URL.revokeObjectURL(image.url));
    };
  }, [previewImages]);

  const cityOptions = useMemo(() => {
    const map = new Map<string, string>();
    properties.forEach(item => {
      const value = item.location?.trim();
      if (!value) return;
      const key = value.toLowerCase();
      if (!map.has(key)) map.set(key, value);
    });
    return Array.from(map.values());
  }, [properties]);

  const typeOptions = useMemo(() => PROPERTY_TYPE_OPTIONS, []);

  const filteredProperties = useMemo(() => {
    let items = [...properties];
    if (tab !== 'ALL') {
      items = items.filter(item => item.listing_status === tab);
    }
    if (typeFilter !== 'ALL') {
      items = items.filter(item => item.type === typeFilter);
    }
    if (statusFilter !== 'ALL') {
      items = items.filter(item => item.status === statusFilter);
    }
    if (cityFilter !== 'ALL') {
      items = items.filter(item => item.location === cityFilter);
    }
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      items = items.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query) ||
        (item.neighborhood ?? '').toLowerCase().includes(query) ||
        (item.owner_id ?? '').toLowerCase().includes(query)
      );
    }
    if (priceMin) {
      const min = Number(priceMin);
      if (!Number.isNaN(min)) items = items.filter(item => Number(item.price) >= min);
    }
    if (priceMax) {
      const max = Number(priceMax);
      if (!Number.isNaN(max)) items = items.filter(item => Number(item.price) <= max);
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      items = items.filter(item => new Date(item.created_at).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime();
      items = items.filter(item => new Date(item.created_at).getTime() <= to);
    }
    return items;
  }, [properties, tab, typeFilter, statusFilter, cityFilter, search, priceMin, priceMax, dateFrom, dateTo]);

  const sortedProperties = useMemo(() => {
    const items = [...filteredProperties];
    const dir = sortDir === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      if (sortBy === 'price') {
        return (Number(a.price) - Number(b.price)) * dir;
      }
      if (sortBy === 'created_at') {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
      if (sortBy === 'location') {
        return a.location.localeCompare(b.location) * dir;
      }
      if (sortBy === 'listing_status') {
        return a.listing_status.localeCompare(b.listing_status) * dir;
      }
      if (sortBy === 'status') {
        return a.status.localeCompare(b.status) * dir;
      }
      return a.title.localeCompare(b.title) * dir;
    });
    return items;
  }, [filteredProperties, sortBy, sortDir]);

  const pageSize = viewMode === 'table' ? 10 : 12;
  const totalPages = Math.max(1, Math.ceil(sortedProperties.length / pageSize));
  const pagedProperties = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedProperties.slice(start, start + pageSize);
  }, [page, pageSize, sortedProperties]);

  useEffect(() => {
    setPage(1);
  }, [search, tab, typeFilter, statusFilter, cityFilter, priceMin, priceMax, dateFrom, dateTo, viewMode]);

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setTab('ALL');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setCityFilter('ALL');
    setPriceMin('');
    setPriceMax('');
    setDateFrom('');
    setDateTo('');
  };

  const activeFilters = useMemo(() => {
    const filters: Array<{ label: string; onClear: () => void }> = [];
    if (search.trim()) {
      filters.push({ label: `Recherche: ${search.trim()}`, onClear: () => setSearch('') });
    }
    if (tab !== 'ALL') {
      filters.push({ label: `Validation: ${getListingLabel(tab)}`, onClear: () => setTab('ALL') });
    }
    if (typeFilter !== 'ALL') {
      filters.push({ label: `Type: ${getPropertyTypeLabel(typeFilter)}`, onClear: () => setTypeFilter('ALL') });
    }
    if (statusFilter !== 'ALL') {
      filters.push({ label: `Occupation: ${getAvailabilityLabel(statusFilter)}`, onClear: () => setStatusFilter('ALL') });
    }
    if (cityFilter !== 'ALL') {
      filters.push({ label: `Ville: ${cityFilter}`, onClear: () => setCityFilter('ALL') });
    }
    if (priceMin || priceMax) {
      filters.push({
        label: `Loyer: ${priceMin || '0'} - ${priceMax || 'sans max'} FCFA`,
        onClear: () => {
          setPriceMin('');
          setPriceMax('');
        },
      });
    }
    if (dateFrom || dateTo) {
      filters.push({
        label: `Date: ${dateFrom || '...'} - ${dateTo || '...'}`,
        onClear: () => {
          setDateFrom('');
          setDateTo('');
        },
      });
    }
    return filters;
  }, [search, tab, typeFilter, statusFilter, cityFilter, priceMin, priceMax, dateFrom, dateTo]);

  const toggleSelection = (propertyId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(propertyId)) {
        next.delete(propertyId);
      } else {
        next.add(propertyId);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleListingStatus = async (propertyId: string, nextStatus: ListingStatus) => {
    const { error } = await supabase.from('properties').update({ listing_status: nextStatus }).eq('id', propertyId);
    if (error) {
      alert(`Erreur mise a jour: ${error.message}`);
      return;
    }
    await logAdminAction('listing_status', 'property', propertyId);
    reload();
  };

  const handleFeatured = async (propertyId: string, featured: boolean) => {
    if (!supportsFeaturedColumn) {
      alert("La colonne 'featured' n'existe pas encore dans votre base Supabase.");
      return;
    }
    const { error } = await supabase.from('properties').update({ featured }).eq('id', propertyId);
    if (error) {
      if (isMissingFeaturedColumnError(error.message)) {
        setSupportsFeaturedColumn(false);
        alert("La colonne 'featured' manque dans la base. Le bien reste utilisable, mais l'option Vedette est désactivée.");
        return;
      }
      alert(`Erreur mise a jour: ${error.message}`);
      return;
    }
    await logAdminAction('featured_toggle', 'property', propertyId);
    reload();
  };

  const handleDelete = async (propertyId: string) => {
    const { error } = await supabase.from('properties').delete().eq('id', propertyId);
    if (error) {
      alert(`Erreur suppression: ${error.message}`);
      return;
    }
    await logAdminAction('delete_property', 'property', propertyId);
    reload();
  };

  const handleBulkAction = async (action: 'approve' | 'reject' | 'archive' | 'delete') => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (action === 'delete') {
      const { error } = await supabase.from('properties').delete().in('id', ids);
      if (error) {
        alert(`Erreur suppression: ${error.message}`);
        return;
      }
    } else {
      const nextStatus: ListingStatus =
        action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'archived';
      const { error } = await supabase.from('properties').update({ listing_status: nextStatus }).in('id', ids);
      if (error) {
        alert(`Erreur mise a jour: ${error.message}`);
        return;
      }
    }
    await logAdminAction(action === 'delete' ? 'delete_properties' : `bulk_${action}_properties`, 'property');
    clearSelection();
    reload();
  };

  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.location) {
      alert('Renseignez au minimum le titre, le prix et la ville.');
      return;
    }
    if (files && files.length > 8) {
      alert('Maximum 8 images par bien.');
      return;
    }
    setSaving(true);
    try {
      // Agents submit and correct their own private drafts only. Approval and
      // featured status are reserved for administrators and enforced again by RLS.
      const listingStatusForSave: ListingStatus = canSetAdminListingFields
        ? form.listingStatus
        : editingId
        ? form.listingStatus
        : 'pending';
      const featuredForSave = canSetAdminListingFields ? form.featured : false;
      const basePayload = {
        title: form.title,
        type: form.type,
        price: Number(form.price),
        location: form.location,
        neighborhood: form.neighborhood || null,
        description: form.description,
        status: form.status,
        listing_status: listingStatusForSave,
      };
      if (editingId) {
        let { error } = await supabase
          .from('properties')
          .update({
            ...basePayload,
            ...(supportsFeaturedColumn ? { featured: featuredForSave } : {}),
          })
          .eq('id', editingId);
        if (error && supportsFeaturedColumn && isMissingFeaturedColumnError(error.message)) {
          setSupportsFeaturedColumn(false);
          const retry = await supabase.from('properties').update(basePayload).eq('id', editingId);
          error = retry.error;
        }
        if (error) {
          alert(`Erreur mise a jour: ${error.message}`);
          setSaving(false);
          return;
        }
        await logAdminAction('update_property', 'property', editingId);
      } else {
        const ownerId = user?.id;
        if (!ownerId) {
          alert("Session invalide. Reconnecte-toi puis reessaie.");
          setSaving(false);
          return;
        }
        let { data, error } = await supabase
          .from('properties')
          .insert({
            owner_id: ownerId,
            ...basePayload,
            ...(supportsFeaturedColumn ? { featured: featuredForSave } : {}),
          })
          .select()
          .maybeSingle();
        if (error && supportsFeaturedColumn && isMissingFeaturedColumnError(error.message)) {
          setSupportsFeaturedColumn(false);
          const retry = await supabase
            .from('properties')
            .insert({
              owner_id: ownerId,
              ...basePayload,
            })
            .select()
            .maybeSingle();
          data = retry.data;
          error = retry.error;
        }
        if (error) {
          alert(`Erreur insertion: ${error.message}`);
          setSaving(false);
          return;
        }
        if (data) {
          await logAdminAction('create_property', 'property', data.id);
        }

        if (!error && data && files?.length) {
          const uploads = Array.from(files).map(async file => {
            const path = `${ownerId}/${data.id}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage.from('property-images').upload(path, file);
            if (uploadError) {
              alert(`Erreur upload: ${uploadError.message}`);
              return;
            }
            const { data: publicUrl } = supabase.storage.from('property-images').getPublicUrl(path);
            const { error: imageError } = await supabase.from('property_images').insert({
              property_id: data.id,
              url: publicUrl.publicUrl,
            });
            if (imageError) {
              alert(`Erreur image: ${imageError.message}`);
            }
          });
          await Promise.all(uploads);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue';
      alert(`Erreur: ${message}`);
      setSaving(false);
      return;
    }

    setForm(emptyForm);
    setFiles(null);
    setEditingId(null);
    setShowForm(false);
    setSaving(false);
    reload();
  };

  const handleEdit = (property: PropertyRow) => {
    setEditingId(property.id);
    setForm({
      title: property.title,
      type: property.type,
      price: String(property.price),
      location: property.location,
      neighborhood: property.neighborhood ?? '',
      description: property.description ?? '',
      status: property.status,
      listingStatus: property.listing_status ?? 'pending',
      featured: property.featured ?? false,
    });
    setShowForm(true);
  };

  const exportCsv = () => {
    const headers = ['Nom', 'Ville', 'Prix', 'Statut', 'Validation', 'Date'];
    const rows = filteredProperties.map(item => [
      item.title,
      item.location,
      item.price,
      item.status,
      item.listing_status,
      item.created_at,
    ]);
    const lines = [headers, ...rows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'biens.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    window.print();
  };

  useEffect(() => {
    if (didInitEdit) return;
    const editId = searchParams.get('edit');
    if (!editId) return;
    const property = properties.find(item => item.id === editId);
    if (!property) return;
    handleEdit(property);
    setDidInitEdit(true);
  }, [didInitEdit, properties, searchParams]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(decodeURIComponent(q));
  }, [searchParams]);

  const renderMainAction = (property: PropertyRow) => {
    if (!canSetAdminListingFields) return null;
    if (property.listing_status === 'pending') {
      return (
        <button
          className="primary-button small"
          onClick={event => {
            event.stopPropagation();
            handleListingStatus(property.id, 'approved');
          }}
        >
          Approuver
        </button>
      );
    }
    if (property.listing_status === 'approved') {
      return (
        <button
          className="ghost-button small"
          onClick={event => {
            event.stopPropagation();
            handleFeatured(property.id, !property.featured);
          }}
        >
          {property.featured ? 'Retirer vedette' : 'Mettre en vedette'}
        </button>
      );
    }
    return null;
  };

  const renderMenu = (property: PropertyRow) => {
    const agentCanEditOwnDraft =
      profile?.role === 'AGENT' &&
      property.owner_id === user?.id &&
      (property.listing_status === 'pending' || property.listing_status === 'rejected');

    if (!canSetAdminListingFields && !agentCanEditOwnDraft) return null;

    return (
      <details className="action-menu" onClick={event => event.stopPropagation()}>
        <summary className="icon-button">...</summary>
        <div className="action-menu-list">
          {canSetAdminListingFields ? (
            <>
              <button onClick={() => handleListingStatus(property.id, 'approved')}>Approuver</button>
              <button onClick={() => handleListingStatus(property.id, 'rejected')}>Refuser</button>
              <button onClick={() => handleFeatured(property.id, !property.featured)}>
                {property.featured ? 'Retirer vedette' : 'Mettre en vedette'}
              </button>
              <button onClick={() => handleListingStatus(property.id, 'archived')}>Archiver</button>
            </>
          ) : null}
          <button onClick={() => handleEdit(property)}>Modifier</button>
          <button className="danger" onClick={() => handleDelete(property.id)}>Supprimer</button>
        </div>
      </details>
    );
  };

  return (
    <div className="grid">
      <div className="breadcrumb">Biens <span>&gt;</span> Liste</div>
      <SectionHeader
        title="Biens"
        subtitle="Gérez vos biens avec des actions claires et une visibilité rapide."
        actions={
          <div className="sticky-cta">
            <button
              className="primary-button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
                setShowForm(true);
              }}
            >
              + Ajouter un bien
            </button>
          </div>
        }
      />

      <div className="tabs">
        {listingTabs.map(item => (
          <button
            key={item.key}
            className={`tab-pill ${tab === item.key ? 'active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="filters-bar">
        <div className="filter-group grow">
          <label>Recherche</label>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Nom, ville, propriétaire..."
          />
        </div>
        <div className="filter-group">
          <label>Type</label>
          <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as Property['type'] | 'ALL')}>
            <option value="ALL">Tous</option>
            {typeOptions.map(item => (
              <option key={item} value={item}>{getPropertyTypeLabel(item)}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Occupation</label>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as PropertyStatus | 'ALL')}>
            <option value="ALL">Tous</option>
            <option value="available">Disponible</option>
            <option value="occupied">Occupé</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Ville</label>
          <select value={cityFilter} onChange={event => setCityFilter(event.target.value)}>
            <option value="ALL">Toutes</option>
            {cityOptions.map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Loyer (FCFA)</label>
          <div className="range-inputs">
            <input
              type="number"
              value={priceMin}
              onChange={event => setPriceMin(event.target.value)}
              placeholder="Min"
            />
            <input
              type="number"
              value={priceMax}
              onChange={event => setPriceMax(event.target.value)}
              placeholder="Max"
            />
          </div>
        </div>
        <div className="filter-group">
          <label>Date</label>
          <div className="range-inputs">
            <input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} />
            <input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} />
          </div>
        </div>
        <div className="filter-group filter-actions">
          <label>Actions</label>
          <button className="ghost-button" onClick={resetFilters}>Reinitialiser</button>
        </div>
      </div>

      {activeFilters.length > 0 ? (
        <div className="filter-chips">
          {activeFilters.map(item => (
            <button key={item.label} className="filter-chip" onClick={item.onClear}>
              {item.label} <span>x</span>
            </button>
          ))}
          <button className="filter-chip clear" onClick={resetFilters}>Tout effacer</button>
        </div>
      ) : null}

      <div className="table-toolbar slim">
        <div className="pill-row">
          <div className="pill">{sortedProperties.length} biens</div>
          {canUseBulkActions && selectedIds.size > 0 ? <div className="pill">{selectedIds.size} selectionnes</div> : null}
          <div className="pill">Page {page} / {totalPages}</div>
        </div>
        <div className="toolbar-actions">
          {canUseBulkActions && selectedIds.size > 0 ? (
            <details className="dropdown">
              <summary>Actions groupees</summary>
              <div className="dropdown-menu">
                <button onClick={() => handleBulkAction('approve')}>Approuver</button>
                <button onClick={() => handleBulkAction('reject')}>Refuser</button>
                <button onClick={() => handleBulkAction('archive')}>Archiver</button>
                <button className="danger" onClick={() => handleBulkAction('delete')}>Supprimer</button>
              </div>
            </details>
          ) : null}
          <details className="dropdown">
            <summary>Exporter</summary>
            <div className="dropdown-menu">
              <button onClick={exportCsv}>CSV</button>
              <button onClick={exportPdf}>PDF</button>
            </div>
          </details>
          <div className="view-toggle">
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}>
              Cartes
            </button>
            <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>
              Tableau
            </button>
          </div>
        </div>
      </div>

      {showForm ? (
        <div className="card form-card">
          <div className="form-grid">
            <div className="form-field">
              <label>Titre</label>
              <input
                value={form.title}
                onChange={event => setForm({ ...form, title: event.target.value })}
                placeholder="Villa moderne"
              />
            </div>
            <div className="form-field">
              <label>Type</label>
              <select
                value={form.type}
                onChange={event => setForm({ ...form, type: event.target.value as Property['type'] })}
              >
                <option value="house">Maison</option>
                <option value="apartment">Appartement</option>
                <option value="land">Terrain</option>
                <option value="shop">Boutique</option>
              </select>
            </div>
            <div className="form-field">
              <label>Prix (FCFA)</label>
              <input
                type="number"
                value={form.price}
                onChange={event => setForm({ ...form, price: event.target.value })}
                placeholder="350000"
              />
            </div>
            <div className="form-field">
              <label>Ville</label>
              <input
                value={form.location}
                onChange={event => setForm({ ...form, location: event.target.value })}
                placeholder="Kara"
              />
            </div>
            <div className="form-field">
              <label>Quartier</label>
              <input
                value={form.neighborhood}
                onChange={event => setForm({ ...form, neighborhood: event.target.value })}
                placeholder="Kpewa"
                list="neighborhoods-list"
              />
              <datalist id="neighborhoods-list">
                {neighborhoods.map(item => (
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
            </div>
            <div className="form-field form-span">
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={event => setForm({ ...form, description: event.target.value })}
                placeholder="Détails du bien, équipements, conditions..."
              />
            </div>
            <div className="form-field">
              <label>Statut</label>
              <select
                value={form.status}
                onChange={event => setForm({ ...form, status: event.target.value as PropertyStatus })}
              >
                <option value="available">Disponible</option>
                <option value="occupied">Occupé</option>
              </select>
            </div>
            <div className="form-field">
              <label>Validation</label>
              <select
                value={canSetAdminListingFields ? form.listingStatus : editingId ? form.listingStatus : 'pending'}
                onChange={event => setForm({ ...form, listingStatus: event.target.value as ListingStatus })}
                disabled={!canSetAdminListingFields}
              >
                <option value="pending">En attente</option>
                <option value="approved">Approuvé</option>
                <option value="rejected">Refusé</option>
                <option value="archived">Archivé</option>
              </select>
            </div>
            <div className="form-field">
              <label>Vedette</label>
              <select
                value={(canSetAdminListingFields ? form.featured : false) ? 'yes' : 'no'}
                onChange={event => setForm({ ...form, featured: event.target.value === 'yes' })}
                disabled={!supportsFeaturedColumn || !canSetAdminListingFields}
              >
                <option value="no">Non</option>
                <option value="yes">Oui</option>
              </select>
            </div>
            <div className="form-field form-span">
              <label>Images (multiple)</label>
              <input type="file" multiple onChange={event => setFiles(event.target.files)} />
              <small style={{ color: 'var(--muted)' }}>Maximum 8 images.</small>
              {previewImages.length > 0 ? (
                <div className="upload-preview-grid">
                  {previewImages.map(image => (
                    <figure key={image.url} className="upload-preview-item">
                      <img src={image.url} alt={image.name} />
                      <figcaption>{image.name}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="form-actions">
            <button className="ghost-button" onClick={() => setShowForm(false)}>
              Fermer
            </button>
            <button className="primary-button" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Enregistrement...' : editingId ? 'Mettre a jour' : 'Enregistrer'}
            </button>
          </div>
        </div>
      ) : null}

      {viewMode === 'grid' ? (
        <div className="property-grid">
          {loading && <div className="card">Chargement...</div>}
          {!loading && sortedProperties.length === 0 ? (
            <div className="card table-empty">
              <div className="table-empty-title">Aucun bien trouvé</div>
              <div className="table-empty-subtitle">Ajustez vos filtres.</div>
            </div>
          ) : null}
          {!loading &&
            pagedProperties.map(property => {
              const cover = property.property_images?.[0]?.url ?? '';
              return (
                <div
                  key={property.id}
                  className="property-card modern"
                  onClick={() => router.push(`/properties/${property.id}`)}
                >
                  <div className="property-thumb">
                    {cover ? <img src={cover} alt={property.title} /> : <div className="property-thumb-fallback">IMG</div>}
                    <span className={`status-badge ${property.listing_status}`}>
                      {getListingLabel(property.listing_status)}
                    </span>
                    {canUseBulkActions ? (
                      <label
                        className="property-select"
                        onClick={event => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(property.id)}
                          onChange={() => toggleSelection(property.id)}
                        />
                      </label>
                    ) : null}
                  </div>
                  <div className="property-body">
                    <div className="property-title">{property.title}</div>
                    <div className="property-sub">{property.location}{property.neighborhood ? ` | ${property.neighborhood}` : ''}</div>
                    <div className="property-price">{formatCurrency(property.price)}</div>
                    <div className="property-meta-row">
                      {property.bedrooms ? <span className="meta-chip">Ch: {property.bedrooms}</span> : null}
                      {property.area ? <span className="meta-chip">Surf: {property.area} m2</span> : null}
                      {property.bathrooms ? <span className="meta-chip">Sdb: {property.bathrooms}</span> : null}
                      {property.status === 'occupied' ? <span className="meta-chip danger">Occupé</span> : <span className="meta-chip success">Libre</span>}
                    </div>
                    <div className="property-meta-row">
                      <span className={`status ${property.status}`}>{getAvailabilityLabel(property.status)}</span>
                      <span className="chip">{formatDate(property.created_at)}</span>
                      <select
                        className="status-select"
                        value={property.listing_status}
                        onChange={event => handleListingStatus(property.id, event.target.value as ListingStatus)}
                        onClick={event => event.stopPropagation()}
                        disabled={!canSetAdminListingFields}
                      >
                        <option value="pending">En attente</option>
                        <option value="approved">Approuvé</option>
                        <option value="rejected">Refusé</option>
                        <option value="archived">Archivé</option>
                      </select>
                    </div>
                  </div>
                  <div className="property-actions-row" onClick={event => event.stopPropagation()}>
                    {renderMainAction(property)}
                    {renderMenu(property)}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="card table-card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Image</th>
                  <th>
                    <button className="sort-button" onClick={() => toggleSort('title')}>
                      Nom
                    </button>
                  </th>
                  <th>
                    <button className="sort-button" onClick={() => toggleSort('location')}>
                      Ville
                    </button>
                  </th>
                  <th>
                    <button className="sort-button" onClick={() => toggleSort('price')}>
                      Loyer
                    </button>
                  </th>
                  <th>
                    <button className="sort-button" onClick={() => toggleSort('listing_status')}>
                      Validation
                    </button>
                  </th>
                  <th>
                    <button className="sort-button" onClick={() => toggleSort('created_at')}>
                      Date
                    </button>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedProperties.map(property => {
                  const cover = property.property_images?.[0]?.url ?? '';
                  return (
                    <tr
                      key={property.id}
                      onClick={() => router.push(`/properties/${property.id}`)}
                      className="table-row-click"
                    >
                      <td onClick={event => event.stopPropagation()}>
                        {canUseBulkActions ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(property.id)}
                            onChange={() => toggleSelection(property.id)}
                          />
                        ) : null}
                      </td>
                      <td>
                        <div className="table-thumb">
                          {cover ? <img src={cover} alt={property.title} /> : <div className="table-thumb-fallback">IMG</div>}
                        </div>
                      </td>
                      <td>{property.title}</td>
                      <td>{property.location}</td>
                      <td>{formatCurrency(property.price)}</td>
                      <td>
                        <span className={`status ${property.listing_status}`}>{getListingLabel(property.listing_status)}</span>
                      </td>
                      <td>{formatDate(property.created_at)}</td>
                      <td onClick={event => event.stopPropagation()}>
                        <div className="row-actions">
                          {renderMainAction(property)}
                          {renderMenu(property)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="pagination">
        <button className="ghost-button" onClick={() => setPage(prev => Math.max(1, prev - 1))} disabled={page <= 1}>
          Precedent
        </button>
        <div className="pill">Page {page} / {totalPages}</div>
        <button className="ghost-button" onClick={() => setPage(prev => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
          Suivant
        </button>
      </div>
    </div>
  );
}
