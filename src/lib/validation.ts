/**
 * Validation utilities for client-side input validation.
 * These helpers provide immediate feedback to users before submission to the database.
 * Database-level constraints still provide the ultimate validation.
 */

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

export type MessageValidation = {
  content: string;
  maxChars?: number;
};

export type MessageValidationResult = ValidationResult & {
  trimmedContent?: string;
};

/**
 * Validates a message content string.
 * Database constraint: char_length(trim(content)) between 1 and 4000
 */
export function validateMessageContent(input: MessageValidation): MessageValidationResult {
  const maxChars = input.maxChars ?? 4000;
  const trimmedContent = input.content.trim();
  const length = trimmedContent.length;

  if (length === 0) {
    return { valid: false, error: 'Le message ne peut pas être vide.' };
  }

  if (length > maxChars) {
    return { valid: false, error: `Le message dépasse la limite de ${maxChars} caractères.` };
  }

  return { valid: true, trimmedContent };
}

/**
 * Validates a bulk message content string for admin support inbox.
 * Same constraints as regular message but with explicit maxChars for clarity.
 */
export function validateBulkMessageContent(input: MessageValidation): MessageValidationResult {
  // Bulk messages have the same 4000 char limit as regular messages
  return validateMessageContent({ ...input, maxChars: 4000 });
}

/**
 * Validates property title.
 * Maximum length: 255 characters (common database limit).
 */
export function validatePropertyTitle(title: string): ValidationResult {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Le titre est requis.' };
  }
  if (trimmed.length > 255) {
    return { valid: false, error: 'Le titre ne peut pas dépasser 255 caractères.' };
  }
  return { valid: true };
}

/**
 * Validates property price.
 * Must be a positive number.
 */
export function validatePropertyPrice(price: number | string): ValidationResult {
  const numPrice = typeof price === 'string' ? Number(price) : price;

  if (!Number.isFinite(numPrice)) {
    return { valid: false, error: 'Le prix doit être un nombre valide.' };
  }

  if (numPrice <= 0) {
    return { valid: false, error: 'Le prix doit être supérieur à 0.' };
  }

  return { valid: true };
}

/**
 * Validates property location/city fields.
 */
export function validateLocation(value: string, fieldName: string = 'Localisation'): ValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: `${fieldName} est requis.` };
  }
  if (trimmed.length > 255) {
    return { valid: false, error: `${fieldName} ne peut pas dépasser 255 caractères.` };
  }
  return { valid: true };
}

/**
 * Validates property description.
 * Maximum length: 2000 characters.
 */
export function validatePropertyDescription(description: string): ValidationResult {
  const trimmed = description.trim();
  if (trimmed.length > 2000) {
    return { valid: false, error: 'La description ne peut pas dépasser 2000 caractères.' };
  }
  return { valid: true };
}

/**
 * Validates user profile update data.
 */
export type ProfileUpdateValidation = {
  name?: string;
  phone?: string;
  photoUri?: string;
};

export function validateProfileUpdate(input: ProfileUpdateValidation): ValidationResult {
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Le nom ne peut pas être vide.' };
    }
    if (trimmed.length > 255) {
      return { valid: false, error: 'Le nom ne peut pas dépasser 255 caractères.' };
    }
  }

  if (input.phone !== undefined) {
    const trimmed = input.phone.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Le téléphone ne peut pas être vide.' };
    }
    // Basic phone validation - alphanumeric with spaces, dashes, parentheses
    const phoneRegex = /^[\d\s\+\-\(\)]+$/;
    if (!phoneRegex.test(trimmed)) {
      return { valid: false, error: 'Le numéro de téléphone contient des caractères invalides.' };
    }
  }

  return { valid: true };
}

/**
 * Validates email format.
 */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Adresse e-mail invalide.' };
  }

  return { valid: true };
}

/**
 * Validates a positive integer for integer counts (e.g., bedrooms).
 */
export function validatePositiveInteger(value: number | undefined, fieldName: string): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: true }; // Optional field
  }

  if (!Number.isInteger(value) || value <= 0) {
    return { valid: false, error: `${fieldName} doit être un entier positif.` };
  }

  return { valid: true };
}

/**
 * Validates area (m²) - must be positive number.
 */
export function validateArea(area: number | undefined): ValidationResult {
  if (area === undefined || area === null) {
    return { valid: true }; // Optional field
  }

  if (!Number.isFinite(area) || area <= 0) {
    return { valid: false, error: 'La surface doit être un nombre positif.' };
  }

  return { valid: true };
}