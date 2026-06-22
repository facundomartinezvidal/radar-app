import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { colors } from '../ds/tokens';
import { fontFamily } from '../theme/fonts';
import { Device } from '../ds/Device';
import { ScanScreen } from '../screens/ScanScreen';
import { ReviewScreen, RecommendationCard } from '../screens/ReviewScreen';
import { ExpensesResult, NewExpenseCard } from '../screens/ExpensesResult';
import { LogoSweep, Tagline } from '../components/LogoSweep';
import { KineticText } from '../components/KineticText';
import { MusicSlot } from '../components/MusicSlot';
import { easeOut } from '../theme/anim';

const SCAN_START = 92;
const REVIEW_START = 322;
const RESULT_START = 642;
// AI category-recommendation card flies forward during review (before it's created).
const W_REC: [number, number] = [424, 488];
// New-expense card flies forward over the (static) Gastos list.
const W_NEW: [number, number] = [712, 802];

const presence = (frame: number, [inS, outS]: [number, number]) =>
  interpolate(frame, [inS, inS + 16, outS, outS + 22], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const Forward: React.FC<{ win: [number, number]; children: React.ReactNode }> = ({ win, children }) => {
  const frame = useCurrentFrame();
  const [inS, outS] = win;
  if (frame < inS - 4 || frame > outS + 26) return null;
  const e = interpolate(frame, [inS, inS + 22, inS + 32], [0, 1.04, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const opIn = interpolate(frame, [inS, inS + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const x = interpolate(frame, [outS, outS + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const s = 2.35 * (0.6 + 0.4 * e) * (1 - 0.18 * x);
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

const StepCaption: React.FC<{ from: number; to: number; text: string }> = ({ from, to, text }) => {
  const frame = useCurrentFrame();
  if (frame < from - 2 || frame > to + 2) return null;
  const op = interpolate(frame, [from, from + 18, to - 18, to], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 70 }}>
      <div style={{ opacity: op }}>
        <KineticText lines={[text]} size={44} weight={800} align="center" maxWidth={920} />
      </div>
    </AbsoluteFill>
  );
};

export const TicketFlow: React.FC<{ music?: string }> = ({ music }) => {
  const frame = useCurrentFrame();

  const introOpacity = interpolate(frame, [10, 30, 84, 100], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const reveal = interpolate(frame, [88, 122], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const exitV = interpolate(frame, [820, 846], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const present = reveal * (1 - exitV);
  const fwdDim = Math.max(presence(frame, W_REC), presence(frame, W_NEW));
  const phoneScale = 1.5 - 0.1 * fwdDim - 0.13 * (1 - present);
  const phoneOpacity = present * (1 - 0.5 * fwdDim);

  const s1 = interpolate(frame, [300, 326], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut }); // scan → review
  const s2 = interpolate(frame, [620, 646], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut }); // review → gastos
  const scanOp = 1 - s1;
  const reviewOp = s1 * (1 - s2);
  const resultOp = s2;

  // Review scroll: reveal the form down to Categoría + amber card, then hold —
  // at this offset the whole form (Monto … Registrar gasto) is already in view.
  const reviewScroll = interpolate(
    frame,
    [REVIEW_START + 40, REVIEW_START + 115],
    [0, 300],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut },
  );
  const outroTextOpacity = interpolate(frame, [848, 866, 888, 900], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoOpacity = interpolate(frame, [894, 920], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoScale = interpolate(frame, [894, 920], [0.85, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const showLogo = frame >= 892;

  const cell = (op: number, start: number, node: React.ReactNode) => (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', opacity: op }}>
      <Sequence from={start} layout="none">{node}</Sequence>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: colors.bg[0], fontFamily }}>
      <MusicSlot src={music} />

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 900, height: 900, borderRadius: 9999, background: 'radial-gradient(circle, rgba(0,119,182,0.20), rgba(0,119,182,0) 62%)', opacity: Math.max(present, logoOpacity) }} />
      </AbsoluteFill>

      {/* intro */}
      {frame < 102 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <div style={{ opacity: introOpacity }}>
            <KineticText lines={['Cargá un gasto', 'en 3 segundos.']} size={62} weight={800} align="center" maxWidth={980} />
          </div>
        </AbsoluteFill>
      )}

      {/* phone: Scan → Review → Gastos */}
      {present > 0.001 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: phoneOpacity }}>
          <Device scale={phoneScale}>
            <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
              {cell(scanOp, SCAN_START, <ScanScreen />)}
              {cell(reviewOp, REVIEW_START, <ReviewScreen scrollY={reviewScroll} />)}
              {cell(resultOp, RESULT_START, <ExpensesResult />)}
            </div>
          </Device>
        </AbsoluteFill>
      )}

      {/* zoom forward on the AI category recommendation */}
      <Forward win={W_REC}>
        <Sequence from={W_REC[0]} layout="none"><RecommendationCard /></Sequence>
      </Forward>

      {/* zoom forward on the just-added expense */}
      <Forward win={W_NEW}>
        <Sequence from={W_NEW[0]} layout="none"><NewExpenseCard /></Sequence>
      </Forward>

      {/* step captions */}
      <StepCaption from={128} to={296} text="Sacale una foto al ticket" />
      <StepCaption from={332} to={612} text="La IA crea la categoría sola" />
      <StepCaption from={652} to={808} text="Tu gasto, ya en la lista" />

      {/* outro */}
      {frame >= 844 && frame < 906 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <div style={{ opacity: outroTextOpacity }}>
            <KineticText lines={['Sin escribir', 'un solo número.']} size={58} weight={800} align="center" maxWidth={980} />
          </div>
        </AbsoluteFill>
      )}

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
