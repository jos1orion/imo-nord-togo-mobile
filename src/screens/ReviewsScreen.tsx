import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../../App';
import COLORS from '../theme/colors';
import { canViewProperty } from '../utils/propertyVisibility';

type ReviewsScreenRouteProp = RouteProp<RootStackParamList, 'Reviews'>;
type ReviewsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Reviews'>;

const ReviewsScreen = () => {
  const { getPropertyReviews, addReview, getAverageRating, properties, currentUser, language, t } = useApp();
  const route = useRoute<ReviewsScreenRouteProp>();
  const navigation = useNavigation<ReviewsScreenNavigationProp>();
  const { propertyId } = route.params;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showAddReview, setShowAddReview] = useState(false);

  const property = properties.find(p => p.id === propertyId);
  const reviews = getPropertyReviews(propertyId);
  const averageRating = getAverageRating(propertyId);

  const handleSubmitReview = async () => {
    if (!currentUser) {
      Alert.alert(t('error'), t('loginRequired'));
      return;
    }

    if (rating === 0) {
      Alert.alert(t('error'), t('selectRating'));
      return;
    }

    if (!comment.trim()) {
      Alert.alert(t('error'), t('enterComment'));
      return;
    }

    try {
      await addReview(propertyId, rating, comment.trim());
      setRating(0);
      setComment('');
      setShowAddReview(false);
      Alert.alert(t('success'), t('reviewAdded'));
    } catch {
      Alert.alert(t('error'), t('review_save_error'));
    }
  };

  const renderStars = (currentRating: number, interactive = false, onRate?: (rating: number) => void) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={interactive ? () => onRate?.(i) : undefined}
          disabled={!interactive}
        >
          <Ionicons
            name={i <= currentRating ? 'star' : 'star-outline'}
            size={interactive ? 30 : 20}
            color="#FFD700"
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const renderReview = (review: typeof reviews[0]) => (
    <View key={review.id} style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewerName}>{review.reviewerName}</Text>
        <View style={styles.reviewRating}>
          {renderStars(review.rating)}
        </View>
      </View>
      <Text style={styles.reviewComment}>{review.comment}</Text>
      <Text style={styles.reviewDate}>
        {new Date(review.createdAt).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR')}
        {review.verified && (
          <Text style={styles.verified}> • {t('verified')}</Text>
        )}
      </Text>
    </View>
  );

  if (!property || !canViewProperty(property, currentUser?.id)) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{t('property_not_found')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('reviews')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.propertyInfo}>
        <Text style={styles.propertyTitle} numberOfLines={1}>
          {property.title}
        </Text>
        <View style={styles.ratingSummary}>
          <View style={styles.stars}>
            {renderStars(Math.round(averageRating))}
          </View>
          <Text style={styles.averageRating}>
            {averageRating.toFixed(1)} ({reviews.length} {t('reviews')})
          </Text>
        </View>
      </View>

      <View style={styles.addReviewSection}>
        {!showAddReview ? (
          <TouchableOpacity
            style={styles.addReviewButton}
            onPress={() => setShowAddReview(true)}
          >
            <Ionicons name="add-circle" size={20} color="white" />
            <Text style={styles.addReviewButtonText}>{t('addReview')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.addReviewForm}>
            <Text style={styles.formTitle}>{t('writeReview')}</Text>

            <View style={styles.ratingInput}>
              <Text style={styles.ratingLabel}>{t('yourRating')}</Text>
              <View style={styles.stars}>
                {renderStars(rating, true, setRating)}
              </View>
            </View>

            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder={t('writeComment')}
              multiline
              numberOfLines={4}
              maxLength={500}
            />

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddReview(false);
                  setRating(0);
                  setComment('');
                }}
              >
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, (!rating || !comment.trim()) && styles.submitButtonDisabled]}
                onPress={handleSubmitReview}
                disabled={!rating || !comment.trim()}
              >
                <Text style={styles.submitButtonText}>{t('submit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.reviewsList}>
        <Text style={styles.reviewsTitle}>
          {t('allReviews')} ({reviews.length})
        </Text>

        {reviews.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>{t('noReviews')}</Text>
          </View>
        ) : (
          reviews.map(renderReview)
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  propertyInfo: {
    backgroundColor: 'white',
    margin: 10,
    borderRadius: 10,
    padding: 20,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stars: {
    flexDirection: 'row',
    marginRight: 10,
  },
  averageRating: {
    fontSize: 16,
    color: '#666',
  },
  addReviewSection: {
    margin: 10,
  },
  addReviewButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
  },
  addReviewButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  addReviewForm: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  ratingInput: {
    marginBottom: 15,
  },
  ratingLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reviewsList: {
    backgroundColor: 'white',
    margin: 10,
    borderRadius: 10,
    padding: 20,
  },
  reviewsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  reviewItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 15,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  reviewRating: {
    flexDirection: 'row',
  },
  reviewComment: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 14,
    color: '#999',
  },
  verified: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
  error: {
    fontSize: 16,
    color: '#ff0000',
    textAlign: 'center',
    marginTop: 50,
  },
});

export default ReviewsScreen;
