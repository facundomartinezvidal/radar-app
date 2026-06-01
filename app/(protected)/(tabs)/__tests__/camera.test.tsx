/**
 * Tests for CameraScreen (scan → review flow).
 *
 * Covers:
 *   - Permission not granted shows permission UI
 *   - After gallery pick resolves with asset URI, tapping "Continuar" calls
 *     router.push with the review pathname and imageUri param
 *   - Tapping "Volver a tomar" in preview clears the preview
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
      // The review screen is not yet registered in typed-routes, so the call uses a
      // string path with imageUri encoded as a query param.
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
  });
});
