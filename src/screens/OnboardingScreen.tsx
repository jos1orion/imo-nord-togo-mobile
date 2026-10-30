import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import { safeImpactLight, safeNotificationSuccess, safeSelection } from '../lib/expoHapticsSafe';
import PrimaryButton from '../components/ui/PrimaryButton';

type Props = {
  onComplete: () => void | Promise<void>;
};

const SLIDES: {
  title: string;
  body: string;
  imageUri: string;
  badge: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    title: 'Bienvenue dans un nouvel univers immobilier.',
    body: 'Découvrez une expérience immobilière plus simple, plus élégante et plus intuitive.',
    imageUri: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    badge: 'IMO PRESTIGE',
    icon: 'diamond-outline',
  },
  {
    title: 'Votre prochain chez-vous vous attend.',
    body: 'Explorez une sélection de maisons, appartements et terrains disponibles dans le nord du Togo.',
    imageUri: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    badge: 'EXPLORATION',
    icon: 'home-outline',
  },
  {
    title: 'La recherche devient plus simple.',
    body: 'Filtrez les annonces selon votre budget, votre localisation et vos préférences.',
    imageUri: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    badge: 'RECHERCHE INTELLIGENTE',
    icon: 'options-outline',
  },
  {
    title: 'Le bon logement, le bon contact.',
    body: 'Échangez directement avec les agents immobiliers et organisez vos visites facilement.',
    imageUri: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
    badge: 'CONTACT DIRECT',
    icon: 'chatbubbles-outline',
  },
];

const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
  const styles = useThemedStyles(baseStyles);
  const { t } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const slideHeight = Math.max(0, height - insets.top);
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / width);
    if (i !== page && i >= 0 && i < SLIDES.length) {
      setPage(i);
      void safeSelection();
    }
  };

  const goNext = () => {
    void safeImpactLight();
    if (page < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (page + 1), animated: true });
      setPage(page + 1);
    } else {
      void safeNotificationSuccess();
      void onComplete();
    }
  };

  const skip = () => {
    void safeSelection();
    void onComplete();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        style={styles.scrollView}
      >
        {SLIDES.map((slide, index) => (
          <View key={slide.title} style={[styles.slide, { width, height: slideHeight }]}>
            <ImageBackground
              source={{ uri: slide.imageUri }}
              style={styles.bgImage}
              resizeMode="cover"
            >
              {/* Luxury gradient overlay */}
              <View style={styles.gradientOverlay} />

              <View style={[styles.topBar, { paddingTop: insets.top > 0 ? 0 : 16 }]}>
                <View style={styles.badgeContainer}>
                  <Ionicons name="sparkles" size={13} color="#D4AF37" style={{ marginRight: 6 }} />
                  <Text style={styles.badgeText}>{slide.badge}</Text>
                </View>
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={skip}
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding_skip') || 'Passer'}
                >
                  <Text style={styles.skipText}>{t('onboarding_skip') || 'Passer'}</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.contentCard, { paddingBottom: insets.bottom + 100 }]}>
                <View style={styles.iconWrapper}>
                  <Ionicons name={slide.icon} size={28} color="#D4AF37" />
                </View>

                <Text style={styles.stepIndicator}>
                  0{index + 1} <Text style={styles.stepTotal}>/ 0{SLIDES.length}</Text>
                </Text>

                <Text style={styles.slideTitle}>{slide.title}</Text>

                <Text style={styles.slideBody}>{slide.body}</Text>
              </View>
            </ImageBackground>
          </View>
        ))}
      </ScrollView>

      {/* Footer controls floating above */}
      <View style={[styles.footerContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={String(i)}
              style={[
                styles.dot,
                i === page ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        <PrimaryButton
          title={page < SLIDES.length - 1 ? (t('onboarding_next') || 'Suivant') : (t('onboarding_start') || 'Commencer')}
          onPress={goNext}
          style={styles.ctaButton}
        />
      </View>
    </View>
  );
};

const baseStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  bgImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 10, 18, 0.72)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#F3E5AB',
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  contentCard: {
    paddingHorizontal: 28,
    zIndex: 10,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  stepIndicator: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#D4AF37',
    marginBottom: 10,
  },
  stepTotal: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '400',
  },
  slideTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    lineHeight: 38,
    marginBottom: 14,
  },
  slideBody: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '400',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: 'transparent',
    zIndex: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  dotActive: {
    width: 28,
    backgroundColor: '#D4AF37',
  },
  ctaButton: {
    width: '100%',
  },
});

export default OnboardingScreen;
