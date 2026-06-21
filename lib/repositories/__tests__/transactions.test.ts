/**
 * Tests for the transactions repository — importTransactions.
 *
 * Covers:
 *  - Success path: RPC returns a number, repo returns { data: N, error: null }
 *  - Error path: RPC returns { data: null, error: PostgrestError }
 *  - Non-numeric RPC return: treated as null data
 *  - Thrown error (network-level): caught and returned in error slot
 */
import { supabase } from '@/lib/supabase';
import { importTransactions } from '../transactions';
import type { ImportTransactionRow } from '../transactions';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROWS: ImportTransactionRow[] = [
  {
    direction: 'expense',
    amount: 1500,
    currency: 'ARS',
    category_id: 'cat-1',
    description: 'Netflix',
    occurred_at: '2026-05-01T00:00:00Z',
  },
  {
    direction: 'income',
    amount: 50000,
    currency: 'ARS',
    category_id: null,
    description: 'Sueldo',
    occurred_at: '2026-05-05T00:00:00Z',
  },
];

const POSTGREST_ERROR = {
  message: 'foreign key violation',
  code: '23503',
  details: null,
  hint: null,
  name: 'PostgrestError',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('importTransactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns { data: insertedCount, error: null } on success', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: 2, error: null });

    const result = await importTransactions(ROWS);

    expect(result.data).toBe(2);
    expect(result.error).toBeNull();
  });

  it('calls supabase.rpc with import_transactions and the rows as p_rows', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: 2, error: null });

    await importTransactions(ROWS);

    expect(supabase.rpc).toHaveBeenCalledWith('import_transactions', {
      p_rows: ROWS,
    });
  });

  it('returns { data: null, error } when RPC returns a PostgrestError', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: POSTGREST_ERROR,
    });

    const result = await importTransactions(ROWS);

    expect(result.data).toBeNull();
    expect(result.error).toBe(POSTGREST_ERROR);
  });

  it('returns { data: null, error: null } when RPC returns a non-numeric value', async () => {
    // Should not happen in practice (RPC always returns number), but we
    // handle it defensively: data is null, no error thrown.
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: 'unexpected', error: null });

    const result = await importTransactions(ROWS);

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it('catches a thrown error and returns it in the error slot', async () => {
    const networkError = new Error('fetch failed');
    (supabase.rpc as jest.Mock).mockRejectedValueOnce(networkError);

    const result = await importTransactions(ROWS);

    expect(result.data).toBeNull();
    expect(result.error).toBe(networkError);
  });

  it('returns data: 0 when the RPC returns 0 (zero rows inserted)', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: 0, error: null });

    const result = await importTransactions(ROWS);

    expect(result.data).toBe(0);
    expect(result.error).toBeNull();
  });
});
