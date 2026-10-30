import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ImageBackground,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlert as Alert } from '../components/ui/appAlertService';
import EmptyState from '../components/ui/EmptyState';
import OfflineBanner from '../components/ui/OfflineBanner';
import PropertyCard from '../components/PropertyCard';
import SearchBar from '../components/SearchBar';
import Skeleton from '../components/ui/Skeleton';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../../App';
import { Property, PropertyType, SavedSearch, PROPERTY_TYPE_COLORS } from '../types';
import { getRecentProperties } from '../utils/recentProperties';
import { isFeaturedProperty, isPublicProperty } from '../utils/propertyVisibility';
import { COLORS } from '../theme/colors';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import { RADIUS, SPACING } from '../theme/spacing';
import { typography } from '../theme/typography';
import heroImage from '../../assets/branding/maison-ocre.jpg';

type NavigationProp = StackNavigationProp<RootStackParamList>;
type PlacePicker = 'city' | 'neighborhood' | null;
type SortMode = 'recent' | 'priceAsc' | 'priceDesc';

const CATEGORY_OPTIONS: {
  type: PropertyType;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { type: 'house', icon: 'home-outline' },
  { type: 'apartment', icon: 'business-outline' },
  { type: 'land', icon: 'map-outline' },
  { type: 'shop', icon: 'storefront-outline' },
];

const CITIES = ['KARA', 'SOKODE', 'BLITA', 'SOTOUBOUA', 'KANTE', 'MANGO', 'DAPAONG'];

const HERO_SCRIM_STOPS = [
  'rgba(5, 17, 34, 0.04)',
  'rgba(5, 17, 34, 0.08)',
  'rgba(5, 17, 34, 0.12)',
  'rgba(5, 17, 34, 0.18)',
  'rgba(5, 17, 34, 0.24)',
  'rgba(5, 17, 34, 0.31)',
  'rgba(5, 17, 34, 0.39)',
  'rgba(5, 17, 34, 0.48)',
  'rgba(5, 17, 34, 0.58)',
  'rgba(5, 17, 34, 0.68)',
  'rgba(5, 17, 34, 0.77)',
  'rgba(5, 17, 34, 0.84)',
];

const matchesSavedSearch = (property: Property, search: SavedSearch) => {
  const publishedAt = new Date(property.publishedAt ?? property.createdAt).getTime();
  const savedAt = new Date(search.createdAt).getTime();
  if (!Number.isFinite(publishedAt) || !Number.isFinite(savedAt) || publishedAt <= savedAt) return false;
  if (search.type !== 'ALL' && property.type !== search.type) return false;
  if (search.filters.minPrice !== null && property.price < search.filters.minPrice) return false;
  if (search.filters.maxPrice !== null && property.price > search.filters.maxPrice) return false;
  if (search.filters.minBedrooms !== null && (property.bedrooms ?? 0) < search.filters.minBedrooms) return false;
  if (search.filters.minBathrooms !== null && (property.bathrooms ?? 0) < search.filters.minBathrooms) return false;
  if (search.filters.minArea !== null && (property.area ?? 0) < search.filters.minArea) return false;
  const query = search.query.trim().toLocaleLowerCase();
  if (!query) return true;
  return [
    property.title,
    property.location,
    property.neighborhood ?? '',
    property.city,
    property.description,
  ].some(value => value.toLocaleLowerCase().includes(query));
};

const HomeScreen: React.FC = () => {
  const styles = useThemedStyles(baseStyles);
  const colors = useThemeColors();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Property>>(null);
  const searchSectionOffset = useRef(0);
  const {
    properties,
    neighborhoods,
    filterType,
    setFilterType,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    resetFilters,
    getFilteredProperties,
    setSelectedProperty,
    trackPropertyView,
    favorites,
    savedSearches,
    searchHistory,
    recentViewedIds,
    addSearchHistory,
    addSavedSearch,
    currentUser,
    hydrated,
    syncError,
    retrySync,
    t,
    tType,
  } = useApp();

  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [placePicker, setPlacePicker] = useState<PlacePicker>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [visibleCount, setVisibleCount] = useState(8);

  const publicProperties = useMemo(
    () => properties.filter(isPublicProperty),
    [properties]
  );
  const neighborhoodsForCity = useMemo(() => {
    const names = selectedCity
      ? publicProperties
        .filter(property => (property.city || property.location).toLowerCase() === selectedCity.toLowerCase())
        .map(property => property.neighborhood?.trim())
      : [...neighborhoods, ...publicProperties.map(property => property.neighborhood?.trim())];
    return [...new Set(names.filter((name): name is string => Boolean(name)))]
      .sort((a, b) => a.localeCompare(b));
  }, [neighborhoods, publicProperties, selectedCity]);

  const filteredProperties = getFilteredProperties()
    .filter(property => !selectedCity
      || (property.city || property.location).toLowerCase() === selectedCity.toLowerCase())
    .filter(property => !selectedNeighborhood
      || (property.neighborhood ?? '').toLowerCase() === selectedNeighborhood.toLowerCase())
    .sort((a, b) => {
      if (sortMode === 'priceAsc') return a.price - b.price;
      if (sortMode === 'priceDesc') return b.price - a.price;
      return new Date(b.publishedAt ?? b.createdAt).getTime()
        - new Date(a.publishedAt ?? a.createdAt).getTime();
    });

  const featuredProperties = useMemo(
    () => publicProperties.filter(isFeaturedProperty).slice(0, 8),
    [publicProperties]
  );
  const recentProperties = useMemo(
    () => getRecentProperties(publicProperties).slice(0, 6),
    [publicProperties]
  );
  const recentViewedProperties = useMemo(() => recentViewedIds
    .map(id => publicProperties.find(property => property.id === id))
    .filter((property): property is Property => Boolean(property))
    .slice(0, 8), [publicProperties, recentViewedIds]);
  const newMatches = useMemo(() => {
    const matchedIds = new Set(
      savedSearches.flatMap(search => publicProperties
        .filter(property => matchesSavedSearch(property, search))
        .map(property => property.id))
    );
    return publicProperties
      .filter(property => matchedIds.has(property.id))
      .sort((a, b) => new Date(b.publishedAt ?? b.createdAt).getTime()
        - new Date(a.publishedAt ?? a.createdAt).getTime())
      .slice(0, 8);
  }, [publicProperties, savedSearches]);
  const favoriteProperties = useMemo(() => publicProperties
    .filter(property => favorites.includes(property.id))
    .slice(0, 8), [favorites, publicProperties]);
  const preferredTypes = useMemo(() => {
    const preferenceSource = recentViewedProperties[0] ?? favoriteProperties[0];
    return preferenceSource ? [preferenceSource.type] : [];
  }, [favoriteProperties, recentViewedProperties]);
  const recommendedProperties = useMemo(() => {
    const excludedIds = new Set([
      ...recentViewedProperties.map(property => property.id),
      ...favoriteProperties.map(property => property.id),
    ]);
    const matching = publicProperties.filter(property =>
      !excludedIds.has(property.id) && preferredTypes.includes(property.type)
    );
    const fallback = publicProperties.filter(property => !excludedIds.has(property.id));
    return (matching.length ? matching : fallback).slice(0, 8);
  }, [favoriteProperties, preferredTypes, publicProperties, recentViewedProperties]);

  const categoryCounts = useMemo(() => CATEGORY_OPTIONS.map(option => ({
    ...option,
    count: publicProperties.filter(property => property.type === option.type).length,
  })), [publicProperties]);

  const openProperty = (property: Property) => {
    setSelectedProperty(property);
    trackPropertyView(property.id);
    navigation.navigate('PropertyDetail', { propertyId: property.id });
  };

  const handleSearch = () => {
    const query = searchQuery.trim();
    if (query) addSearchHistory(query);
    Keyboard.dismiss();
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: searchSectionOffset.current, animated: true }));
  };

  const resetAllFilters = () => {
    resetFilters();
    setFilterType('ALL');
    setSearchQuery('');
    setSelectedCity(null);
    setSelectedNeighborhood(null);
    setSortMode('recent');
    setVisibleCount(8);
  };

  const applyCategory = (type: PropertyType | 'ALL') => {
    setFilterType(type);
    setVisibleCount(8);
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: searchSectionOffset.current, animated: true }));
  };

  const updatePrice = (key: 'minPrice' | 'maxPrice', text: string) => {
    if (!/^\d*$/.test(text)) return;
    setFilters({ [key]: text ? Number(text) : null });
    setVisibleCount(8);
  };

  const updateMinimumFilter = (
    key: 'minBedrooms' | 'minBathrooms' | 'minArea',
    text: string
  ) => {
    if (!/^\d*$/.test(text)) return;
    setFilters({ [key]: text ? Number(text) : null });
    setVisibleCount(8);
  };

  const renderMinimumFilter = (
    key: 'minBedrooms' | 'minBathrooms' | 'minArea',
    label: string,
    unit?: string
  ) => (
    <View key={key} style={styles.minimumInputWrap}>
      <Text style={styles.budgetHint}>{label}</Text>
      <View style={styles.minimumInputRow}>
        <TextInput
          value={filters[key]?.toString() ?? ''}
          onChangeText={text => updateMinimumFilter(key, text)}
          placeholder="—"
          placeholderTextColor={colors.onSurfaceSoft}
          keyboardType="number-pad"
          style={styles.minimumInput}
          accessibilityLabel={label}
        />
        {unit ? <Text style={styles.minimumUnit}>{unit}</Text> : null}
      </View>
    </View>
  );

  const saveCurrentSearch = () => {
    const query = searchQuery.trim();
    const labelParts = [
      query,
      selectedNeighborhood,
      selectedCity,
      filterType === 'ALL' ? '' : tType(filterType),
    ].filter(Boolean);
    addSavedSearch({
      label: labelParts.join(' · ') || t('home_search_card_title'),
      query,
      type: filterType,
      filters,
    });
    Alert.alert(t('save_search_done_title'), t('save_search_done_message'));
  };

  const applySavedSearch = (saved: (typeof savedSearches)[number]) => {
    setSearchQuery(saved.query);
    setFilterType(saved.type);
    setFilters(saved.filters);
    setSelectedCity(null);
    setSelectedNeighborhood(null);
    setVisibleCount(8);
    Keyboard.dismiss();
  };

  const openPlacePicker = (picker: Exclude<PlacePicker, null>) => {
    setPlacePicker(picker);
    setPlaceQuery('');
  };

  const choosePlace = (place: string | null) => {
    if (placePicker === 'city') {
      setSelectedCity(place);
      setSelectedNeighborhood(null);
    } else {
      setSelectedNeighborhood(place);
    }
    setVisibleCount(8);
    setPlacePicker(null);
  };

  const placeOptions = placePicker === 'city' ? CITIES : neighborhoodsForCity;
  const filteredPlaceOptions = placeOptions.filter(place =>
    place.toLowerCase().includes(placeQuery.trim().toLowerCase())
  );
  const hasActiveFilters = Boolean(
    searchQuery || selectedCity || selectedNeighborhood || filterType !== 'ALL'
    || filters.minPrice !== null || filters.maxPrice !== null
    || filters.minBedrooms !== null || filters.minBathrooms !== null || filters.minArea !== null
  );
  const resultsHeading = filterType === 'ALL' ? t('all_properties') : tType(filterType);
  const sectionTitle = (title: string, action?: string, onAction?: () => void) => (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} accessibilityRole="button">
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
  const renderCarousel = (title: string, items: Property[]) => {
    if (!items.length) return null;
    return (
      <Animated.View entering={FadeInDown.duration(350)} style={styles.section}>
        {sectionTitle(title)}
        <FlatList
          horizontal
          data={items}
          keyExtractor={item => `${title}-${item.id}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          renderItem={({ item }) => (
            <PropertyCard
              property={item}
              compact
              isFeatured={isFeaturedProperty(item)}
              onPress={() => openProperty(item)}
            />
          )}
        />
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <View>
      <Animated.View entering={FadeInDown.duration(500)} style={[styles.hero, width < 360 && styles.heroCompact]}>
        <ImageBackground source={heroImage} style={styles.heroImage} imageStyle={styles.heroImageCorners}>
          <View style={styles.heroScrim} />
          <View pointerEvents="none" style={styles.heroGradient}>
            {HERO_SCRIM_STOPS.map((backgroundColor, index) => (
              <View
                key={`hero-scrim-${index}`}
                style={[styles.heroGradientStop, { backgroundColor }]}
              />
            ))}
          </View>
          <View style={styles.heroContent}>
            <View style={styles.heroTopline}>
              <View style={styles.brandPill}>
                <Ionicons name="diamond-outline" size={14} color={colors.premiumGold} />
                <Text style={styles.brandText}>ImoPrestige</Text>
              </View>
            </View>
            <View style={styles.heroBottom}>
              <Text style={styles.heroEyebrow}>{t('app_tagline')}</Text>
              <Text style={[styles.heroTitle, width < 360 && styles.heroTitleCompact]}>
                {t('home_hero_line1')}{' '}
                <Text style={styles.heroTitleAccent}>{t('home_hero_line2')}</Text>
              </Text>
              <Text style={styles.heroSubtitle}>{t('home_featured_subtitle')}</Text>
              <TouchableOpacity
                style={styles.heroCta}
                onPress={() => listRef.current?.scrollToOffset({ offset: searchSectionOffset.current, animated: true })}
                accessibilityRole="button"
              >
                <Text style={styles.heroCtaText}>{t('home_explore')}</Text>
                <Ionicons name="arrow-forward" size={17} color={colors.premiumDarkBlue} />
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(80).duration(450)}
        style={styles.searchCard}
        onLayout={event => {
          searchSectionOffset.current = event.nativeEvent.layout.y;
        }}
      >
        <View style={styles.searchTitleRow}>
          <View style={styles.searchTitleIcon}>
            <Ionicons name="search" size={18} color={colors.primary} />
          </View>
          <View style={styles.searchTitleCopy}>
            <Text style={styles.searchTitle}>{t('home_search_card_title')}</Text>
            <Text style={styles.searchSubtitle}>{t('home_search_guide')}</Text>
          </View>
        </View>
        <SearchBar
          value={searchQuery}
          onChangeText={value => {
            setSearchQuery(value);
            setVisibleCount(8);
          }}
          placeholder={t('home_search_placeholder')}
          onSearch={handleSearch}
        />

        <View style={styles.locationRow}>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={() => openPlacePicker('city')}
            accessibilityRole="button"
          >
            <Ionicons name="location-outline" size={16} color={colors.primary} />
            <Text style={styles.locationButtonText} numberOfLines={1}>
              {selectedCity ?? t('home_select_city')}
            </Text>
            <Ionicons name="chevron-down" size={15} color={colors.onSurfaceMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={() => openPlacePicker('neighborhood')}
            accessibilityRole="button"
          >
            <Ionicons name="navigate-outline" size={15} color={colors.primary} />
            <Text style={styles.locationButtonText} numberOfLines={1}>
              {selectedNeighborhood ?? t('home_select_neighborhood')}
            </Text>
            <Ionicons name="chevron-down" size={15} color={colors.onSurfaceMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.filterDivider} />
        <View style={styles.budgetHeader}>
          <View style={styles.budgetLabelRow}>
            <Ionicons name="wallet-outline" size={16} color={colors.primary} />
            <Text style={styles.filterLabel}>{t('home_filter_price')}</Text>
          </View>
          {hasActiveFilters ? (
            <TouchableOpacity onPress={resetAllFilters} accessibilityRole="button">
              <Text style={styles.resetText}>{t('home_reset_short')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.budgetRow}>
          <View style={styles.budgetInputWrap}>
            <Text style={styles.budgetHint}>{t('filter_price_min')}</Text>
            <TextInput
              value={filters.minPrice?.toString() ?? ''}
              onChangeText={text => updatePrice('minPrice', text)}
              placeholder="0"
              placeholderTextColor={colors.onSurfaceSoft}
              keyboardType="number-pad"
              style={styles.budgetInput}
              accessibilityLabel={t('filter_price_min')}
            />
            <Text style={styles.currencySuffix}>FCFA</Text>
          </View>
          <View style={styles.budgetRangeDash} />
          <View style={styles.budgetInputWrap}>
            <Text style={styles.budgetHint}>{t('filter_price_max')}</Text>
            <TextInput
              value={filters.maxPrice?.toString() ?? ''}
              onChangeText={text => updatePrice('maxPrice', text)}
              placeholder="—"
              placeholderTextColor={colors.onSurfaceSoft}
              keyboardType="number-pad"
              style={styles.budgetInput}
              accessibilityLabel={t('filter_price_max')}
            />
            <Text style={styles.currencySuffix}>FCFA</Text>
          </View>
        </View>
        <View style={styles.minimumFiltersRow}>
          {renderMinimumFilter('minBedrooms', t('filter_bedrooms_min'))}
          {renderMinimumFilter('minBathrooms', t('filter_bathrooms_min'))}
          {renderMinimumFilter('minArea', t('filter_area_min'), 'm²')}
        </View>
        <View style={styles.searchActions}>
          <TouchableOpacity style={styles.saveSearchButton} onPress={saveCurrentSearch}>
            <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
            <Text style={styles.saveSearchText}>{t('save_search')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchSubmit} onPress={handleSearch} accessibilityRole="button">
            <Text style={styles.searchSubmitText}>{t('home_explore')}</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.onBrand} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {searchHistory.length ? (
        <View style={styles.section}>
          {sectionTitle(t('profile_search_history'))}
          <FlatList
            horizontal
            data={searchHistory.slice(0, 8)}
            keyExtractor={(item, index) => `${item}-${index}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.historyChip}
                onPress={() => {
                  setSearchQuery(item);
                  setVisibleCount(8);
                  requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: searchSectionOffset.current, animated: true }));
                }}
              >
                <Ionicons name="time-outline" size={14} color={colors.onSurfaceMuted} />
                <Text style={styles.historyChipText} numberOfLines={1}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}

      {savedSearches.length ? (
        <View style={styles.section}>
          {sectionTitle(t('home_saved_searches_title'))}
          <FlatList
            horizontal
            data={savedSearches.slice(0, 6)}
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipList}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.savedSearchChip} onPress={() => applySavedSearch(item)}>
                <Ionicons name="bookmark" size={14} color={colors.primary} />
                <Text style={styles.savedSearchText} numberOfLines={1}>{item.label}</Text>
                <Ionicons name="arrow-up-outline" size={13} color={colors.onSurfaceMuted} />
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        {sectionTitle(t('categories_title'), t('all_properties'), () => applyCategory('ALL'))}
        <FlatList
          horizontal
          data={categoryCounts}
          keyExtractor={item => item.type}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => {
            const active = filterType === item.type;
            return (
              <TouchableOpacity
                style={[styles.categoryCard, active && styles.categoryCardActive]}
                onPress={() => applyCategory(active ? 'ALL' : item.type)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.categoryIconWrap, active && styles.categoryIconWrapActive]}>
                  <Ionicons
                    name={item.icon}
                    size={21}
                    color={active ? colors.onBrand : PROPERTY_TYPE_COLORS[item.type]}
                  />
                </View>
                <Text style={[styles.categoryName, active && styles.categoryNameActive]} numberOfLines={1}>
                  {tType(item.type)}
                </Text>
                <Text style={[styles.categoryCount, active && styles.categoryCountActive]}>
                  {item.count} {t('properties_count')}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <View style={styles.section}>
        {sectionTitle(t('home_neighborhoods_popular'))}
        {neighborhoodsForCity.length ? (
          <FlatList
            horizontal
            data={neighborhoodsForCity.slice(0, 10)}
            keyExtractor={item => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipList}
            renderItem={({ item }) => {
              const active = selectedNeighborhood === item;
              return (
                <TouchableOpacity
                  style={[styles.neighborhoodChip, active && styles.neighborhoodChipActive]}
                  onPress={() => {
                    setSelectedNeighborhood(active ? null : item);
                    setVisibleCount(8);
                  }}
                >
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={active ? colors.onBrand : colors.primary}
                  />
                  <Text style={[styles.neighborhoodChipText, active && styles.neighborhoodChipTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        ) : (
          <Text style={styles.mutedNote}>{t('home_no_neighborhoods')}</Text>
        )}
      </View>

      {renderCarousel(t('featured_title'), featuredProperties)}
      {renderCarousel(t('home_recommended_title'), recommendedProperties)}
      {renderCarousel(t('home_new_matches_title'), newMatches)}
      {renderCarousel(t('home_recent_title'), recentProperties)}
      {renderCarousel(t('home_recent_views_title'), recentViewedProperties)}
      {renderCarousel(t('home_favorites_title'), favoriteProperties)}

      <View style={styles.resultHeading}>
        <View style={styles.resultHeadingCopy}>
          <Text style={styles.sectionTitle}>{resultsHeading}</Text>
          <Text style={styles.resultCount}>
            {filteredProperties.length} {t('properties_count')}
          </Text>
        </View>
        {hasActiveFilters ? (
          <TouchableOpacity onPress={resetAllFilters} style={styles.clearFiltersButton}>
            <Ionicons name="close-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.clearFiltersText}>{t('home_reset_short')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.sortRow}>
        {([
          ['recent', t('sort_recent')],
          ['priceAsc', t('sort_price_asc')],
          ['priceDesc', t('sort_price_desc')],
        ] as const).map(([mode, label]) => (
          <TouchableOpacity
            key={mode}
            style={[styles.sortChip, sortMode === mode && styles.sortChipActive]}
            onPress={() => setSortMode(mode)}
            accessibilityRole="button"
            accessibilityState={{ selected: sortMode === mode }}
          >
            <Text style={[styles.sortChipText, sortMode === mode && styles.sortChipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!currentUser ? (
        <TouchableOpacity
          style={styles.signInBanner}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
        >
          <View style={styles.signInIcon}>
            <Ionicons name="person-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.signInCopy}>
            <Text style={styles.signInTitle}>{t('home_connect_title')}</Text>
            <Text style={styles.signInSubtitle}>{t('home_connect_sub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.publishBanner}
        onPress={() => navigation.navigate('Publish')}
      >
        <View style={styles.publishIcon}>
          <Ionicons name="add" size={21} color={colors.onGold} />
        </View>
        <View style={styles.publishCopy}>
          <Text style={styles.publishTitle}>{t('home_publish_card_title')}</Text>
          <Text style={styles.publishSubtitle}>{t('home_publish_card_sub')}</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={colors.onBrand} />
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => {
    if (!hydrated) {
      return (
        <View style={styles.loadingWrap}>
          <Skeleton style={styles.skeletonCard} borderRadius={RADIUS.lg} />
          <Skeleton style={styles.skeletonCard} borderRadius={RADIUS.lg} />
        </View>
      );
    }
    return (
      <EmptyState
        icon="search-outline"
        title={t('home_no_properties')}
        description={t('home_no_properties_description')}
        actionLabel={t('home_empty_reset')}
        onAction={resetAllFilters}
        style={styles.emptyState}
      />
    );
  };

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      {syncError ? (
        <View style={styles.syncErrorBanner}>
          <Text style={styles.syncErrorText}>{syncError}</Text>
          <TouchableOpacity onPress={retrySync} accessibilityRole="button">
            <Text style={styles.syncRetryText}>{t('sync_retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <FlatList
        ref={listRef}
        data={hydrated ? filteredProperties.slice(0, visibleCount) : []}
        keyExtractor={property => property.id}
        renderItem={({ item }) => (
          <PropertyCard
            property={item}
            isFeatured={isFeaturedProperty(item)}
            onPress={() => openProperty(item)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={hydrated && filteredProperties.length > visibleCount ? (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => setVisibleCount(current => current + 8)}
          >
            <Text style={styles.loadMoreText}>{t('home_load_more')}</Text>
            <Ionicons name="chevron-down" size={17} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
        contentContainerStyle={[styles.listContent, { paddingBottom: 20 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      />

      <Modal
        visible={placePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPlacePicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPlacePicker(null)}>
          <Pressable style={styles.placeDialog} onPress={event => event.stopPropagation()}>
            <View style={styles.placeDialogHeader}>
              <View style={styles.placeDialogCopy}>
                <Text style={styles.placeDialogTitle}>
                  {placePicker === 'city' ? t('home_select_city') : t('home_select_neighborhood')}
                </Text>
                <Text style={styles.placeDialogSubtitle}>{t('home_place_picker_subtitle')}</Text>
              </View>
              <TouchableOpacity
                style={styles.placeDialogClose}
                onPress={() => setPlacePicker(null)}
                accessibilityRole="button"
                accessibilityLabel={t('close')}
              >
                <Ionicons name="close" size={20} color={colors.onSurfaceMuted} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={placeQuery}
              onChangeText={setPlaceQuery}
              placeholder={t('filter_search_neighborhood_ph')}
              placeholderTextColor={colors.onSurfaceSoft}
              style={styles.placeSearchInput}
            />
            <FlatList
              data={filteredPlaceOptions}
              keyExtractor={item => item}
              style={styles.placeOptions}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <TouchableOpacity style={styles.placeOption} onPress={() => choosePlace(null)}>
                  <Ionicons name="globe-outline" size={17} color={colors.primary} />
                  <Text style={styles.placeOptionText}>
                    {placePicker === 'city' ? t('home_all_cities') : t('filter_all_neighborhoods')}
                  </Text>
                  <Ionicons name="checkmark" size={17} color={colors.primary} />
                </TouchableOpacity>
              }
              ListEmptyComponent={
                <Text style={styles.placeEmptyText}>{t('home_no_places')}</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.placeOption} onPress={() => choosePlace(item)}>
                  <Ionicons
                    name={placePicker === 'city' ? 'business-outline' : 'location-outline'}
                    size={17}
                    color={colors.onSurfaceMuted}
                  />
                  <Text style={styles.placeOptionText}>{item}</Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.onSurfaceSoft} />
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  syncErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.dangerContainer,
  },
  syncErrorText: { flex: 1, color: COLORS.onDangerContainer, fontSize: 12 },
  syncRetryText: { color: COLORS.onDangerContainer, fontSize: 12, fontWeight: '700' },
  listContent: { paddingBottom: SPACING.xl },
  hero: {
    height: 360,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.premiumDarkBlue,
  },
  heroCompact: { height: 330 },
  heroImage: { flex: 1 },
  heroImageCorners: { borderRadius: RADIUS.xl },
  heroScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 24, 42, 0.18)' },
  heroGradient: { ...StyleSheet.absoluteFill, flexDirection: 'column' },
  heroGradientStop: { flex: 1 },
  heroContent: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'space-between',
  },
  heroTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(8, 20, 33, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  brandText: { color: COLORS.white, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  heroBottom: { paddingBottom: SPACING.xs },
  heroEyebrow: {
    color: COLORS.premiumGoldLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
    maxWidth: 350,
  },
  heroTitleCompact: { fontSize: 30, lineHeight: 36 },
  heroTitleAccent: { color: COLORS.premiumGoldLight },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: SPACING.sm,
    maxWidth: 310,
  },
  heroCta: {
    marginTop: SPACING.lg,
    alignSelf: 'flex-start',
    minHeight: 42,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.premiumGoldLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heroCtaText: { color: COLORS.premiumDarkBlue, fontSize: 13, fontWeight: '800' },
  searchCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.premiumShadow,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  searchTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.md },
  searchTitleIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTitleCopy: { flex: 1 },
  searchTitle: { ...typography.subtitle, color: COLORS.onSurface },
  searchSubtitle: { ...typography.caption, color: COLORS.onSurfaceMuted, marginTop: 2 },
  locationRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  locationButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  locationButtonText: { flex: 1, color: COLORS.onSurface, fontSize: 12, fontWeight: '600' },
  filterDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetLabelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  filterLabel: { color: COLORS.onSurface, fontSize: 13, fontWeight: '700' },
  resetText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  budgetRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm },
  budgetInputWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 60,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  budgetHint: { color: COLORS.onSurfaceMuted, fontSize: 10, fontWeight: '600' },
  budgetInput: { flex: 1, padding: 0, marginTop: 2, color: COLORS.onSurface, fontSize: 13, fontWeight: '700' },
  currencySuffix: { position: 'absolute', right: 8, bottom: 8, color: COLORS.onSurfaceSoft, fontSize: 9 },
  budgetRangeDash: { width: 16, height: 1, backgroundColor: COLORS.borderStrong, marginHorizontal: SPACING.xs },
  minimumFiltersRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  minimumInputWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 55,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  minimumInputRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 3 },
  minimumInput: { flex: 1, padding: 0, color: COLORS.onSurface, fontSize: 13, fontWeight: '700' },
  minimumUnit: { color: COLORS.onSurfaceSoft, fontSize: 9 },
  searchActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  saveSearchButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  saveSearchText: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
  searchSubmit: {
    minWidth: 114,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  searchSubmitText: { color: COLORS.onBrand, fontSize: 12, fontWeight: '700' },
  section: { marginTop: SPACING.xl },
  sectionHeading: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { ...typography.subtitle, color: COLORS.onSurface, fontSize: 17 },
  sectionAction: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  chipList: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  historyChip: {
    maxWidth: 190,
    minHeight: 34,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  historyChipText: { color: COLORS.onSurfaceMuted, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  savedSearchChip: {
    maxWidth: 230,
    minHeight: 38,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  savedSearchText: { color: COLORS.onPrimaryContainer, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  categoryList: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  categoryCard: {
    width: 142,
    minHeight: 125,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  categoryCardActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  categoryIconWrapActive: { backgroundColor: COLORS.overlayWhite20 },
  categoryName: { color: COLORS.onSurface, fontSize: 13, fontWeight: '700' },
  categoryNameActive: { color: COLORS.onBrand },
  categoryCount: { color: COLORS.onSurfaceMuted, fontSize: 10, marginTop: SPACING.xs },
  categoryCountActive: { color: COLORS.onBrandMuted },
  neighborhoodChip: {
    minHeight: 36,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  neighborhoodChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  neighborhoodChipText: { color: COLORS.onSurface, fontSize: 12, fontWeight: '600' },
  neighborhoodChipTextActive: { color: COLORS.onBrand },
  mutedNote: { paddingHorizontal: SPACING.lg, color: COLORS.onSurfaceMuted, fontSize: 12 },
  carouselContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xs },
  resultHeading: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xxl,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultHeadingCopy: { flex: 1 },
  resultCount: { color: COLORS.onSurfaceMuted, fontSize: 11, marginTop: 3 },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  clearFiltersText: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
  sortRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  sortChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
  },
  sortChipActive: { backgroundColor: COLORS.primaryContainer },
  sortChipText: { color: COLORS.onSurfaceMuted, fontSize: 11, fontWeight: '600' },
  sortChipTextActive: { color: COLORS.onPrimaryContainer },
  signInBanner: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    minHeight: 68,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  signInIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInCopy: { flex: 1 },
  signInTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: '700' },
  signInSubtitle: { color: COLORS.onSurfaceMuted, fontSize: 11, marginTop: 3 },
  publishBanner: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    minHeight: 74,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.brand,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  publishIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.premiumGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishCopy: { flex: 1 },
  publishTitle: { color: COLORS.onBrand, fontSize: 13, fontWeight: '700' },
  publishSubtitle: { color: COLORS.onBrandMuted, fontSize: 11, marginTop: 3 },
  loadingWrap: { padding: SPACING.lg, gap: SPACING.md },
  skeletonCard: { height: 280, width: '100%' },
  emptyState: { marginHorizontal: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface },
  loadMoreButton: {
    alignSelf: 'center',
    marginVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadMoreText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.scrimStrong,
  },
  placeDialog: {
    maxHeight: '80%',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  placeDialogHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md },
  placeDialogCopy: { flex: 1, paddingRight: SPACING.md },
  placeDialogTitle: { color: COLORS.onSurface, fontSize: 19, fontWeight: '800' },
  placeDialogSubtitle: { color: COLORS.onSurfaceMuted, fontSize: 12, marginTop: SPACING.xs },
  placeDialogClose: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeSearchInput: {
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    color: COLORS.onSurface,
    marginBottom: SPACING.sm,
  },
  placeOptions: { flexGrow: 0 },
  placeOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  placeOptionText: { flex: 1, color: COLORS.onSurface, fontSize: 13, fontWeight: '600' },
  placeEmptyText: { color: COLORS.onSurfaceMuted, textAlign: 'center', padding: SPACING.xl },
});

export default HomeScreen;
