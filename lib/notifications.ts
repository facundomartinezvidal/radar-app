import { useEffect } from 'react';

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Set the global notification handler once at module load time.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Requests permission and returns the Expo push token for the current device,
 * or null when running in a simulator/emulator or when the EAS project ID is missing.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (!Device.isDevice) {
    console.warn('[notifications] Push tokens require a physical device. Skipping registration.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[notifications] Push notification permission not granted.');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    console.warn(
      '[notifications] EAS_PROJECT_ID not set; push tokens require EAS project. ' +
        'Set EAS_PROJECT_ID in .env.local and ensure app.config.ts injects it into extra.eas.projectId.',
    );
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return token;
}

/**
 * Upserts the push token for the given user into the `device_tokens` table.
 * If the table does not yet exist (Postgres error 42P01), logs a warning and
 * returns silently — the caller can wire up the schema later.
 *
 * The supabase client is cast to `unknown` at the call site because the
 * generated Database types do not include `device_tokens` until the schema
 * migration is applied; this is expected and intentional.
 */
export async function savePushTokenToSupabase(userId: string, token: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as any;
    const { error } = (await db.from('device_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    )) as { error: { code?: string; message?: string } | null };

    if (error) {
      // 42P01 = undefined_table — schema not yet created, fail silently.
      if (error.code === '42P01') {
        console.warn(
          '[notifications] device_tokens table does not exist yet. ' +
            'Create the table via the SQL in README.md to enable token persistence.',
        );
        return;
      }
      throw error;
    }
  } catch (err) {
    // Re-check in catch for errors that may not surface via the Supabase error field.
    const code = (err as { code?: string })?.code;
    if (code === '42P01') {
      console.warn(
        '[notifications] device_tokens table does not exist yet. ' +
          'Create the table via the SQL in README.md to enable token persistence.',
      );
      return;
    }
    throw err;
  }
}

/**
 * Hook that listens for notification tap events for the lifetime of the
 * component. Logs the response data as a placeholder for deep-link handling.
 */
export function useNotificationObserver(): void {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[notifications] Notification tapped:', JSON.stringify(response, null, 2));
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
