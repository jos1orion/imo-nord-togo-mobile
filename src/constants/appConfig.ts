import Constants from 'expo-constants';

type Extra = {
  contactPhone?: string;
  contactEmail?: string;
  whatsappPhone?: string;
};

function getExtra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

/** Numéro WhatsApp au format E.164 sans + (ex. 22890123456). Configurable via app.json → extra.whatsappPhone */
export function getContactPhoneDigits(): string {
  const raw = getExtra().contactPhone ?? '22893576298';
  const digits = String(raw).replace(/\D/g, '');
  return digits.length > 0 ? digits : '22893576298';
}

export function getContactPhoneUrl(): string {
  return `tel:+${getContactPhoneDigits()}`;
}

export function getContactPhoneDisplay(): string {
  const digits = getContactPhoneDigits();
  if (digits.startsWith('228') && digits.length === 11) {
    return `+228 ${digits.slice(3).match(/.{1,2}/g)?.join(' ')}`;
  }
  return `+${digits}`;
}

export function getContactEmail(): string {
  const email = getExtra().contactEmail?.trim();
  return email || 'kondgbandi@gmail.com';
}

export function getWhatsAppDigits(): string {
  const raw = getExtra().whatsappPhone ?? getContactPhoneDigits();
  const digits = String(raw).replace(/\D/g, '');
  return digits.length > 0 ? digits : getContactPhoneDigits();
}

export function getWhatsAppUrl(): string {
  return `https://wa.me/${getWhatsAppDigits()}`;
}
