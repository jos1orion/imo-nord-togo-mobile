import type { User } from '../types';

export type AgentReviewUpdates = {
  role: User['role'];
  agent_status: NonNullable<User['agentStatus']>;
  agent_rejection_reason: string | null;
};

export const getAgentReviewUpdates = (
  approved: boolean,
  reason: string | undefined,
  fallbackReason: string
): AgentReviewUpdates => approved
  ? { role: 'AGENT', agent_status: 'approved', agent_rejection_reason: null }
  : {
      role: 'USER',
      agent_status: 'rejected',
      agent_rejection_reason: reason?.trim() || fallbackReason,
    };
