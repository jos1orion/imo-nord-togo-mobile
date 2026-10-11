import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useThemeColors } from '../../theme/useThemedStyles';
import { RADIUS, SPACING } from '../../theme/spacing';
import {
  registerAppAlertListener,
  type AppAlertButton,
  type AppAlertRequest,
} from './appAlertService';

type DialogRequest = AppAlertRequest & {
  id: number;
};

export const AppDialogProvider = ({ children }: React.PropsWithChildren) => {
  const { t } = useApp();
  const colors = useThemeColors();
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [inputState, setInputState] = useState<{ id: number; value: string } | null>(null);
  const current = queue[0];
  const inputValue = current
    ? inputState?.id === current.id
      ? inputState.value
      : current.input?.defaultValue ?? ''
    : '';
  const buttons = current?.buttons?.length
    ? current.buttons
    : [{ text: t('dialog_ok') }];
  const canDismiss = current?.options?.cancelable !== false;

  const enqueue = useCallback((request: AppAlertRequest) => {
    setQueue(previous => [...previous, { ...request, id: Date.now() + Math.random() }]);
  }, []);

  useEffect(() => {
    registerAppAlertListener(enqueue);
    return () => registerAppAlertListener(null);
  }, [enqueue]);

  const dismiss = () => {
    current?.options?.onDismiss?.();
    setQueue(previous => previous.slice(1));
  };

  const selectButton = (button: AppAlertButton) => {
    current?.options?.onDismiss?.();
    setQueue(previous => previous.slice(1));
    button.onPress?.(current?.input ? inputValue : undefined);
  };

  const isDestructive = buttons.some(button => button.style === 'destructive');
  const iconColor = isDestructive ? colors.danger : colors.primary;

  return (
    <>
      {children}
      <Modal
        visible={Boolean(current)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (canDismiss) dismiss();
        }}
      >
        <View style={[styles.backdrop, { backgroundColor: colors.scrimStrong }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (canDismiss) dismiss();
            }}
            accessibilityLabel={t('cancel')}
          />
          <View
            style={[
              styles.dialog,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.shadow,
              },
            ]}
            accessibilityRole="alert"
            accessibilityViewIsModal
          >
            <View style={[styles.iconWrap, { backgroundColor: isDestructive ? colors.dangerContainer : colors.primaryContainer }]}>
              <Ionicons
                name={isDestructive ? 'alert-circle-outline' : 'information-circle-outline'}
                size={27}
                color={iconColor}
              />
            </View>
            <Text style={[styles.title, { color: colors.onSurface }]}>{current?.title}</Text>
            {current?.message ? (
              <Text style={[styles.message, { color: colors.onSurfaceMuted }]}>{current.message}</Text>
            ) : null}
            {current?.input ? (
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.borderStrong,
                    color: colors.onSurface,
                  },
                ]}
                value={inputValue}
                onChangeText={value => {
                  if (current) setInputState({ id: current.id, value });
                }}
                keyboardType={current.input.keyboardType}
                autoFocus
                placeholder={t('dialog_input_placeholder')}
                placeholderTextColor={colors.onSurfaceMuted}
                accessibilityLabel={current.title}
              />
            ) : null}
            <View style={[styles.actions, buttons.length > 2 && styles.actionsStacked]}>
              {buttons.map((button, index) => {
                const destructive = button.style === 'destructive';
                const cancel = button.style === 'cancel';
                const primary = !cancel && (buttons.length === 1 || index === buttons.length - 1);
                return (
                  <Pressable
                    key={`${current?.id}-${index}`}
                    style={({ pressed }) => [
                      styles.action,
                      buttons.length === 2 && styles.actionHalf,
                      primary && { backgroundColor: colors.primary },
                      cancel && { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1 },
                      destructive && { backgroundColor: colors.dangerContainer },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => selectButton(button)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.actionText,
                        { color: primary ? colors.onBrand : destructive ? colors.danger : colors.onSurface },
                      ]}
                    >
                      {button.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
    elevation: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  action: {
    minHeight: 48,
    flexGrow: 1,
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  actionHalf: {
    flexGrow: 1,
    flexBasis: 0,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
});
