import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  InteractionManager,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import { RootStackParamList } from '../../App';
import COLORS from '../theme/colors';
import EmptyState from '../components/ui/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getContactEmail, getWhatsAppUrl } from '../constants/appConfig';

type MessagesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Messages'>;

const MessagesScreen = () => {
  const styles = useThemedStyles(baseStyles);
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

  const openSupportLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('error'), t('support_contact_error'));
    }
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

  const supportHeader = (
    <View style={styles.content}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 12 }]}>
        <Text style={styles.title}>{t('support_title')}</Text>
        <View style={styles.availability}>
          <View style={styles.availabilityDot} />
          <Text style={styles.availabilityText}>{t('support_contact')}</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="headset" size={26} color={COLORS.primary} />
        </View>
        <Text style={styles.heroTitle}>{t('support_heading')}</Text>
        <Text style={styles.heroDescription}>{t('support_description')}</Text>
      </View>

      <Text style={styles.sectionTitle}>{t('support_choose_contact')}</Text>
      <TouchableOpacity
        style={styles.contactCard}
        activeOpacity={0.8}
        accessibilityRole="button"
        onPress={() => void openSupportLink(`mailto:${getContactEmail()}`)}
      >
        <View style={[styles.contactIcon, styles.emailIcon]}>
          <Ionicons name="mail-outline" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactTitle}>{t('contact_email')}</Text>
          <Text style={styles.contactDescription}>{t('support_email_description')}</Text>
          <Text style={styles.contactDetail}>{getContactEmail()}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.contactCard}
        activeOpacity={0.8}
        accessibilityRole="button"
        onPress={() => void openSupportLink(getWhatsAppUrl())}
      >
        <View style={[styles.contactIcon, styles.whatsappIcon]}>
          <Ionicons name="logo-whatsapp" size={22} color="#15803D" />
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactTitle}>{t('contact_whatsapp')}</Text>
          <Text style={styles.contactDescription}>{t('support_whatsapp_description')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, styles.conversationsTitle]}>
        {t('support_conversations')}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={userChats.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )}
        renderItem={renderChatItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={supportHeader}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title={t('support_empty_title')}
            description={t('support_empty_description')}
            actionLabel={!currentUser ? t('home_connect_title') : undefined}
            onAction={
              !currentUser ? () => navigation.navigate('MainTabs', { screen: 'Profile' }) : undefined
            }
            style={styles.emptyConversations}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 16 },
        ]}
      />
    </View>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 18,
  },
  header: {
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.successBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  availabilityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  availabilityText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
  },
  hero: {
    backgroundColor: COLORS.infoBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    marginBottom: 16,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 7,
  },
  heroDescription: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    marginBottom: 10,
  },
  contactIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  emailIcon: {
    backgroundColor: COLORS.infoBg,
  },
  whatsappIcon: {
    backgroundColor: '#DCFCE7',
  },
  contactInfo: {
    flex: 1,
    marginRight: 10,
  },
  contactTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  contactDescription: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  contactDetail: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  conversationsTitle: {
    marginTop: 18,
    marginBottom: 8,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyConversations: {
    paddingTop: 14,
    paddingBottom: 18,
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
