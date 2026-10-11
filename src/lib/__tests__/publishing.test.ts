import { describe, expect, it } from '@jest/globals';
import {
  isDirectPublishingEnabled,
  TEMPORARY_APPLICANT_PUBLISHING_ENDS_AT,
  TEMPORARY_APPLICANT_PUBLISHING_STARTS_AT,
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
  const applicantStartBoundary = new Date(TEMPORARY_APPLICANT_PUBLISHING_STARTS_AT);
  const lastAgentDay = new Date('2027-06-01T12:00:00.000Z');
  const agentEndBoundary = new Date(TEMPORARY_AGENT_PUBLISHING_ENDS_AT);
  const applicantEndBoundary = new Date(TEMPORARY_APPLICANT_PUBLISHING_ENDS_AT);

  it('allows agents direct publishing from October 11 through June 1', () => {
    expect(isDirectPublishingEnabled(makeUser('AGENT'), beforeWindow)).toBe(false);
    expect(isDirectPublishingEnabled(makeUser('AGENT'), startBoundary)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('AGENT'), insideWindow)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('AGENT'), lastAgentDay)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('AGENT'), agentEndBoundary)).toBe(false);
  });

  it('limits eligibility to active administrators, agents and qualifying applicants', () => {
    expect(isDirectPublishingEnabled(makeUser('ADMIN'), beforeWindow)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('ADMIN'), insideWindow)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('ADMIN'), agentEndBoundary)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('AGENT'), insideWindow)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('USER', 'pending'), insideWindow)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('USER', 'rejected'), insideWindow)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('USER', 'pending'), startBoundary)).toBe(false);
    expect(isDirectPublishingEnabled(makeUser('USER', 'pending'), applicantStartBoundary)).toBe(true);
    expect(isDirectPublishingEnabled(makeUser('USER', 'pending'), applicantEndBoundary)).toBe(false);
    expect(isDirectPublishingEnabled(makeUser('USER', 'approved'), insideWindow)).toBe(false);
    expect(isDirectPublishingEnabled(makeUser('USER', 'none'), insideWindow)).toBe(false);
    expect(isDirectPublishingEnabled(makeUser('AGENT', 'none', 'suspended'), insideWindow)).toBe(false);
    expect(isDirectPublishingEnabled(null, insideWindow)).toBe(false);
  });
});
