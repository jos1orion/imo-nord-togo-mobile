/**
 * Composant Badge
 * Badge de statut, type ou indicateur
 */

import React from 'react';
import { Text, View, ViewStyle, TextStyle } from 'react-native';
import { type ThemePalette } from '../../theme/colors';
import { useThemeColors } from '../../theme/useThemedStyles';
import { TYPOGRAPHY_TOKENS } from '../../theme/tokens/typography';
import { RADIUS, SPACING } from '../../theme/spacing';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral' | 'premium' | 'featured';
export type BadgeSize = 'sm' | 'md' | 'lg';

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: ViewStyle;
  testID?: string;
};

const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  style,
  textStyle,
  testID,
}) => {
  const themeColors = useThemeColors() as ThemePalette;
  const styles = getBadgeStyles(themeColors);

  const variantStyle = styles.variants[variant];
  const sizeStyle = styles.sizes[size];
  const textColor = getTextColor(variant, themeColors);

  return (
    <View
      style={[
        styles.base,
        variantStyle,
        sizeStyle,
        style,
      ]}
      testID={testID}
    >
      {icon}
      <Text
        style={[styles.label, { color: textColor }, textStyle]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
    </View>
  );
};

function getTextColor(variant: BadgeVariant, colors: ThemePalette): string {
  switch (variant) {
    case 'primary':
      return colors.onPrimary;
    case 'secondary':
    case 'neutral':
      return colors.onSurface;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'danger':
      return colors.danger;
    case 'premium':
      return colors.premiumDarkBlue;
    case 'featured':
      return colors.gold;
    default:
      return colors.onSurface;
  }
}

type BadgeSizeStyles = {
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
};

type BadgeVariantStyles = Record<BadgeVariant, ViewStyle>;

type BadgeStyles = {
  base: ViewStyle;
  sizes: BadgeSizeStyles;
  variants: BadgeVariantStyles;
  label: TextStyle;
};

function getBadgeStyles(themeColors: ThemePalette): BadgeStyles {
  return {
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      borderRadius: RADIUS.full,
    },
    sizes: {
      sm: {
        paddingHorizontal: SPACING.xs,
        paddingVertical: 2,
      },
      md: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
      },
      lg: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
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
      success: {
        backgroundColor: themeColors.successContainer,
      },
      warning: {
        backgroundColor: themeColors.warningContainer,
      },
      danger: {
        backgroundColor: themeColors.dangerContainer,
      },
      neutral: {
        backgroundColor: themeColors.surfaceMuted,
      },
      premium: {
        backgroundColor: themeColors.premiumGold,
      },
      featured: {
        backgroundColor: themeColors.overlaySlate70,
      },
    },
    label: {
      ...TYPOGRAPHY_TOKENS.caption,
    },
  };
}

export default React.memo(Badge);