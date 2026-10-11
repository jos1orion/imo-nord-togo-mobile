import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  InteractionManager,
} from 'react-native';
import { AppAlert as Alert } from '../components/ui/appAlertService';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import { RootStackParamList } from '../../App';
import COLORS from '../theme/colors';
import { typography } from '../theme/typography';
import { RADIUS, SPACING } from '../theme/spacing';
import { isPublicProperty } from '../utils/propertyVisibility';

type AgentProfileScreenRouteProp = RouteProp<RootStackParamList, 'AgentProfile'>;
type AgentProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AgentProfile'>;

const AgentProfileScreen = () => {
  const styles = useThemedStyles(baseStyles);
  const themeColors = useThemeColors();
  const { getAgentProfile, users, properties, currentUser, sendMessage, t, tType } = useApp();
  const route = useRoute<AgentProfileScreenRouteProp>();
  const navigation = useNavigation<AgentProfileScreenNavigationProp>();
  const { userId } = route.params;

  const agentProfile = getAgentProfile(userId);
  const user = users.find(u => u.id === userId);
  const agentProperties = properties.filter(p => p.clientId === userId && isPublicProperty(p));

  const handleContact = async () => {
    if (!currentUser) {
      Alert.alert(t('error'), t('loginRequired'));
      return;
    }

    if (currentUser.id === userId) {
      Alert.alert(t('info'), t('cannotMessageYourself'));
      return;
    }

    // Send initial message
    try {
      const { chatId } = await sendMessage(userId, t('helloAgent'));
      InteractionManager.runAfterInteractions(() => {
        navigation.navigate('Chat', { chatId, otherUserId: userId });
      });
    } catch (error) {
      Alert.alert(t('error'), error instanceof Error ? error.message : t('error'));
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={20}
          color={themeColors.gold}
        />
      );
    }
    return stars;
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{t('userNotFound')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={themeColors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('agentProfile')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Ionicons name="person-circle" size={80} color={themeColors.primary} />
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user.name}</Text>
            {agentProfile?.company && (
              <Text style={styles.company}>{agentProfile.company}</Text>
            )}
            <View style={styles.rating}>
              {renderStars(agentProfile?.rating || 0)}
              <Text style={styles.ratingText}>
                ({agentProfile?.reviewCount || 0} {t('reviews')})
              </Text>
            </View>
          </View>
        </View>

        {agentProfile?.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('about')}</Text>
            <Text style={styles.bio}>{agentProfile.bio}</Text>
          </View>
        )}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{agentProperties.length}</Text>
            <Text style={styles.statLabel}>{t('properties')}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{agentProfile?.experience || 0}</Text>
            <Text style={styles.statLabel}>{t('yearsExp')}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{agentProfile?.totalSales || 0}</Text>
            <Text style={styles.statLabel}>{t('sales')}</Text>
          </View>
        </View>

        {agentProfile?.specialties && agentProfile.specialties.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('specialties')}</Text>
            <View style={styles.specialties}>
              {agentProfile.specialties.map((specialty, index) => (
                <View key={index} style={styles.specialtyTag}>
                  <Text style={styles.specialtyText}>{tType(specialty)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.contactSection}>
          <TouchableOpacity style={styles.contactButton} onPress={handleContact}>
            <Ionicons name="chatbubble" size={20} color="white" />
            <Text style={styles.contactButtonText}>{t('contactAgent')}</Text>
          </TouchableOpacity>

          {user.phone && (
            <TouchableOpacity
              style={styles.phoneButton}
              onPress={() => {
                // In a real app, this would open the phone dialer
                Alert.alert(t('call'), `${t('call')} ${user.phone}?`);
              }}
            >
              <Ionicons name="call" size={20} color={themeColors.primary} />
              <Text style={styles.phoneButtonText}>{user.phone}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {agentProperties.length > 0 && (
        <View style={styles.propertiesSection}>
          <Text style={styles.sectionTitle}>{t('agentProperties')}</Text>
          {agentProperties.slice(0, 5).map((property) => (
            <TouchableOpacity
              key={property.id}
              style={styles.propertyItem}
              onPress={() => navigation.navigate('PropertyDetail', { propertyId: property.id })}
            >
              <Text style={styles.propertyTitle} numberOfLines={1}>
                {property.title}
              </Text>
              <Text style={styles.propertyPrice}>
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'XOF',
                  minimumFractionDigits: 0,
                }).format(property.price)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderStrong,
  },
  title: {
    ...typography.heroTitle,
    color: COLORS.primary,
  },
  profileCard: {
    backgroundColor: 'white',
    margin: 10,
    borderRadius: 10,
    padding: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 15,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.onSurface,
  },
  company: {
    fontSize: 16,
    color: COLORS.onSurfaceMuted,
    marginTop: 2,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  ratingText: {
    marginLeft: 5,
    fontSize: 14,
    color: COLORS.onSurfaceMuted,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    ...typography.title,
    color: COLORS.onSurface,
    marginBottom: 10,
  },
  bio: {
    fontSize: 16,
    color: COLORS.onSurfaceMuted,
    lineHeight: 24,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.onSurfaceMuted,
    marginTop: 2,
  },
  specialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specialtyTag: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  specialtyText: {
    fontSize: 14,
    color: COLORS.onSurface,
  },
  contactSection: {
    marginTop: 20,
  },
  contactButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: 10,
  },
  contactButtonText: {
    ...typography.button,
    color: 'white',
    marginLeft: 10,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  phoneButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  propertiesSection: {
    backgroundColor: 'white',
    margin: 10,
    borderRadius: 10,
    padding: 20,
  },
  propertyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceAlt,
  },
  propertyTitle: {
    fontSize: 16,
    color: COLORS.onSurface,
    flex: 1,
  },
  propertyPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  error: {
    fontSize: 16,
    color: COLORS.danger,
    textAlign: 'center',
    marginTop: 50,
  },
});

export default AgentProfileScreen;
