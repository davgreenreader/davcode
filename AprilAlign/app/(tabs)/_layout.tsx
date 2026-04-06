import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4f8ef7',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: { backgroundColor: '#0a0a1a', borderTopColor: '#1a1a3a' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Align',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
