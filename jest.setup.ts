// RNTL v13 ships matchers natively and calls expect.extend() when this entry is imported.
// This replaces the deprecated @testing-library/jest-native package.
import '@testing-library/jest-native/extend-expect';

// Mock expo-router — prevents errors when importing screens that call router.push() / useRouter()
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  Stack: {
    Screen: () => null,
  },
}));

// Silence specific noisy warnings during tests
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  // Skip known harmless warnings from RN/Expo libs in test environment
  if (msg.includes('useNativeDriver')) return;
  if (msg.includes('SafeAreaView has been deprecated')) return;
  originalWarn(...args);
};

// Mock expo-secure-store (jest-expo handles most modules but not this one fully)
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-constants to provide test env values
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseKey: 'test-key',
        eas: { projectId: 'test-project-id' },
      },
    },
  },
}));

// Mock Supabase client to prevent actual network calls
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      verifyOtp: jest.fn().mockResolvedValue({ data: null, error: null }),
      resend: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://test/url' } })),
      })),
    },
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));
