import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, type ThemePalette } from '../../theme/colors';
import { typography } from '../../theme/typography';
import PrimaryButton from './PrimaryButton';
import { useThemeColors } from '../../theme/useThemedStyles';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
  children?: ReactNode;
};

type EmptyStateStyles = {
  wrap: ViewStyle;
  iconCircle: ViewStyle;
  title: ViewStyle;
  desc: ViewStyle;
  button: ViewStyle;
};

const EmptyState: React.FC<Props> = ({
  icon = 'folder-open-outline',
  title,
  description,
  actionLabel,
  onAction,
  style,
  children,
}) => {
  const themeColors = useThemeColors() as ThemePalette;
  const styles = baseStyles(themeColors);
  return (
    <View style={[styles.wrap, style]} accessibilityRole="text">
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={themeColors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {children}
      {actionLabel && onAction ? (
        <PrimaryButton title={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
};

function baseStyles(themeColors: ThemePalette): EmptyStateStyles {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return StyleSheet.create<any>({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 28,
      paddingHorizontal: 20,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: themeColors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    title: {
      ...typography.subtitle,
      color: themeColors.onSurface,
      textAlign: 'center',
      marginBottom: 6,
    },
    desc: {
      ...typography.body,
      color: themeColors.onSurfaceMuted,
      textAlign: 'center',
      marginBottom: 16,
    },
    button: {
      marginTop: 8,
      minWidth: 200,
    },
  });
}

export default EmptyState;