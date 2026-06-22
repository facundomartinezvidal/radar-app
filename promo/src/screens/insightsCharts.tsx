import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { colors, spacing, font, weights } from '../ds/tokens';
import { easeOut } from '../theme/anim';

const PLOT_W = 268;
const Y_W = 44;

// compact money for axis labels (mirrors formatMoneyCompact)
const compact = (v: number, currency: 'ARS' | 'USD' = 'ARS') => {
  const p = currency === 'USD' ? 'US$' : '$';
  if (v >= 1_000_000) { const r = (v / 1_000_000).toFixed(1).replace('.', ','); return `${p}${r.endsWith(',0') ? r.slice(0, -2) : r}M`; }
  if (v >= 1_000) return `${p}${Math.round(v / 1000)}k`;
  return `${p}${Math.round(v)}`;
};

const niceCeil = (v: number) => {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const mag = Math.pow(10, exp);
  const n = v / mag;
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return f * mag;
};

const microLabel: React.CSSProperties = { ...font(weights.regular), fontSize: 11, color: colors.fg[3] };

const Gridlines: React.FC<{ max: number; height: number }> = ({ max, height }) => (
  <>
    {[0, 1, 2, 3, 4].map((i) => {
      const v = (max / 4) * (4 - i);
      const top = (height / 4) * i;
      return (
        <div key={i} style={{ position: 'absolute', left: Y_W, right: 0, top }}>
          <div style={{ borderTop: `1px solid ${colors.line[1]}` }} />
          <span style={{ position: 'absolute', right: '100%', top: -8, width: Y_W - 6, textAlign: 'right', ...microLabel }}>{compact(v)}</span>
        </div>
      );
    })}
  </>
);

// ---- Donut (CategoryDonut: r80 inner54) ----
export const CategorySlices = [
  { name: 'Comida', total: 84200, color: '#10B981' },
  { name: 'Transporte', total: 41500, color: '#1E99CC' },
  { name: 'Ocio', total: 32800, color: '#F59E0B' },
  { name: 'Servicios', total: 21900, color: '#8B5CF6' },
];
const DTOTAL = CategorySlices.reduce((s, c) => s + c.total, 0);

export const Donut: React.FC<{ loadStart?: number }> = ({ loadStart }) => {
  const frame = useCurrentFrame();
  const reveal = loadStart == null ? 1 : interpolate(frame, [loadStart, loadStart + 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const r = 67; // (80+54)/2 stroke ring radius; strokeWidth = 80-54 = 26
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg width={160} height={160} viewBox="0 0 160 160">
          <g transform="rotate(-90 80 80)">
            {CategorySlices.map((c) => {
              const frac = c.total / DTOTAL;
              const len = C * frac * reveal;
              const seg = <circle key={c.name} cx={80} cy={80} r={r} fill="none" stroke={c.color} strokeWidth={26} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />;
              acc += C * frac;
              return seg;
            })}
          </g>
          <text x={80} y={78} textAnchor="middle" opacity={reveal} style={{ ...font(weights.semibold), fontSize: 13, fill: colors.fg[1] }}>$ 180.400</text>
          <text x={80} y={96} textAnchor="middle" opacity={reveal} style={{ ...font(weights.regular), fontSize: 11, fill: colors.fg[3] }}>gastado</text>
        </svg>
      </div>
      <div style={{ marginTop: spacing[4], display: 'flex', flexDirection: 'column', gap: spacing[2], opacity: reveal }}>
        {CategorySlices.map((c) => {
          const pct = ((c.total / DTOTAL) * 100).toFixed(1);
          return (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], flex: 1 }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, background: c.color }} />
                <span style={{ ...font(weights.regular), fontSize: 14, color: colors.fg[2] }}>{c.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
                <span style={{ ...microLabel, minWidth: 40, textAlign: 'right' }}>{pct}%</span>
                <span style={{ ...font(weights.semibold), fontSize: 14, color: colors.fg[1], fontVariantNumeric: 'tabular-nums', minWidth: 92, textAlign: 'right' }}>{`$ ${c.total.toLocaleString('es-AR')},00`}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---- Period bar chart (single series, money.out) ----
const PERIOD = [
  { label: '01/jun', total: 38400 },
  { label: '08/jun', total: 52100 },
  { label: '15/jun', total: 29800 },
  { label: '22/jun', total: 44600 },
  { label: '29/jun', total: 15500 },
];
export const PeriodBars: React.FC<{ loadStart?: number }> = ({ loadStart }) => {
  const frame = useCurrentFrame();
  const grow = loadStart == null ? 1 : interpolate(frame, [loadStart, loadStart + 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const H = 200;
  const max = niceCeil(Math.max(...PERIOD.map((d) => d.total)));
  return (
    <div>
      <div style={{ position: 'relative', height: H, marginLeft: 0 }}>
        <Gridlines max={max} height={H} />
        <div style={{ position: 'absolute', left: Y_W, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', borderLeft: `1px solid ${colors.line[2]}`, borderBottom: `1px solid ${colors.line[2]}` }}>
          {PERIOD.map((d) => (
            <div key={d.label} style={{ width: 30, height: (d.total / max) * H * grow, background: colors.money.out, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginLeft: Y_W, marginTop: 6 }}>
        {PERIOD.map((d) => <span key={d.label} style={microLabel}>{d.label}</span>)}
      </div>
      <div style={{ textAlign: 'right', marginTop: spacing[2] }}><span style={{ ...font(weights.regular), fontSize: 11, color: colors.fg[4] }}>ARS</span></div>
    </div>
  );
};

// ---- Income vs expense grouped bars ----
const IVE = [
  { m: 'ene', inc: 210000, exp: 168000 },
  { m: 'feb', inc: 198000, exp: 175000 },
  { m: 'mar', inc: 232000, exp: 159000 },
  { m: 'abr', inc: 221000, exp: 188000 },
  { m: 'may', inc: 246000, exp: 171000 },
  { m: 'jun', inc: 254000, exp: 180400 },
];
export const IncomeVsExpense: React.FC<{ loadStart?: number }> = ({ loadStart }) => {
  const frame = useCurrentFrame();
  const grow = loadStart == null ? 1 : interpolate(frame, [loadStart, loadStart + 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const H = 200;
  const max = niceCeil(Math.max(...IVE.flatMap((d) => [d.inc, d.exp])));
  return (
    <div>
      <div style={{ position: 'relative', height: H }}>
        <Gridlines max={max} height={H} />
        <div style={{ position: 'absolute', left: Y_W, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', borderLeft: `1px solid ${colors.line[2]}`, borderBottom: `1px solid ${colors.line[2]}` }}>
          {IVE.map((d) => (
            <div key={d.m} style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
              <div style={{ width: 14, height: (d.inc / max) * H * grow, background: colors.money.in, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
              <div style={{ width: 14, height: (d.exp / max) * H * grow, background: colors.money.out, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginLeft: Y_W, marginTop: 6 }}>
        {IVE.map((d) => <span key={d.m} style={microLabel}>{d.m}</span>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: spacing[5], marginTop: spacing[3] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}><div style={{ width: 10, height: 10, borderRadius: 3, background: colors.money.in }} /><span style={{ ...font(weights.regular), fontSize: 12, color: colors.fg[2] }}>Ingresos</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}><div style={{ width: 10, height: 10, borderRadius: 3, background: colors.money.out }} /><span style={{ ...font(weights.regular), fontSize: 12, color: colors.fg[2] }}>Gastos</span></div>
      </div>
    </div>
  );
};

// ---- Monthly trend line (area, curved, dots) ----
const TREND = [168000, 175000, 159000, 188000, 171000, 180400];
const TREND_M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun'];
export const TrendLine: React.FC<{ loadStart?: number }> = ({ loadStart }) => {
  const frame = useCurrentFrame();
  const draw = loadStart == null ? 1 : interpolate(frame, [loadStart, loadStart + 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const H = 220;
  const max = niceCeil(Math.max(...TREND));
  const n = TREND.length;
  const pts = TREND.map((v, i) => ({ x: Y_W + 8 + (i * (PLOT_W - 8)) / (n - 1), y: H - (v / max) * H }));
  const linePath = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const areaPath = `${linePath} L ${pts[n - 1].x} ${H} L ${pts[0].x} ${H} Z`;
  const totalLen = 1200;
  return (
    <div>
      <div style={{ position: 'relative', height: H }}>
        <Gridlines max={max} height={H} />
        <svg width={Y_W + PLOT_W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={colors.brand[500]} stopOpacity="0.25" />
              <stop offset="1" stopColor={colors.brand[500]} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#trendFill)" opacity={draw} />
          <path d={linePath} fill="none" stroke={colors.brand[500]} strokeWidth={2} strokeDasharray={totalLen} strokeDashoffset={totalLen * (1 - draw)} />
          {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.brand[300]} opacity={draw} />)}
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginLeft: Y_W + 8, marginRight: 4, marginTop: 6 }}>
        {TREND_M.map((m) => <span key={m} style={microLabel}>{m}</span>)}
      </div>
      <div style={{ textAlign: 'right', marginTop: spacing[2] }}><span style={{ ...font(weights.regular), fontSize: 11, color: colors.fg[4] }}>ARS</span></div>
    </div>
  );
};
