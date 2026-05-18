import type { User } from '@supabase/supabase-js';

import { hasCompletedProfile } from '../completion';

/** Minimal User-shaped fixture — only the fields hasCompletedProfile reads. */
function makeUser(metadata: Record<string, unknown>): User {
  return {
    id: 'test-id',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: metadata,
    created_at: '2026-01-01T00:00:00Z',
  } as unknown as User;
}

describe('hasCompletedProfile', () => {
  it('returns false for null user', () => {
    expect(hasCompletedProfile(null)).toBe(false);
  });

  it('returns false for undefined user', () => {
    expect(hasCompletedProfile(undefined)).toBe(false);
  });

  it('returns false when user has no metadata', () => {
    const user = makeUser({});
    expect(hasCompletedProfile(user)).toBe(false);
  });

  it('returns false when user has only first_name', () => {
    const user = makeUser({ first_name: 'Facundo' });
    expect(hasCompletedProfile(user)).toBe(false);
  });

  it('returns false when user has only last_name', () => {
    const user = makeUser({ last_name: 'Martinez' });
    expect(hasCompletedProfile(user)).toBe(false);
  });

  it('returns false when both values are empty strings', () => {
    const user = makeUser({ first_name: '', last_name: '' });
    expect(hasCompletedProfile(user)).toBe(false);
  });

  it('returns false when both values are whitespace-only', () => {
    const user = makeUser({ first_name: '   ', last_name: '   ' });
    expect(hasCompletedProfile(user)).toBe(false);
  });

  it('returns true when both first_name and last_name are real values', () => {
    const user = makeUser({ first_name: 'Facundo', last_name: 'Martinez' });
    expect(hasCompletedProfile(user)).toBe(true);
  });

  it('returns false when first_name is a number (non-string type)', () => {
    const user = makeUser({ first_name: 123, last_name: 'Martinez' });
    expect(hasCompletedProfile(user)).toBe(false);
  });

  it('returns false when last_name is null (non-string type)', () => {
    const user = makeUser({ first_name: 'Facundo', last_name: null });
    expect(hasCompletedProfile(user)).toBe(false);
  });

  it('returns false when both values are non-string types', () => {
    const user = makeUser({ first_name: 42, last_name: true });
    expect(hasCompletedProfile(user)).toBe(false);
  });
});
