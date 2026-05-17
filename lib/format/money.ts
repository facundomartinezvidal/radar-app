/**
 * Money formatting helpers for ARS / USD.
 *
 * Locale-aware: ARS uses Argentine punctuation (`$ 12.500,00`), USD prefixes
 * `US$`. Both render the same digit grouping for visual rhythm. Uses
 * `Intl.NumberFormat` under the hood — RN supports it on iOS/Android via
 * Hermes ICU (full intl) when present, otherwise falls back to a manual
 * format to avoid a runtime crash on older engines.
 */

const FALLBACK_LOCALE = 'es-AR';

function safeIntlNumber(value: number, options: Intl.NumberFormatOptions): string | null {
  try {
    return new Intl.NumberFormat(FALLBACK_LOCALE, options).format(value);
  } catch {
    return null;
  }
}

function manualGroup(value: number): string {
  const fixed = value.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const grouped = (intPart ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped},${decPart ?? '00'}`;
}

export interface FormatMoneyOptions {
  /** Show + sign for positives. Defaults to false. */
  showPlus?: boolean;
  /** Render without the currency prefix. Defaults to false. */
  hideCurrency?: boolean;
}

/**
 * Format a money amount according to RADAR rules.
 *
 *   formatMoney(12500, 'ARS')        → "$ 12.500,00"
 *   formatMoney(85, 'USD')           → "US$ 85,00"
 *   formatMoney(0, 'ARS')            → "$ 0,00"
 *   formatMoney(-200, 'ARS', { showPlus: true }) → "-$ 200,00"
 */
export function formatMoney(
  amount: number,
  currency: 'ARS' | 'USD',
  options: FormatMoneyOptions = {},
): string {
  const sign = amount < 0 ? '-' : options.showPlus ? '+' : '';
  const abs = Math.abs(amount);
  const num =
    safeIntlNumber(abs, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }) ?? manualGroup(abs);
  if (options.hideCurrency) return `${sign}${num}`;
  const prefix = currency === 'USD' ? 'US$' : '$';
  return `${sign}${prefix} ${num}`;
}

/**
 * Parse a user-typed amount (Spanish punctuation) into a number.
 * Accepts "12.500,50" / "12500.50" / "12500,50" / "12500". Returns NaN on
 * malformed input.
 */
export function parseAmount(input: string): number {
  if (input.trim().length === 0) return NaN;
  // Normalise: drop thousands separator (.), swap decimal comma for dot.
  const cleaned = input
    .trim()
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}
