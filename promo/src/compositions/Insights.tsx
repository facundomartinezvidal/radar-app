import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors } from '../ds/tokens';
import { fontFamily } from '../theme/fonts';
import { Device } from '../ds/Device';
import { Insights as InsightsScreen, OverlaySection, TOUR } from '../screens/Insights';
import { LogoSweep, Tagline } from '../components/LogoSweep';
import { KineticText } from '../components/KineticText';
import { MusicSlot } from '../components/MusicSlot';
import { easeOut } from '../theme/anim';

const OVERLAY_SCALE = 2.35;

type Sec = 'donut' | 'period' | 'ive' | 'trend' | 'recs';
const WINDOWS: Record<Sec, [number, number]> = {
  donut: [150, 198],
  period: [270, 318],
  ive: [390, 438],
  trend: [510, 558],
  recs: [630, 712],
};

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

export const Insights: React.FC<{ music?: string }> = ({ music }) => {
  const frame = useCurrentFrame();
  const { donut: D, period: P, ive: I, trend: Tn, recs: R } = TOUR;

  const scrollY = interpolate(
    frame,
    [0, 110, 140, 224, 256, 344, 376, 464, 496, 584, 616, 810],
    [0, 0, D, D, P, P, I, I, Tn, Tn, R, R],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut },
  );

  // Phone reveal (after intro) and outro exit.
  const reveal = interpolate(frame, [80, 115], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const exitV = interpolate(frame, [715, 745], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const present = reveal * (1 - exitV);
  const dim = Math.max(...Object.values(WINDOWS).map((w) => presence(frame, w)));
  const phoneOpacity = present * (1 - 0.5 * dim);
  const phoneScale = 1.42 - 0.1 * dim - 0.13 * (1 - present);

  let highlightIndex: number | undefined;
  if (frame >= 645 && frame < 710) highlightIndex = Math.min(2, Math.floor((frame - 645) / 22));

  // Intro / outro text + final logo.
  const introOpacity = interpolate(frame, [10, 30, 82, 100], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const outroTextOpacity = interpolate(frame, [742, 760, 778, 792], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoOpacity = interpolate(frame, [786, 806], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoScale = interpolate(frame, [786, 812], [0.82, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const showOutroText = frame >= 740 && frame < 794;
  const showLogo = frame >= 784;

  return (
    <AbsoluteFill style={{ background: colors.bg[0], fontFamily }}>
      <MusicSlot src={music} />

      {/* ambient glow */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 900, height: 900, borderRadius: 9999, background: 'radial-gradient(circle, rgba(0,119,182,0.18), rgba(0,119,182,0) 62%)', opacity: Math.max(present, logoOpacity) }} />
      </AbsoluteFill>

      {/* intro text (no phone) */}
      {frame < 102 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <div style={{ opacity: introOpacity }}>
            <KineticText lines={['¿Sabés en qué', 'se te fue la plata?']} size={64} weight={800} align="center" maxWidth={980} />
          </div>
        </AbsoluteFill>
      )}

      {/* phone behind */}
      {present > 0.001 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: phoneOpacity }}>
          <Device scale={phoneScale}>
            <InsightsScreen scrollY={scrollY} />
          </Device>
        </AbsoluteFill>
      )}

      {/* sections flying forward */}
      <Forward win={WINDOWS.donut}><OverlaySection section="donut" loadStart={WINDOWS.donut[0]} /></Forward>
      <Forward win={WINDOWS.period}><OverlaySection section="period" loadStart={WINDOWS.period[0]} /></Forward>
      <Forward win={WINDOWS.ive}><OverlaySection section="ive" loadStart={WINDOWS.ive[0]} /></Forward>
      <Forward win={WINDOWS.trend}><OverlaySection section="trend" loadStart={WINDOWS.trend[0]} /></Forward>
      <Forward win={WINDOWS.recs}><OverlaySection section="recs" highlightIndex={highlightIndex} /></Forward>

      {/* outro text */}
      {showOutroText && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <div style={{ opacity: outroTextOpacity }}>
            <KineticText lines={['RADAR te lo', 'muestra claro.']} size={62} weight={800} align="center" maxWidth={980} />
          </div>
        </AbsoluteFill>
      )}

      {/* final big centered logo */}
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
