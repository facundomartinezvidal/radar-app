/**
 * Unit tests for income Zod schemas.
 *
 * Covers:
 * - `createIncomeSchema` — amount, currency, category_id, description, occurred_at
 * - `updateIncomeSchema` — partial (all fields optional)
 * - `incomeFilterSchema` — search, categoryIds, currencies, from, to, limit, offset
 */
import { createIncomeSchema, incomeFilterSchema, updateIncomeSchema } from '../income';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function firstIssue(result: { success: false; error: { issues: { message: string }[] } }): string {
  const issue = result.error.issues[0];
  if (!issue) throw new Error('Expected at least one validation issue');
  return issue.message;
}

// ---------------------------------------------------------------------------
// createIncomeSchema — ACCEPT
// ---------------------------------------------------------------------------

describe('createIncomeSchema — ACCEPT', () => {
  const VALID_INCOME = {
    amount: 50000,
    currency: 'ARS',
    category_id: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Sueldo de junio',
    occurred_at: '2026-06-01T00:00:00Z',
  };

  it('accepts a fully populated valid income', () => {
    const result = createIncomeSchema.safeParse(VALID_INCOME);
    expect(result.success).toBe(true);
  });

  it('accepts USD currency', () => {
    const result = createIncomeSchema.safeParse({ ...VALID_INCOME, currency: 'USD' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currency).toBe('USD');
  });

  it('accepts category_id as null', () => {
    const result = createIncomeSchema.safeParse({ ...VALID_INCOME, category_id: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.category_id).toBeNull();
  });

  it('accepts description being undefined (optional)', () => {
    const { description: _d, ...withoutDesc } = VALID_INCOME;
    const result = createIncomeSchema.safeParse(withoutDesc);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeUndefined();
  });

  it('accepts description as null', () => {
    const result = createIncomeSchema.safeParse({ ...VALID_INCOME, description: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeNull();
  });

  it('trims surrounding whitespace from description', () => {
    const result = createIncomeSchema.safeParse({ ...VALID_INCOME, description: '  Sueldo  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe('Sueldo');
  });

  it('accepts description of exactly 240 characters', () => {
    const result = createIncomeSchema.safeParse({
      ...VALID_INCOME,
      description: 'a'.repeat(240),
    });
    expect(result.success).toBe(true);
  });

  it('accepts occurred_at being undefined (optional)', () => {
    const { occurred_at: _o, ...withoutDate } = VALID_INCOME;
    const result = createIncomeSchema.safeParse(withoutDate);
    expect(result.success).toBe(true);
  });

  it('accepts occurred_at with timezone offset', () => {
    const result = createIncomeSchema.safeParse({
      ...VALID_INCOME,
      occurred_at: '2026-06-01T10:30:00-03:00',
    });
    expect(result.success).toBe(true);
  });

  it('accepts minimum valid amount (above zero)', () => {
    const result = createIncomeSchema.safeParse({ ...VALID_INCOME, amount: 0.01 });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createIncomeSchema — REJECT
// ---------------------------------------------------------------------------

describe('createIncomeSchema — REJECT: amount', () => {
  const BASE = {
    amount: 50000,
    currency: 'ARS',
    category_id: null,
  };

  it('rejects amount of zero', () => {
    const result = createIncomeSchema.safeParse({ ...BASE, amount: 0 });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('El monto tiene que ser mayor a cero.');
  });

  it('rejects negative amount', () => {
    const result = createIncomeSchema.safeParse({ ...BASE, amount: -1 });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('El monto tiene que ser mayor a cero.');
  });
});

describe('createIncomeSchema — REJECT: currency', () => {
  const BASE = {
    amount: 50000,
    currency: 'ARS',
    category_id: null,
  };

  it('rejects an unknown currency', () => {
    const result = createIncomeSchema.safeParse({ ...BASE, currency: 'EUR' });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Seleccioná ARS o USD.');
  });

  it('rejects empty currency string', () => {
    const result = createIncomeSchema.safeParse({ ...BASE, currency: '' });
    expect(result.success).toBe(false);
  });
});

describe('createIncomeSchema — REJECT: description', () => {
  const BASE = {
    amount: 50000,
    currency: 'ARS',
    category_id: null,
  };

  it('rejects description longer than 240 characters', () => {
    const result = createIncomeSchema.safeParse({ ...BASE, description: 'a'.repeat(241) });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Máximo 240 caracteres.');
  });
});

describe('createIncomeSchema — REJECT: occurred_at', () => {
  const BASE = {
    amount: 50000,
    currency: 'ARS',
    category_id: null,
  };

  it('rejects a non-ISO occurred_at (plain date string)', () => {
    const result = createIncomeSchema.safeParse({ ...BASE, occurred_at: '2026-06-01' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid datetime string', () => {
    const result = createIncomeSchema.safeParse({ ...BASE, occurred_at: 'not-a-date' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateIncomeSchema — all fields optional
// ---------------------------------------------------------------------------

describe('updateIncomeSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    const result = updateIncomeSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a partial update with only amount', () => {
    const result = updateIncomeSchema.safeParse({ amount: 75000 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(75000);
  });

  it('accepts a partial update with only currency', () => {
    const result = updateIncomeSchema.safeParse({ currency: 'USD' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currency).toBe('USD');
  });

  it('accepts a partial update with only description', () => {
    const result = updateIncomeSchema.safeParse({ description: 'Actualización' });
    expect(result.success).toBe(true);
  });

  it('still rejects invalid amount in partial update', () => {
    const result = updateIncomeSchema.safeParse({ amount: -50 });
    expect(result.success).toBe(false);
  });

  it('still rejects invalid currency in partial update', () => {
    const result = updateIncomeSchema.safeParse({ currency: 'BTC' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// incomeFilterSchema
// ---------------------------------------------------------------------------

describe('incomeFilterSchema — ACCEPT', () => {
  it('accepts an empty filter (all fields optional)', () => {
    const result = incomeFilterSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a fully populated valid filter', () => {
    const result = incomeFilterSchema.safeParse({
      search: 'sueldo',
      categoryIds: ['cat-1', 'cat-2'],
      currencies: ['ARS'],
      from: '2026-01-01T00:00:00Z',
      to: '2026-06-30T23:59:59Z',
      limit: 50,
      offset: 0,
    });
    expect(result.success).toBe(true);
  });

  it('accepts limit of 1 (minimum)', () => {
    expect(incomeFilterSchema.safeParse({ limit: 1 }).success).toBe(true);
  });

  it('accepts limit of 200 (maximum)', () => {
    expect(incomeFilterSchema.safeParse({ limit: 200 }).success).toBe(true);
  });

  it('accepts offset of 0 (minimum)', () => {
    expect(incomeFilterSchema.safeParse({ offset: 0 }).success).toBe(true);
  });

  it('accepts currencies array with both ARS and USD', () => {
    const result = incomeFilterSchema.safeParse({ currencies: ['ARS', 'USD'] });
    expect(result.success).toBe(true);
  });
});

describe('incomeFilterSchema — REJECT', () => {
  it('rejects limit of 0', () => {
    const result = incomeFilterSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects limit of 201 (exceeds maximum)', () => {
    const result = incomeFilterSchema.safeParse({ limit: 201 });
    expect(result.success).toBe(false);
  });

  it('rejects negative offset', () => {
    const result = incomeFilterSchema.safeParse({ offset: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects unknown currency in currencies array', () => {
    const result = incomeFilterSchema.safeParse({ currencies: ['EUR'] });
    expect(result.success).toBe(false);
  });

  it('rejects non-ISO from datetime', () => {
    const result = incomeFilterSchema.safeParse({ from: '2026-01-01' });
    expect(result.success).toBe(false);
  });
});
