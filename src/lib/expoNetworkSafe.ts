import type { NetworkState } from 'expo-network';
import { requireOptionalNativeModule } from 'expo-modules-core';

/** Évite d'importer `expo-network` au chargement si `ExpoNetwork` n'est pas dans le binaire (dev client incomplet). */
export async function safeGetNetworkStateAsync(): Promise<NetworkState | null> {
  if (requireOptionalNativeModule('ExpoNetwork') == null) {
    return null;
  }
  try {
    const Network = await import('expo-network');
    return await Network.getNetworkStateAsync();
  } catch {
    return null;
  }
}
