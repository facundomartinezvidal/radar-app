import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Sparkles, Image as ImageIcon, FileText } from 'lucide-react';
import { colors, spacing, radii, font, weights } from '../ds/tokens';

const Receipt: React.FC = () => (
  <div style={{ width: 230, height: 280, background: '#F4F7FB', borderRadius: 10, padding: 18, transform: 'rotate(-3deg)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
    <div style={{ ...font(weights.extrabold), fontSize: 16, color: '#0A0F1A' }}>RAPSODIA</div>
    <div style={{ ...font(weights.regular), fontSize: 10, color: '#6B7585', marginTop: 2 }}>Alto Palermo · Local 142</div>
    <div style={{ height: 1, background: '#C0C7D2', margin: '12px 0' }} />
    {[['Remera oversize', '18.900'], ['Jean mom', '27.000'], ['Medias x2', '3.000']].map(([k, v]) => (
      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 11, color: '#3A4458', marginBottom: 6 }}><span>{k}</span><span>{v}</span></div>
    ))}
    <div style={{ height: 1, background: '#C0C7D2', margin: '12px 0' }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: '#0A0F1A' }}><span>TOTAL</span><span>48.900,00</span></div>
    <div style={{ ...font(weights.regular), fontSize: 9, color: '#6B7585', marginTop: 14, textAlign: 'center' }}>¡Gracias por tu compra!</div>
  </div>
);

// Internal timeline: aim (0-55) → shutter press + flash (55-72) → analyzing (72+)
export const ScanScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const analyzing = frame >= 70;

  const shutterScale = interpolate(frame, [52, 58, 66], [1, 0.86, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const flash = interpolate(frame, [56, 60, 74], [0, 0.9, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // scan line loops once analyzing
  const cycle = 70;
  const lf = Math.max(0, frame - 74);
  const t = (lf % cycle) / cycle;
  const scanY = interpolate(t, [0, 1], [0, 300]);
  const scanOp = analyzing ? interpolate(t, [0, 0.1, 0.85, 1], [0, 1, 1, 0]) : 0;
  const dots = '.'.repeat(1 + (Math.floor(frame / 12) % 3));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#05080F', position: 'relative' }}>
      {/* top hint */}
      <div style={{ padding: `${spacing[5]}px ${spacing[5]}px 0`, display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: spacing[2], background: 'rgba(0,0,0,0.4)', borderRadius: radii.pill, padding: `${spacing[2]}px ${spacing[4]}px` }}>
          <span style={{ ...font(weights.medium), fontSize: 14, color: colors.fg[1] }}>{analyzing ? 'Procesando…' : 'Apuntá al ticket'}</span>
        </div>
      </div>

      {/* viewfinder */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ position: 'relative', width: 300, height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Receipt />
          {[
            { top: 0, left: 0, borderTop: `3px solid ${colors.brand[300]}`, borderLeft: `3px solid ${colors.brand[300]}`, borderTopLeftRadius: 8 },
            { top: 0, right: 0, borderTop: `3px solid ${colors.brand[300]}`, borderRight: `3px solid ${colors.brand[300]}`, borderTopRightRadius: 8 },
            { bottom: 0, left: 0, borderBottom: `3px solid ${colors.brand[300]}`, borderLeft: `3px solid ${colors.brand[300]}`, borderBottomLeftRadius: 8 },
            { bottom: 0, right: 0, borderBottom: `3px solid ${colors.brand[300]}`, borderRight: `3px solid ${colors.brand[300]}`, borderBottomRightRadius: 8 },
          ].map((p, i) => <div key={i} style={{ position: 'absolute', width: 40, height: 40, ...p }} />)}
          <div style={{ position: 'absolute', left: 8, right: 8, top: 20 + scanY * 0.85, height: 3, background: colors.brand[300], boxShadow: `0 0 20px 5px ${colors.brand[300]}`, opacity: scanOp, borderRadius: 2 }} />
        </div>
      </div>

      {/* analyzing pill (only after capture) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: spacing[6], height: 48, alignItems: 'center' }}>
        {analyzing && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: spacing[2], background: 'rgba(0,119,182,0.16)', border: `1px solid ${colors.brand[400]}`, borderRadius: radii.pill, padding: `${spacing[3]}px ${spacing[5]}px` }}>
            <Sparkles size={18} color={colors.brand[300]} strokeWidth={1.5} />
            <span style={{ ...font(weights.semibold), fontSize: 15, color: colors.brand[300] }}>Analizando con IA{dots}</span>
          </div>
        )}
      </div>

      {/* bottom controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing[8], paddingBottom: spacing[8] }}>
        <ImageIcon size={26} color={colors.fg[2]} strokeWidth={1.5} />
        <div style={{ width: 72, height: 72, borderRadius: 36, border: `4px solid ${colors.fg[1]}`, padding: 4, transform: `scale(${shutterScale})` }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 30, background: colors.fg[1] }} />
        </div>
        <FileText size={26} color={colors.fg[2]} strokeWidth={1.5} />
      </div>

      {/* capture flash */}
      <div style={{ position: 'absolute', inset: 0, background: '#FFFFFF', opacity: flash, pointerEvents: 'none' }} />
    </div>
  );
};
