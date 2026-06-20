/**
 * Tests for AiInsightsCard component.
 *
 * Covers:
 *  - empty insights + not loading → renders null (card hidden)
 *  - loading state → loader shown
 *  - with insights → titles/bodies rendered, kind icon testIDs present
 *  - CTA button rendered and labelled when cta is present
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Insight } from '@/lib/insights/types';
import { AiInsightsCard } from '../ai-insights-card';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WARNING_INSIGHT: Insight = {
  kind: 'warning',
  title: 'Gastaste más de lo que ingresó',
  body: 'Tu balance es negativo por $5.000. Revisá tus gastos.',
};

const POSITIVE_INSIGHT: Insight = {
  kind: 'positive',
  title: 'Bajaste tus gastos',
  body: 'Bajaste tus gastos un 20%. Buen control.',
};

const TIP_INSIGHT: Insight = {
  kind: 'tip',
  title: 'Consejo del día',
  body: 'Registrá todos tus gastos pequeños para tener visibilidad total.',
  cta: { label: 'Registrar gasto', route: '/(protected)/(tabs)/' },
};

const NEUTRAL_INSIGHT: Insight = {
  kind: 'neutral',
  title: 'Comida concentra el 50%',
  body: 'Comida concentra el 50% de tus gastos.',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiInsightsCard', () => {
  describe('when insights is empty and not loading', () => {
    it('renders null — the card title is absent', () => {
      const { toJSON } = render(<AiInsightsCard insights={[]} loading={false} />);
      expect(toJSON()).toBeNull();
    });

    it('also renders null when loading prop is omitted', () => {
      const { toJSON } = render(<AiInsightsCard insights={[]} />);
      expect(toJSON()).toBeNull();
    });
  });

  describe('loading state', () => {
    it('renders the card header "Recomendaciones" while loading', () => {
      render(<AiInsightsCard insights={[]} loading={true} />);
      expect(screen.getByText('Recomendaciones')).toBeTruthy();
    });

    it('renders a loader (accessibilityLabel "Cargando") while loading', () => {
      render(<AiInsightsCard insights={[]} loading={true} />);
      expect(screen.getByLabelText('Cargando')).toBeTruthy();
    });

    it('does not render insight rows while loading', () => {
      render(<AiInsightsCard insights={[WARNING_INSIGHT]} loading={true} />);
      expect(screen.queryByText(WARNING_INSIGHT.title)).toBeNull();
    });
  });

  describe('with insights', () => {
    it('renders the card header "Recomendaciones"', () => {
      render(<AiInsightsCard insights={[WARNING_INSIGHT]} />);
      expect(screen.getByText('Recomendaciones')).toBeTruthy();
    });

    it('renders every insight title', () => {
      const insights = [WARNING_INSIGHT, POSITIVE_INSIGHT, TIP_INSIGHT, NEUTRAL_INSIGHT];
      render(<AiInsightsCard insights={insights} />);

      insights.forEach((insight) => {
        expect(screen.getByText(insight.title)).toBeTruthy();
      });
    });

    it('renders every insight body', () => {
      const insights = [WARNING_INSIGHT, POSITIVE_INSIGHT];
      render(<AiInsightsCard insights={insights} />);

      insights.forEach((insight) => {
        expect(screen.getByText(insight.body)).toBeTruthy();
      });
    });

    it('renders the correct count of insight rows', () => {
      const insights = [WARNING_INSIGHT, POSITIVE_INSIGHT, TIP_INSIGHT];
      render(<AiInsightsCard insights={insights} />);

      // Each title is unique so count titles as proxy for row count
      const titleEls = [
        screen.queryByText(WARNING_INSIGHT.title),
        screen.queryByText(POSITIVE_INSIGHT.title),
        screen.queryByText(TIP_INSIGHT.title),
      ];
      expect(titleEls.filter(Boolean)).toHaveLength(3);
    });

    it('does not render the loader when insights are present and not loading', () => {
      render(<AiInsightsCard insights={[WARNING_INSIGHT]} />);
      expect(screen.queryByLabelText('Cargando')).toBeNull();
    });
  });

  describe('kind → icon mapping (testID on icon wrapper)', () => {
    it('warning insight renders testID insight-icon-warning', () => {
      render(<AiInsightsCard insights={[WARNING_INSIGHT]} />);
      expect(screen.getByTestId('insight-icon-warning')).toBeTruthy();
    });

    it('positive insight renders testID insight-icon-positive', () => {
      render(<AiInsightsCard insights={[POSITIVE_INSIGHT]} />);
      expect(screen.getByTestId('insight-icon-positive')).toBeTruthy();
    });

    it('tip insight renders testID insight-icon-tip', () => {
      render(<AiInsightsCard insights={[TIP_INSIGHT]} />);
      expect(screen.getByTestId('insight-icon-tip')).toBeTruthy();
    });

    it('neutral insight renders testID insight-icon-neutral', () => {
      render(<AiInsightsCard insights={[NEUTRAL_INSIGHT]} />);
      expect(screen.getByTestId('insight-icon-neutral')).toBeTruthy();
    });

    it('renders distinct icon wrappers for each kind when multiple insights present', () => {
      const insights = [WARNING_INSIGHT, POSITIVE_INSIGHT, TIP_INSIGHT, NEUTRAL_INSIGHT];
      render(<AiInsightsCard insights={insights} />);

      expect(screen.getByTestId('insight-icon-warning')).toBeTruthy();
      expect(screen.getByTestId('insight-icon-positive')).toBeTruthy();
      expect(screen.getByTestId('insight-icon-tip')).toBeTruthy();
      expect(screen.getByTestId('insight-icon-neutral')).toBeTruthy();
    });
  });

  describe('CTA button', () => {
    it('is NOT rendered when insight has no cta', () => {
      render(<AiInsightsCard insights={[WARNING_INSIGHT]} />);
      expect(screen.queryByRole('button', { name: /registrar/i })).toBeNull();
    });

    it('is rendered with the cta label when cta is present', () => {
      render(<AiInsightsCard insights={[TIP_INSIGHT]} />);
      expect(screen.getByLabelText('Registrar gasto')).toBeTruthy();
    });

    it('is pressable without throwing', () => {
      render(<AiInsightsCard insights={[TIP_INSIGHT]} />);
      const cta = screen.getByLabelText('Registrar gasto');
      expect(() => fireEvent.press(cta)).not.toThrow();
    });
  });
});
