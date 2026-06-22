/**
 * Tests for use-whatsapp-link hooks.
 *
 * Verifies query/mutation wiring + cache invalidation. We mock the
 * repository to avoid touching supabase-js internals here — those are
 * covered by the repo's own tests.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as repo from '@/lib/repositories/whatsapp';
import { useWhatsappLink, useCreateLinkCode, useUnlinkWhatsapp } from '../use-whatsapp-link';

jest.mock('@/lib/repositories/whatsapp');
jest.mock('@/hooks/use-session', () => ({
  useSession: jest.fn(),
}));

const mocked = repo as jest.Mocked<typeof repo>;
const { useSession } = require('@/hooks/use-session') as { useSession: jest.Mock };

const MOCK_USER = { id: 'user-1', email: 'test@example.com', user_metadata: {} };

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, client };
}

describe('use-whatsapp-link hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSession.mockReturnValue({ user: MOCK_USER, session: {}, isLoading: false });
  });

  // -------------------------------------------------------------------------
  // useWhatsappLink — query
  // -------------------------------------------------------------------------

  describe('useWhatsappLink', () => {
    it('returns null when user has no linked number', async () => {
      mocked.getWhatsappLink.mockResolvedValueOnce(null);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useWhatsappLink(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
      expect(mocked.getWhatsappLink).toHaveBeenCalledWith('user-1');
    });

    it('returns the linked row when number is linked', async () => {
      const linked = { waNumber: '+5491122334455', status: 'linked' };
      mocked.getWhatsappLink.mockResolvedValueOnce(linked);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useWhatsappLink(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(linked);
    });

    it('is disabled when userId is empty', async () => {
      useSession.mockReturnValue({ user: null, session: null, isLoading: false });

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useWhatsappLink(), { wrapper });

      // Should never call getWhatsappLink with empty string
      await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
      expect(mocked.getWhatsappLink).not.toHaveBeenCalled();
    });

    it('sets isError when getWhatsappLink throws', async () => {
      mocked.getWhatsappLink.mockRejectedValueOnce(new Error('Network error'));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useWhatsappLink(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // -------------------------------------------------------------------------
  // useCreateLinkCode — mutation
  // -------------------------------------------------------------------------

  describe('useCreateLinkCode', () => {
    it('calls createLinkCode and returns the code', async () => {
      const linkCode = { code: 'ABC123', expiresAt: '2026-06-21T12:10:00Z' };
      mocked.createLinkCode.mockResolvedValueOnce(linkCode);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useCreateLinkCode(), { wrapper });

      await act(async () => {
        result.current.mutate();
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(linkCode);
      expect(mocked.createLinkCode).toHaveBeenCalledTimes(1);
    });

    it('sets isError when createLinkCode throws', async () => {
      mocked.createLinkCode.mockRejectedValueOnce(new Error('RPC error'));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useCreateLinkCode(), { wrapper });

      await act(async () => {
        result.current.mutate();
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('invalidates whatsapp link query on success', async () => {
      const linkCode = { code: 'DEF456', expiresAt: '2026-06-21T12:10:00Z' };
      mocked.createLinkCode.mockResolvedValueOnce(linkCode);
      // Provide a result for the refetch triggered by invalidation
      mocked.getWhatsappLink.mockResolvedValue(null);

      const { wrapper, client } = makeWrapper();
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useCreateLinkCode(), { wrapper });

      await act(async () => {
        result.current.mutate();
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: expect.arrayContaining(['whatsapp']) }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // useUnlinkWhatsapp — mutation
  // -------------------------------------------------------------------------

  describe('useUnlinkWhatsapp', () => {
    it('calls unlinkWhatsapp with the current userId', async () => {
      mocked.unlinkWhatsapp.mockResolvedValueOnce(undefined);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useUnlinkWhatsapp(), { wrapper });

      await act(async () => {
        result.current.mutate();
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mocked.unlinkWhatsapp).toHaveBeenCalledWith('user-1');
    });

    it('sets isError when unlinkWhatsapp throws', async () => {
      mocked.unlinkWhatsapp.mockRejectedValueOnce(new Error('DB error'));

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useUnlinkWhatsapp(), { wrapper });

      await act(async () => {
        result.current.mutate();
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('invalidates whatsapp link query on success', async () => {
      mocked.unlinkWhatsapp.mockResolvedValueOnce(undefined);
      mocked.getWhatsappLink.mockResolvedValue(null);

      const { wrapper, client } = makeWrapper();
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useUnlinkWhatsapp(), { wrapper });

      await act(async () => {
        result.current.mutate();
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: expect.arrayContaining(['whatsapp']) }),
      );
    });
  });
});
