import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import { typography } from '../../theme/typography';
import PrimaryButton from './PrimaryButton';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
  children?: ReactNode;
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
  const styles = useThemedStyles(baseStyles);
  return (
    <View style={[styles.wrap, style]} accessibilityRole="text">
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={COLORS.primary} />
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

const baseStyles = StyleSheet.create({
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
    backgroundColor: COLORS.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    ...typography.subtitle,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  desc: {
    ...typography.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    minWidth: 200,
  },
});

export default EmptyState;
