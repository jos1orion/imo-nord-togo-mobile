import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppAlert as Alert } from '../components/ui/appAlertService';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import COLORS from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { typography } from '../theme/typography';

type SupportConversation = {
  id: string;
  status: 'open' | 'resolved';
};

type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

const getSupportErrorMessage = (error: unknown, fallback: string, setupRequired: string) => {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const code = error.code;
    const message = error.message;
    if (
      code === 'PGRST205'
      && typeof message === 'string'
      && /support_(conversations|messages)/.test(message)
    ) {
      return setupRequired;
    }
    if (typeof message === 'string') return message;
  }
  return fallback;
};

const AgentSupportChatScreen = () => {
  const styles = useThemedStyles(baseStyles);
  const colors = useThemeColors();
  const { currentUser, t, language } = useApp();
  const navigation = useNavigation();
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<SupportMessage>>(null);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error: loadError } = await supabase
      .from('support_messages')
      .select('id, conversation_id, sender_id, content, read_at, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (loadError) throw loadError;
    setMessages((data ?? []) as SupportMessage[]);
  }, []);

  const loadOrCreateConversation = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'AGENT') {
      setLoading(false);
      setError(t('support_agent_only'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: existing, error: lookupError } = await supabase
        .from('support_conversations')
        .select('id, status')
        .eq('agent_id', currentUser.id)
        .eq('status', 'open')
        .maybeSingle();
      if (lookupError) throw lookupError;

      let activeConversation = existing as SupportConversation | null;
      if (!activeConversation) {
        const { data: created, error: createError } = await supabase
          .from('support_conversations')
          .insert({ agent_id: currentUser.id })
          .select('id, status')
          .single();
        if (createError) {
          if (createError.code !== '23505') throw createError;
          const { data: concurrent, error: concurrentError } = await supabase
            .from('support_conversations')
            .select('id, status')
            .eq('agent_id', currentUser.id)
            .eq('status', 'open')
            .single();
          if (concurrentError) throw concurrentError;
          activeConversation = concurrent as SupportConversation;
        } else {
          activeConversation = created as SupportConversation;
        }
      }

      setConversation(activeConversation);
      await loadMessages(activeConversation.id);
      const { error: readError } = await supabase
        .from('support_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', activeConversation.id)
        .neq('sender_id', currentUser.id)
        .is('read_at', null);
      if (readError) throw readError;
    } catch (loadError) {
      setError(
        getSupportErrorMessage(loadError, t('support_load_failed'), t('support_setup_required'))
      );
    } finally {
      setLoading(false);
    }
  }, [currentUser, loadMessages, t]);

  useEffect(() => {
    void loadOrCreateConversation();
  }, [loadOrCreateConversation]);

  useEffect(() => {
    if (!conversation) return;
    const channel = supabase
      .channel(`agent-support-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        () => {
          void loadMessages(conversation.id).catch(loadError => {
            setError(
              getSupportErrorMessage(loadError, t('support_load_failed'), t('support_setup_required'))
            );
          });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation, loadMessages, t]);

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages]);

  const sendMessage = async () => {
    const content = messageText.trim();
    if (!content || !conversation || !currentUser || sending) return;

    setSending(true);
    setError(null);
    try {
      const { error: sendError } = await supabase.from('support_messages').insert({
        conversation_id: conversation.id,
        sender_id: currentUser.id,
        content,
      });
      if (sendError) throw sendError;
      setMessageText('');
      await loadMessages(conversation.id);
    } catch (sendError) {
      setError(
        getSupportErrorMessage(sendError, t('support_send_failed'), t('support_setup_required'))
      );
    } finally {
      setSending(false);
    }
  };

  if (currentUser?.role !== 'AGENT') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{t('support_agent_only')}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderMessage = ({ item }: { item: SupportMessage }) => {
    const ownMessage = item.sender_id === currentUser.id;
    return (
      <View style={[styles.messageBubble, ownMessage ? styles.ownMessage : styles.replyMessage]}>
        <Text style={[styles.messageText, ownMessage && styles.ownMessageText]}>
          {item.content}
        </Text>
        <Text style={[styles.timestamp, ownMessage && styles.ownTimestamp]}>
          {new Date(item.created_at).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('back')}
          >
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{t('support_title')}</Text>
            <Text style={styles.subtitle}>{t('support_agent_conversation_hint')}</Text>
          </View>
          <Ionicons name="headset-outline" size={22} color={colors.primary} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error && !conversation ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => void loadOrCreateConversation()} style={styles.retryButton}>
              <Text style={styles.retryText}>{t('sync_retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              ref={listRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.messageList}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.primary} />
                  <Text style={styles.emptyText}>{t('support_agent_empty')}</Text>
                </View>
              }
            />
            {error ? <Text style={styles.inlineError}>{error}</Text> : null}
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                value={messageText}
                onChangeText={setMessageText}
                placeholder={t('support_message_placeholder')}
                placeholderTextColor={colors.onSurfaceMuted}
                multiline
                maxLength={4000}
                editable={!sending}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!messageText.trim() || sending) && styles.disabledButton]}
                onPress={() => void sendMessage()}
                disabled={!messageText.trim() || sending}
                accessibilityRole="button"
                accessibilityLabel={t('support_send_message')}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="send" size={18} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const baseStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    ...typography.title,
    color: COLORS.onSurface,
  },
  subtitle: {
    ...typography.caption,
    color: COLORS.onSurfaceMuted,
    marginTop: 2,
  },
  messageList: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  messageBubble: {
    maxWidth: '84%',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: RADIUS.sm,
  },
  replyMessage: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: RADIUS.sm,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.onSurface,
  },
  ownMessageText: {
    color: COLORS.white,
  },
  timestamp: {
    color: COLORS.onSurfaceMuted,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  ownTimestamp: {
    color: COLORS.overlayWhite70,
  },
  emptyState: {
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.xxl,
  },
  emptyText: {
    color: COLORS.onSurfaceMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  errorText: {
    color: COLORS.danger,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  inlineError: {
    color: COLORS.danger,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.background,
    color: COLORS.onSurface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  disabledButton: {
    opacity: 0.55,
  },
});

export default AgentSupportChatScreen;
