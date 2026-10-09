import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { PropertyType } from '../types';
import { useApp } from '../context/AppContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import COLORS from '../theme/colors';

interface TypeFilterProps {
  selectedType: PropertyType | 'ALL';
  onSelectType: (type: PropertyType | 'ALL') => void;
}

const TypeFilter: React.FC<TypeFilterProps> = ({ selectedType, onSelectType }) => {
  const styles = useThemedStyles(baseStyles);
  const { tType, t } = useApp();
  const types: (PropertyType | 'ALL')[] = [
    'ALL',
    'house',
    'apartment',
    'land',
    'shop',
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {types.map(type => (
        <TouchableOpacity
          key={type}
          style={[
            styles.chip,
            selectedType === type && styles.chipActive,
          ]}
          onPress={() => onSelectType(type)}
        >
          <Text style={[
            styles.chipText,
            selectedType === type && styles.chipTextActive,
          ]}>
            {type === 'ALL' ? t('all_types') : tType(type)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    marginVertical: 0,
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceAlt,
  },
  content: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.onSurfaceMuted,
  },
  chipTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default TypeFilter;





