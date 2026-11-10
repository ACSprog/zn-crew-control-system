/**
 * Phone Number Validation & Formatting Utility
 * Enforces international E.164 formatting (+260XXXXXXXXX for Zambia)
 */

export interface PhoneValidationResult {
  isValid: boolean;
  formattedNumber?: string;
  countryCode?: string;
  carrier?: string;
  errorMessage?: string;
}

// Zambian mobile carrier prefixes
const ZAMBIA_PREFIXES: Record<string, string> = {
  '97': 'Airtel Zambia',
  '77': 'Airtel Zambia',
  '96': 'MTN Zambia',
  '76': 'MTN Zambia',
  '95': 'Zamtel',
  '75': 'Zamtel',
};

/**
 * Validates and formats an international phone number (E.164 format)
 * Default country code is +260 (Zambia) if entered with leading 0 or 9 digits.
 */
export function validateAndFormatPhoneNumber(input: string, defaultCountryCode = '260'): PhoneValidationResult {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      errorMessage: 'Phone number is required.',
    };
  }

  // Remove spaces, dashes, parentheses, dots
  let cleaned = input.trim().replace(/[\s\-\(\)\.]/g, '');

  if (cleaned.length === 0) {
    return {
      isValid: false,
      errorMessage: 'Phone number cannot be empty.',
    };
  }

  let fullNumberWithPlus = '';

  if (cleaned.startsWith('+')) {
    fullNumberWithPlus = cleaned;
  } else if (cleaned.startsWith('00')) {
    fullNumberWithPlus = '+' + cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    // Local format e.g. 0977123456 -> convert with default country code
    fullNumberWithPlus = '+' + defaultCountryCode + cleaned.substring(1);
  } else if (cleaned.startsWith(defaultCountryCode)) {
    fullNumberWithPlus = '+' + cleaned;
  } else {
    // Assume local 9 digits without leading 0
    if (cleaned.length === 9 && (cleaned.startsWith('9') || cleaned.startsWith('7'))) {
      fullNumberWithPlus = '+' + defaultCountryCode + cleaned;
    } else {
      fullNumberWithPlus = '+' + cleaned;
    }
  }

  // General E.164 regex: + followed by 7 to 15 digits
  const e164Regex = /^\+[1-9]\d{6,14}$/;

  if (!e164Regex.test(fullNumberWithPlus)) {
    return {
      isValid: false,
      errorMessage: 'Invalid phone number format. Must follow international format (e.g. +260971234567).',
    };
  }

  // Specific check for Zambia (+260)
  if (fullNumberWithPlus.startsWith('+260')) {
    const nationalPart = fullNumberWithPlus.substring(4);
    if (nationalPart.length !== 9) {
      return {
        isValid: false,
        errorMessage: `Zambian mobile numbers must be exactly 9 digits after +260 (got ${nationalPart.length} digits). Example: +260971234567`,
      };
    }

    const prefix = nationalPart.substring(0, 2);
    const carrier = ZAMBIA_PREFIXES[prefix] || 'Zambia Mobile Carrier';

    return {
      isValid: true,
      formattedNumber: fullNumberWithPlus,
      countryCode: '+260',
      carrier,
    };
  }

  // Other international numbers
  return {
    isValid: true,
    formattedNumber: fullNumberWithPlus,
    countryCode: fullNumberWithPlus.substring(0, 3),
    carrier: 'International Mobile',
  };
}

/**
 * Pretty prints an international phone number for UI displays
 * e.g. +260977123456 -> +260 97 712 3456
 */
export function formatDisplayPhoneNumber(phone?: string): string {
  if (!phone) return '—';
  const val = validateAndFormatPhoneNumber(phone);
  if (!val.isValid || !val.formattedNumber) return phone;

  const num = val.formattedNumber;
  if (num.startsWith('+260') && num.length === 13) {
    return `+260 ${num.substring(4, 6)} ${num.substring(6, 9)} ${num.substring(9)}`;
  }
  return num;
}
