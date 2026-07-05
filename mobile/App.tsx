import React, { useState, useEffect } from 'react';
import { View, I18nManager, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider, MD3LightTheme, Text, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Updates from 'expo-updates';
import { AuthProvider } from './src/store/AuthContext';
import { LanguageProvider } from './src/store/LanguageContext';
import { RootNavigator } from './src/navigation';
import i18n, { loadSavedLanguage, isRTLLanguage, initializeRTL, saveLanguage } from './src/localization/i18n';
import { queryClient } from './src/lib/queryClient';

// Custom theme
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2563EB',
    primaryContainer: '#DBEAFE',
    secondary: '#059669',
    secondaryContainer: '#D1FAE5',
    tertiary: '#F59E0B',
    tertiaryContainer: '#FEF3C7',
    error: '#DC2626',
    errorContainer: '#FEE2E2',
    background: '#F9FAFB',
    surface: '#FFFFFF',
    surfaceVariant: '#F3F4F6',
    outline: '#9CA3AF',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onBackground: '#111827',
    onSurface: '#111827',
  },
};

// RTL Mismatch Screen - shown when app needs restart for RTL changes
function RTLMismatchScreen({ expectedRTL, onResetToEnglish }: { expectedRTL: boolean; onResetToEnglish: () => void }) {
  const handleRestart = async () => {
    try {
      await Updates.reloadAsync();
    } catch (e) {
      // In development, Updates.reloadAsync may not work
      console.log('Please restart the app manually');
    }
  };

  return (
    <View style={styles.mismatchContainer}>
      <Text variant="headlineMedium" style={styles.mismatchTitle}>
        {expectedRTL ? 'נדרשת הפעלה מחדש' : 'Restart Required'}
      </Text>
      <Text variant="bodyLarge" style={styles.mismatchText}>
        {expectedRTL
          ? 'האפליקציה צריכה להפעיל מחדש כדי להציג את השפה העברית כראוי.'
          : 'The app needs to restart to display the correct layout direction.'}
      </Text>
      <Button mode="contained" onPress={handleRestart} style={styles.restartButton}>
        {expectedRTL ? 'הפעל מחדש' : 'Restart Now'}
      </Button>
      <Text variant="bodySmall" style={styles.mismatchHint}>
        {expectedRTL
          ? 'אם הכפתור לא עובד, סגור ופתח את האפליקציה מחדש'
          : 'If the button doesn\'t work, please close and reopen the app'}
      </Text>

      {/* Option to reset to English if stuck in development */}
      <View style={styles.resetSection}>
        <Text variant="bodySmall" style={styles.resetText}>
          {expectedRTL ? 'תקוע? חזור לאנגלית:' : 'Stuck? Reset to English:'}
        </Text>
        <Button mode="outlined" onPress={onResetToEnglish} style={styles.resetButton}>
          {expectedRTL ? 'חזור לאנגלית' : 'Reset to English'}
        </Button>
      </View>
    </View>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [rtlMismatch, setRtlMismatch] = useState(false);
  const [expectedRTL, setExpectedRTL] = useState(false);

  useEffect(() => {
    const checkRTL = async () => {
      try {
        // Load the saved language preference
        const savedLanguage = await loadSavedLanguage();
        const shouldBeRTL = isRTLLanguage(savedLanguage);

        // Update i18n language
        await i18n.changeLanguage(savedLanguage);

        // Check if current RTL state matches what it should be
        if (I18nManager.isRTL !== shouldBeRTL) {
          // Set the RTL for next restart
          initializeRTL(savedLanguage);
          setExpectedRTL(shouldBeRTL);
          setRtlMismatch(true);
        }
      } catch (error) {
        console.error('Error checking RTL:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkRTL();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const handleResetToEnglish = async () => {
    // Save English as the language preference
    await saveLanguage('en');
    // Reset RTL to false for English
    I18nManager.allowRTL(false);
    I18nManager.forceRTL(false);
    // Update i18n
    await i18n.changeLanguage('en');
    // Clear the mismatch state and let the app continue
    setRtlMismatch(false);
  };

  if (rtlMismatch) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <RTLMismatchScreen expectedRTL={expectedRTL} onResetToEnglish={handleResetToEnglish} />
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <PaperProvider theme={theme}>
              <LanguageProvider>
                <AuthProvider>
                  <NavigationContainer>
                    <StatusBar style="auto" />
                    <RootNavigator />
                  </NavigationContainer>
                </AuthProvider>
              </LanguageProvider>
            </PaperProvider>
          </QueryClientProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  mismatchContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  mismatchTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  mismatchText: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  restartButton: {
    marginBottom: 16,
  },
  mismatchHint: {
    textAlign: 'center',
    opacity: 0.5,
  },
  resetSection: {
    marginTop: 32,
    alignItems: 'center',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  resetText: {
    opacity: 0.6,
    marginBottom: 8,
  },
  resetButton: {
    borderColor: '#9CA3AF',
  },
});
