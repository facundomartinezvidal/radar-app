/**
 * Tests for the Loader primitive.
 *
 * Verifies render branches (spinner-only vs spinner + label) and the
 * accessibility surface. The continuous reanimated spin itself isn't asserted
 * — it's a visual concern verified manually; here we pin the structure.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { Loader } from '../loader';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

describe('Loader', () => {
  it('renders without crashing', () => {
    expect(() => render(<Loader />)).not.toThrow();
  });

  it('exposes a default accessibility label "Cargando" when no label is given', () => {
    render(<Loader />);
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
  });

  it('renders the provided label next to the spinner', () => {
    render(<Loader label="Cargando gastos" />);
    expect(screen.getByText('Cargando gastos')).toBeTruthy();
    // The spinner sub-component re-uses the label as its accessibility label.
    expect(screen.getAllByLabelText('Cargando gastos').length).toBeGreaterThanOrEqual(1);
  });

  it('uses caller size/color/strokeWidth without throwing', () => {
    expect(() =>
      render(<Loader size={32} color="#ff0000" strokeWidth={2.5} label="Loading" />),
    ).not.toThrow();
  });
});
