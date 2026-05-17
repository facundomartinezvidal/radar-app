/**
 * Tab bar layout — RADAR (Phase C5b)
 *
 * Replaces IconSymbol (SF Symbols) with DS Icon (Lucide) wrapper.
 * Replaces legacy Colors/useColorScheme with DS tokens directly.
 * HapticTab is kept for haptic feedback UX on iOS.
 */
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Icon } from '@/components/ui';
import { colors, typography } from '@/lib/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand[400],
        tabBarInactiveTintColor: colors.fg[3],
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: colors.bg[1],
          borderTopColor: colors.line[1],
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
        },
        tabBarLabelStyle: {
          fontFamily: typography.family.medium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Icon name="Home" size={24} color={color} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Cámara',
          tabBarIcon: ({ color }) => (
            <Icon name="Camera" size={24} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => (
            <Icon name="Compass" size={24} color={color} strokeWidth={1.5} />
          ),
        }}
      />
    </Tabs>
  );
}
