import { describe, expect, it } from '@jest/globals';
import { getAgentReviewUpdates } from '../agentReview';

describe('getAgentReviewUpdates', () => {
  it('promotes approved applicants to agents and clears rejection reasons', () => {
    expect(getAgentReviewUpdates(true, 'old reason', 'default')).toEqual({
      role: 'AGENT',
      agent_status: 'approved',
      agent_rejection_reason: null,
    });
  });

  it('rejects applicants with a trimmed reason', () => {
    expect(getAgentReviewUpdates(false, '  Missing documents  ', 'default')).toEqual({
      role: 'USER',
      agent_status: 'rejected',
      agent_rejection_reason: 'Missing documents',
    });
  });

  it('provides a default reason when none is supplied', () => {
    expect(getAgentReviewUpdates(false, '  ', 'Please add details').agent_rejection_reason)
      .toBe('Please add details');
  });
});
