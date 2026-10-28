import Constants, { ExecutionEnvironment } from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

/**
 * Vérifie si les modules natifs nécessaires aux notifications
 * sont disponibles dans le build actuel.
 */
function hasPushNativeStack(): boolean {
  return (
    requireOptionalNativeModule('ExpoPushTokenManager') != null &&
    requireOptionalNativeModule('ExpoNotificationPermissionsModule') != null
  );
}

/**
 * Vérifie si le planificateur de notifications locales est disponible.
 */
function hasNotificationScheduler(): boolean {
  return requireOptionalNativeModule('ExpoNotificationScheduler') != null;
}

/**
 * Android's expo-notifications entry point loads its topic module eagerly.
 * Older Expo Go and development builds do not include that native module.
 */
async function loadNotifications() {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return null;
  }

  if (
    Platform.OS === 'android' &&
    requireOptionalNativeModule('ExpoTopicSubscriptionModule') == null
  ) {
    return null;
  }

  return import('expo-notifications');
}

/**
 * Récupère l'ID du projet EAS.
 */
function resolveProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;

  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Programme une notification locale de manière sécurisée.
 *
 * Si les notifications natives ne sont pas disponibles
 * (notamment sur Web ou dans certains builds), la fonction
 * ne fait simplement rien.
 */
export async function safeScheduleLocalNotification(
  title: string,
  body: string
): Promise<void> {
  if (!hasNotificationScheduler()) {
    return;
  }

  try {
    const notifications = await loadNotifications();
    if (!notifications) return;

    await notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
      },
      trigger: null,
    });
  } catch {
    /* module ou permission indisponible */
  }
}

/**
 * Demande l'autorisation puis récupère le token Expo Push.
 *
 * Le token est ensuite transmis à saveToken() pour être
 * enregistré dans Supabase ou ailleurs.
 */
export async function safeRegisterExpoPushToken(
  saveToken: (token: string) => Promise<void>
): Promise<void> {
  if (!hasPushNativeStack()) {
    return;
  }

  let token: string | undefined;
  try {
    const notifications = await loadNotifications();
    if (!notifications) return;

    const existing = await notifications.getPermissionsAsync();

    let status = existing.status;

    if (status !== 'granted') {
      const request = await notifications.requestPermissionsAsync();
      status = request.status;
    }

    if (status !== 'granted') {
      return;
    }

    const projectId = resolveProjectId();

    const tokenResponse = await notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : {}
    );

    token = tokenResponse.data;
  } catch {
    return;
  }
  if (token) await saveToken(token);
}