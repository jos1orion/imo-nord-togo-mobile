import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import AgentSupportChatScreen from './src/screens/AgentSupportChatScreen';
import AgentProfileScreen from './src/screens/AgentProfileScreen';
import AgentDashboardScreen from './src/screens/AgentDashboardScreen';
import ReviewsScreen from './src/screens/ReviewsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AppDialogProvider } from './src/components/ui/AppDialogProvider';
import { AppAlert as Alert } from './src/components/ui/appAlertService';
import { createPaperTheme } from './src/theme/paperTheme';
import { THEME_PALETTES } from './src/theme/colors';
import { typography } from './src/theme/typography';
import {
  exchangeAuthCallback,
  getAuthCallbackUrl,
  getResetPasswordCallbackUrl,
  matchesAuthCallbackUrl,
} from './src/lib/supabase';
import { logger } from './src/lib/logger';

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
  Agent: undefined;
  Profile: { authMode?: 'login' | 'register' } | undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<TabParamList>;
  PropertyDetail: { propertyId: string };
  Admin: undefined;
  Publish: { propertyId?: string } | undefined;
  Messages: undefined;
  Chat: { chatId: string; otherUserId: string; propertyId?: string };
  AgentSupportChat: undefined;
  AgentProfile: { userId: string };
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
  const { t, language, currentUser, theme } = useApp();
  const paper = useTheme();
  const insets = useSafeAreaInsets();
  const colors = THEME_PALETTES[theme];
  const hasAgentWorkspace = currentUser?.role === 'AGENT' || currentUser?.role === 'ADMIN';
  return (
    <Tab.Navigator
      key={`${language}-${hasAgentWorkspace ? 'agent' : 'standard'}`}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'headset' : 'headset-outline';
          } else if (route.name === 'Publish') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Agent') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
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
                  paddingVertical: 2,
                  opacity: Platform.OS === 'ios' && state.pressed ? 0.65 : 1,
                },
              ]}
            />
          );
        },
        tabBarStyle: {
          backgroundColor: paper.colors.surface,
          borderTopWidth: 1,
          borderTopColor: paper.colors.outline,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
          height: 72 + Math.max(insets.bottom, 10),
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: theme !== 'light' ? 0 : 0.06,
          shadowRadius: 10,
          elevation: 10,
        },
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          ...typography.tabLabel,
          marginTop: 3,
          fontWeight: '700',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('tab_home') }} />
      {!hasAgentWorkspace && (
        <Tab.Screen
          name="Publish"
          component={ListingsScreen}
          options={{ tabBarLabel: t('tab_activity') }}
        />
      )}
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarLabel: currentUser?.role === 'AGENT' ? t('support_title') : t('messages_inbox_title'),
        }}
      />
      {hasAgentWorkspace ? (
        <Tab.Screen name="Agent" component={AgentDashboardScreen} options={{ tabBarLabel: t('profile_agent_dashboard') }} />
      ) : null}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t('tab_profile') }} />
    </Tab.Navigator>
  );
};

const AppContent = () => {
  const { theme, t } = useApp();
  const colors = THEME_PALETTES[theme];
  const paperTheme = createPaperTheme(theme);
  const navigationTheme = theme === 'light' ? NavigationLightTheme : NavigationDarkTheme;
  const [navReady, setNavReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [guideSection, setGuideSection] = useState<GuideSection | null>(null);
  const activeRouteRef = React.useRef<string | undefined>(undefined);
  const checkedGuideSectionsRef = React.useRef(new Set<GuideSection>());
  const guideDisabledRef = React.useRef(false);
  const pendingResetNavigationRef = React.useRef(false);
  const pendingAuthNavigationRef = React.useRef(false);

  const navigateToPendingResetPassword = React.useCallback(() => {
    if (!pendingResetNavigationRef.current || !navigationRef.isReady()) return;
    pendingResetNavigationRef.current = false;
    navigationRef.navigate('ResetPassword');
  }, []);

  const navigateToPendingAuthProfile = React.useCallback(() => {
    if (!pendingAuthNavigationRef.current || !navigationRef.isReady()) return;
    pendingAuthNavigationRef.current = false;
    navigationRef.navigate('MainTabs', { screen: 'Profile' });
  }, []);

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
      if (!url) return;
      const isResetPassword = matchesAuthCallbackUrl(url, getResetPasswordCallbackUrl());
      const isAuthCallback = matchesAuthCallbackUrl(url, getAuthCallbackUrl());
      if (!isResetPassword && !isAuthCallback) return;
      try {
        const result = await exchangeAuthCallback(url);
        if (!result) {
          if (isResetPassword) {
            Alert.alert(t('reset_link_invalid_title'), t('reset_link_invalid_message'));
          } else {
            pendingAuthNavigationRef.current = true;
            navigateToPendingAuthProfile();
            Alert.alert(t('auth_callback_failed_title'), t('auth_callback_failed_message'));
          }
          return;
        }
        if (result.error) {
          if (isResetPassword) {
            Alert.alert(t('reset_link_invalid_title'), t('reset_link_expired_message'));
          } else {
            logger.error('Unable to complete the sign-in or registration callback.', result.error);
            pendingAuthNavigationRef.current = true;
            navigateToPendingAuthProfile();
            Alert.alert(t('auth_callback_failed_title'), t('auth_callback_failed_message'));
          }
          return;
        }
        if (isResetPassword) {
          pendingResetNavigationRef.current = true;
          navigateToPendingResetPassword();
        } else {
          pendingAuthNavigationRef.current = true;
          navigateToPendingAuthProfile();
        }
      } catch (error) {
        if (isResetPassword) {
          logger.error('Unable to complete the password reset callback.', error);
          Alert.alert(t('reset_link_invalid_title'), t('reset_link_expired_message'));
        } else {
          logger.error('Unable to complete the sign-in or registration callback.', error);
          pendingAuthNavigationRef.current = true;
          navigateToPendingAuthProfile();
          Alert.alert(t('auth_callback_failed_title'), t('auth_callback_failed_message'));
        }
      }
    };

    void Linking.getInitialURL()
      .then(handleAuthUrl)
      .catch(error => {
        logger.error('Unable to read the password reset callback URL.', error);
        Alert.alert(t('reset_link_invalid_title'), t('reset_link_invalid_message'));
      });
    const subscription = Linking.addEventListener('url', event => {
      void handleAuthUrl(event.url);
    });
    return () => subscription.remove();
  }, [navigateToPendingAuthProfile, navigateToPendingResetPassword, t]);

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer
        ref={navigationRef}
        linking={{
          prefixes: [
            'imonordtogo://',
            ...(Platform.OS === 'web' && typeof window !== 'undefined'
              ? [window.location.origin]
              : []),
          ],
          config: {
            screens: {
              MainTabs: {
                path: 'MainTabs',
                screens: {
                  Home: 'Home',
                  Publish: 'Publish',
                  Messages: 'Messages',
                  Agent: 'Agent',
                  Profile: 'Profile',
                },
              },
              PropertyDetail: 'property/:propertyId',
              ResetPassword: 'reset-password',
            },
          },
        }}
        theme={{
          ...navigationTheme,
          colors: {
            ...navigationTheme.colors,
            primary: colors.primary,
            background: colors.background,
            card: colors.surface,
            text: colors.onSurface,
            border: colors.border,
            notification: colors.danger,
          },
        }}
        onReady={() => {
          navigateToPendingResetPassword();
          navigateToPendingAuthProfile();
          checkFirstVisitGuide(navigationRef.getCurrentRoute()?.name);
        }}
        onStateChange={() => checkFirstVisitGuide(navigationRef.getCurrentRoute()?.name)}
      >
        <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
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
          <Stack.Screen name="AgentSupportChat" component={AgentSupportChatScreen} options={{ presentation: 'card' }} />
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
            <AppDialogProvider>
              <ThemeAwareErrorBoundary>
                <AppContent />
              </ThemeAwareErrorBoundary>
            </AppDialogProvider>
          </AppProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const ThemeAwareErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useApp();
  return <ErrorBoundary theme={theme}>{children}</ErrorBoundary>;
};
