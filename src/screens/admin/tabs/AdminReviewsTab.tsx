import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Review } from '../../../types';
import type { AdminTranslationKey } from '../../../i18n/admin';
import { createAdminStyles, type AdminTheme } from '../../AdminScreen.styles';

type AdminReviewsTabProps = {
  reviews: Review[];
  shouldFilter: boolean;
  includesQuery: (value: string | null | undefined) => boolean;
  limit: number;
  onLoadMore: () => void;
  onVerify: (reviewId: string, verified: boolean) => void;
  formatDateTime: (value: string | number | Date) => string;
  translate: (key: AdminTranslationKey) => string;
  theme: AdminTheme;
  styles: ReturnType<typeof createAdminStyles>;
};

const AdminReviewsTab = ({
  reviews,
  shouldFilter,
  includesQuery,
  limit,
  onLoadMore,
  onVerify,
  formatDateTime,
  translate,
  theme,
  styles,
}: AdminReviewsTabProps) => {
  const filteredReviews = shouldFilter
    ? reviews.filter(review =>
        includesQuery(review.comment) ||
        includesQuery(review.propertyId) ||
        includesQuery(review.reviewerName)
      )
    : reviews;
  const visibleReviews = filteredReviews.slice(0, limit);
  const hasMoreReviews = filteredReviews.length > limit;

  return (
    <FlatList
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentContainer}
      data={visibleReviews}
      keyExtractor={review => review.id}
      ListHeaderComponent={
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>{translate('Avis')}</Text>
            <Text style={styles.sectionSubtitle}>{translate('Qualite, confiance et moderation.')}</Text>
          </View>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{filteredReviews.length}</Text>
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={styles.emptyText}>{translate('Aucun avis pour le moment.')}</Text>}
      ListFooterComponent={hasMoreReviews ? (
        <TouchableOpacity style={styles.loadMoreButton} onPress={onLoadMore}>
          <Text style={styles.loadMoreText}>{translate('Charger plus')}</Text>
        </TouchableOpacity>
      ) : null}
      renderItem={({ item: review }) => (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoTitle}>{translate('Note:')} {review.rating}/5</Text>
            <View style={[styles.badge, review.verified ? styles.badgeSuccess : styles.badgeWarning]}>
              <Text style={[styles.badgeText, review.verified ? styles.badgeTextSuccess : styles.badgeTextWarning]}>
                {review.verified ? translate('review_verified') : translate('review_needs_verification')}
              </Text>
            </View>
          </View>
          <Text style={styles.infoMeta}>{translate('Bien:')} {review.propertyId}</Text>
          {review.comment ? <Text style={styles.reportMessage}>{review.comment}</Text> : null}
          <Text style={styles.infoMeta}>{formatDateTime(review.createdAt)}</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={[styles.quickActionButton, styles.quickActionPrimary]}
              onPress={() => onVerify(review.id, !review.verified)}
            >
              <Ionicons name="shield-checkmark-outline" size={14} color={theme.accentText} />
              <Text style={[styles.quickActionText, styles.quickActionTextPrimary]}>
                {review.verified ? translate('Retirer') : translate('Verifier')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );
};

export default AdminReviewsTab;
