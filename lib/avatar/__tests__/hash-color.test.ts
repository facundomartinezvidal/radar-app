/**
 * Tests for hashColor utility.
 */
import { AVATAR_PALETTE, hashColor } from '../hash-color';

describe('hashColor', () => {
  it('returns a value from AVATAR_PALETTE for a normal name', () => {
    const result = hashColor('Facundo Martinez');
    expect(AVATAR_PALETTE).toContain(result);
  });

  it('is deterministic — same input always yields the same color', () => {
    const a = hashColor('Facundo Martinez');
    const b = hashColor('Facundo Martinez');
    expect(a).toBe(b);
  });

  it('is deterministic across multiple calls with same input', () => {
    const name = 'Jonathan Mayán';
    const results = Array.from({ length: 5 }, () => hashColor(name));
    expect(new Set(results).size).toBe(1);
  });

  it('returns first palette color for empty string', () => {
    expect(hashColor('')).toBe(AVATAR_PALETTE[0]);
  });

  it('returns first palette color for null', () => {
    expect(hashColor(null)).toBe(AVATAR_PALETTE[0]);
  });

  it('returns first palette color for undefined', () => {
    expect(hashColor(undefined)).toBe(AVATAR_PALETTE[0]);
  });

  it('result is always contained in AVATAR_PALETTE', () => {
    const names = ['Ana López', 'Iñaki Moreno', 'María José García', 'Z', '123', 'áéíóú'];
    for (const name of names) {
      expect(AVATAR_PALETTE).toContain(hashColor(name));
    }
  });

  it('different inputs tend to produce different colors (collision check)', () => {
    // With 8 buckets and 8 distinct names, we expect some variety
    const distinctColors = new Set([
      hashColor('A'),
      hashColor('B'),
      hashColor('C'),
      hashColor('D'),
      hashColor('E'),
      hashColor('F'),
      hashColor('G'),
      hashColor('H'),
    ]);
    // At least 2 distinct colors from 8 inputs (very conservative)
    expect(distinctColors.size).toBeGreaterThan(1);
  });

  it('AVATAR_PALETTE has exactly 8 entries', () => {
    expect(AVATAR_PALETTE.length).toBe(8);
  });

  it('no palette color is purple or pink', () => {
    // Explicit forbidden list of purple/pink hues per Design System rules
    const forbidden = ['#800080', '#ff00ff', '#ff69b4', '#da70d6', '#ee82ee', '#c71585'];
    for (const color of AVATAR_PALETTE) {
      expect(forbidden).not.toContain(color.toLowerCase());
    }
  });
});
