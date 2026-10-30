import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { RADIUS, SPACING } from '../theme/spacing';
import { typography } from '../theme/typography';
import { useThemeColors } from '../theme/useThemedStyles';
import type { PublishField } from '../lib/smartPublishValidation';

export type SmartPublishIssue = {
  field: PublishField;
  label: string;
  message: string;
};

type SmartPublishAssistantProps = {
  active: boolean;
  visible: boolean;
  step: number;
  totalSteps: number;
  stepLabel: string;
  steps: { label: string; status: 'complete' | 'current' | 'upcoming' }[];
  issues: SmartPublishIssue[];
  technicalError: string | null;
  onFix: (field: PublishField) => void;
  onRetry: () => void;
  onOpen: () => void;
  onClose: () => void;
};

const LAUNCHER_WIDTH = 154;
const LAUNCHER_HEIGHT = 48;
const HEADER_RESERVED = 90;
const FOOTER_RESERVED = 112;

export const SmartPublishAssistant: React.FC<SmartPublishAssistantProps> = ({
  active,
  visible,
  step,
  totalSteps,
  stepLabel,
  steps,
  issues,
  technicalError,
  onFix,
  onRetry,
  onOpen,
  onClose,
}) => {
  const { t } = useApp();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const limits = useMemo(() => ({
    width,
    top: insets.top + HEADER_RESERVED,
    bottom: Math.max(insets.top + HEADER_RESERVED, height - insets.bottom - FOOTER_RESERVED - LAUNCHER_HEIGHT),
  }), [height, insets.bottom, insets.top, width]);
  const initialPosition = {
    x: Math.max(12, width - LAUNCHER_WIDTH - 16),
    y: Math.max(insets.top + HEADER_RESERVED, height - insets.bottom - FOOTER_RESERVED - LAUNCHER_HEIGHT),
  };
  const [position, setPosition] = useState(initialPosition);
  const positionRef = useRef(initialPosition);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);

  const updatePosition = useCallback((next: { x: number; y: number }) => {
    const bounded = {
      x: Math.min(Math.max(8, next.x), Math.max(8, limits.width - LAUNCHER_WIDTH - 8)),
      y: Math.min(Math.max(limits.top, next.y), limits.bottom),
    };
    if (bounded.x === positionRef.current.x && bounded.y === positionRef.current.y) return;
    positionRef.current = bounded;
    setPosition(bounded);
  }, [limits]);

  // The ref reads occur only when native pan events fire, not while rendering.
  // eslint-disable-next-line react-hooks/refs
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
    onPanResponderGrant: () => {
      dragStartRef.current = positionRef.current;
      movedRef.current = false;
    },
    onPanResponderMove: (_, gesture) => {
      if (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5) movedRef.current = true;
      updatePosition({
        x: dragStartRef.current.x + gesture.dx,
        y: dragStartRef.current.y + gesture.dy,
      });
    },
    onPanResponderRelease: () => { if (!movedRef.current) onOpen(); },
    onPanResponderTerminationRequest: () => false,
  }), [onOpen, updatePosition]);

  const isValid = issues.length === 0 && !technicalError;
  const statusText = isValid ? t('smart_publish_step_valid') : t('smart_publish_step_invalid');
  const progressText = t('smart_publish_progress')
    .replace('{{step}}', String(step + 1))
    .replace('{{total}}', String(totalSteps));
  const issueList = issues.map(issue => (
    <TouchableOpacity
      key={issue.field}
      style={[styles.issueRow, { borderColor: colors.border }]}
      onPress={() => {
        onClose();
        onFix(issue.field);
      }}
      accessibilityRole="button"
    >
      <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
      <View style={styles.issueCopy}>
        <Text style={[styles.issueLabel, { color: colors.onSurface }]}>{issue.label}</Text>
        <Text style={[styles.issueMessage, { color: colors.onSurfaceMuted }]}>{issue.message}</Text>
      </View>
      <Text style={[styles.fixText, { color: colors.primary }]}>{t('smart_publish_fix')}</Text>
    </TouchableOpacity>
  ));

  if (!active) return null;

  return (
    <>
      <View
        pointerEvents="box-none"
        style={StyleSheet.absoluteFill}
        onLayout={() => updatePosition(positionRef.current)}
      >
        <View
          {...panResponder.panHandlers}
          style={[
            styles.launcher,
            {
              left: position.x,
              top: position.y,
              backgroundColor: colors.primary,
              shadowColor: colors.shadow,
            },
          ]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('smart_publish_open')}
          accessibilityHint={t('smart_publish_drag_hint')}
          onAccessibilityTap={onOpen}
        >
          <Ionicons name="sparkles" size={18} color={colors.onBrand} />
          <Text style={[styles.launcherText, { color: colors.onBrand }]}>Smart Publish</Text>
          {!isValid ? <View style={[styles.issueDot, { backgroundColor: colors.danger }]} /> : null}
        </View>
      </View>

      <Modal
        visible={visible && active}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.scrimStrong }]}
          onPress={onClose}
        >
          <Pressable
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={event => event.stopPropagation()}
          >
            <View style={styles.header}>
              <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={[styles.title, { color: colors.onSurface }]}>Smart Publish</Text>
                <Text style={[styles.subtitle, { color: colors.onSurfaceMuted }]}>{stepLabel}</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: colors.surfaceMuted }]}
                accessibilityRole="button"
                accessibilityLabel={t('close')}
              >
                <Ionicons name="close" size={20} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.progress, { color: colors.primary }]}>{progressText}</Text>
            <View style={styles.stepList}>
              {steps.map((item, index) => (
                <View key={`${item.label}-${index}`} style={styles.stepRow}>
                  <Ionicons
                    name={item.status === 'complete' ? 'checkmark-circle' : item.status === 'current' ? 'radio-button-on' : 'ellipse-outline'}
                    size={17}
                    color={item.status === 'complete' ? colors.success : item.status === 'current' ? colors.primary : colors.onSurfaceMuted}
                  />
                  <Text
                    style={[
                      styles.stepRowText,
                      { color: item.status === 'current' ? colors.primary : colors.onSurfaceMuted },
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
            <View style={[styles.status, { backgroundColor: isValid ? colors.successContainer : colors.dangerContainer }]}>
              <Ionicons
                name={isValid ? 'checkmark-circle' : 'alert-circle'}
                size={19}
                color={isValid ? colors.success : colors.danger}
              />
              <Text style={[styles.statusText, { color: isValid ? colors.success : colors.danger }]}>
                {statusText}
              </Text>
            </View>
            {isValid ? (
              <Text style={[styles.helperText, { color: colors.onSurfaceMuted }]}>
                {t('smart_publish_all_valid')}
              </Text>
            ) : issueList}
            {technicalError ? (
              <View style={[styles.technicalError, { backgroundColor: colors.dangerContainer }]}>
                <Text style={[styles.issueMessage, { color: colors.danger }]}>{technicalError}</Text>
                <TouchableOpacity onPress={onRetry} accessibilityRole="button" style={styles.retryButton}>
                  <Ionicons name="refresh" size={16} color={colors.primary} />
                  <Text style={[styles.fixText, { color: colors.primary }]}>{t('smart_publish_retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <Text style={[styles.dragHint, { color: colors.onSurfaceMuted }]}>
              {t('smart_publish_drag_hint')}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  launcher: {
    position: 'absolute',
    width: LAUNCHER_WIDTH,
    height: LAUNCHER_HEIGHT,
    zIndex: 20,
    elevation: 12,
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 9,
  },
  launcherText: { ...typography.body, fontSize: 13, fontWeight: '700' },
  issueDot: { position: 'absolute', top: 2, right: 3, width: 10, height: 10, borderRadius: 5 },
  backdrop: { flex: 1, justifyContent: 'center', padding: SPACING.lg },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: { width: 40, height: 40, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { ...typography.title, fontSize: 17 },
  subtitle: { ...typography.caption },
  closeButton: { width: 42, height: 42, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  progress: { ...typography.caption, fontWeight: '700', marginTop: SPACING.xs },
  stepList: { gap: SPACING.xs },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  stepRowText: { ...typography.caption },
  status: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderRadius: RADIUS.md },
  statusText: { ...typography.body, fontWeight: '700' },
  helperText: { ...typography.body, fontSize: 13 },
  issueRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.md },
  issueCopy: { flex: 1 },
  issueLabel: { ...typography.body, fontSize: 13, fontWeight: '700' },
  issueMessage: { ...typography.caption, lineHeight: 18 },
  fixText: { ...typography.caption, fontWeight: '700' },
  technicalError: { padding: SPACING.sm, borderRadius: RADIUS.md, gap: SPACING.sm },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'flex-start', minHeight: 40 },
  dragHint: { ...typography.caption, textAlign: 'center', marginTop: SPACING.xs },
});
