import React from 'react';
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
import type { SupportConversation, SupportMessage } from '../useAdminSupportInbox';

type AdminSupportInboxProps = {
  conversations: SupportConversation[];
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
  formatDateTime: (value: string | number | Date) => string;
  translate: (key: AdminTranslationKey) => string;
  theme: AdminTheme;
  styles: ReturnType<typeof createAdminStyles>;
};

const AdminSupportInbox: React.FC<AdminSupportInboxProps> = ({
  conversations,
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
  formatDateTime,
  translate,
  theme,
  styles,
}) => {
  const selectedConversation = conversations.find(
    conversation => conversation.id === selectedConversationId
  ) ?? null;

  return (
    <View style={styles.supportInbox}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>{translate("Demandes des agents")}</Text>
          <Text style={styles.sectionSubtitle}>
            {translate("Répondez aux messages privés des agents.")}
          </Text>
        </View>
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

      {error ? <Text style={styles.supportError}>{error}</Text> : null}
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
          onPress={() => onSelectConversation(conversation.id)}
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
              ? <ActivityIndicator size="small" color={theme.onBrand} />
              : <Ionicons name="send" size={16} color={theme.onBrand} />}
            <Text style={styles.supportSendButtonText}>{translate("Repondre")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

export default AdminSupportInbox;
