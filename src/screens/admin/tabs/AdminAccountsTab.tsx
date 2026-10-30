import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AdminTranslationKey } from '../../../i18n/admin';
import type { User } from '../../../types';
import type { AdminTheme, createAdminStyles } from '../../AdminScreen.styles';

type AdminAccountsTabProps = {
  accounts: User[];
  currentUserId: string;
  search: (value: string | number | null | undefined) => boolean;
  searching: boolean;
  limit: number;
  onLoadMore: () => void;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  accountUpdateId: string | null;
  onAccountStatus: (user: User) => void;
  onReviewAgent: (user: User, approved: boolean) => void;
  onVerify: (user: User, verified: boolean) => void;
  onEdit: (user: User) => void;
  translate: (key: AdminTranslationKey) => string;
  theme: AdminTheme;
  styles: ReturnType<typeof createAdminStyles>;
};

const AdminAccountsTab: React.FC<AdminAccountsTabProps> = ({
  accounts,
  currentUserId,
  search,
  searching,
  limit,
  onLoadMore,
  loading,
  error,
  refreshing,
  onRefresh,
  accountUpdateId,
  onAccountStatus,
  onReviewAgent,
  onVerify,
  onEdit,
  translate,
  theme,
  styles,
}) => {
  const filteredUsers = searching
    ? accounts.filter(user =>
        search(user.name) ||
        search(user.email) ||
        search(user.phone) ||
        search(user.id)
      )
    : accounts;
  const visibleUsers = filteredUsers.slice(0, limit);
  const hasMoreUsers = filteredUsers.length > limit;

  const listHeader = (
    <View>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>{translate("Comptes")}</Text>
          <Text style={styles.sectionSubtitle}>{translate("Verification et acces utilisateurs.")}</Text>
        </View>
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{filteredUsers.length}</Text>
        </View>
      </View>
      {loading && accounts.length === 0 ? (
        <View style={styles.accountsLoading}>
          <ActivityIndicator color={theme.accent} />
          <Text style={styles.accountMeta}>{translate("Chargement des comptes...")}</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.accountsError}>{error}</Text> : null}
    </View>
  );

  return (
    <FlatList
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} />
      }
      data={visibleUsers}
      keyExtractor={user => user.id}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        loading ? null : (
          <Text style={styles.emptyText}>
            {error
              ? translate("Impossible de charger les comptes.")
              : translate("Aucun compte pour le moment.")}
          </Text>
        )
      }
      ListFooterComponent={
        hasMoreUsers ? (
          <TouchableOpacity style={styles.loadMoreButton} onPress={onLoadMore}>
            <Text style={styles.loadMoreText}>{translate("Charger plus")}</Text>
          </TouchableOpacity>
        ) : null
      }
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      renderItem={({ item: user }) => (
        <View style={styles.accountItem}>
          <View style={styles.accountAvatar}>
            <Text style={styles.accountInitials}>{user.name.charAt(0)}</Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{user.name}</Text>
            <Text style={styles.accountMeta}>{user.email}</Text>
            <Text style={styles.accountMeta}>{user.phone}</Text>
            <Text style={styles.accountMeta}>
              {user.role ?? 'USER'} · {translate(user.accountStatus === 'suspended'
                ? "Compte suspendu"
                : user.accountStatus === 'pending' ? "Compte en attente" : "Compte actif")}
            </Text>
            {user.agentStatus === 'pending' ? (
              <Text style={styles.accountMeta}>{translate("Demande agent en attente")}</Text>
            ) : null}
          </View>
          <View style={styles.accountActions}>
            {user.id !== currentUserId ? (
              <TouchableOpacity
                style={[
                  styles.accountVerifyButton,
                  user.accountStatus === 'suspended'
                    ? styles.accountVerifyOn
                    : styles.accountVerifyOff,
                ]}
                disabled={accountUpdateId === user.id}
                onPress={() => onAccountStatus(user)}
              >
                <Text style={styles.accountVerifyText}>
                  {user.accountStatus === 'suspended'
                    ? translate("Reactiver")
                    : translate("Suspendre")}
                </Text>
              </TouchableOpacity>
            ) : null}
            {user.agentStatus === 'pending' ? (
              <>
                <TouchableOpacity
                  style={[styles.accountVerifyButton, styles.accountVerifyOn]}
                  onPress={() => onReviewAgent(user, true)}
                >
                  <Text style={styles.accountVerifyText}>{translate("Approuver")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.accountVerifyButton, styles.accountVerifyOff]}
                  onPress={() => onReviewAgent(user, false)}
                >
                  <Text style={[styles.accountVerifyText, { color: theme.textMuted }]}>
                    {translate("Refuser")}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity
              style={[
                styles.accountVerifyButton,
                user.verified ? styles.accountVerifyOff : styles.accountVerifyOn,
              ]}
              disabled={accountUpdateId === user.id}
              onPress={() => onVerify(user, !user.verified)}
            >
              <Text
                style={[
                  styles.accountVerifyText,
                  user.verified && { color: theme.textMuted },
                ]}
              >
                {user.verified ? translate("Retirer") : translate("Verifier")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.accountEditButton}
              onPress={() => onEdit(user)}
              accessibilityRole="button"
              accessibilityLabel={translate("Editer")}
            >
              <Ionicons name="create-outline" size={16} color={theme.accent} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );
};

export default AdminAccountsTab;
