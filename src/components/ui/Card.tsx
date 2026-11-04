/**
 * Composant Card
 * Conteneur carte reutilisable avec variantes
 */

import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { COLORS, type ThemePalette } from '../../theme/colors';
import { useThemeColors } from '../../theme/useThemedStyles';
import { RADIUS, SPACING } from '../../theme/spacing';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled';
export type CardSize = 'sm' | 'md' | 'lg';

type CardProps = {
  variant?: CardVariant;
  size?: CardSize;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: boolean;
  children?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
};

type CardSizeStyles = {
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
};

type CardVariantStyles = {
  default: ViewStyle;
  elevated: ViewStyle;
  outlined: ViewStyle;
  filled: ViewStyle;
};

type CardPaddingStyles = {
  none: ViewStyle;
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
};

type CardStyles = {
  base: ViewStyle;
  sizes: CardSizeStyles;
  variants: CardVariantStyles;
  padding: CardPaddingStyles;
};

const Card: React.FC<CardProps> = ({
  variant = 'elevated',
  size = 'md',
  padding = 'md',
  rounded = true,
  children,
  style,
  testID,
}) => {
  const themeColors = useThemeColors() as ThemePalette;
  const styles = getCardStyles(themeColors);

  const variantStyle = styles.variants[variant];
  const paddingStyle = padding !== 'none' ? styles.padding[padding] : {};
  const borderRadius = rounded ? { borderRadius: RADIUS.xl } : {};

  return (
    <View
      style={[
        styles.base,
        styles.sizes[size],
        variantStyle,
        paddingStyle,
        borderRadius,
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
};

function getCardStyles(themeColors: ThemePalette): CardStyles {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return StyleSheet.create<any>({
    base: {
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
      overflow: 'hidden',
    },
    sizes: {
      sm: {
        margin: SPACING.xs,
      },
      md: {
        margin: SPACING.sm,
      },
      lg: {
        margin: SPACING.md,
      },
    },
    variants: {
      default: {
        backgroundColor: themeColors.surface,
      },
      elevated: {
        backgroundColor: themeColors.surface,
        shadowColor: themeColors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
        elevation: 3,
      },
      outlined: {
        backgroundColor: themeColors.background,
        borderWidth: 1,
        borderColor: themeColors.border,
      },
      filled: {
        backgroundColor: themeColors.surfaceMuted,
      },
    },
    padding: {
      none: {},
      sm: {
        padding: SPACING.xs,
      },
      md: {
        padding: SPACING.md,
      },
      lg: {
        padding: SPACING.lg,
      },
    },
  });
}

export default React.memo(Card);