import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import COLORS from '../theme/colors';

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { notifications, markNotificationRead, clearNotifications, language, t } = useApp();

  const handleClear = () => {
    Alert.alert(t('notifications_clear_title'), t('notifications_clear_message'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('profile_clear_history'), style: 'destructive', onPress: clearNotifications },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('notifications_title')}</Text>
        {notifications.length > 0 ? (
          <TouchableOpacity onPress={handleClear} hitSlop={10}>
            <Text style={styles.clearText}>{t('profile_clear_history')}</Text>
          </TouchableOpacity>
        ) : <View style={styles.headerSpacer} />}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={30} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('notifications_empty_title')}</Text>
            <Text style={styles.emptyText}>{t('notifications_empty_message')}</Text>
          </View>
        ) : (
          notifications.map(notification => (
            <TouchableOpacity
              key={notification.id}
              style={[styles.item, !notification.read && styles.itemUnread]}
              onPress={() => markNotificationRead(notification.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.itemIcon, notification.read && styles.itemIconRead]}>
                <Ionicons
                  name={notification.read ? 'checkmark' : 'ellipse'}
                  size={notification.read ? 17 : 10}
                  color="#fff"
                />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{notification.title}</Text>
                <Text style={styles.itemBody}>{notification.body}</Text>
                <Text style={styles.date}>
                  {new Date(notification.createdAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              {!notification.read ? <View style={styles.unreadIndicator} /> : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { flex: 1, marginLeft: 12, fontSize: 19, fontWeight: '700', color: COLORS.text },
  headerSpacer: { width: 42 },
  clearText: { color: COLORS.error, fontSize: 14, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 32 },
  emptyState: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 90 },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.infoBg,
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyText: { textAlign: 'center', lineHeight: 21, color: COLORS.textMuted },
  item: {
    flexDirection: 'row',
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemUnread: { borderColor: COLORS.primary, backgroundColor: COLORS.infoBg },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginRight: 12,
    marginTop: 1,
  },
  itemIconRead: { backgroundColor: COLORS.textMuted },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  itemBody: { fontSize: 14, lineHeight: 20, color: COLORS.textMuted },
  date: { marginTop: 8, fontSize: 12, color: COLORS.textMuted },
  unreadIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginLeft: 8, marginTop: 5 },
});

export default NotificationsScreen;
