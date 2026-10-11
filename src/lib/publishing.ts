import type { User } from '../types';

export const TEMPORARY_AGENT_PUBLISHING_STARTS_AT = '2026-10-11T00:00:00.000Z';
export const TEMPORARY_APPLICANT_PUBLISHING_STARTS_AT = '2026-12-01T00:00:00.000Z';
export const TEMPORARY_AGENT_PUBLISHING_ENDS_AT = '2027-06-02T00:00:00.000Z';
export const TEMPORARY_APPLICANT_PUBLISHING_ENDS_AT = '2027-06-01T00:00:00.000Z';

type PublishingUser = Pick<User, 'role' | 'agentStatus' | 'accountStatus'>;

export const isDirectPublishingEnabled = (
  user: PublishingUser | null | undefined,
  now = new Date()
) => {
  if (!user || user.accountStatus !== 'active') {
    return false;
  }

  if (user.role === 'ADMIN') return true;

  const nowTime = now.getTime();
  if (
    nowTime < Date.parse(TEMPORARY_AGENT_PUBLISHING_STARTS_AT) ||
    nowTime >= Date.parse(TEMPORARY_AGENT_PUBLISHING_ENDS_AT)
  ) {
    return false;
  }

  if (user.role === 'AGENT') return true;

  return (
    user.role === 'USER' &&
    nowTime >= Date.parse(TEMPORARY_APPLICANT_PUBLISHING_STARTS_AT) &&
    nowTime < Date.parse(TEMPORARY_APPLICANT_PUBLISHING_ENDS_AT) &&
    (user.agentStatus === 'pending' || user.agentStatus === 'rejected')
  );
};
