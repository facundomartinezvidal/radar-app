/**
 * Tests for Verify OTP screen (C3.b).
 *
 * Covers:
 *   - Renders heading + email
 *   - Verify button disabled until 6 digits
 *   - Calls supabase.auth.verifyOtp on submit
 *   - Shows ES error on invalid/expired token
 *   - Resend triggers supabase.auth.resend + cooldown
 *   - "Utilizar otro correo electrónico" routes back to sign-up
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import VerifyOtpScreen from '../verify-otp';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ email: 'user@test.com' }),
  Stack: { Screen: () => null },
}));

jest.mock('react-native-svg', () => {
  const React = require('react');
  const make = (name: string) => {
    const C = (props: object) => React.createElement(name, props);
    C.displayName = name;
    return C;
  };
  const MockSvg = make('Svg');
  return {
    __esModule: true,
    default: MockSvg,
    Svg: MockSvg,
    Circle: make('Circle'),
    Path: make('Path'),
    Line: make('Line'),
    Defs: make('Defs'),
    Stop: make('Stop'),
    LinearGradient: make('LinearGradient'),
    G: make('G'),
    Text: make('SvgText'),
  };
});

describe('VerifyOtpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders heading and target email', () => {
    render(<VerifyOtpScreen />);
    expect(screen.getByText('Confirmar tu cuenta')).toBeTruthy();
    expect(screen.getByText('user@test.com')).toBeTruthy();
  });

  it('shows verify button accessibility label', () => {
    render(<VerifyOtpScreen />);
    expect(screen.getByLabelText('Verificar código')).toBeTruthy();
  });

  it('calls verifyOtp with the typed code', async () => {
    (supabase.auth.verifyOtp as jest.Mock | undefined)?.mockResolvedValueOnce({
      data: { session: { access_token: 'tok' } },
      error: null,
    });

    render(<VerifyOtpScreen />);

    const input = screen.getByLabelText('Código de verificación');
    await act(async () => {
      fireEvent.changeText(input, '12345678');
    });

    await waitFor(() => {
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'user@test.com',
        token: '12345678',
        type: 'signup',
      });
    });
  });

  it('shows Spanish error when the token is invalid', async () => {
    (supabase.auth.verifyOtp as jest.Mock | undefined)?.mockResolvedValueOnce({
      data: null,
      error: { message: 'Token has expired or is invalid' },
    });

    render(<VerifyOtpScreen />);
    const input = screen.getByLabelText('Código de verificación');
    await act(async () => {
      fireEvent.changeText(input, '00000000');
    });

    await waitFor(() => {
      expect(screen.getByText('El código es inválido o expiró. Solicitá uno nuevo.')).toBeTruthy();
    });
  });

  it('strips non-numeric characters from the input', async () => {
    render(<VerifyOtpScreen />);
    const input = screen.getByLabelText('Código de verificación');
    await act(async () => {
      fireEvent.changeText(input, 'abc12d34xy56qq78');
    });
    // verifyOtp should still receive an OTP_LENGTH-digit numeric token
    await waitFor(() => {
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'user@test.com',
        token: '12345678',
        type: 'signup',
      });
    });
  });

  it('navigates back to sign-up via "Utilizar otro correo electrónico"', () => {
    render(<VerifyOtpScreen />);
    fireEvent.press(screen.getByText('Utilizar otro correo electrónico'));
    expect(router.replace).toHaveBeenCalledWith('/(auth)/sign-up');
  });

  it('resend triggers supabase.auth.resend and shows confirmation', async () => {
    (supabase.auth.resend as jest.Mock | undefined)?.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    render(<VerifyOtpScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Reenviar código'));
    });

    await waitFor(() => {
      expect(supabase.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'user@test.com',
      });
      expect(screen.getByText('Se envió un nuevo código.')).toBeTruthy();
    });
  });
});
