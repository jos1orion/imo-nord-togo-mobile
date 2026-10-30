import React, { useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AdminTranslationKey } from '../../../i18n/admin';
import type { AdminTheme, createAdminStyles } from '../../AdminScreen.styles';
import type {
  BulkSupportSendResult,
  SupportAgentRecipient,
  SupportConversation,
  SupportMessage,
} from '../useAdminSupportInbox';

type AdminSupportInboxProps = {
  conversations: SupportConversation[];
  agents: SupportAgentRecipient[];
  selectedConversationId: string | null;
  messages: SupportMessage[];
  currentUserId: string;
  reply: string;
  loading: boolean;
  error: string | null;
  sending: boolean;
  onRefresh: () => void;
  onSelectConversation: (id: string) => void;
  onToggleStatus: (conversation: SupportConversation) => void;
  onReplyChange: (value: string) => void;
  onSend: () => void;
  onSendBulk: (recipientIds: string[], message: string) => Promise<BulkSupportSendResult>;
  formatDateTime: (value: string | number | Date) => string;
  translate: (key: AdminTranslationKey) => string;
  theme: AdminTheme;
  styles: ReturnType<typeof createAdminStyles>;
};

const AdminSupportInbox: React.FC<AdminSupportInboxProps> = ({
  conversations,
  agents,
  selectedConversationId,
  messages,
  currentUserId,
  reply,
  loading,
  error,
  sending,
  onRefresh,
  onSelectConversation,
  onToggleStatus,
  onReplyChange,
  onSend,
  onSendBulk,
  formatDateTime,
  translate,
  theme,
  styles,
}) => {
  const [bulkComposerOpen, setBulkComposerOpen] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkSupportSendResult | null>(null);
  const selectedConversation = conversations.find(
    conversation => conversation.id === selectedConversationId
  ) ?? null;

  const allAgentsSelected = agents.length > 0
    && agents.every(agent => selectedAgentIds.includes(agent.id));
  const toggleAllAgents = () => {
    setSelectedAgentIds(allAgentsSelected ? [] : agents.map(agent => agent.id));
    setBulkError(null);
    setBulkResult(null);
  };
  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds(current =>
      current.includes(agentId)
        ? current.filter(id => id !== agentId)
        : [...current, agentId]
    );
    setBulkError(null);
    setBulkResult(null);
  };
  const handleSendBulk = async () => {
    if (!selectedAgentIds.length || !bulkMessage.trim() || bulkSending) return;
    setBulkSending(true);
    setBulkError(null);
    setBulkResult(null);
    try {
      const result = await onSendBulk(selectedAgentIds, bulkMessage);
      setBulkResult(result);
      if (result.failures.length === 0) {
        setBulkMessage('');
        setBulkComposerOpen(false);
      }
    } catch (sendError) {
      setBulkError(sendError instanceof Error ? sendError.message : translate("Impossible d'envoyer le message."));
    } finally {
      setBulkSending(false);
    }
  };

  return (
    <View style={styles.supportInbox}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>{translate("Demandes des agents")}</Text>
          <Text style={styles.sectionSubtitle}>
            {translate("Répondez aux messages privés des agents.")}
          </Text>
        </View>
        <View style={styles.supportInboxActions}>
          <TouchableOpacity
            style={styles.supportBulkToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: bulkComposerOpen }}
            onPress={() => setBulkComposerOpen(open => !open)}
          >
            <Ionicons name="paper-plane-outline" size={15} color={theme.onAccent} />
            <Text style={styles.supportBulkToggleText}>{translate("Envoyer à plusieurs agents")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sectionActionButton}
            accessibilityRole="button"
            accessibilityLabel={translate("Actualiser")}
            onPress={onRefresh}
          >
            {loading
              ? <ActivityIndicator size="small" color={theme.accent} />
              : <Ionicons name="refresh" size={17} color={theme.accent} />}
          </TouchableOpacity>
        </View>
      </View>

      {error ? <Text style={styles.supportError}>{error}</Text> : null}
      {bulkComposerOpen ? (
        <View style={styles.supportBulkComposer}>
          <View style={styles.supportBulkHeading}>
            <Text style={styles.sectionSubtitle}>{translate("Agents sélectionnés")}</Text>
            <TouchableOpacity onPress={toggleAllAgents} disabled={!agents.length}>
              <Text style={styles.supportBulkSelectAll}>
                {translate(allAgentsSelected ? "Tout désélectionner" : "Tout sélectionner")}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.supportRecipientList}>
            {agents.map(agent => {
              const selected = selectedAgentIds.includes(agent.id);
              return (
                <TouchableOpacity
                  key={agent.id}
                  style={[styles.supportRecipientRow, selected && styles.supportRecipientRowSelected]}
                  onPress={() => toggleAgent(agent.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <Ionicons
                    name={selected ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={selected ? theme.accent : theme.textSoft}
                  />
                  <Text style={styles.supportRecipientName}>{agent.name}</Text>
                  {agent.phone ? <Text style={styles.infoMeta}>{agent.phone}</Text> : null}
                </TouchableOpacity>
              );
            })}
            {!agents.length && !loading ? (
              <Text style={styles.emptyText}>{translate("Aucune demande agent pour le moment.")}</Text>
            ) : null}
          </View>
          <TextInput
            style={[styles.input, styles.textArea, styles.supportBulkMessage]}
            value={bulkMessage}
            onChangeText={setBulkMessage}
            placeholder={translate("Écrire un message commun aux agents...")}
            placeholderTextColor={theme.textSoft}
            multiline
            maxLength={4000}
            editable={!bulkSending}
          />
          {bulkError ? <Text style={styles.supportError}>{bulkError}</Text> : null}
          {bulkResult ? (
            <View>
              <Text style={styles.supportBulkResult}>
                {bulkResult.sent > 0
                  ? <>{translate("Message envoyé à")} {bulkResult.sent} {translate("agent(s).")}</>
                  : translate("Aucun message envoyé.")}
              </Text>
              {bulkResult.failures.length ? (
                <>
                  <Text style={styles.supportError}>{translate("Échecs d’envoi :")}</Text>
                  {bulkResult.failures.map(failure => (
                    <Text key={failure} style={styles.supportError}>{failure}</Text>
                  ))}
                </>
              ) : null}
            </View>
          ) : null}
          <View style={styles.supportComposerActions}>
            <TouchableOpacity
              style={styles.supportCancelButton}
              onPress={() => setBulkComposerOpen(false)}
              disabled={bulkSending}
              accessibilityRole="button"
            >
              <Text style={styles.supportCancelButtonText}>{translate("Annuler")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.supportSendButton,
                (!selectedAgentIds.length || !bulkMessage.trim() || bulkSending) && styles.supportSendButtonDisabled,
              ]}
              disabled={!selectedAgentIds.length || !bulkMessage.trim() || bulkSending}
              onPress={() => void handleSendBulk()}
              accessibilityRole="button"
            >
              {bulkSending
                ? <ActivityIndicator size="small" color={theme.onAccent} />
                : <Ionicons name="send" size={16} color={theme.onAccent} />}
              <Text style={styles.supportSendButtonText}>{translate("Envoyer")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {!loading && conversations.length === 0 ? (
        <Text style={styles.emptyText}>{translate("Aucune demande agent pour le moment.")}</Text>
      ) : null}

      {conversations.map(conversation => (
        <TouchableOpacity
          key={conversation.id}
          style={[
            styles.supportConversationCard,
            selectedConversationId === conversation.id && styles.supportConversationCardSelected,
          ]}
          onPress={() => {
            onSelectConversation(conversation.id);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedConversationId === conversation.id }}
        >
          <View style={styles.infoHeader}>
            <Text style={styles.infoTitle} numberOfLines={1}>{conversation.agent_name}</Text>
            <View
              style={[
                styles.badge,
                conversation.status === 'open' ? styles.badgeAccent : styles.badgeMuted,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  conversation.status === 'open' ? styles.badgeTextAccent : styles.badgeTextMuted,
                ]}
              >
                {conversation.status === 'open'
                  ? translate("Ouvert")
                  : translate("Resolue")}
              </Text>
            </View>
          </View>
          {conversation.agent_phone ? (
            <Text style={styles.infoMeta}>{conversation.agent_phone}</Text>
          ) : null}
          <Text style={styles.supportPreview} numberOfLines={2}>
            {conversation.last_message?.content ?? translate("Aucun message pour le moment.")}
          </Text>
          <Text style={styles.infoMeta}>
            {formatDateTime(conversation.last_message?.created_at ?? conversation.updated_at)}
          </Text>
        </TouchableOpacity>
      ))}

      {selectedConversation ? (
        <View style={styles.supportThread}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{selectedConversation.agent_name}</Text>
              <Text style={styles.sectionSubtitle}>
                {translate("Conversation privée avec l’agent")}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.supportStatusButton}
              onPress={() => onToggleStatus(selectedConversation)}
            >
              <Text style={styles.supportStatusButtonText}>
                {selectedConversation.status === 'open'
                  ? translate("Marquer comme resolu")
                  : translate("Rouvrir")}
              </Text>
            </TouchableOpacity>
          </View>
          {messages.map(message => {
            const isAdminMessage = message.sender_id === currentUserId;
            return (
              <View
                key={message.id}
                style={[
                  styles.supportMessageBubble,
                  isAdminMessage ? styles.supportAdminMessage : styles.supportAgentMessage,
                ]}
              >
                <Text
                  style={[
                    styles.supportMessageText,
                    isAdminMessage && styles.supportAdminMessageText,
                  ]}
                >
                  {message.content}
                </Text>
                <Text
                  style={[
                    styles.supportMessageTime,
                    isAdminMessage && styles.supportAdminMessageTime,
                  ]}
                >
                  {formatDateTime(message.created_at)}
                </Text>
              </View>
            );
          })}
          {messages.length === 0 && !loading ? (
            <Text style={styles.emptyText}>
              {translate("L’agent n’a pas encore envoyé de message.")}
            </Text>
          ) : null}
          <TextInput
            style={[styles.input, styles.textArea, styles.supportReplyInput]}
            value={reply}
            onChangeText={onReplyChange}
            placeholder={translate("Écrire une réponse à l’agent...")}
            placeholderTextColor={theme.textSoft}
            multiline
            maxLength={4000}
            editable={!sending}
            accessibilityLabel={translate("Écrire une réponse à l’agent...")}
          />
          <View style={styles.supportComposerActions}>
            <TouchableOpacity
              style={[
                styles.supportSendButton,
                (!reply.trim() || sending) && styles.supportSendButtonDisabled,
              ]}
              disabled={!reply.trim() || sending}
              onPress={onSend}
              accessibilityRole="button"
            >
              {sending
                ? <ActivityIndicator size="small" color={theme.onAccent} />
                : <Ionicons name="send" size={16} color={theme.onAccent} />}
              <Text style={styles.supportSendButtonText}>{translate("Repondre")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default AdminSupportInbox;
