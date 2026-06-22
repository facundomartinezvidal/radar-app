import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { colors } from '../ds/tokens';
import { fontFamily } from '../theme/fonts';
import { Device } from '../ds/Device';
import { Home, GastosCard, IngresosCard, HOME_TOUR } from '../screens/Home';
import { LogoSweep, Tagline } from '../components/LogoSweep';
import { KineticText } from '../components/KineticText';
import { MusicSlot } from '../components/MusicSlot';
import { easeOut } from '../theme/anim';

const OVERLAY_SCALE = 2.35;
const HOME_START = 92;

// [enterStart, exitStart] for each forward card.
const W_GASTOS: [number, number] = [250, 335];
const W_INGRESOS: [number, number] = [395, 480];

const presence = (frame: number, [inS, outS]: [number, number]) =>
  interpolate(frame, [inS, inS + 16, outS, outS + 22], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const Forward: React.FC<{ win: [number, number]; children: React.ReactNode }> = ({ win, children }) => {
  const frame = useCurrentFrame();
  const [inS, outS] = win;
  if (frame < inS - 4 || frame > outS + 26) return null;
  const e = interpolate(frame, [inS, inS + 22, inS + 32], [0, 1.04, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const opIn = interpolate(frame, [inS, inS + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const x = interpolate(frame, [outS, outS + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const s = OVERLAY_SCALE * (0.6 + 0.4 * e) * (1 - 0.18 * x);
  const ty = (1 - e) * 60 - x * 40;
  const rotX = (1 - e) * 9;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ perspective: 1500 }}>
        <div style={{ opacity: opIn * (1 - x), transform: `translateY(${ty}px) rotateX(${rotX}deg) scale(${s})`, transformOrigin: 'center center', filter: 'drop-shadow(0 50px 90px rgba(0,0,0,0.7))' }}>
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const HomeOverview: React.FC<{ music?: string }> = ({ music }) => {
  const frame = useCurrentFrame();

  const introOpacity = interpolate(frame, [10, 30, 84, 100], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const reveal = interpolate(frame, [88, 122], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const exitV = interpolate(frame, [520, 546], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const present = reveal * (1 - exitV);
  const dim = Math.max(presence(frame, W_GASTOS), presence(frame, W_INGRESOS));
  const phoneScale = 1.5 - 0.1 * dim - 0.13 * (1 - present);
  const phoneOpacity = present * (1 - 0.5 * dim);

  // Phone behind: top → gastos → ingresos (scroll only between forward cards).
  const scrollY = interpolate(
    frame,
    [0, 122, 210, 245, 355, 390, 600],
    [0, 0, 0, HOME_TOUR.gastos, HOME_TOUR.gastos, HOME_TOUR.ingresos, HOME_TOUR.ingresos],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut },
  );

  const outroTextOpacity = interpolate(frame, [548, 566, 588, 600], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoOpacity = interpolate(frame, [594, 620], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoScale = interpolate(frame, [594, 624], [0.85, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const showLogo = frame >= 592;

  return (
    <AbsoluteFill style={{ background: colors.bg[0], fontFamily }}>
      <MusicSlot src={music} />

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 900, height: 900, borderRadius: 9999, background: 'radial-gradient(circle, rgba(0,119,182,0.20), rgba(0,119,182,0) 62%)', opacity: Math.max(present, logoOpacity) }} />
      </AbsoluteFill>

      {/* intro text */}
      {frame < 102 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <div style={{ opacity: introOpacity }}>
            <KineticText lines={['Toda tu plata,', 'en una pantalla.']} size={62} weight={800} align="center" maxWidth={980} />
          </div>
        </AbsoluteFill>
      )}

      {/* phone behind */}
      {present > 0.001 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: phoneOpacity }}>
          <Device scale={phoneScale}>
            <Sequence from={HOME_START} layout="none">
              <Home scrollY={scrollY} />
            </Sequence>
          </Device>
        </AbsoluteFill>
      )}

      {/* forward cards: gastos + ingresos */}
      <Forward win={W_GASTOS}>
        <Sequence from={W_GASTOS[0]} layout="none"><GastosCard /></Sequence>
      </Forward>
      <Forward win={W_INGRESOS}>
        <Sequence from={W_INGRESOS[0]} layout="none"><IngresosCard /></Sequence>
      </Forward>

      {/* outro text */}
      {frame >= 544 && frame < 602 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <div style={{ opacity: outroTextOpacity }}>
            <KineticText lines={['Sabé en qué', 'estás parado.']} size={58} weight={800} align="center" maxWidth={980} />
          </div>
        </AbsoluteFill>
      )}

      {/* final big logo */}
      {showLogo && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <div style={{ opacity: logoOpacity, transform: `scale(${logoScale})` }}>
            <LogoSweep variant="wordmark" size={172} />
          </div>
          <div style={{ opacity: logoOpacity }}>
            <Tagline size={30} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
