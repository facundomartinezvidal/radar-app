/**
 * WhatsAppLink — animated mock of RADAR's "Vincular WhatsApp" screen (HU-26).
 *
 * Local-frame timeline (30 fps, 0–270 frames):
 *   0–12   screen header + subtitle enter
 *   14–24  "Generar código" primary button enter
 *  ~40     simulated "press": code card + instructions reveal
 *   40–52  code card enters (fade + slide)
 *   52–72  instruction rows stagger in (4 × delay=6)
 *   80–92  "Abrir WhatsApp" button enters
 *  250–260 "Abrir WhatsApp" button does a subtle press scale
 */
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { ChevronLeft, MessageCircle } from 'lucide-react';
import { colors, spacing, radii, font, weights } from '../ds/tokens';
import { T } from '../ds/Text';
import { Card } from '../ds/primitives';
import { enter } from '../theme/anim';
import { SCREEN_W } from '../ds/Device';

// WhatsApp constants (mirrors lib/repositories/whatsapp.ts)
const WHATSAPP_BOT_NUMBER = '+1 415 523 8886';
const WHATSAPP_SANDBOX_JOIN = 'join large-third';

const INSTRUCTIONS = [
  '1. Abrí WhatsApp',
  `2. Enviá "${WHATSAPP_SANDBOX_JOIN}" al ${WHATSAPP_BOT_NUMBER}`,
  '3. Esto activa el chat (una sola vez)',
  '4. Mandá este código al mismo chat',
] as const;

export const WhatsAppLink: React.FC = () => {
  const frame = useCurrentFrame();

  // Code card + instructions appear from frame 40
  const codeVisible = frame >= 40;

  // "Abrir WhatsApp" button subtle press near end (frame 250–260)
  const buttonScale = interpolate(frame, [250, 255, 260], [1, 0.94, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: SCREEN_W,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: colors.bg[0],
        overflow: 'hidden',
      }}
    >
      {/* Inner scroll-like content area */}
      <div
        style={{
          flex: 1,
          padding: `0 ${spacing[5]}px`,
          overflowY: 'hidden',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[3],
            paddingTop: spacing[4],
            paddingBottom: spacing[5],
            ...enter(frame, { delay: 0, duration: 14 }),
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronLeft size={24} color={colors.fg[1]} strokeWidth={1.5} />
          </div>
          <T variant="h2">Vincular WhatsApp</T>
        </div>

        {/* Subtitle */}
        <div style={{ ...enter(frame, { delay: 4, duration: 14 }), marginBottom: spacing[5] }}>
          <T variant="bodySm" style={{ color: colors.fg[2] }}>
            Vinculá tu número de WhatsApp para registrar gastos e ingresos por chat.
          </T>
        </div>

        {/* Code card (revealed at frame 40) */}
        {codeVisible && (
          <div
            style={{
              ...enter(frame, { delay: 40, duration: 14, distance: 32 }),
              marginBottom: spacing[4],
            }}
          >
            <Card
              variant="raised"
              padding={6}
              style={{ alignItems: 'center', textAlign: 'center' as const, gap: spacing[3] }}
            >
              <T
                variant="caption"
                style={{ color: colors.fg[3], marginBottom: spacing[2], display: 'block' }}
              >
                Tu código de vinculación
              </T>

              {/* Big tabular-nums code */}
              <span
                style={{
                  ...font(weights.bold),
                  fontSize: 44,
                  lineHeight: '55px',
                  letterSpacing: 8,
                  color: colors.fg[1],
                  fontVariantNumeric: 'tabular-nums lining-nums',
                  fontFeatureSettings: '"tnum" 1, "lnum" 1, "ss01" 1',
                  display: 'block',
                  textAlign: 'center',
                }}
              >
                4F2K9X
              </span>

              {/* Amber expiry */}
              <T
                variant="bodySm"
                style={{ color: colors.amber[500], marginTop: spacing[2], display: 'block' }}
              >
                Vence en 10 minutos
              </T>
            </Card>
          </div>
        )}

        {/* Instructions card (staggered after code card) */}
        {codeVisible && (
          <div
            style={{
              ...enter(frame, { delay: 52, duration: 14, distance: 24 }),
              marginBottom: spacing[5],
            }}
          >
            <Card
              variant="base"
              padding={4}
              style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}
            >
              {INSTRUCTIONS.map((step, i) => (
                <div key={step} style={{ ...enter(frame, { delay: 52 + i * 6, duration: 10 }) }}>
                  <T variant="bodySm" style={{ color: colors.fg[2] }}>
                    {step}
                  </T>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* "Abrir WhatsApp" secondary button */}
        {codeVisible && (
          <div
            style={{
              ...enter(frame, { delay: 80, duration: 14 }),
              marginBottom: spacing[4],
              transform: `${enter(frame, { delay: 80, duration: 14 }).transform} scale(${buttonScale})`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[2],
                height: 52,
                borderRadius: radii.md,
                border: `1px solid ${colors.line[2]}`,
                background: colors.bg[2],
              }}
            >
              <MessageCircle size={18} color={colors.fg[1]} strokeWidth={1.5} />
              <span style={{ ...font(weights.semibold), fontSize: 16, color: colors.fg[1] }}>
                Abrir WhatsApp
              </span>
            </div>
          </div>
        )}

        {/* "Generar código" primary button (always visible) */}
        <div style={{ ...enter(frame, { delay: 14, duration: 12 }) }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 52,
              borderRadius: radii.md,
              background: colors.brand[500],
            }}
          >
            <span style={{ ...font(weights.semibold), fontSize: 16, color: colors.fg.onBrand }}>
              {codeVisible ? 'Generar nuevo código' : 'Generar código'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
