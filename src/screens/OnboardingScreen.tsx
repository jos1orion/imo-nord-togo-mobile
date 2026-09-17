import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { safeImpactLight, safeNotificationSuccess, safeSelection } from '../lib/expoHapticsSafe';
import type { TranslationKey } from '../i18n';
import COLORS from '../theme/colors';
import PrimaryButton from '../components/ui/PrimaryButton';

const { width } = Dimensions.get('window');

type Props = {
  onComplete: () => void | Promise<void>;
};

const SLIDES: { title: TranslationKey; body: TranslationKey }[] = [
  { title: 'onboarding_1_title', body: 'onboarding_1_body' },
  { title: 'onboarding_2_title', body: 'onboarding_2_body' },
  { title: 'onboarding_3_title', body: 'onboarding_3_body' },
];

const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
  const { t, theme } = useApp();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / width);
    if (i !== page && i >= 0 && i < SLIDES.length) setPage(i);
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
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom + 12 },
        isDark && styles.rootDark,
      ]}
    >
      <TouchableOpacity style={styles.skip} onPress={skip} accessibilityRole="button" accessibilityLabel={t('onboarding_skip')}>
        <Text style={styles.skipText}>{t('onboarding_skip')}</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {SLIDES.map((slide, index) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <Text style={[styles.step, isDark && styles.stepDark]}>{`${index + 1}/${SLIDES.length}`}</Text>
            <Text style={[styles.title, isDark && styles.titleDark]}>{t(slide.title)}</Text>
            <Text style={[styles.body, isDark && styles.bodyDark]}>{t(slide.body)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={String(i)} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>

      <PrimaryButton
        title={page < SLIDES.length - 1 ? t('onboarding_next') : t('onboarding_start')}
        onPress={goNext}
        style={styles.cta}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  rootDark: {
    backgroundColor: '#0F172A',
  },
  skip: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  skipText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  slide: {
    paddingHorizontal: 28,
    justifyContent: 'center',
    minHeight: 320,
  },
  step: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  stepDark: {
    color: '#94A3B8',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
  },
  titleDark: {
    color: '#F1F5F9',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textMuted,
  },
  bodyDark: {
    color: '#CBD5E1',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 22,
  },
  cta: {
    marginHorizontal: 24,
  },
});

export default OnboardingScreen;
