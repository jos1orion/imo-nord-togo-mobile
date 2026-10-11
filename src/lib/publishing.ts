import type { User } from '../types';

export const TEMPORARY_AGENT_PUBLISHING_STARTS_AT = '2026-12-01T00:00:00.000Z';
export const TEMPORARY_AGENT_PUBLISHING_ENDS_AT = '2027-06-01T00:00:00.000Z';

type PublishingUser = Pick<User, 'role' | 'agentStatus' | 'accountStatus'>;

export const isDirectPublishingEnabled = (
  user: PublishingUser | null | undefined,
  now = new Date()
) => {
  if (
    !user ||
    user.accountStatus !== 'active' ||
    now.getTime() < Date.parse(TEMPORARY_AGENT_PUBLISHING_STARTS_AT) ||
    now.getTime() >= Date.parse(TEMPORARY_AGENT_PUBLISHING_ENDS_AT)
  ) {
    return false;
  }

  return (
    user.role === 'ADMIN' ||
    user.role === 'AGENT' ||
    (user.role === 'USER' &&
      (user.agentStatus === 'pending' || user.agentStatus === 'rejected'))
  );
};
