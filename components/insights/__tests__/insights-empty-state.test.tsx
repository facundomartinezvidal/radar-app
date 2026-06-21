/**
 * Tests for InsightsEmptyState component.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { InsightsEmptyState } from '../insights-empty-state';

describe('InsightsEmptyState', () => {
  describe('always rendered content', () => {
    it('renders the main title', () => {
      render(<InsightsEmptyState />);
      expect(screen.getByText('No hay movimientos en este período')).toBeTruthy();
    });

    it('renders the secondary suggestion text', () => {
      render(<InsightsEmptyState />);
      expect(
        screen.getByText('Cambiá el período o registrá un gasto para ver tu análisis.'),
      ).toBeTruthy();
    });
  });

  describe('"Registrar gasto" button', () => {
    it('is NOT rendered when onAddExpense is not provided', () => {
      render(<InsightsEmptyState />);
      expect(screen.queryByText('Registrar gasto')).toBeNull();
    });

    it('is rendered when onAddExpense is provided', () => {
      render(<InsightsEmptyState onAddExpense={jest.fn()} />);
      expect(screen.getByText('Registrar gasto')).toBeTruthy();
    });

    it('calls onAddExpense when pressed', () => {
      const onAddExpense = jest.fn();
      render(<InsightsEmptyState onAddExpense={onAddExpense} />);

      fireEvent.press(screen.getByText('Registrar gasto'));

      expect(onAddExpense).toHaveBeenCalledTimes(1);
    });
  });
});
