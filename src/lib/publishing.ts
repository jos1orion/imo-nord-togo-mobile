export const DIRECT_PUBLISHING_ENDS_AT = '2027-04-08T00:00:00.000Z';

export const isDirectPublishingEnabled = (now = new Date()) =>
  now.getTime() < Date.parse(DIRECT_PUBLISHING_ENDS_AT);
