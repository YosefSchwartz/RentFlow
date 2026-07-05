import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { I18nManager, Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';
import i18n, {
  SupportedLanguage,
  loadSavedLanguage,
  saveLanguage,
  supportedLanguages,
  isRTLLanguage,
  initializeRTL,
} from '../localization/i18n';

interface LanguageContextType {
  language: SupportedLanguage;
  isRTL: boolean;
  isLoading: boolean;
  changeLanguage: (lang: SupportedLanguage) => Promise<void>;
  supportedLanguages: typeof supportedLanguages;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [isLoading, setIsLoading] = useState(true);

  // Use actual I18nManager state for RTL
  const isRTL = I18nManager.isRTL;

  // Load saved language on mount
  useEffect(() => {
    const initLanguage = async () => {
      try {
        const savedLanguage = await loadSavedLanguage();
        setLanguage(savedLanguage);
        await i18n.changeLanguage(savedLanguage);

        // Initialize RTL based on saved language
        initializeRTL(savedLanguage);
      } catch (error) {
        console.error('Failed to load language:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initLanguage();
  }, []);

  const changeLanguage = useCallback(async (newLanguage: SupportedLanguage) => {
    if (newLanguage === language) return;

    const currentIsRTL = I18nManager.isRTL;
    const newIsRTL = isRTLLanguage(newLanguage);
    const needsRTLChange = currentIsRTL !== newIsRTL;

    // Save the new language
    await saveLanguage(newLanguage);
    await i18n.changeLanguage(newLanguage);
    setLanguage(newLanguage);

    // Handle RTL change - requires app restart
    if (needsRTLChange) {
      I18nManager.allowRTL(newIsRTL);
      I18nManager.forceRTL(newIsRTL);

      // Show restart dialog with option to reload
      Alert.alert(
        t('settings.languageChanged'),
        t('settings.restartRequired'),
        [
          {
            text: t('common.later'),
            style: 'cancel',
          },
          {
            text: t('common.restartNow'),
            style: 'default',
            onPress: async () => {
              try {
                await Updates.reloadAsync();
              } catch (e) {
                // If Updates.reloadAsync fails (e.g., in development), show a message
                Alert.alert(
                  t('settings.restartManually'),
                  t('settings.closeAndReopen')
                );
              }
            },
          },
        ]
      );
    }
  }, [language, t]);

  const value: LanguageContextType = {
    language,
    isRTL,
    isLoading,
    changeLanguage,
    supportedLanguages,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
