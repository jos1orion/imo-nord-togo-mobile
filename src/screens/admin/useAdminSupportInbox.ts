import { useCallback, useEffect, useRef, useState } from 'react';
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

export type SupportAgentRecipient = {
  id: string;
  name: string;
  phone: string | null;
};

export type BulkSupportSendResult = {
  sent: number;
  failures: string[];
};

const getConversationCreationFailure = (
  agentName: string,
  error: { code?: string; message: string },
  translate: (key: AdminTranslationKey) => string
) => {
  if (
    error.code === '42501'
    || /row-level security.*support_conversations/i.test(error.message)
  ) {
    return `${agentName}: ${translate("Supabase refuse de créer la conversation. Vérifiez que le compte administrateur est actif et que la migration 0027 a été appliquée.")}`;
  }
  return `${agentName}: ${error.message}`;
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
  const [agents, setAgents] = useState<SupportAgentRecipient[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messagesRequestVersion = useRef(0);
  const selectedConversationIdRef = useRef<string | null>(null);

  const selectConversation = useCallback((conversationId: string | null) => {
    if (selectedConversationIdRef.current !== conversationId) {
      selectedConversationIdRef.current = conversationId;
      messagesRequestVersion.current += 1;
      setMessages([]);
      setReply('');
      setError(null);
    }
    setSelectedConversationId(conversationId);
  }, []);

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
      const conversationIds = conversationRows.map(row => row.id);
      const [agentsResult, messagesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, phone')
          .eq('role', 'AGENT')
          .order('full_name'),
        conversationIds.length
          ? supabase
              .from('support_messages')
              .select('id, conversation_id, sender_id, content, created_at')
              .in('conversation_id', conversationIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (agentsResult.error) throw agentsResult.error;
      if (messagesResult.error) throw messagesResult.error;

      const agentRows = agentsResult.data ?? [];
      setAgents(agentRows.map(agent => ({
        id: agent.id,
        name: agent.full_name || agent.phone || agent.id.slice(0, 8),
        phone: agent.phone,
      })));

      const profileById = new Map(agentRows.map(profile => [profile.id, profile]));
      const lastMessageByConversation = new Map<string, SupportConversation['last_message']>();
      for (const message of messagesResult.data ?? []) {
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
      const nextSelectedId = selectedConversationIdRef.current
        && nextConversations.some(conversation => conversation.id === selectedConversationIdRef.current)
        ? selectedConversationIdRef.current
        : nextConversations[0]?.id ?? null;
      selectConversation(nextSelectedId);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : translate('Impossible de charger les messages.')
      );
    } finally {
      setLoading(false);
    }
  }, [selectConversation, translate]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const requestVersion = ++messagesRequestVersion.current;
    setError(null);
    try {
      const { data, error: messagesError } = await supabase
        .from('support_messages')
        .select('id, conversation_id, sender_id, content, read_at, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (messagesError) throw messagesError;
      if (requestVersion !== messagesRequestVersion.current) return;

      setMessages((data ?? []) as SupportMessage[]);
      if (currentUserId) {
        const { error: readError } = await supabase
          .from('support_messages')
          .update({ read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .neq('sender_id', currentUserId)
          .is('read_at', null);
        if (readError) throw readError;
      }
    } catch (loadError) {
      if (requestVersion === messagesRequestVersion.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : translate('Impossible de charger les messages.')
        );
      }
    }
  }, [currentUserId, translate]);

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
      messagesRequestVersion.current += 1;
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

  const sendBulkMessage = async (
    recipientIds: string[],
    message: string
  ): Promise<BulkSupportSendResult> => {
    const content = message.trim();
    const recipientIdSet = new Set(recipientIds);
    const recipients = agents.filter(agent => recipientIdSet.has(agent.id));
    if (!currentUserId) throw new Error(translate('Session administrateur introuvable.'));
    if (!content || content.length > 4000) {
      throw new Error(translate('Le message doit contenir entre 1 et 4000 caractères.'));
    }
    if (recipients.length === 0) {
      throw new Error(translate('Sélectionnez au moins un agent.'));
    }
    if (recipients.length !== recipientIdSet.size) {
      throw new Error(translate('Actualisez la liste des agents avant de réessayer.'));
    }
    if (sending) throw new Error(translate('Un envoi est déjà en cours.'));

    setSending(true);
    setError(null);
    const failures: string[] = [];
    let sent = 0;
    try {
      const { data: openConversations, error: conversationsError } = await supabase
        .from('support_conversations')
        .select('id, agent_id')
        .in('agent_id', recipients.map(agent => agent.id))
        .eq('status', 'open');
      if (conversationsError) throw conversationsError;

      const conversationByAgent = new Map(
        (openConversations ?? []).map(conversation => [conversation.agent_id, conversation.id])
      );

      for (const agent of recipients) {
        let conversationId = conversationByAgent.get(agent.id);
        if (!conversationId) {
          const { data: createdConversation, error: createError } = await supabase
            .from('support_conversations')
            .insert({ agent_id: agent.id, status: 'open' })
            .select('id')
            .single();
          if (createError?.code === '23505') {
            const { data: concurrentConversation, error: lookupError } = await supabase
              .from('support_conversations')
              .select('id')
              .eq('agent_id', agent.id)
              .eq('status', 'open')
              .maybeSingle();
            if (lookupError) {
              failures.push(getConversationCreationFailure(agent.name, lookupError, translate));
              continue;
            }
            conversationId = concurrentConversation?.id;
          } else if (createError) {
            failures.push(getConversationCreationFailure(agent.name, createError, translate));
            continue;
          } else {
            conversationId = createdConversation.id;
          }
        }

        if (!conversationId) {
          failures.push(`${agent.name}: ${translate('Conversation introuvable.')}`);
          continue;
        }
        const { error: messageError } = await supabase.from('support_messages').insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content,
        });
        if (messageError) {
          failures.push(`${agent.name}: ${messageError.message}`);
          continue;
        }
        sent += 1;
      }

      await loadConversations();
      return { sent, failures };
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
    agents,
    selectedConversationId,
    setSelectedConversationId: selectConversation,
    messages,
    reply,
    setReply,
    loading,
    error,
    sending,
    loadConversations,
    loadMessages,
    sendReply,
    sendBulkMessage,
    toggleConversationStatus,
  };
};
