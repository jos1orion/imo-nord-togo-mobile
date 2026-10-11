import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { PropertyType } from '../../types';
import { RADIUS, SPACING } from '../../theme/spacing';
import { useThemeColors } from '../../theme/useThemedStyles';

type CategoryCount = {
  type: PropertyType;
  count: number;
};

type CategoryPickerModalProps = {
  visible: boolean;
  categories: CategoryCount[];
  onClose: () => void;
  onSelect: (type: PropertyType) => void;
};

const CategoryPickerModal: React.FC<CategoryPickerModalProps> = ({
  visible,
  categories,
  onClose,
  onSelect,
}) => {
  const { t, tType } = useApp();
  const colors = useThemeColors();
  const options: {
    type: PropertyType;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    container: string;
  }[] = [
    { type: 'house', icon: 'home', color: colors.accent, container: colors.primaryContainer },
    { type: 'apartment', icon: 'business', color: colors.primary, container: colors.infoContainer },
    { type: 'land', icon: 'map', color: colors.gold, container: colors.successContainer },
    { type: 'shop', icon: 'storefront', color: colors.cyan, container: colors.warningContainer },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.scrimStrong }]}>
        <View style={[styles.dialog, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { color: colors.onSurface }]}>
                {t('home_choose_category')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.onSurfaceMuted }]}>
                {t('home_choose_category_subtitle')}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.close, { backgroundColor: colors.surfaceAlt }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('close')}
            >
              <Ionicons name="close" size={20} color={colors.onSurfaceMuted} />
            </TouchableOpacity>
          </View>
          {options.map(option => (
            <TouchableOpacity
              key={option.type}
              style={[styles.option, { borderTopColor: colors.surfaceAlt }]}
              onPress={() => onSelect(option.type)}
              accessibilityRole="button"
            >
              <View style={[styles.optionIcon, { backgroundColor: option.container }]}>
                <Ionicons name={option.icon} size={21} color={option.color} />
              </View>
              <Text style={[styles.optionText, { color: colors.onSurface }]}>
                {tType(option.type)}
              </Text>
              <Text style={[styles.optionCount, { color: colors.onSurfaceMuted }]}>
                {categories.find(category => category.type === option.type)?.count ?? 0}
              </Text>
              <Ionicons name="chevron-forward" size={17} color={colors.onSurfaceMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  dialog: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  titleWrap: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: SPACING.xs,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderTopWidth: 1,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  optionCount: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default CategoryPickerModal;
