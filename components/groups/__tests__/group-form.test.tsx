/**
 * Tests for GroupForm.
 *
 * Covers:
 *   - Renders the name input
 *   - Renders the live preview label
 *   - Submitting empty name shows validation error, does NOT call onSubmit
 *   - Valid submit calls onSubmit with { name, icon, color, placeholders, invites }
 *   - Adding / removing placeholder rows works
 *   - Trash buttons present for placeholder list
 *   - "Participantes (con cuenta)" section renders with add button
 *   - Adding / removing email invite rows works
 *   - Trash buttons present for invite list
 *   - Invalid email blocks submit and shows "Ingresá un correo válido."
 *   - Empty invite rows are dropped on submit
 *   - Valid submit emits trimmed, non-empty invites alongside create fields
 *   - errorMessage prop renders below the form
 *   - Custom submitLabel is respected
 *   - prefills from initial prop (including invites)
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { GroupForm } from '../group-form';
import type { GroupFormValues } from '../group-form';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/category-options';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

describe('GroupForm', () => {
  // ---------------------------------------------------------------------------
  // Existing basic rendering
  // ---------------------------------------------------------------------------

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

  it('calls onSubmit with { name, icon, color, placeholders, invites } when form is valid', async () => {
    const onSubmit = jest.fn();
    render(<GroupForm onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText('Nombre del grupo');
    fireEvent.changeText(input, 'Depto');

    fireEvent.press(screen.getByText('Crear grupo'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0]?.[0] as GroupFormValues;
    expect(payload.name).toBe('Depto');
    expect(CATEGORY_ICONS).toContain(payload.icon);
    expect(CATEGORY_COLORS).toContain(payload.color);
    expect(Array.isArray(payload.placeholders)).toBe(true);
    expect(Array.isArray(payload.invites)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Placeholder (sin cuenta) section
  // ---------------------------------------------------------------------------

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

  it('renders trash button for each placeholder row', () => {
    render(<GroupForm onSubmit={jest.fn()} />);

    fireEvent.press(screen.getByTestId('add-placeholder-button'));
    fireEvent.press(screen.getByTestId('add-placeholder-button'));

    expect(screen.getByTestId('remove-placeholder-0')).toBeTruthy();
    expect(screen.getByTestId('remove-placeholder-1')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Invite (con cuenta) section
  // ---------------------------------------------------------------------------

  it('renders "Participantes (con cuenta)" section title', () => {
    render(<GroupForm onSubmit={jest.fn()} />);
    expect(screen.getByText('Participantes (con cuenta)')).toBeTruthy();
  });

  it('renders "Agregar por correo" button', () => {
    render(<GroupForm onSubmit={jest.fn()} />);
    expect(screen.getByTestId('add-invite-button')).toBeTruthy();
  });

  it('can add an email invite row', () => {
    render(<GroupForm onSubmit={jest.fn()} />);

    fireEvent.press(screen.getByTestId('add-invite-button'));

    expect(screen.getByTestId('invite-input-0')).toBeTruthy();
    expect(screen.getByPlaceholderText('Correo electrónico')).toBeTruthy();
  });

  it('can remove an email invite row via the Trash2 button', () => {
    render(<GroupForm onSubmit={jest.fn()} />);

    fireEvent.press(screen.getByTestId('add-invite-button'));
    expect(screen.getByTestId('invite-input-0')).toBeTruthy();

    fireEvent.press(screen.getByTestId('remove-invite-0'));
    expect(screen.queryByTestId('invite-input-0')).toBeNull();
  });

  it('renders trash button for each invite row', () => {
    render(<GroupForm onSubmit={jest.fn()} />);

    fireEvent.press(screen.getByTestId('add-invite-button'));
    fireEvent.press(screen.getByTestId('add-invite-button'));

    expect(screen.getByTestId('remove-invite-0')).toBeTruthy();
    expect(screen.getByTestId('remove-invite-1')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Email validation
  // ---------------------------------------------------------------------------

  it('shows "Ingresá un correo válido." for an invalid email and blocks submit', async () => {
    const onSubmit = jest.fn();
    render(<GroupForm onSubmit={onSubmit} />);

    // Fill required name so Zod passes
    fireEvent.changeText(screen.getByPlaceholderText('Nombre del grupo'), 'Depto');

    // Add an invalid email
    fireEvent.press(screen.getByTestId('add-invite-button'));
    fireEvent.changeText(screen.getByTestId('invite-input-0'), 'not-an-email');

    fireEvent.press(screen.getByText('Crear grupo'));

    await waitFor(() => {
      expect(screen.getByText('Ingresá un correo válido.')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('empty invite rows are dropped on submit and do not trigger validation errors', async () => {
    const onSubmit = jest.fn();
    render(<GroupForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByPlaceholderText('Nombre del grupo'), 'Depto');

    // Add an empty row (do not type anything)
    fireEvent.press(screen.getByTestId('add-invite-button'));

    fireEvent.press(screen.getByText('Crear grupo'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0]?.[0] as GroupFormValues;
    expect(payload.invites).toEqual([]);
  });

  it('valid submit emits trimmed, non-empty invites', async () => {
    const onSubmit = jest.fn();
    render(<GroupForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByPlaceholderText('Nombre del grupo'), 'Depto');

    // Add valid email (with surrounding spaces to test trim)
    fireEvent.press(screen.getByTestId('add-invite-button'));
    fireEvent.changeText(screen.getByTestId('invite-input-0'), '  ana@example.com  ');

    // Add empty row (should be dropped)
    fireEvent.press(screen.getByTestId('add-invite-button'));

    fireEvent.press(screen.getByText('Crear grupo'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0]?.[0] as GroupFormValues;
    expect(payload.invites).toEqual(['ana@example.com']);
  });

  it('valid submit emits placeholders alongside invites', async () => {
    const onSubmit = jest.fn();
    render(<GroupForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByPlaceholderText('Nombre del grupo'), 'Depto');

    // Add placeholder
    fireEvent.press(screen.getByTestId('add-placeholder-button'));
    fireEvent.changeText(screen.getByTestId('placeholder-input-0'), 'Juan');

    // Add invite
    fireEvent.press(screen.getByTestId('add-invite-button'));
    fireEvent.changeText(screen.getByTestId('invite-input-0'), 'ana@example.com');

    fireEvent.press(screen.getByText('Crear grupo'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0]?.[0] as GroupFormValues;
    expect(payload.placeholders).toEqual(['Juan']);
    expect(payload.invites).toEqual(['ana@example.com']);
  });

  // ---------------------------------------------------------------------------
  // Misc
  // ---------------------------------------------------------------------------

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

  it('prefills invites from initial prop', () => {
    render(
      <GroupForm
        onSubmit={jest.fn()}
        initial={{
          name: 'Viaje',
          icon: 'Plane',
          color: '#10B981',
          placeholders: [],
          invites: ['pre@example.com'],
        }}
      />,
    );
    expect(screen.getByDisplayValue('pre@example.com')).toBeTruthy();
  });
});
