import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { ChevronLeft, ChevronDown, Calendar, Shirt, Check } from 'lucide-react';
import { colors, spacing, radii, font, weights } from '../ds/tokens';
import { T } from '../ds/Text';

const amber = colors.amber[500];

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ ...font(weights.regular), fontSize: 14, color: colors.fg[3], display: 'block', marginBottom: spacing[2] }}>{children}</span>
);

// local-frame milestones for the "create category" beat
const TAP = 150;
const CREATED = 162;

// Forward-overlay of the AI category recommendation (zoom tour). The "Crear
// categoría" button presses near the end (local frame).
export const RecommendationCard: React.FC = () => {
  const frame = useCurrentFrame();
  const tap = interpolate(frame, [52, 60, 68], [1, 0.94, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ width: 393, padding: `0 ${spacing[5]}px` }}>
      <Label>Categoría</Label>
      <div style={{ borderRadius: radii.md, border: `1px solid ${amber}4D`, background: '#16130C', padding: spacing[4], display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
        <span style={{ ...font(weights.semibold), fontSize: 16, color: colors.fg[1] }}>Categoría recomendada: Ropa</span>
        <span style={{ ...font(weights.regular), fontSize: 14, lineHeight: '20px', color: colors.fg[2] }}>Detectamos una compra de indumentaria que no encaja en tus categorías actuales.</span>
        <div style={{ alignSelf: 'flex-start', padding: `${spacing[2]}px ${spacing[4]}px`, borderRadius: radii.md, border: `1px solid ${amber}`, background: `${amber}14`, transform: `scale(${tap})` }}>
          <span style={{ ...font(weights.semibold), fontSize: 15, color: amber }}>Crear categoría &quot;Ropa&quot;</span>
        </div>
      </div>
    </div>
  );
};

export const ReviewScreen: React.FC<{ scrollY?: number }> = ({ scrollY = 0 }) => {
  const frame = useCurrentFrame();
  const created = frame >= CREATED;
  const tapScale = interpolate(frame, [TAP - 8, TAP, TAP + 8], [1, 0.94, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const amberOp = interpolate(frame, [CREATED - 8, CREATED + 6], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const chipOp = interpolate(frame, [CREATED, CREATED + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const toastOp = interpolate(frame, [CREATED + 2, CREATED + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      <div style={{ transform: `translateY(${-scrollY}px)`, padding: `0 ${spacing[5]}px`, width: 393, boxSizing: 'border-box' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], paddingTop: spacing[4], paddingBottom: spacing[5] }}>
          <ChevronLeft size={24} color={colors.fg[1]} strokeWidth={1.5} />
          <T variant="h1">Revisar documento</T>
        </div>

        {/* image thumbnail */}
        <div style={{ width: '100%', height: 160, borderRadius: radii.lg, background: colors.bg[2], overflow: 'hidden', marginBottom: spacing[5], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 128, height: 140, background: '#F4F7FB', borderRadius: 8, padding: 12, transform: 'rotate(-3deg)', boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}>
            <div style={{ ...font(weights.extrabold), fontSize: 11, color: '#0A0F1A' }}>RAPSODIA</div>
            <div style={{ height: 1, background: '#C0C7D2', margin: '7px 0' }} />
            {['Remera', 'Jean', 'Medias'].map((it) => <div key={it} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 8, color: '#3A4458', marginBottom: 3 }}><span>{it}</span><span>···</span></div>)}
            <div style={{ height: 1, background: '#C0C7D2', margin: '7px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 9, fontWeight: 800, color: '#0A0F1A' }}><span>TOTAL</span><span>48.900</span></div>
          </div>
        </div>

        {/* badge "Ticket" + direction toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: spacing[5] }}>
          <div style={{ background: colors.bg[2], borderRadius: radii.sm, padding: `${spacing[1]}px ${spacing[3]}px` }}>
            <span style={{ ...font(weights.regular), fontSize: 14, color: colors.fg[2] }}>Ticket</span>
          </div>
          <div style={{ display: 'flex', background: colors.bg[2], borderRadius: radii.sm, overflow: 'hidden' }}>
            <div style={{ padding: `${spacing[1]}px ${spacing[3]}px`, background: colors.brand[500] }}><span style={{ ...font(weights.regular), fontSize: 14, color: colors.fg.onBrand }}>Gasto</span></div>
            <div style={{ padding: `${spacing[1]}px ${spacing[3]}px` }}><span style={{ ...font(weights.regular), fontSize: 14, color: colors.fg[2] }}>Ingreso</span></div>
          </div>
        </div>

        {/* form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[5] }}>
          {/* Monto */}
          <div>
            <Label>Monto</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], background: colors.bg[2], borderRadius: radii.md, border: `1px solid ${colors.line[2]}`, padding: `${spacing[3]}px ${spacing[4]}px`, minHeight: 72 }}>
              <span style={{ ...font(weights.semibold), fontSize: 24, color: colors.fg[3] }}>$</span>
              <span style={{ flex: 1, textAlign: 'right', ...font(weights.medium, true), fontSize: 32, color: colors.fg[1], fontVariantNumeric: 'tabular-nums' }}>48.900,00</span>
            </div>
          </div>

          {/* Moneda */}
          <div>
            <Label>Moneda</Label>
            <div style={{ display: 'flex', gap: spacing[2], padding: spacing[1], background: colors.bg[2], borderRadius: radii.md, border: `1px solid ${colors.line[2]}` }}>
              <div style={{ flex: 1, textAlign: 'center', padding: `${spacing[2]}px 0`, borderRadius: radii.sm, background: colors.brand[400] }}><span style={{ ...font(weights.bold), fontSize: 14, color: colors.fg.onBrand }}>ARS</span></div>
              <div style={{ flex: 1, textAlign: 'center', padding: `${spacing[2]}px 0`, borderRadius: radii.sm }}><span style={{ ...font(weights.bold), fontSize: 14, color: colors.fg[2] }}>USD</span></div>
            </div>
          </div>

          {/* Fecha */}
          <div>
            <Label>Fecha</Label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, padding: `${spacing[3]}px ${spacing[4]}px`, background: colors.bg[2], borderRadius: radii.md, border: `1px solid ${colors.line[2]}` }}>
              <span style={{ ...font(weights.regular), fontSize: 14, color: colors.fg[1] }}>22 de junio de 2026</span>
              <Calendar size={18} color={colors.fg[3]} strokeWidth={1.5} />
            </div>
          </div>

          {/* Categoría */}
          <div>
            <Label>Categoría</Label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, padding: `${spacing[3]}px ${spacing[4]}px`, background: colors.bg[2], borderRadius: radii.md, border: `1px solid ${created ? colors.line[2] : colors.line[2]}` }}>
              {created ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], opacity: chipOp }}>
                  <div style={{ width: 28, height: 28, borderRadius: 14, background: '#8B5CF61A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shirt size={16} color="#8B5CF6" strokeWidth={1.5} /></div>
                  <span style={{ ...font(weights.semibold), fontSize: 14, color: colors.fg[1] }}>Ropa</span>
                </div>
              ) : (
                <span style={{ ...font(weights.regular), fontSize: 14, color: colors.fg[3] }}>Elegir categoría</span>
              )}
              <ChevronDown size={18} color={colors.fg[3]} strokeWidth={1.5} />
            </div>

            {/* OCR recommendation card (ámbar) — hasta crear la categoría */}
            {frame < CREATED + 8 && (
              <div style={{ marginTop: spacing[3], borderRadius: radii.md, border: `1px solid ${amber}4D`, background: `${amber}0D`, padding: spacing[3], display: 'flex', flexDirection: 'column', gap: spacing[2], opacity: amberOp }}>
                <span style={{ ...font(weights.semibold), fontSize: 14, color: colors.fg[1] }}>Categoría recomendada: Ropa</span>
                <span style={{ ...font(weights.regular), fontSize: 14, lineHeight: '20px', color: colors.fg[2] }}>Detectamos una compra de indumentaria que no encaja en tus categorías actuales.</span>
                <div style={{ alignSelf: 'flex-start', padding: `${spacing[2]}px ${spacing[3]}px`, borderRadius: radii.md, border: `1px solid ${amber}`, transform: `scale(${tapScale})` }}>
                  <span style={{ ...font(weights.semibold), fontSize: 14, color: amber }}>Crear categoría &quot;Ropa&quot;</span>
                </div>
              </div>
            )}

            {/* confirmación de categoría creada */}
            {created && (
              <div style={{ marginTop: spacing[3], display: 'inline-flex', alignItems: 'center', gap: spacing[2], background: 'rgba(16,185,129,0.12)', border: `1px solid ${colors.money.in}`, borderRadius: radii.pill, padding: `${spacing[2]}px ${spacing[4]}px`, alignSelf: 'flex-start', opacity: toastOp }}>
                <Check size={15} color={colors.money.in} strokeWidth={2.5} />
                <span style={{ ...font(weights.semibold), fontSize: 13, color: colors.money.in }}>Categoría &quot;Ropa&quot; creada</span>
              </div>
            )}
          </div>

          {/* Descripción */}
          <div>
            <Label>Descripción (opcional)</Label>
            <div style={{ minHeight: 48, padding: `${spacing[3]}px ${spacing[4]}px`, background: colors.bg[2], borderRadius: radii.md, border: `1px solid ${colors.line[2]}` }}>
              <span style={{ ...font(weights.regular), fontSize: 16, color: colors.fg[1] }}>Compra de ropa en Rapsodia</span>
            </div>
          </div>

          {/* Submit */}
          <div style={{ height: 56, borderRadius: radii.md, background: colors.brand[500], display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: spacing[2], marginBottom: spacing[6] }}>
            <span style={{ ...font(weights.semibold), fontSize: 16, color: colors.fg.onBrand }}>Registrar gasto</span>
          </div>
        </div>
      </div>
    </div>
  );
};
