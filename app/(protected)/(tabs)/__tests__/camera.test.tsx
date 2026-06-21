/**
 * Tests for CameraScreen (scan → review flow).
 *
 * Covers:
 *   - Permission not granted shows permission UI
 *   - After gallery pick resolves with asset URI, tapping "Continuar" calls
 *     router.push with the review pathname and imageUri param
 *   - Tapping "Volver a tomar" in preview clears the preview
 *   - "Documento" tab renders and is selectable
 *   - Picking a PDF navigates with kind=pdf, mimeType, name, uri (no imageUri)
 *   - Picking an image via document picker navigates with kind=image + imageUri
 *   - Cancel → no navigation, no error shown
 *   - Oversized file (size > 10MB) → error message shown, no navigation
 *   - Unsupported type → error message, no navigation
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { router } from 'expo-router';

import CameraScreen from '../camera';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// expo-camera — CameraView is a plain View; useCameraPermissions is controllable.
let mockCameraPermission: { granted: boolean } | null = { granted: true };
const mockRequestCameraPermission = jest.fn().mockResolvedValue({ granted: true });

jest.mock('expo-camera', () => {
  const { View } = require('react-native');
  return {
    CameraView: View,
    useCameraPermissions: () => [mockCameraPermission, mockRequestCameraPermission],
  };
});

// expo-image-picker — controllable resolved value.
const mockLaunchImageLibrary = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibrary(...args),
}));

// expo-document-picker — controllable resolved value.
const mockGetDocumentAsync = jest.fn();
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

// expo-image — render a plain View; must use require inside factory (no out-of-scope vars).
jest.mock('expo-image', () => {
  const ReactInner = require('react');
  const { View } = require('react-native');
  return {
    Image: ({ source, testID, ...rest }: { source?: { uri?: string }; testID?: string }) =>
      ReactInner.createElement(View, {
        testID: testID ?? `expo-image-${source?.uri ?? 'unknown'}`,
        ...rest,
      }),
  };
});

// react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_IMAGE_URI = 'file:///tmp/test-receipt.jpg';
const TEST_PDF_URI = 'file:///tmp/test-document.pdf';

function renderScreen() {
  return render(<CameraScreen />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CameraScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: permission granted.
    mockCameraPermission = { granted: true };
    mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: [] });
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });
  });

  describe('permission UI', () => {
    it('shows permission request UI when camera permission is not granted', () => {
      mockCameraPermission = { granted: false };
      renderScreen();
      expect(screen.getByText('Se requiere permiso para acceder a la cámara.')).toBeTruthy();
      expect(screen.getByText('Conceder permiso')).toBeTruthy();
    });

    it('does not show permission text when permission is granted', () => {
      mockCameraPermission = { granted: true };
      renderScreen();
      expect(screen.queryByText('Se requiere permiso para acceder a la cámara.')).toBeNull();
    });

    it('calls requestCameraPermission when "Conceder permiso" is pressed', () => {
      mockCameraPermission = { granted: false };
      renderScreen();
      fireEvent.press(screen.getByText('Conceder permiso'));
      expect(mockRequestCameraPermission).toHaveBeenCalledTimes(1);
    });
  });

  describe('gallery → preview → navigate', () => {
    it('shows gallery button in gallery mode', () => {
      renderScreen();
      // Switch to gallery tab
      fireEvent.press(screen.getByText('Galería'));
      expect(screen.getByText('Seleccionar de la galería')).toBeTruthy();
    });

    it('after gallery pick resolves with asset URI, shows preview actions', async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        canceled: false,
        assets: [{ uri: TEST_IMAGE_URI }],
      });

      renderScreen();
      fireEvent.press(screen.getByText('Galería'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar de la galería'));
      });

      expect(screen.getByText('Continuar')).toBeTruthy();
      expect(screen.getByText('Volver a tomar')).toBeTruthy();
    });

    it('tapping "Continuar" calls router.push with review pathname and imageUri param', async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        canceled: false,
        assets: [{ uri: TEST_IMAGE_URI }],
      });

      renderScreen();
      fireEvent.press(screen.getByText('Galería'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar de la galería'));
      });

      fireEvent.press(screen.getByText('Continuar'));

      expect(router.push).toHaveBeenCalledTimes(1);
      const pushArg = (router.push as jest.Mock).mock.calls[0][0] as string;
      expect(pushArg).toContain('/(protected)/expense/review');
      expect(pushArg).toContain(encodeURIComponent(TEST_IMAGE_URI));
    });

    it('tapping "Continuar" resets preview state (gallery button reappears after push)', async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        canceled: false,
        assets: [{ uri: TEST_IMAGE_URI }],
      });

      renderScreen();
      fireEvent.press(screen.getByText('Galería'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar de la galería'));
      });

      // Preview is shown
      expect(screen.getByText('Continuar')).toBeTruthy();

      fireEvent.press(screen.getByText('Continuar'));

      // After continue, previewUri is cleared — gallery button is back
      expect(screen.getByText('Seleccionar de la galería')).toBeTruthy();
      expect(screen.queryByText('Continuar')).toBeNull();
    });

    it('tapping "Volver a tomar" clears preview and shows gallery button again', async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        canceled: false,
        assets: [{ uri: TEST_IMAGE_URI }],
      });

      renderScreen();
      fireEvent.press(screen.getByText('Galería'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar de la galería'));
      });

      expect(screen.getByText('Volver a tomar')).toBeTruthy();

      fireEvent.press(screen.getByText('Volver a tomar'));

      expect(screen.getByText('Seleccionar de la galería')).toBeTruthy();
      expect(screen.queryByText('Volver a tomar')).toBeNull();
    });

    it('does not call router.push when gallery pick is canceled', async () => {
      mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: [] });

      renderScreen();
      fireEvent.press(screen.getByText('Galería'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar de la galería'));
      });

      expect(router.push).not.toHaveBeenCalled();
      // Still shows gallery button (no preview)
      expect(screen.getByText('Seleccionar de la galería')).toBeTruthy();
    });

    it('shows an error notice when the gallery picker rejects', async () => {
      mockLaunchImageLibrary.mockRejectedValue(new Error('picker failed'));

      renderScreen();
      fireEvent.press(screen.getByText('Galería'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar de la galería'));
      });

      expect(screen.getByText('No se pudo abrir la galería. Intentá nuevamente.')).toBeTruthy();
      // No preview or navigation should happen
      expect(router.push).not.toHaveBeenCalled();
    });
  });

  describe('document tab', () => {
    it('renders the "Documento" tab button', () => {
      renderScreen();
      expect(screen.getByText('Documento')).toBeTruthy();
    });

    it('switches to document mode on pressing "Documento" tab', () => {
      renderScreen();
      fireEvent.press(screen.getByText('Documento'));
      expect(screen.getByText('Seleccionar documento')).toBeTruthy();
    });

    it('cancel → no navigation, no error shown', async () => {
      mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });

      renderScreen();
      fireEvent.press(screen.getByText('Documento'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar documento'));
      });

      expect(router.push).not.toHaveBeenCalled();
      expect(screen.queryByText(/grande|soportado/)).toBeNull();
      expect(screen.getByText('Seleccionar documento')).toBeTruthy();
    });

    it('picking a PDF navigates with kind=pdf, mimeType, name, uri and NO imageUri', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: TEST_PDF_URI,
            mimeType: 'application/pdf',
            name: 'comprobante.pdf',
            size: 500 * 1024,
          },
        ],
      });

      renderScreen();
      fireEvent.press(screen.getByText('Documento'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar documento'));
      });

      // PDF card should show up
      expect(screen.getByText('comprobante.pdf')).toBeTruthy();

      fireEvent.press(screen.getByText('Continuar'));

      expect(router.push).toHaveBeenCalledTimes(1);
      const pushArg = (router.push as jest.Mock).mock.calls[0][0] as string;
      expect(pushArg).toContain('/(protected)/expense/review');
      expect(pushArg).toContain('kind=pdf');
      expect(pushArg).toContain(encodeURIComponent('application/pdf'));
      expect(pushArg).toContain(encodeURIComponent('comprobante.pdf'));
      expect(pushArg).toContain(encodeURIComponent(TEST_PDF_URI));
      // Must NOT contain imageUri for PDF
      expect(pushArg).not.toContain('imageUri');
    });

    it('picking an image via document picker navigates with kind=image and includes imageUri', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: TEST_IMAGE_URI,
            mimeType: 'image/jpeg',
            name: 'foto.jpg',
            size: 1 * 1024 * 1024,
          },
        ],
      });

      renderScreen();
      fireEvent.press(screen.getByText('Documento'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar documento'));
      });

      fireEvent.press(screen.getByText('Continuar'));

      expect(router.push).toHaveBeenCalledTimes(1);
      const pushArg = (router.push as jest.Mock).mock.calls[0][0] as string;
      expect(pushArg).toContain('/(protected)/expense/review');
      expect(pushArg).toContain('kind=image');
      expect(pushArg).toContain(encodeURIComponent('image/jpeg'));
      expect(pushArg).toContain(encodeURIComponent(TEST_IMAGE_URI));
      // Must include imageUri for backward-compat when kind=image
      expect(pushArg).toContain('imageUri=');
    });

    it('oversized file (> 10MB) → error message shown, no navigation', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: TEST_PDF_URI,
            mimeType: 'application/pdf',
            name: 'huge.pdf',
            size: 11 * 1024 * 1024, // 11 MB
          },
        ],
      });

      renderScreen();
      fireEvent.press(screen.getByText('Documento'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar documento'));
      });

      expect(screen.getByText('El archivo es muy grande. Elegí uno de hasta 10 MB.')).toBeTruthy();
      expect(router.push).not.toHaveBeenCalled();
    });

    it('unsupported type (.docx) → error message shown, no navigation', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: 'file:///tmp/report.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            name: 'report.docx',
            size: 200 * 1024,
          },
        ],
      });

      renderScreen();
      fireEvent.press(screen.getByText('Documento'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar documento'));
      });

      expect(screen.getByText('Formato no soportado. Subí un PDF o una imagen.')).toBeTruthy();
      expect(router.push).not.toHaveBeenCalled();
    });

    it('"Volver a elegir" from PDF card clears state and returns to picker button', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: TEST_PDF_URI,
            mimeType: 'application/pdf',
            name: 'doc.pdf',
            size: 300 * 1024,
          },
        ],
      });

      renderScreen();
      fireEvent.press(screen.getByText('Documento'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar documento'));
      });

      expect(screen.getByText('doc.pdf')).toBeTruthy();

      fireEvent.press(screen.getByText('Volver a elegir'));

      expect(screen.queryByText('doc.pdf')).toBeNull();
      expect(screen.getByText('Seleccionar documento')).toBeTruthy();
    });

    it('PDF with size=null (unknown size) is accepted without error', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: TEST_PDF_URI,
            mimeType: 'application/pdf',
            name: 'nocache.pdf',
            size: null,
          },
        ],
      });

      renderScreen();
      fireEvent.press(screen.getByText('Documento'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar documento'));
      });

      expect(screen.getByText('nocache.pdf')).toBeTruthy();
      expect(screen.queryByText(/grande|soportado/)).toBeNull();
    });

    it('detects PDF by filename extension when mimeType is absent', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: TEST_PDF_URI,
            mimeType: null,
            name: 'recibo.pdf',
            size: 200 * 1024,
          },
        ],
      });

      renderScreen();
      fireEvent.press(screen.getByText('Documento'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar documento'));
      });

      // Should have resolved kind=pdf and show card
      expect(screen.getByText('recibo.pdf')).toBeTruthy();
    });

    it('detects image by jpg extension when mimeType is absent', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: TEST_IMAGE_URI,
            mimeType: null,
            name: 'foto.jpg',
            size: 500 * 1024,
          },
        ],
      });

      renderScreen();
      fireEvent.press(screen.getByText('Documento'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar documento'));
      });

      // Should have resolved kind=image and show image preview with Continuar
      expect(screen.getByText('Continuar')).toBeTruthy();
    });
  });

  describe('camera → gallery handoff preserves imageUri param', () => {
    it('gallery continue includes uri, kind=image, and imageUri', async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        canceled: false,
        assets: [{ uri: TEST_IMAGE_URI }],
      });

      renderScreen();
      fireEvent.press(screen.getByText('Galería'));

      await act(async () => {
        fireEvent.press(screen.getByText('Seleccionar de la galería'));
      });

      fireEvent.press(screen.getByText('Continuar'));

      const pushArg = (router.push as jest.Mock).mock.calls[0][0] as string;
      expect(pushArg).toContain('kind=image');
      expect(pushArg).toContain('imageUri=');
      expect(pushArg).toContain(encodeURIComponent(TEST_IMAGE_URI));
    });
  });
});
