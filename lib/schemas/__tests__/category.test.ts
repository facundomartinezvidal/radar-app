/**
 * Unit tests for category Zod schemas.
 *
 * Covers:
 * - `createCategorySchema` — name, icon, color validation
 * - `updateCategorySchema` — partial (all fields optional)
 */
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/category-options';
import { createCategorySchema, updateCategorySchema } from '../category';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function firstIssue(result: { success: false; error: { issues: { message: string }[] } }): string {
  const issue = result.error.issues[0];
  if (!issue) throw new Error('Expected at least one validation issue');
  return issue.message;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_ICON = CATEGORY_ICONS[0]; // 'UtensilsCrossed'
const VALID_COLOR = CATEGORY_COLORS[0]; // '#0077B6'

const VALID_INPUT = {
  name: 'Mascotas',
  icon: VALID_ICON,
  color: VALID_COLOR,
};

// ---------------------------------------------------------------------------
// createCategorySchema — ACCEPT
// ---------------------------------------------------------------------------

describe('createCategorySchema — ACCEPT cases', () => {
  it('accepts a fully valid input', () => {
    const result = createCategorySchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it('accepts name with exactly 1 character', () => {
    const result = createCategorySchema.safeParse({ ...VALID_INPUT, name: 'A' });
    expect(result.success).toBe(true);
  });

  it('accepts name with exactly 40 characters', () => {
    const result = createCategorySchema.safeParse({ ...VALID_INPUT, name: 'a'.repeat(40) });
    expect(result.success).toBe(true);
  });

  it('accepts every curated icon in the set', () => {
    for (const icon of CATEGORY_ICONS) {
      const result = createCategorySchema.safeParse({ ...VALID_INPUT, icon });
      expect(result.success).toBe(true);
    }
  });

  it('accepts every curated color in the set', () => {
    for (const color of CATEGORY_COLORS) {
      const result = createCategorySchema.safeParse({ ...VALID_INPUT, color });
      expect(result.success).toBe(true);
    }
  });

  it('trims surrounding whitespace from name', () => {
    const result = createCategorySchema.safeParse({ ...VALID_INPUT, name: '  Comida  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Comida');
  });
});

// ---------------------------------------------------------------------------
// createCategorySchema — REJECT: name
// ---------------------------------------------------------------------------

describe('createCategorySchema — REJECT: name', () => {
  it('rejects empty name', () => {
    const result = createCategorySchema.safeParse({ ...VALID_INPUT, name: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Ingresá un nombre.');
  });

  it('rejects whitespace-only name', () => {
    const result = createCategorySchema.safeParse({ ...VALID_INPUT, name: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Ingresá un nombre.');
  });

  it('rejects name with 41 characters', () => {
    const result = createCategorySchema.safeParse({ ...VALID_INPUT, name: 'a'.repeat(41) });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Máximo 40 caracteres.');
  });
});

// ---------------------------------------------------------------------------
// createCategorySchema — REJECT: icon
// ---------------------------------------------------------------------------

describe('createCategorySchema — REJECT: icon', () => {
  it('rejects an icon not in the curated set', () => {
    const result = createCategorySchema.safeParse({ ...VALID_INPUT, icon: 'FakeIcon' });
    expect(result.success).toBe(false);
  });

  it('rejects missing icon', () => {
    const { icon: _icon, ...withoutIcon } = VALID_INPUT;
    const result = createCategorySchema.safeParse(withoutIcon);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createCategorySchema — REJECT: color
// ---------------------------------------------------------------------------

describe('createCategorySchema — REJECT: color', () => {
  it('rejects a color not in the curated set', () => {
    const result = createCategorySchema.safeParse({ ...VALID_INPUT, color: '#FFFFFF' });
    expect(result.success).toBe(false);
  });

  it('rejects missing color', () => {
    const { color: _color, ...withoutColor } = VALID_INPUT;
    const result = createCategorySchema.safeParse(withoutColor);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateCategorySchema — all fields optional
// ---------------------------------------------------------------------------

describe('updateCategorySchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    const result = updateCategorySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial input with only name', () => {
    const result = updateCategorySchema.safeParse({ name: 'Nueva' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Nueva');
      expect(result.data.icon).toBeUndefined();
      expect(result.data.color).toBeUndefined();
    }
  });

  it('accepts partial input with only color', () => {
    const result = updateCategorySchema.safeParse({ color: VALID_COLOR });
    expect(result.success).toBe(true);
  });

  it('still rejects an out-of-set icon when provided', () => {
    const result = updateCategorySchema.safeParse({ icon: 'NotAnIcon' });
    expect(result.success).toBe(false);
  });

  it('still rejects name longer than 40 chars when provided', () => {
    const result = updateCategorySchema.safeParse({ name: 'a'.repeat(41) });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Máximo 40 caracteres.');
  });
});
