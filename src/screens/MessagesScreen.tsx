import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  InteractionManager,
  Linking,
} from 'react-native';
import { AppAlert as Alert } from '../components/ui/appAlertService';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import { RootStackParamList } from '../../App';
import COLORS from '../theme/colors';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getContactEmail, getWhatsAppUrl } from '../constants/appConfig';
import { RADIUS, SPACING } from '../theme/spacing';
import { typography } from '../theme/typography';

type MessagesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Messages'>;

const MessagesScreen = () => {
  const styles = useThemedStyles(baseStyles);
  const themeColors = useThemeColors();
  const { chats, currentUser, users, t, language, hydrated } = useApp();
  const navigation = useNavigation<MessagesScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const canContactSupport = currentUser?.role === 'AGENT';
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  const userChats = chats.filter(chat =>
    currentUser && chat.participants.includes(currentUser.id)
  );
  const faqItems = [
    { question: t('support_faq_publish_question'), answer: t('support_faq_publish_answer') },
    { question: t('support_faq_review_question'), answer: t('support_faq_review_answer') },
    { question: t('support_faq_contact_question'), answer: t('support_faq_contact_answer') },
  ];
  const faqSection = (
    <View style={styles.faqSection}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionHeadingIcon}>
          <Ionicons name="help-circle-outline" size={18} color={themeColors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{t('support_faq_title')}</Text>
      </View>
      {faqItems.map((item, index) => {
        const expanded = expandedFaqIndex === index;
        return (
          <View key={item.question} style={styles.faqItem}>
            <TouchableOpacity
              style={styles.faqQuestion}
              onPress={() => setExpandedFaqIndex(expanded ? null : index)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
            >
              <Text style={styles.faqQuestionText}>{item.question}</Text>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={themeColors.onSurfaceMuted}
              />
            </TouchableOpacity>
            {expanded && <Text style={styles.faqAnswer}>{item.answer}</Text>}
          </View>
        );
      })}
    </View>
  );

  const handleOpenChat = (chat: typeof userChats[0]) => {
    const otherUserId = chat.participants.find(id => id !== currentUser?.id);
    if (!otherUserId) {
      Alert.alert(t('messages_conversation_title'), t('messages_conversation_unavailable'));
      return;
    }
    InteractionManager.runAfterInteractions(() => {
      navigation.navigate('Chat', {
        chatId: chat.id,
        otherUserId,
        propertyId: chat.propertyId,
      });
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
    const unreadCount = currentUser ? item.unreadCount[currentUser.id] ?? 0 : 0;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        activeOpacity={0.85}
        delayPressIn={0}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={() => handleOpenChat(item)}
      >
        <View style={styles.chatHeader}>
          <View style={styles.chatAvatar}>
            <Ionicons name="person" size={19} color={themeColors.primary} />
          </View>
          <View style={styles.chatInfo}>
            <Text style={[styles.userName, unreadCount > 0 && styles.userNameUnread]}>
              {otherUser?.name || t('messages_user_fallback')}
            </Text>
            <Text style={[styles.lastMessage, unreadCount > 0 && styles.lastMessageUnread]} numberOfLines={1}>
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
            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            ) : <Ionicons name="chevron-forward" size={17} color={themeColors.onSurfaceMuted} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const inboxHeader = (
    <View style={styles.content}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 12 }]}>
        <Text style={styles.title}>{t('messages_inbox_title')}</Text>
      </View>
      <View style={[styles.conversationsHeading, styles.conversationsTitle]}>
        <Text style={styles.sectionTitle}>{t('messages_conversations_title')}</Text>
        {userChats.length > 0 && (
          <View style={styles.conversationCount}>
            <Text style={styles.conversationCountText}>{userChats.length}</Text>
          </View>
        )}
      </View>
      {faqSection}
    </View>
  );

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
        <View style={styles.heroTopRow}>
          <View style={styles.heroIcon}>
            <Ionicons name="headset" size={25} color={themeColors.brandAccent} />
          </View>
          <View style={styles.heroAccent}>
            <Ionicons name="sparkles" size={14} color={themeColors.brandAccent} />
          </View>
        </View>
        <Text style={styles.heroTitle}>{t('support_heading')}</Text>
        <Text style={styles.heroDescription}>{t('support_description')}</Text>
      </View>

        <TouchableOpacity
          style={styles.supportChatButton}
          activeOpacity={0.85}
          accessibilityRole="button"
          onPress={() => navigation.navigate('AgentSupportChat')}
        >
          <View style={styles.supportChatIcon}>
            <Ionicons name="chatbubble-ellipses" size={20} color={themeColors.white} />
          </View>
          <View style={styles.supportChatCopy}>
            <Text style={styles.supportChatTitle}>{t('support_agent_start_chat')}</Text>
            <Text style={styles.supportChatDescription}>{t('support_agent_chat_description')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={themeColors.white} />
        </TouchableOpacity>

      <View style={styles.sectionHeading}>
        <View style={styles.sectionHeadingIcon}>
          <Ionicons name="chatbubbles-outline" size={17} color={themeColors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{t('support_choose_contact')}</Text>
      </View>
      <TouchableOpacity
        style={styles.contactCard}
        activeOpacity={0.8}
        accessibilityRole="button"
        onPress={() => void openSupportLink(`mailto:${getContactEmail()}`)}
      >
        <View style={[styles.contactIcon, styles.emailIcon]}>
          <Ionicons name="mail-outline" size={22} color={themeColors.primary} />
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactTitle}>{t('contact_email')}</Text>
          <Text style={styles.contactDescription}>{t('support_email_description')}</Text>
          <Text style={styles.contactDetail}>{getContactEmail()}</Text>
        </View>
        <View style={styles.contactAction}>
          <Ionicons name="arrow-forward" size={17} color={themeColors.primary} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.contactCard}
        activeOpacity={0.8}
        accessibilityRole="button"
        onPress={() => void openSupportLink(getWhatsAppUrl())}
      >
        <View style={[styles.contactIcon, styles.whatsappIcon]}>
          <Ionicons name="logo-whatsapp" size={22} color={themeColors.success} />
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactTitle}>{t('contact_whatsapp')}</Text>
          <Text style={styles.contactDescription}>{t('support_whatsapp_description')}</Text>
        </View>
        <View style={[styles.contactAction, styles.whatsappAction]}>
          <Ionicons name="arrow-forward" size={17} color={themeColors.success} />
        </View>
      </TouchableOpacity>

      <View style={[styles.conversationsHeading, styles.conversationsTitle]}>
        <Text style={styles.sectionTitle}>{t('support_conversations')}</Text>
        {userChats.length > 0 && (
          <View style={styles.conversationCount}>
            <Text style={styles.conversationCountText}>{userChats.length}</Text>
          </View>
        )}
      </View>
      {faqSection}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={[...userChats].sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )}
        renderItem={renderChatItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={canContactSupport ? supportHeader : inboxHeader}
        ListEmptyComponent={
          !hydrated ? (
            <View style={styles.loadingList}>
              {[0, 1, 2].map(item => (
                <View key={item} style={styles.loadingChatItem}>
                  <Skeleton style={styles.loadingAvatar} />
                  <View style={styles.loadingChatCopy}>
                    <Skeleton style={styles.loadingName} />
                    <Skeleton style={styles.loadingMessage} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title={canContactSupport ? t('support_empty_title') : t('messages_inbox_empty_title')}
            description={
              canContactSupport
                ? t('support_empty_description')
                : t('messages_inbox_empty_description')
            }
            actionLabel={!currentUser ? t('home_connect_title') : undefined}
            onAction={
              !currentUser ? () => navigation.navigate('MainTabs', { screen: 'Profile' }) : undefined
            }
            style={styles.emptyConversations}
          />
          )
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
  loadingList: {
    paddingHorizontal: SPACING.lg,
  },
  loadingChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  loadingAvatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
  },
  loadingChatCopy: {
    flex: 1,
    gap: SPACING.sm,
  },
  loadingName: {
    width: '55%',
    height: 14,
  },
  loadingMessage: {
    width: '82%',
    height: 12,
  },
  content: {
    paddingHorizontal: 18,
  },
  header: {
    paddingBottom: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.heroTitle,
    color: COLORS.onSurface,
    letterSpacing: -0.5,
  },
  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.successContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  availabilityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  availabilityText: {
    color: COLORS.onSuccessContainer,
    fontSize: 12,
    fontWeight: '600',
  },
  hero: {
    backgroundColor: COLORS.brand,
    borderRadius: 19,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.overlayWhite12,
    borderWidth: 1,
    borderColor: COLORS.overlayWhite14,
  },
  heroAccent: {
    width: 29,
    height: 29,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.overlayGold14,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroDescription: {
    color: COLORS.onBrandMuted,
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 300,
  },
  supportChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  supportChatIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.overlayWhite20,
  },
  supportChatCopy: {
    flex: 1,
  },
  supportChatTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  supportChatDescription: {
    color: COLORS.overlayWhite90,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 9,
  },
  sectionHeadingIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: COLORS.onSurface,
    fontSize: 16,
    fontWeight: '800',
  },
  faqSection: {
    marginTop: SPACING.md,
  },
  faqItem: {
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  faqQuestion: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  faqQuestionText: {
    flex: 1,
    color: COLORS.onSurface,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  faqAnswer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 11,
    minHeight: 94,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  emailIcon: {
    backgroundColor: COLORS.primaryContainer,
  },
  whatsappIcon: {
    backgroundColor: COLORS.successContainer,
  },
  contactInfo: {
    flex: 1,
    marginRight: 12,
  },
  contactTitle: {
    color: COLORS.onSurface,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  contactDescription: {
    color: COLORS.onSurfaceMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  contactDetail: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  contactAction: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappAction: {
    backgroundColor: COLORS.successContainer,
  },
  conversationsTitle: {
    marginTop: 21,
    marginBottom: 10,
  },
  conversationsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conversationCount: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryContainer,
  },
  conversationCountText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  listContent: {
    flexGrow: 1,
  },
  emptyConversations: {
    paddingTop: 18,
    paddingBottom: 22,
    marginHorizontal: 0,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 18,
    marginVertical: 5,
    borderRadius: 18,
    padding: 14,
    elevation: 1,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryContainer,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  userNameUnread: {
    fontWeight: '800',
  },
  lastMessage: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
    marginTop: 4,
  },
  lastMessageUnread: {
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  chatMeta: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.onSurfaceMuted,
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
    color: COLORS.onSurfaceMuted,
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
    color: COLORS.white,
    fontWeight: '700',
  },
});

export default MessagesScreen;
