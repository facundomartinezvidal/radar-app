/**
 * Unit tests for expense Zod schemas.
 *
 * Covers:
 * - `expenseItemInputSchema` — field-level validation for line items
 * - `createExpenseSchema`    — top-level create validation including items array
 */
import { createExpenseSchema, expenseItemInputSchema } from '../expense';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function firstIssue(result: { success: false; error: { issues: { message: string }[] } }): string {
  const issue = result.error.issues[0];
  if (!issue) throw new Error('Expected at least one validation issue');
  return issue.message;
}

// ---------------------------------------------------------------------------
// expenseItemInputSchema
// ---------------------------------------------------------------------------

describe('expenseItemInputSchema', () => {
  const VALID_ITEM = {
    name: 'Papas fritas',
    quantity: 2,
    unit_price: 500,
    line_total: 1000,
  };

  describe('ACCEPT cases', () => {
    it('accepts a fully populated valid item', () => {
      const result = expenseItemInputSchema.safeParse(VALID_ITEM);
      expect(result.success).toBe(true);
    });

    it('accepts unit_price null', () => {
      const result = expenseItemInputSchema.safeParse({ ...VALID_ITEM, unit_price: null });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.unit_price).toBeNull();
    });

    it('accepts item with optional id present', () => {
      const result = expenseItemInputSchema.safeParse({ ...VALID_ITEM, id: 'some-uuid' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.id).toBe('some-uuid');
    });

    it('accepts item without id (optional)', () => {
      const result = expenseItemInputSchema.safeParse({ ...VALID_ITEM });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.id).toBeUndefined();
    });

    it('accepts name with exactly 1 character', () => {
      const result = expenseItemInputSchema.safeParse({ ...VALID_ITEM, name: 'A' });
      expect(result.success).toBe(true);
    });

    it('accepts name with exactly 120 characters', () => {
      const result = expenseItemInputSchema.safeParse({ ...VALID_ITEM, name: 'a'.repeat(120) });
      expect(result.success).toBe(true);
    });

    it('accepts quantity of 0.001 (minimum above zero)', () => {
      const result = expenseItemInputSchema.safeParse({ ...VALID_ITEM, quantity: 0.001 });
      expect(result.success).toBe(true);
    });

    it('accepts line_total of 0 (minimum)', () => {
      const result = expenseItemInputSchema.safeParse({ ...VALID_ITEM, line_total: 0 });
      expect(result.success).toBe(true);
    });
  });

  describe('REJECT cases — name', () => {
    it('rejects empty name', () => {
      const result = expenseItemInputSchema.safeParse({ ...VALID_ITEM, name: '' });
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result)).toBe('Ingresá un nombre.');
    });

    it('rejects whitespace-only name', () => {
      const result = expenseItemInputSchema.safeParse({ ...VALID_ITEM, name: '   ' });
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result)).toBe('Ingresá un nombre.');
    });

    it('rejects name longer than 120 characters', () => {
      const result = expenseItemInputSchema.safeParse({ ...VALID_ITEM, name: 'a'.repeat(121) });
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result)).toBe('Máximo 120 caracteres.');
    });
  });

  describe('REJECT cases — quantity', () => {
    it('rejects quantity of 0', () => {
      const result = expenseItemInputSchema.safeParse({ ...VALID_ITEM, quantity: 0 });
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result)).toBe('La cantidad debe ser mayor a cero.');
    });

    it('rejects negative quantity', () => {
      const result = expenseItemInputSchema.safeParse({ ...VALID_ITEM, quantity: -1 });
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result)).toBe('La cantidad debe ser mayor a cero.');
    });
  });

  describe('REJECT cases — line_total', () => {
    it('rejects negative line_total', () => {
      const result = expenseItemInputSchema.safeParse({ ...VALID_ITEM, line_total: -0.01 });
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result)).toBe('Importe inválido.');
    });
  });
});

// ---------------------------------------------------------------------------
// createExpenseSchema — items array
// ---------------------------------------------------------------------------

describe('createExpenseSchema — items field', () => {
  const BASE = {
    amount: 5000,
    currency: 'ARS',
    category_id: 'cat-1',
  };

  const VALID_ITEM = {
    name: 'Milanesa',
    quantity: 1,
    unit_price: 5000,
    line_total: 5000,
  };

  it('accepts items being undefined (optional field)', () => {
    const result = createExpenseSchema.safeParse(BASE);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.items).toBeUndefined();
  });

  it('accepts items as empty array', () => {
    const result = createExpenseSchema.safeParse({ ...BASE, items: [] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.items).toEqual([]);
  });

  it('accepts items array with 50 items (upper bound)', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ ...VALID_ITEM, name: `Item ${i + 1}` }));
    const result = createExpenseSchema.safeParse({ ...BASE, items });
    expect(result.success).toBe(true);
  });

  it('rejects items array with 51 items (exceeds max)', () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ ...VALID_ITEM, name: `Item ${i + 1}` }));
    const result = createExpenseSchema.safeParse({ ...BASE, items });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result)).toBe('Máximo 50 ítems.');
  });

  it('propagates inner item validation errors', () => {
    const result = createExpenseSchema.safeParse({ ...BASE, items: [{ ...VALID_ITEM, name: '' }] });
    expect(result.success).toBe(false);
  });
});
