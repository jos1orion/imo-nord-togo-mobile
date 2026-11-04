import Constants from 'expo-constants';
import { Linking } from 'react-native';
import { logger } from '../lib/logger';

type Extra = {
  contactPhone?: string;
  contactEmail?: string;
  whatsappPhone?: string;
  websiteUrl?: string;
  officialWebsiteUrl?: string;
  netlifeUrl?: string | null;
  launchPeriodEndDate?: string;
  adminApiUrl?: string;
};

function getExtra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

/** Numéro au format E.164 sans +, fourni par la configuration de l’application. */
export function getContactPhoneDigits(): string {
  return String(getExtra().contactPhone ?? '').replace(/\D/g, '');
}

export function getContactPhoneUrl(): string | null {
  const digits = getContactPhoneDigits();
  return digits ? `tel:+${digits}` : null;
}

export function getContactPhoneDisplay(): string {
  const digits = getContactPhoneDigits();
  if (!digits) return '';
  if (digits.startsWith('228') && digits.length === 11) {
    return `+228 ${digits.slice(3).match(/.{1,2}/g)?.join(' ')}`;
  }
  return `+${digits}`;
}

export function getContactEmail(): string {
  return getExtra().contactEmail?.trim() ?? '';
}

export function getWhatsAppDigits(): string {
  const raw = getExtra().whatsappPhone ?? getExtra().contactPhone ?? '';
  return String(raw).replace(/\D/g, '');
}

export function getWhatsAppUrl(): string | null {
  const digits = getWhatsAppDigits();
  return digits ? `https://wa.me/${digits}` : null;
}

export function getOfficialWebsiteUrl(): string {
  const raw =
    process.env.EXPO_PUBLIC_WEBSITE_URL ??
    getExtra().officialWebsiteUrl ??
    getExtra().websiteUrl ??
    'https://imo-nord-togo-mobile.vercel.app';
  return String(raw).trim().replace(/\/+$/, '');
}

/**
 * URL du site partenaire Netlife.
 * Retourne null si non configuré ou si l'adresse n'est pas un lien HTTPS valide.
 * L'entrée reste masquée tant que l'URL n'a pas été fournie par l'administration.
 */
export function getNetlifeUrl(): string | null {
  const raw =
    process.env.EXPO_PUBLIC_NETLIFE_URL ??
    getExtra().netlifeUrl;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^https:\/\//i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Date officielle de fin de la période de lancement gratuit (12 mois).
 * 12 novembre 2027 inclus (fin de journée UTC).
 */
export const OFFICIAL_LAUNCH_FREE_PERIOD_END = '2027-11-12T23:59:59.999Z';

export function getLaunchPeriodEndDate(): string {
  return (
    process.env.EXPO_PUBLIC_LAUNCH_END_DATE ??
    getExtra().launchPeriodEndDate ??
    OFFICIAL_LAUNCH_FREE_PERIOD_END
  );
}

/**
 * Ouvre un lien externe de manière sécurisée (HTTPS obligatoire).
 */
export async function openSecureExternalUrl(url: string | null | undefined): Promise<boolean> {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!/^https:\/\//i.test(trimmed)) {
    logger.warn('Blocked insecure external URL:', trimmed);
    return false;
  }
  try {
    const supported = await Linking.canOpenURL(trimmed);
    if (supported) {
      await Linking.openURL(trimmed);
      return true;
    }
  } catch (error) {
    logger.warn('Failed to open external url:', error);
  }
  return false;
}
