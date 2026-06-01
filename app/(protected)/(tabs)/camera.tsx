/**
 * Camera screen — RADAR (scan → review flow)
 *
 * Captures or picks a receipt image and navigates to the OCR review screen.
 * No upload happens here; the review screen owns that step.
 */
import { router } from 'expo-router';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Icon } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabMode = 'camera' | 'gallery';

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

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleModeChange(newMode: TabMode): void {
    setMode(newMode);
    setPreviewUri(null);
  }

  async function handleCapture(): Promise<void> {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
    if (photo?.uri) {
      setPreviewUri(photo.uri);
    }
  }

  function handleRetake(): void {
    setPreviewUri(null);
  }

  async function handlePickFromGallery(): Promise<void> {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setPreviewUri(result.assets[0].uri);
    }
  }

  function handleContinue(): void {
    if (!previewUri) return;
    // review screen does not exist yet — cast via unknown to satisfy typed-routes until
    // the file is created; same pattern used for dynamic segments in expenses.tsx.
    router.push(
      `/(protected)/expense/review?imageUri=${encodeURIComponent(previewUri)}` as Parameters<
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

  // ---------------------------------------------------------------------------
  // Root render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {renderTabToggle()}
        <View style={styles.content}>
          {mode === 'camera' ? renderCameraContent() : renderGalleryContent()}
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
});
