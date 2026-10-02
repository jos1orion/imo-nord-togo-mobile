import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { createNavigationContainerRef, NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Alert, Linking, LogBox, Platform } from 'react-native';
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
  const { t, language, currentUser } = useApp();
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
        listeners={({ navigation }) => ({
          tabPress: event => {
            if (!currentUser) {
              event.preventDefault();
              Alert.alert(t('loginRequired'), t('login_required_publish_body'), [
                { text: t('cancel'), style: 'cancel' },
                {
                  text: t('profile_register'),
                  onPress: () => navigation.navigate('Profile', { authMode: 'register' }),
                },
              ]);
            }
          },
        })}
      />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: t('support_title') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t('tab_profile') }} />
    </Tab.Navigator>
  );
};

const AppContent = () => {
  const { theme } = useApp();
  const paperTheme = theme === 'light' ? lightPaperTheme : darkPaperTheme;
  const [navReady, setNavReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const handleAuthUrl = async (url: string | null) => {
      if (!url || !url.includes('reset-password')) return;
      const fragment = url.split('#')[1] ?? '';
      const query = url.split('?')[1]?.split('#')[0] ?? '';
      const params = new URLSearchParams(`${fragment}&${query}`);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) {
        Alert.alert('Lien invalide', 'Le lien de réinitialisation est incomplet ou expiré.');
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        Alert.alert('Lien invalide', 'Le lien de réinitialisation est expiré. Demandez un nouvel email.');
        return;
      }
      navigationRef.current?.navigate('ResetPassword');
    };

    void Linking.getInitialURL().then(handleAuthUrl);
    const subscription = Linking.addEventListener('url', event => {
      void handleAuthUrl(event.url);
    });
    return () => subscription.remove();
  }, []);

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
      <NavigationContainer ref={navigationRef}>
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
