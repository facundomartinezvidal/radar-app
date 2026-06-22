/**
 * TanStack Query hooks for WhatsApp linking.
 *
 * - useWhatsappLink   → current link status for the authenticated user
 * - useCreateLinkCode → mutation to generate a one-time link code
 * - useUnlinkWhatsapp → mutation to unlink the number (invalidates status)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type LinkCode,
  type WhatsappLinkRow,
  createLinkCode,
  getWhatsappLink,
  unlinkWhatsapp,
} from '@/lib/repositories/whatsapp';
import { useSession } from '@/hooks/use-session';

export type { LinkCode, WhatsappLinkRow };

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const whatsappKeys = {
  all: ['whatsapp'] as const,
  link: (userId: string) => [...whatsappKeys.all, 'link', userId] as const,
};

// ---------------------------------------------------------------------------
// useWhatsappLink — read
// ---------------------------------------------------------------------------

/**
 * Returns the current WhatsApp link status for the authenticated user.
 * `data` is `null` when not linked.
 */
export function useWhatsappLink() {
  const { user } = useSession();
  const userId = user?.id ?? '';

  return useQuery<WhatsappLinkRow | null>({
    queryKey: whatsappKeys.link(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      return getWhatsappLink(userId);
    },
  });
}

// ---------------------------------------------------------------------------
// useCreateLinkCode — mutation
// ---------------------------------------------------------------------------

/**
 * Mutation to generate a one-time WhatsApp link code.
 * On success invalidates the link status query so the UI refreshes.
 */
export function useCreateLinkCode() {
  const qc = useQueryClient();
  const { user } = useSession();
  const userId = user?.id ?? '';

  return useMutation<LinkCode, Error, void>({
    mutationFn: async () => {
      return createLinkCode();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: whatsappKeys.link(userId) });
    },
  });
}

// ---------------------------------------------------------------------------
// useUnlinkWhatsapp — mutation
// ---------------------------------------------------------------------------

/**
 * Mutation to unlink the authenticated user's WhatsApp number.
 * On success invalidates the link status query.
 */
export function useUnlinkWhatsapp() {
  const qc = useQueryClient();
  const { user } = useSession();
  const userId = user?.id ?? '';

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      return unlinkWhatsapp(userId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: whatsappKeys.link(userId) });
    },
  });
}
