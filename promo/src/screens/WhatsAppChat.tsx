/**
 * WhatsAppChat — animated WhatsApp-style chat mock showing RADAR bot interaction.
 *
 * This is WhatsApp chrome (light theme), NOT the RADAR dark theme.
 *
 * Message sequence (voseo, 4 messages):
 *   1. user  → "¿Cuánto gasté este mes?"
 *   2. typing → bot → multi-line spend summary (📊)
 *   3. user  → "Coto $38.500 comida"
 *   4. typing → bot → multi-line confirmation (✅)
 *
 * Local-frame timeline (30 fps, 0–360 frames):
 *   0–12    header enters
 *   16–26   date chip + E2E notice enter
 *   30–44   bubble 1 (user) enters
 *   50–60   typing indicator 1 appears
 *   72–84   typing 1 exits, bubble 2 (bot summary) enters → BUBBLE2_LAND = 84
 *   140–150 bubble 3 (user load) enters
 *   160–172 typing indicator 2 appears
 *   184–196 typing 2 exits, bubble 4 (bot confirm) enters → BUBBLE4_LAND = 196
 *
 * Export: BUBBLE2_LAND, BUBBLE4_LAND — composition needs them for Forward timing.
 */
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { ChevronLeft, Phone, Video, MoreVertical } from 'lucide-react';
import { font, weights } from '../ds/tokens';
import { enter } from '../theme/anim';
import { SCREEN_W } from '../ds/Device';

// WhatsApp chrome colours (light theme)
const WA = {
  headerBg: '#075E54',        // WhatsApp dark teal header
  headerBgStatus: '#128C7E',  // subtle lighter for avatar ring
  headerText: '#FFFFFF',
  chatBg: '#EFE7DC',          // authentic beige chat background
  chatPatternOverlay: 'rgba(0,0,0,0.03)',
  bubbleOut: '#D9FDD3',       // outgoing (modern green, matching WA 2024)
  bubbleIn: '#FFFFFF',        // incoming bot
  bubbleText: '#111B21',
  metaText: '#667781',
  tick: '#53BDEB',            // blue double-check
  tickGrey: '#8696A0',        // unread single check
  avatarBg: '#25D366',        // WhatsApp green avatar
  avatarRing: 'rgba(255,255,255,0.25)',
  dateChip: 'rgba(225,245,254,0.92)',
  dateChipText: '#506473',
  inputBg: '#FFFFFF',
  inputBorder: 'rgba(0,0,0,0.06)',
  micBtn: '#075E54',
  encryptionText: '#8696A0',
  bubbleShadow: '0 1px 3px rgba(0,0,0,0.14)',
} as const;

// Local frame constants exported for composition zoom timing
export const BUBBLE2_LAND = 84;
export const BUBBLE4_LAND = 196;

const TIMESTAMP_1 = '14:30';
const TIMESTAMP_2 = '14:31';
const TIMESTAMP_3 = '14:32';
const TIMESTAMP_4 = '14:32';

// ─────────────────────────────────────────────
// Typing dot — bouncing pulse animation
// ─────────────────────────────────────────────
const TypingDot: React.FC<{ frame: number; index: number; startFrame: number }> = ({
  frame,
  index,
  startFrame,
}) => {
  const cycle = 30; // frames per full bounce cycle
  const phaseOffset = index * 10;
  const localFrame = frame - startFrame - phaseOffset;
  const bounceProgress = localFrame < 0 ? 0 : ((localFrame % cycle) / cycle) * Math.PI * 2;
  const ty = localFrame < 0 ? 0 : Math.sin(bounceProgress) * -5;
  const scale = localFrame < 0 ? 1 : 0.9 + 0.1 * Math.cos(bounceProgress);
  return (
    <div
      style={{
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: WA.metaText,
        transform: `translateY(${ty}px) scale(${scale})`,
        flexShrink: 0,
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
      paddingRight: 64,
      marginBottom: 4,
      ...enter(frame, { delay: startFrame, duration: 8, distance: 10 }),
    }}
  >
    {/* Avatar stub for bot */}
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: WA.avatarBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginRight: 6,
        alignSelf: 'flex-end',
        marginBottom: 2,
        boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
      }}
    >
      <span
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 700,
          fontSize: 11,
          color: '#FFFFFF',
        }}
      >
        R
      </span>
    </div>
    <div
      style={{
        background: WA.bubbleIn,
        borderRadius: '0px 14px 14px 14px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minWidth: 68,
        boxShadow: WA.bubbleShadow,
      }}
    >
      {[0, 1, 2].map((i) => (
        <TypingDot key={i} frame={frame} index={i} startFrame={startFrame} />
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────
// Bubble components
// ─────────────────────────────────────────────
interface BubbleProps {
  frame: number;
  delay: number;
  text: string;
  direction: 'out' | 'in';
  time?: string;
}

const OutgoingBubble: React.FC<BubbleProps> = ({ frame, delay, text, time = TIMESTAMP_1 }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-end',
      paddingLeft: 64,
      paddingRight: 8,
      marginBottom: 3,
      ...enter(frame, { delay, duration: 10, distance: 14 }),
    }}
  >
    <div
      style={{
        position: 'relative',
        background: WA.bubbleOut,
        borderRadius: '14px 0px 14px 14px',
        padding: '8px 10px 6px 12px',
        maxWidth: 270,
        boxShadow: WA.bubbleShadow,
      }}
    >
      {/* tail */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: -7,
          width: 0,
          height: 0,
          borderTop: '8px solid ' + WA.bubbleOut,
          borderLeft: '8px solid transparent',
          borderRight: '0px solid transparent',
        }}
      />
      <span
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 400,
          fontSize: 14.5,
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
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 400,
            fontSize: 11,
            color: WA.metaText,
          }}
        >
          {time}
        </span>
        <span style={{ fontSize: 13.5, color: WA.tick, lineHeight: 1, letterSpacing: -1 }}>
          ✓✓
        </span>
      </div>
    </div>
  </div>
);

const IncomingBubble: React.FC<BubbleProps> = ({ frame, delay, text, time = TIMESTAMP_2 }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-start',
      paddingLeft: 8,
      paddingRight: 64,
      marginBottom: 3,
      alignItems: 'flex-end',
      ...enter(frame, { delay, duration: 12, distance: 14 }),
    }}
  >
    {/* Bot avatar */}
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: WA.avatarBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginRight: 6,
        marginBottom: 2,
        boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
      }}
    >
      <span
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 700,
          fontSize: 11,
          color: '#FFFFFF',
        }}
      >
        R
      </span>
    </div>
    <div
      style={{
        position: 'relative',
        background: WA.bubbleIn,
        borderRadius: '0px 14px 14px 14px',
        padding: '8px 12px 6px 12px',
        maxWidth: 285,
        boxShadow: WA.bubbleShadow,
      }}
    >
      {/* tail */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: -7,
          width: 0,
          height: 0,
          borderTop: '8px solid ' + WA.bubbleIn,
          borderRight: '8px solid transparent',
          borderLeft: '0px solid transparent',
        }}
      />
      <span
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 400,
          fontSize: 14.5,
          lineHeight: '21px',
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
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 400,
            fontSize: 11,
            color: WA.metaText,
          }}
        >
          {time}
        </span>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// Visibility helpers
// ─────────────────────────────────────────────
const typing1Visible = (frame: number): boolean => frame >= 50 && frame < 72;
const typing2Visible = (frame: number): boolean => frame >= 160 && frame < 184;

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export const WhatsAppChat: React.FC = () => {
  const frame = useCurrentFrame();

  // Header fade
  const headerOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Status subtitle switches to "escribiendo…" while typing indicators are visible
  const isTyping = typing1Visible(frame) || typing2Visible(frame);

  // Chat info fade-in (date chip + E2E notice)
  const chatInfoOpacity = interpolate(frame, [16, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const summaryText =
    '📊 En junio llevás $128.400 en 23 gastos.\n\nTus top categorías:\n🍔 Comida — $52.300\n🚗 Transporte — $28.100\n🛒 Súper — $19.400';

  const confirmText =
    '✅ Listo, lo registré\n\n💵 $38.500\n🍔 Comida · Coto\n📅 Hoy 14:32\n\nVas $166.900 en junio.';

  return (
    <div
      style={{
        width: SCREEN_W,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: WA.chatBg,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Subtle background pattern overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: WA.chatPatternOverlay,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ── WhatsApp header bar ──────────────────────── */}
      <div
        style={{
          background: WA.headerBg,
          display: 'flex',
          alignItems: 'center',
          padding: '10px 10px 10px 4px',
          gap: 8,
          flexShrink: 0,
          opacity: headerOpacity,
          zIndex: 2,
          boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
        }}
      >
        {/* Back arrow */}
        <ChevronLeft size={24} color={WA.headerText} strokeWidth={2.2} />

        {/* Avatar with green ring */}
        <div
          style={{
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: WA.avatarBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid ' + WA.avatarRing,
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          >
            <span
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                color: WA.headerText,
              }}
            >
              R
            </span>
          </div>
          {/* Online dot */}
          <div
            style={{
              position: 'absolute',
              bottom: 1,
              right: 1,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#44CC77',
              border: '2px solid ' + WA.headerBg,
            }}
          />
        </div>

        {/* Contact name + status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 600,
              fontSize: 16,
              color: WA.headerText,
              display: 'block',
              lineHeight: '19px',
            }}
          >
            RADAR
          </span>
          <span
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 400,
              fontSize: 12.5,
              color: isTyping ? '#A8D8B8' : 'rgba(255,255,255,0.78)',
              display: 'block',
              lineHeight: '16px',
              fontStyle: isTyping ? 'italic' : 'normal',
            }}
          >
            {isTyping ? 'escribiendo…' : 'en línea'}
          </span>
        </div>

        {/* Action icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Video size={21} color={WA.headerText} strokeWidth={1.8} />
          <Phone size={21} color={WA.headerText} strokeWidth={1.8} />
          <MoreVertical size={21} color={WA.headerText} strokeWidth={1.8} />
        </div>
      </div>

      {/* ── Chat area ────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          paddingTop: 10,
          paddingBottom: 6,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Date chip + E2E notice */}
        <div
          style={{
            opacity: chatInfoOpacity,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            paddingBottom: 10,
          }}
        >
          {/* "HOY" date chip */}
          <div
            style={{
              background: WA.dateChip,
              borderRadius: 10,
              paddingTop: 4,
              paddingBottom: 4,
              paddingLeft: 12,
              paddingRight: 12,
              boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
            }}
          >
            <span
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: 500,
                fontSize: 12,
                color: WA.dateChipText,
                letterSpacing: 0.2,
              }}
            >
              HOY
            </span>
          </div>
          {/* E2E encryption notice */}
          <div
            style={{
              background: 'rgba(255,248,210,0.92)',
              borderRadius: 8,
              paddingTop: 5,
              paddingBottom: 5,
              paddingLeft: 14,
              paddingRight: 14,
              maxWidth: 320,
            }}
          >
            <span
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: 400,
                fontSize: 11.5,
                color: '#6B7C8A',
                textAlign: 'center',
                display: 'block',
                lineHeight: '16px',
              }}
            >
              🔒 Los mensajes están cifrados de extremo a extremo.
            </span>
          </div>
        </div>

        {/* Bubble 1 — user query (frame 30) */}
        <OutgoingBubble
          frame={frame}
          delay={30}
          text="¿Cuánto gasté este mes?"
          direction="out"
          time={TIMESTAMP_1}
        />

        {/* Typing 1 (frames 50–72) */}
        {typing1Visible(frame) && <TypingBubble frame={frame} startFrame={50} />}

        {/* Bubble 2 — bot summary (frame 72 enters, lands at 84) */}
        {frame >= 72 && (
          <IncomingBubble
            frame={frame}
            delay={72}
            text={summaryText}
            direction="in"
            time={TIMESTAMP_2}
          />
        )}

        {/* Bubble 3 — user loads expense (frame 140) */}
        {frame >= 140 && (
          <OutgoingBubble
            frame={frame}
            delay={140}
            text="Coto $38.500 comida"
            direction="out"
            time={TIMESTAMP_3}
          />
        )}

        {/* Typing 2 (frames 160–184) */}
        {typing2Visible(frame) && <TypingBubble frame={frame} startFrame={160} />}

        {/* Bubble 4 — bot confirmation (frame 184 enters, lands at 196) */}
        {frame >= 184 && (
          <IncomingBubble
            frame={frame}
            delay={184}
            text={confirmText}
            direction="in"
            time={TIMESTAMP_4}
          />
        )}
      </div>

      {/* ── Input bar stub ───────────────────────────── */}
      <div
        style={{
          background: '#F0F2F5',
          padding: '6px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          flexShrink: 0,
          borderTop: '1px solid ' + WA.inputBorder,
          zIndex: 2,
        }}
      >
        {/* Emoji + attach icons */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 20 }}>😊</span>
        </div>

        {/* Text input pill */}
        <div
          style={{
            flex: 1,
            height: 40,
            background: WA.inputBg,
            borderRadius: 22,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 16,
            paddingRight: 16,
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          }}
        >
          <span
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 400,
              fontSize: 14.5,
              color: '#B0BAC3',
            }}
          >
            Mensaje
          </span>
        </div>

        {/* Mic / send button */}
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: WA.micBtn,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(7,94,84,0.4)',
          }}
        >
          <span style={{ fontSize: 18 }}>🎤</span>
        </div>
      </div>
    </div>
  );
};
