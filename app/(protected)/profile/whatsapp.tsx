/**
 * RADAR — Vincular WhatsApp screen (HU-26)
 *
 * Shows the current WhatsApp link status for the authenticated user.
 *
 * Not linked:
 *   - "Generar código" button → calls create_link_code() RPC.
 *   - On success: displays the 6-char code prominently, an expiry hint, and
 *     step-by-step instructions. A wa.me deep link opens WhatsApp directly.
 *
 * Linked:
 *   - Shows the masked WhatsApp number.
 *   - "Desvincular" destructive button → confirmation then unlinkWhatsapp().
 *
 * Mirrors the structure and styling of edit-name.tsx.
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, H1, Icon } from '@/components/ui';
import { WHATSAPP_BOT_NUMBER, WHATSAPP_SANDBOX_JOIN } from '@/lib/repositories/whatsapp';
import { colors, spacing, typography } from '@/lib/theme';
import { useCreateLinkCode, useUnlinkWhatsapp, useWhatsappLink } from '@/hooks/use-whatsapp-link';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Masks all but the last 4 digits of a WhatsApp number for display. */
function maskNumber(waNumber: string): string {
  const digits = waNumber.replace(/\D/g, '');
  if (digits.length <= 4) return waNumber;
  return `+${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

/** Builds a wa.me deep link that pre-fills the link code. */
function buildWaLink(code: string): string {
  const digits = WHATSAPP_BOT_NUMBER.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(code)}`;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function WhatsappScreen(): React.JSX.Element {
  const { data: link, isLoading: linkLoading } = useWhatsappLink();
  const {
    mutate: generateCode,
    data: linkCode,
    isPending: generating,
    error: genError,
  } = useCreateLinkCode();
  const { mutate: doUnlink, isPending: unlinking, error: unlinkError } = useUnlinkWhatsapp();
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const isLinked = link?.status === 'linked';

  function handleGenerateCode(): void {
    generateCode();
  }

  function handleUnlink(): void {
    if (!confirmUnlink) {
      setConfirmUnlink(true);
      return;
    }
    doUnlink(undefined, {
      onSuccess: () => setConfirmUnlink(false),
    });
  }

  function handleCancelUnlink(): void {
    setConfirmUnlink(false);
  }

  async function handleOpenWhatsapp(): Promise<void> {
    if (!linkCode) return;
    const url = buildWaLink(linkCode.code);
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg[0] }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing[5] }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[3],
            paddingTop: spacing[4],
            paddingBottom: spacing[5],
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Volver"
            hitSlop={12}
            style={{ padding: spacing[1] }}
          >
            <Icon name="ChevronLeft" size={24} color={colors.fg[1]} />
          </Pressable>
          <H1>Vincular WhatsApp</H1>
        </View>

        {/* Subtitle */}
        <Body style={{ marginBottom: spacing[5], color: colors.fg[2] }}>
          Vinculá tu número de WhatsApp para registrar gastos e ingresos por chat.
        </Body>

        {/* Loading state */}
        {linkLoading && (
          <Body style={{ color: colors.fg[3], textAlign: 'center', marginTop: spacing[8] }}>
            Cargando…
          </Body>
        )}

        {/* Linked state */}
        {!linkLoading && isLinked && link && (
          <View style={{ gap: spacing[5] }}>
            {/* Linked badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
                backgroundColor: colors.bg[2],
                borderRadius: 14,
                padding: spacing[4],
              }}
            >
              <Icon name="CheckCircle" size={24} color={colors.money.in} />
              <View style={{ flex: 1 }}>
                <Body style={{ color: colors.fg[1], fontFamily: typography.family.semibold }}>
                  Vinculado
                </Body>
                <Body
                  style={{
                    color: colors.fg[2],
                    fontVariant: ['tabular-nums'],
                    marginTop: spacing[1],
                  }}
                  testID="linked-number"
                >
                  {maskNumber(link.waNumber)}
                </Body>
              </View>
            </View>

            {/* Unlink errors */}
            {unlinkError != null && (
              <Body style={{ color: colors.money.out, textAlign: 'center' }}>
                {unlinkError.message ?? 'No se pudo desvincular. Intentá nuevamente.'}
              </Body>
            )}

            {/* Confirm or unlink */}
            {confirmUnlink ? (
              <View style={{ gap: spacing[3] }}>
                <Body style={{ color: colors.fg[2], textAlign: 'center' }}>
                  ¿Seguro que querés desvincular tu número? No podrás usar el bot hasta que lo
                  vincules de nuevo.
                </Body>
                <Button
                  variant="destructive"
                  size="lg"
                  fullWidth
                  loading={unlinking}
                  onPress={handleUnlink}
                  accessibilityLabel="Confirmar desvinculación"
                >
                  Sí, desvincular
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  fullWidth
                  onPress={handleCancelUnlink}
                  accessibilityLabel="Cancelar desvinculación"
                >
                  Cancelar
                </Button>
              </View>
            ) : (
              <Button
                variant="destructive"
                size="lg"
                fullWidth
                loading={unlinking}
                onPress={handleUnlink}
                accessibilityLabel="Desvincular WhatsApp"
              >
                Desvincular
              </Button>
            )}
          </View>
        )}

        {/* Not-linked state */}
        {!linkLoading && !isLinked && (
          <View style={{ gap: spacing[5] }}>
            {/* Code display */}
            {linkCode != null && (
              <View style={{ gap: spacing[4] }}>
                {/* The code itself */}
                <View
                  style={{
                    backgroundColor: colors.bg[2],
                    borderRadius: 14,
                    padding: spacing[6],
                    alignItems: 'center',
                    gap: spacing[3],
                  }}
                >
                  <Body style={{ color: colors.fg[3] }}>Tu código de vinculación</Body>
                  <Body
                    style={{
                      color: colors.fg[1],
                      fontSize: typography.size.display,
                      // Explicit lineHeight ≥ fontSize: Body's default lineHeight is
                      // sized for body text and clips the tops of display-size glyphs.
                      lineHeight: Math.round(typography.size.display * 1.25),
                      fontFamily: typography.family.bold,
                      fontVariant: ['tabular-nums'],
                      textAlign: 'center',
                      letterSpacing: typography.letterSpacingFor(
                        typography.size.display,
                        'display',
                      ),
                    }}
                    testID="link-code"
                  >
                    {linkCode.code}
                  </Body>
                  <Body style={{ color: colors.amber[500] }}>Vence en 10 minutos</Body>
                </View>

                {/* Instructions */}
                <View
                  style={{
                    backgroundColor: colors.bg[1],
                    borderRadius: 14,
                    padding: spacing[4],
                    gap: spacing[3],
                  }}
                  testID="instructions"
                >
                  <Body style={{ color: colors.fg[2] }}>{'1. Abrí WhatsApp'}</Body>
                  <Body
                    style={{ color: colors.fg[2] }}
                  >{`2. Enviá "${WHATSAPP_SANDBOX_JOIN}" al ${WHATSAPP_BOT_NUMBER}`}</Body>
                  <Body style={{ color: colors.fg[2] }}>
                    {'3. Esto activa el sandbox de Twilio (una sola vez)'}
                  </Body>
                  <Body style={{ color: colors.fg[2] }}>
                    {'4. Mandá este código al mismo chat'}
                  </Body>
                </View>

                {/* Deep link button */}
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onPress={() => void handleOpenWhatsapp()}
                  accessibilityLabel="Abrir WhatsApp"
                >
                  Abrir WhatsApp
                </Button>
              </View>
            )}

            {/* Generate code error */}
            {genError != null && (
              <Body style={{ color: colors.money.out, textAlign: 'center' }} testID="gen-error">
                {genError.message ?? 'No se pudo generar el código. Intentá nuevamente.'}
              </Body>
            )}

            {/* Generate button */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={generating}
              onPress={handleGenerateCode}
              accessibilityLabel="Generar código de vinculación"
            >
              {linkCode != null ? 'Generar nuevo código' : 'Generar código'}
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
