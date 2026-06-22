/**
 * WhatsAppBot — promo composition for HU-26..29 (WhatsApp bot feature).
 *
 * Global-frame timeline (900 frames @ 30 fps = 30 s):
 *
 *   0–90    Intro: KineticText hook ("Cargá un gasto, / sin abrir la app.")
 *  90–360   Connect flow: Device (RADAR dark) wrapping WhatsAppLink
 *            WhatsAppLink local frames = global − 90  (its 0–270 window)
 * 360–810   Chat: Device (WhatsApp green chrome) wrapping WhatsAppChat
 *            WhatsAppChat local frames = global − 360 (its 0–450 window)
 * 810–900   Outro: KineticText payoff + LogoSweep wordmark + Tagline
 *
 * WhatsAppChat local frame exports:
 *   BUBBLE2_LAND = 84   → global 444   (spend summary lands)
 *   BUBBLE4_LAND = 196  → global 556   (confirmation lands)
 *
 * Forward zoom windows (global):
 *   Card 1 (summary):      444 – 524   (enter 444, hold, exit starts 510)
 *   Card 2 (confirmation): 556 – 636   (enter 556, hold, exit starts 622)
 *
 * Phone reveal: scale-in 90–115. Phone 1 fades/scales out 340–360.
 * Phone 2 fades in 355–380, fades out 720–740.
 */
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { colors } from '../theme/tokens';
import { fontFamily } from '../theme/fonts';
import { Device } from '../ds/Device';
import { WhatsAppLink } from '../screens/WhatsAppLink';
import { WhatsAppChat, BUBBLE2_LAND, BUBBLE4_LAND } from '../screens/WhatsAppChat';
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
const PHONE2_ENTER_END = 380;
const PHONE2_EXIT_START = 720;
const PHONE2_EXIT_END = 740;

// Chat starts at global 360; WhatsAppChat local frames are global − CHAT_OFFSET
const CHAT_OFFSET = 360;

// Forward zoom windows: computed from BUBBLE landing frames + offset
const ZOOM1_ENTER = CHAT_OFFSET + BUBBLE2_LAND;          // 444
const ZOOM1_EXIT = ZOOM1_ENTER + 66;                     // 510  (retract start)
const ZOOM1_WINDOW: [number, number] = [ZOOM1_ENTER, ZOOM1_EXIT]; // [444, 510]

const ZOOM2_ENTER = CHAT_OFFSET + BUBBLE4_LAND;          // 556
const ZOOM2_EXIT = ZOOM2_ENTER + 66;                     // 622
const ZOOM2_WINDOW: [number, number] = [ZOOM2_ENTER, ZOOM2_EXIT]; // [556, 622]

const OUTRO_START = 810;
const OUTRO_TEXT_IN = 812;
const OUTRO_TEXT_OUT = 856;
const LOGO_IN = 850;
const LOGO_SCALE_END = 876;

// ---------------------------------------------------------------------------
// Forward zoom overlay (copied + extended from HomeOverview)
// ---------------------------------------------------------------------------
const OVERLAY_SCALE = 2.2;

const presence = (frame: number, [inS, outS]: [number, number]) =>
  interpolate(frame, [inS, inS + 18, outS, outS + 24], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const Forward: React.FC<{ win: [number, number]; children: React.ReactNode }> = ({
  win,
  children,
}) => {
  const frame = useCurrentFrame();
  const [inS, outS] = win;
  if (frame < inS - 4 || frame > outS + 28) return null;

  const e = interpolate(frame, [inS, inS + 24, inS + 34], [0, 1.04, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOut,
  });
  const opIn = interpolate(frame, [inS, inS + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const x = interpolate(frame, [outS, outS + 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOut,
  });
  const s = OVERLAY_SCALE * (0.6 + 0.4 * e) * (1 - 0.18 * x);
  const ty = (1 - e) * 60 - x * 40;
  const rotX = (1 - e) * 9;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ perspective: 1500 }}>
        <div
          style={{
            opacity: opIn * (1 - x),
            transform: `translateY(${ty}px) rotateX(${rotX}deg) scale(${s})`,
            transformOrigin: 'center center',
            filter: 'drop-shadow(0 50px 90px rgba(0,0,0,0.72))',
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Overlay card: spend summary (bot bubble 2)
// ---------------------------------------------------------------------------
const SummaryCard: React.FC = () => (
  <div
    style={{
      width: 420,
      background: '#FFFFFF',
      borderRadius: 22,
      padding: '22px 24px 18px',
      boxShadow:
        '0 0 0 1.5px rgba(37,211,102,0.45), 0 20px 60px rgba(0,0,0,0.55), 0 0 0 6px rgba(37,211,102,0.10)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* WhatsApp green accent strip */}
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: 'linear-gradient(90deg, #25D366, #128C7E)',
        borderRadius: '22px 22px 0 0',
      }}
    />
    {/* "R" sender label */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
        marginTop: 4,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#25D366',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(37,211,102,0.4)',
        }}
      >
        <span
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 700,
            fontSize: 14,
            color: '#FFFFFF',
          }}
        >
          R
        </span>
      </div>
      <div>
        <span
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 700,
            fontSize: 15,
            color: '#111B21',
            display: 'block',
          }}
        >
          RADAR
        </span>
        <span
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 400,
            fontSize: 12,
            color: '#8696A0',
          }}
        >
          14:31 · en línea
        </span>
      </div>
    </div>

    {/* Main text content */}
    <div
      style={{
        borderLeft: '3px solid #25D366',
        paddingLeft: 14,
        marginBottom: 12,
      }}
    >
      <span
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 600,
          fontSize: 16,
          color: '#111B21',
          display: 'block',
          lineHeight: '22px',
          marginBottom: 6,
        }}
      >
        📊 En junio llevás $128.400 en 23 gastos.
      </span>
    </div>

    {/* Categories breakdown */}
    <div
      style={{
        background: '#F8FBF8',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      <span
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 600,
          fontSize: 13,
          color: '#506473',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Top categorías
      </span>
      {[
        { emoji: '🍔', label: 'Comida', amount: '$52.300', pct: 41 },
        { emoji: '🚗', label: 'Transporte', amount: '$28.100', pct: 22 },
        { emoji: '🛒', label: 'Súper', amount: '$19.400', pct: 15 },
      ].map(({ emoji, label, amount, pct }) => (
        <div key={label}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: 500,
                fontSize: 14,
                color: '#111B21',
              }}
            >
              {emoji} {label}
            </span>
            <span
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: 600,
                fontSize: 14,
                color: '#111B21',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {amount}
            </span>
          </div>
          {/* Progress bar */}
          <div
            style={{
              height: 4,
              background: '#E8F5E8',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #25D366, #128C7E)',
                borderRadius: 2,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Overlay card: load confirmation (bot bubble 4)
// ---------------------------------------------------------------------------
const ConfirmCard: React.FC = () => (
  <div
    style={{
      width: 420,
      background: '#FFFFFF',
      borderRadius: 22,
      padding: '22px 24px 20px',
      boxShadow:
        '0 0 0 1.5px rgba(37,211,102,0.45), 0 20px 60px rgba(0,0,0,0.55), 0 0 0 6px rgba(37,211,102,0.10)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* WhatsApp green accent strip */}
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: 'linear-gradient(90deg, #25D366, #128C7E)',
        borderRadius: '22px 22px 0 0',
      }}
    />

    {/* "R" sender label */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
        marginTop: 4,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#25D366',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(37,211,102,0.4)',
        }}
      >
        <span
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 700,
            fontSize: 14,
            color: '#FFFFFF',
          }}
        >
          R
        </span>
      </div>
      <div>
        <span
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 700,
            fontSize: 15,
            color: '#111B21',
            display: 'block',
          }}
        >
          RADAR
        </span>
        <span
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 400,
            fontSize: 12,
            color: '#8696A0',
          }}
        >
          14:32 · en línea
        </span>
      </div>
    </div>

    {/* Success badge */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#F0FBF4',
        borderRadius: 12,
        padding: '12px 16px',
        marginBottom: 14,
        border: '1px solid rgba(37,211,102,0.2)',
      }}
    >
      <span style={{ fontSize: 22 }}>✅</span>
      <span
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 700,
          fontSize: 16,
          color: '#128C7E',
        }}
      >
        Listo, lo registré
      </span>
    </div>

    {/* Expense details grid */}
    <div
      style={{
        background: '#F8FBF8',
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        marginBottom: 14,
      }}
    >
      {[
        { emoji: '💵', label: 'Monto', value: '$38.500', highlight: true },
        { emoji: '🍔', label: 'Categoría', value: 'Comida · Coto', highlight: false },
        { emoji: '📅', label: 'Fecha', value: 'Hoy 14:32', highlight: false },
      ].map(({ emoji, label, value, highlight }) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 400,
              fontSize: 13,
              color: '#8696A0',
            }}
          >
            {emoji} {label}
          </span>
          <span
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: highlight ? 700 : 500,
              fontSize: highlight ? 16 : 14,
              color: highlight ? '#111B21' : '#344650',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>

    {/* Running total */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTop: '1px solid #EEF2F5',
      }}
    >
      <span
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 400,
          fontSize: 13,
          color: '#8696A0',
        }}
      >
        Total junio
      </span>
      <span
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 700,
          fontSize: 18,
          color: '#EF4444',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        $166.900
      </span>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------
export const WhatsAppBot: React.FC<{ music?: string }> = ({ music }) => {
  const frame = useCurrentFrame();

  // ── intro text opacity (fade in then out by frame 90) ─────────────────────
  const introOpacity = interpolate(
    frame,
    [INTRO_IN + 8, INTRO_IN + 28, INTRO_OUT - 12, INTRO_OUT],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ── phone 1 presence (connect flow) ──────────────────────────────────────
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

  // ── phone 2 presence (chat) ───────────────────────────────────────────────
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
  const phone2SlideY = (1 - phone2Enter) * 60;

  // ── dim factor: how much the phone fades back during zoom cards ───────────
  const dimFactor = Math.max(
    presence(frame, ZOOM1_WINDOW),
    presence(frame, ZOOM2_WINDOW),
  );
  const phone2Scale = 1.32 - 0.13 * (1 - phone2Present) - 0.06 * dimFactor;
  const phone2Opacity = phone2Present * (1 - 0.55 * dimFactor);

  // ── outro text ────────────────────────────────────────────────────────────
  const outroTextOpacity = interpolate(
    frame,
    [OUTRO_TEXT_IN, OUTRO_TEXT_IN + 16, OUTRO_TEXT_OUT, OUTRO_TEXT_OUT + 12],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const showOutroText = frame >= OUTRO_START && frame < OUTRO_TEXT_OUT + 12;

  // ── final logo ────────────────────────────────────────────────────────────
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

  // ── ambient glow ──────────────────────────────────────────────────────────
  const glowOpacity = Math.max(phone1Present, phone2Present, logoOpacity);

  return (
    <AbsoluteFill style={{ background: colors.bg0, fontFamily }}>
      <MusicSlot src={music} />

      {/* Ambient radial brand glow */}
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
            <Sequence from={PHONE1_REVEAL_START} layout="none">
              <WhatsAppLink />
            </Sequence>
          </Device>
        </AbsoluteFill>
      )}

      {/* Phone 2 — WhatsApp chrome (chat), dims behind zoom cards */}
      {phone2Present > 0.001 && (
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            opacity: phone2Opacity,
            transform: `translateY(${phone2SlideY}px) scale(${phone2Scale})`,
          }}
        >
          <Device screenBg="#EFE7DC" statusBarDark>
            <Sequence from={PHONE2_ENTER_START} layout="none">
              <WhatsAppChat />
            </Sequence>
          </Device>
        </AbsoluteFill>
      )}

      {/* Forward zoom card 1 — spend summary */}
      <Forward win={ZOOM1_WINDOW}>
        <SummaryCard />
      </Forward>

      {/* Forward zoom card 2 — load confirmation */}
      <Forward win={ZOOM2_WINDOW}>
        <ConfirmCard />
      </Forward>

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
