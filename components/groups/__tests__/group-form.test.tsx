/**
 * Tests for GroupForm.
 *
 * Covers:
 *   - Renders the name input
 *   - Renders the live preview label
 *   - Submitting empty name shows validation error, does NOT call onSubmit
 *   - Valid submit calls onSubmit with { name, icon, color, placeholders }
 *   - Adding a placeholder row works
 *   - Removing a placeholder row works
 *   - errorMessage prop renders below the form
 *   - Custom submitLabel is respected
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { GroupForm } from '../group-form';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/category-options';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

describe('GroupForm', () => {
  it('renders the Nombre del grupo input', () => {
    render(<GroupForm onSubmit={jest.fn()} />);
    expect(screen.getByPlaceholderText('Nombre del grupo')).toBeTruthy();
  });

  it('renders the live preview label', () => {
    render(<GroupForm onSubmit={jest.fn()} />);
    expect(screen.getByText('Vista previa')).toBeTruthy();
  });

  it('live preview defaults to "Grupo" when name is empty', () => {
    render(<GroupForm onSubmit={jest.fn()} />);
    expect(screen.getByText('Grupo')).toBeTruthy();
  });

  it('live preview reflects the typed name', () => {
    render(<GroupForm onSubmit={jest.fn()} />);
    const input = screen.getByPlaceholderText('Nombre del grupo');
    fireEvent.changeText(input, 'Bariloche');
    expect(screen.getByText('Bariloche')).toBeTruthy();
  });

  it('shows validation error "Ingresá un nombre." when submitted empty and does NOT call onSubmit', async () => {
    const onSubmit = jest.fn();
    render(<GroupForm onSubmit={onSubmit} />);

    fireEvent.press(screen.getByText('Crear grupo'));

    await waitFor(() => {
      expect(screen.getByText('Ingresá un nombre.')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with { name, icon, color, placeholders } when form is valid', async () => {
    const onSubmit = jest.fn();
    render(<GroupForm onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText('Nombre del grupo');
    fireEvent.changeText(input, 'Depto');

    fireEvent.press(screen.getByText('Crear grupo'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0]?.[0] as {
      name: string;
      icon: string;
      color: string;
      placeholders: string[];
    };
    expect(payload.name).toBe('Depto');
    expect(CATEGORY_ICONS).toContain(payload.icon);
    expect(CATEGORY_COLORS).toContain(payload.color);
    expect(Array.isArray(payload.placeholders)).toBe(true);
  });

  it('renders "Agregar participante" button and can add a placeholder row', () => {
    render(<GroupForm onSubmit={jest.fn()} />);
    const addBtn = screen.getByTestId('add-placeholder-button');
    expect(addBtn).toBeTruthy();

    fireEvent.press(addBtn);

    expect(screen.getByTestId('placeholder-input-0')).toBeTruthy();
  });

  it('can remove a placeholder row via the Trash2 button', () => {
    render(<GroupForm onSubmit={jest.fn()} />);

    // Add a participant
    fireEvent.press(screen.getByTestId('add-placeholder-button'));
    expect(screen.getByTestId('placeholder-input-0')).toBeTruthy();

    // Remove it
    fireEvent.press(screen.getByTestId('remove-placeholder-0'));
    expect(screen.queryByTestId('placeholder-input-0')).toBeNull();
  });

  it('renders submitError when provided', () => {
    render(<GroupForm onSubmit={jest.fn()} submitError="No se pudo crear el grupo." />);
    expect(screen.getByText('No se pudo crear el grupo.')).toBeTruthy();
  });

  it('uses custom submitLabel', () => {
    render(<GroupForm onSubmit={jest.fn()} submitLabel="Guardar grupo" />);
    expect(screen.getByText('Guardar grupo')).toBeTruthy();
  });

  it('prefills fields from initial prop', () => {
    render(
      <GroupForm
        onSubmit={jest.fn()}
        initial={{ name: 'Viaje', icon: 'Plane', color: '#10B981', placeholders: [] }}
      />,
    );
    expect(screen.getByDisplayValue('Viaje')).toBeTruthy();
  });
});
