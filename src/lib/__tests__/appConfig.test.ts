import { describe, expect, it, jest } from '@jest/globals';
import {
  getContactEmail,
  getContactPhoneDigits,
  getContactPhoneUrl,
  getOfficialWebsiteUrl,
  getWhatsAppDigits,
  getWhatsAppUrl,
} from '../../constants/appConfig';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

describe('contact configuration', () => {
  it('does not silently substitute sample contact details when configuration is absent', () => {
    expect(getContactPhoneDigits()).toBe('');
    expect(getContactPhoneUrl()).toBeNull();
    expect(getContactEmail()).toBe('');
    expect(getWhatsAppDigits()).toBe('');
    expect(getWhatsAppUrl()).toBeNull();
  });

  it('uses the official Imo Prestige website when no URL override is configured', () => {
    expect(getOfficialWebsiteUrl()).toBe('https://imo-prestige.netlify.app');
  });
});
