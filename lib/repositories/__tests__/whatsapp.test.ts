/**
 * Tests for the whatsapp repository.
 *
 * Covers:
 *   - createLinkCode  → delegates to rpc('create_link_code') and maps snake→camel
 *   - getWhatsappLink → selects own linked row, returns null when none
 *   - unlinkWhatsapp  → updates own row to status='unlinked'
 */
import { supabase } from '@/lib/supabase';
import * as repo from '../whatsapp';

// ---------------------------------------------------------------------------
// Chainable Postgrest mock helpers
// ---------------------------------------------------------------------------

/**
 * Builds a chainable mock for SELECT queries ending in `.maybeSingle()`.
 * Chain: from → select → eq → eq → maybeSingle (resolves promise)
 */
function makeSelectChain(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const calls: { method: string; args: unknown[] }[] = [];

  function record(method: string, args: unknown[]) {
    calls.push({ method, args });
  }

  const maybeSingleMock = jest.fn(() => Promise.resolve(result));
  const eqMock = jest.fn((...args: unknown[]) => {
    record('eq', args);
    return chain;
  });
  const selectMock = jest.fn((...args: unknown[]) => {
    record('select', args);
    return chain;
  });

  const chain: Record<string, jest.Mock> = {
    select: selectMock,
    eq: eqMock,
    maybeSingle: maybeSingleMock,
  };

  return { chain, calls };
}

/**
 * Builds a chainable mock for UPDATE queries ending in `.eq().eq()` (no terminal).
 * Chain: from → update → eq → eq (resolves promise on the second eq)
 */
function makeUpdateChain(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const calls: { method: string; args: unknown[] }[] = [];

  function record(method: string, args: unknown[]) {
    calls.push({ method, args });
  }

  let eqCallCount = 0;
  const eqMock = jest.fn((...args: unknown[]) => {
    record('eq', args);
    eqCallCount++;
    if (eqCallCount >= 2) {
      return Promise.resolve(result);
    }
    return chain;
  });

  const updateMock = jest.fn((...args: unknown[]) => {
    record('update', args);
    return chain;
  });

  const chain: Record<string, jest.Mock> = {
    update: updateMock,
    eq: eqMock,
  };

  return { chain, calls };
}

// ---------------------------------------------------------------------------
// Tests — createLinkCode
// ---------------------------------------------------------------------------

describe('createLinkCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls rpc("create_link_code") and maps snake_case to camelCase', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: { code: 'XYZ789', expires_at: '2026-06-21T12:10:00Z' },
      error: null,
    });

    const result = await repo.createLinkCode();

    expect(supabase.rpc).toHaveBeenCalledWith('create_link_code');
    expect(result).toEqual({ code: 'XYZ789', expiresAt: '2026-06-21T12:10:00Z' });
  });

  it('throws when rpc returns an error', async () => {
    const rpcError = { message: 'rpc failed', code: '42P01' };
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: rpcError });

    await expect(repo.createLinkCode()).rejects.toEqual(rpcError);
  });

  it('throws when rpc returns null data', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

    await expect(repo.createLinkCode()).rejects.toThrow(
      'No se pudo generar el código de vinculación.',
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — getWhatsappLink
// ---------------------------------------------------------------------------

describe('getWhatsappLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the linked row mapped to camelCase when found', async () => {
    const { chain } = makeSelectChain({
      data: { wa_number: '+5491122334455', status: 'linked' },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);

    const result = await repo.getWhatsappLink('user-1');

    expect(supabase.from).toHaveBeenCalledWith('whatsapp_links');
    expect(result).toEqual({ waNumber: '+5491122334455', status: 'linked' });
  });

  it('returns null when no linked row exists', async () => {
    const { chain } = makeSelectChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);

    const result = await repo.getWhatsappLink('user-1');

    expect(result).toBeNull();
  });

  it('throws when the query returns an error', async () => {
    const dbError = { message: 'permission denied', code: '42501' };
    const { chain } = makeSelectChain({ data: null, error: dbError });
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);

    await expect(repo.getWhatsappLink('user-1')).rejects.toEqual(dbError);
  });

  it('filters by user_id and status=linked', async () => {
    const { chain, calls } = makeSelectChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);

    await repo.getWhatsappLink('user-42');

    const eqCalls = calls.filter((c) => c.method === 'eq');
    expect(eqCalls.some((c) => c.args[0] === 'user_id' && c.args[1] === 'user-42')).toBe(true);
    expect(eqCalls.some((c) => c.args[0] === 'status' && c.args[1] === 'linked')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — unlinkWhatsapp
// ---------------------------------------------------------------------------

describe('unlinkWhatsapp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls update with status=unlinked and unlinked_at on whatsapp_links', async () => {
    const { chain, calls } = makeUpdateChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);

    await repo.unlinkWhatsapp('user-1');

    expect(supabase.from).toHaveBeenCalledWith('whatsapp_links');

    const updateCall = calls.find((c) => c.method === 'update');
    expect(updateCall).toBeDefined();
    const payload = updateCall!.args[0] as Record<string, unknown>;
    expect(payload.status).toBe('unlinked');
    expect(typeof payload.unlinked_at).toBe('string');
  });

  it('filters by user_id', async () => {
    const { chain, calls } = makeUpdateChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);

    await repo.unlinkWhatsapp('user-99');

    const eqCalls = calls.filter((c) => c.method === 'eq');
    expect(eqCalls.some((c) => c.args[0] === 'user_id' && c.args[1] === 'user-99')).toBe(true);
  });

  it('throws when the update returns an error', async () => {
    const dbError = { message: 'update failed', code: '23505' };
    const { chain } = makeUpdateChain({ data: null, error: dbError });
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);

    await expect(repo.unlinkWhatsapp('user-1')).rejects.toEqual(dbError);
  });
});

// ---------------------------------------------------------------------------
// WHATSAPP_BOT_NUMBER constant
// ---------------------------------------------------------------------------

describe('WHATSAPP_BOT_NUMBER', () => {
  it('is defined and starts with a + sign', () => {
    expect(repo.WHATSAPP_BOT_NUMBER).toBeDefined();
    expect(repo.WHATSAPP_BOT_NUMBER.startsWith('+')).toBe(true);
  });
});
