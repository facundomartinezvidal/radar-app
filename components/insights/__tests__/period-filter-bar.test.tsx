/**
 * Tests for PeriodFilterBar component.
 *
 * Uses a fixed reference date (June 20, 2026) injected via the component's
 * dependency on `presetPeriod` / `shiftMonth`. The component calls those
 * helpers with `new Date()` internally, so we mock the helpers to use our
 * fixed NOW — except for the period state which we control via props.
 *
 * Strategy: render the component with a controlled `period` and `onChange`
 * spy, then interact via fireEvent and assert the spy was called with the
 * correct Period shape.
 */
import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { presetPeriod, shiftMonth } from '@/lib/insights/periods';
import type { Period } from '@/lib/insights/types';
import { PeriodFilterBar } from '../period-filter-bar';

// Fixed reference: June 20, 2026
const NOW = new Date(2026, 5, 20);

// Helper: build a controlled wrapper so period state flows properly
function setup(initialPeriod: Period) {
  const onChange = jest.fn();
  function Wrapper() {
    const [period, setPeriod] = useState(initialPeriod);
    function handleChange(p: Period) {
      setPeriod(p);
      onChange(p);
    }
    return <PeriodFilterBar period={period} onChange={handleChange} />;
  }
  render(<Wrapper />);
  return { onChange };
}

describe('PeriodFilterBar', () => {
  describe('preset chips', () => {
    it('tapping "Mes pasado" calls onChange with a Period whose label is "Mes pasado"', () => {
      const { onChange } = setup(presetPeriod('this-month', NOW));

      fireEvent.press(screen.getByLabelText('Mes pasado'));

      expect(onChange).toHaveBeenCalledTimes(1);
      const received = onChange.mock.calls[0][0] as Period;
      expect(received.label).toBe('Mes pasado');
    });

    it('tapping "Este mes" calls onChange with label "Este mes"', () => {
      const { onChange } = setup(presetPeriod('last-month', NOW));

      fireEvent.press(screen.getByLabelText('Este mes'));

      const received = onChange.mock.calls[0][0] as Period;
      expect(received.label).toBe('Este mes');
    });

    it('tapping "Últimos 3 meses" calls onChange with label "Últimos 3 meses"', () => {
      const { onChange } = setup(presetPeriod('this-month', NOW));

      fireEvent.press(screen.getByLabelText('Últimos 3 meses'));

      const received = onChange.mock.calls[0][0] as Period;
      expect(received.label).toBe('Últimos 3 meses');
    });

    it('tapping "Este año" calls onChange with label "Este año"', () => {
      const { onChange } = setup(presetPeriod('this-month', NOW));

      fireEvent.press(screen.getByLabelText('Este año'));

      const received = onChange.mock.calls[0][0] as Period;
      expect(received.label).toBe('Este año');
    });

    it('selected preset chip has accessibilityState.selected = true', () => {
      setup(presetPeriod('this-month', NOW));

      // "Este mes" is the default active preset
      const chip = screen.getByLabelText('Este mes');
      expect(chip).toHaveAccessibilityState({ selected: true });
    });

    it('non-active preset chips have accessibilityState.selected = false', () => {
      setup(presetPeriod('this-month', NOW));

      const chip = screen.getByLabelText('Mes pasado');
      expect(chip).toHaveAccessibilityState({ selected: false });
    });

    it('tapping a preset updates active highlight to that preset', () => {
      setup(presetPeriod('this-month', NOW));

      fireEvent.press(screen.getByLabelText('Mes pasado'));

      expect(screen.getByLabelText('Mes pasado')).toHaveAccessibilityState({ selected: true });
      expect(screen.getByLabelText('Este mes')).toHaveAccessibilityState({ selected: false });
    });
  });

  describe('month navigation arrows', () => {
    it('pressing left chevron calls onChange with the previous month', () => {
      // Start at May 2026
      const mayPeriod = shiftMonth(presetPeriod('this-month', NOW), -1);
      const { onChange } = setup(mayPeriod);

      fireEvent.press(screen.getByLabelText('Mes anterior'));

      expect(onChange).toHaveBeenCalledTimes(1);
      const received = onChange.mock.calls[0][0] as Period;
      // Going back one month from May 2026 → April 2026
      expect(received.label).toBe('Abril 2026');
    });

    it('pressing left chevron clears the active preset', () => {
      const { onChange } = setup(presetPeriod('this-month', NOW));

      fireEvent.press(screen.getByLabelText('Mes anterior'));

      // All presets should be deselected after manual navigation
      expect(screen.getByLabelText('Este mes')).toHaveAccessibilityState({ selected: false });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('right chevron is accessible as disabled when period is current month', () => {
      // June 2026 = current month relative to NOW
      const currentMonth = presetPeriod('this-month', NOW);
      setup(currentMonth);

      const rightBtn = screen.getByLabelText('Mes siguiente');
      expect(rightBtn).toHaveAccessibilityState({ disabled: true });
    });

    it('right chevron is enabled when period is not current month', () => {
      // May 2026 — one month in the past
      const mayPeriod = shiftMonth(presetPeriod('this-month', NOW), -1);
      setup(mayPeriod);

      const rightBtn = screen.getByLabelText('Mes siguiente');
      expect(rightBtn).toHaveAccessibilityState({ disabled: false });
    });

    it('pressing right chevron on a past month calls onChange with next month', () => {
      // April 2026
      const april = shiftMonth(presetPeriod('this-month', NOW), -2);
      const { onChange } = setup(april);

      fireEvent.press(screen.getByLabelText('Mes siguiente'));

      const received = onChange.mock.calls[0][0] as Period;
      expect(received.label).toBe('Mayo 2026');
    });

    it('pressing right chevron when at current month does NOT call onChange', () => {
      const currentMonth = presetPeriod('this-month', NOW);
      const { onChange } = setup(currentMonth);

      fireEvent.press(screen.getByLabelText('Mes siguiente'));

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
