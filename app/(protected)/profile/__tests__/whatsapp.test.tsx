/**
 * Tests for the Vincular WhatsApp screen (HU-26).
 *
 * Covers:
 *   - not-linked: renders "Generar código"; pressing it calls createLinkCode
 *     and renders the returned code + instructions.
 *   - linked: renders the masked number + "Desvincular"; pressing it shows
 *     confirmation, then confirms the unlink call.
 *   - error path: mutation error shows an error message.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { router } from 'expo-router';

import WhatsappScreen from '../whatsapp';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('@/hooks/use-session', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/hooks/use-whatsapp-link', () => ({
  useWhatsappLink: jest.fn(),
  useCreateLinkCode: jest.fn(),
  useUnlinkWhatsapp: jest.fn(),
  whatsappKeys: {
    all: ['whatsapp'],
    link: (id: string) => ['whatsapp', 'link', id],
  },
}));

const { useSession } = require('@/hooks/use-session') as { useSession: jest.Mock };
const { useWhatsappLink, useCreateLinkCode, useUnlinkWhatsapp } =
  require('@/hooks/use-whatsapp-link') as {
    useWhatsappLink: jest.Mock;
    useCreateLinkCode: jest.Mock;
    useUnlinkWhatsapp: jest.Mock;
  };

const MOCK_USER = {
  id: 'user-1',
  email: 'facundo@example.com',
  user_metadata: { first_name: 'Facundo', last_name: 'Martinez' },
};

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe('WhatsappScreen — not linked', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSession.mockReturnValue({ user: MOCK_USER, session: {}, isLoading: false });
    useWhatsappLink.mockReturnValue({ data: null, isLoading: false });
    useUnlinkWhatsapp.mockReturnValue({ mutate: jest.fn(), isPending: false, error: null });
  });

  it('renders "Generar código" button when not linked', () => {
    useCreateLinkCode.mockReturnValue({
      mutate: jest.fn(),
      data: undefined,
      isPending: false,
      error: null,
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <WhatsappScreen />
      </Wrapper>,
    );

    expect(screen.getByText('Generar código')).toBeTruthy();
  });

  it('calls generateCode mutate when "Generar código" is pressed', async () => {
    const mutateMock = jest.fn();
    useCreateLinkCode.mockReturnValue({
      mutate: mutateMock,
      data: undefined,
      isPending: false,
      error: null,
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <WhatsappScreen />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Generar código de vinculación'));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledTimes(1);
    });
  });

  it('displays the generated code and instructions after success', () => {
    useCreateLinkCode.mockReturnValue({
      mutate: jest.fn(),
      data: { code: 'ABC123', expiresAt: '2026-06-21T12:10:00Z' },
      isPending: false,
      error: null,
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <WhatsappScreen />
      </Wrapper>,
    );

    expect(screen.getByTestId('link-code')).toBeTruthy();
    expect(screen.getByText('ABC123')).toBeTruthy();
    expect(screen.getByText('Vence en 10 minutos')).toBeTruthy();
    expect(screen.getByTestId('instructions')).toBeTruthy();
    expect(screen.getByText(/join/i)).toBeTruthy();
  });

  it('shows error message when createLinkCode fails', () => {
    useCreateLinkCode.mockReturnValue({
      mutate: jest.fn(),
      data: undefined,
      isPending: false,
      error: new Error('Error de red'),
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <WhatsappScreen />
      </Wrapper>,
    );

    expect(screen.getByTestId('gen-error')).toBeTruthy();
    expect(screen.getByText('Error de red')).toBeTruthy();
  });

  it('shows back chevron and navigates back', () => {
    useCreateLinkCode.mockReturnValue({
      mutate: jest.fn(),
      data: undefined,
      isPending: false,
      error: null,
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <WhatsappScreen />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Volver'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});

describe('WhatsappScreen — linked', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSession.mockReturnValue({ user: MOCK_USER, session: {}, isLoading: false });
    useWhatsappLink.mockReturnValue({
      data: { waNumber: '+5491122334455', status: 'linked' },
      isLoading: false,
    });
    useCreateLinkCode.mockReturnValue({
      mutate: jest.fn(),
      data: undefined,
      isPending: false,
      error: null,
    });
  });

  it('renders the linked number (masked) and "Desvincular" button', () => {
    useUnlinkWhatsapp.mockReturnValue({ mutate: jest.fn(), isPending: false, error: null });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <WhatsappScreen />
      </Wrapper>,
    );

    expect(screen.getByTestId('linked-number')).toBeTruthy();
    expect(screen.getByLabelText('Desvincular WhatsApp')).toBeTruthy();
  });

  it('pressing "Desvincular" shows confirmation before calling mutate', async () => {
    const mutateMock = jest.fn();
    useUnlinkWhatsapp.mockReturnValue({ mutate: mutateMock, isPending: false, error: null });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <WhatsappScreen />
      </Wrapper>,
    );

    // First press shows confirmation
    fireEvent.press(screen.getByLabelText('Desvincular WhatsApp'));

    await waitFor(() => {
      expect(screen.getByLabelText('Confirmar desvinculación')).toBeTruthy();
    });

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('pressing confirm unlink calls unlinkWhatsapp mutate', async () => {
    const mutateMock = jest.fn();
    useUnlinkWhatsapp.mockReturnValue({ mutate: mutateMock, isPending: false, error: null });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <WhatsappScreen />
      </Wrapper>,
    );

    // First press = show confirm
    fireEvent.press(screen.getByLabelText('Desvincular WhatsApp'));
    await waitFor(() => expect(screen.getByLabelText('Confirmar desvinculación')).toBeTruthy());

    // Second press = confirm
    fireEvent.press(screen.getByLabelText('Confirmar desvinculación'));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledTimes(1);
    });
  });

  it('cancel unlink restores the initial unlink button', async () => {
    useUnlinkWhatsapp.mockReturnValue({ mutate: jest.fn(), isPending: false, error: null });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <WhatsappScreen />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Desvincular WhatsApp'));
    await waitFor(() => expect(screen.getByLabelText('Cancelar desvinculación')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Cancelar desvinculación'));
    await waitFor(() => expect(screen.getByLabelText('Desvincular WhatsApp')).toBeTruthy());
  });

  it('shows error message when unlinkWhatsapp fails', () => {
    useUnlinkWhatsapp.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
      error: new Error('Sin conexión'),
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <WhatsappScreen />
      </Wrapper>,
    );

    expect(screen.getByText('Sin conexión')).toBeTruthy();
  });
});

describe('WhatsappScreen — loading state', () => {
  it('renders loading text while link status is loading', () => {
    useSession.mockReturnValue({ user: MOCK_USER, session: {}, isLoading: false });
    useWhatsappLink.mockReturnValue({ data: null, isLoading: true });
    useCreateLinkCode.mockReturnValue({
      mutate: jest.fn(),
      data: undefined,
      isPending: false,
      error: null,
    });
    useUnlinkWhatsapp.mockReturnValue({ mutate: jest.fn(), isPending: false, error: null });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <WhatsappScreen />
      </Wrapper>,
    );

    expect(screen.getByText('Cargando…')).toBeTruthy();
  });
});
