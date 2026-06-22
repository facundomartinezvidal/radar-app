import React from 'react';
import { Home, Receipt, TrendingUp, Camera, Compass, Signal, Wifi, BatteryFull } from 'lucide-react';
import { colors, font, weights } from './tokens';

export const SCREEN_W = 393;
export const SCREEN_H = 852;

const TABS = [
  { label: 'Inicio', Icon: Home },
  { label: 'Gastos', Icon: Receipt },
  { label: 'Ingresos', Icon: TrendingUp },
  { label: 'Cámara', Icon: Camera },
  { label: 'Insights', Icon: Compass },
] as const;

export const TabBar: React.FC<{ active?: string }> = ({ active = 'Inicio' }) => (
  <div style={{ height: 84, background: colors.bg[1], borderTop: `1px solid ${colors.line[1]}`, display: 'flex', alignItems: 'flex-start', paddingTop: 10, flexShrink: 0 }}>
    {TABS.map(({ label, Icon }) => {
      const on = label === active;
      const color = on ? colors.brand[400] : colors.fg[3];
      return (
        <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Icon size={24} color={color} strokeWidth={1.5} />
          <span style={{ ...font(weights.medium), fontSize: 11, color }}>{label}</span>
        </div>
      );
    })}
  </div>
);

const StatusBar: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const fg = dark ? '#FFFFFF' : colors.fg[1];
  return (
    <div style={{ height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', flexShrink: 0 }}>
      <span style={{ ...font(weights.semibold), fontSize: 15, color: fg }}>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Signal size={17} color={fg} strokeWidth={2} />
        <Wifi size={17} color={fg} strokeWidth={2} />
        <BatteryFull size={24} color={fg} strokeWidth={1.5} />
      </div>
    </div>
  );
};

/** Realistic phone with a screen at true device resolution; scaled by the caller. */
export const Device: React.FC<{
  children: React.ReactNode;
  screenBg?: string;
  statusBarDark?: boolean;
  scale?: number;
  style?: React.CSSProperties;
}> = ({ children, screenBg = colors.bg[0], statusBarDark, scale = 1, style }) => {
  const bezel = 14;
  return (
    <div
      style={{
        width: SCREEN_W + bezel * 2,
        height: SCREEN_H + bezel * 2,
        transform: `scale(${scale})`,
        borderRadius: 68,
        padding: bezel,
        background: '#05080F',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 40px 90px rgba(0,0,0,0.6)',
        ...style,
      }}
    >
      <div style={{ width: SCREEN_W, height: SCREEN_H, borderRadius: 54, background: screenBg, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <StatusBar dark={statusBarDark} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</div>
      </div>
    </div>
  );
};
