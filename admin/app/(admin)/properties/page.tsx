'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import SectionHeader from '../../../components/SectionHeader';
import LoadingState from '../../../components/LoadingState';
import { formatCurrency, formatDate } from '../../../lib/format';
import { supabase } from '../../../lib/supabaseClient';
import { deleteAdminProperty } from '../../../lib/propertyStorage';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';
import { useSession } from '../../../lib/useSession';
import type { ListingStatus, Neighborhood, Property, PropertyStatus } from '../../../lib/types';
import { logAdminAction } from '../../../lib/adminAudit';
import {
  bulkDeleteAdminRecords,
  bulkUpdateAdminRecords,
  deleteAdminRecord,
  updateAdminRecord,
} from '../../../lib/adminMutations';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PROPERTY_IMAGE_MAX_BYTES,
  PROPERTY_IMAGE_MAX_COUNT,
  PROPERTY_IMAGE_MIME_TYPES,
  PROPERTY_IMAGE_MAX_TOTAL_BYTES,
  validatePropertyImageSelection,
  validatePropertyImages,
} from '../../../../src/utils/imageUploadValidation';
import { compressPropertyImages } from '../../../lib/compressPropertyImages';

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

const listingTabs: { key: 'ALL' | ListingStatus; label: string }[] = [
  { key: 'ALL', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'approved', label: 'Approuvé' },
  { key: 'rejected', label: 'Refusé' },
  { key: 'archived', label: 'Archives' },
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
  const { data: properties, loading, error, reload } = useSupabaseTable<PropertyRow>('properties', {
    select: '*, property_images(url)',
    orderBy: 'created_at',
  });
  const { data: neighborhoods, error: neighborhoodsError, reload: reloadNeighborhoods } = useSupabaseTable<Neighborhood>('neighborhoods', {
    orderBy: 'name',
    ascending: true,
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState<File[] | null>(null);
  const [compressingImages, setCompressingImages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<'title' | 'price' | 'location' | 'images', string>>
  >({});
  const [formMessage, setFormMessage] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const requestedTab = searchParams.get('tab');
  const validTabs: ListingStatus[] = ['pending', 'approved', 'rejected', 'archived'];
  const tab: 'ALL' | ListingStatus = validTabs.includes(requestedTab as ListingStatus)
    ? requestedTab as ListingStatus
    : 'ALL';
  const setTab = useCallback((nextTab: 'ALL' | ListingStatus) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'ALL') params.delete('tab');
    else params.set('tab', nextTab);
    const query = params.toString();
    router.replace(query ? `/properties?${query}` : '/properties');
  }, [router, searchParams]);
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
  const [pageState, setPageState] = useState({ page: 1, filterKey: '' });
  const initializedEditId = useRef<string | null>(null);
  const pageFilterKey = JSON.stringify([
    search,
    tab,
    typeFilter,
    statusFilter,
    cityFilter,
    priceMin,
    priceMax,
    dateFrom,
    dateTo,
    viewMode,
  ]);
  const page = pageState.filterKey === pageFilterKey ? pageState.page : 1;
  const canSetAdminListingFields = profile?.role === 'ADMIN';
  const canUseBulkActions = profile?.role === 'ADMIN';
  const [supportsFeaturedColumn, setSupportsFeaturedColumn] = useState(true);
  const ownerParam = searchParams.get('owner');
  const ownerFilter = profile?.role === 'AGENT' ? user?.id ?? null : ownerParam;
  const existingImageCount = editingId
    ? properties.find(property => property.id === editingId)?.property_images?.length ?? 0
    : 0;
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
    if (ownerFilter) {
      items = items.filter(item => item.owner_id === ownerFilter);
    }
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
  }, [properties, ownerFilter, tab, typeFilter, statusFilter, cityFilter, search, priceMin, priceMax, dateFrom, dateTo]);

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

  const setPage = (nextPage: number) => {
    setPageState({ page: nextPage, filterKey: pageFilterKey });
  };

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
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setCityFilter('ALL');
    setPriceMin('');
    setPriceMax('');
    setDateFrom('');
    setDateTo('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('owner');
    params.delete('tab');
    params.delete('q');
    const query = params.toString();
    router.replace(query ? `/properties?${query}` : '/properties');
  };

  const activeFilters = (() => {
    const filters: { label: string; onClear: () => void }[] = [];
    if (ownerParam && profile?.role !== 'AGENT') {
      filters.push({
        label: `Agent: ${ownerParam.slice(0, 8)}`,
        onClear: () => {
          const params = new URLSearchParams(searchParams.toString());
          params.delete('owner');
          const query = params.toString();
          router.replace(query ? `/properties?${query}` : '/properties');
        },
      });
    }
    if (search.trim()) {
      filters.push({
        label: `Recherche: ${search.trim()}`,
        onClear: () => {
          setSearch('');
          const params = new URLSearchParams(searchParams.toString());
          params.delete('q');
          const query = params.toString();
          router.replace(query ? `/properties?${query}` : '/properties');
        },
      });
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
  })();

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
    try {
      await updateAdminRecord('properties', propertyId, { listing_status: nextStatus });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur mise à jour inconnue.');
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
    try {
      await updateAdminRecord('properties', propertyId, { featured });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      if (isMissingFeaturedColumnError(message)) {
        setSupportsFeaturedColumn(false);
        alert("La colonne 'featured' manque dans la base. Le bien reste utilisable, mais l'option Vedette est désactivée.");
        return;
      }
      alert(`Erreur mise à jour: ${message}`);
      return;
    }
    await logAdminAction('featured_toggle', 'property', propertyId);
    reload();
  };

  const handleDelete = async (propertyId: string) => {
    const propertyTitle = properties.find(property => property.id === propertyId)?.title;
    if (!window.confirm(`Supprimer le bien « ${propertyTitle ?? 'sélectionné'} » ? Cette action est irréversible.`)) {
      return;
    }
    try {
      const imageCleanupError = await deleteAdminProperty(propertyId);
      reload();
      if (imageCleanupError) alert(imageCleanupError);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur suppression: erreur inconnue');
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject' | 'archive' | 'delete') => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (action === 'delete') {
      if (!window.confirm(`Supprimer définitivement les ${ids.length} biens sélectionnés ? Cette action est irréversible.`)) {
        return;
      }
      try {
        const cleanupWarning = await bulkDeleteAdminRecords('properties', ids);
        if (cleanupWarning) alert(cleanupWarning);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Erreur suppression: erreur inconnue');
        return;
      }
    } else {
      const nextStatus: ListingStatus =
        action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'archived';
      try {
        await bulkUpdateAdminRecords('properties', ids, { listing_status: nextStatus });
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Erreur mise à jour inconnue.');
        return;
      }
    }
    await logAdminAction(action === 'delete' ? 'delete_properties' : `bulk_${action}_properties`, 'property');
    clearSelection();
    reload();
  };

  const handleSubmit = async () => {
    if (compressingImages) {
      setFormMessage('Patientez pendant la compression des photos.');
      return;
    }
    const selectedFiles = files ?? [];
    const nextErrors: typeof formErrors = {};
    if (!form.title.trim()) nextErrors.title = 'Le titre est obligatoire.';
    if (!form.price.trim() || !Number.isFinite(Number(form.price)) || Number(form.price) <= 0) {
      nextErrors.price = 'Saisissez un prix supérieur à zéro.';
    }
    if (!form.location.trim()) nextErrors.location = 'La ville est obligatoire.';
    const imageError = validatePropertyImages(selectedFiles, existingImageCount);
    if (imageError) nextErrors.images = imageError;
    setFormErrors(nextErrors);
    setFormMessage('');
    const firstInvalidField = (['title', 'price', 'location', 'images'] as const).find(
      field => nextErrors[field]
    );
    if (firstInvalidField) {
      const refs = {
        title: titleRef,
        price: priceRef,
        location: locationRef,
        images: imagesRef,
      };
      requestAnimationFrame(() => {
        const input = refs[firstInvalidField].current;
        input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input?.focus();
      });
      return;
    }
    setSaving(true);
    let createdPropertyId: string | null = null;
    const uploadedPaths: string[] = [];
    const uploadedUrls: string[] = [];
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
        const updates = canSetAdminListingFields
          ? {
              ...basePayload,
              ...(supportsFeaturedColumn ? { featured: featuredForSave } : {}),
            }
          : {
              title: form.title,
              type: form.type,
              price: Number(form.price),
              location: form.location,
              neighborhood: form.neighborhood || null,
              description: form.description,
            };
        try {
          await updateAdminRecord('properties', editingId, updates);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur inconnue';
          if (!supportsFeaturedColumn || !isMissingFeaturedColumnError(message)) throw error;
          setSupportsFeaturedColumn(false);
          await updateAdminRecord('properties', editingId, basePayload);
        }
      } else {
        const ownerId = user?.id;
        if (!ownerId) {
          throw new Error('Session invalide. Reconnectez-vous puis réessayez.');
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
          throw new Error(`Erreur insertion : ${error.message}`);
        }
        if (!data) throw new Error('La création du bien n’a retourné aucun identifiant.');
        createdPropertyId = data.id;
      }

      if (selectedFiles.length > 0) {
        const savedProperty = editingId
          ? properties.find(property => property.id === editingId)
          : null;
        const ownerId = savedProperty?.owner_id ?? user?.id;
        const propertyId = editingId ?? createdPropertyId;
        if (!ownerId || !propertyId) throw new Error('Impossible de déterminer le propriétaire du bien.');

        for (const file of selectedFiles) {
          const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
          const path = `${ownerId}/${propertyId}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from('property-images')
            .upload(path, file, { contentType: file.type, upsert: false });
          if (uploadError) throw new Error(uploadError.message);
          uploadedPaths.push(path);

          const { data: publicUrl } = supabase.storage.from('property-images').getPublicUrl(path);
          uploadedUrls.push(publicUrl.publicUrl);
        }

        const { error: imageError } = await supabase.from('property_images').insert(
          uploadedUrls.map(url => ({ property_id: propertyId, url }))
        );
        if (imageError) throw new Error(imageError.message);
      }

    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue';
      const cleanupMessages: string[] = [];
      let listingDeleted = false;
      let listingKeptAsDraft = false;
      let draftUpdateFailed = false;
      if (createdPropertyId) {
        try {
          await deleteAdminRecord('properties', createdPropertyId);
          listingDeleted = true;
        } catch (deleteError) {
          const deleteMessage = deleteError instanceof Error ? deleteError.message : 'Erreur inconnue';
          cleanupMessages.push(deleteMessage);
          try {
            await updateAdminRecord('properties', createdPropertyId, {
              listing_status: 'pending',
              featured: false,
            });
            listingKeptAsDraft = true;
          } catch (draftError) {
            draftUpdateFailed = true;
            cleanupMessages.push(draftError instanceof Error ? draftError.message : 'Erreur inconnue');
          }
          if (uploadedUrls.length) {
            const { error: imageRowsError } = await supabase
              .from('property_images')
              .delete()
              .eq('property_id', createdPropertyId)
              .in('url', uploadedUrls);
            if (imageRowsError) cleanupMessages.push(imageRowsError.message);
          }
        }
      } else if (editingId && uploadedUrls.length) {
        const { error: imageRowsError } = await supabase
          .from('property_images')
          .delete()
          .eq('property_id', editingId)
          .in('url', uploadedUrls);
        if (imageRowsError) cleanupMessages.push(imageRowsError.message);
      }
      if (uploadedPaths.length) {
        const { error: storageError } = await supabase.storage
          .from('property-images')
          .remove(uploadedPaths);
        if (storageError) cleanupMessages.push(storageError.message);
      }
      setFormErrors(previous => ({
        ...previous,
        ...(selectedFiles.length ? { images: message } : {}),
      }));
      setFormMessage(
        listingKeptAsDraft
          ? `L’image a échoué et le bien n’a pas pu être supprimé. Il a été remis en brouillon. Vérifiez le nettoyage : ${cleanupMessages.join(' ; ')}`
          : draftUpdateFailed
          ? `L’image a échoué. Impossible de supprimer le bien ou de le remettre en brouillon. Intervention requise : ${cleanupMessages.join(' ; ')}`
          : listingDeleted
          ? `Échec de l’enregistrement des images (${message}). Le bien créé a été supprimé.${cleanupMessages.length ? ` Nettoyage des fichiers incomplet : ${cleanupMessages.join(' ; ')}` : ''}`
          : createdPropertyId
            ? `Échec de l’enregistrement (${message}). Le bien n’a pas pu être supprimé : ${cleanupMessages.join(' ; ')}`
          : `Échec de l’enregistrement : ${message}${cleanupMessages.length ? ` Nettoyage incomplet : ${cleanupMessages.join(' ; ')}` : ''}`
      );
      setSaving(false);
      return;
    }

    try {
      await logAdminAction(
        editingId ? 'update_property' : 'create_property',
        'property',
        editingId ?? createdPropertyId ?? undefined
      );
    } catch (error) {
      setFormMessage(
        `Le bien a été enregistré, mais le journal d’activité n’a pas pu être mis à jour : ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`
      );
    }
    setForm(emptyForm);
    setFiles(null);
    setEditingId(null);
    setFormErrors({});
    setFormMessage('');
    setShowForm(false);
    setSaving(false);
    reload();
  };

  const handleEdit = useCallback((property: PropertyRow) => {
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
  }, []);

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
    const editId = searchParams.get('edit');
    if (!editId || initializedEditId.current === editId) return;
    const property = properties.find(item => item.id === editId);
    if (!property) return;
    const frame = window.requestAnimationFrame(() => {
      handleEdit(property);
      initializedEditId.current = editId;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [handleEdit, properties, searchParams]);

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

    const runMenuAction = (event: ReactMouseEvent<HTMLButtonElement>, action: () => void) => {
      event.currentTarget.closest('details')?.removeAttribute('open');
      action();
    };

    return (
      <details className="action-menu" onClick={event => event.stopPropagation()}>
        <summary className="icon-button" aria-label={`Options de l’annonce ${property.title}`} title="Options">
          ⋮
        </summary>
        <div className="action-menu-list">
          {canSetAdminListingFields ? (
            <>
              <button onClick={event => runMenuAction(event, () => handleListingStatus(property.id, 'approved'))}>Approuver</button>
              <button onClick={event => runMenuAction(event, () => handleListingStatus(property.id, 'rejected'))}>Refuser</button>
              <button onClick={event => runMenuAction(event, () => handleFeatured(property.id, !property.featured))}>
                {property.featured ? 'Retirer vedette' : 'Mettre en vedette'}
              </button>
              <button onClick={event => runMenuAction(event, () => handleListingStatus(property.id, 'archived'))}>Archiver</button>
            </>
          ) : null}
          <button onClick={event => runMenuAction(event, () => handleEdit(property))}>Modifier</button>
          {canSetAdminListingFields ? (
            <button className="danger" onClick={event => runMenuAction(event, () => void handleDelete(property.id))}>
              Supprimer
            </button>
          ) : null}
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

      {error || neighborhoodsError ? (
        <div className="alert" role="alert">
          Erreur de chargement : {[error, neighborhoodsError].filter(Boolean).join(' ; ')}
          <button
            className="ghost-button small"
            onClick={() => {
              reload();
              reloadNeighborhoods();
            }}
          >
            Réessayer
          </button>
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
            <>
              <button
                className="danger-button"
                onClick={() => handleBulkAction('delete')}
              >
                Supprimer ({selectedIds.size})
              </button>
              <details className="dropdown">
                <summary>Actions groupees</summary>
                <div className="dropdown-menu">
                  <button onClick={() => handleBulkAction('approve')}>Approuver</button>
                  <button onClick={() => handleBulkAction('reject')}>Refuser</button>
                  <button onClick={() => handleBulkAction('archive')}>Archiver</button>
                </div>
              </details>
            </>
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
          {formMessage ? <p className="form-error-summary" role="alert">{formMessage}</p> : null}
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="property-title">Titre</label>
              <input
                id="property-title"
                ref={titleRef}
                aria-invalid={Boolean(formErrors.title)}
                aria-describedby={formErrors.title ? 'property-title-error' : undefined}
                value={form.title}
                onChange={event => {
                  setForm({ ...form, title: event.target.value });
                  setFormErrors(previous => ({ ...previous, title: undefined }));
                }}
                placeholder="Villa moderne"
              />
              {formErrors.title ? <small id="property-title-error" className="field-error">{formErrors.title}</small> : null}
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
              <label htmlFor="property-price">Prix (FCFA)</label>
              <input
                id="property-price"
                ref={priceRef}
                aria-invalid={Boolean(formErrors.price)}
                aria-describedby={formErrors.price ? 'property-price-error' : undefined}
                type="number"
                value={form.price}
                onChange={event => {
                  setForm({ ...form, price: event.target.value });
                  setFormErrors(previous => ({ ...previous, price: undefined }));
                }}
                placeholder="350000"
              />
              {formErrors.price ? <small id="property-price-error" className="field-error">{formErrors.price}</small> : null}
            </div>
            <div className="form-field">
              <label htmlFor="property-location">Ville</label>
              <input
                id="property-location"
                ref={locationRef}
                aria-invalid={Boolean(formErrors.location)}
                aria-describedby={formErrors.location ? 'property-location-error' : undefined}
                value={form.location}
                onChange={event => {
                  setForm({ ...form, location: event.target.value });
                  setFormErrors(previous => ({ ...previous, location: undefined }));
                }}
                placeholder="Kara"
              />
              {formErrors.location ? <small id="property-location-error" className="field-error">{formErrors.location}</small> : null}
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
              <label htmlFor="property-images">Images (JPEG, PNG, WebP)</label>
              <input
                id="property-images"
                ref={imagesRef}
                type="file"
                accept={PROPERTY_IMAGE_MIME_TYPES.join(',')}
                multiple
                disabled={compressingImages || saving}
                aria-invalid={Boolean(formErrors.images)}
                aria-describedby={formErrors.images ? 'property-images-error' : 'property-images-help'}
                onChange={event => {
                  const selected = Array.from(event.target.files ?? []);
                  event.currentTarget.value = '';
                  const selectedProperty = editingId
                    ? properties.find(property => property.id === editingId)
                    : null;
                  const savedImageCount = selectedProperty?.property_images?.length ?? 0;
                  const selectionError = validatePropertyImageSelection(selected, savedImageCount);
                  if (selectionError) {
                    setFiles(null);
                    setFormErrors(previous => ({ ...previous, images: selectionError }));
                    return;
                  }
                  setCompressingImages(true);
                  setFormMessage('');
                  void compressPropertyImages(selected)
                    .then(compressed => {
                      const compressionError = validatePropertyImages(compressed, savedImageCount);
                      if (compressionError) throw new Error(compressionError);
                      setFiles(compressed);
                      setFormErrors(previous => ({ ...previous, images: undefined }));
                    })
                    .catch(error => {
                      setFiles(null);
                      setFormErrors(previous => ({
                        ...previous,
                        images: error instanceof Error ? error.message : 'Impossible de compresser les photos.',
                      }));
                    })
                    .finally(() => setCompressingImages(false));
                }}
              />
              <small id="property-images-help" style={{ color: 'var(--muted)' }}>
                Maximum {PROPERTY_IMAGE_MAX_COUNT} photos au total, à{' '}
                {Math.round(PROPERTY_IMAGE_MAX_BYTES / 1024)} Ko chacune (
                {(PROPERTY_IMAGE_MAX_TOTAL_BYTES / 1_000_000).toFixed(1).replace('.', ',')} Mo au total),
                compression automatique.
                {compressingImages ? ' Compression en cours...' : ''}
              </small>
              {formErrors.images ? (
                <small id="property-images-error" className="field-error">{formErrors.images}</small>
              ) : null}
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
          {loading && <LoadingState />}
          {!loading && !error && sortedProperties.length === 0 ? (
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
                    <img
                      src={cover || '/property-placeholder.svg'}
                      alt={property.title}
                      onError={event => {
                        event.currentTarget.src = '/property-placeholder.svg';
                      }}
                    />
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
        <button className="ghost-button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>
          Precedent
        </button>
        <div className="pill">Page {page} / {totalPages}</div>
        <button className="ghost-button" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
          Suivant
        </button>
      </div>
    </div>
  );
}
