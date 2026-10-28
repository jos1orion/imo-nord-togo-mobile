import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { AdminTranslationKey } from '../../i18n/admin';

export type SupportConversation = {
  id: string;
  agent_id: string;
  status: 'open' | 'resolved';
  updated_at: string;
  agent_name: string;
  agent_phone: string | null;
  last_message: {
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
};

export type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

type UseAdminSupportInboxOptions = {
  active: boolean;
  enabled: boolean;
  currentUserId: string | null;
  translate: (key: AdminTranslationKey) => string;
};

export const useAdminSupportInbox = ({
  active,
  enabled,
  currentUserId,
  translate,
}: UseAdminSupportInboxOptions) => {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: conversationsError } = await supabase
        .from('support_conversations')
        .select('id, agent_id, status, updated_at')
        .order('updated_at', { ascending: false });
      if (conversationsError) throw conversationsError;

      const conversationRows = rows ?? [];
      const agentIds = [...new Set(conversationRows.map(row => row.agent_id))];
      const conversationIds = conversationRows.map(row => row.id);
      const [{ data: profiles, error: profilesError }, { data: latestMessages, error: messagesError }] =
        agentIds.length
          ? await Promise.all([
              supabase.from('profiles').select('id, full_name, phone').in('id', agentIds),
              supabase
                .from('support_messages')
                .select('id, conversation_id, sender_id, content, created_at')
                .in('conversation_id', conversationIds)
                .order('created_at', { ascending: false }),
            ])
          : [{ data: [], error: null }, { data: [], error: null }];
      if (profilesError) throw profilesError;
      if (messagesError) throw messagesError;

      const profileById = new Map((profiles ?? []).map(profile => [profile.id, profile]));
      const lastMessageByConversation = new Map<string, SupportConversation['last_message']>();
      for (const message of latestMessages ?? []) {
        if (!lastMessageByConversation.has(message.conversation_id)) {
          lastMessageByConversation.set(message.conversation_id, message);
        }
      }

      const nextConversations = conversationRows.map(row => {
        const profile = profileById.get(row.agent_id);
        return {
          ...row,
          agent_name: profile?.full_name || profile?.phone || row.agent_id.slice(0, 8),
          agent_phone: profile?.phone ?? null,
          last_message: lastMessageByConversation.get(row.id) ?? null,
        };
      }) as SupportConversation[];
      setConversations(nextConversations);
      setSelectedConversationId(current =>
        current && nextConversations.some(conversation => conversation.id === current)
          ? current
          : nextConversations[0]?.id ?? null
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : translate('Impossible de charger les messages.')
      );
    } finally {
      setLoading(false);
    }
  }, [translate]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setError(null);
    const { data, error: messagesError } = await supabase
      .from('support_messages')
      .select('id, conversation_id, sender_id, content, read_at, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (messagesError) {
      setError(messagesError.message);
      return;
    }
    setMessages((data ?? []) as SupportMessage[]);
    if (currentUserId) {
      const { error: readError } = await supabase
        .from('support_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)
        .is('read_at', null);
      if (readError) setError(readError.message);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!active || !enabled) return;
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) void loadConversations();
    });
    return () => {
      mounted = false;
    };
  }, [active, enabled, loadConversations]);

  useEffect(() => {
    if (!active || !enabled || !selectedConversationId) return;
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) void loadMessages(selectedConversationId);
    });
    return () => {
      mounted = false;
    };
  }, [active, enabled, loadMessages, selectedConversationId]);

  useEffect(() => {
    if (!active || !enabled) return;
    const channel = supabase
      .channel('mobile-admin-support-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => {
        void loadConversations();
        if (selectedConversationId) void loadMessages(selectedConversationId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => {
        void loadConversations();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [active, enabled, loadConversations, loadMessages, selectedConversationId]);

  const sendReply = async () => {
    const content = reply.trim();
    if (!content || !selectedConversationId || !currentUserId || sending) return;
    setSending(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('support_messages').insert({
        conversation_id: selectedConversationId,
        sender_id: currentUserId,
        content,
      });
      if (insertError) throw insertError;
      setReply('');
      await Promise.all([
        loadMessages(selectedConversationId),
        loadConversations(),
      ]);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : translate("Impossible d'envoyer le message.")
      );
    } finally {
      setSending(false);
    }
  };

  const toggleConversationStatus = async (conversation: SupportConversation) => {
    const nextStatus = conversation.status === 'open' ? 'resolved' : 'open';
    const { error: updateError } = await supabase
      .from('support_conversations')
      .update({ status: nextStatus })
      .eq('id', conversation.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await loadConversations();
  };

  return {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    messages,
    reply,
    setReply,
    loading,
    error,
    sending,
    loadConversations,
    loadMessages,
    sendReply,
    toggleConversationStatus,
  };
};
