import { useMutation } from '@tanstack/react-query';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/hooks/use-session';
import { uploadMediaToSupabase } from '@/lib/storage';

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
          <Text style={[styles.tabButtonText, mode === 'camera' && styles.tabButtonTextActive]}>
            Cámara
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, mode === 'gallery' && styles.tabButtonActive]}
          onPress={() => handleModeChange('gallery')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'gallery' }}
        >
          <Text style={[styles.tabButtonText, mode === 'gallery' && styles.tabButtonTextActive]}>
            Galería
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderFeedback() {
    if (successMessage) {
      return (
        <View style={styles.feedbackContainer}>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      );
    }
    if (errorMessage) {
      return (
        <View style={styles.feedbackContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
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
          <ActivityIndicator size="large" color="#0a7ea4" style={styles.loader} />
        ) : (
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.retakeButton]}
              onPress={handleRetake}
              accessibilityRole="button"
              accessibilityLabel="Volver a capturar"
            >
              <Text style={styles.actionButtonText}>Volver a tomar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.uploadButton]}
              onPress={handleUpload}
              accessibilityRole="button"
              accessibilityLabel="Subir imagen"
            >
              <Text style={[styles.actionButtonText, styles.uploadButtonText]}>Subir</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  function renderCameraContent() {
    if (!cameraPermission) {
      // Permissions are still loading
      return (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      );
    }

    if (!cameraPermission.granted) {
      return (
        <View style={styles.centeredContent}>
          <Text style={styles.permissionText}>Se requiere permiso para acceder a la cámara.</Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestCameraPermission}
            accessibilityRole="button"
            accessibilityLabel="Solicitar permiso de cámara"
          >
            <Text style={styles.permissionButtonText}>Conceder permiso</Text>
          </TouchableOpacity>
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
            <Text style={styles.flipButtonText}>{Platform.OS === 'ios' ? '⇄' : '⇄'}</Text>
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
        <TouchableOpacity
          style={styles.galleryPickButton}
          onPress={handlePickFromGallery}
          accessibilityRole="button"
          accessibilityLabel="Seleccionar imagen de la galería"
        >
          <Text style={styles.galleryPickButtonText}>Seleccionar de la galería</Text>
        </TouchableOpacity>
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
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // --- tab toggle ---
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: '#111',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#0a7ea4',
  },
  tabButtonText: {
    color: '#9BA1A6',
    fontWeight: '600',
    fontSize: 15,
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  // --- content area ---
  content: {
    flex: 1,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
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
  flipButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  // --- permission ---
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
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
    gap: 16,
    paddingHorizontal: 32,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  retakeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  uploadButton: {
    backgroundColor: '#0a7ea4',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  uploadButtonText: {
    color: '#fff',
  },
  loader: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  // --- gallery ---
  galleryPickButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  galleryPickButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  // --- feedback ---
  feedbackContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  successText: {
    color: '#4ade80',
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
  },
  errorText: {
    color: '#f87171',
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
  },
});
