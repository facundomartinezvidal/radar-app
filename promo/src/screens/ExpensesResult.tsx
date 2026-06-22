import React from 'react';
import { Plus, Repeat, ChevronRight, Search, Shirt, Utensils, Zap, PartyPopper } from 'lucide-react';
import { colors, spacing, radii, font, weights } from '../ds/tokens';
import { T } from '../ds/Text';
import { formatMoney } from '../ds/primitives';
import { TabBar } from '../ds/Device';

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ ...font(weights.semibold), fontSize: 12, letterSpacing: 0.48, textTransform: 'uppercase', color: colors.fg[3] }}>{children}</span>
);

type Row = { Icon: typeof Shirt; color: string; primary: string; cat: string; amount: number; cur: 'ARS' | 'USD' };
const HOY: Row[] = [
  { Icon: Shirt, color: '#8B5CF6', primary: 'Compra de ropa en Rapsodia', cat: 'Ropa', amount: 48900, cur: 'ARS' },
];
const AYER: Row[] = [
  { Icon: Utensils, color: '#F59E0B', primary: 'Coto', cat: 'Comida', amount: 38500, cur: 'ARS' },
  { Icon: Zap, color: '#F59E0B', primary: 'Internet Fibertel', cat: 'Servicios', amount: 16200, cur: 'ARS' },
  { Icon: PartyPopper, color: '#8B5CF6', primary: 'Spotify Premium', cat: 'Ocio', amount: 5.99, cur: 'USD' },
];

const ExpenseRow: React.FC<{ r: Row; divider?: boolean }> = ({ r, divider = true }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], paddingTop: spacing[3], paddingBottom: spacing[3], paddingLeft: spacing[4], paddingRight: spacing[4], borderBottom: divider ? `1px solid ${colors.line[1]}` : 'none' }}>
    <div style={{ width: 40, height: 40, borderRadius: 20, background: `${r.color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <r.Icon size={20} color={r.color} strokeWidth={1.5} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <span style={{ ...font(weights.regular), fontSize: 16, color: colors.fg[1], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{r.primary}</span>
      <span style={{ ...font(weights.regular), fontSize: 12, color: colors.fg[3], display: 'block', marginTop: 1 }}>{r.cat}</span>
    </div>
    <span style={{ ...font(weights.semibold), fontSize: 16, color: colors.money.out, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatMoney(r.amount, r.cur)}</span>
  </div>
);

const RecurRow: React.FC<{ name: string; sub: React.ReactNode; amount: number; last?: boolean }> = ({ name, sub, amount, last }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], padding: `${spacing[3]}px ${spacing[4]}px`, borderBottom: last ? 'none' : `1px solid ${colors.line[1]}` }}>
    <div style={{ flex: 1 }}>
      <span style={{ ...font(weights.regular), fontSize: 14, color: colors.fg[1] }}>{name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>{sub}</div>
    </div>
    <span style={{ ...font(weights.semibold), fontSize: 16, color: colors.money.out, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(amount, 'ARS')}</span>
    <ChevronRight size={16} color={colors.fg[4]} strokeWidth={1.5} />
  </div>
);

// Forward-overlay card for the just-added expense (zoom tour).
export const NewExpenseCard: React.FC = () => (
  <div style={{ width: 393, padding: `0 ${spacing[5]}px` }}>
    <div style={{ paddingBottom: spacing[2] }}><Label>Hoy</Label></div>
    <div style={{ background: colors.bg[1], borderRadius: radii.lg, border: `1px solid rgba(0,119,182,0.45)`, boxShadow: '0 0 0 1px rgba(0,119,182,0.35), 0 10px 30px rgba(0,119,182,0.30)' }}>
      <ExpenseRow r={HOY[0]} divider={false} />
    </div>
  </div>
);

export const ExpensesResult: React.FC<{ scrollY?: number }> = ({ scrollY = 0 }) => {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ transform: `translateY(${-scrollY}px)`, padding: `0 ${spacing[5]}px`, width: 393, boxSizing: 'border-box' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing[4], marginBottom: spacing[5] }}>
            <T variant="h1">Gastos</T>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: colors.brand[500], borderRadius: radii.md, padding: `${spacing[2]}px ${spacing[3]}px` }}>
              <Plus size={18} color={colors.fg.onBrand} strokeWidth={2} />
              <span style={{ ...font(weights.semibold), fontSize: 14, color: colors.fg.onBrand }}>Nuevo</span>
            </div>
          </div>

          {/* totals strip */}
          <div style={{ display: 'flex', gap: spacing[3], padding: spacing[4], borderRadius: radii.lg, background: colors.bg[1], border: `1px solid ${colors.line[1]}`, marginBottom: spacing[5] }}>
            {([['ARS', 248600, 6], ['USD', 18.98, 2]] as const).map(([c, total, count]) => (
              <div key={c} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
                <Label>Total {c}</Label>
                <span style={{ ...font(weights.semibold), fontSize: 20, color: colors.fg[1], fontVariantNumeric: 'tabular-nums' }}>{formatMoney(total, c)}</span>
                <span style={{ ...font(weights.regular), fontSize: 12, color: colors.fg[3] }}>{count} gastos</span>
              </div>
            ))}
          </div>

          {/* recurrentes */}
          <div style={{ borderRadius: radii.lg, background: colors.bg[1], border: `1px solid ${colors.line[1]}`, overflow: 'hidden', marginBottom: spacing[5] }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing[3]}px ${spacing[4]}px`, borderBottom: `1px solid ${colors.line[1]}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                <Repeat size={16} color={colors.money.out} strokeWidth={1.5} />
                <Label>Gastos recurrentes</Label>
              </div>
              <Plus size={18} color={colors.brand[400]} strokeWidth={2} />
            </div>
            <RecurRow name="Alquiler" amount={145000} sub={<><span style={{ ...font(weights.regular), fontSize: 12, color: colors.fg[3] }}>Mensual</span><span style={{ color: colors.fg[3], fontSize: 12 }}>·</span><span style={{ ...font(weights.regular), fontSize: 12, color: colors.fg[3] }}>Próximo: 01/07</span></>} />
            <RecurRow name="Internet Fibertel" amount={16200} last sub={<span style={{ ...font(weights.regular), fontSize: 12, color: colors.fg[3] }}>Mensual</span>} />
          </div>

          {/* filter bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3], marginBottom: spacing[5] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], background: colors.bg[2], borderRadius: radii.md, border: `1px solid ${colors.line[2]}`, padding: `${spacing[2]}px ${spacing[3]}px`, minHeight: 44 }}>
              <Search size={18} color={colors.fg[3]} strokeWidth={1.5} />
              <span style={{ ...font(weights.regular), fontSize: 16, color: colors.fg[4] }}>Buscar por descripción</span>
            </div>
            <div style={{ display: 'flex', gap: spacing[2] }}>
              {['ARS', 'USD'].map((c) => (
                <div key={c} style={{ padding: `${spacing[1]}px ${spacing[3]}px`, borderRadius: radii.pill, border: `1px solid ${colors.line[2]}` }}>
                  <span style={{ ...font(weights.bold), fontSize: 12, color: colors.fg[2] }}>{c}</span>
                </div>
              ))}
              {[['Comida', '#F59E0B'], ['Ropa', '#8B5CF6'], ['Ocio', '#8B5CF6']].map(([name, color]) => (
                <div key={name} style={{ padding: `${spacing[1]}px ${spacing[3]}px`, borderRadius: radii.pill, border: `1px solid ${colors.line[2]}`, background: colors.bg[2] }}>
                  <span style={{ ...font(weights.semibold), fontSize: 12, color: colors.fg[2] }}>{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* day-grouped list */}
          <div style={{ paddingTop: spacing[2], paddingBottom: spacing[2] }}><Label>Hoy</Label></div>
          {HOY.map((r) => <ExpenseRow key={r.primary} r={r} />)}
          <div style={{ paddingTop: spacing[4], paddingBottom: spacing[2] }}><Label>Ayer</Label></div>
          {AYER.map((r) => <ExpenseRow key={r.primary} r={r} />)}
        </div>
      </div>
      <TabBar active="Gastos" />
    </div>
  );
};
