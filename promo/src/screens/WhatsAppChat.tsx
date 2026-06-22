/**
 * WhatsAppChat — animated WhatsApp-style chat mock showing RADAR bot interaction.
 *
 * This is WhatsApp chrome (light beige), NOT the RADAR dark theme.
 *
 * Message sequence (voseo, 4 messages):
 *   1. user  → "¿Cuánto gasté este mes?"
 *   2. typing → bot → "Este mes llevás $128.400 en 23 gastos. Comida es lo más alto."
 *   3. user  → "Coto $38.500"
 *   4. typing → bot → "✓ Gasto registrado · Comida · $38.500"
 *
 * Local-frame timeline (30 fps, 0–270 frames):
 *   0–12    header enters
 *   14–24   bubble 1 (user) enters
 *   30–40   typing indicator appears
 *   52–62   typing indicator exits, bubble 2 (bot) enters
 *   80–90   bubble 3 (user) enters
 *   96–106  typing indicator appears again
 *   118–128 typing indicator exits, bubble 4 (bot) enters
 */
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { ChevronLeft, Phone, Video, MoreVertical } from 'lucide-react';
import { font, weights } from '../ds/tokens';
import { enter } from '../theme/anim';
import { SCREEN_W } from '../ds/Device';

// WhatsApp chrome colours (light theme)
const WA = {
  headerBg: '#128C7E',
  headerText: '#FFFFFF',
  chatBg: '#ECE5DD',
  bubbleOut: '#DCF8C6',   // outgoing user (right)
  bubbleIn: '#FFFFFF',    // incoming bot (left)
  bubbleText: '#111B21',
  metaText: '#667781',
  tick: '#53BDEB',
  avatarBg: '#075E54',
} as const;

const TIMESTAMP = '14:32';

// Dot-pulse typing indicator
const TypingDot: React.FC<{ frame: number; index: number; startFrame: number }> = ({
  frame,
  index,
  startFrame,
}) => {
  const cycle = 24; // frames per full bounce cycle
  const phaseOffset = index * 8;
  const localFrame = frame - startFrame - phaseOffset;
  const bounceProgress = localFrame < 0 ? 0 : ((localFrame % cycle) / cycle) * Math.PI * 2;
  const ty = localFrame < 0 ? 0 : Math.sin(bounceProgress) * -4;
  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        background: WA.metaText,
        transform: `translateY(${ty}px)`,
      }}
    />
  );
};

const TypingBubble: React.FC<{ frame: number; startFrame: number }> = ({ frame, startFrame }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-start',
      paddingLeft: 14,
      paddingRight: 60,
      marginBottom: 4,
      ...enter(frame, { delay: startFrame, duration: 8, distance: 12 }),
    }}
  >
    <div
      style={{
        background: WA.bubbleIn,
        borderRadius: '0px 12px 12px 12px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        minWidth: 64,
        boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
      }}
    >
      {[0, 1, 2].map((i) => (
        <TypingDot key={i} frame={frame} index={i} startFrame={startFrame} />
      ))}
    </div>
  </div>
);

interface BubbleProps {
  frame: number;
  delay: number;
  text: string;
  direction: 'out' | 'in';
  time?: string;
}

const Bubble: React.FC<BubbleProps> = ({ frame, delay, text, direction, time = TIMESTAMP }) => {
  const isOut = direction === 'out';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isOut ? 'flex-end' : 'flex-start',
        paddingLeft: isOut ? 60 : 14,
        paddingRight: isOut ? 14 : 60,
        marginBottom: 6,
        ...enter(frame, { delay, duration: 10, distance: 16 }),
      }}
    >
      <div
        style={{
          background: isOut ? WA.bubbleOut : WA.bubbleIn,
          borderRadius: isOut ? '12px 0px 12px 12px' : '0px 12px 12px 12px',
          padding: '8px 12px 6px',
          maxWidth: 260,
          boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
        }}
      >
        <span
          style={{
            ...font(weights.regular),
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 14,
            lineHeight: '20px',
            color: WA.bubbleText,
            display: 'block',
            whiteSpace: 'pre-wrap' as const,
          }}
        >
          {text}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 3,
            marginTop: 2,
          }}
        >
          <span
            style={{
              ...font(weights.regular),
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: 11,
              color: WA.metaText,
            }}
          >
            {time}
          </span>
          {isOut && (
            <span style={{ fontSize: 13, color: WA.tick, lineHeight: 1 }}>✓✓</span>
          )}
        </div>
      </div>
    </div>
  );
};

// Derived visibility helpers
const typing1Visible = (frame: number): boolean => frame >= 30 && frame < 52;
const typing2Visible = (frame: number): boolean => frame >= 96 && frame < 118;

export const WhatsAppChat: React.FC = () => {
  const frame = useCurrentFrame();

  // Header fade opacity
  const headerOpacity = interpolate(frame, [0, 12], [0, 1], {
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
        backgroundColor: WA.chatBg,
        overflow: 'hidden',
      }}
    >
      {/* WhatsApp header bar */}
      <div
        style={{
          background: WA.headerBg,
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px 10px 8px',
          gap: 10,
          flexShrink: 0,
          opacity: headerOpacity,
        }}
      >
        {/* Back */}
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={22} color={WA.headerText} strokeWidth={2} />
        </div>

        {/* Avatar */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            background: WA.avatarBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.3)',
          }}
        >
          <span
            style={{
              ...font(weights.bold),
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: 14,
              color: WA.headerText,
            }}
          >
            R
          </span>
        </div>

        {/* Contact name + status */}
        <div style={{ flex: 1 }}>
          <span
            style={{
              ...font(weights.semibold),
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: 16,
              color: WA.headerText,
              display: 'block',
              lineHeight: '20px',
            }}
          >
            RADAR
          </span>
          <span
            style={{
              ...font(weights.regular),
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: 12,
              color: 'rgba(255,255,255,0.75)',
              display: 'block',
              lineHeight: '16px',
            }}
          >
            en línea
          </span>
        </div>

        {/* Action icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Video size={20} color={WA.headerText} strokeWidth={1.8} />
          <Phone size={20} color={WA.headerText} strokeWidth={1.8} />
          <MoreVertical size={20} color={WA.headerText} strokeWidth={1.8} />
        </div>
      </div>

      {/* Chat area */}
      <div
        style={{
          flex: 1,
          paddingTop: 10,
          paddingBottom: 14,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          overflow: 'hidden',
        }}
      >
        {/* Bubble 1 — user (frame 14) */}
        <Bubble
          frame={frame}
          delay={14}
          text="¿Cuánto gasté este mes?"
          direction="out"
          time="14:30"
        />

        {/* Typing 1 (frames 30–52) */}
        {typing1Visible(frame) && (
          <TypingBubble frame={frame} startFrame={30} />
        )}

        {/* Bubble 2 — bot (frame 52) */}
        {frame >= 52 && (
          <Bubble
            frame={frame}
            delay={52}
            text={'Este mes llevás $128.400 en 23 gastos.\nComida es lo más alto.'}
            direction="in"
            time="14:31"
          />
        )}

        {/* Bubble 3 — user (frame 80) */}
        {frame >= 80 && (
          <Bubble
            frame={frame}
            delay={80}
            text="Coto $38.500"
            direction="out"
            time="14:32"
          />
        )}

        {/* Typing 2 (frames 96–118) */}
        {typing2Visible(frame) && (
          <TypingBubble frame={frame} startFrame={96} />
        )}

        {/* Bubble 4 — bot (frame 118) */}
        {frame >= 118 && (
          <Bubble
            frame={frame}
            delay={118}
            text={'✓ Gasto registrado · Comida · $38.500'}
            direction="in"
            time="14:32"
          />
        )}
      </div>

      {/* Input bar stub */}
      <div
        style={{
          background: '#F0F2F5',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          borderTop: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            flex: 1,
            height: 38,
            background: '#FFFFFF',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 16,
          }}
        >
          <span
            style={{
              ...font(weights.regular),
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: 14,
              color: WA.metaText,
            }}
          >
            Mensaje
          </span>
        </div>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            background: WA.headerBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 16 }}>🎤</span>
        </div>
      </div>
    </div>
  );
};
