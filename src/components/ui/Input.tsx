/**
 * Composant Input
 * Champ de saisie reutilisable avec états
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  KeyboardType,
  TouchableOpacity,
} from 'react-native';
import { COLORS, type ThemePalette } from '../../theme/colors';
import { useThemeColors } from '../../theme/useThemedStyles';
import { TYPOGRAPHY_TOKENS } from '../../theme/tokens/typography';
import { SPACING } from '../../theme/spacing';

export type InputProps = {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outlined' | 'filled';
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  keyboardType?: KeyboardType;
  secureTextEntry?: boolean;
  helperText?: string;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  testID?: string;
};

type InputSizeStyles = {
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
};

type InputVariantStyles = {
  default: ViewStyle;
  outlined: ViewStyle;
  filled: ViewStyle;
};

type InputStyles = {
  container: ViewStyle;
  inputWrapper: ViewStyle;
  input: ViewStyle;
  sizes: InputSizeStyles;
  variants: InputVariantStyles;
  disabled: ViewStyle;
  leadingIcon: ViewStyle;
  trailingIcon: ViewStyle;
  withLeadingIcon: ViewStyle;
  withTrailingIcon: ViewStyle;
  helperText: TextStyle;
  errorText: TextStyle;
  errorIcon: TextStyle;
};

type TextStyle = {
  fontSize: number;
  color: string;
};

const Input: React.FC<InputProps> = ({
  value,
  onChangeText,
  placeholder,
  size = 'md',
  variant = 'outlined',
  error,
  disabled = false,
  readOnly = false,
  keyboardType = 'default',
  secureTextEntry = false,
  helperText,
  icon,
  trailingIcon,
  testID,
}) => {
  const themeColors = useThemeColors() as ThemePalette;
  const styles = getInputStyles(themeColors);

  const sizeStyle = styles.sizes[size];
  const variantStyle = styles.variants[variant];
  const hasError = Boolean(error);
  const showTrailingIcon = Boolean(trailingIcon) || hasError;

  const handleTrailingIconPress = () => {
    if (hasError) {
      // Peut être utilisé pour effacer l'erreur
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.inputWrapper, variantStyle, sizeStyle, disabled && styles.disabled]}>
        {icon && <View style={styles.leadingIcon}>{icon}</View>}
        <TextInput
          style={[styles.input, !!icon && styles.withLeadingIcon, !!trailingIcon && styles.withTrailingIcon]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={themeColors.onSurfaceMuted}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          editable={!disabled && !readOnly}
          testID={testID}
        />
        {showTrailingIcon && (
          <TouchableOpacity
            style={styles.trailingIcon}
            onPress={handleTrailingIconPress}
            accessibilityRole="button"
          >
            {hasError ? (
              <Text style={styles.errorIcon}>✕</Text>
            ) : (
              trailingIcon
            )}
          </TouchableOpacity>
        )}
      </View>
      {(helperText || error) && (
        <Text style={[styles.helperText, hasError && styles.errorText]}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
};

function getInputStyles(themeColors: ThemePalette): InputStyles {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return StyleSheet.create<any>({
    container: {
      gap: SPACING.xs,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    input: {
      flex: 1,
      padding: 0,
      ...TYPOGRAPHY_TOKENS.body,
    },
    sizes: {
      sm: {
        minHeight: 32,
        paddingHorizontal: SPACING.sm,
      },
      md: {
        minHeight: 44,
        paddingHorizontal: SPACING.md,
      },
      lg: {
        minHeight: 52,
        paddingHorizontal: SPACING.lg,
      },
    },
    variants: {
      default: {
        backgroundColor: themeColors.surface,
      },
      outlined: {
        backgroundColor: themeColors.surface,
        borderWidth: 1,
        borderColor: themeColors.border,
      },
      filled: {
        backgroundColor: themeColors.surfaceMuted,
      },
    },
    disabled: {
      opacity: 0.5,
    },
    leadingIcon: {
      paddingHorizontal: SPACING.sm,
    },
    trailingIcon: {
      paddingHorizontal: SPACING.sm,
    },
    withLeadingIcon: {},
    withTrailingIcon: {},
    helperText: {
      fontSize: 12,
      color: themeColors.onSurfaceMuted,
    },
    errorText: {
      color: themeColors.danger,
    },
    errorIcon: {
      fontSize: 16,
      color: themeColors.danger,
    },
  });
}

export default React.memo(Input);