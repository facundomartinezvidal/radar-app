import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/lib/theme';

export default function ProfileLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg[0] },
      }}
    />
  );
}
