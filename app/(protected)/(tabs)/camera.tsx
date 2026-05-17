/**
 * Camera screen — RADAR (Phase C5)
 *
 * Restyled to use DS tokens and Lucide icons.
 * Logic kept intact — only visual layer updated.
 */
import { useMutation } from '@tanstack/react-query';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Icon } from '@/components/ui';
import { useSession } from '@/hooks/use-session';
import { uploadMediaToSupabase } from '@/lib/storage';
import { colors, radii, spacing, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabMode = 'camera' | 'gallery';

interface UploadArgs {
  userId: string;
  fileUri: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CameraScreen() {
  const { user } = useSession();

  // --- permission ---
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // --- tab toggle ---
  const [mode, setMode] = useState<TabMode>('camera');

  // --- camera state ---
  const [facing, setFacing] = useState<CameraType>('back');
  const cameraRef = useRef<CameraView>(null);

  // --- preview / post-capture state ---
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // --- upload feedback ---
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- upload mutation ---
  const uploadMutation = useMutation({
    mutationFn: async ({ userId, fileUri }: UploadArgs) => {
      return uploadMediaToSupabase({
        userId,
        fileUri,
        mimeType: 'image/jpeg',
      });
    },
    onSuccess: (result) => {
      if (result === null) {
        setErrorMessage('El bucket de almacenamiento no existe. Créalo en el panel de Supabase.');
      } else {
        setSuccessMessage('¡Imagen subida con éxito!');
        setPreviewUri(null);
      }
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Error al subir la imagen.';
      setErrorMessage(message);
    },
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleModeChange(newMode: TabMode): void {
    setMode(newMode);
    setPreviewUri(null);
    setSuccessMessage(null);
    setErrorMessage(null);
    uploadMutation.reset();
  }

  async function handleCapture(): Promise<void> {
    setSuccessMessage(null);
    setErrorMessage(null);
    uploadMutation.reset();

    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
    if (photo?.uri) {
      setPreviewUri(photo.uri);
    }
  }

  function handleRetake(): void {
    setPreviewUri(null);
    setSuccessMessage(null);
    setErrorMessage(null);
    uploadMutation.reset();
  }

  async function handlePickFromGallery(): Promise<void> {
    setSuccessMessage(null);
    setErrorMessage(null);
    uploadMutation.reset();

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setPreviewUri(result.assets[0].uri);
    }
  }

  function handleUpload(): void {
    if (!user || !previewUri) return;
    setSuccessMessage(null);
    setErrorMessage(null);
    uploadMutation.mutate({ userId: user.id, fileUri: previewUri });
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

  function renderFeedback() {
    if (successMessage) {
      return (
        <View style={styles.feedbackContainer}>
          <Body style={styles.successText}>{successMessage}</Body>
        </View>
      );
    }
    if (errorMessage) {
      return (
        <View style={styles.feedbackContainer}>
          <Body style={styles.errorText}>{errorMessage}</Body>
        </View>
      );
    }
    return null;
  }

  function renderPreviewAndUpload() {
    return (
      <View style={styles.previewContainer}>
        <Image source={{ uri: previewUri ?? '' }} style={styles.previewImage} contentFit="cover" />
        {renderFeedback()}
        {uploadMutation.isPending ? (
          <ActivityIndicator size="large" color={colors.brand[500]} style={styles.loader} />
        ) : (
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
                onPress={handleUpload}
                accessibilityLabel="Subir imagen"
              >
                Subir
              </Button>
            </View>
          </View>
        )}
      </View>
    );
  }

  function renderCameraContent() {
    if (!cameraPermission) {
      return (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
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
      return renderPreviewAndUpload();
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
            onPress={handleCapture}
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
      return renderPreviewAndUpload();
    }

    return (
      <View style={styles.centeredContent}>
        {renderFeedback()}
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
  loader: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  // --- feedback ---
  feedbackContainer: {
    position: 'absolute',
    top: spacing[4],
    left: spacing[4],
    right: spacing[4],
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: radii.sm,
    padding: spacing[3],
    alignItems: 'center',
  },
  successText: {
    color: colors.money.in,
    fontFamily: typography.family.semibold,
    textAlign: 'center',
  },
  errorText: {
    color: colors.money.out,
    fontFamily: typography.family.semibold,
    textAlign: 'center',
  },
});
