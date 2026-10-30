import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import * as Sentry from '@sentry/react-native';

import App from './App';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  sendDefaultPii: false,
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Sentry.wrap(App));
