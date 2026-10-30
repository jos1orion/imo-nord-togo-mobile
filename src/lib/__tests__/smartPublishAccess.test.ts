import { describe, expect, it } from '@jest/globals';
import { canActivateSmartPublish, type SmartPublishAccess } from '../smartPublishAccess';

const authenticatedInPublish: SmartPublishAccess = {
  inPublicationArea: true,
  verifiedAuthUserId: 'user-1',
  profileUserId: 'user-1',
  accountStatus: 'active',
  role: 'AGENT',
  agentApproved: true,
  directPublishingEnabled: false,
};

describe('canActivateSmartPublish', () => {
  it('activates for a verified, approved agent in the publication area', () => {
    expect(canActivateSmartPublish(authenticatedInPublish)).toBe(true);
  });

  it('activates for an agent currently covered by direct-publishing authorization', () => {
    expect(canActivateSmartPublish({
      ...authenticatedInPublish,
      agentApproved: false,
      directPublishingEnabled: true,
    })).toBe(true);
  });

  it('allows an active administrator in the publication area', () => {
    expect(canActivateSmartPublish({ ...authenticatedInPublish, role: 'ADMIN' })).toBe(true);
  });

  it.each([
    ['a visitor', { ...authenticatedInPublish, verifiedAuthUserId: null, profileUserId: null }],
    ['a route outside publication', { ...authenticatedInPublish, inPublicationArea: false }],
    ['an expired or mismatched session', { ...authenticatedInPublish, verifiedAuthUserId: 'user-2' }],
    ['a suspended account', { ...authenticatedInPublish, accountStatus: 'suspended' }],
    ['an account with pending status', { ...authenticatedInPublish, accountStatus: 'pending' }],
    ['a missing profile', { ...authenticatedInPublish, profileUserId: null, accountStatus: null }],
    ['a regular user', { ...authenticatedInPublish, role: 'USER', agentApproved: false }],
    ['a regular user with a temporary direct-publishing flag', {
      ...authenticatedInPublish,
      role: 'USER',
      agentApproved: false,
      directPublishingEnabled: true,
    }],
    ['an unapproved agent outside the direct-publishing period', {
      ...authenticatedInPublish,
      agentApproved: false,
      directPublishingEnabled: false,
    }],
    ['an accountant', { ...authenticatedInPublish, role: 'ACCOUNTANT' }],
  ] as [string, SmartPublishAccess][])('stays inactive for %s', (_scenario, access) => {
    expect(canActivateSmartPublish(access)).toBe(false);
  });
});
