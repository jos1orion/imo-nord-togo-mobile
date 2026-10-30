export type SmartPublishAccess = {
  inPublicationArea: boolean;
  verifiedAuthUserId: string | null;
  profileUserId: string | null;
  accountStatus: 'active' | 'pending' | 'suspended' | null;
  role: 'USER' | 'AGENT' | 'ADMIN' | 'ACCOUNTANT' | null;
  agentApproved: boolean;
  directPublishingEnabled: boolean;
};

export const canActivateSmartPublish = ({
  inPublicationArea,
  verifiedAuthUserId,
  profileUserId,
  accountStatus,
  role,
  agentApproved,
  directPublishingEnabled,
}: SmartPublishAccess): boolean => (
  inPublicationArea &&
  Boolean(verifiedAuthUserId) &&
  verifiedAuthUserId === profileUserId &&
  accountStatus === 'active' &&
  (
    role === 'ADMIN' ||
    (role === 'AGENT' && (agentApproved || directPublishingEnabled))
  )
);
