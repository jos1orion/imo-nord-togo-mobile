import Constants from 'expo-constants';

type Extra = {
  contactPhone?: string;
  contactEmail?: string;
  whatsappPhone?: string;
};

function getExtra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

/** Numéro au format E.164 sans +, fourni par la configuration de l’application. */
export function getContactPhoneDigits(): string {
  return String(getExtra().contactPhone ?? '').replace(/\D/g, '');
}

export function getContactPhoneUrl(): string | null {
  const digits = getContactPhoneDigits();
  return digits ? `tel:+${digits}` : null;
}

export function getContactPhoneDisplay(): string {
  const digits = getContactPhoneDigits();
  if (!digits) return '';
  if (digits.startsWith('228') && digits.length === 11) {
    return `+228 ${digits.slice(3).match(/.{1,2}/g)?.join(' ')}`;
  }
  return `+${digits}`;
}

export function getContactEmail(): string {
  return getExtra().contactEmail?.trim() ?? '';
}

export function getWhatsAppDigits(): string {
  const raw = getExtra().whatsappPhone ?? getExtra().contactPhone ?? '';
  return String(raw).replace(/\D/g, '');
}

export function getWhatsAppUrl(): string | null {
  const digits = getWhatsAppDigits();
  return digits ? `https://wa.me/${digits}` : null;
}
