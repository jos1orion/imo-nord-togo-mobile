import { describe, expect, it } from '@jest/globals';
import {
  isDirectPublishingEnabled,
  TEMPORARY_AGENT_PUBLISHING_ENDS_AT,
  TEMPORARY_AGENT_PUBLISHING_STARTS_AT,
} from '../publishing';

const makeUser = (
  role: 'ADMIN' | 'AGENT' | 'USER',
  agentStatus: 'none' | 'pending' | 'approved' | 'rejected' = 'none',
  accountStatus: 'active' | 'suspended' = 'active'
) => ({ role, agentStatus, accountStatus });

describe('isDirectPublishingEnabled', () => {
  const beforeWindow = new Date(Date.parse(TEMPORARY_AGENT_PUBLISHING_STARTS_AT) - 1);
  const startBoundary = new Date(TEMPORARY_AGENT_PUBLISHING_STARTS_AT);
  const insideWindow = new Date('2027-02-01T00:00:00.000Z');
  const endBoundary = new Date(TEMPORARY_AGENT_PUBLISHING_ENDS_AT);

  it('is enabled only during the configured date window', () => {
    expect(isDirectPublishingEnabled(makeUser('AGENT'), beforeWindow)).toBe(false);
    expect(isDirectPublishingEnabled(makeUser('AGENT'), startBoundary)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('AGENT'), insideWindow)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('AGENT'), endBoundary)).toBe(false);
  });

  it('limits eligibility to active administrators, agents and qualifying applicants', () => {
    expect(isDirectPublishingEnabled(makeUser('ADMIN'), insideWindow)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('AGENT'), insideWindow)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('USER', 'pending'), insideWindow)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('USER', 'rejected'), insideWindow)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('USER', 'approved'), insideWindow)).toBe(false);
    expect(isDirectPublishingEnabled(makeUser('USER', 'none'), insideWindow)).toBe(false);
    expect(isDirectPublishingEnabled(makeUser('AGENT', 'none', 'suspended'), insideWindow)).toBe(false);
    expect(isDirectPublishingEnabled(null, insideWindow)).toBe(false);
  });
});
