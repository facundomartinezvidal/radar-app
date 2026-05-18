/**
 * Tests for the profile-setup screen (Onboarding).
 *
 * Verifies:
 * - Renders Spanish copy correctly
 * - Validation blocks submit when firstName or lastName is empty / invalid
 * - supabase.auth.updateUser called with exact payload { data: { first_name, last_name } }
 * - Error copy renders when Supabase returns an error
 * - No router.push is called on success (gate handles navigation)
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import ProfileSetupScreen from '../profile-setup';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-svg', () => {
  const React = require('react');
  const make = (name: string) => {
    const C = (props: object) => React.createElement(name, props);
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: make('Svg'),
    Svg: make('Svg'),
    Circle: make('Circle'),
    Path: make('Path'),
    Defs: make('Defs'),
    Stop: make('Stop'),
    LinearGradient: make('LinearGradient'),
    G: make('G'),
    Text: make('SvgText'),
  };
});

// Add updateUser to the global supabase mock (global mock in jest.setup.ts does not include it)
beforeEach(() => {
  jest.clearAllMocks();
  (supabase.auth as unknown as Record<string, unknown>).updateUser = jest
    .fn()
    .mockResolvedValue({ data: null, error: null });
});

describe('Profile-setup screen', () => {
  describe('rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<ProfileSetupScreen />)).not.toThrow();
    });

    it('shows "Contanos quién sos" heading', () => {
      render(<ProfileSetupScreen />);
      expect(screen.getByText('Contanos quién sos')).toBeTruthy();
    });

    it('shows subtitle copy', () => {
      render(<ProfileSetupScreen />);
      expect(
        screen.getByText('Necesitamos tu nombre para personalizar tu experiencia.'),
      ).toBeTruthy();
    });

    it('shows Nombre label', () => {
      render(<ProfileSetupScreen />);
      expect(screen.getByText('Nombre')).toBeTruthy();
    });

    it('shows Apellido label', () => {
      render(<ProfileSetupScreen />);
      expect(screen.getByText('Apellido')).toBeTruthy();
    });

    it('shows submit button with "Continuar" copy', () => {
      render(<ProfileSetupScreen />);
      expect(screen.getByText('Continuar')).toBeTruthy();
    });

    it('submit button has accessibility label "Guardar nombre"', () => {
      render(<ProfileSetupScreen />);
      expect(screen.getByLabelText('Guardar nombre')).toBeTruthy();
    });
  });

  describe('validation', () => {
    it('blocks submit and shows error when firstName is empty', async () => {
      render(<ProfileSetupScreen />);
      const submitBtn = screen.getByLabelText('Guardar nombre');
      await act(async () => {
        fireEvent.press(submitBtn);
      });
      await waitFor(() => {
        expect(
          screen.getAllByText(/Mínimo 2 caracteres\.|Ingresá un nombre válido\./)[0],
        ).toBeTruthy();
      });
      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('blocks submit and shows error when lastName is empty', async () => {
      render(<ProfileSetupScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('Tu nombre'), 'Facundo');
      const submitBtn = screen.getByLabelText('Guardar nombre');
      await act(async () => {
        fireEvent.press(submitBtn);
      });
      await waitFor(() => {
        expect(
          screen.getAllByText(/Mínimo 2 caracteres\.|Ingresá un nombre válido\./)[0],
        ).toBeTruthy();
      });
      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('blocks submit when firstName contains digits', async () => {
      render(<ProfileSetupScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('Tu nombre'), 'Facu123');
      fireEvent.changeText(screen.getByPlaceholderText('Tu apellido'), 'Martinez');
      const submitBtn = screen.getByLabelText('Guardar nombre');
      await act(async () => {
        fireEvent.press(submitBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Solo letras, espacios, guiones o apóstrofes.')).toBeTruthy();
      });
      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('supabase.auth.updateUser payload', () => {
    it('calls updateUser with exact payload { data: { first_name, last_name } }', async () => {
      render(<ProfileSetupScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('Tu nombre'), 'Facundo');
      fireEvent.changeText(screen.getByPlaceholderText('Tu apellido'), 'Martinez');

      const submitBtn = screen.getByLabelText('Guardar nombre');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
        expect(supabase.auth.updateUser).toHaveBeenCalledWith({
          data: { first_name: 'Facundo', last_name: 'Martinez' },
        });
      });
    });
  });

  describe('error handling', () => {
    it('shows friendly error copy when Supabase returns an error', async () => {
      (supabase.auth as unknown as Record<string, unknown>).updateUser = jest
        .fn()
        .mockResolvedValueOnce({ data: null, error: { message: 'Network error' } });

      render(<ProfileSetupScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('Tu nombre'), 'Facundo');
      fireEvent.changeText(screen.getByPlaceholderText('Tu apellido'), 'Martinez');

      const submitBtn = screen.getByLabelText('Guardar nombre');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('No pudimos guardar tu nombre. Probá de nuevo.')).toBeTruthy();
      });
    });
  });

  describe('navigation', () => {
    it('does NOT call router.push after successful submission', async () => {
      render(<ProfileSetupScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('Tu nombre'), 'Facundo');
      fireEvent.changeText(screen.getByPlaceholderText('Tu apellido'), 'Martinez');

      const submitBtn = screen.getByLabelText('Guardar nombre');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
      });

      expect(router.push).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    });
  });
});
