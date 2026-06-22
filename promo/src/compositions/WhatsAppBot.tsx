/**
 * WhatsAppBot — promo composition for HU-26..29 (WhatsApp bot feature).
 *
 * Global-frame timeline (750 frames @ 30 fps = 25 s):
 *
 *   0–90   Intro: KineticText hook ("Cargá un gasto, / sin abrir la app.")
 *  90–360  Connect flow: Device (RADAR dark) wrapping WhatsAppLink
 *           WhatsAppLink local frames = global − 90 (its 0–270 window)
 * 360–630  Chat: crossfade into Device (WhatsApp green chrome) wrapping WhatsAppChat
 *           WhatsAppChat local frames = global − 360 (its 0–270 window)
 * 630–750  Outro: KineticText payoff + LogoSweep wordmark + Tagline
 *
 * Phone reveal: scale-in from 90–115. Phone 1 fades/scales out 340–360.
 * Crossfade between the two Device instances: phone2 fades in 355–375.
 * Phone 2 fades/scales out 615–635.
 */
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { colors } from '../theme/tokens';
import { fontFamily } from '../theme/fonts';
import { Device } from '../ds/Device';
import { WhatsAppLink } from '../screens/WhatsAppLink';
import { WhatsAppChat } from '../screens/WhatsAppChat';
import { LogoSweep, Tagline } from '../components/LogoSweep';
import { KineticText } from '../components/KineticText';
import { MusicSlot } from '../components/MusicSlot';
import { easeOut } from '../theme/anim';

// ---------------------------------------------------------------------------
// Phase boundaries (global frames)
// ---------------------------------------------------------------------------
const INTRO_IN = 0;
const INTRO_OUT = 90;

const PHONE1_REVEAL_START = 90;
const PHONE1_REVEAL_END = 115;
const PHONE1_EXIT_START = 340;
const PHONE1_EXIT_END = 360;

const PHONE2_ENTER_START = 355;
const PHONE2_ENTER_END = 375;
const PHONE2_EXIT_START = 615;
const PHONE2_EXIT_END = 635;

const OUTRO_START = 630;
const OUTRO_TEXT_IN = 632;
const OUTRO_TEXT_OUT = 706;
const LOGO_IN = 700;
const LOGO_SCALE_END = 726;

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------
export const WhatsAppBot: React.FC<{ music?: string }> = ({ music }) => {
  const frame = useCurrentFrame();

  // ---- intro text opacity (fade in then out by frame 90) -----------------
  const introOpacity = interpolate(
    frame,
    [INTRO_IN + 8, INTRO_IN + 28, INTRO_OUT - 12, INTRO_OUT],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ---- phone 1 presence (connect flow) -----------------------------------
  const phone1Reveal = interpolate(frame, [PHONE1_REVEAL_START, PHONE1_REVEAL_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOut,
  });
  const phone1Exit = interpolate(frame, [PHONE1_EXIT_START, PHONE1_EXIT_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOut,
  });
  const phone1Present = phone1Reveal * (1 - phone1Exit);
  const phone1Scale = 1.32 - 0.13 * (1 - phone1Present);
  const phone1Opacity = phone1Present;

  // ---- phone 2 presence (chat) -------------------------------------------
  const phone2Enter = interpolate(frame, [PHONE2_ENTER_START, PHONE2_ENTER_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOut,
  });
  const phone2Exit = interpolate(frame, [PHONE2_EXIT_START, PHONE2_EXIT_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOut,
  });
  const phone2Present = phone2Enter * (1 - phone2Exit);
  // Subtle upward slide on enter (mirrors Insights phone reveal)
  const phone2SlideY = (1 - phone2Enter) * 60;
  const phone2Scale = 1.32 - 0.13 * (1 - phone2Present);
  const phone2Opacity = phone2Present;

  // ---- outro text --------------------------------------------------------
  const outroTextOpacity = interpolate(
    frame,
    [OUTRO_TEXT_IN, OUTRO_TEXT_IN + 16, OUTRO_TEXT_OUT, OUTRO_TEXT_OUT + 12],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const showOutroText = frame >= OUTRO_START && frame < OUTRO_TEXT_OUT + 12;

  // ---- final logo --------------------------------------------------------
  const logoOpacity = interpolate(frame, [LOGO_IN, LOGO_IN + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const logoScale = interpolate(frame, [LOGO_IN, LOGO_SCALE_END], [0.82, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOut,
  });
  const showLogo = frame >= LOGO_IN;

  // ---- ambient glow visibility -------------------------------------------
  const glowOpacity = Math.max(phone1Present, phone2Present, logoOpacity);

  return (
    <AbsoluteFill style={{ background: colors.bg0, fontFamily }}>
      <MusicSlot src={music} />

      {/* Ambient radial brand glow — always behind everything */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 900,
            height: 900,
            borderRadius: 9999,
            background:
              'radial-gradient(circle, rgba(0,119,182,0.18), rgba(0,119,182,0) 62%)',
            opacity: glowOpacity,
          }}
        />
      </AbsoluteFill>

      {/* Intro hook text */}
      {frame < INTRO_OUT + 2 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <div style={{ opacity: introOpacity }}>
            <KineticText
              lines={['Cargá un gasto,', 'sin abrir la app.']}
              size={64}
              weight={800}
              align="center"
              maxWidth={980}
            />
          </div>
        </AbsoluteFill>
      )}

      {/* Phone 1 — RADAR dark (connect flow) */}
      {phone1Present > 0.001 && (
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            opacity: phone1Opacity,
          }}
        >
          <Device scale={phone1Scale}>
            {/* Sequence resets useCurrentFrame so WhatsAppLink sees local frames */}
            <Sequence from={PHONE1_REVEAL_START} layout="none">
              <WhatsAppLink />
            </Sequence>
          </Device>
        </AbsoluteFill>
      )}

      {/* Phone 2 — WhatsApp green chrome (chat) */}
      {phone2Present > 0.001 && (
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            opacity: phone2Opacity,
            transform: `translateY(${phone2SlideY}px)`,
          }}
        >
          <Device scale={phone2Scale} screenBg="#ECE5DD" statusBarDark>
            <Sequence from={PHONE2_ENTER_START} layout="none">
              <WhatsAppChat />
            </Sequence>
          </Device>
        </AbsoluteFill>
      )}

      {/* Outro payoff text */}
      {showOutroText && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <div style={{ opacity: outroTextOpacity }}>
            <KineticText
              lines={['Escribile a RADAR', 'por WhatsApp.']}
              size={62}
              weight={800}
              align="center"
              maxWidth={980}
            />
          </div>
        </AbsoluteFill>
      )}

      {/* Final logo + tagline */}
      {showLogo && (
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 28,
          }}
        >
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
