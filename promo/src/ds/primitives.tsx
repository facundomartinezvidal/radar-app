import React from 'react';
import { colors, radii, spacing, shadowTwo, font, weights } from './tokens';

// ---- Money format (mirrors lib/format/money.ts) ----
export const formatMoney = (
  amount: number,
  currency: 'ARS' | 'USD',
  opts: { showPlus?: boolean; hideCurrency?: boolean } = {},
): string => {
  const sign = amount < 0 ? '-' : opts.showPlus ? '+' : '';
  const abs = Math.abs(amount);
  const num = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }).format(abs);
  if (opts.hideCurrency) return `${sign}${num}`;
  const prefix = currency === 'USD' ? 'US$' : '$';
  return `${sign}${prefix} ${num}`;
};

// ---- Card (mirrors components/ui/card.tsx) ----
export const Card: React.FC<{
  variant?: 'base' | 'raised';
  padding?: keyof typeof spacing;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ variant = 'base', padding = 6, children, style }) => {
  const raised = variant === 'raised';
  return (
    <div
      style={{
        backgroundColor: raised ? colors.bg[2] : colors.bg[1],
        borderRadius: radii.lg,
        border: `1px solid ${raised ? colors.line[2] : colors.line[1]}`,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        padding: spacing[padding],
        boxShadow: shadowTwo,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ---- Pill (mirrors components/ui/pill.tsx) ----
type PillVariant = 'neutral' | 'income' | 'expense' | 'alert' | 'brand';
const PILL: Record<PillVariant, { background: string; border: string; text: string }> = {
  neutral: { background: 'rgba(255,255,255,0.06)', border: colors.line[2], text: colors.fg[2] },
  income: { background: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: colors.money.in },
  expense: { background: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: colors.money.out },
  alert: { background: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: colors.amber[500] },
  brand: { background: 'rgba(0,119,182,0.12)', border: 'rgba(0,119,182,0.3)', text: colors.brand[300] },
};
export const Pill: React.FC<{ variant?: PillVariant; size?: 'sm' | 'md'; icon?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
  style,
}) => {
  const c = PILL[variant];
  const pad = size === 'sm' ? { paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10 } : { paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 12 };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: radii.pill, border: `1px solid ${c.border}`, background: c.background, ...pad, ...style }}>
      {icon}
      <span style={{ ...font(weights.semibold), fontSize: 12, lineHeight: '16px', color: c.text }}>{children}</span>
    </div>
  );
};

// ---- Avatar (mirrors components/ui/avatar.tsx) ----
// Deterministic hash color (approx of lib/avatar/hash-color).
const PALETTE = ['#0077B6', '#1E99CC', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#0EA5E9', '#14B8A6'];
const hashColor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};
export const Avatar: React.FC<{ firstName?: string; lastName?: string; size?: number }> = ({ firstName, lastName, size = 36 }) => {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  const bg = initials ? hashColor(`${firstName ?? ''} ${lastName ?? ''}`) : colors.bg[2];
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ ...font(weights.semibold), fontSize: Math.round(size * 0.4), color: initials ? colors.fg.onBrand : colors.fg[2] }}>{initials || '?'}</span>
    </div>
  );
};

// ---- Buttons (subset used in screens) ----
export const SecondaryButton: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', paddingTop: 8, paddingBottom: 8, paddingLeft: 14, paddingRight: 14, borderRadius: radii.sm, border: `1px solid ${colors.line[2]}`, background: colors.bg[2], ...style }}>
    <span style={{ ...font(weights.semibold), fontSize: 14, color: colors.fg[1] }}>{children}</span>
  </div>
);
export const PrimaryButton: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: radii.md, background: colors.brand[500], ...style }}>
    <span style={{ ...font(weights.semibold), fontSize: 16, color: colors.fg.onBrand }}>{children}</span>
  </div>
);
