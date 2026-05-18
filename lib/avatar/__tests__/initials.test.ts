/**
 * Tests for getInitials utility.
 */
import { getInitials } from '../initials';

describe('getInitials', () => {
  it('returns empty string when both are empty strings', () => {
    expect(getInitials('', '')).toBe('');
  });

  it('returns empty string when both are null', () => {
    expect(getInitials(null, null)).toBe('');
  });

  it('returns empty string when both are undefined', () => {
    expect(getInitials(undefined, undefined)).toBe('');
  });

  it('returns empty string when both are null and undefined', () => {
    expect(getInitials(null, undefined)).toBe('');
  });

  it('returns 1 letter when only firstName is provided', () => {
    expect(getInitials('Facundo', null)).toBe('F');
  });

  it('returns 1 letter when only lastName is provided', () => {
    expect(getInitials(null, 'Martinez')).toBe('M');
  });

  it('returns 2 letters when both firstName and lastName are provided', () => {
    expect(getInitials('Facundo', 'Martinez')).toBe('FM');
  });

  it('uppercases lowercase inputs', () => {
    expect(getInitials('facundo', 'martinez')).toBe('FM');
  });

  it('trims whitespace before slicing', () => {
    expect(getInitials('  Facundo  ', '  Martinez  ')).toBe('FM');
  });

  it('handles accented characters correctly (Álvaro + Ñúñez)', () => {
    expect(getInitials('Álvaro', 'Ñúñez')).toBe('ÁÑ');
  });

  it('uppercases accented lowercase chars using es-AR locale', () => {
    expect(getInitials('álvaro', 'ñúñez')).toBe('ÁÑ');
  });

  it('handles surrogate-pair safety with José + García', () => {
    expect(getInitials('José', 'García')).toBe('JG');
  });

  it('returns empty string when firstName is empty string and lastName is null', () => {
    expect(getInitials('', null)).toBe('');
  });

  it('returns empty string when firstName is null and lastName is empty string', () => {
    expect(getInitials(null, '')).toBe('');
  });

  it('handles whitespace-only strings as empty', () => {
    expect(getInitials('   ', '   ')).toBe('');
  });
});
