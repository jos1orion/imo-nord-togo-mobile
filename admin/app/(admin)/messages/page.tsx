'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DataTable from '../../../components/DataTable';
import SectionHeader from '../../../components/SectionHeader';
import { formatDate } from '../../../lib/format';
import { supabase } from '../../../lib/supabaseClient';
import { useSupabaseTable } from '../../../lib/useSupabaseTable';

type MessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
};

type SupportConversation = {
  id: string;
  agent_id: string;
  status: 'open' | 'resolved';
  created_at: string;
  updated_at: string;
  agent_name: string;
  agent_phone: string;
  last_message?: SupportMessage;
};

type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

type AgentProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

export default function MessagesPage() {
  const { data: dataMessages, loading: messagesLoading, error: messagesError, reload } =
    useSupabaseTable<MessageRow>('messages', { orderBy: 'created_at' });
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingSupportMessages, setLoadingSupportMessages] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const supportMessagesRequest = useRef(0);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    setLoadingError(null);
    const { data: rows, error: conversationsError } = await supabase
      .from('support_conversations')
      .select('id, agent_id, status, created_at, updated_at')
      .order('updated_at', { ascending: false });
    if (conversationsError) {
      setLoadingError(conversationsError.message);
      setLoadingConversations(false);
      return;
    }

    const conversationRows = rows ?? [];
    const agentIds = [...new Set(conversationRows.map(row => row.agent_id))];
    const [{ data: profiles, error: profilesError }, { data: messageRows, error: messagesError }] =
      agentIds.length
        ? await Promise.all([
            supabase.from('profiles').select('id, full_name, phone').in('id', agentIds),
            supabase
              .from('support_messages')
              .select('id, conversation_id, sender_id, content, read_at, created_at')
              .in('conversation_id', conversationRows.map(row => row.id))
              .order('created_at', { ascending: false }),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];

    if (profilesError || messagesError) {
      setLoadingError(profilesError?.message ?? messagesError?.message ?? 'Unable to load support inbox.');
      setLoadingConversations(false);
      return;
    }

    const profileById = new Map(
      ((profiles ?? []) as AgentProfile[]).map(profile => [profile.id, profile])
    );
    const latestMessageByConversation = new Map<string, SupportMessage>();
    for (const message of (messageRows ?? []) as SupportMessage[]) {
      if (!latestMessageByConversation.has(message.conversation_id)) {
        latestMessageByConversation.set(message.conversation_id, message);
      }
    }

    const nextConversations = conversationRows.map(row => {
      const profile = profileById.get(row.agent_id);
      return {
        ...row,
        agent_name: profile?.full_name || profile?.phone || row.agent_id.slice(0, 8),
        agent_phone: profile?.phone ?? '',
        last_message: latestMessageByConversation.get(row.id),
      };
    }) as SupportConversation[];
    setConversations(nextConversations);
    setSelectedId(current =>
      current && nextConversations.some(conversation => conversation.id === current)
        ? current
        : nextConversations[0]?.id ?? null
    );
    setLoadingConversations(false);
  }, []);

  const loadSupportMessages = useCallback(async (conversationId: string) => {
    const requestId = ++supportMessagesRequest.current;
    setLoadingSupportMessages(true);
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('id, conversation_id, sender_id, content, read_at, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (userData.user) {
        const { error: readError } = await supabase
          .from('support_messages')
          .update({ read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .neq('sender_id', userData.user.id)
          .is('read_at', null);
        if (readError) throw readError;
      }
      if (requestId === supportMessagesRequest.current) {
        setSupportMessages((data ?? []) as SupportMessage[]);
      }
    } catch (error) {
      if (requestId === supportMessagesRequest.current) {
        setReplyError(error instanceof Error ? error.message : 'Unable to load support messages.');
      }
    } finally {
      if (requestId === supportMessagesRequest.current) setLoadingSupportMessages(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadConversations();
    });
    return () => {
      active = false;
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    queueMicrotask(() => {
      if (active) void loadSupportMessages(selectedId);
    });
    return () => {
      active = false;
      supportMessagesRequest.current += 1;
    };
  }, [loadSupportMessages, selectedId]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-support-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => {
        void loadConversations();
        if (selectedId) void loadSupportMessages(selectedId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => {
        void loadConversations();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadConversations, loadSupportMessages, selectedId]);

  const selectedConversation = useMemo(
    () => conversations.find(conversation => conversation.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const sendReply = async () => {
    const content = reply.trim();
    if (!content || !selectedConversation || sending) return;
    setSending(true);
    setReplyError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('Session administrateur introuvable.');
      const { error } = await supabase.from('support_messages').insert({
        conversation_id: selectedConversation.id,
        sender_id: userData.user.id,
        content,
      });
      if (error) throw error;
      setReply('');
      await Promise.all([
        loadSupportMessages(selectedConversation.id),
        loadConversations(),
      ]);
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : 'Unable to send reply.');
    } finally {
      setSending(false);
    }
  };

  const resolveConversation = async () => {
    if (!selectedConversation) return;
    setReplyError(null);
    const nextStatus = selectedConversation.status === 'open' ? 'resolved' : 'open';
    const { error } = await supabase
      .from('support_conversations')
      .update({ status: nextStatus })
      .eq('id', selectedConversation.id);
    if (error) {
      setReplyError(error.message);
      return;
    }
    await loadConversations();
  };

  return (
    <div className="grid">
      <SectionHeader title="Messages" subtitle="Répondez aux demandes privées des agents." />

      <section className="support-inbox" aria-label="Boîte de réception du support agent">
        <aside className="card support-thread-list">
          <div className="support-panel-heading">
            <div>
              <h2>Demandes agents</h2>
              <p>{conversations.length} conversation(s)</p>
            </div>
            <button className="ghost-button small" onClick={() => void loadConversations()}>
              Actualiser
            </button>
          </div>
          {loadingConversations ? <p className="support-muted">Chargement des demandes…</p> : null}
          {loadingError ? <div className="alert" role="alert">{loadingError}</div> : null}
          {!loadingConversations && !loadingError && conversations.length === 0 ? (
            <p className="support-muted">Aucune demande de support pour le moment.</p>
          ) : null}
          <div className="support-thread-items">
            {conversations.map(conversation => (
              <button
                type="button"
                key={conversation.id}
                className={`support-thread ${conversation.id === selectedId ? 'active' : ''}`}
                onClick={() => setSelectedId(conversation.id)}
              >
                <span className="support-thread-top">
                  <strong>{conversation.agent_name}</strong>
                  <span className={`support-status ${conversation.status}`}>
                    {conversation.status === 'open' ? 'Ouverte' : 'Résolue'}
                  </span>
                </span>
                <span className="support-thread-preview">
                  {conversation.last_message?.content ?? 'Aucun message'}
                </span>
                <span className="support-thread-date">
                  {formatDate(conversation.last_message?.created_at ?? conversation.updated_at)}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="card support-conversation">
          {selectedConversation ? (
            <>
              <div className="support-panel-heading support-conversation-heading">
                <div>
                  <h2>{selectedConversation.agent_name}</h2>
                  <p>
                    {selectedConversation.agent_phone || `Compte ${selectedConversation.agent_id.slice(0, 8)}`}
                  </p>
                </div>
                <button className="ghost-button small" onClick={() => void resolveConversation()}>
                  {selectedConversation.status === 'open' ? 'Marquer résolue' : 'Rouvrir'}
                </button>
              </div>
              <div className="support-message-list" aria-live="polite">
                {loadingSupportMessages ? <p className="support-muted">Chargement des messages…</p> : null}
                {supportMessages.map(message => (
                  <article
                    key={message.id}
                    className={`support-message ${message.sender_id === selectedConversation.agent_id ? 'agent' : 'admin'}`}
                  >
                    <p>{message.content}</p>
                    <time>{formatDate(message.created_at)}</time>
                  </article>
                ))}
                {!loadingSupportMessages && supportMessages.length === 0 ? (
                  <p className="support-muted">L’agent n’a pas encore envoyé de message.</p>
                ) : null}
              </div>
              {replyError ? <div className="alert" role="alert">{replyError}</div> : null}
              <form
                className="support-reply"
                onSubmit={event => {
                  event.preventDefault();
                  void sendReply();
                }}
              >
                <textarea
                  value={reply}
                  onChange={event => setReply(event.target.value)}
                  placeholder="Écrire une réponse à l’agent…"
                  maxLength={4000}
                  rows={3}
                />
                <button className="primary-button" type="submit" disabled={!reply.trim() || sending}>
                  {sending ? 'Envoi…' : 'Répondre'}
                </button>
              </form>
            </>
          ) : (
            <div className="support-no-selection">
              <h2>Sélectionnez une conversation</h2>
              <p>Les messages des agents apparaîtront ici.</p>
            </div>
          )}
        </section>
      </section>

      <SectionHeader title="Messages des utilisateurs" subtitle="Historique des conversations liées aux annonces." />
      <DataTable
        loading={messagesLoading}
        error={messagesError}
        onRetry={reload}
        rows={dataMessages}
        emptyLabel="Aucun message."
        columns={[
          { key: 'created_at', label: 'Date', render: row => formatDate(row.created_at) },
          { key: 'sender_id', label: 'De', render: row => row.sender_id.slice(0, 8) },
          { key: 'receiver_id', label: 'Vers', render: row => row.receiver_id.slice(0, 8) },
          { key: 'content', label: 'Aperçu' },
          { key: 'read', label: 'Lu', render: row => (row.read ? 'Oui' : 'Non') },
        ]}
      />
    </div>
  );
}
