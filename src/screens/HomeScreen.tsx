import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Pressable,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Dimensions,
  StatusBar,
  TextInput,
  InteractionManager,
  LayoutAnimation,
  Platform,
  ImageBackground,
} from 'react-native';
import { AppAlert as Alert } from '../components/ui/appAlertService';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PropertyCard from '../components/PropertyCard';
import CategoryPickerModal from '../components/home/CategoryPickerModal';
import SearchBar from '../components/SearchBar';
import OfflineBanner from '../components/ui/OfflineBanner';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { useApp } from '../context/AppContext';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import { Property, PropertyType } from '../types';
import { COLORS } from '../theme/colors';
import { RootStackParamList } from '../../App';
import { translate } from '../i18n';
import { isFeaturedProperty, isPublicProperty } from '../utils/propertyVisibility';
import { getRecentProperties } from '../utils/recentProperties';
import { RADIUS, SPACING } from '../theme/spacing';
import { typography } from '../theme/typography';
import heroBackground from '../../assets/branding/hero-case-chaume.jpg';

const { width } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<RootStackParamList>;

const HomeScreen: React.FC = () => {
  const styles = useThemedStyles(baseStyles);
  const themeColors = useThemeColors();
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
    syncError,
    retrySync,
    t,
    tType,
    hydrated,
    language,
    setLanguage,
    theme,
  } = useApp();
  const propertiesByType = useMemo(() => {
    const types: PropertyType[] = ['house', 'apartment', 'land', 'shop'];
    return types.map(type => ({
      type,
      count: properties.filter(p => p.type === type && isPublicProperty(p)).length,
    }));
  }, [properties]);
  const featuredProperties = useMemo(() => {
    return properties
      .filter(property => isFeaturedProperty(property) && isPublicProperty(property))
      .slice(0, 10);
  }, [properties]);
  const [recentWindowNow, setRecentWindowNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setRecentWindowNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const recentProperties = useMemo(
    () => getRecentProperties(properties, recentWindowNow),
    [properties, recentWindowNow]
  );
  const filteredProperties = getFilteredProperties();
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'recent' | 'priceAsc' | 'priceDesc'>('recent');
  const [neighborhoodOpen, setNeighborhoodOpen] = useState(false);
  const [neighborhoodQuery, setNeighborhoodQuery] = useState('');
  const availableNeighborhoods = useMemo(() => {
    const names = [
      ...neighborhoods,
      ...properties
        .filter(isPublicProperty)
        .map(property => property.neighborhood?.trim())
        .filter((name): name is string => Boolean(name)),
    ];
    return [...new Map(names.map(name => [name.toLowerCase(), name])).values()]
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [neighborhoods, properties]);
  const filteredNeighborhoods = useMemo(() => {
    const cityNeighborhoods = selectedCity
      ? Array.from(new Set(
          properties
            .filter(isPublicProperty)
            .filter(property => (property.city || property.location).toLowerCase() === selectedCity.toLowerCase())
            .map(property => property.neighborhood?.trim())
            .filter((name): name is string => Boolean(name))
        ))
      : availableNeighborhoods;
    const base = neighborhoodQuery.trim()
      ? cityNeighborhoods.filter(name => name.toLowerCase().includes(neighborhoodQuery.trim().toLowerCase()))
      : cityNeighborhoods;
    return [...base].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [availableNeighborhoods, neighborhoodQuery, properties, selectedCity]);
  const cities = useMemo(
    () => Array.from(new Set(properties.filter(isPublicProperty).map(p => (p.city || p.location).trim()).filter(Boolean))).sort(),
    [properties]
  );
  const availableSelectedNeighborhood = selectedNeighborhood && availableNeighborhoods.some(
    name => name.toLowerCase() === selectedNeighborhood.toLowerCase()
  )
    ? selectedNeighborhood
    : null;
  if (selectedNeighborhood && !availableSelectedNeighborhood) setSelectedNeighborhood(null);

  const filteredByNeighborhood = availableSelectedNeighborhood
    ? filteredProperties.filter(
        p => (p.neighborhood ?? '').toLowerCase() === availableSelectedNeighborhood.toLowerCase()
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

  const activeListings = properties.filter(isPublicProperty).length;
  const listSectionYRef = useRef(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const scrollRef = useRef<FlatList<Property>>(null);
  const resultSetKey = JSON.stringify([
    filterType,
    searchQuery,
    filters,
    availableSelectedNeighborhood,
  ]);
  const [listState, setListState] = useState({ key: '', visibleCount: 12 });
  if (listState.key !== resultSetKey) {
    setListState({ key: resultSetKey, visibleCount: 12 });
  }
  const visibleCount = listState.visibleCount;
  const suggestionBase = useMemo(() => {
    const cityCandidates = Array.from(
      new Set(
        properties
          .map(p => (p.city ?? p.location ?? '').trim())
          .filter(Boolean)
      )
    ).slice(0, 4);
    const neighborhoodCandidates = availableNeighborhoods.slice(0, 4);
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
  }, [availableNeighborhoods, properties, language]);

  const applySuggestion = (query: string, type?: PropertyType) => {
    if (type) setFilterType(type);
    setSearchQuery(query);
    handleSearchSubmit();
  };

  const resetAllFilters = () => {
    resetFilters();
    setFilterType('ALL');
    setSearchQuery('');
    setSelectedCity(null);
    setSelectedNeighborhood(null);
    setNeighborhoodQuery('');
    setNeighborhoodOpen(false);
    setSortMode('recent');
  };
  const showAllProperties = () => {
    resetAllFilters();
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToOffset({
        offset: Math.max(listSectionYRef.current - 12, 0),
        animated: true,
      });
    });
  };
  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (searchQuery) chips.push(searchQuery);
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
  }, [filters, filterType, searchQuery, selectedCity, selectedNeighborhood, tType]);


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

  const visibleProperties = sortedProperties.slice(0, visibleCount);
  const hasMoreProperties = visibleProperties.length < sortedProperties.length;
  const loadMoreProperties = () => {
    if (hasMoreProperties) {
      setListState(previous => ({
        key: resultSetKey,
        visibleCount: (previous.key === resultSetKey ? previous.visibleCount : 12) + 12,
      }));
    }
  };
  const isLoading = !hydrated;
  const homeCategoryItems: {
    type?: PropertyType;
    action?: 'all' | 'picker';
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    container: string;
    count?: number;
    onPress?: () => void;
  }[] = [
    {
      label: t('all_types'),
      icon: 'apps-outline',
      color: themeColors.onSurfaceMuted,
      container: themeColors.surfaceAlt,
      count: activeListings,
      action: 'all',
    },
    {
      type: 'house',
      label: tType('house'),
      icon: 'home-outline',
      color: themeColors.primary,
      container: themeColors.primaryContainer,
      count: propertiesByType.find(item => item.type === 'house')?.count ?? 0,
    },
    {
      type: 'apartment',
      label: tType('apartment'),
      icon: 'business-outline',
      color: themeColors.primary,
      container: themeColors.primaryContainer,
      count: propertiesByType.find(item => item.type === 'apartment')?.count ?? 0,
    },
    {
      type: 'land',
      label: tType('land'),
      icon: 'map-outline',
      color: themeColors.primary,
      container: themeColors.primaryContainer,
      count: propertiesByType.find(item => item.type === 'land')?.count ?? 0,
    },
    {
      type: 'shop',
      label: tType('shop'),
      icon: 'storefront-outline',
      color: themeColors.primary,
      container: themeColors.primaryContainer,
      count: propertiesByType.find(item => item.type === 'shop')?.count ?? 0,
    },
    {
      label: t('home_more_categories'),
      icon: 'grid-outline',
      color: themeColors.primary,
      container: themeColors.primaryContainer,
      action: 'picker',
    },
  ];
  const handleCategoryTilePress = (item: (typeof homeCategoryItems)[number]) => {
    if (item.type) {
      handleCategoryPress(item.type);
    } else if (item.action === 'all') {
      showAllProperties();
    } else if (item.action === 'picker') {
      setCategoryPickerOpen(true);
    }
  };

  const renderSkeletonCard = (key: string, compact = false) => (
    <View key={key} style={[styles.skeletonCard, compact && styles.skeletonCardCompact]}>
      <Skeleton style={[styles.skeletonImage, compact && styles.skeletonImageCompact]} />
      <View style={styles.skeletonBody}>
        <Skeleton style={styles.skeletonLine} />
        <Skeleton style={[styles.skeletonLine, styles.skeletonLineShort]} />
        {!compact && (
          <View style={styles.skeletonMetaRow}>
            <Skeleton style={styles.skeletonPill} />
            <Skeleton style={styles.skeletonDot} />
          </View>
        )}
      </View>
    </View>
  );

  return (
    <>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
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
            <Ionicons name="arrow-back" size={19} color={themeColors.primary} />
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
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
        <ImageBackground
          source={heroBackground}
          resizeMode="cover"
          style={[styles.headerBlock, { paddingTop: insets.top + 18 }]}
          imageStyle={styles.headerImage}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTopRow}>
              <Text style={styles.headerBrand}>ImoPrestige</Text>
              <View
                style={styles.homeLanguageSelector}
                accessibilityRole="radiogroup"
                accessibilityLabel={t('language')}
              >
                {(['fr', 'en'] as const).map(option => {
                  const selected = language === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.homeLanguageOption,
                        selected && styles.homeLanguageOptionActive,
                      ]}
                      onPress={() => setLanguage(option)}
                      accessibilityRole="radio"
                      accessibilityLabel={option === 'fr' ? 'Français' : 'English'}
                      accessibilityState={{ selected }}
                      hitSlop={4}
                    >
                      <Text
                        style={[
                          styles.homeLanguageText,
                          selected && styles.homeLanguageTextActive,
                        ]}
                      >
                        {option.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={styles.locationPill}>
              <Ionicons name="location" size={13} color={themeColors.brandAccent} />
              <Text style={styles.locationPillText}>{t('footer_location')}</Text>
            </View>
            <Text style={styles.headerTitle}>{t('home_hero_line1')}</Text>
            <Text style={styles.headerTitleEm}>{t('home_hero_line2')}</Text>
            <TouchableOpacity style={styles.heroCta} onPress={showAllProperties} accessibilityRole="button">
              <Ionicons name="search" size={16} color={themeColors.brand} />
              <Text style={styles.heroCtaText}>{t('home_search_card_title')}</Text>
              <Ionicons name="arrow-forward" size={16} color={themeColors.brand} />
            </TouchableOpacity>
          </View>
        </ImageBackground>

        <View style={styles.searchCardOverlap}>
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
                  <Ionicons name="sparkles" size={12} color={themeColors.primary} />
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
                  <Ionicons name="refresh" size={14} color={themeColors.primary} />
                  <Text style={styles.activeFiltersResetText}>{t('home_reset_short')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterChipScroll}
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

        {syncError && (
          <View style={styles.syncErrorCard}>
            <View style={styles.syncErrorRow}>
              <Ionicons name="alert-circle" size={18} color={themeColors.danger} />
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
              <Ionicons name="location" size={14} color={themeColors.primary} />
              <Text style={styles.neighborhoodBadgeText} numberOfLines={1}>
                {selectedNeighborhood}
              </Text>
              <TouchableOpacity onPress={() => setSelectedNeighborhood(null)}>
                <Ionicons name="close" size={16} color={themeColors.primary} />
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
                  <Text style={[styles.filterChoiceText, !selectedCity && styles.filterChoiceTextActive]}>{t('all_cities')}</Text>
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
                  color={themeColors.onSurfaceMuted}
                />
              </TouchableOpacity>
            </View>
          </View>
          {neighborhoodOpen && (
            <Modal
              visible
              transparent
              animationType="slide"
              statusBarTranslucent
              onRequestClose={() => setNeighborhoodOpen(false)}
            >
              <Pressable
                style={styles.neighborhoodModalBackdrop}
                onPress={() => {
                  Keyboard.dismiss();
                  setNeighborhoodOpen(false);
                }}
              >
                <KeyboardAvoidingView
                  style={styles.neighborhoodKeyboardAvoiding}
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                  <Pressable
                    style={[styles.neighborhoodModal, { backgroundColor: themeColors.surface }]}
                    onPress={event => event.stopPropagation()}
                  >
                    <View style={styles.neighborhoodModalHeader}>
                      <Text style={[styles.neighborhoodModalTitle, { color: themeColors.onSurface }]}>
                        {t('filter_label_neighborhood')}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          setNeighborhoodOpen(false);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('close')}
                      >
                        <Ionicons name="close" size={24} color={themeColors.onSurface} />
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.dropdownSearchRow, { backgroundColor: themeColors.background }]}>
                      <Ionicons name="search" size={14} color={themeColors.onSurfaceMuted} />
                      <TextInput
                        style={[styles.dropdownSearchInput, { color: themeColors.onSurface }]}
                        value={neighborhoodQuery}
                        onChangeText={setNeighborhoodQuery}
                        placeholder={t('filter_search_neighborhood_ph')}
                        placeholderTextColor={themeColors.onSurfaceMuted}
                        autoCorrect={false}
                        returnKeyType="search"
                      />
                    </View>
                    <ScrollView
                      style={styles.neighborhoodModalList}
                      contentContainerStyle={styles.neighborhoodModalListContent}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                      showsVerticalScrollIndicator={true}
                    >
                      <TouchableOpacity
                        style={[styles.dropdownItem, styles.neighborhoodModalOption]}
                        onPress={() => {
                          Keyboard.dismiss();
                          setSelectedNeighborhood(null);
                          setNeighborhoodOpen(false);
                        }}
                      >
                        <Text style={[
                          styles.dropdownItemText,
                          { color: themeColors.onSurfaceMuted },
                          !selectedNeighborhood && { color: themeColors.primary },
                        ]}>
                          {t('home_all_neighborhoods')}
                        </Text>
                      </TouchableOpacity>
                      {filteredNeighborhoods.map(name => (
                        <TouchableOpacity
                          key={name}
                          style={[
                            styles.dropdownItem,
                            styles.neighborhoodModalOption,
                            selectedNeighborhood === name && { backgroundColor: themeColors.infoContainer },
                          ]}
                          onPress={() => {
                            Keyboard.dismiss();
                            setSelectedNeighborhood(name);
                            setNeighborhoodOpen(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              { color: themeColors.onSurfaceMuted },
                              selectedNeighborhood === name && { color: themeColors.primary },
                            ]}
                          >
                            {name}
                          </Text>
                          {selectedNeighborhood === name && (
                            <Ionicons name="checkmark" size={18} color={themeColors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                      {filteredNeighborhoods.length === 0 && (
                        <Text style={[styles.dropdownEmpty, { color: themeColors.onSurfaceMuted }]}>
                          {t('home_no_neighborhoods')}
                        </Text>
                      )}
                    </ScrollView>
                  </Pressable>
                </KeyboardAvoidingView>
              </Pressable>
            </Modal>
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
                <Ionicons name="calendar" size={14} color={themeColors.onSurfaceMuted} />
                <Text style={styles.filterStaticText}>{t('filter_last_30_days')}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.saveSearchButton} onPress={handleSaveSearch}>
            <Ionicons name="bookmark" size={16} color={themeColors.primary} />
            <Text style={styles.saveSearchText}>{t('save_search')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Categories */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
        <Text style={styles.sectionTitle}>{t('categories_title')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryGrid}
        >
          {homeCategoryItems.map(item => (
            <TouchableOpacity
              key={item.type ?? item.label}
              style={[
                styles.categoryTile,
                item.action === 'all' && styles.categoryTileActive,
              ]}
              onPress={() => handleCategoryTilePress(item)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{
                selected: item.action === 'all',
              }}
            >
              <View style={[styles.categoryTileIcon, { backgroundColor: item.container }]}>
                <Ionicons name={item.icon} size={21} color={item.color} />
              </View>
              <Text style={styles.categoryTileLabel} numberOfLines={1}>{item.label}</Text>
              {item.count !== undefined && (
                <Text style={styles.categoryTileCount}>{item.count} {t('properties_count')}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(40)} style={styles.trustStatsCard}>
        <View style={styles.trustStat}>
          <View style={[styles.trustStatIcon, { backgroundColor: themeColors.primaryContainer }]}>
            <Ionicons name="home-outline" size={16} color={themeColors.primary} />
          </View>
          <Text style={styles.trustStatValue}>{activeListings}</Text>
          <Text style={styles.trustStatLabel}>{t('home_visible_properties')}</Text>
        </View>
        <View style={styles.trustStatDivider} />
        <View style={styles.trustStat}>
          <View style={[styles.trustStatIcon, { backgroundColor: themeColors.successContainer }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color={themeColors.success} />
          </View>
          <Text style={styles.trustStatValue}>—</Text>
          <Text style={styles.trustStatLabel}>{t('home_verified_owners')}</Text>
        </View>
        <View style={styles.trustStatDivider} />
        <View style={styles.trustStat}>
          <View style={[styles.trustStatIcon, { backgroundColor: themeColors.infoContainer }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={themeColors.info} />
          </View>
          <Text style={styles.trustStatValue}>{t('home_direct_contact_value')}</Text>
          <Text style={styles.trustStatLabel}>{t('home_direct_contact')}</Text>
        </View>
      </Animated.View>

      {(isLoading || featuredProperties.length > 0) && (
        <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.section}>
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
        </Animated.View>
      )}

      {recentProperties.length > 0 && (
        <Animated.View entering={FadeInDown.duration(400).delay(140)} style={styles.section}>
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
        </Animated.View>
      )}

      {availableNeighborhoods.length > 0 && (
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
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
            {availableNeighborhoods.map(name => (
              <TouchableOpacity
                key={name}
                style={[
                  styles.neighborhoodChip,
                  selectedNeighborhood === name && styles.neighborhoodChipActive,
                ]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setSelectedCity(null);
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
        </Animated.View>
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
              onAction={filterType === 'ALL' ? resetAllFilters : handleCategoryBack}
              style={styles.emptyStateWrap}
            />
          )
        }
        ListFooterComponent={filterType === 'ALL' ? <>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('reviews_title')}</Text>
        <View style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <Ionicons name="star" size={16} color={themeColors.gold} />
            <Text style={styles.reviewTitle}>5.0</Text>
          </View>
          <Text style={styles.reviewText}>{t('review_1')}</Text>
        </View>
        <View style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <Ionicons name="star" size={16} color={themeColors.gold} />
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
              <Ionicons name="log-in" size={18} color={themeColors.white} />
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
      <CategoryPickerModal
        visible={categoryPickerOpen}
        categories={propertiesByType}
        onClose={() => setCategoryPickerOpen(false)}
        onSelect={handleCategoryPress}
      />
    </>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBlock: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 34,
    minHeight: 252,
    justifyContent: 'flex-end',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  headerImage: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    position: 'relative',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 13,
  },
  headerBrand: {
    flex: 1,
    color: COLORS.brandAccent,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.7,
    textShadowColor: '#00000099',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  homeLanguageSelector: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.scrimStrong,
    borderWidth: 1,
    borderColor: COLORS.overlayWhite35,
  },
  homeLanguageOption: {
    minWidth: 42,
    minHeight: 34,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
  },
  homeLanguageOptionActive: {
    backgroundColor: COLORS.brandAccent,
  },
  homeLanguageText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  homeLanguageTextActive: {
    color: COLORS.brand,
  },
  heroCta: {
    alignSelf: 'flex-start',
    marginTop: 18,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.brandAccent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroCtaText: {
    color: COLORS.brand,
    fontSize: 13,
    fontWeight: '800',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.overlayWhite20,
    borderWidth: 1,
    borderColor: COLORS.overlayWhite35,
    marginBottom: SPACING.sm,
  },
  locationPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  trustStatsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: SPACING.lg,
    marginTop: 18,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    zIndex: 1,
  },
  trustStat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  trustStatIcon: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  trustStatValue: {
    ...typography.subtitle,
    color: COLORS.onSurface,
  },
  trustStatLabel: {
    ...typography.caption,
    color: COLORS.onSurfaceMuted,
    textAlign: 'center',
  },
  trustStatDivider: {
    width: 1,
    alignSelf: 'center',
    height: '64%',
    backgroundColor: COLORS.border,
  },
  searchCardOverlap: {
    marginTop: SPACING.md,
    paddingHorizontal: 20,
    zIndex: 2,
    elevation: 2,
  },
  headerTitle: {
    ...typography.heroTitle,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'left',
    textShadowColor: '#00000099',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  headerTitleEm: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
    color: COLORS.brandAccent,
    textAlign: 'left',
    marginTop: 0,
    textShadowColor: '#00000099',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  headerSubtitle: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.onSurfaceMuted,
    textAlign: 'left',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: SPACING.lg,
  },
  bottomCta: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  quickActionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
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
    backgroundColor: COLORS.overlayWhite20,
  },
  quickActionIconLight: {
    backgroundColor: COLORS.infoContainer,
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  quickActionTitleOnPrimary: {
    color: COLORS.white,
  },
  quickActionSub: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    marginTop: 2,
  },
  quickActionSubOnPrimary: {
    color: COLORS.infoContainer,
  },
  searchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
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
    color: COLORS.onSurface,
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
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  suggestionText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
  },
  filterChipScroll: {
    marginTop: 14,
  },
  filterChipRow: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: COLORS.white,
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
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activeFilterText: {
    fontSize: 11,
    color: COLORS.surface,
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
    backgroundColor: COLORS.primaryContainer,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  activeFiltersResetText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  syncErrorCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.dangerContainer,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.dangerContainer,
  },
  syncErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncErrorText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.onDangerContainer,
    fontWeight: '600',
  },
  syncRetryButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.danger,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  syncRetryText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  filterSticky: {
    backgroundColor: COLORS.surfaceAlt,
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
    color: COLORS.onSurface,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  filterToggle: {
    fontSize: 12,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  clearFilter: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  filtersPanel: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.background,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxWidth: '100%',
  },
  trustText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: COLORS.onSurface,
    flexShrink: 1,
  },
  trustSub: {
    marginHorizontal: 16,
    marginTop: 6,
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
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
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChoiceActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChoiceText: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
  },
  filterChoiceTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  filterLabel: {
    fontSize: 11,
    color: COLORS.onSurfaceMuted,
    marginBottom: 6,
    fontWeight: '600',
  },
  filterInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 13,
    color: COLORS.onSurface,
  },
  filterStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterStaticText: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    fontWeight: '600',
  },
  dropdownButton: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  neighborhoodModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.overlayNavy55,
  },
  neighborhoodKeyboardAvoiding: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  neighborhoodModal: {
    maxHeight: '82%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 28,
  },
  neighborhoodModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  neighborhoodModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  neighborhoodModalList: {
    marginTop: 8,
    maxHeight: 400,
  },
  neighborhoodModalListContent: {
    paddingBottom: 40,
  },
  neighborhoodModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.onSurface,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  dropdownItemText: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    fontWeight: '600',
  },
  dropdownEmpty: {
    fontSize: 11,
    color: COLORS.onSurfaceMuted,
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
    backgroundColor: COLORS.infoContainer,
  },
  saveSearchText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.onSurface,
    paddingLeft: 0,
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
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.background,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  neighborhoodChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  neighborhoodChipText: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    fontWeight: '600',
  },
  neighborhoodChipTextActive: {
    color: COLORS.white,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  count: {
    fontSize: 14,
    color: COLORS.onSurfaceMuted,
  },
  categoryGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingRight: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  categoryTile: {
    width: 104,
    minHeight: 118,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryTileActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primary,
  },
  categoryTileIcon: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  categoryTileLabel: {
    ...typography.button,
    color: COLORS.onSurface,
    textAlign: 'center',
    fontSize: 12,
  },
  categoryTileCount: {
    ...typography.caption,
    color: COLORS.onSurfaceMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  categoryNavigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.infoContainer,
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
    color: COLORS.onSurface,
    fontSize: 17,
    fontWeight: '800',
  },
  categoryResultsSubtitle: {
    color: COLORS.onSurfaceMuted,
    fontSize: 11,
    marginTop: 3,
  },
  categoryResultsCount: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 17,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryResultsCountText: {
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    fontWeight: '700',
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
    backgroundColor: COLORS.infoContainer,
  },
  loadMoreText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  skeletonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginHorizontal: 8,
    marginVertical: 8,
    width: width - 32,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  skeletonCardCompact: {
    width: width * 0.8,
    marginVertical: 6,
  },
  skeletonImage: {
    width: '100%',
    height: 150,
    backgroundColor: COLORS.borderStrong,
  },
  skeletonImageCompact: {
    height: 150,
  },
  skeletonBody: {
    padding: 14,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: COLORS.borderStrong,
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
    backgroundColor: COLORS.infoContainer,
  },
  skeletonDot: {
    width: 48,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.borderStrong,
  },
  reviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.onSurface,
  },
  reviewText: {
    fontSize: 13,
    color: COLORS.onSurfaceMuted,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.onSurfaceMuted,
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
    borderColor: COLORS.infoContainer,
    backgroundColor: COLORS.infoContainer,
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
    color: COLORS.onSurfaceMuted,
    fontWeight: '500',
  },
  footerSubtext: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    marginTop: 4,
  },
});

export default HomeScreen;
