/**
 * Tests for Sign-up screen (C3).
 *
 * Verifies:
 * - Renders without crashing
 * - Spanish copy: "Creá tu cuenta", field labels, submit button
 * - Validation errors shown in Spanish when submit pressed with empty/invalid fields
 * - Password mismatch validation shows Spanish error
 * - Email sent state shows "Revisá tu mail" with back button
 * - Auth errors mapped to friendly Spanish messages
 * - "Iniciá sesión" link navigates to sign-in
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import SignUpScreen from '../sign-up';

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

describe('Sign-up screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<SignUpScreen />)).not.toThrow();
    });

    it('shows "Creá tu cuenta" heading', () => {
      render(<SignUpScreen />);
      expect(screen.getByText('Creá tu cuenta')).toBeTruthy();
    });

    it('shows onboarding hook copy', () => {
      render(<SignUpScreen />);
      expect(screen.getByText('Empezá a controlar tu plata.')).toBeTruthy();
    });

    it('shows Email label', () => {
      render(<SignUpScreen />);
      expect(screen.getByText('Email')).toBeTruthy();
    });

    it('shows Contraseña label', () => {
      render(<SignUpScreen />);
      expect(screen.getByText('Contraseña')).toBeTruthy();
    });

    it('shows Confirmar contraseña label', () => {
      render(<SignUpScreen />);
      expect(screen.getByText('Confirmar contraseña')).toBeTruthy();
    });

    it('shows submit button "Crear cuenta"', () => {
      render(<SignUpScreen />);
      expect(screen.getByText('Crear cuenta')).toBeTruthy();
    });

    it('shows sign-in link copy', () => {
      render(<SignUpScreen />);
      expect(screen.getByText('¿Ya tenés cuenta?')).toBeTruthy();
      expect(screen.getByText('Iniciá sesión')).toBeTruthy();
    });
  });

  describe('validation', () => {
    it('shows Spanish email validation error when email is empty', async () => {
      render(<SignUpScreen />);
      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Ingresá un email válido.')).toBeTruthy();
      });
    });

    it('shows "Mínimo 8 caracteres." when password is too short', async () => {
      render(<SignUpScreen />);

      fireEvent.changeText(screen.getByPlaceholderText('vos@ejemplo.com'), 'user@test.com');

      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Mínimo 8 caracteres.')).toBeTruthy();
      });
    });

    it('shows password mismatch error in Spanish', async () => {
      render(<SignUpScreen />);

      fireEvent.changeText(screen.getByPlaceholderText('vos@ejemplo.com'), 'user@test.com');

      // Set password and confirmPassword with different values using display value queries
      const emptyInputs = screen.getAllByDisplayValue('');
      // inputs: email (filled), password (index 1 in empty list), confirmPassword (index 2)
      if (emptyInputs.length >= 2) {
        fireEvent.changeText(emptyInputs[0], 'password123');
        if (emptyInputs.length >= 2) {
          fireEvent.changeText(emptyInputs[1], 'different456');
        }
      }

      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Las contraseñas no coinciden.')).toBeTruthy();
      });
    });
  });

  describe('OTP redirect on success', () => {
    it('navigates to /verify-otp with email param after successful sign-up', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: '123' } },
        error: null,
      });

      render(<SignUpScreen />);

      fireEvent.changeText(screen.getByPlaceholderText('vos@ejemplo.com'), 'user@test.com');
      const emptyInputs = screen.getAllByDisplayValue('');
      if (emptyInputs.length >= 2) {
        fireEvent.changeText(emptyInputs[0], 'password123');
        fireEvent.changeText(emptyInputs[1], 'password123');
      }

      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith({
          pathname: '/(auth)/verify-otp',
          params: { email: 'user@test.com' },
        });
      });
    });

    it('does NOT navigate when sign-up fails', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'User already registered' },
      });

      render(<SignUpScreen />);

      fireEvent.changeText(screen.getByPlaceholderText('vos@ejemplo.com'), 'dup@test.com');
      const emptyInputs = screen.getAllByDisplayValue('');
      if (emptyInputs.length >= 2) {
        fireEvent.changeText(emptyInputs[0], 'password123');
        fireEvent.changeText(emptyInputs[1], 'password123');
      }

      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Ya hay una cuenta con ese email.')).toBeTruthy();
      });
      expect(router.push).not.toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(auth)/verify-otp' }),
      );
    });
  });

  describe('auth error mapping', () => {
    it('shows friendly error for already-registered email', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'User already registered' },
      });

      render(<SignUpScreen />);

      fireEvent.changeText(screen.getByPlaceholderText('vos@ejemplo.com'), 'user@test.com');
      const emptyInputs = screen.getAllByDisplayValue('');
      if (emptyInputs.length >= 2) {
        fireEvent.changeText(emptyInputs[0], 'password123');
        fireEvent.changeText(emptyInputs[1], 'password123');
      }

      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Ya hay una cuenta con ese email.')).toBeTruthy();
      });
    });

    it('shows generic error for unknown auth errors', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Some network error' },
      });

      render(<SignUpScreen />);

      fireEvent.changeText(screen.getByPlaceholderText('vos@ejemplo.com'), 'user@test.com');
      const emptyInputs = screen.getAllByDisplayValue('');
      if (emptyInputs.length >= 2) {
        fireEvent.changeText(emptyInputs[0], 'password123');
        fireEvent.changeText(emptyInputs[1], 'password123');
      }

      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('No pudimos crear la cuenta. Probá de nuevo.')).toBeTruthy();
      });
    });
  });

  describe('navigation', () => {
    it('navigates to sign-in when "Iniciá sesión" is pressed', async () => {
      render(<SignUpScreen />);
      fireEvent.press(screen.getByText('Iniciá sesión'));
      expect(router.push).toHaveBeenCalledWith('/(auth)/sign-in');
    });
  });

  describe('submit button', () => {
    it('submit button has correct accessibility label', () => {
      render(<SignUpScreen />);
      expect(screen.getByLabelText('Crear cuenta')).toBeTruthy();
    });
  });
});
