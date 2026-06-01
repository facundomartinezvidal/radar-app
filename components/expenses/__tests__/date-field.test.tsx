/**
 * Tests for DateField component.
 *
 * Mocks @react-native-community/datetimepicker so we can control its
 * onChange event programmatically without a native module.
 *
 * react-native-svg is mocked globally in jest.setup.ts.
 *
 * Note: jest.mock() calls below are hoisted above all imports by Jest at
 * runtime, so the effective execution order is: mock factories → module
 * imports → test bodies.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DateField } from '../date-field';

// ---------------------------------------------------------------------------
// Mock DateTimePicker
// ---------------------------------------------------------------------------

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');

  /**
   * Minimal stand-in for DateTimePicker.
   * Exposes testID="mock-datetimepicker" and stores the `onChange` prop
   * on the rendered element so tests can retrieve and invoke it.
   */
  const MockDateTimePicker = ({
    onChange,
    value,
  }: {
    onChange: (event: unknown, date?: Date) => void;
    value: Date;
    maximumDate?: Date;
    mode?: string;
    display?: string;
    locale?: string;
  }) =>
    ReactLib.createElement(View, {
      testID: 'mock-datetimepicker',
      onChangeProp: onChange,
      valueProp: value,
    });

  MockDateTimePicker.displayName = 'MockDateTimePicker';
  return { __esModule: true, default: MockDateTimePicker };
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// A fixed past date to use as the field value — 15 January 2026
const ISO_PAST = '2026-01-15T12:00:00.000Z';
// A future date beyond today — should be clamped to now
const ISO_FUTURE = '2099-12-31T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(props: Partial<React.ComponentProps<typeof DateField>> = {}) {
  const onChange = jest.fn();
  const utils = render(<DateField value={ISO_PAST} onChange={onChange} {...props} />);
  return { onChange, utils };
}

/**
 * Retrieve the mock picker element and fire its stored `onChange` prop with
 * the given date. This simulates the native picker confirming a selection.
 */
function fireMockPickerChange(date: Date): void {
  const el = screen.getByTestId('mock-datetimepicker');
  const props = el.props as { onChangeProp?: (e: unknown, d?: Date) => void };
  if (typeof props.onChangeProp === 'function') {
    props.onChangeProp({}, date);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DateField', () => {
  it('renders the formatted es-AR date for a given ISO value', () => {
    setup({ value: ISO_PAST });
    // es-AR long month: "enero" for January
    expect(screen.getByText(/enero/i)).toBeTruthy();
    expect(screen.getByText(/2026/)).toBeTruthy();
  });

  it('renders the default Fecha label', () => {
    setup();
    expect(screen.getByText('Fecha')).toBeTruthy();
  });

  it('renders a custom label when provided', () => {
    setup({ label: 'Fecha del gasto' });
    expect(screen.getByText('Fecha del gasto')).toBeTruthy();
  });

  it('does not render the picker initially', () => {
    setup();
    expect(screen.queryByTestId('mock-datetimepicker')).toBeNull();
  });

  it('opens the picker when the row is tapped', () => {
    setup();
    fireEvent.press(screen.getByRole('button'));
    expect(screen.getByTestId('mock-datetimepicker')).toBeTruthy();
  });

  it('calls onChange with an ISO string when a date is selected', () => {
    const { onChange } = setup();
    fireEvent.press(screen.getByRole('button'));

    const selected = new Date('2026-01-10T00:00:00.000Z');
    fireMockPickerChange(selected);

    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0] as string;
    // Must be parseable as a valid date
    expect(() => new Date(arg)).not.toThrow();
    const returned = new Date(arg);
    // Use UTC getters to avoid timezone offset issues (input is a UTC ISO string)
    expect(returned.getUTCFullYear()).toBe(2026);
    expect(returned.getUTCMonth()).toBe(0); // January (0-indexed)
    expect(returned.getUTCDate()).toBe(10);
  });

  it('clamps a future date to today and still calls onChange', () => {
    const { onChange } = setup();
    fireEvent.press(screen.getByRole('button'));

    fireMockPickerChange(new Date(ISO_FUTURE));

    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0] as string;
    const returned = new Date(arg);
    const now = new Date();
    // Returned date must not be in the future (allow 1-second buffer for test execution)
    expect(returned.getTime()).toBeLessThanOrEqual(now.getTime() + 1000);
  });

  it('does not open the picker when disabled', () => {
    setup({ disabled: true });
    fireEvent.press(screen.getByRole('button'));
    expect(screen.queryByTestId('mock-datetimepicker')).toBeNull();
  });

  it('does not call onChange when disabled', () => {
    const { onChange } = setup({ disabled: true });
    fireEvent.press(screen.getByRole('button'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
