import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LogBox, Platform } from 'react-native';
import { Provider as PaperProvider, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppProvider, useApp } from './src/context/AppContext';
import HomeScreen from './src/screens/HomeScreen';
import PropertyDetailScreen from './src/screens/PropertyDetailScreen';
import AdminScreen from './src/screens/AdminScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PublishScreen from './src/screens/PublishScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ChatScreen from './src/screens/ChatScreen';
import MortgageCalculatorScreen from './src/screens/MortgageCalculatorScreen';
import AgentProfileScreen from './src/screens/AgentProfileScreen';
import ReviewsScreen from './src/screens/ReviewsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { lightPaperTheme, darkPaperTheme } from './src/theme/paperTheme';
import COLORS from './src/theme/colors';
import { typography } from './src/theme/typography';

const ONBOARDING_KEY = 'imo:onboardingComplete';

type TabParamList = {
  Home: undefined;
  Messages: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<TabParamList>;
  PropertyDetail: { propertyId: string };
  Admin: undefined;
  Publish: undefined;
  Messages: undefined;
  Chat: { chatId: string; otherUserId: string };
  AgentProfile: { userId: string };
  MortgageCalculator: undefined;
  Reviews: { propertyId: string };
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

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
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
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
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: t('messages') }} />
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
      <NavigationContainer>
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
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
