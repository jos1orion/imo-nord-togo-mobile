import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Notifications from 'expo-notifications';

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
    await Notifications.scheduleNotificationAsync({
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

  try {
    const existing = await Notifications.getPermissionsAsync();

    let status = existing.status;

    if (status !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      status = request.status;
    }

    if (status !== 'granted') {
      return;
    }

    const projectId = resolveProjectId();

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : {}
    );

    const token = tokenResponse.data;

    if (!token) {
      return;
    }

    await saveToken(token);
  } catch {
    /* pas de token / pas de réseau / build sans push */
  }
}