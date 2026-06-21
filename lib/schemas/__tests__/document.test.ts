/**
 * Unit tests for `lib/schemas/document.ts`.
 *
 * Covers:
 * - `documentOcrResultSchema` — valid parse; defensive coercion; multi-transaction array
 * - `documentTransactionSchema` — per-field coercion (direction, currency, items)
 */

import { documentOcrResultSchema, documentTransactionSchema } from '@/lib/schemas/document';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_TRANSACTION = {
  amount: 1500,
  currency: 'ARS',
  occurredAt: '2026-05-01',
  merchant: 'Tienda Ejemplo',
  direction: 'expense',
  categoryHint: 'Comida',
  suggestedNewCategory: null,
  suggestedNewCategoryReason: null,
  items: [],
};

const VALID_INCOME_TRANSACTION = {
  amount: 50000,
  currency: 'ARS',
  occurredAt: '2026-05-15',
  merchant: 'Cliente SA',
  direction: 'income',
  categoryHint: null,
  suggestedNewCategory: null,
  suggestedNewCategoryReason: null,
  items: [],
};

const VALID_RESULT = {
  documentType: 'receipt',
  confidence: 0.85,
  truncated: false,
  transactions: [VALID_TRANSACTION],
};

// ---------------------------------------------------------------------------
// documentTransactionSchema
// ---------------------------------------------------------------------------

describe('documentTransactionSchema', () => {
  it('parses a valid expense transaction', () => {
    const result = documentTransactionSchema.parse(VALID_TRANSACTION);
    expect(result.amount).toBe(1500);
    expect(result.currency).toBe('ARS');
    expect(result.direction).toBe('expense');
    expect(result.merchant).toBe('Tienda Ejemplo');
    expect(result.categoryHint).toBe('Comida');
    expect(result.items).toEqual([]);
  });

  it('parses a valid income transaction', () => {
    const result = documentTransactionSchema.parse(VALID_INCOME_TRANSACTION);
    expect(result.direction).toBe('income');
    expect(result.amount).toBe(50000);
  });

  it('coerces an unknown direction to "expense" via catch', () => {
    const result = documentTransactionSchema.parse({
      ...VALID_TRANSACTION,
      direction: 'debit',
    });
    expect(result.direction).toBe('expense');
  });

  it('coerces a missing direction to "expense" via catch', () => {
    const { direction: _dir, ...withoutDir } = VALID_TRANSACTION;
    const result = documentTransactionSchema.parse(withoutDir);
    expect(result.direction).toBe('expense');
  });

  it('coerces an unknown currency to null via catch', () => {
    const result = documentTransactionSchema.parse({
      ...VALID_TRANSACTION,
      currency: 'EUR',
    });
    expect(result.currency).toBeNull();
  });

  it('keeps null currency as null', () => {
    const result = documentTransactionSchema.parse({
      ...VALID_TRANSACTION,
      currency: null,
    });
    expect(result.currency).toBeNull();
  });

  it('coerces a non-array items to [] via catch', () => {
    const result = documentTransactionSchema.parse({
      ...VALID_TRANSACTION,
      items: 'garbage',
    });
    expect(result.items).toEqual([]);
  });

  it('coerces missing items to [] via catch', () => {
    const { items: _items, ...withoutItems } = VALID_TRANSACTION;
    const result = documentTransactionSchema.parse(withoutItems);
    expect(result.items).toEqual([]);
  });

  it('parses items when present', () => {
    const result = documentTransactionSchema.parse({
      ...VALID_TRANSACTION,
      items: [{ name: 'Empanada', quantity: 2, unitPrice: 300, lineTotal: 600 }],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ name: 'Empanada', quantity: 2 });
  });

  it('coerces null amount to null', () => {
    const result = documentTransactionSchema.parse({ ...VALID_TRANSACTION, amount: null });
    expect(result.amount).toBeNull();
  });

  it('coerces null merchant to null', () => {
    const result = documentTransactionSchema.parse({ ...VALID_TRANSACTION, merchant: null });
    expect(result.merchant).toBeNull();
  });

  it('coerces null occurredAt to null', () => {
    const result = documentTransactionSchema.parse({ ...VALID_TRANSACTION, occurredAt: null });
    expect(result.occurredAt).toBeNull();
  });

  it('coerces null categoryHint to null', () => {
    const result = documentTransactionSchema.parse({ ...VALID_TRANSACTION, categoryHint: null });
    expect(result.categoryHint).toBeNull();
  });

  it('coerces null suggestedNewCategory to null', () => {
    const result = documentTransactionSchema.parse({
      ...VALID_TRANSACTION,
      suggestedNewCategory: null,
    });
    expect(result.suggestedNewCategory).toBeNull();
  });

  it('coerces null suggestedNewCategoryReason to null', () => {
    const result = documentTransactionSchema.parse({
      ...VALID_TRANSACTION,
      suggestedNewCategoryReason: null,
    });
    expect(result.suggestedNewCategoryReason).toBeNull();
  });

  it('coerces a non-string suggestedNewCategory (number) to null via catch', () => {
    const result = documentTransactionSchema.parse({
      ...VALID_TRANSACTION,
      suggestedNewCategory: 42,
    });
    expect(result.suggestedNewCategory).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// documentOcrResultSchema — valid parse
// ---------------------------------------------------------------------------

describe('documentOcrResultSchema — valid parse', () => {
  it('parses a valid single-transaction result', () => {
    const result = documentOcrResultSchema.parse(VALID_RESULT);
    expect(result.documentType).toBe('receipt');
    expect(result.confidence).toBe(0.85);
    expect(result.truncated).toBe(false);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.direction).toBe('expense');
  });

  it('parses all valid documentType values', () => {
    const types = ['receipt', 'transfer', 'card_statement', 'screenshot', 'unknown'] as const;
    for (const documentType of types) {
      const result = documentOcrResultSchema.parse({ ...VALID_RESULT, documentType });
      expect(result.documentType).toBe(documentType);
    }
  });

  it('parses truncated: true', () => {
    const result = documentOcrResultSchema.parse({ ...VALID_RESULT, truncated: true });
    expect(result.truncated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// documentOcrResultSchema — defensive coercion
// ---------------------------------------------------------------------------

describe('documentOcrResultSchema — defensive coercion', () => {
  it('coerces an unknown documentType to "unknown" via catch', () => {
    const result = documentOcrResultSchema.parse({ ...VALID_RESULT, documentType: 'invoice' });
    expect(result.documentType).toBe('unknown');
  });

  it('coerces a missing documentType to "unknown" via catch', () => {
    const { documentType: _dt, ...withoutType } = VALID_RESULT;
    const result = documentOcrResultSchema.parse(withoutType);
    expect(result.documentType).toBe('unknown');
  });

  it('coerces an out-of-range confidence (> 1) to 0 via catch', () => {
    const result = documentOcrResultSchema.parse({ ...VALID_RESULT, confidence: 1.5 });
    expect(result.confidence).toBe(0);
  });

  it('coerces an out-of-range confidence (< 0) to 0 via catch', () => {
    const result = documentOcrResultSchema.parse({ ...VALID_RESULT, confidence: -0.1 });
    expect(result.confidence).toBe(0);
  });

  it('coerces a missing confidence to 0 via catch', () => {
    const { confidence: _conf, ...withoutConf } = VALID_RESULT;
    const result = documentOcrResultSchema.parse(withoutConf);
    expect(result.confidence).toBe(0);
  });

  it('coerces a non-boolean truncated to false via catch', () => {
    const result = documentOcrResultSchema.parse({ ...VALID_RESULT, truncated: 'yes' });
    expect(result.truncated).toBe(false);
  });

  it('coerces a missing truncated to false via catch', () => {
    const { truncated: _tr, ...withoutTrunc } = VALID_RESULT;
    const result = documentOcrResultSchema.parse(withoutTrunc);
    expect(result.truncated).toBe(false);
  });

  it('coerces a non-array transactions to [] via catch', () => {
    const result = documentOcrResultSchema.parse({ ...VALID_RESULT, transactions: 'bad' });
    expect(result.transactions).toEqual([]);
  });

  it('coerces missing transactions to [] via catch', () => {
    const { transactions: _txs, ...withoutTxs } = VALID_RESULT;
    const result = documentOcrResultSchema.parse(withoutTxs);
    expect(result.transactions).toEqual([]);
  });

  it('coerces null transactions to [] via catch', () => {
    const result = documentOcrResultSchema.parse({ ...VALID_RESULT, transactions: null });
    expect(result.transactions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// documentOcrResultSchema — multi-transaction array
// ---------------------------------------------------------------------------

describe('documentOcrResultSchema — multi-transaction array', () => {
  it('parses a result with multiple transactions of mixed directions', () => {
    const result = documentOcrResultSchema.parse({
      documentType: 'card_statement',
      confidence: 0.92,
      truncated: false,
      transactions: [
        VALID_TRANSACTION,
        VALID_INCOME_TRANSACTION,
        { ...VALID_TRANSACTION, amount: 3000, merchant: 'Supermercado' },
      ],
    });
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0]?.direction).toBe('expense');
    expect(result.transactions[1]?.direction).toBe('income');
    expect(result.transactions[2]?.amount).toBe(3000);
  });

  it('parses a card_statement with truncated: true', () => {
    const result = documentOcrResultSchema.parse({
      documentType: 'card_statement',
      confidence: 0.75,
      truncated: true,
      transactions: [VALID_TRANSACTION, VALID_INCOME_TRANSACTION],
    });
    expect(result.documentType).toBe('card_statement');
    expect(result.truncated).toBe(true);
    expect(result.transactions).toHaveLength(2);
  });

  it('parses an empty transactions array', () => {
    const result = documentOcrResultSchema.parse({
      documentType: 'unknown',
      confidence: 0.1,
      truncated: false,
      transactions: [],
    });
    expect(result.transactions).toEqual([]);
  });

  it('coerces a bad direction inside a multi-transaction array to "expense"', () => {
    const result = documentOcrResultSchema.parse({
      ...VALID_RESULT,
      transactions: [{ ...VALID_TRANSACTION, direction: 'outgoing' }],
    });
    expect(result.transactions[0]?.direction).toBe('expense');
  });
});
