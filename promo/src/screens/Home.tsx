import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Bell, Plus, Users, Tags, TrendingUp, Sparkles, ChevronRight, Utensils, Zap, PartyPopper, Laptop, Wallet, Repeat } from 'lucide-react';
import { colors, spacing, radii, font, weights } from '../ds/tokens';
import { T } from '../ds/Text';
import { Card, Pill, Avatar, formatMoney } from '../ds/primitives';
import { TabBar } from '../ds/Device';
import { enter } from '../theme/anim';

const QUICK = [
  { label: 'Agregar', Icon: Plus },
  { label: 'Grupos', Icon: Users },
  { label: 'Categorías', Icon: Tags },
  { label: 'Ingresos', Icon: TrendingUp },
] as const;

const GROUPS = ['La banda de radar · 2 miembros', 'Depto compañeros · 3 miembros'];

type ExpRow = { Icon: typeof Utensils; color: string; name: string; meta: string; amount: number; cur: 'ARS' | 'USD' };
const EXPENSES: ExpRow[] = [
  { Icon: Utensils, color: '#F59E0B', name: 'Coto', meta: 'Comida · ayer', amount: 38500, cur: 'ARS' },
  { Icon: Zap, color: '#F59E0B', name: 'Internet Fibertel', meta: 'Servicios · hace 2 días', amount: 16200, cur: 'ARS' },
  { Icon: PartyPopper, color: '#8B5CF6', name: 'Spotify Premium', meta: 'Ocio · hace 2 días', amount: 5.99, cur: 'USD' },
  { Icon: PartyPopper, color: '#8B5CF6', name: 'Netflix', meta: 'Ocio · hace 2 días', amount: 12.99, cur: 'USD' },
];

type IncRow = { Icon: typeof Laptop; color: string; name: string; cat: string; amount: number; cur: 'ARS' | 'USD'; recurrent?: boolean };
const INCOMES: IncRow[] = [
  { Icon: Laptop, color: '#1E99CC', name: 'Proyecto freelance', cat: 'Freelance', amount: 269, cur: 'USD', recurrent: true },
  { Icon: Wallet, color: '#10B981', name: 'Medio aguinaldo', cat: 'Sueldo', amount: 455000, cur: 'ARS' },
  { Icon: Wallet, color: '#10B981', name: 'Sueldo', cat: 'Sueldo', amount: 1068000, cur: 'ARS', recurrent: true },
  { Icon: Laptop, color: '#1E99CC', name: 'Changa diseño', cat: 'Freelance', amount: 129000, cur: 'ARS' },
];

const Row: React.FC<{ Icon: typeof Utensils; color: string; name: string; meta: React.ReactNode; amount: number; cur: 'ARS' | 'USD'; tone: 'in' | 'out'; last: boolean; delay: number }> = ({ Icon, color, name, meta, amount, cur, tone, last, delay }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ ...enter(frame, { delay }) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], paddingTop: spacing[3], paddingBottom: spacing[3] }}>
        <div style={{ width: 40, height: 40, borderRadius: 20, background: `${color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} color={color} strokeWidth={1.5} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...font(weights.medium), fontSize: 16, color: colors.fg[1], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>{meta}</div>
        </div>
        <T variant="money" tone={tone} style={{ whiteSpace: 'nowrap' }}>{formatMoney(amount, cur, tone === 'in' ? { showPlus: true } : {})}</T>
      </div>
      {!last && <div style={{ height: 1, background: colors.line[1] }} />}
    </div>
  );
};

const meta = (text: string, recurrent?: boolean) => (
  <>
    <span style={{ ...font(weights.regular), fontSize: 12, color: colors.fg[3] }}>{text}</span>
    {recurrent && (<><span style={{ color: colors.fg[3], fontSize: 12 }}>·</span><Repeat size={12} color={colors.money.in} strokeWidth={1.5} /><span style={{ ...font(weights.regular), fontSize: 12, color: colors.money.in }}>Recurrente</span></>)}
  </>
);

const SectionHead: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${spacing[5]}px`, marginBottom: spacing[3] }}>
    <T variant="h3">{title}</T>
    <span style={{ ...font(weights.semibold), fontSize: 14, color: colors.brand[300] }}>Ver todos</span>
  </div>
);

// Scroll targets that frame each card behind the forward overlay.
export const HOME_TOUR = { gastos: 356, ingresos: 708 } as const;

// Forward-overlay cards (native phone width + app padding), for the zoom tour.
export const GastosCard: React.FC = () => (
  <div style={{ width: 393, padding: `0 ${spacing[5]}px` }}>
    <T variant="h3" style={{ marginBottom: spacing[3] }}>Últimos gastos</T>
    <Card variant="base" padding={4}>
      {EXPENSES.map((e, i) => (
        <Row key={e.name} Icon={e.Icon} color={e.color} name={e.name} meta={meta(e.meta)} amount={e.amount} cur={e.cur} tone="out" last={i === EXPENSES.length - 1} delay={6 + i * 7} />
      ))}
    </Card>
  </div>
);

export const IngresosCard: React.FC = () => (
  <div style={{ width: 393, padding: `0 ${spacing[5]}px` }}>
    <T variant="h3" style={{ marginBottom: spacing[3] }}>Últimos ingresos</T>
    <Card variant="base" padding={4}>
      {INCOMES.map((inc, i) => (
        <Row key={inc.name} Icon={inc.Icon} color={inc.color} name={inc.name} meta={meta(inc.cat, inc.recurrent)} amount={inc.amount} cur={inc.cur} tone="in" last={i === INCOMES.length - 1} delay={6 + i * 7} />
      ))}
    </Card>
  </div>
);

export const Home: React.FC<{ scrollY?: number }> = ({ scrollY = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflow: 'hidden', paddingBottom: spacing[4], position: 'relative' }}>
        <div style={{ transform: `translateY(${-scrollY}px)` }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing[4]}px ${spacing[5]}px ${spacing[3]}px` }}>
            <T variant="h2">Hola, Facu</T>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
              <Avatar firstName="Facu" lastName="Martinez" size={36} />
              <Bell size={24} color={colors.fg[2]} strokeWidth={1.5} />
            </div>
          </div>

          {/* balance hero */}
          <Card variant="raised" padding={6} style={{ margin: `0 ${spacing[5]}px ${spacing[5]}px`, ...enter(frame, { delay: 6 }) }}>
            <T variant="label">Balance del mes</T>
            <T variant="display" color={colors.money.in} style={{ marginTop: spacing[1], whiteSpace: 'nowrap' }}>{formatMoney(421450, 'ARS', { showPlus: true })}</T>
            <span style={{ ...font(weights.regular), fontSize: 12, color: colors.money.in, display: 'block', marginTop: spacing[1] }}>{formatMoney(221.02, 'USD', { showPlus: true })}</span>
            <div style={{ display: 'flex', gap: spacing[3], marginTop: spacing[3], flexWrap: 'wrap' }}>
              <Pill variant="income">{`Ingresos ${formatMoney(1523000, 'ARS')}`}</Pill>
              <Pill variant="expense">{`Gastos ${formatMoney(1101550, 'ARS')}`}</Pill>
            </div>
          </Card>

          {/* quick actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: `0 ${spacing[5]}px`, marginBottom: spacing[6] }}>
            {QUICK.map((q, i) => (
              <div key={q.label} style={{ ...enter(frame, { delay: 12 + i * 4 }) }}>
                <div style={{ width: 72, height: 72, background: colors.bg[1], borderRadius: radii.md, border: `1px solid ${colors.line[1]}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <q.Icon size={24} color={colors.fg[1]} strokeWidth={1.5} />
                  <span style={{ ...font(weights.regular), fontSize: 11, color: colors.fg[2] }}>{q.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* mis grupos */}
          <SectionHead title="Mis grupos" />
          <div style={{ display: 'flex', gap: spacing[3], padding: `0 ${spacing[5]}px`, marginBottom: spacing[6], ...enter(frame, { delay: 22 }) }}>
            {GROUPS.map((g) => <Pill key={g} variant="neutral">{g}</Pill>)}
          </div>

          {/* últimos gastos */}
          <SectionHead title="Últimos gastos" />
          <Card variant="base" padding={4} style={{ margin: `0 ${spacing[5]}px ${spacing[6]}px`, ...enter(frame, { delay: 28 }) }}>
            {EXPENSES.map((e, i) => (
              <Row key={e.name} Icon={e.Icon} color={e.color} name={e.name} meta={meta(e.meta)} amount={e.amount} cur={e.cur} tone="out" last={i === EXPENSES.length - 1} delay={34 + i * 6} />
            ))}
          </Card>

          {/* últimos ingresos */}
          <SectionHead title="Últimos ingresos" />
          <Card variant="base" padding={4} style={{ margin: `0 ${spacing[5]}px ${spacing[6]}px`, ...enter(frame, { delay: 40 }) }}>
            {INCOMES.map((inc, i) => (
              <Row key={inc.name} Icon={inc.Icon} color={inc.color} name={inc.name} meta={meta(inc.cat, inc.recurrent)} amount={inc.amount} cur={inc.cur} tone="in" last={i === INCOMES.length - 1} delay={46 + i * 6} />
            ))}
          </Card>

          {/* insight IA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], margin: `0 ${spacing[5]}px`, background: 'rgba(0,119,182,0.08)', border: '1px solid rgba(0,119,182,0.20)', borderRadius: radii.md, padding: spacing[4], ...enter(frame, { delay: 58 }) }}>
            <Sparkles size={20} color={colors.brand[300]} strokeWidth={1.5} />
            <span style={{ ...font(weights.regular), fontSize: 14, lineHeight: '21px', color: colors.fg[2], flex: 1 }}>Este mes gastaste 18% más en delivery que el mes pasado.</span>
            <ChevronRight size={18} color={colors.fg[3]} strokeWidth={1.5} />
          </div>
        </div>
      </div>
      <TabBar active="Inicio" />
    </div>
  );
};
