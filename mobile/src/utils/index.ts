export * from './rtl';
export * from './leasePricing';

// Format date to localized string
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

// Format date with time
export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

// Insert thousands separators into a number. Done manually because
// Number.prototype.toLocaleString() does not add grouping on React Native's
// Hermes engine (no full Intl), e.g. 1500 -> "1,500", 1234.5 -> "1,234.5".
export const addThousandsSeparators = (value: number): string => {
  const [intPart, decPart] = Math.abs(value).toString().split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = value < 0 ? '-' : '';
  return decPart ? `${sign}${grouped}.${decPart}` : `${sign}${grouped}`;
};

// Format an amount as ILS currency with thousands separators, e.g. 1500 -> ₪1,500
export const formatCurrency = (amount?: number | null): string =>
  amount == null ? '' : `₪${addThousandsSeparators(Number(amount))}`;

// Known currency symbols; unknown ISO codes fall back to "CODE " prefix.
const CURRENCY_SYMBOLS: Record<string, string> = {
  ILS: '₪',
  USD: '$',
  EUR: '€',
};

// Format an amount in a specific currency, e.g. (1500, 'USD') -> $1,500
export const formatMoney = (
  amount: number | null | undefined,
  currency = 'ILS',
): string => {
  if (amount == null) return '';
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = addThousandsSeparators(Number(amount));
  return symbol ? `${symbol}${formatted}` : `${currency} ${formatted}`;
};

// Format a numeric text input for display with thousands separators, keeping any
// decimal part the user is typing, e.g. "1500" -> "1,500", "1234.5" -> "1,234.5".
export const formatNumberInput = (value: string): string => {
  // Keep digits and at most one decimal point.
  const cleaned = value.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  const normalized =
    firstDot === -1
      ? cleaned
      : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  const [intPart, decPart] = normalized.split('.');
  const grouped = (intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (normalized.includes('.')) return `${grouped}.${decPart ?? ''}`;
  return grouped;
};

// Strip formatting from a numeric text input back to a raw number string,
// e.g. "1,500" -> "1500".
export const parseNumberInput = (value: string): string =>
  value.replace(/,/g, '');

// Truncate text with ellipsis
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

// Validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Capitalize first letter
export const capitalize = (text: string): string => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};
