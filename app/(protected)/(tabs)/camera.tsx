/**
 * Camera screen — RADAR (scan → review flow)
 *
 * Captures or picks a receipt image (or PDF document) and navigates to the
 * OCR review screen. No upload happens here; the review screen owns that step.
 */
import { router } from 'expo-router';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, BodySm, Button, Icon } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabMode = 'camera' | 'gallery' | 'document';

type DocumentKind = 'image' | 'pdf';

interface PickedDocument {
  uri: string;
  kind: DocumentKind;
  mimeType: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveDocumentKind(mimeType: string | undefined, name: string): DocumentKind | null {
  if (!mimeType && !name) return null;

  if (mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
    return 'pdf';
  }

  if (mimeType && mimeType.startsWith('image/')) {
    return 'image';
  }

  // Fallback: detect by extension when mimeType is absent or generic
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'].includes(ext)) {
    return 'image';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CameraScreen() {
  // --- permission ---
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // --- tab toggle ---
  const [mode, setMode] = useState<TabMode>('camera');

  // --- camera state ---
  const [facing, setFacing] = useState<CameraType>('back');
  const cameraRef = useRef<CameraView>(null);

  // --- preview / post-capture state ---
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // --- document picker state ---
  const [pickedDocument, setPickedDocument] = useState<PickedDocument | null>(null);

  // --- capture / picker error ---
  const [captureError, setCaptureError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleModeChange(newMode: TabMode): void {
    setMode(newMode);
    setPreviewUri(null);
    setPickedDocument(null);
    setCaptureError(null);
  }

  async function handleCapture(): Promise<void> {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        setCaptureError(null);
        setPreviewUri(photo.uri);
      }
    } catch {
      setCaptureError('No se pudo capturar la imagen. Intentá nuevamente.');
    }
  }

  function handleRetake(): void {
    setPreviewUri(null);
  }

  async function handlePickFromGallery(): Promise<void> {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setCaptureError(null);
        setPreviewUri(result.assets[0].uri);
      }
    } catch {
      setCaptureError('No se pudo abrir la galería. Intentá nuevamente.');
    }
  }

  async function handlePickDocument(): Promise<void> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return; // cancel → no error, no navigation

      const asset = result.assets[0];
      if (!asset) return;

      // Validate size
      if (asset.size != null && asset.size > MAX_FILE_SIZE) {
        setCaptureError('El archivo es muy grande. Elegí uno de hasta 10 MB.');
        return;
      }

      // Resolve kind
      const kind = resolveDocumentKind(asset.mimeType ?? undefined, asset.name);
      if (kind === null) {
        setCaptureError('Formato no soportado. Subí un PDF o una imagen.');
        return;
      }

      setCaptureError(null);
      setPickedDocument({
        uri: asset.uri,
        kind,
        mimeType: asset.mimeType ?? (kind === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        name: asset.name,
      });
    } catch {
      setCaptureError('No se pudo abrir el selector de archivos. Intentá nuevamente.');
    }
  }

  function handleContinue(): void {
    if (mode === 'document') {
      if (!pickedDocument) return;
      const { uri, kind, mimeType, name } = pickedDocument;
      // Include imageUri for backward-compat when kind=image (review screen still reads it)
      const imageUriParam = kind === 'image' ? `&imageUri=${encodeURIComponent(uri)}` : '';
      router.push(
        `/(protected)/expense/review?uri=${encodeURIComponent(uri)}&kind=${encodeURIComponent(kind)}&mimeType=${encodeURIComponent(mimeType)}&name=${encodeURIComponent(name)}${imageUriParam}` as Parameters<
          typeof router.push
        >[0],
      );
      setPickedDocument(null);
      return;
    }

    if (!previewUri) return;
    router.push(
      `/(protected)/expense/review?uri=${encodeURIComponent(previewUri)}&kind=image&mimeType=image%2Fjpeg&name=captura.jpg&imageUri=${encodeURIComponent(previewUri)}` as Parameters<
        typeof router.push
      >[0],
    );
    // Reset preview so returning to this tab starts fresh.
    setPreviewUri(null);
  }

  function handleFlipCamera(): void {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderTabToggle() {
    return (
      <View style={styles.tabToggle}>
        <TouchableOpacity
          style={[styles.tabButton, mode === 'camera' && styles.tabButtonActive]}
          onPress={() => handleModeChange('camera')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'camera' }}
        >
          <Body style={[styles.tabButtonText, mode === 'camera' && styles.tabButtonTextActive]}>
            Cámara
          </Body>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, mode === 'gallery' && styles.tabButtonActive]}
          onPress={() => handleModeChange('gallery')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'gallery' }}
        >
          <Body style={[styles.tabButtonText, mode === 'gallery' && styles.tabButtonTextActive]}>
            Galería
          </Body>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, mode === 'document' && styles.tabButtonActive]}
          onPress={() => handleModeChange('document')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'document' }}
        >
          <Body style={[styles.tabButtonText, mode === 'document' && styles.tabButtonTextActive]}>
            Documento
          </Body>
        </TouchableOpacity>
      </View>
    );
  }

  function renderPreviewActions() {
    return (
      <View style={styles.previewContainer}>
        <Image source={{ uri: previewUri ?? '' }} style={styles.previewImage} contentFit="cover" />
        <View style={styles.previewActions}>
          <View style={styles.previewActionButton}>
            <Button
              variant="secondary"
              size="md"
              onPress={handleRetake}
              accessibilityLabel="Volver a capturar"
            >
              Volver a tomar
            </Button>
          </View>
          <View style={styles.previewActionButton}>
            <Button
              variant="primary"
              size="md"
              onPress={handleContinue}
              accessibilityLabel="Continuar con esta imagen"
            >
              Continuar
            </Button>
          </View>
        </View>
      </View>
    );
  }

  function renderCameraContent() {
    if (!cameraPermission) {
      return (
        <View style={styles.centeredContent}>
          <Body style={styles.permissionText}>Verificando permisos de cámara...</Body>
        </View>
      );
    }

    if (!cameraPermission.granted) {
      return (
        <View style={styles.centeredContent}>
          <Body style={styles.permissionText}>Se requiere permiso para acceder a la cámara.</Body>
          <Button
            variant="primary"
            size="md"
            onPress={() => void requestCameraPermission()}
            accessibilityLabel="Solicitar permiso de cámara"
          >
            Conceder permiso
          </Button>
        </View>
      );
    }

    if (previewUri) {
      return renderPreviewActions();
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={handleFlipCamera}
            accessibilityRole="button"
            accessibilityLabel="Cambiar cámara"
          >
            <Icon name="RotateCw" size={22} color={colors.fg.onBrand} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.captureButton}
            onPress={() => void handleCapture()}
            accessibilityRole="button"
            accessibilityLabel="Capturar foto"
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
          {/* Spacer to balance the flip button */}
          <View style={styles.flipButton} />
        </View>
      </View>
    );
  }

  function renderGalleryContent() {
    if (previewUri) {
      return renderPreviewActions();
    }

    return (
      <View style={styles.centeredContent}>
        <Button
          variant="primary"
          size="md"
          onPress={() => void handlePickFromGallery()}
          accessibilityLabel="Seleccionar imagen de la galería"
        >
          Seleccionar de la galería
        </Button>
      </View>
    );
  }

  function renderDocumentContent() {
    if (pickedDocument) {
      if (pickedDocument.kind === 'image') {
        // Reuse image preview for image-kind documents
        return (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: pickedDocument.uri }}
              style={styles.previewImage}
              contentFit="cover"
            />
            <View style={styles.previewActions}>
              <View style={styles.previewActionButton}>
                <Button
                  variant="secondary"
                  size="md"
                  onPress={() => setPickedDocument(null)}
                  accessibilityLabel="Volver a elegir archivo"
                >
                  Volver a elegir
                </Button>
              </View>
              <View style={styles.previewActionButton}>
                <Button
                  variant="primary"
                  size="md"
                  onPress={handleContinue}
                  accessibilityLabel="Continuar con este archivo"
                >
                  Continuar
                </Button>
              </View>
            </View>
          </View>
        );
      }

      // PDF confirmation card
      return (
        <View style={styles.centeredContent}>
          <View style={styles.pdfCard}>
            <Icon name="FileText" size={40} color={colors.brand[500]} strokeWidth={1.5} />
            <Body style={styles.pdfCardName} numberOfLines={2}>
              {pickedDocument.name}
            </Body>
            <View style={styles.pdfCardActions}>
              <View style={styles.previewActionButton}>
                <Button
                  variant="secondary"
                  size="md"
                  onPress={() => setPickedDocument(null)}
                  accessibilityLabel="Volver a elegir archivo"
                >
                  Volver a elegir
                </Button>
              </View>
              <View style={styles.previewActionButton}>
                <Button
                  variant="primary"
                  size="md"
                  onPress={handleContinue}
                  accessibilityLabel="Continuar con este archivo"
                >
                  Continuar
                </Button>
              </View>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.centeredContent}>
        <Button
          variant="primary"
          size="md"
          onPress={() => void handlePickDocument()}
          accessibilityLabel="Seleccionar documento PDF o imagen"
        >
          Seleccionar documento
        </Button>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Root render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {renderTabToggle()}
        {captureError ? (
          <View style={styles.errorNotice}>
            <BodySm style={styles.errorNoticeText}>{captureError}</BodySm>
          </View>
        ) : null}
        <View style={styles.content}>
          {mode === 'camera'
            ? renderCameraContent()
            : mode === 'gallery'
              ? renderGalleryContent()
              : renderDocumentContent()}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg[0],
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg[0],
  },
  // --- capture / picker error notice ---
  errorNotice: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
    backgroundColor: colors.bg[1],
    borderLeftWidth: 3,
    borderLeftColor: colors.money.out,
    borderRadius: radii.sm,
    padding: spacing[3],
  },
  errorNoticeText: {
    color: colors.fg[2],
  },
  // --- tab toggle ---
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bg[2],
    marginHorizontal: spacing[4],
    marginVertical: spacing[3],
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing[2] + 2,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.brand[500],
  },
  tabButtonText: {
    color: colors.fg[3],
    fontFamily: typography.family.semibold,
    fontSize: 15,
  },
  tabButtonTextActive: {
    color: colors.fg.onBrand,
  },
  // --- content area ---
  content: {
    flex: 1,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[6],
  },
  // --- camera ---
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.fg.onBrand,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.fg.onBrand,
  },
  // --- permission ---
  permissionText: {
    color: colors.fg[1],
    textAlign: 'center',
  },
  // --- preview ---
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
  },
  previewActions: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[4],
    paddingHorizontal: 32,
  },
  previewActionButton: {
    flex: 1,
  },
  // --- PDF confirmation card ---
  pdfCard: {
    backgroundColor: colors.bg[1],
    borderRadius: radii.md,
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[4],
    width: '100%',
  },
  pdfCardName: {
    color: colors.fg[1],
    textAlign: 'center',
  },
  pdfCardActions: {
    flexDirection: 'row',
    gap: spacing[4],
    width: '100%',
  },
});
