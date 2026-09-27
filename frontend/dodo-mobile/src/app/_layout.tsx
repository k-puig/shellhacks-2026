import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Appearance } from 'react-native';

import { AuthProvider } from '@/auth/AuthProvider';
import { IntroDoneContext } from '@/components/BrandMark';
import { IntroAnimation } from '@/components/IntroAnimation';
import { LibraryProvider } from '@/data/libraryStore';
import { SettingsProvider } from '@/data/settingsStore';

// DODO is dark-only; this also makes the native glass tab bar render dark.
Appearance.setColorScheme('dark');

export default function RootLayout() {
  const [showIntro, setShowIntro] = useState(true);

  return (
    <AuthProvider>
      <SettingsProvider>
        <LibraryProvider>
          <IntroDoneContext.Provider value={!showIntro}>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
              {/* Opened from the gear on Home; swipe down to close. */}
              <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
            </Stack>
            {/* Plays once per launch over Home, which renders underneath. */}
            {showIntro && <IntroAnimation onDone={() => setShowIntro(false)} />}
          </IntroDoneContext.Provider>
        </LibraryProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
