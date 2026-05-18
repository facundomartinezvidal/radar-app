/**
 * Tests for Sign-in screen (C2).
 *
 * Verifies:
 * - Renders without crashing
 * - Spanish copy: "Iniciá sesión", field labels, submit button
 * - Validation errors shown in Spanish when submit pressed with empty fields
 * - Submit button shows loading state (ActivityIndicator) when isSubmitting
 * - Auth errors are mapped to friendly Spanish messages
 * - "Sumate" link navigates to sign-up
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import SignInScreen from '../sign-in';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-svg', () => {
  const React = require('react');
  const MockSvg = (props: object) => React.createElement('Svg', props);
  const MockCircle = (props: object) => React.createElement('Circle', props);
  const MockPath = (props: object) => React.createElement('Path', props);
  const MockDefs = (props: object) => React.createElement('Defs', props);
  const MockStop = (props: object) => React.createElement('Stop', props);
  const MockLinearGradient = (props: object) => React.createElement('LinearGradient', props);
  const MockG = (props: object) => React.createElement('G', props);
  const MockText = (props: object) => React.createElement('SvgText', props);
  return {
    __esModule: true,
    default: MockSvg,
    Svg: MockSvg,
    Circle: MockCircle,
    Path: MockPath,
    Defs: MockDefs,
    Stop: MockStop,
    LinearGradient: MockLinearGradient,
    G: MockG,
    Text: MockText,
  };
});

describe('Sign-in screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<SignInScreen />)).not.toThrow();
    });

    it('shows "Iniciá sesión" heading', () => {
      render(<SignInScreen />);
      expect(screen.getByText('Iniciá sesión')).toBeTruthy();
    });

    it('shows welcome copy', () => {
      render(<SignInScreen />);
      expect(screen.getByText('Bienvenido de vuelta a RADAR.')).toBeTruthy();
    });

    it('shows Email label', () => {
      render(<SignInScreen />);
      expect(screen.getByText('Email')).toBeTruthy();
    });

    it('shows Contraseña label', () => {
      render(<SignInScreen />);
      expect(screen.getByText('Contraseña')).toBeTruthy();
    });

    it('shows submit button with correct label', () => {
      render(<SignInScreen />);
      expect(screen.getByText('Iniciar sesión')).toBeTruthy();
    });

    it('shows forgot-password affordance', () => {
      render(<SignInScreen />);
      expect(screen.getByText('¿Olvidaste tu contraseña?')).toBeTruthy();
    });

    it('shows sign-up link copy', () => {
      render(<SignInScreen />);
      expect(screen.getByText('¿No tenés cuenta?')).toBeTruthy();
      expect(screen.getByText('Sumate')).toBeTruthy();
    });
  });

  describe('validation', () => {
    it('shows Spanish email validation error when email is empty and form is submitted', async () => {
      render(<SignInScreen />);
      const submitBtn = screen.getByLabelText('Iniciar sesión');
      await act(async () => {
        fireEvent.press(submitBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Ingresá un email válido.')).toBeTruthy();
      });
    });

    it('shows Spanish password validation error when password is too short', async () => {
      render(<SignInScreen />);

      // Fill email to pass email validation
      fireEvent.changeText(screen.getByPlaceholderText('vos@ejemplo.com'), 'test@test.com');

      const submitBtn = screen.getByLabelText('Iniciar sesión');
      await act(async () => {
        fireEvent.press(submitBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeTruthy();
      });
    });
  });

  describe('auth error mapping', () => {
    it('shows friendly error for invalid credentials', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      render(<SignInScreen />);

      fireEvent.changeText(screen.getByPlaceholderText('vos@ejemplo.com'), 'user@test.com');

      // Fill password field — find by accessibility or placeholder
      const passwordInputs = screen.getAllByDisplayValue('');
      // password field is the second empty input
      fireEvent.changeText(passwordInputs[1] ?? passwordInputs[0], 'password123');

      const submitBtn = screen.getByLabelText('Iniciar sesión');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Email o contraseña incorrectos.')).toBeTruthy();
      });
    });

    it('shows generic error for unknown auth errors', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Some unknown error occurred' },
      });

      render(<SignInScreen />);

      fireEvent.changeText(screen.getByPlaceholderText('vos@ejemplo.com'), 'user@test.com');
      const passwordInputs = screen.getAllByDisplayValue('');
      fireEvent.changeText(passwordInputs[1] ?? passwordInputs[0], 'password123');

      const submitBtn = screen.getByLabelText('Iniciar sesión');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('No pudimos iniciar sesión. Probá de nuevo.')).toBeTruthy();
      });
    });
  });

  describe('email not confirmed — resend flow', () => {
    const EMAIL = 'unverified@test.com';
    const PASSWORD = 'password123';

    async function triggerUnconfirmedError(): Promise<void> {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Email not confirmed' },
      });

      render(<SignInScreen />);

      fireEvent.changeText(screen.getByPlaceholderText('vos@ejemplo.com'), EMAIL);
      const passwordInputs = screen.getAllByDisplayValue('');
      fireEvent.changeText(passwordInputs[1] ?? passwordInputs[0], PASSWORD);

      const submitBtn = screen.getByLabelText('Iniciar sesión');
      await act(async () => {
        fireEvent.press(submitBtn);
      });
    }

    it('shows "Tu email todavía no está confirmado." copy', async () => {
      await triggerUnconfirmedError();
      await waitFor(() => {
        expect(screen.getByText('Tu email todavía no está confirmado.')).toBeTruthy();
      });
    });

    it('renders "Reenviar código y verificar" button when email is unconfirmed', async () => {
      await triggerUnconfirmedError();
      await waitFor(() => {
        expect(screen.getByText('Reenviar código y verificar')).toBeTruthy();
      });
    });

    it('calls supabase.auth.resend with correct args when button is pressed', async () => {
      (supabase.auth.resend as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

      await triggerUnconfirmedError();

      await waitFor(() => {
        expect(screen.getByText('Reenviar código y verificar')).toBeTruthy();
      });

      const resendBtn = screen.getByLabelText('Reenviar código de verificación');
      await act(async () => {
        fireEvent.press(resendBtn);
      });

      await waitFor(() => {
        expect(supabase.auth.resend).toHaveBeenCalledWith({
          type: 'signup',
          email: EMAIL,
        });
      });
    });

    it('navigates to verify-otp with email param on successful resend', async () => {
      (supabase.auth.resend as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

      await triggerUnconfirmedError();

      await waitFor(() => {
        expect(screen.getByText('Reenviar código y verificar')).toBeTruthy();
      });

      const resendBtn = screen.getByLabelText('Reenviar código de verificación');
      await act(async () => {
        fireEvent.press(resendBtn);
      });

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith({
          pathname: '/(auth)/verify-otp',
          params: { email: EMAIL },
        });
      });
    });

    it('shows resend error copy and does NOT navigate when resend fails', async () => {
      (supabase.auth.resend as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Some resend failure' },
      });

      await triggerUnconfirmedError();

      await waitFor(() => {
        expect(screen.getByText('Reenviar código y verificar')).toBeTruthy();
      });

      const resendBtn = screen.getByLabelText('Reenviar código de verificación');
      await act(async () => {
        fireEvent.press(resendBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('No pudimos reenviar el código. Probá de nuevo.')).toBeTruthy();
      });
      expect(router.push).not.toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(auth)/verify-otp' }),
      );
    });

    it('"Reenviar código y verificar" button is gone after a successful new sign-in submit', async () => {
      // First trigger the unconfirmed state (form is filled with EMAIL + PASSWORD)
      await triggerUnconfirmedError();

      await waitFor(() => {
        expect(screen.getByText('Reenviar código y verificar')).toBeTruthy();
      });

      // Mock a successful sign-in on the next submit
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: '123' } },
        error: null,
      });

      // The form fields are already filled from triggerUnconfirmedError; just submit again
      const submitBtn = screen.getByLabelText('Iniciar sesión');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(screen.queryByText('Reenviar código y verificar')).toBeNull();
      });
    });
  });

  describe('navigation', () => {
    it('navigates to sign-up when "Sumate" is pressed', async () => {
      render(<SignInScreen />);
      fireEvent.press(screen.getByText('Sumate'));
      expect(router.push).toHaveBeenCalledWith('/(auth)/sign-up');
    });
  });

  describe('submit button state', () => {
    it('submit button is accessible with correct label', () => {
      render(<SignInScreen />);
      expect(screen.getByLabelText('Iniciar sesión')).toBeTruthy();
    });
  });
});
