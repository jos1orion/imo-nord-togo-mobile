import { requireOptionalNativeModule } from 'expo-modules-core';

function hapticsNativePresent(): boolean {
  return requireOptionalNativeModule('ExpoHaptics') != null;
}

/** Pas de crash si le dev client / build n’inclut pas le module natif (rebuild requis pour activer les haptiques). */
export async function safeImpactLight(): Promise<void> {
  if (!hapticsNativePresent()) return;
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* ignore */
  }
}

export async function safeNotificationSuccess(): Promise<void> {
  if (!hapticsNativePresent()) return;
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    /* ignore */
  }
}

export async function safeSelection(): Promise<void> {
  if (!hapticsNativePresent()) return;
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.selectionAsync();
  } catch {
    /* ignore */
  }
}
