/**
 * Tests for CategoryForm.
 *
 * Covers:
 *   - Renders the name input, color picker, icon picker and live preview
 *   - Submitting with an empty name shows the validation error and does NOT call onSubmit
 *   - Valid submit calls onSubmit with the expected { name, icon, color } payload
 *   - errorMessage prop renders below the form
 *   - defaultName prefills the name input
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { CategoryForm } from '../category-form';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/category-options';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

describe('CategoryForm', () => {
  it('renders the Nombre input', () => {
    render(<CategoryForm onSubmit={jest.fn()} />);
    expect(screen.getByPlaceholderText('Nombre de la categoría')).toBeTruthy();
  });

  it('renders the live preview label', () => {
    render(<CategoryForm onSubmit={jest.fn()} />);
    expect(screen.getByText('Vista previa')).toBeTruthy();
  });

  it('live preview falls back to "Categoría" when name is empty', () => {
    render(<CategoryForm onSubmit={jest.fn()} />);
    // The preview chip renders "Categoría" when name is empty/blank
    expect(screen.getByText('Categoría')).toBeTruthy();
  });

  it('live preview reflects the name as typed', () => {
    render(<CategoryForm onSubmit={jest.fn()} />);
    const input = screen.getByPlaceholderText('Nombre de la categoría');
    fireEvent.changeText(input, 'Mascota');
    expect(screen.getByText('Mascota')).toBeTruthy();
  });

  it('shows validation error "Ingresá un nombre." when submitted empty and does NOT call onSubmit', async () => {
    const onSubmit = jest.fn();
    render(<CategoryForm onSubmit={onSubmit} />);

    fireEvent.press(screen.getByText('Crear categoría'));

    await waitFor(() => {
      expect(screen.getByText('Ingresá un nombre.')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with { name, icon, color } when form is valid', async () => {
    const onSubmit = jest.fn();
    render(<CategoryForm onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText('Nombre de la categoría');
    fireEvent.changeText(input, 'Transporte');

    fireEvent.press(screen.getByText('Crear categoría'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0]?.[0] as
      | { name: string; icon: string; color: string }
      | undefined;
    expect(payload?.name).toBe('Transporte');
    expect(CATEGORY_ICONS).toContain(payload?.icon);
    expect(CATEGORY_COLORS).toContain(payload?.color);
  });

  it('renders the errorMessage when provided', () => {
    render(
      <CategoryForm onSubmit={jest.fn()} errorMessage="Ya tenés una categoría con ese nombre." />,
    );
    expect(screen.getByText('Ya tenés una categoría con ese nombre.')).toBeTruthy();
  });

  it('prefills name from defaultName prop', () => {
    render(<CategoryForm onSubmit={jest.fn()} defaultName="Comida rápida" />);
    const input = screen.getByDisplayValue('Comida rápida');
    expect(input).toBeTruthy();
  });

  it('uses custom submitLabel', () => {
    render(<CategoryForm onSubmit={jest.fn()} submitLabel="Guardar cambios" />);
    expect(screen.getByText('Guardar cambios')).toBeTruthy();
  });

  it('prefills fields from initial prop', () => {
    render(
      <CategoryForm
        onSubmit={jest.fn()}
        initial={{ name: 'Mascotas', icon: 'PawPrint', color: '#10B981' }}
      />,
    );
    expect(screen.getByDisplayValue('Mascotas')).toBeTruthy();
  });
});
