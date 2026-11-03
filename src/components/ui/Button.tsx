/**
 * Composant Button
 * Bouton reutilisable avec variantes et états
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { type ThemePalette } from '../../theme/colors';
import { useThemeColors } from '../../theme/useThemedStyles';
import { RADIUS, SPACING } from '../../theme/spacing';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  testID?: string;
};

type ButtonSizeStyles = {
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
};

type ButtonVariantStyles = {
  primary: ViewStyle;
  secondary: ViewStyle;
  outline: ViewStyle;
  ghost: ViewStyle;
};

type ButtonStyles = {
  base: ViewStyle;
  sizes: ButtonSizeStyles;
  variants: ButtonVariantStyles;
  disabled: ViewStyle;
  label: ViewStyle;
};

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  testID,
}) => {
  const themeColors = useThemeColors() as ThemePalette;
  const styles = getButtonStyles(themeColors);

  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;
  const sizeStyle = styles.sizes[size];

  const getBackgroundColor = () => {
    if (isDisabled) return themeColors.primary;
    if (isPrimary) return themeColors.primary;
    if (variant === 'secondary') return themeColors.surface;
    return 'transparent';
  };

  const getTextColor = () => {
    if (isDisabled) return themeColors.onSurfaceSoft;
    if (isPrimary) return themeColors.onPrimary;
    if (variant === 'secondary') return themeColors.primary;
    if (variant === 'outline') return themeColors.primary;
    return themeColors.onSurface;
  };

  const getBorderColor = () => {
    if (variant === 'outline') return themeColors.border;
    return 'transparent';
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        sizeStyle,
        { backgroundColor: getBackgroundColor(), borderColor: getBorderColor() },
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? themeColors.onPrimary : themeColors.primary} />
      ) : (
        <>
          {icon && iconPosition === 'left' && <>{icon}</>}
          <Text style={[styles.label, { color: getTextColor() }]}>{title}</Text>
          {icon && iconPosition === 'right' && <>{icon}</>}
        </>
      )}
    </TouchableOpacity>
  );
};

function getButtonStyles(themeColors: ThemePalette): ButtonStyles {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return StyleSheet.create<any>({
    base: {
      minHeight: 48,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.full,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
    },
    sizes: {
      sm: {
        minHeight: 36,
        paddingHorizontal: SPACING.md,
      },
      md: {
        minHeight: 48,
        paddingHorizontal: SPACING.lg,
      },
      lg: {
        minHeight: 56,
        paddingHorizontal: SPACING.xl,
      },
    },
    variants: {
      primary: {
        backgroundColor: themeColors.primary,
      },
      secondary: {
        backgroundColor: themeColors.surface,
        borderWidth: 1,
        borderColor: themeColors.border,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: themeColors.primary,
      },
      ghost: {
        backgroundColor: 'transparent',
      },
    },
    disabled: {
      opacity: 0.55,
    },
    label: {
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
    },
  });
}

export default React.memo(Button);