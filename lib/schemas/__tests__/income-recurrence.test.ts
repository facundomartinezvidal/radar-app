/**
 * Unit tests for income recurrence Zod schemas.
 *
 * Covers:
 * - `createRecurrenceSchema` — amount, currency, category_id, description,
 *   frequency, start_date, end_date, and the end >= start refine
 * - `updateRecurrenceSchema` — partial (all fields optional), end >= start
 *   still enforced when both present
 */
import { createRecurrenceSchema, FREQUENCIES, updateRecurrenceSchema } from '../income-recurrence';

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

const VALID_RECURRENCE = {
  amount: 200000,
  currency: 'ARS',
  category_id: '550e8400-e29b-41d4-a716-446655440000',
  description: 'Sueldo mensual',
  frequency: 'monthly' as const,
  start_date: '2026-01-01',
};

// ---------------------------------------------------------------------------
// createRecurrenceSchema — ACCEPT
// ---------------------------------------------------------------------------

describe('createRecurrenceSchema — ACCEPT', () => {
  it('accepts a fully populated valid recurrence without end_date', () => {
    const result = createRecurrenceSchema.safeParse(VALID_RECURRENCE);
    expect(result.success).toBe(true);
  });

  it('accepts a valid recurrence with end_date after start_date', () => {
    const result = createRecurrenceSchema.safeParse({
      ...VALID_RECURRENCE,
      end_date: '2026-12-31',
    });
    expect(result.success).toBe(true);
  });

  it('accepts end_date equal to start_date', () => {
    const result = createRecurrenceSchema.safeParse({
      ...VALID_RECURRENCE,
      end_date: '2026-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('accepts end_date as null (explicitly no end)', () => {
    const result = createRecurrenceSchema.safeParse({ ...VALID_RECURRENCE, end_date: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.end_date).toBeNull();
  });

  it('accepts end_date being undefined (optional)', () => {
    const result = createRecurrenceSchema.safeParse(VALID_RECURRENCE);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.end_date).toBeUndefined();
  });

  it('accepts all valid frequencies', () => {
    for (const frequency of FREQUENCIES) {
      const result = createRecurrenceSchema.safeParse({ ...VALID_RECURRENCE, frequency });
      expect(result.success).toBe(true);
    }
  });

  it('accepts category_id as null', () => {
    const result = createRecurrenceSchema.safeParse({ ...VALID_RECURRENCE, category_id: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.category_id).toBeNull();
  });

  it('accepts description being undefined (optional)', () => {
    const { description: _d, ...withoutDesc } = VALID_RECURRENCE;
    const result = createRecurrenceSchema.safeParse(withoutDesc);
    expect(result.success).toBe(true);
  });

  it('accepts description as null', () => {
    const result = createRecurrenceSchema.safeParse({ ...VALID_RECURRENCE, description: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeNull();
  });

  it('trims surrounding whitespace from description', () => {
    const result = createRecurrenceSchema.safeParse({
      ...VALID_RECURRENCE,
      description: '  Ingreso  ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe('Ingreso');
  });

  it('accepts USD currency', () => {
    const result = createRecurrenceSchema.safeParse({ ...VALID_RECURRENCE, currency: 'USD' });
    expect(result.success).toBe(true);
  });

  it('accepts minimum valid amount (above zero)', () => {
    const result = createRecurrenceSchema.safeParse({ ...VALID_RECURRENCE, amount: 0.01 });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createRecurrenceSchema — REJECT
// ---------------------------------------------------------------------------

describe('createRecurrenceSchema — REJECT: amount', () => {
  it('rejects amount of zero', () => {
    const result = createRecurrenceSchema.safeParse({ ...VALID_RECURRENCE, amount: 0 });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('El monto tiene que ser mayor a cero.');
  });

  it('rejects negative amount', () => {
    const result = createRecurrenceSchema.safeParse({ ...VALID_RECURRENCE, amount: -100 });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('El monto tiene que ser mayor a cero.');
  });
});

describe('createRecurrenceSchema — REJECT: currency', () => {
  it('rejects an unknown currency', () => {
    const result = createRecurrenceSchema.safeParse({ ...VALID_RECURRENCE, currency: 'EUR' });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Seleccioná ARS o USD.');
  });
});

describe('createRecurrenceSchema — REJECT: frequency', () => {
  it('rejects an unknown frequency', () => {
    const result = createRecurrenceSchema.safeParse({ ...VALID_RECURRENCE, frequency: 'daily' });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Seleccioná una frecuencia válida.');
  });

  it('rejects empty frequency string', () => {
    const result = createRecurrenceSchema.safeParse({ ...VALID_RECURRENCE, frequency: '' });
    expect(result.success).toBe(false);
  });
});

describe('createRecurrenceSchema — REJECT: date validation', () => {
  it('rejects start_date with invalid format (not YYYY-MM-DD)', () => {
    const result = createRecurrenceSchema.safeParse({
      ...VALID_RECURRENCE,
      start_date: '01/01/2026',
    });
    expect(result.success).toBe(false);
  });

  it('rejects end_date with invalid format', () => {
    const result = createRecurrenceSchema.safeParse({
      ...VALID_RECURRENCE,
      end_date: '31-12-2026',
    });
    expect(result.success).toBe(false);
  });

  it('rejects end_date earlier than start_date', () => {
    const result = createRecurrenceSchema.safeParse({
      ...VALID_RECURRENCE,
      start_date: '2026-06-01',
      end_date: '2026-05-31',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstIssue(result)).toBe('La fecha de fin debe ser posterior o igual a la de inicio.');
    }
  });
});

describe('createRecurrenceSchema — REJECT: description', () => {
  it('rejects description longer than 240 characters', () => {
    const result = createRecurrenceSchema.safeParse({
      ...VALID_RECURRENCE,
      description: 'a'.repeat(241),
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Máximo 240 caracteres.');
  });
});

// ---------------------------------------------------------------------------
// updateRecurrenceSchema — all fields optional
// ---------------------------------------------------------------------------

describe('updateRecurrenceSchema — ACCEPT', () => {
  it('accepts an empty object (all fields optional)', () => {
    const result = updateRecurrenceSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a partial update with only amount', () => {
    const result = updateRecurrenceSchema.safeParse({ amount: 300000 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(300000);
  });

  it('accepts a partial update with only frequency', () => {
    const result = updateRecurrenceSchema.safeParse({ frequency: 'yearly' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.frequency).toBe('yearly');
  });

  it('accepts updating only end_date without start_date (no refine triggered)', () => {
    const result = updateRecurrenceSchema.safeParse({ end_date: '2027-01-01' });
    expect(result.success).toBe(true);
  });

  it('accepts updating only start_date without end_date (no refine triggered)', () => {
    const result = updateRecurrenceSchema.safeParse({ start_date: '2026-03-01' });
    expect(result.success).toBe(true);
  });

  it('accepts both dates when end_date >= start_date', () => {
    const result = updateRecurrenceSchema.safeParse({
      start_date: '2026-03-01',
      end_date: '2026-12-31',
    });
    expect(result.success).toBe(true);
  });

  it('accepts both dates when end_date equals start_date', () => {
    const result = updateRecurrenceSchema.safeParse({
      start_date: '2026-06-15',
      end_date: '2026-06-15',
    });
    expect(result.success).toBe(true);
  });
});

describe('updateRecurrenceSchema — REJECT', () => {
  it('still rejects invalid amount in partial update', () => {
    const result = updateRecurrenceSchema.safeParse({ amount: 0 });
    expect(result.success).toBe(false);
  });

  it('still rejects invalid currency in partial update', () => {
    const result = updateRecurrenceSchema.safeParse({ currency: 'BTC' });
    expect(result.success).toBe(false);
  });

  it('still rejects invalid frequency in partial update', () => {
    const result = updateRecurrenceSchema.safeParse({ frequency: 'hourly' });
    expect(result.success).toBe(false);
  });

  it('rejects when end_date < start_date in partial update with both present', () => {
    const result = updateRecurrenceSchema.safeParse({
      start_date: '2026-06-01',
      end_date: '2026-05-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstIssue(result)).toBe('La fecha de fin debe ser posterior o igual a la de inicio.');
    }
  });
});
