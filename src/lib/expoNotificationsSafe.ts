import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';

/** Évite d'importer expo-notifications tant que les modules natifs ne sont pas présents (sinon crash au chargement). */
function hasPushNativeStack(): boolean {
  return (
    requireOptionalNativeModule('ExpoPushTokenManager') != null &&
    requireOptionalNativeModule('ExpoNotificationPermissionsModule') != null
  );
}

function hasNotificationScheduler(): boolean {
  return requireOptionalNativeModule('ExpoNotificationScheduler') != null;
}

function resolveProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function safeScheduleLocalNotification(title: string, body: string): Promise<void> {
  if (!hasNotificationScheduler()) return;
  try {
    const { default: scheduleNotificationAsync } = await import(
      'expo-notifications/build/scheduleNotificationAsync'
    );
    await scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch {
    /* module ou permission indisponible */
  }
}

export async function safeRegisterExpoPushToken(saveToken: (token: string) => Promise<void>): Promise<void> {
  if (!hasPushNativeStack()) return;
  try {
    const { getPermissionsAsync, requestPermissionsAsync } = await import(
      'expo-notifications/build/NotificationPermissions'
    );
    const { default: getExpoPushTokenAsync } = await import(
      'expo-notifications/build/getExpoPushTokenAsync'
    );

    const existing = await getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const request = await requestPermissionsAsync();
      status = request.status;
    }
    if (status !== 'granted') return;

    const projectId = resolveProjectId();
    const token = (
      await getExpoPushTokenAsync(projectId ? { projectId } : {})
    ).data;
    await saveToken(token);
  } catch {
    /* pas de token / pas de réseau / build sans push */
  }
}
