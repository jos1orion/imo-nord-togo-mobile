import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, InteractionManager } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../../App';
import COLORS from '../theme/colors';
import EmptyState from '../components/ui/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MessagesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Messages'>;

const MessagesScreen = () => {
  const { chats, currentUser, users, t, language } = useApp();
  const navigation = useNavigation<MessagesScreenNavigationProp>();
  const insets = useSafeAreaInsets();

  const userChats = chats.filter(chat =>
    currentUser && chat.participants.includes(currentUser.id)
  );

  const handleOpenChat = (chat: typeof userChats[0]) => {
    const otherUserId = chat.participants.find(id => id !== currentUser?.id);
    if (!otherUserId) {
      Alert.alert(t('messages_conversation_title'), t('messages_conversation_unavailable'));
      return;
    }
    InteractionManager.runAfterInteractions(() => {
      navigation.navigate('Chat', { chatId: chat.id, otherUserId });
    });
  };

  const renderChatItem = ({ item }: { item: typeof userChats[0] }) => {
    const otherUserId = item.participants.find(id => id !== currentUser?.id);
    const otherUser = users.find(u => u.id === otherUserId);

    return (
      <TouchableOpacity
        style={styles.chatItem}
        activeOpacity={0.85}
        delayPressIn={0}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={() => handleOpenChat(item)}
      >
        <View style={styles.chatHeader}>
          <Ionicons name="person-circle" size={40} color={COLORS.primary} />
          <View style={styles.chatInfo}>
            <Text style={styles.userName}>{otherUser?.name || t('messages_user_fallback')}</Text>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage?.content || t('messages_new_conversation')}
            </Text>
          </View>
          <View style={styles.chatMeta}>
            <Text style={styles.timestamp}>
              {item.lastMessage
                ? new Date(item.lastMessage.timestamp).toLocaleDateString(
                    language === 'fr' ? 'fr-FR' : 'en-US'
                  )
                : ''}
            </Text>
            {item.unreadCount[currentUser?.id || ''] > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount[currentUser?.id || '']}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 12 }]}>
        <Text style={styles.title}>{t('messages')}</Text>
        {currentUser && (
          <TouchableOpacity
            style={styles.newMessage}
            onPress={() => navigation.navigate('Chat', { chatId: 'support', otherUserId: 'support' })}
          >
            <Ionicons name="chatbubbles" size={16} color="#fff" />
            <Text style={styles.newMessageText}>{t('support_contact')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {userChats.length === 0 ? (
        <EmptyState
          icon="chatbubble-outline"
          title={t('noMessages')}
          actionLabel={!currentUser ? t('home_connect_title') : undefined}
          onAction={
            !currentUser ? () => navigation.navigate('MainTabs', { screen: 'Profile' }) : undefined
          }
        />
      ) : (
        <FlatList
          data={userChats.sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )}
          renderItem={renderChatItem}
          keyExtractor={item => item.id}
          style={styles.chatList}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  newMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  newMessageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    backgroundColor: COLORS.card,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
    padding: 15,
    elevation: 2,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  lastMessage: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  chatMeta: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: 12,
    color: '#94A3B8',
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 10,
  },
  loginCta: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  loginCtaText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default MessagesScreen;
