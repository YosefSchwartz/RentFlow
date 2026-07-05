import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { I18nManager } from 'react-native';

import en from './en.json';
import he from './he.json';

const LANGUAGE_KEY = 'keynest_language';

export type SupportedLanguage = 'en' | 'he';

export const resources = {
  en: { translation: en },
  he: { translation: he },
};

export const supportedLanguages: { code: SupportedLanguage; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
];

// Get the device's preferred language
export const getDeviceLanguage = (): SupportedLanguage => {
  const deviceLocale = Localization.getLocales()[0]?.languageCode || 'en';
  return deviceLocale === 'he' ? 'he' : 'en';
};

// Load saved language from storage
export const loadSavedLanguage = async (): Promise<SupportedLanguage> => {
  try {
    const savedLanguage = await SecureStore.getItemAsync(LANGUAGE_KEY);
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'he')) {
      return savedLanguage;
    }
  } catch (error) {
    console.error('Error loading saved language:', error);
  }
  return getDeviceLanguage();
};

// Save language to storage
export const saveLanguage = async (language: SupportedLanguage): Promise<void> => {
  try {
    await SecureStore.setItemAsync(LANGUAGE_KEY, language);
  } catch (error) {
    console.error('Error saving language:', error);
  }
};

// Check if RTL needs to be set (should be called at app startup)
export const isRTLLanguage = (lang: SupportedLanguage): boolean => {
  return lang === 'he';
};

// Initialize RTL settings (call this before app renders)
export const initializeRTL = (language: SupportedLanguage): void => {
  const shouldBeRTL = isRTLLanguage(language);
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
  }
};

// Initialize i18n
i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(), // Initial language (will be updated after loading from storage)
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;
