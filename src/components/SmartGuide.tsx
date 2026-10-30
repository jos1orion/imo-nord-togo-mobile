import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import type { SmartGuideMode } from '../context/AppContext.types';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import { RADIUS, SPACING } from '../theme/spacing';
import { typography } from '../theme/typography';
import { safeImpactLight } from '../lib/expoHapticsSafe';
import { resolveSmartGuideTopic, type SmartGuideContext, type SmartGuideTopic } from '../lib/smartGuide';
import type { TranslationKey } from '../i18n';

interface SmartGuideProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (topic: SmartGuideTopic, context: SmartGuideContext) => void;
  initialContext?: SmartGuideContext;
  currentStep?: number;
}

type GuideTurn = {
  id: string;
  question: string;
  topic: SmartGuideTopic;
};

const TOPICS: Record<SmartGuideTopic, {
  title: TranslationKey;
  answer: TranslationKey;
  prompt: TranslationKey;
  icon: keyof typeof Ionicons.glyphMap;
}> = {
  publish: {
    title: 'smart_guide_topic_publish',
    answer: 'smart_guide_answer_publish',
    prompt: 'smart_guide_prompt_publish',
    icon: 'add-circle-outline',
  },
  photos: {
    title: 'smart_guide_topic_photos',
    answer: 'smart_guide_answer_photos',
    prompt: 'smart_guide_topic_photos',
    icon: 'images-outline',
  },
  edit: {
    title: 'smart_guide_topic_edit',
    answer: 'smart_guide_answer_edit',
    prompt: 'smart_guide_topic_edit',
    icon: 'create-outline',
  },
  delete: {
    title: 'smart_guide_topic_delete',
    answer: 'smart_guide_answer_delete',
    prompt: 'smart_guide_topic_delete',
    icon: 'trash-outline',
  },
  search: {
    title: 'smart_guide_topic_search',
    answer: 'smart_guide_answer_search',
    prompt: 'smart_guide_prompt_search',
    icon: 'search-outline',
  },
  price: {
    title: 'smart_guide_topic_price',
    answer: 'smart_guide_answer_price',
    prompt: 'smart_guide_topic_price',
    icon: 'pricetag-outline',
  },
  favorites: {
    title: 'smart_guide_topic_favorites',
    answer: 'smart_guide_answer_favorites',
    prompt: 'smart_guide_prompt_favorites',
    icon: 'heart-outline',
  },
  contact: {
    title: 'smart_guide_topic_contact',
    answer: 'smart_guide_answer_contact',
    prompt: 'smart_guide_prompt_contact',
    icon: 'call-outline',
  },
  visit: {
    title: 'smart_guide_topic_visit',
    answer: 'smart_guide_answer_visit',
    prompt: 'smart_guide_topic_visit',
    icon: 'calendar-outline',
  },
  agent: {
    title: 'smart_guide_topic_agent',
    answer: 'smart_guide_answer_agent',
    prompt: 'smart_guide_topic_agent',
    icon: 'shield-checkmark-outline',
  },
  moderation: {
    title: 'smart_guide_topic_moderation',
    answer: 'smart_guide_answer_moderation',
    prompt: 'smart_guide_topic_moderation',
    icon: 'eye-outline',
  },
  transaction: {
    title: 'smart_guide_topic_transaction',
    answer: 'smart_guide_answer_transaction',
    prompt: 'smart_guide_topic_transaction',
    icon: 'swap-horizontal-outline',
  },
  unknown: {
    title: 'smart_guide_topic_contact',
    answer: 'smart_guide_topic_unknown',
    prompt: 'smart_guide_ask_help',
    icon: 'help-circle-outline',
  },
};

const CONTEXT_LABELS: Record<SmartGuideContext, TranslationKey> = {
  home: 'smart_guide_context_home',
  search: 'smart_guide_context_home',
  publish: 'smart_guide_context_publish',
  property: 'smart_guide_context_property',
  profile: 'smart_guide_context_profile',
  agent: 'smart_guide_context_publish',
  messages: 'smart_guide_context_messages',
  general: 'smart_guide_context_general',
};

const MODE_OPTIONS: {
  id: SmartGuideMode;
  label: TranslationKey;
  description: TranslationKey;
}[] = [
  {
    id: 'discovery',
    label: 'smart_guide_mode_discovery',
    description: 'smart_guide_mode_discovery_desc',
  },
  {
    id: 'normal',
    label: 'smart_guide_mode_normal',
    description: 'smart_guide_mode_normal_desc',
  },
  {
    id: 'expert',
    label: 'smart_guide_mode_expert',
    description: 'smart_guide_mode_expert_desc',
  },
];

const SUGGESTED_TOPICS: Record<SmartGuideContext, SmartGuideTopic[]> = {
  home: ['search', 'publish', 'favorites', 'contact'],
  search: ['search', 'price', 'favorites', 'contact'],
  publish: ['publish', 'photos', 'edit', 'agent'],
  property: ['contact', 'visit', 'price', 'favorites'],
  profile: ['favorites', 'agent', 'edit', 'contact'],
  agent: ['publish', 'photos', 'edit', 'moderation'],
  messages: ['contact', 'visit', 'agent'],
  general: ['search', 'publish', 'contact', 'favorites'],
};

export const SmartGuideModal: React.FC<SmartGuideProps> = ({
  visible,
  onClose,
  onNavigate,
  initialContext = 'general',
  currentStep,
}) => {
  const {
    t,
    smartGuideMode,
    setSmartGuideMode,
    smartGuideEnabled,
    setSmartGuideEnabled,
    onboardingProgress,
    updateOnboardingProgress,
  } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(baseStyles);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const listRef = useRef<FlatList<GuideTurn>>(null);
  const shouldFollowLatestRef = useRef(false);
  const isAtLatestRef = useRef(true);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<GuideTurn[]>([]);
  const [showModeSettings, setShowModeSettings] = useState(false);
  const [unreadTurns, setUnreadTurns] = useState(0);

  useEffect(() => {
    if (!turns.length) return;
    if (shouldFollowLatestRef.current || isAtLatestRef.current) {
      setUnreadTurns(0);
    } else {
      setUnreadTurns(count => count + 1);
    }
  }, [turns.length]);

  const closeGuide = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleConversationContentSizeChange = () => {
    if (!turns.length) return;
    if (shouldFollowLatestRef.current || isAtLatestRef.current) {
      listRef.current?.scrollToEnd({ animated: true });
      shouldFollowLatestRef.current = false;
      setUnreadTurns(0);
    }
  };

  const handleConversationScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const atLatest = contentSize.height - layoutMeasurement.height - contentOffset.y < 96;
    isAtLatestRef.current = atLatest;
    if (atLatest) setUnreadTurns(0);
  };

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    const topic = resolveSmartGuideTopic(trimmed, initialContext);
    shouldFollowLatestRef.current = true;
    isAtLatestRef.current = true;
    setTurns(previous => [
      ...previous,
      { id: `${Date.now()}-${previous.length}`, question: trimmed, topic },
    ]);
    setUnreadTurns(0);
    updateOnboardingProgress(`smartGuideTopic:${topic}`, true);
    setQuestion('');
  };

  const openAction = (topic: SmartGuideTopic) => {
    closeGuide();
    onNavigate(topic, initialContext);
  };

  const topicPrompt = (topic: SmartGuideTopic) => t(TOPICS[topic].prompt);
  const currentStepKey = initialContext === 'publish' && currentStep !== undefined
    ? `publish_guide_step_${Math.min(Math.max(currentStep, 0), 3)}_body` as TranslationKey
    : null;
  const selectedMode = MODE_OPTIONS.find(option => option.id === smartGuideMode) ?? MODE_OPTIONS[1];
  const availableHeight = Math.max(0, windowHeight - insets.top - insets.bottom - SPACING.xl);
  const panelHeight = Math.min(availableHeight, 720);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closeGuide}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.scrimStrong, paddingTop: insets.top + SPACING.sm, paddingBottom: insets.bottom + SPACING.sm }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeGuide} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { height: panelHeight }]}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap}>
                <View style={[styles.avatarBadge, { backgroundColor: colors.primaryContainer }]}>
                  <Ionicons name="sparkles" size={20} color={colors.primary} />
                </View>
                <View style={styles.headerCopy}>
                  <Text style={[styles.titleText, { color: colors.onSurface }]}>IMO PRESTIGE</Text>
                  <Text style={[styles.subtitleText, { color: colors.onSurfaceMuted }]}>
                    {t('smart_guide_greeting')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  safeImpactLight();
                  closeGuide();
                }}
                style={[styles.closeButton, { backgroundColor: colors.surfaceMuted }]}
                accessibilityRole="button"
                accessibilityLabel={t('close')}
              >
                <Ionicons name="close" size={20} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <View style={[styles.contextCard, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="navigate-outline" size={17} color={colors.primary} />
              <View style={styles.contextCopy}>
                <Text style={[styles.contextText, { color: colors.onPrimaryContainer }]}>
                  {t(CONTEXT_LABELS[initialContext])}
                </Text>
                {currentStepKey ? (
                  <Text style={[styles.stepContext, { color: colors.onPrimaryContainer }]}>
                    {t(currentStepKey)}
                  </Text>
                ) : null}
              </View>
            </View>

            <TouchableOpacity
              style={styles.modeToggle}
              onPress={() => setShowModeSettings(value => !value)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showModeSettings }}
            >
              <Ionicons name="options-outline" size={16} color={colors.primary} />
              <Text style={[styles.modeToggleText, { color: colors.primary }]}>
                {`${t('smart_guide_mode_title')} · ${t(selectedMode.label)}`}
              </Text>
              <Ionicons name={showModeSettings ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} />
            </TouchableOpacity>

            {showModeSettings ? (
              <View style={styles.modePanel}>
                {MODE_OPTIONS.map(option => {
                  const selected = smartGuideMode === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.modeOption,
                        { borderColor: selected ? colors.primary : colors.border },
                        selected && { backgroundColor: colors.primaryContainer },
                      ]}
                      onPress={() => {
                        safeImpactLight();
                        setSmartGuideMode(option.id);
                        setShowModeSettings(false);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <View style={styles.modeOptionCopy}>
                        <Text style={[styles.modeName, { color: selected ? colors.primary : colors.onSurface }]}>
                          {t(option.label)}
                        </Text>
                        <Text style={[styles.modeDescription, { color: colors.onSurfaceMuted }]}>
                          {t(option.description)}
                        </Text>
                      </View>
                      {selected ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.enabledToggle, { borderColor: colors.border }]}
                  onPress={() => setSmartGuideEnabled(!smartGuideEnabled)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: smartGuideEnabled }}
                >
                  <Ionicons
                    name={smartGuideEnabled ? 'notifications-outline' : 'notifications-off-outline'}
                    size={17}
                    color={smartGuideEnabled ? colors.primary : colors.onSurfaceMuted}
                  />
                  <Text style={[styles.enabledText, { color: colors.onSurface }]}>
                    {t(smartGuideEnabled ? 'smart_guide_enabled' : 'smart_guide_disabled')}
                  </Text>
                  <Ionicons
                    name={smartGuideEnabled ? 'toggle' : 'toggle-outline'}
                    size={25}
                    color={smartGuideEnabled ? colors.primary : colors.onSurfaceMuted}
                  />
                </TouchableOpacity>
              </View>
            ) : null}

            <FlatList
              ref={listRef}
              style={styles.conversationList}
              data={turns}
              renderItem={({ item: turn }) => {
                const topic = TOPICS[turn.topic];
                const alreadySeen = Boolean(onboardingProgress[`smartGuideTopic:${turn.topic}`]);
                return (
                  <View style={styles.turnGroup}>
                    <View style={styles.userRow}>
                      <View style={[styles.userBubble, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.userText, { color: colors.onBrand }]}>{turn.question}</Text>
                      </View>
                    </View>
                    <Animated.View entering={FadeInDown.duration(250)} style={styles.assistantRow}>
                      <View style={[styles.assistantAvatar, { backgroundColor: colors.primaryContainer }]}>
                        <Ionicons name={topic.icon} size={15} color={colors.primary} />
                      </View>
                      <View style={[styles.assistantBubble, { backgroundColor: colors.surfaceMuted }]}>
                        <Text style={[styles.topicLabel, { color: colors.primary }]}>{t(topic.title)}</Text>
                        {alreadySeen ? (
                          <Text style={[styles.seenHint, { color: colors.onSurfaceMuted }]}>
                            {t('smart_guide_answer_seen')}
                          </Text>
                        ) : null}
                        <Text style={[styles.assistantText, { color: colors.onSurface }]}>
                          {t(topic.answer)}
                        </Text>
                        {turn.topic === 'unknown' ? (
                          <Text style={[styles.assistantText, styles.followupText, { color: colors.onSurfaceMuted }]}>
                            {t('smart_guide_unknown_followup')}
                          </Text>
                        ) : null}
                        {turn.topic !== 'unknown' ? (
                          <TouchableOpacity
                            style={[styles.actionButton, { borderColor: colors.border }]}
                            onPress={() => openAction(turn.topic)}
                            accessibilityRole="button"
                          >
                            <Text style={[styles.actionText, { color: colors.primary }]}>
                              {t(
                                turn.topic === 'search' || turn.topic === 'price'
                                  ? 'smart_guide_action_search'
                                  : turn.topic === 'publish' || turn.topic === 'photos' || turn.topic === 'edit' || turn.topic === 'delete'
                                    ? 'smart_guide_action_publish'
                                    : turn.topic === 'favorites' || turn.topic === 'agent'
                                      ? 'smart_guide_action_profile'
                                      : 'smart_guide_action_messages'
                              )}
                            </Text>
                            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </Animated.View>
                  </View>
                );
              }}
              keyExtractor={turn => turn.id}
              onScroll={handleConversationScroll}
              onContentSizeChange={handleConversationContentSizeChange}
              scrollEventThrottle={16}
              scrollEnabled
              nestedScrollEnabled
              removeClippedSubviews={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.conversation}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={turns.length === 0 ? (
                <View style={styles.emptyConversation}>
                  <Animated.View entering={FadeInDown.duration(250)} style={styles.assistantRow}>
                    <View style={[styles.assistantAvatar, { backgroundColor: colors.primaryContainer }]}>
                      <Ionicons name="sparkles" size={15} color={colors.primary} />
                    </View>
                    <View style={[styles.assistantBubble, { backgroundColor: colors.surfaceMuted }]}>
                      <Text style={[styles.assistantText, { color: colors.onSurface }]}>
                        {t('smart_guide_intro')}
                      </Text>
                    </View>
                  </Animated.View>
                  <View style={styles.suggestions}>
                    <Text style={[styles.suggestionHeading, { color: colors.onSurfaceMuted }]}>
                      {t('smart_guide_ask_help')}
                    </Text>
                    <View style={styles.suggestionList}>
                      {SUGGESTED_TOPICS[initialContext].map(topic => (
                        <TouchableOpacity
                          key={topic}
                          style={[styles.suggestionChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                          onPress={() => ask(topicPrompt(topic))}
                          accessibilityRole="button"
                        >
                          <Ionicons name={TOPICS[topic].icon} size={14} color={colors.primary} />
                          <Text style={[styles.suggestionText, { color: colors.onSurface }]}>
                            {topicPrompt(topic)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}
            />

            {unreadTurns > 0 ? (
              <TouchableOpacity
                style={[styles.latestButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  isAtLatestRef.current = true;
                  setUnreadTurns(0);
                  listRef.current?.scrollToEnd({ animated: true });
                }}
                accessibilityRole="button"
              >
                <Ionicons name="arrow-down" size={15} color={colors.onBrand} />
                <Text style={[styles.latestButtonText, { color: colors.onBrand }]}>
                  {t('smart_guide_latest_messages')}
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={[styles.composer, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <TextInput
                style={[styles.questionInput, { color: colors.onSurface }]}
                placeholder={t('smart_guide_question_placeholder')}
                placeholderTextColor={colors.onSurfaceMuted}
                value={question}
                onChangeText={setQuestion}
                onSubmitEditing={() => ask(question)}
                returnKeyType="send"
                blurOnSubmit
                multiline
                maxLength={2000}
                textAlignVertical="center"
                scrollEnabled
                accessibilityLabel={t('smart_guide_question_placeholder')}
              />
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: colors.primary }, !question.trim() && styles.sendButtonDisabled]}
                onPress={() => ask(question)}
                disabled={!question.trim()}
                accessibilityRole="button"
                accessibilityLabel={t('smart_guide_send')}
                accessibilityState={{ disabled: !question.trim() }}
              >
                <Ionicons name="arrow-up" size={18} color={colors.onBrand} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const baseStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContainer: { width: '100%', maxWidth: 540, minHeight: 0 },
  modalCard: {
    flex: 1,
    minHeight: 0,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  headerTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerCopy: { flex: 1 },
  avatarBadge: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  titleText: { ...typography.title, fontSize: 16 },
  subtitleText: { ...typography.caption, fontSize: 11 },
  closeButton: { width: 44, height: 44, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  contextCard: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.sm, borderRadius: RADIUS.md },
  contextCopy: { flex: 1 },
  contextText: { ...typography.body, fontSize: 11, lineHeight: 15 },
  stepContext: { ...typography.caption, marginTop: SPACING.xs, lineHeight: 16 },
  modeToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, minHeight: 44, paddingVertical: SPACING.xs },
  modeToggleText: { flex: 1, fontSize: 12, fontWeight: '700' },
  modePanel: { gap: SPACING.xs, marginBottom: SPACING.xs },
  modeOption: { minHeight: 48, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, flexDirection: 'row', alignItems: 'center' },
  modeOptionCopy: { flex: 1 },
  modeName: { fontSize: 12, fontWeight: '700' },
  modeDescription: { fontSize: 10, marginTop: 2 },
  enabledToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderTopWidth: 1, paddingTop: SPACING.sm, marginTop: SPACING.xs },
  enabledText: { flex: 1, fontSize: 11 },
  conversationList: { flex: 1, minHeight: 0 },
  conversation: { flexGrow: 1, gap: SPACING.md, paddingVertical: SPACING.sm },
  emptyConversation: { gap: SPACING.md },
  turnGroup: { gap: SPACING.md },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  userBubble: { maxWidth: '84%', borderRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  userText: { ...typography.body, fontSize: 13 },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  assistantAvatar: { width: 28, height: 28, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  assistantBubble: { flex: 1, borderRadius: RADIUS.lg, borderTopLeftRadius: RADIUS.sm, padding: SPACING.md },
  topicLabel: { ...typography.caption, marginBottom: SPACING.xs },
  seenHint: { fontSize: 10, marginBottom: SPACING.xs, fontStyle: 'italic' },
  assistantText: { ...typography.body, fontSize: 12, lineHeight: 18 },
  followupText: { marginTop: SPACING.sm },
  actionButton: { alignSelf: 'flex-start', marginTop: SPACING.md, minHeight: 34, paddingHorizontal: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.full, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  actionText: { fontSize: 11, fontWeight: '700' },
  suggestions: { marginTop: SPACING.xs },
  suggestionHeading: { ...typography.caption, marginBottom: SPACING.sm },
  suggestionList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  suggestionChip: { maxWidth: '100%', minHeight: 34, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  suggestionText: { fontSize: 10, fontWeight: '600', flexShrink: 1 },
  latestButton: { alignSelf: 'center', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, borderRadius: RADIUS.full, marginBottom: SPACING.xs },
  latestButtonText: { fontSize: 11, fontWeight: '700' },
  composer: { flexDirection: 'row', alignItems: 'center', minHeight: 48, maxHeight: 124, borderWidth: 1, borderRadius: RADIUS.xl, paddingLeft: SPACING.md, paddingRight: SPACING.xs, marginTop: SPACING.sm },
  questionInput: { flex: 1, minHeight: 42, maxHeight: 112, ...typography.body, fontSize: 13, paddingVertical: SPACING.sm },
  sendButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.full },
  sendButtonDisabled: { opacity: 0.5 },
});
