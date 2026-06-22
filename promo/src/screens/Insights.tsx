import React from 'react';
import { TriangleAlert, TrendingUp, Lightbulb, Sparkles, ChevronRight } from 'lucide-react';
import { colors, spacing, radii, font, weights } from '../ds/tokens';
import { T } from '../ds/Text';
import { Card, Pill, formatMoney } from '../ds/primitives';
import { TabBar } from '../ds/Device';
import { Donut, PeriodBars, IncomeVsExpense, TrendLine } from './insightsCharts';

// Normal app spacing between sections (matches the real Insights screen).
const GAP = 20;

// Scroll targets (content px) that frame each section behind the forward card.
export const TOUR = { donut: 236, period: 606, ive: 966, trend: 1356, recs: 1726 } as const;

const Section: React.FC<{ title: string; caption?: string; height: number; children: React.ReactNode }> = ({ title, caption, height, children }) => (
  <div style={{ height: height + spacing[5], marginBottom: GAP, padding: `0 ${spacing[5]}px` }}>
    <T variant="h3" style={{ marginTop: spacing[5], marginBottom: caption ? 2 : spacing[3] }}>{title}</T>
    {caption && <span style={{ ...font(weights.regular), fontSize: 12, color: colors.fg[3], display: 'block', marginBottom: spacing[3] }}>{caption}</span>}
    <Card variant="base" padding={5}>{children}</Card>
  </div>
);

const RECS = [
  { Icon: TriangleAlert, color: colors.amber[500], title: 'Comida se llevó el 47% del mes', body: 'Gastaste $ 84.200 en comida, 23% más que en mayo. Bajando los delivery del finde recuperás unos $ 18.000.', cta: 'Ver gastos de comida' },
  { Icon: TrendingUp, color: colors.money.in, title: 'Vas 12% mejor que el mes pasado', body: 'Cerrás junio con un balance de +$ 74.200. Si mantenés el ritmo, llegás a fin de trimestre con ~$ 220.000 ahorrados.', cta: 'Ver ingresos' },
  { Icon: Lightbulb, color: colors.brand[300], title: 'Automatizá tus gastos fijos', body: 'Detectamos 3 gastos que se repiten cada mes: alquiler, Spotify y gimnasio. Cargalos como recurrentes y no se te escapa ninguno.', cta: 'Crear gasto recurrente' },
];

export const Recommendations: React.FC<{ highlightIndex?: number }> = ({ highlightIndex }) => (
    <Card variant="raised" padding={4}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] }}>
        <Sparkles size={16} color={colors.brand[300]} strokeWidth={1.5} />
        <span style={{ ...font(weights.semibold), fontSize: 14, color: colors.fg[1] }}>Recomendaciones</span>
      </div>
      {RECS.map((r, i) => {
        const active = highlightIndex === undefined || highlightIndex === i;
        const focused = highlightIndex === i;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: spacing[3],
              padding: spacing[2],
              marginTop: i > 0 ? 4 : 0,
              borderTop: i > 0 ? `1px solid ${colors.line[1]}` : 'none',
              opacity: active ? 1 : 0.28,
              borderRadius: radii.md,
              background: focused ? 'rgba(0,119,182,0.10)' : 'transparent',
              boxShadow: focused ? '0 0 0 1px rgba(0,119,182,0.45)' : 'none',
            }}
          >
            <div style={{ paddingTop: 2 }}><r.Icon size={16} color={r.color} strokeWidth={1.5} /></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
              <span style={{ ...font(weights.semibold), fontSize: 14, color: colors.fg[1] }}>{r.title}</span>
              <span style={{ ...font(weights.regular), fontSize: 12, lineHeight: '17px', color: colors.fg[2] }}>{r.body}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1], marginTop: spacing[1] }}>
                <span style={{ ...font(weights.semibold), fontSize: 12, color: colors.brand[300] }}>{r.cta}</span>
                <ChevronRight size={12} color={colors.brand[300]} strokeWidth={1.5} />
              </div>
            </div>
          </div>
        );
      })}
    </Card>
);

// Per-section element for the "pop forward" overlay tour (native phone width).
export const OverlaySection: React.FC<{ section: 'donut' | 'period' | 'ive' | 'trend' | 'recs'; highlightIndex?: number; loadStart?: number }> = ({ section, highlightIndex, loadStart }) => {
  if (section === 'recs') {
    return <div style={{ width: 393, padding: `0 ${spacing[5]}px` }}><Recommendations highlightIndex={highlightIndex} /></div>;
  }
  const map = {
    donut: ['Gastos por categoría', undefined, <Donut key="d" loadStart={loadStart} />],
    period: ['Gastos por período', undefined, <PeriodBars key="p" loadStart={loadStart} />],
    ive: ['Ingresos vs gastos', 'Últimos 6 meses', <IncomeVsExpense key="i" loadStart={loadStart} />],
    trend: ['Tendencia', 'Últimos 6 meses', <TrendLine key="t" loadStart={loadStart} />],
  } as const;
  const [title, caption, el] = map[section];
  return (
    <div style={{ width: 393, padding: `0 ${spacing[5]}px` }}>
      <T variant="h3" style={{ marginBottom: caption ? 2 : spacing[3] }}>{title}</T>
      {caption && <span style={{ ...font(weights.regular), fontSize: 12, color: colors.fg[3], display: 'block', marginBottom: spacing[3] }}>{caption}</span>}
      <Card variant="base" padding={5}>{el}</Card>
    </div>
  );
};

export const Insights: React.FC<{ scrollY?: number; highlightIndex?: number }> = ({ scrollY = 0, highlightIndex }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    {/* pinned header */}
    <div style={{ padding: `${spacing[4]}px ${spacing[5]}px ${spacing[2]}px` }}>
      <T variant="h2">Insights</T>
    </div>

    {/* viewport (scroll driven by parent tour) */}
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
      <div style={{ transform: `translateY(${-scrollY}px)` }}>
        {/* filters (height 96) */}
        <div style={{ height: 96, marginBottom: GAP, padding: `0 ${spacing[5]}px`, display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
          <div style={{ display: 'flex', gap: spacing[2] }}>
            {['Semana', 'Mes', 'Año'].map((p) => (
              <div key={p} style={{ padding: '6px 14px', borderRadius: radii.pill, border: `1px solid ${p === 'Mes' ? colors.brand[400] : colors.line[2]}`, background: p === 'Mes' ? 'rgba(0,119,182,0.12)' : 'transparent' }}>
                <span style={{ ...font(weights.semibold), fontSize: 13, color: p === 'Mes' ? colors.brand[300] : colors.fg[3] }}>{p}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', background: colors.bg[2], borderRadius: radii.pill, padding: 3, border: `1px solid ${colors.line[1]}`, alignSelf: 'flex-start' }}>
            <span style={{ ...font(weights.semibold), fontSize: 12, color: colors.fg.onBrand, background: colors.brand[500], padding: '4px 12px', borderRadius: 999 }}>ARS</span>
            <span style={{ ...font(weights.semibold), fontSize: 12, color: colors.fg[3], padding: '4px 12px' }}>USD</span>
          </div>
        </div>

        {/* totals */}
        <div style={{ height: 200, marginBottom: GAP, padding: `0 ${spacing[5]}px` }}>
          <Card variant="raised" padding={5}>
            <T variant="label">Balance del período</T>
            <T variant="display" color={colors.money.in} style={{ marginTop: spacing[1], marginBottom: spacing[3], whiteSpace: 'nowrap' }}>{formatMoney(74200, 'ARS', { showPlus: true })}</T>
            <div style={{ display: 'flex', gap: spacing[3], flexWrap: 'wrap' }}>
              <Pill variant="income">{`Ingresos ${formatMoney(254000, 'ARS')}`}</Pill>
              <Pill variant="expense">{`Gastos ${formatMoney(180400, 'ARS')}`}</Pill>
            </div>
          </Card>
        </div>

        <Section title="Gastos por categoría" height={360}><Donut /></Section>
        <Section title="Gastos por período" height={300}><PeriodBars /></Section>
        <Section title="Ingresos vs gastos" caption="Últimos 6 meses" height={340}><IncomeVsExpense /></Section>
        <Section title="Tendencia" caption="Últimos 6 meses" height={360}><TrendLine /></Section>
        <div style={{ padding: `0 ${spacing[5]}px`, marginBottom: GAP }}>
          <Recommendations highlightIndex={highlightIndex} />
        </div>
      </div>
    </div>

    <TabBar active="Insights" />
  </div>
);
