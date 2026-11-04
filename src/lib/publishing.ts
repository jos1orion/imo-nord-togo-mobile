import type { ListingStatus, User } from '../types';
import { getLaunchPeriodEndDate } from '../constants/appConfig';

/** Date officielle de début du lancement : 12 novembre 2026 */
export const OFFICIAL_LAUNCH_DATE = '2026-11-12T00:00:00.000Z';

/** Durée de gratuité commerciale accordée aux agents : 12 mois */
export const LAUNCH_FREE_PERIOD_MONTHS = 12;

/**
 * Date officielle de fin de la période de lancement gratuit : 12 novembre 2027.
 * À partir du 13 novembre 2027 00:00 UTC, la création de nouvelles annonces
 * est exclusivement réservée au site web officiel avec application des tarifs.
 */
export const LAUNCH_FREE_PERIOD_ENDS_AT = '2027-11-12T23:59:59.999Z';

/** Fenêtres temporelles pour compatibilité avec le système de migration existant */
export const TEMPORARY_AGENT_PUBLISHING_STARTS_AT = '2026-10-11T00:00:00.000Z';
export const TEMPORARY_APPLICANT_PUBLISHING_STARTS_AT = '2026-12-01T00:00:00.000Z';
export const TEMPORARY_AGENT_PUBLISHING_ENDS_AT = '2027-11-13T00:00:00.000Z';
export const TEMPORARY_APPLICANT_PUBLISHING_ENDS_AT = '2027-11-13T00:00:00.000Z';

/**
 * Grille tarifaire commerciale prévue après la période de gratuité (sur le site web).
 * 500 FCFA pour l'option standard, 1 000 FCFA pour la mise en avant / supérieure.
 */
export const COMMERCIAL_PRICING = {
  STANDARD_TIER_FCFA: 500,
  PREMIUM_TIER_FCFA: 1000,
  CURRENCY: 'XOF',
  PAYMENT_PROVIDERS: ['flooz', 'tmoney'] as const,
} as const;

export type PublishingUser = Pick<User, 'role' | 'agentStatus' | 'accountStatus'>;

/**
 * Indique si la période de lancement gratuit (12 mois) est active à la date fournie.
 */
export const isLaunchPeriodActive = (now = new Date()): boolean => {
  const endDateStr = getLaunchPeriodEndDate();
  const endTimestamp = Date.parse(endDateStr) || Date.parse(LAUNCH_FREE_PERIOD_ENDS_AT);
  return now.getTime() <= endTimestamp;
};

export type LaunchCountdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  formattedTargetDate: string;
};

/**
 * Calcule le compte à rebours précis jusqu'au 12 novembre 2027.
 */
export const getLaunchCountdown = (now = new Date()): LaunchCountdown => {
  const endDateStr = getLaunchPeriodEndDate();
  const endTimestamp = Date.parse(endDateStr) || Date.parse(LAUNCH_FREE_PERIOD_ENDS_AT);
  const diff = endTimestamp - now.getTime();

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isExpired: true,
      formattedTargetDate: '12 novembre 2027',
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    days,
    hours,
    minutes,
    seconds,
    isExpired: false,
    formattedTargetDate: '12 novembre 2027',
  };
};

/**
 * Vérifie si un agent a le droit de créer ou modifier une annonce depuis l'APK mobile.
 *
 * Règles :
 * 1. Pendant les 12 premiers mois (jusqu'au 12 novembre 2027) :
 *    - Tous les agents actifs peuvent créer et publier gratuitement depuis l'APK.
 * 2. Après le 12 novembre 2027 :
 *    - La création de nouvelles annonces est exclusivement réservée au site web officiel.
 *    - L'APK refuse la création de nouvelles annonces.
 *    - La modification et gestion des annonces existantes reste autorisée dans l'APK.
 * 3. Les administrateurs conservent leurs droits de création et modification en tout temps.
 */
export const canAgentPublishFromApk = (
  user: PublishingUser | null | undefined,
  isEditing = false,
  now = new Date()
): boolean => {
  if (!user || user.accountStatus !== 'active') {
    return false;
  }

  if (user.role === 'ADMIN') return true;
  if (user.role !== 'AGENT') return false;

  // La modification d'annonces existantes reste autorisée dans l'APK
  if (isEditing) return true;

  // La création de nouvelles annonces depuis l'APK n'est permise que pendant la période de lancement
  return isLaunchPeriodActive(now);
};

export const getInitialListingStatus = (
  requestedStatus: ListingStatus | null | undefined,
  canPublishDirectly: boolean
): ListingStatus => requestedStatus ?? (canPublishDirectly ? 'approved' : 'pending');

/**
 * Détermine si la publication directe sans modération préalable est accordée.
 */
export const isDirectPublishingEnabled = (
  user: PublishingUser | null | undefined,
  now = new Date()
): boolean => {
  if (!user || user.accountStatus !== 'active') {
    return false;
  }

  if (user.role === 'ADMIN') return true;

  const nowTime = now.getTime();
  const endDateStr = getLaunchPeriodEndDate();
  const endTimestamp = Date.parse(endDateStr) || Date.parse(LAUNCH_FREE_PERIOD_ENDS_AT);

  if (
    nowTime < Date.parse(TEMPORARY_AGENT_PUBLISHING_STARTS_AT) ||
    nowTime > endTimestamp
  ) {
    return false;
  }

  if (user.role === 'AGENT') return true;

  return (
    user.role === 'USER' &&
    nowTime >= Date.parse(TEMPORARY_APPLICANT_PUBLISHING_STARTS_AT) &&
    nowTime <= endTimestamp &&
    user.agentStatus === 'pending'
  );
};
