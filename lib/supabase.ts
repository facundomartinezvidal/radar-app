import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Database } from '@/types/supabase';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string | undefined;
const supabaseKey = Constants.expoConfig?.extra?.supabaseKey as string | undefined;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[supabase] Missing environment variables.\n' +
      'Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY are set in your .env.local file ' +
      'and that app.config.ts injects them into the `extra` block.',
  );
}

/**
 * SecureStore-backed storage adapter for Supabase Auth.
 * Falls back to AsyncStorage on web (SecureStore is not available there).
 */
const storageAdapter =
  Platform.OS === 'web'
    ? AsyncStorage
    : {
        getItem: (key: string): Promise<string | null> => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string): Promise<void> =>
          SecureStore.setItemAsync(key, value),
        removeItem: (key: string): Promise<void> => SecureStore.deleteItemAsync(key),
      };

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type { Database };
