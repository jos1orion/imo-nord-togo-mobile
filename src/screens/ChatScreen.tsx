import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AppAlert as Alert } from '../components/ui/appAlertService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import { RootStackParamList } from '../../App';
import COLORS from '../theme/colors';
import { safeImpactLight } from '../lib/expoHapticsSafe';
import { typography } from '../theme/typography';
import { RADIUS, SPACING } from '../theme/spacing';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;
type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Chat'>;

const ChatScreen = () => {
  const styles = useThemedStyles(baseStyles);
  const themeColors = useThemeColors();
  const { chats, getChatMessages, sendMessage, markMessagesAsRead, users, currentUser, t } = useApp();
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const { chatId, otherUserId, otherUserName: routeOtherUserName, propertyId: routePropertyId } = route.params;

  const [messageText, setMessageText] = useState('');
  const [activeChatId, setActiveChatId] = useState(chatId);
  const flatListRef = useRef<FlatList>(null);

  const messages = getChatMessages(activeChatId);
  const propertyId = chats.find(chat => chat.id === activeChatId)?.propertyId ?? routePropertyId;
  const otherUser = users.find(u => u.id === otherUserId);
  const otherUserName = otherUser?.name || routeOtherUserName || (otherUserId === 'support' ? 'Support' : 'Utilisateur');

  useEffect(() => {
    setActiveChatId(chatId);
  }, [chatId]);

  useEffect(() => {
    if (currentUser) {
      void markMessagesAsRead(activeChatId, currentUser.id).catch(error => {
        Alert.alert(t('error'), error instanceof Error ? error.message : t('error'));
      });
    }
  }, [activeChatId, currentUser, markMessagesAsRead, t]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!currentUser) {
      return;
    }
    if (messageText.trim()) {
      try {
        const result = await sendMessage(otherUserId, messageText.trim(), propertyId);
        setActiveChatId(result.chatId);
        setMessageText('');
        void safeImpactLight();
      } catch (error) {
        Alert.alert(t('error'), error instanceof Error ? error.message : t('error'));
      }
    }
  };

  const renderMessage = ({ item }: { item: typeof messages[0] }) => {
    const isOwnMessage = item.senderId === currentUser?.id;

    return (
      <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
        <Text style={[styles.messageText, isOwnMessage ? styles.ownMessageText : styles.otherMessageText]}>
          {item.content}
        </Text>
        <Text style={[styles.timestamp, isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp]}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={themeColors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{otherUserName}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={messageText}
            onChangeText={setMessageText}
            placeholder={currentUser ? t('typeMessage') : t('chat_placeholder_login')}
            placeholderTextColor={themeColors.onSurfaceMuted}
            multiline
            editable={!!currentUser}
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || !currentUser}
          >
            <Ionicons name="send" size={18} color={themeColors.white} />
          </TouchableOpacity>
        </View>
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
    justifyContent: 'space-between',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    ...typography.title,
    color: COLORS.onSurface,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 10,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 5,
    padding: 10,
    borderRadius: 15,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: COLORS.onSurface,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 5,
  },
  ownTimestamp: {
    color: COLORS.overlayWhite70,
    textAlign: 'right',
  },
  otherTimestamp: {
    color: COLORS.onSurfaceMuted,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
    color: COLORS.onSurface,
    backgroundColor: COLORS.background,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.surfaceAlt,
  },
});

export default ChatScreen;
