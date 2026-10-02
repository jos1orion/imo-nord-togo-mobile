import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  TextInput,
  Alert,
  Modal,
  InteractionManager,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PropertyCard from '../components/PropertyCard';
import SearchBar from '../components/SearchBar';
import OfflineBanner from '../components/ui/OfflineBanner';
import EmptyState from '../components/ui/EmptyState';
import { useApp } from '../context/AppContext';
import { Property, PropertyType } from '../types';
import COLORS from '../theme/colors';
import { RootStackParamList } from '../../App';
import { translate } from '../i18n';
import { isFeaturedProperty, isPublicProperty } from '../utils/propertyVisibility';

const { width } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<RootStackParamList>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const {
    filterType,
    setFilterType,
    searchQuery,
    setSearchQuery,
    properties,
    currentUser,
    neighborhoods,
    getFilteredProperties,
    setSelectedProperty,
    filters,
    setFilters,
    resetFilters,
    addSavedSearch,
    propertyStats,
    visitorCount,
    syncError,
    retrySync,
    t,
    tType,
    hydrated,
    language,
  } = useApp();
  const propertiesByType = useMemo(() => {
    const types: PropertyType[] = ['house', 'apartment', 'land', 'shop'];
    return types.map(type => ({
      type,
      count: properties.filter(p => p.type === type && isPublicProperty(p)).length,
    }));
  }, [properties]);
  const featuredProperties = useMemo(() => {
    const featured = properties.filter(p => isFeaturedProperty(p) && isPublicProperty(p));
    if (featured.length > 0) return featured.slice(0, 10);
    return properties.filter(isPublicProperty).slice(0, 10);
  }, [properties]);
  const recentProperties = useMemo(() => {
    const sorted = [...properties].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
    return sorted.filter(isPublicProperty).slice(0, 8);
  }, [properties]);
  const filteredProperties = getFilteredProperties();
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [neighborhoodOpen, setNeighborhoodOpen] = useState(false);
  const [neighborhoodQuery, setNeighborhoodQuery] = useState('');
  const filteredNeighborhoods = useMemo(() => {
    const base = neighborhoodQuery.trim()
      ? neighborhoods.filter(name => name.toLowerCase().includes(neighborhoodQuery.trim().toLowerCase()))
      : neighborhoods;
    return [...base].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [neighborhoodQuery, neighborhoods]);
  const filteredByNeighborhood = selectedNeighborhood
    ? filteredProperties.filter(
        p => (p.neighborhood ?? '').toLowerCase() === selectedNeighborhood.toLowerCase()
      )
    : filteredProperties;

  useEffect(() => {
    if (!selectedNeighborhood) return;
    const exists = neighborhoods.some(
      name => name.toLowerCase() === selectedNeighborhood.toLowerCase()
    );
    if (!exists) setSelectedNeighborhood(null);
  }, [neighborhoods, selectedNeighborhood]);
  const activeListings = properties.filter(isPublicProperty).length;
  const totalLikes = Object.values(propertyStats).reduce(
    (sum, stats) => sum + (stats.likes ?? 0),
    0
  );
  const listSectionYRef = useRef(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const scrollRef = useRef<FlatList<Property>>(null);
  const [visibleCount, setVisibleCount] = useState(12);

  // Reset the progressive list when the result set changes.
  useEffect(() => {
    setVisibleCount(12);
  }, [filterType, searchQuery, filters, selectedNeighborhood]);
  const suggestionBase = useMemo(() => {
    const cityCandidates = Array.from(
      new Set(
        properties
          .map(p => (p.city ?? p.location ?? '').trim())
          .filter(Boolean)
      )
    ).slice(0, 4);
    const neighborhoodCandidates = neighborhoods.slice(0, 4);
    const city = cityCandidates[0] || 'Kara';
    const hood = neighborhoodCandidates[0] || city;
    return [
      {
        label: translate(language, 'suggestion_house').replace('{{c}}', city),
        query: city,
        type: 'house' as PropertyType,
      },
      {
        label: translate(language, 'suggestion_apartment').replace('{{c}}', city),
        query: city,
        type: 'apartment' as PropertyType,
      },
      {
        label: translate(language, 'suggestion_land').replace('{{c}}', hood),
        query: hood,
        type: 'land' as PropertyType,
      },
    ];
  }, [neighborhoods, properties, language]);

  const applySuggestion = (query: string, type?: PropertyType) => {
    if (type) setFilterType(type);
    setSearchQuery(query);
    handleSearchSubmit();
  };
  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (selectedNeighborhood) chips.push(selectedNeighborhood);
    if (filterType !== 'ALL') chips.push(tType(filterType));
    if (filters.minPrice || filters.maxPrice) {
      chips.push(`Prix ${filters.minPrice ?? 0} - ${filters.maxPrice ?? '+'}`);
    }
    if (filters.minBedrooms) chips.push(`${filters.minBedrooms}+ ch`);
    if (filters.minBathrooms) chips.push(`${filters.minBathrooms}+ sdb`);
    if (filters.minArea) chips.push(`${filters.minArea} m2+`);
    return chips;
  }, [filters, filterType, selectedNeighborhood, tType]);


  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const handlePropertyPress = (property: Property) => {
    setSelectedProperty(property);
    InteractionManager.runAfterInteractions(() => {
      navigation.navigate('PropertyDetail', { propertyId: property.id });
    });
  };

  const handleCategoryPress = (type: PropertyType) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchQuery('');
    resetFilters();
    setSelectedNeighborhood(null);
    setFiltersOpen(false);
    setNeighborhoodOpen(false);
    setNeighborhoodQuery('');
    setFilterType(type);
    setCategoryPickerOpen(false);
    requestAnimationFrame(() => scrollRef.current?.scrollToOffset({ offset: 0, animated: true }));
  };

  const handleCategoryBack = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilterType('ALL');
    setSearchQuery('');
    resetFilters();
    setSelectedNeighborhood(null);
    setFiltersOpen(false);
    setNeighborhoodOpen(false);
    setNeighborhoodQuery('');
    requestAnimationFrame(() => scrollRef.current?.scrollToOffset({ offset: 0, animated: true }));
  };

  const handleSearchSubmit = () => {
    if (listSectionYRef.current > 0) {
      scrollRef.current?.scrollToOffset({ offset: listSectionYRef.current - 10, animated: true });
      return;
    }
    setTimeout(() => {
      if (listSectionYRef.current > 0) {
        scrollRef.current?.scrollToOffset({ offset: listSectionYRef.current - 10, animated: true });
      }
    }, 300);
  };

  const handleFilterChange = (
    key: 'minPrice' | 'maxPrice' | 'minBedrooms' | 'minBathrooms' | 'minArea',
    value: string
  ) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setFilters({ [key]: cleaned ? parseInt(cleaned, 10) : null });
  };

  const handleSaveSearch = () => {
    const labelParts: string[] = [];
    if (searchQuery.trim()) labelParts.push(searchQuery.trim());
    if (filterType !== 'ALL') labelParts.push(tType(filterType));
    if (filters.minPrice || filters.maxPrice) {
      labelParts.push(
        `${t('price_label')} ${filters.minPrice ? `${filters.minPrice}` : '0'}-${filters.maxPrice ?? '+'}`
      );
    }
    if (filters.minBedrooms) labelParts.push(`${filters.minBedrooms}+ ${t('bedrooms_label')}`);
    if (filters.minArea) labelParts.push(`${filters.minArea} ${t('area_label')}+`);

    const label = labelParts.join(' | ') || t('save_search_done_title');

    addSavedSearch({
      label,
      query: searchQuery.trim(),
      type: filterType,
      filters,
    });
    Alert.alert(t('save_search_done_title'), t('save_search_done_message'));
  };

  const visibleProperties = filteredByNeighborhood.slice(0, visibleCount);
  const hasMoreProperties = visibleProperties.length < filteredByNeighborhood.length;
  const loadMoreProperties = () => {
    if (hasMoreProperties) setVisibleCount(count => count + 12);
  };
  const isLoading = !hydrated;

  const renderSkeletonCard = (key: string, compact = false) => (
    <View key={key} style={[styles.skeletonCard, compact && styles.skeletonCardCompact]}>
      <View style={[styles.skeletonImage, compact && styles.skeletonImageCompact]} />
      <View style={styles.skeletonBody}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
        {!compact && (
          <View style={styles.skeletonMetaRow}>
            <View style={styles.skeletonPill} />
            <View style={styles.skeletonDot} />
          </View>
        )}
      </View>
    </View>
  );

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <OfflineBanner />
      {filterType !== 'ALL' && (
        <View style={[styles.categoryNavigationBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            style={styles.categoryBackButton}
            onPress={handleCategoryBack}
            accessibilityRole="button"
            accessibilityLabel={t('back')}
            accessibilityHint={t('home_category_back_hint')}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={19} color={COLORS.primary} />
            <Text style={styles.categoryBackText}>{t('back')}</Text>
          </TouchableOpacity>
          <View style={styles.categoryNavigationDetails}>
            <Text style={styles.categoryResultsTitle}>{tType(filterType)}</Text>
            <Text style={styles.categoryResultsSubtitle}>
              {t('home_category_results_subtitle')}
            </Text>
          </View>
          <View style={styles.categoryResultsCount}>
            <Text style={styles.categoryResultsCountText}>{filteredByNeighborhood.length}</Text>
          </View>
        </View>
      )}
      <FlatList
        ref={scrollRef}
        style={styles.container}
        showsVerticalScrollIndicator={false}
        data={isLoading ? [] : visibleProperties}
        keyExtractor={property => property.id}
        renderItem={({ item }) => (
          <View style={styles.propertyListItem}>
            <PropertyCard property={item} onPress={() => handlePropertyPress(item)} />
          </View>
        )}
        onEndReached={loadMoreProperties}
        onEndReachedThreshold={0.45}
        ListHeaderComponent={<>

      {filterType === 'ALL' && (
      <>
      <View>
        {/* Header */}
        <View style={[styles.headerBlock, { paddingTop: insets.top + 18 }]}>
          <Text style={styles.headerTitle}>{t('home_hero_line1')}</Text>
          <Text style={styles.headerTitleEm}>{t('home_hero_line2')}</Text>

          <View style={styles.searchCard}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>{t('home_search_card_title')}</Text>
            </View>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('home_search_placeholder')}
              onSearch={handleSearchSubmit}
            />
            <View style={styles.suggestionRow}>
              {suggestionBase.map(item => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.suggestionChip}
                  onPress={() => applySuggestion(item.query, item.type)}
                >
                  <Ionicons name="sparkles" size={12} color={COLORS.primary} />
                  <Text style={styles.suggestionText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {activeFilterChips.length > 0 && (
              <View style={styles.activeFiltersRow}>
                <View style={styles.activeFiltersWrap}>
                  {activeFilterChips.map(label => (
                    <View key={label} style={styles.activeFilterChip}>
                      <Text style={styles.activeFilterText}>{label}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={styles.activeFiltersReset} onPress={resetFilters}>
                  <Ionicons name="refresh" size={14} color={COLORS.primary} />
                  <Text style={styles.activeFiltersResetText}>{t('home_reset_short')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipRow}
          >
            {[
              {
                key: 'beds',
                label: t('home_filter_beds_baths'),
                active: Boolean(filters.minBedrooms || filters.minBathrooms),
              },
              {
                key: 'price',
                label: t('home_filter_price'),
                active: Boolean(filters.minPrice || filters.maxPrice),
              },
              {
                key: 'hood',
                label: t('home_filter_neighborhood'),
                active: Boolean(selectedNeighborhood),
              },
              { key: 'area', label: t('home_filter_area'), active: Boolean(filters.minArea) },
              { key: 'more', label: t('home_filter_more'), active: Boolean(filtersOpen) },
            ].map(item => (
              <TouchableOpacity
                key={item.key}
                style={[styles.filterChip, item.active && styles.filterChipActive]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setFiltersOpen(true);
                  if (item.key === 'hood') setNeighborhoodOpen(true);
                }}
              >
                <Text style={[styles.filterChipText, item.active && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {syncError && (
          <View style={styles.syncErrorCard}>
            <View style={styles.syncErrorRow}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.syncErrorText}>{syncError}</Text>
            </View>
            <TouchableOpacity style={styles.syncRetryButton} onPress={retrySync}>
              <Text style={styles.syncRetryText}>{t('sync_retry')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {/* Filter */}
      <View style={styles.filterSticky}>
        {selectedNeighborhood && (
          <View style={styles.neighborhoodBadgeRow}>
            <View style={styles.neighborhoodBadge}>
              <Ionicons name="location" size={14} color={COLORS.primary} />
              <Text style={styles.neighborhoodBadgeText} numberOfLines={1}>
                {selectedNeighborhood}
              </Text>
              <TouchableOpacity onPress={() => setSelectedNeighborhood(null)}>
                <Ionicons name="close" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={styles.filterHeader}>
          <Text style={styles.filterTitle}>{t('filters_title')}</Text>
          <View style={styles.filterActions}>
            <TouchableOpacity onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setFiltersOpen(prev => !prev);
            }}>
              <Text style={styles.filterToggle}>
                {filtersOpen ? t('filters_hide') : t('filters_show')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resetFilters}>
              <Text style={styles.clearFilter}>{t('filters_reset')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {filtersOpen && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>{t('filter_label_neighborhood')}</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setNeighborhoodOpen(prev => !prev);
                }}
              >
                <Text style={styles.dropdownButtonText} numberOfLines={1}>
                  {selectedNeighborhood || t('filter_all_neighborhoods')}
                </Text>
                <Ionicons
                  name={neighborhoodOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
          </View>
          {neighborhoodOpen && (
            <View style={styles.dropdownPanel}>
              <View style={styles.dropdownSearchRow}>
                <Ionicons name="search" size={14} color="#94A3B8" />
                <TextInput
                  style={styles.dropdownSearchInput}
                  value={neighborhoodQuery}
                  onChangeText={setNeighborhoodQuery}
                  placeholder={t('filter_search_neighborhood_ph')}
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedNeighborhood(null);
                    setNeighborhoodOpen(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{t('home_all_neighborhoods')}</Text>
                </TouchableOpacity>
                {filteredNeighborhoods.map(name => (
                  <TouchableOpacity
                    key={name}
                    style={[
                      styles.dropdownItem,
                      selectedNeighborhood === name && styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setSelectedNeighborhood(name);
                      setNeighborhoodOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        selectedNeighborhood === name && styles.dropdownItemTextActive,
                      ]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {filteredNeighborhoods.length === 0 && (
                  <Text style={styles.dropdownEmpty}>{t('home_no_neighborhoods')}</Text>
                )}
              </ScrollView>
            </View>
          )}
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>{t('filter_price_min')}</Text>
              <TextInput
                style={styles.filterInput}
                value={filters.minPrice ? String(filters.minPrice) : ''}
                onChangeText={value => handleFilterChange('minPrice', value)}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>{t('filter_price_max')}</Text>
              <TextInput
                style={styles.filterInput}
                value={filters.maxPrice ? String(filters.maxPrice) : ''}
                onChangeText={value => handleFilterChange('maxPrice', value)}
                placeholder="50000000"
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>{t('filter_bedrooms_min')}</Text>
              <TextInput
                style={styles.filterInput}
                value={filters.minBedrooms ? String(filters.minBedrooms) : ''}
                onChangeText={value => handleFilterChange('minBedrooms', value)}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>{t('filter_bathrooms_min')}</Text>
              <TextInput
                style={styles.filterInput}
                value={filters.minBathrooms ? String(filters.minBathrooms) : ''}
                onChangeText={value => handleFilterChange('minBathrooms', value)}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>{t('filter_area_min')}</Text>
              <TextInput
                style={styles.filterInput}
                value={filters.minArea ? String(filters.minArea) : ''}
                onChangeText={value => handleFilterChange('minArea', value)}
                placeholder="50"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>{t('filter_date_label')}</Text>
              <View style={styles.filterStatic}>
                <Ionicons name="calendar" size={14} color="#94A3B8" />
                <Text style={styles.filterStaticText}>{t('filter_last_30_days')}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.saveSearchButton} onPress={handleSaveSearch}>
            <Ionicons name="bookmark" size={16} color={COLORS.primary} />
            <Text style={styles.saveSearchText}>{t('save_search')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('categories_title')}</Text>
        <TouchableOpacity
          style={styles.chooseCategoryButton}
          onPress={() => setCategoryPickerOpen(true)}
          accessibilityRole="button"
        >
          <View style={styles.chooseCategoryIcon}>
            <Ionicons name="grid-outline" size={20} color={COLORS.primary} />
          </View>
          <Text style={styles.chooseCategoryText}>{t('home_choose_category')}</Text>
          <Ionicons name="chevron-forward" size={19} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Featured Properties */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('featured_title')}</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>{t('see_all')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featuredRow}
        >
          {isLoading
            ? Array.from({ length: 4 }).map((_, idx) =>
                renderSkeletonCard(`featured-skel-${idx}`, true)
              )
            : featuredProperties.map(property => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onPress={() => handlePropertyPress(property)}
                  compact
                />
              ))}
        </ScrollView>
      </View>

      {recentProperties.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home_recent_title')}</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>{t('see_all')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredRow}
          >
            {recentProperties.map(property => (
              <PropertyCard
                key={property.id}
                property={property}
                onPress={() => handlePropertyPress(property)}
                compact
              />
            ))}
          </ScrollView>
        </View>
      )}

      {neighborhoods.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home_neighborhoods_popular')}</Text>
            <TouchableOpacity onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setFiltersOpen(true);
              setNeighborhoodOpen(true);
            }}>
              <Text style={styles.seeAll}>{t('home_explore')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.neighborhoodsScroll}
          >
            {neighborhoods.slice(0, 12).map(name => (
              <TouchableOpacity
                key={name}
                style={[
                  styles.neighborhoodChip,
                  selectedNeighborhood === name && styles.neighborhoodChipActive,
                ]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setSelectedNeighborhood(name);
                  if (listSectionYRef.current > 0) {
                    scrollRef.current?.scrollToOffset({ offset: listSectionYRef.current - 10, animated: true });
                  }
                }}
              >
                <Text
                  style={[
                    styles.neighborhoodChipText,
                    selectedNeighborhood === name && styles.neighborhoodChipTextActive,
                  ]}
                >
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      </>
      )}

      {filterType === 'ALL' && (
        <View
          style={styles.section}
          onLayout={event => {
            listSectionYRef.current = event.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('all_properties')}</Text>
            <Text style={styles.count}>{filteredByNeighborhood.length} {t('properties_count')}</Text>
          </View>
        </View>
      )}
        </>}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.propertiesGrid}>
              {Array.from({ length: 6 }).map((_, idx) => renderSkeletonCard(`grid-skel-${idx}`))}
            </View>
          ) : (
            <EmptyState
              icon="search-outline"
              title={t('empty_category')}
              actionLabel={filterType === 'ALL' ? t('home_empty_reset') : t('back')}
              onAction={filterType === 'ALL' ? resetFilters : handleCategoryBack}
              style={styles.emptyStateWrap}
            />
          )
        }
        ListFooterComponent={filterType === 'ALL' ? <>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('reviews_title')}</Text>
        <View style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <Ionicons name="star" size={16} color="#F59E0B" />
            <Text style={styles.reviewTitle}>5.0</Text>
          </View>
          <Text style={styles.reviewText}>{t('review_1')}</Text>
        </View>
        <View style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <Ionicons name="star" size={16} color="#F59E0B" />
            <Text style={styles.reviewTitle}>4.8</Text>
          </View>
          <Text style={styles.reviewText}>{t('review_2')}</Text>
        </View>
      </View>

      {!currentUser && (
        <View style={styles.bottomCta}>
          <TouchableOpacity
            style={[styles.quickActionCard, styles.quickActionPrimary]}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="log-in" size={18} color="#fff" />
            </View>
            <View style={styles.quickActionText}>
              <Text style={[styles.quickActionTitle, styles.quickActionTitleOnPrimary]}>
                {t('home_connect_title')}
              </Text>
              <Text style={[styles.quickActionSub, styles.quickActionSubOnPrimary]}>
                {t('home_connect_sub')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('footer_rights')}</Text>
        <Text style={styles.footerSubtext}>{t('footer_location')}</Text>
      </View>
      {hasMoreProperties && !isLoading && (
        <TouchableOpacity style={styles.loadMoreButton} onPress={loadMoreProperties}>
          <Text style={styles.loadMoreText}>{t('home_load_more')}</Text>
        </TouchableOpacity>
      )}
      </> : null}
      />
      <Modal
        visible={categoryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryPickerOpen(false)}
      >
        <View style={styles.categoryModalBackdrop}>
          <View style={styles.categoryModal}>
            <View style={styles.categoryModalHeader}>
              <View style={styles.categoryModalTitleWrap}>
                <Text style={styles.categoryModalTitle}>{t('home_choose_category')}</Text>
                <Text style={styles.categoryModalSubtitle}>
                  {t('home_choose_category_subtitle')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.categoryModalClose}
                onPress={() => setCategoryPickerOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('close')}
              >
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>
            {[
              { type: 'house' as PropertyType, icon: 'home', color: '#22C55E' },
              { type: 'apartment' as PropertyType, icon: 'business', color: COLORS.primary },
              { type: 'land' as PropertyType, icon: 'map', color: '#F59E0B' },
              { type: 'shop' as PropertyType, icon: 'storefront', color: '#0EA5A4' },
            ].map(item => (
              <TouchableOpacity
                key={item.type}
                style={styles.categoryOption}
                onPress={() => handleCategoryPress(item.type)}
                accessibilityRole="button"
              >
                <View style={[styles.categoryOptionIcon, { backgroundColor: `${item.color}18` }]}>
                  <Ionicons name={item.icon as any} size={21} color={item.color} />
                </View>
                <Text style={styles.categoryOptionText}>{tType(item.type)}</Text>
                <Text style={styles.categoryOptionCount}>
                  {propertiesByType.find(propertyType => propertyType.type === item.type)?.count ?? 0}
                </Text>
                <Ionicons name="chevron-forward" size={17} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBlock: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'left',
  },
  headerTitleEm: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'left',
    marginTop: 0,
  },
  headerSubtitle: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textMuted,
    textAlign: 'left',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  bottomCta: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  quickActionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickActionPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  quickActionIconLight: {
    backgroundColor: '#EFF6FF',
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  quickActionTitleOnPrimary: {
    color: '#fff',
  },
  quickActionSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  quickActionSubOnPrimary: {
    color: '#E0E7FF',
  },
  searchCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.text,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
    marginTop: 16,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  searchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.infoBg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  suggestionText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
  },
  filterChipRow: {
    paddingHorizontal: 4,
    gap: 10,
    marginTop: 14,
    paddingBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.card,
  },
  filterChipActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  filterChipText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: COLORS.card,
  },
  activeFiltersRow: {
    marginTop: 12,
    gap: 10,
  },
  activeFiltersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeFilterChip: {
    backgroundColor: COLORS.text,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activeFilterText: {
    fontSize: 11,
    color: COLORS.card,
    fontWeight: '700',
  },
  activeFiltersReset: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.infoBg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  activeFiltersResetText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  syncErrorCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  syncErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '600',
  },
  syncRetryButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  syncRetryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  filterSticky: {
    backgroundColor: '#F8FAFC',
    paddingTop: 6,
    paddingBottom: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterHeader: {
    marginTop: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  filterToggle: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  clearFilter: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  filtersPanel: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
    flexWrap: 'wrap',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F5F7FA',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxWidth: '100%',
  },
  trustText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: '#111827',
    flexShrink: 1,
  },
  trustSub: {
    marginHorizontal: 16,
    marginTop: 6,
    fontSize: 12,
    color: '#64748B',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  filterField: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 6,
    fontWeight: '600',
  },
  filterInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 13,
    color: '#111827',
  },
  filterStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterStaticText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  dropdownButton: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  dropdownPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  dropdownSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#111827',
  },
  dropdownList: {
    marginTop: 8,
    maxHeight: 220,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  dropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownItemText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  dropdownItemTextActive: {
    color: COLORS.primary,
  },
  dropdownEmpty: {
    fontSize: 11,
    color: '#64748B',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  saveSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
  },
  saveSearchText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  neighborhoods: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  neighborhoodBadgeRow: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  neighborhoodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F7FA',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  neighborhoodBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    maxWidth: 220,
  },
  neighborhoodsScroll: {
    marginTop: 8,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  neighborhoodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F5F7FA',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  neighborhoodChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  neighborhoodChipText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  neighborhoodChipTextActive: {
    color: '#fff',
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  count: {
    fontSize: 14,
    color: '#6B7280',
  },
  chooseCategoryButton: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chooseCategoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseCategoryText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  categoryNavigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoryBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 11,
  },
  categoryBackText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  categoryNavigationDetails: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  categoryResultsTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
  },
  categoryResultsSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 3,
  },
  categoryResultsCount: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryResultsCountText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  categoryModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  categoryModalTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  categoryModalTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
  },
  categoryModalSubtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 5,
  },
  categoryModalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryOption: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  categoryOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryOptionText: {
    flex: 1,
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryOptionCount: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  propertiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  propertyListItem: {
    paddingHorizontal: 16,
  },
  loadMoreButton: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
  },
  loadMoreText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 8,
    marginVertical: 8,
    width: width - 32,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  skeletonCardCompact: {
    width: width * 0.8,
    marginVertical: 6,
  },
  skeletonImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#E2E8F0',
  },
  skeletonImageCompact: {
    height: 150,
  },
  skeletonBody: {
    padding: 14,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    marginBottom: 10,
    width: '80%',
  },
  skeletonLineShort: {
    width: '50%',
  },
  skeletonMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  skeletonPill: {
    width: 80,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  skeletonDot: {
    width: 48,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featuredRow: {
    paddingRight: 16,
    gap: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  reviewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  reviewText: {
    fontSize: 13,
    color: '#6B7280',
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 6,
  },
  emptyStateWrap: {
    width: '100%',
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  emptyReset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
  },
  emptyResetText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  footer: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
});

export default HomeScreen;
