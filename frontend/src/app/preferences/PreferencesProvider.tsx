import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { LanguageCode, ThemeMode } from '../../types';
import { dictionary, type TranslationKey } from '../../i18n/dictionary';

type PreferencesContextValue = {
  language: LanguageCode;
  theme: ThemeMode;
  fontScale: 'normal' | 'large' | 'extra_large';
  setLanguage: (value: LanguageCode) => void;
  setTheme: (value: ThemeMode) => void;
  setFontScale: (value: 'normal' | 'large' | 'extra_large') => void;
  t: (key: TranslationKey) => string;
};

const STORAGE_KEY = 'eldimind_frontend_prefs';
const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [fontScale, setFontScaleState] = useState<'normal' | 'large' | 'extra_large'>('large');

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.language) setLanguageState(parsed.language);
      if (parsed.theme) setThemeState(parsed.theme);
      if (parsed.fontScale) setFontScaleState(parsed.fontScale);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ language, theme, fontScale })
    );
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.fontScale = fontScale;
  }, [fontScale, language, theme]);

  const value = useMemo(
    () => ({
      language,
      theme,
      fontScale,
      setLanguage: setLanguageState,
      setTheme: setThemeState,
      setFontScale: setFontScaleState,
      t: (key: TranslationKey) => dictionary[language][key] ?? dictionary.en[key] ?? key,
    }),
    [fontScale, language, theme]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider');
  return context;
}
