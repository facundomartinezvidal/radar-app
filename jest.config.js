module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Allow Jest to transform Expo + RN packages.
  // The leading "/" anchors to the path root; ".pnpm" is listed so pnpm's virtual
  // store paths (node_modules/.pnpm/.../node_modules/<pkg>) are also transformed.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-native-svg|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-reanimated|react-native-worklets|@supabase|@tanstack|zustand))',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Supabase edge functions are Deno (run via `deno test`), not jest. Exclude them
  // so jest does not try to import Deno URL/`Deno.*` modules and fail.
  testPathIgnorePatterns: ['/node_modules/', '/supabase/'],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'stores/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  // Coverage report is informational only at the scaffold stage.
  // Ratchet thresholds up as feature work lands tests.
};
