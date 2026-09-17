import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import COLORS from '../../theme/colors';

type Props = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
};

const PrimaryButton: React.FC<Props> = ({ title, onPress, loading, variant = 'primary', disabled, style }) => {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[styles.base, isPrimary ? styles.primary : styles.secondary, (disabled || loading) && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : COLORS.primary} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.textPrimary : styles.textSecondary]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: COLORS.primary },
  secondary: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  disabled: { opacity: 0.55 },
  label: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  textPrimary: { color: '#fff' },
  textSecondary: { color: COLORS.primary },
});

export default PrimaryButton;
