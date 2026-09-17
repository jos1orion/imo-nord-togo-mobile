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
import COLORS from '../theme/colors';

interface TypeFilterProps {
  selectedType: PropertyType | 'ALL';
  onSelectType: (type: PropertyType | 'ALL') => void;
}

const TypeFilter: React.FC<TypeFilterProps> = ({ selectedType, onSelectType }) => {
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

const styles = StyleSheet.create({
  container: {
    marginVertical: 0,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
  },
  content: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default TypeFilter;






