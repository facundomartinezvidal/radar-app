import { formatMoney, parseAmount } from '../money';

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
