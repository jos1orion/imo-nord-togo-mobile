import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  LogBox,
  Modal,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import {
  createNavigationContainerRef,
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  NavigationContainer,
  NavigatorScreenParams,
} from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider, useTheme } from 'react-native-paper';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppProvider, useApp } from './src/context/AppContext';
import HomeScreen from './src/screens/HomeScreen';
import ListingsScreen from './src/screens/ListingsScreen';
import PropertyDetailScreen from './src/screens/PropertyDetailScreen';
import AdminScreen from './src/screens/AdminScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PublishScreen from './src/screens/PublishScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ChatScreen from './src/screens/ChatScreen';
import MortgageCalculatorScreen from './src/screens/MortgageCalculatorScreen';
import AgentProfileScreen from './src/screens/AgentProfileScreen';
import ReviewsScreen from './src/screens/ReviewsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { lightPaperTheme, darkPaperTheme } from './src/theme/paperTheme';
import COLORS from './src/theme/colors';
import { typography } from './src/theme/typography';
import { supabase } from './src/lib/supabase';

const ONBOARDING_KEY = 'imo:onboardingComplete';
const FIRST_VISIT_GUIDE_PREFIX = 'imo:firstVisitGuide:';
const FIRST_VISIT_GUIDE_DISABLED_KEY = 'imo:firstVisitGuideDisabled';

const FIRST_VISIT_GUIDES = {
  Home: { title: 'guide_home_title', body: 'guide_home_body' },
  Publish: { title: 'guide_publish_title', body: 'guide_publish_body' },
  Messages: { title: 'guide_messages_title', body: 'guide_messages_body' },
  Profile: { title: 'guide_profile_title', body: 'guide_profile_body' },
} as const;

type GuideSection = keyof typeof FIRST_VISIT_GUIDES;

type TabParamList = {
  Home: undefined;
  Publish: undefined;
  Messages: undefined;
  Profile: { authMode?: 'login' | 'register' } | undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<TabParamList>;
  PropertyDetail: { propertyId: string };
  Admin: undefined;
  Publish: { propertyId?: string } | undefined;
  Messages: undefined;
  Chat: { chatId: string; otherUserId: string };
  AgentProfile: { userId: string };
  MortgageCalculator: undefined;
  Reviews: { propertyId: string };
  Notifications: undefined;
  ResetPassword: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

LogBox.ignoreLogs([
  'new NativeEventEmitter() was called with a non-null argument without the required `removeListeners` method.',
  '[Reanimated] Reduced motion setting is enabled on this device.',
]);

const TabNavigator = () => {
  const { t, language } = useApp();
  const paper = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      key={language}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'headset' : 'headset-outline';
          } else if (route.name === 'Publish') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return (
            <View
              style={{
                height: 34,
                minWidth: 54,
                paddingHorizontal: 14,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? paper.colors.primaryContainer : 'transparent',
              }}
            >
              <Ionicons
                name={iconName}
                size={focused ? 22 : 21}
                color={focused ? paper.colors.primary : color}
              />
            </View>
          );
        },
        tabBarActiveTintColor: paper.colors.primary,
        tabBarInactiveTintColor: paper.colors.onSurfaceVariant,
        tabBarButton: (props: any) => {
          const { style, ...rest } = props;
          return (
            <Pressable
              {...rest}
              hitSlop={12}
              android_ripple={{ color: paper.colors.surfaceVariant, borderless: true }}
              style={state => [
                typeof style === 'function' ? style(state) : style,
                {
                  flex: 1,
                  paddingVertical: 8,
                  opacity: Platform.OS === 'ios' && state.pressed ? 0.65 : 1,
                },
              ]}
            />
          );
        },
        tabBarStyle: {
          backgroundColor: paper.colors.surface,
          borderTopWidth: 1,
          borderTopColor: paper.colors.outlineVariant,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
          height: 62 + Math.max(insets.bottom, 10),
        },
        tabBarLabelStyle: {
          ...typography.tabLabel,
          marginTop: 2,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('tab_home') }} />
      <Tab.Screen
        name="Publish"
        component={ListingsScreen}
        options={{ tabBarLabel: t('publish_tab') }}
      />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: t('support_title') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t('tab_profile') }} />
    </Tab.Navigator>
  );
};

const AppContent = () => {
  const { theme, t } = useApp();
  const paperTheme = theme === 'light' ? lightPaperTheme : darkPaperTheme;
  const [navReady, setNavReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [guideSection, setGuideSection] = useState<GuideSection | null>(null);
  const activeRouteRef = React.useRef<string | undefined>(undefined);
  const checkedGuideSectionsRef = React.useRef(new Set<GuideSection>());
  const guideDisabledRef = React.useRef(false);

  const checkFirstVisitGuide = React.useCallback((routeName?: string) => {
    activeRouteRef.current = routeName;
    if (!routeName || !(routeName in FIRST_VISIT_GUIDES)) return;
    const section = routeName as GuideSection;
    if (guideDisabledRef.current || checkedGuideSectionsRef.current.has(section)) return;
    checkedGuideSectionsRef.current.add(section);

    void (async () => {
      try {
        const [disabled, seen] = await Promise.all([
          AsyncStorage.getItem(FIRST_VISIT_GUIDE_DISABLED_KEY),
          AsyncStorage.getItem(`${FIRST_VISIT_GUIDE_PREFIX}${section}`),
        ]);
        if (disabled === 'true') {
          guideDisabledRef.current = true;
          return;
        }
        if (
          seen !== 'true' &&
          activeRouteRef.current === section &&
          !guideDisabledRef.current
        ) {
          setGuideSection(section);
        }
      } catch (error) {
        console.warn('Unable to load first-visit guide state.', error);
        if (activeRouteRef.current === section && !guideDisabledRef.current) {
          setGuideSection(section);
        }
      }
    })();
  }, []);

  const dismissGuide = React.useCallback((disableAll = false) => {
    const section = guideSection;
    setGuideSection(null);
    if (disableAll) guideDisabledRef.current = true;
    if (!section) return;

    void (async () => {
      try {
        await AsyncStorage.setItem(`${FIRST_VISIT_GUIDE_PREFIX}${section}`, 'true');
        if (disableAll) {
          await AsyncStorage.setItem(FIRST_VISIT_GUIDE_DISABLED_KEY, 'true');
        }
      } catch (error) {
        console.warn('Unable to save first-visit guide state.', error);
      }
    })();
  }, [guideSection]);

  useEffect(() => {
    const handleAuthUrl = async (url: string | null) => {
      if (!url || !url.includes('reset-password')) return;
      const fragment = url.split('#')[1] ?? '';
      const query = url.split('?')[1]?.split('#')[0] ?? '';
      const params = new URLSearchParams(`${fragment}&${query}`);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) {
        Alert.alert(t('reset_link_invalid_title'), t('reset_link_invalid_message'));
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        Alert.alert(t('reset_link_invalid_title'), t('reset_link_expired_message'));
        return;
      }
      navigationRef.current?.navigate('ResetPassword');
    };

    void Linking.getInitialURL().then(handleAuthUrl);
    const subscription = Linking.addEventListener('url', event => {
      void handleAuthUrl(event.url);
    });
    return () => subscription.remove();
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!cancelled) {
          setShowOnboarding(v !== 'true');
          setNavReady(true);
        }
      } catch {
        if (!cancelled) {
          setShowOnboarding(true);
          setNavReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!navReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer
        ref={navigationRef}
        theme={theme === 'dark' ? NavigationDarkTheme : NavigationLightTheme}
        onReady={() => checkFirstVisitGuide(navigationRef.getCurrentRoute()?.name)}
        onStateChange={() => checkFirstVisitGuide(navigationRef.getCurrentRoute()?.name)}
      >
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <Stack.Navigator
          initialRouteName={showOnboarding ? 'Onboarding' : 'MainTabs'}
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            cardStyleInterpolator:
              Platform.OS === 'ios'
                ? CardStyleInterpolators.forHorizontalIOS
                : CardStyleInterpolators.forFadeFromBottomAndroid,
          }}
        >
          <Stack.Screen name="Onboarding">
            {({ navigation }) => (
              <OnboardingScreen
                onComplete={async () => {
                  try {
                    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
                  } catch {
                    /* ignore */
                  }
                  navigation.replace('MainTabs');
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="PropertyDetail" component={PropertyDetailScreen} options={{ presentation: 'card' }} />
          <Stack.Screen name="Admin" component={AdminScreen} options={{ presentation: 'card' }} />
          <Stack.Screen name="Publish" component={PublishScreen} options={{ presentation: 'card' }} />
          <Stack.Screen name="Messages" component={MessagesScreen} options={{ presentation: 'card' }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ presentation: 'card' }} />
          <Stack.Screen name="MortgageCalculator" component={MortgageCalculatorScreen} options={{ presentation: 'card' }} />
          <Stack.Screen name="AgentProfile" component={AgentProfileScreen} options={{ presentation: 'card' }} />
          <Stack.Screen name="Reviews" component={ReviewsScreen} options={{ presentation: 'card' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'card' }} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ presentation: 'card' }} />
        </Stack.Navigator>
      </NavigationContainer>
      {guideSection && (
        <Modal
          visible
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => dismissGuide()}
        >
          <Pressable
            onPress={() => dismissGuide()}
            style={{
              flex: 1,
              justifyContent: 'center',
              padding: 24,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
            }}
          >
            <Pressable
              onPress={event => event.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 420,
                alignSelf: 'center',
                padding: 24,
                borderRadius: 24,
                backgroundColor: paperTheme.colors.surface,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: paperTheme.colors.primaryContainer,
                  marginBottom: 18,
                }}
              >
                <Ionicons name="sparkles" size={24} color={paperTheme.colors.primary} />
              </View>
              <Text
                style={{
                  color: paperTheme.colors.onSurface,
                  fontSize: 21,
                  fontWeight: '700',
                  marginBottom: 10,
                }}
              >
                {t(FIRST_VISIT_GUIDES[guideSection].title)}
              </Text>
              <Text
                style={{
                  color: paperTheme.colors.onSurfaceVariant,
                  fontSize: 15,
                  lineHeight: 23,
                  marginBottom: 24,
                }}
              >
                {t(FIRST_VISIT_GUIDES[guideSection].body)}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => dismissGuide()}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 48,
                  borderRadius: 14,
                  backgroundColor: paperTheme.colors.primary,
                  marginBottom: 12,
                }}
              >
                <Text style={{ color: paperTheme.colors.onPrimary, fontSize: 15, fontWeight: '700' }}>
                  {t('guide_got_it')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => dismissGuide(true)}
                style={{ alignItems: 'center', padding: 8 }}
              >
                <Text style={{ color: paperTheme.colors.onSurfaceVariant, fontSize: 13 }}>
                  {t('guide_skip_all')}
                </Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </PaperProvider>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppProvider>
            <AppContent />
          </AppProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
