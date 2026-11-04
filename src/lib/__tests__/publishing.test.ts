import { describe, expect, it } from '@jest/globals';
import {
  canAgentPublishFromApk,
  COMMERCIAL_PRICING,
  getInitialListingStatus,
  getLaunchCountdown,
  isDirectPublishingEnabled,
  isLaunchPeriodActive,
  LAUNCH_FREE_PERIOD_ENDS_AT,
  OFFICIAL_LAUNCH_DATE,
  TEMPORARY_AGENT_PUBLISHING_ENDS_AT,
  TEMPORARY_AGENT_PUBLISHING_STARTS_AT,
} from '../publishing';

const makeUser = (
  role: 'ADMIN' | 'AGENT' | 'USER',
  agentStatus: 'none' | 'pending' | 'approved' | 'rejected' = 'none',
  accountStatus: 'active' | 'suspended' = 'active'
) => ({ role, agentStatus, accountStatus });

describe('Politique commerciale et période de lancement gratuit (12 mois)', () => {
  // Dates simulées pour tester avant et après la transition du 12 novembre 2027
  const launchStart = new Date(OFFICIAL_LAUNCH_DATE);
  const midLaunchPeriod = new Date('2027-05-15T12:00:00.000Z');
  const lastFreeDay = new Date('2027-11-12T18:00:00.000Z');
  const exactEndBoundary = new Date(LAUNCH_FREE_PERIOD_ENDS_AT);
  const postLaunchDay1 = new Date('2027-11-13T00:00:01.000Z');
  const future2028 = new Date('2028-01-01T00:00:00.000Z');

  describe('isLaunchPeriodActive', () => {
    it('est actif pendant les 12 mois de lancement', () => {
      expect(isLaunchPeriodActive(launchStart)).toBe(true);
      expect(isLaunchPeriodActive(midLaunchPeriod)).toBe(true);
      expect(isLaunchPeriodActive(lastFreeDay)).toBe(true);
      expect(isLaunchPeriodActive(exactEndBoundary)).toBe(true);
    });

    it('expire automatiquement après le 12 novembre 2027 sans intervention manuelle', () => {
      expect(isLaunchPeriodActive(postLaunchDay1)).toBe(false);
      expect(isLaunchPeriodActive(future2028)).toBe(false);
    });
  });

  describe('canAgentPublishFromApk', () => {
    it('autorise la création d’annonces depuis l’APK pour tous les agents pendant les 12 mois', () => {
      const agent = makeUser('AGENT', 'approved');
      expect(canAgentPublishFromApk(agent, false, launchStart)).toBe(true);
      expect(canAgentPublishFromApk(agent, false, midLaunchPeriod)).toBe(true);
      expect(canAgentPublishFromApk(agent, false, lastFreeDay)).toBe(true);
    });

    it('interdit la création de nouvelles annonces depuis l’APK après le 12 novembre 2027', () => {
      const agent = makeUser('AGENT', 'approved');
      expect(canAgentPublishFromApk(agent, false, postLaunchDay1)).toBe(false);
      expect(canAgentPublishFromApk(agent, false, future2028)).toBe(false);
    });

    it('préserve la modification des annonces existantes dans l’APK même après les 12 mois', () => {
      const agent = makeUser('AGENT', 'approved');
      expect(canAgentPublishFromApk(agent, true, postLaunchDay1)).toBe(true);
      expect(canAgentPublishFromApk(agent, true, future2028)).toBe(true);
    });

    it('préserve les droits de création et modification pour les administrateurs en tout temps', () => {
      const admin = makeUser('ADMIN');
      expect(canAgentPublishFromApk(admin, false, postLaunchDay1)).toBe(true);
      expect(canAgentPublishFromApk(admin, true, future2028)).toBe(true);
    });

    it('refuse l’accès aux utilisateurs classiques non-agents et aux comptes suspendus', () => {
      const regularUser = makeUser('USER');
      const suspendedAgent = makeUser('AGENT', 'approved', 'suspended');
      expect(canAgentPublishFromApk(regularUser, false, midLaunchPeriod)).toBe(false);
      expect(canAgentPublishFromApk(suspendedAgent, false, midLaunchPeriod)).toBe(false);
      expect(canAgentPublishFromApk(null, false, midLaunchPeriod)).toBe(false);
    });
  });

  describe('getLaunchCountdown', () => {
    it('calcule correctement les jours restants avant le 12 novembre 2027', () => {
      const simulatedNow = new Date('2027-11-02T23:59:59.999Z'); // 10 jours avant
      const countdown = getLaunchCountdown(simulatedNow);
      expect(countdown.isExpired).toBe(false);
      expect(countdown.days).toBe(10);
      expect(countdown.formattedTargetDate).toBe('12 novembre 2027');
    });

    it('indique que la période est terminée après la date limite', () => {
      const countdown = getLaunchCountdown(postLaunchDay1);
      expect(countdown.isExpired).toBe(true);
      expect(countdown.days).toBe(0);
      expect(countdown.hours).toBe(0);
    });
  });

  describe('isDirectPublishingEnabled', () => {
    it('autorise la publication directe pour les agents jusqu’au 12 novembre 2027', () => {
      const agent = makeUser('AGENT');
      expect(isDirectPublishingEnabled(agent, midLaunchPeriod)).toBe(true);
      expect(isDirectPublishingEnabled(agent, lastFreeDay)).toBe(true);
      expect(isDirectPublishingEnabled(agent, postLaunchDay1)).toBe(false);
    });

    it('autorise les administrateurs en tout temps', () => {
      const admin = makeUser('ADMIN');
      expect(isDirectPublishingEnabled(admin, postLaunchDay1)).toBe(true);
    });
  });

  describe('Grille tarifaire commerciale (après les 12 mois)', () => {
    it('respecte les montants prévus de 500 et 1 000 FCFA avec Flooz et TMoney', () => {
      expect(COMMERCIAL_PRICING.STANDARD_TIER_FCFA).toBe(500);
      expect(COMMERCIAL_PRICING.PREMIUM_TIER_FCFA).toBe(1000);
      expect(COMMERCIAL_PRICING.CURRENCY).toBe('XOF');
      expect(COMMERCIAL_PRICING.PAYMENT_PROVIDERS).toContain('flooz');
      expect(COMMERCIAL_PRICING.PAYMENT_PROVIDERS).toContain('tmoney');
    });
  });

  describe('getInitialListingStatus', () => {
    it('attribue approved si la publication directe est autorisée', () => {
      expect(getInitialListingStatus(undefined, true)).toBe('approved');
      expect(getInitialListingStatus(undefined, false)).toBe('pending');
    });

    it('respecte un statut demandé explicitement', () => {
      expect(getInitialListingStatus('pending', true)).toBe('pending');
      expect(getInitialListingStatus('approved', false)).toBe('approved');
    });
  });
});
