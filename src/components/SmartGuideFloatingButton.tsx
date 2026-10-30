import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import { RADIUS, SPACING } from '../theme/spacing';
import { typography } from '../theme/typography';
import { safeImpactLight } from '../lib/expoHapticsSafe';
import { useApp } from '../context/AppContext';

interface SmartGuideFloatingButtonProps {
  onPress: () => void;
  label?: string;
}

export const SmartGuideFloatingButton: React.FC<SmartGuideFloatingButtonProps> = ({
  onPress,
  label,
}) => {
  const themeColors = useThemeColors();
  const styles = useThemedStyles(baseStyles);
  const { language } = useApp();

  const buttonLabel =
    label || (language === 'fr' ? 'Smart Guide' : 'Smart Guide');

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: themeColors.primary,
          shadowColor: themeColors.shadow,
        },
      ]}
      onPress={() => {
        safeImpactLight();
        onPress();
      }}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Ouvrir le Smart Guide Imo Prestige"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="sparkles" size={18} color="#fff" />
      </View>
      <Text style={styles.text}>{buttonLabel}</Text>
    </TouchableOpacity>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 99,
  },
  iconWrap: {
    marginRight: 6,
  },
  text: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
