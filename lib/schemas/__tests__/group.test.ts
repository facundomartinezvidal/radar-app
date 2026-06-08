/**
 * Unit tests for group Zod schemas.
 *
 * Covers:
 * - `createGroupSchema` — name, icon, color, placeholders
 * - `inviteMemberSchema` — email validation
 * - `splitSchema` — type + entries structure
 * - `settlementSchema` — amounts, currency, from !== to refine
 */
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/category-options';
import {
  addPlaceholderSchema,
  createGroupSchema,
  inviteMemberSchema,
  settlementSchema,
  splitSchema,
} from '../group';

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

const VALID_ICON = CATEGORY_ICONS[0]!; // 'UtensilsCrossed'
const VALID_COLOR = CATEGORY_COLORS[0]!; // '#0077B6'

const VALID_GROUP = {
  name: 'Amigos del viaje',
  icon: VALID_ICON,
  color: VALID_COLOR,
};

// ---------------------------------------------------------------------------
// createGroupSchema — ACCEPT
// ---------------------------------------------------------------------------

describe('createGroupSchema — ACCEPT', () => {
  it('accepts a fully valid input without placeholders', () => {
    const result = createGroupSchema.safeParse(VALID_GROUP);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.placeholders).toEqual([]);
  });

  it('accepts a valid input with placeholders', () => {
    const result = createGroupSchema.safeParse({
      ...VALID_GROUP,
      placeholders: ['Juan', 'María'],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.placeholders).toEqual(['Juan', 'María']);
  });

  it('accepts name with exactly 1 character', () => {
    expect(createGroupSchema.safeParse({ ...VALID_GROUP, name: 'A' }).success).toBe(true);
  });

  it('accepts name with exactly 60 characters', () => {
    expect(createGroupSchema.safeParse({ ...VALID_GROUP, name: 'a'.repeat(60) }).success).toBe(
      true,
    );
  });

  it('trims surrounding whitespace from name', () => {
    const result = createGroupSchema.safeParse({ ...VALID_GROUP, name: '  Viaje  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Viaje');
  });

  it('accepts every curated icon', () => {
    for (const icon of CATEGORY_ICONS) {
      const result = createGroupSchema.safeParse({ ...VALID_GROUP, icon });
      expect(result.success).toBe(true);
    }
  });

  it('accepts every curated color', () => {
    for (const color of CATEGORY_COLORS) {
      const result = createGroupSchema.safeParse({ ...VALID_GROUP, color });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// createGroupSchema — REJECT
// ---------------------------------------------------------------------------

describe('createGroupSchema — REJECT', () => {
  it('rejects empty name', () => {
    const result = createGroupSchema.safeParse({ ...VALID_GROUP, name: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Ingresá un nombre.');
  });

  it('rejects whitespace-only name', () => {
    const result = createGroupSchema.safeParse({ ...VALID_GROUP, name: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Ingresá un nombre.');
  });

  it('rejects name with 61 characters', () => {
    const result = createGroupSchema.safeParse({ ...VALID_GROUP, name: 'a'.repeat(61) });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Máximo 60 caracteres.');
  });

  it('rejects an icon not in the curated set', () => {
    expect(createGroupSchema.safeParse({ ...VALID_GROUP, icon: 'FakeIcon' }).success).toBe(false);
  });

  it('rejects a color not in the curated set', () => {
    expect(createGroupSchema.safeParse({ ...VALID_GROUP, color: '#FFFFFF' }).success).toBe(false);
  });

  it('rejects a placeholder with empty display_name', () => {
    const result = createGroupSchema.safeParse({
      ...VALID_GROUP,
      placeholders: [''],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a placeholder display_name longer than 60 chars', () => {
    const result = createGroupSchema.safeParse({
      ...VALID_GROUP,
      placeholders: ['a'.repeat(61)],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addPlaceholderSchema
// ---------------------------------------------------------------------------

describe('addPlaceholderSchema', () => {
  it('accepts a valid display name', () => {
    expect(addPlaceholderSchema.safeParse({ display_name: 'Lucía' }).success).toBe(true);
  });

  it('rejects empty display name', () => {
    const result = addPlaceholderSchema.safeParse({ display_name: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Ingresá un nombre.');
  });

  it('rejects display name longer than 60 chars', () => {
    const result = addPlaceholderSchema.safeParse({ display_name: 'a'.repeat(61) });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Máximo 60 caracteres.');
  });
});

// ---------------------------------------------------------------------------
// inviteMemberSchema — ACCEPT
// ---------------------------------------------------------------------------

describe('inviteMemberSchema — ACCEPT', () => {
  it('accepts a valid email', () => {
    const result = inviteMemberSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('trims whitespace around email', () => {
    const result = inviteMemberSchema.safeParse({ email: '  user@example.com  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('user@example.com');
  });
});

// ---------------------------------------------------------------------------
// inviteMemberSchema — REJECT
// ---------------------------------------------------------------------------

describe('inviteMemberSchema — REJECT', () => {
  it('rejects invalid email without @', () => {
    const result = inviteMemberSchema.safeParse({ email: 'notanemail' });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Ingresá un correo válido.');
  });

  it('rejects empty email', () => {
    const result = inviteMemberSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });

  it('rejects email missing domain', () => {
    const result = inviteMemberSchema.safeParse({ email: 'user@' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// splitSchema
// ---------------------------------------------------------------------------

describe('splitSchema', () => {
  it('accepts a valid equal split (no values needed)', () => {
    const result = splitSchema.safeParse({
      type: 'equal',
      entries: [
        { member_id: 'm1', value: 0 },
        { member_id: 'm2', value: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid percent split', () => {
    const result = splitSchema.safeParse({
      type: 'percent',
      entries: [
        { member_id: 'm1', value: 60 },
        { member_id: 'm2', value: 40 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid custom split', () => {
    const result = splitSchema.safeParse({
      type: 'custom',
      entries: [
        { member_id: 'm1', value: 1500 },
        { member_id: 'm2', value: 500 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown split type', () => {
    const result = splitSchema.safeParse({
      type: 'weighted',
      entries: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative value in entries', () => {
    const result = splitSchema.safeParse({
      type: 'custom',
      entries: [{ member_id: 'm1', value: -10 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty member_id in an entry', () => {
    const result = splitSchema.safeParse({
      type: 'equal',
      entries: [{ member_id: '', value: 0 }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// settlementSchema
// ---------------------------------------------------------------------------

describe('settlementSchema — ACCEPT', () => {
  const VALID_SETTLEMENT = {
    from_member_id: 'm1',
    to_member_id: 'm2',
    amount: 500,
    currency: 'ARS',
  };

  it('accepts a valid ARS settlement', () => {
    expect(settlementSchema.safeParse(VALID_SETTLEMENT).success).toBe(true);
  });

  it('accepts a valid USD settlement', () => {
    expect(settlementSchema.safeParse({ ...VALID_SETTLEMENT, currency: 'USD' }).success).toBe(true);
  });
});

describe('settlementSchema — REJECT', () => {
  const VALID_SETTLEMENT = {
    from_member_id: 'm1',
    to_member_id: 'm2',
    amount: 500,
    currency: 'ARS',
  };

  it('rejects when from_member_id equals to_member_id', () => {
    const result = settlementSchema.safeParse({
      ...VALID_SETTLEMENT,
      from_member_id: 'same',
      to_member_id: 'same',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstIssue(result)).toMatch(/mismo/i);
    }
  });

  it('rejects a non-positive amount (zero)', () => {
    const result = settlementSchema.safeParse({ ...VALID_SETTLEMENT, amount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative amount', () => {
    const result = settlementSchema.safeParse({ ...VALID_SETTLEMENT, amount: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown currency', () => {
    const result = settlementSchema.safeParse({ ...VALID_SETTLEMENT, currency: 'EUR' });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Seleccioná ARS o USD.');
  });

  it('rejects empty from_member_id', () => {
    const result = settlementSchema.safeParse({ ...VALID_SETTLEMENT, from_member_id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty to_member_id', () => {
    const result = settlementSchema.safeParse({ ...VALID_SETTLEMENT, to_member_id: '' });
    expect(result.success).toBe(false);
  });
});
