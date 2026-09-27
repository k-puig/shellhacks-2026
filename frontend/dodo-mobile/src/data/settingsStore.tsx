import { File, Paths } from 'expo-file-system';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { clampRate, DEFAULT_SETTINGS, parseSettings, type Settings } from './settings';

type SettingsState = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsState | null>(null);

// Saved on the phone, like reading progress, so choices survive restarts.
const settingsFile = () => new File(Paths.document, 'settings.json');

async function loadSettings(): Promise<Settings> {
  try {
    const file = settingsFile();
    return file.exists ? parseSettings(await file.text()) : DEFAULT_SETTINGS;
  } catch (error) {
    console.log('[dodo] Could not read settings:', String(error));
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: Settings) {
  try {
    const file = settingsFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(settings));
  } catch (error) {
    console.log('[dodo] Could not save settings:', String(error));
  }
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings().then((saved) => {
      setSettings(saved);
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (loaded) saveSettings(settings);
  }, [settings, loaded]);

  const update = (patch: Partial<Settings>) =>
    setSettings((current) => ({
      ...current,
      ...patch,
      ...(patch.rate !== undefined ? { rate: clampRate(patch.rate) } : {}),
    }));

  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
