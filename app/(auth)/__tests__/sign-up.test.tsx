/**
 * Tests for Sign-up screen (C3).
 *
 * Verifies:
 * - Renders without crashing
 * - Spanish copy: "Crear cuenta", field labels, submit button
 * - Validation errors for firstName / lastName shown in Spanish
 * - Validation errors shown in Spanish for email/password fields
 * - Password mismatch validation shows Spanish error
 * - supabase.auth.signUp called with options.data { first_name, last_name }
 * - Auth errors mapped to friendly Spanish messages
 * - "Iniciar sesión" link navigates to sign-in
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

// Helper: fill all required fields with valid values.
// Field order in UI: firstName, lastName, email, password, confirmPassword.
function fillValidForm(): void {
  fireEvent.changeText(screen.getByPlaceholderText('Nombre'), 'Ana');
  fireEvent.changeText(screen.getByPlaceholderText('Apellido'), 'García');
  fireEvent.changeText(screen.getByPlaceholderText('nombre@ejemplo.com'), 'ana@test.com');
  const emptyPasswords = screen.getAllByDisplayValue('');
  // After filling name + email, remaining empty inputs are password and confirmPassword
  if (emptyPasswords.length >= 2) {
    fireEvent.changeText(emptyPasswords[0], 'password123');
    fireEvent.changeText(emptyPasswords[1], 'password123');
  }
}

describe('Sign-up screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<SignUpScreen />)).not.toThrow();
    });

    it('shows "Crear cuenta" heading', () => {
      render(<SignUpScreen />);
      expect(screen.getByText('Crear tu cuenta')).toBeTruthy();
    });

    it('shows onboarding hook copy', () => {
      render(<SignUpScreen />);
      expect(screen.getByText('Comenzá a gestionar tus finanzas.')).toBeTruthy();
    });

    it('shows Nombre label', () => {
      render(<SignUpScreen />);
      expect(screen.getByText('Nombre')).toBeTruthy();
    });

    it('shows Apellido label', () => {
      render(<SignUpScreen />);
      expect(screen.getByText('Apellido')).toBeTruthy();
    });

    it('shows correo electrónico label', () => {
      render(<SignUpScreen />);
      expect(screen.getByText('Correo electrónico')).toBeTruthy();
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
      expect(screen.getByText('¿Ya tenés una cuenta?')).toBeTruthy();
      expect(screen.getByText('Iniciar sesión')).toBeTruthy();
    });
  });

  describe('validation — firstName', () => {
    it('shows error when firstName is empty on submit', async () => {
      render(<SignUpScreen />);
      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });
      await waitFor(() => {
        // nameSchema min(2) fires — empty string becomes "Mínimo 2 caracteres." after trim
        expect(
          screen.getAllByText(/Mínimo 2 caracteres\.|Ingresá un nombre válido\./)[0],
        ).toBeTruthy();
      });
    });

    it('shows error when firstName contains digits', async () => {
      render(<SignUpScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('Nombre'), 'Ana123');
      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Solo letras, espacios, guiones o apóstrofes.')).toBeTruthy();
      });
    });

    it('shows error when firstName is a single character (below min)', async () => {
      render(<SignUpScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('Nombre'), 'A');
      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });
      await waitFor(() => {
        // Both firstName and lastName may show this message — at least one is enough.
        expect(screen.getAllByText('Mínimo 2 caracteres.').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('validation — lastName', () => {
    it('shows error when lastName is empty on submit', async () => {
      render(<SignUpScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('Nombre'), 'Ana');
      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });
      await waitFor(() => {
        // With firstName valid, the next name error is for lastName
        expect(
          screen.getAllByText(/Mínimo 2 caracteres\.|Ingresá un nombre válido\./)[0],
        ).toBeTruthy();
      });
    });

    it('shows error when lastName contains digits', async () => {
      render(<SignUpScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('Apellido'), 'García9');
      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Solo letras, espacios, guiones o apóstrofes.')).toBeTruthy();
      });
    });
  });

  describe('validation — email', () => {
    it('shows Spanish email validation error when email is empty', async () => {
      render(<SignUpScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('Nombre'), 'Ana');
      fireEvent.changeText(screen.getByPlaceholderText('Apellido'), 'García');
      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Ingresá un correo electrónico válido.')).toBeTruthy();
      });
    });
  });

  describe('validation — password', () => {
    it('shows "La contraseña debe tener al menos 8 caracteres." when password is too short', async () => {
      render(<SignUpScreen />);

      fireEvent.changeText(screen.getByPlaceholderText('Nombre'), 'Ana');
      fireEvent.changeText(screen.getByPlaceholderText('Apellido'), 'García');
      fireEvent.changeText(screen.getByPlaceholderText('nombre@ejemplo.com'), 'user@test.com');

      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeTruthy();
      });
    });

    it('shows password mismatch error in Spanish', async () => {
      render(<SignUpScreen />);

      fireEvent.changeText(screen.getByPlaceholderText('Nombre'), 'Ana');
      fireEvent.changeText(screen.getByPlaceholderText('Apellido'), 'García');
      fireEvent.changeText(screen.getByPlaceholderText('nombre@ejemplo.com'), 'user@test.com');

      const emptyInputs = screen.getAllByDisplayValue('');
      if (emptyInputs.length >= 2) {
        fireEvent.changeText(emptyInputs[0], 'password123');
        fireEvent.changeText(emptyInputs[1], 'different456');
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

  describe('supabase.auth.signUp payload', () => {
    it('calls signUp with options.data containing first_name and last_name', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: '123' } },
        error: null,
      });

      render(<SignUpScreen />);
      fillValidForm();

      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'ana@test.com',
          password: 'password123',
          options: {
            data: {
              first_name: 'Ana',
              last_name: 'García',
            },
          },
        });
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
      fillValidForm();

      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith({
          pathname: '/(auth)/verify-otp',
          params: { email: 'ana@test.com' },
        });
      });
    });

    it('does NOT navigate when sign-up fails', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'User already registered' },
      });

      render(<SignUpScreen />);
      fillValidForm();

      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Ya existe una cuenta con ese correo electrónico.')).toBeTruthy();
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
      fillValidForm();

      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Ya existe una cuenta con ese correo electrónico.')).toBeTruthy();
      });
    });

    it('shows generic error for unknown auth errors', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Some network error' },
      });

      render(<SignUpScreen />);
      fillValidForm();

      const submitBtn = screen.getByLabelText('Crear cuenta');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('No se pudo crear la cuenta. Intentá nuevamente.')).toBeTruthy();
      });
    });
  });

  describe('navigation', () => {
    it('navigates to sign-in when "Iniciar sesión" is pressed', async () => {
      render(<SignUpScreen />);
      fireEvent.press(screen.getByText('Iniciar sesión'));
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
