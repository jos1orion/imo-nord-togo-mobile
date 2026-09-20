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
  InteractionManager,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import PropertyCard from '../components/PropertyCard';
import SearchBar from '../components/SearchBar';
import TypeFilter from '../components/TypeFilter';
import OfflineBanner from '../components/ui/OfflineBanner';
import EmptyState from '../components/ui/EmptyState';
import { useApp } from '../context/AppContext';
import { Property, PropertyType } from '../types';
import COLORS from '../theme/colors';
import { RootStackParamList } from '../../App';
import { translate } from '../i18n';
import { isFeaturedProperty, isPublicProperty } from '../utils/propertyVisibility';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'recent' | 'priceAsc' | 'priceDesc'>('recent');
  const [neighborhoodOpen, setNeighborhoodOpen] = useState(false);
  const [neighborhoodQuery, setNeighborhoodQuery] = useState('');
  const filteredNeighborhoods = useMemo(() => {
    const cityNeighborhoods = selectedCity
      ? Array.from(new Set(
          properties
            .filter(isPublicProperty)
            .filter(property => (property.city || property.location).toLowerCase() === selectedCity.toLowerCase())
            .map(property => property.neighborhood?.trim())
            .filter((name): name is string => Boolean(name))
        ))
      : neighborhoods;
    const base = neighborhoodQuery.trim()
      ? cityNeighborhoods.filter(name => name.toLowerCase().includes(neighborhoodQuery.trim().toLowerCase()))
      : cityNeighborhoods;
    return [...base].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [neighborhoodQuery, neighborhoods, properties, selectedCity]);
  const cities = useMemo(
    () => Array.from(new Set(properties.filter(isPublicProperty).map(p => (p.city || p.location).trim()).filter(Boolean))).sort(),
    [properties]
  );
  const filteredByNeighborhood = selectedNeighborhood
    ? filteredProperties.filter(
        p => (p.neighborhood ?? '').toLowerCase() === selectedNeighborhood.toLowerCase()
      )
    : filteredProperties;
  const filteredByCity = selectedCity
    ? filteredByNeighborhood.filter(p => (p.city || p.location).toLowerCase() === selectedCity.toLowerCase())
    : filteredByNeighborhood;
  const sortedProperties = useMemo(() => {
    return [...filteredByCity].sort((a, b) => {
      if (sortMode === 'priceAsc') return a.price - b.price;
      if (sortMode === 'priceDesc') return b.price - a.price;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredByCity, sortMode]);

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
  const [listSectionY, setListSectionY] = useState(0);
  const listSectionYRef = useRef(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
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

  const showAllProperties = () => {
    resetFilters();
    setSelectedCity(null);
    setSelectedNeighborhood(null);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(listSectionYRef.current - 12, 0), animated: true });
    });
  };
  const resetAllFilters = () => {
    resetFilters();
    setSelectedCity(null);
    setSelectedNeighborhood(null);
    setNeighborhoodQuery('');
    setSortMode('recent');
  };
  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (selectedCity) chips.push(selectedCity);
    if (selectedNeighborhood) chips.push(selectedNeighborhood);
    if (filterType !== 'ALL') chips.push(tType(filterType));
    if (filters.minPrice || filters.maxPrice) {
      chips.push(`Prix ${filters.minPrice ?? 0} - ${filters.maxPrice ?? '+'}`);
    }
    if (filters.minBedrooms) chips.push(`${filters.minBedrooms}+ ch`);
    if (filters.minBathrooms) chips.push(`${filters.minBathrooms}+ sdb`);
    if (filters.minArea) chips.push(`${filters.minArea} m2+`);
    return chips;
  }, [filters, filterType, selectedCity, selectedNeighborhood, tType]);


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
    setFilterType(type);
    if (listSectionYRef.current > 0) {
      scrollRef.current?.scrollTo({ y: listSectionYRef.current - 10, animated: true });
    }
  };

  const handleSearchSubmit = () => {
    if (listSectionYRef.current > 0) {
      scrollRef.current?.scrollTo({ y: listSectionYRef.current - 10, animated: true });
      return;
    }
    setTimeout(() => {
      if (listSectionYRef.current > 0) {
        scrollRef.current?.scrollTo({ y: listSectionYRef.current - 10, animated: true });
      }
    }, 300);
  };

  const handlePublishPress = () => {
    if (!currentUser) {
      Alert.alert(t('loginRequired'), t('login_required_publish_body'));
      navigation.navigate('MainTabs', { screen: 'Profile' });
      return;
    }
    navigation.navigate('Publish');
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

  const visibleProperties = filterType === 'ALL'
    ? sortedProperties.slice(0, 6)
    : sortedProperties;
  const isLoading = !hydrated;
  const showTopQuickActions = Boolean(currentUser);

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
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
        // Keep the filter bar sticky. Using a constant index avoids UI glitches when
        // conditional blocks above change (user login, sync error).
        stickyHeaderIndices={[1]}
      >

      <View>
        {/* Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.headerTitle}>{t('home_hero_line1')}</Text>
          <Text style={styles.headerTitleEm}>{t('home_hero_line2')}</Text>
          <Text style={styles.headerSubtitle}>{t('home_hero_subtitle')}</Text>

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
                <TouchableOpacity style={styles.activeFiltersReset} onPress={resetAllFilters}>
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
              { key: 'type', label: t('home_filter_type'), active: filterType !== 'ALL' },
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

        {showTopQuickActions && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionCard, styles.quickActionPrimary]}
              onPress={handlePublishPress}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="add" size={18} color="#fff" />
              </View>
              <View style={styles.quickActionText}>
                <Text style={[styles.quickActionTitle, styles.quickActionTitleOnPrimary]}>
                  {t('home_publish_card_title')}
                </Text>
                <Text style={[styles.quickActionSub, styles.quickActionSubOnPrimary]}>
                  {t('home_publish_card_sub')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

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
        <TypeFilter selectedType={filterType} onSelectType={setFilterType} />
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
            <TouchableOpacity onPress={resetAllFilters}>
              <Text style={styles.clearFilter}>{t('filters_reset')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {filtersOpen && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>{t('filter_city')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChoiceRow}>
                <TouchableOpacity
                  style={[styles.filterChoice, !selectedCity && styles.filterChoiceActive]}
                  onPress={() => setSelectedCity(null)}
                >
                  <Text style={[styles.filterChoiceText, !selectedCity && styles.filterChoiceTextActive]}>Toutes</Text>
                </TouchableOpacity>
                {cities.map(city => (
                  <TouchableOpacity
                    key={city}
                    style={[styles.filterChoice, selectedCity === city && styles.filterChoiceActive]}
                    onPress={() => setSelectedCity(city)}
                  >
                    <Text style={[styles.filterChoiceText, selectedCity === city && styles.filterChoiceTextActive]}>{city}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>{t('sort_recent')}</Text>
              <View style={styles.sortRow}>
                {([
                  ['recent', t('sort_recent')],
                  ['priceAsc', t('sort_price_asc')],
                  ['priceDesc', t('sort_price_desc')],
                ] as const).map(([mode, label]) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.filterChoice, sortMode === mode && styles.filterChoiceActive]}
                    onPress={() => setSortMode(mode)}
                  >
                    <Text style={[styles.filterChoiceText, sortMode === mode && styles.filterChoiceTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
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
                  <Text style={styles.dropdownItemText}>Tous les quartiers</Text>
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
                  <Text style={styles.dropdownEmpty}>Aucun quartier</Text>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {[
            { type: 'house' as PropertyType, icon: 'home', color: '#22C55E' },
            { type: 'apartment' as PropertyType, icon: 'business', color: COLORS.primary },
            { type: 'land' as PropertyType, icon: 'map', color: '#F59E0B' },
            { type: 'shop' as PropertyType, icon: 'storefront', color: '#0EA5A4' },
          ].map(item => (
            <TouchableOpacity
              key={item.type}
              style={[
                styles.categoryCard,
                { borderColor: item.color },
                filterType === item.type && styles.categoryCardActive,
              ]}
              onPress={() => {
                handleCategoryPress(item.type);
              }}
            >
              <View style={[styles.categoryIcon, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={24} color={item.color} />
              </View>
              <Text style={styles.categoryText}>{tType(item.type)}</Text>
              <Text style={styles.categoryCount}>
                {propertiesByType.find(p => p.type === item.type)?.count || 0}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Featured Properties */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('featured_title')}</Text>
          <TouchableOpacity onPress={showAllProperties}>
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
            <TouchableOpacity onPress={showAllProperties}>
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
                    scrollRef.current?.scrollTo({ y: listSectionYRef.current - 10, animated: true });
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

      {/* All Properties */}
      <View
        style={styles.section}
        onLayout={event => {
          setListSectionY(event.nativeEvent.layout.y);
          listSectionYRef.current = event.nativeEvent.layout.y;
        }}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {filterType === 'ALL' ? t('all_properties') : tType(filterType)}
          </Text>
          <Text style={styles.count}>{sortedProperties.length} {t('properties_count')}</Text>
        </View>
        {isLoading ? (
          <View style={styles.propertiesGrid}>
            {Array.from({ length: 6 }).map((_, idx) => renderSkeletonCard(`grid-skel-${idx}`))}
          </View>
        ) : visibleProperties.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title={t('empty_category')}
            actionLabel={t('home_empty_reset')}
            onAction={resetAllFilters}
            style={styles.emptyStateWrap}
          />
        ) : (
          <FlatList
            data={visibleProperties}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <PropertyCard
                property={item}
                onPress={() => handlePropertyPress(item)}
              />
            )}
            scrollEnabled={false}
            removeClippedSubviews
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            updateCellsBatchingPeriod={40}
            windowSize={5}
            contentContainerStyle={styles.propertiesList}
          />
        )}
      </View>

      {/* CTA Banner */}
      {!!currentUser && (
        <View style={styles.ctaBanner}>
          <Text style={styles.ctaTitle}>{t('cta_title')}</Text>
          <Text style={styles.ctaText}>{t('cta_text')}</Text>
          <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('Publish')}>
            <Text style={styles.ctaButtonText}>{t('cta_button')}</Text>
          </TouchableOpacity>
        </View>
      )}

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
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBlock: {
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  headerTitleEm: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  quickActions: {
    marginTop: 12,
    paddingHorizontal: 16,
    gap: 12,
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
  filterChoiceRow: {
    gap: 8,
    paddingBottom: 2,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChoice: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChoiceActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChoiceText: {
    fontSize: 12,
    color: '#475569',
  },
  filterChoiceTextActive: {
    color: '#fff',
    fontWeight: '700',
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
  categoriesScroll: {
    marginTop: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  categoryCard: {
    width: 100,
    height: 100,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  categoryCardActive: {
    backgroundColor: '#EFF6FF',
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  categoryCount: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  propertiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  propertiesList: {
    paddingBottom: 4,
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
  ctaBanner: {
    margin: 16,
    marginTop: 24,
    padding: 24,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  ctaText: {
    fontSize: 14,
    color: '#E2E8F0',
    marginBottom: 16,
  },
  ctaButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  ctaButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
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


