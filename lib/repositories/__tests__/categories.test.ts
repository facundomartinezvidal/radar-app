/**
 * Tests for the categories repository.
 *
 * Drives Supabase through a chainable query builder mock (mirrors the pattern
 * from expenses.test.ts). Verifies the SQL shape, slug generation, and the
 * 23505 → friendly-error mapping.
 */
import { supabase } from '@/lib/supabase';
import { slugify, createCategory, updateCategory, deleteCategory } from '../categories';

// ---------------------------------------------------------------------------
// Chainable Postgrest mock
// ---------------------------------------------------------------------------

type ChainMethod =
  | 'select'
  | 'insert'
  | 'update'
  | 'delete'
  | 'eq'
  | 'order'
  | 'single'
  | 'maybeSingle';

type ChainMocks = Record<ChainMethod, jest.Mock>;

interface ChainHandle {
  chain: ChainMocks;
  calls: { method: string; args: unknown[] }[];
}

function makeChain(
  result: { data: unknown; error: unknown } = { data: null, error: null },
): ChainHandle {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain = {} as ChainMocks;
  const methods: ChainMethod[] = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'order',
    'single',
    'maybeSingle',
  ];

  for (const m of methods) {
    chain[m] = jest.fn((...args: unknown[]) => {
      calls.push({ method: m, args });
      if (m === 'single' || m === 'maybeSingle') {
        return Promise.resolve(result);
      }
      return chain;
    });
  }

  return { chain, calls };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_CATEGORY_ROW = {
  id: 'cat-custom-1',
  user_id: 'user-1',
  slug: 'mascotas',
  name: 'Mascotas',
  icon: 'PawPrint',
  color: '#10B981',
  sort_order: 100,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const VALID_INPUT = {
  name: 'Mascotas',
  icon: 'PawPrint' as const,
  color: '#10B981' as const,
};

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------

describe('slugify', () => {
  it('lowercases and strips diacritics', () => {
    expect(slugify('Comida Rápida')).toBe('comida-rapida');
  });

  it('converts spaces to hyphens', () => {
    expect(slugify('Fast Food')).toBe('fast-food');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('---test---')).toBe('test');
  });

  it('collapses multiple non-alphanumeric chars into one hyphen', () => {
    expect(slugify('A  &  B')).toBe('a-b');
  });

  it('returns "categoria" when the result would be empty', () => {
    expect(slugify('---')).toBe('categoria');
    expect(slugify('   ')).toBe('categoria');
  });

  it('handles pure ASCII names without changes (besides lowercase)', () => {
    expect(slugify('Entretenimiento')).toBe('entretenimiento');
  });
});

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------

describe('createCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets user_id, slug, and sort_order=100 in the insert payload', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const handle = makeChain({ data: VALID_CATEGORY_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await createCategory(VALID_INPUT);

    const insertCall = handle.calls.find((c) => c.method === 'insert');
    expect(insertCall).toBeDefined();
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.user_id).toBe('user-1');
    expect(payload.slug).toBe('mascotas');
    expect(payload.sort_order).toBe(100);
    expect(payload.name).toBe('Mascotas');
    expect(payload.icon).toBe('PawPrint');
    expect(payload.color).toBe('#10B981');
  });

  it('returns the created row on success', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const handle = makeChain({ data: VALID_CATEGORY_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await createCategory(VALID_INPUT);
    expect(result.error).toBeNull();
    expect(result.data).toEqual(VALID_CATEGORY_ROW);
  });

  it('maps a 23505 unique-violation to the friendly duplicate-name error', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const pgError = { code: '23505', message: 'duplicate key value violates unique constraint' };
    const handle = makeChain({ data: null, error: pgError });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await createCategory(VALID_INPUT);
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toBe('Ya tenés una categoría con ese nombre.');
  });

  it('returns { data: null, error } when no session is active', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await createCategory(VALID_INPUT);
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toMatch(/sesión/i);
  });
});

// ---------------------------------------------------------------------------
// updateCategory
// ---------------------------------------------------------------------------

describe('updateCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('recomputes slug when name is present in the patch', async () => {
    const updatedRow = { ...VALID_CATEGORY_ROW, name: 'Comida Rápida', slug: 'comida-rapida' };
    const handle = makeChain({ data: updatedRow, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await updateCategory('cat-custom-1', { name: 'Comida Rápida' });

    const updateCall = handle.calls.find((c) => c.method === 'update');
    expect(updateCall).toBeDefined();
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload.name).toBe('Comida Rápida');
    expect(payload.slug).toBe('comida-rapida');

    expect(result.error).toBeNull();
    expect(result.data?.slug).toBe('comida-rapida');
  });

  it('does NOT include slug in the update when name is absent', async () => {
    const handle = makeChain({ data: { ...VALID_CATEGORY_ROW, color: '#EF4444' }, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await updateCategory('cat-custom-1', { color: '#EF4444' });

    const updateCall = handle.calls.find((c) => c.method === 'update');
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('slug');
    expect(payload).not.toHaveProperty('name');
    expect(payload.color).toBe('#EF4444');
  });

  it('maps a 23505 unique-violation to the friendly duplicate-name error', async () => {
    const pgError = { code: '23505', message: 'duplicate key' };
    const handle = makeChain({ data: null, error: pgError });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await updateCategory('cat-custom-1', { name: 'Duplicado' });
    expect(result.data).toBeNull();
    expect((result.error as Error).message).toBe('Ya tenés una categoría con ese nombre.');
  });

  it('filters by id via eq()', async () => {
    const handle = makeChain({ data: VALID_CATEGORY_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await updateCategory('cat-custom-1', { icon: 'Gift' });

    const eqCall = handle.calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['id', 'cat-custom-1']);
  });
});

// ---------------------------------------------------------------------------
// deleteCategory
// ---------------------------------------------------------------------------

describe('deleteCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns { id } on success', async () => {
    const handle = makeChain({ data: null, error: null });
    // delete → eq → resolves (terminal)
    handle.chain.eq.mockImplementationOnce((...args: unknown[]) => {
      handle.calls.push({ method: 'eq', args });
      return Promise.resolve({ data: null, error: null });
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await deleteCategory('cat-custom-1');
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: 'cat-custom-1' });
  });

  it('returns { data: null, error } on DB error', async () => {
    const pgError = { code: '42501', message: 'permission denied' };
    const handle = makeChain({ data: null, error: pgError });
    handle.chain.eq.mockImplementationOnce((...args: unknown[]) => {
      handle.calls.push({ method: 'eq', args });
      return Promise.resolve({ data: null, error: pgError });
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await deleteCategory('cat-custom-1');
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('filters by id via eq()', async () => {
    const handle = makeChain({ data: null, error: null });
    handle.chain.eq.mockImplementationOnce((...args: unknown[]) => {
      handle.calls.push({ method: 'eq', args });
      return Promise.resolve({ data: null, error: null });
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await deleteCategory('cat-custom-1');
    const eqCall = handle.calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['id', 'cat-custom-1']);
  });
});
