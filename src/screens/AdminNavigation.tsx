import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createAdminStyles, type AdminTheme } from './AdminScreen.styles';

export type AdminTab =
  | 'dashboard'
  | 'properties'
  | 'clients'
  | 'accounts'
  | 'neighborhoods'
  | 'reports'
  | 'add'
  | 'messages'
  | 'reviews'
  | 'agents'
  | 'premium'
  | 'commissions'
  | 'transactions'
  | 'contracts'
  | 'documents';

type AdminNavigationProps = {
  activeTab: AdminTab;
  labels: Record<AdminTab, string>;
  closeLabel: string;
  onChange: (tab: AdminTab) => void;
  theme: AdminTheme;
  styles: ReturnType<typeof createAdminStyles>;
};

const primaryTabs: { id: AdminTab; icon: string }[] = [
  { id: 'dashboard', icon: 'stats-chart' },
  { id: 'properties', icon: 'list' },
  { id: 'clients', icon: 'people' },
  { id: 'messages', icon: 'chatbubbles' },
  { id: 'transactions', icon: 'card' },
];

const additionalTabs: { id: AdminTab; icon: string }[] = [
  { id: 'contracts', icon: 'document-text' },
  { id: 'neighborhoods', icon: 'location' },
  { id: 'accounts', icon: 'person-circle' },
  { id: 'reports', icon: 'flag' },
  { id: 'reviews', icon: 'star' },
  { id: 'agents', icon: 'people-circle' },
  { id: 'premium', icon: 'diamond' },
  { id: 'commissions', icon: 'cash' },
  { id: 'documents', icon: 'folder' },
];

const AdminNavigation: React.FC<AdminNavigationProps> = ({
  activeTab,
  labels,
  closeLabel,
  onChange,
  theme,
  styles,
}) => {
  const [moreVisible, setMoreVisible] = useState(false);
  const activeAdditionalTab = additionalTabs.some(tab => tab.id === activeTab);

  const selectTab = (tab: AdminTab) => {
    setMoreVisible(false);
    onChange(tab);
  };

  const renderTab = (tab: { id: AdminTab; icon: string }, compact = false) => (
    <TouchableOpacity
      key={tab.id}
      style={[
        styles.tab,
        activeTab === tab.id && styles.tabActive,
        compact && localStyles.moreTab,
      ]}
      onPress={() => selectTab(tab.id)}
      accessibilityRole="button"
      accessibilityState={{ selected: activeTab === tab.id }}
    >
      <Ionicons
        name={tab.icon as React.ComponentProps<typeof Ionicons>['name']}
        size={compact ? 18 : 13}
        color={activeTab === tab.id ? theme.headerText : theme.textMuted}
      />
      <Text
        numberOfLines={1}
        style={[
          styles.tabText,
          activeTab === tab.id && styles.tabTextActive,
          compact && localStyles.moreTabText,
        ]}
      >
        {labels[tab.id]}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      <View style={styles.navCard}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={styles.tabsContent}
        >
          {primaryTabs.map(tab => renderTab(tab))}
          <TouchableOpacity
            style={[styles.tab, activeAdditionalTab && styles.tabActive]}
            onPress={() => setMoreVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={labels.add}
            accessibilityState={{ selected: activeAdditionalTab }}
          >
            <Ionicons
              name="grid-outline"
              size={13}
              color={activeAdditionalTab ? theme.headerText : theme.textMuted}
            />
            <Text
              numberOfLines={1}
              style={[styles.tabText, activeAdditionalTab && styles.tabTextActive]}
            >
              {labels.add}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <Modal
        visible={moreVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreVisible(false)}
      >
        <Pressable
          style={[localStyles.backdrop, { backgroundColor: theme.scrimStrong }]}
          onPress={() => setMoreVisible(false)}
        >
          <Pressable
            style={[
              localStyles.menu,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={event => event.stopPropagation()}
          >
            <View style={localStyles.menuHeader}>
              <Text style={[localStyles.menuTitle, { color: theme.text }]}>
                {labels.add}
              </Text>
              <TouchableOpacity
                onPress={() => setMoreVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={localStyles.grid}>
              {additionalTabs.map(tab => renderTab(tab, true))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const localStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  menu: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    maxHeight: '75%',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moreTab: {
    width: '31%',
    minHeight: 72,
    justifyContent: 'center',
    flexDirection: 'column',
    padding: 8,
  },
  moreTabText: {
    maxWidth: '100%',
    textAlign: 'center',
  },
});

export default AdminNavigation;
