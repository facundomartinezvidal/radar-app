import { formatMoney, formatMoneyCompact, parseAmount } from '../money';

describe('formatMoney', () => {
  it('formats ARS with es-AR punctuation', () => {
    expect(formatMoney(12500, 'ARS')).toBe('$ 12.500,00');
  });

  it('formats USD with US$ prefix', () => {
    expect(formatMoney(85, 'USD')).toBe('US$ 85,00');
  });

  it('formats zero', () => {
    expect(formatMoney(0, 'ARS')).toBe('$ 0,00');
  });

  it('formats negative amounts with leading minus', () => {
    expect(formatMoney(-200, 'ARS')).toBe('-$ 200,00');
  });

  it('shows + sign on positive when requested', () => {
    expect(formatMoney(50, 'USD', { showPlus: true })).toBe('+US$ 50,00');
  });

  it('hides currency when requested', () => {
    expect(formatMoney(1234.5, 'ARS', { hideCurrency: true })).toBe('1.234,50');
  });
});

describe('formatMoneyCompact', () => {
  // ARS — millions
  it('formats ARS 1_200_000 as $1,2M', () => {
    expect(formatMoneyCompact(1_200_000, 'ARS')).toBe('$1,2M');
  });

  it('formats ARS 2_000_000 as $2M (drops ,0 decimal)', () => {
    expect(formatMoneyCompact(2_000_000, 'ARS')).toBe('$2M');
  });

  it('formats ARS 1_800_000 as $1,8M', () => {
    expect(formatMoneyCompact(1_800_000, 'ARS')).toBe('$1,8M');
  });

  // ARS — thousands
  it('formats ARS 80_000 as $80k', () => {
    expect(formatMoneyCompact(80_000, 'ARS')).toBe('$80k');
  });

  it('formats ARS 1_000 as $1k', () => {
    expect(formatMoneyCompact(1_000, 'ARS')).toBe('$1k');
  });

  it('formats ARS 999 as $999 (rounds)', () => {
    expect(formatMoneyCompact(999, 'ARS')).toBe('$999');
  });

  // ARS — sub-thousand
  it('formats ARS 850 as $850', () => {
    expect(formatMoneyCompact(850, 'ARS')).toBe('$850');
  });

  it('formats ARS 0 as $0', () => {
    expect(formatMoneyCompact(0, 'ARS')).toBe('$0');
  });

  // USD prefix
  it('formats USD 1_800_000 as US$1,8M', () => {
    expect(formatMoneyCompact(1_800_000, 'USD')).toBe('US$1,8M');
  });

  it('formats USD 1_000 as US$1k', () => {
    expect(formatMoneyCompact(1_000, 'USD')).toBe('US$1k');
  });

  it('formats USD 500 as US$500', () => {
    expect(formatMoneyCompact(500, 'USD')).toBe('US$500');
  });

  // Negative amounts
  it('formats negative ARS 50_000 as -$50k', () => {
    expect(formatMoneyCompact(-50_000, 'ARS')).toBe('-$50k');
  });

  it('formats negative ARS 1_500_000 as -$1,5M', () => {
    expect(formatMoneyCompact(-1_500_000, 'ARS')).toBe('-$1,5M');
  });

  it('formats negative USD 200 as -US$200', () => {
    expect(formatMoneyCompact(-200, 'USD')).toBe('-US$200');
  });
});

describe('parseAmount', () => {
  it('parses Spanish-punctuation amounts', () => {
    expect(parseAmount('12.500,50')).toBe(12500.5);
    expect(parseAmount('1.234.567,89')).toBe(1234567.89);
  });

  it('parses comma-only decimals', () => {
    expect(parseAmount('100,5')).toBe(100.5);
  });

  it('parses plain numbers', () => {
    expect(parseAmount('5000')).toBe(5000);
    expect(parseAmount('5000.5')).toBe(5000.5);
  });

  it('returns NaN on empty', () => {
    expect(parseAmount('')).toBeNaN();
    expect(parseAmount('   ')).toBeNaN();
  });

  it('returns NaN on garbage', () => {
    expect(parseAmount('abc')).toBeNaN();
  });
});
