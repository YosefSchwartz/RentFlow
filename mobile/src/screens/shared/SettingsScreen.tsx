import React, { useState } from 'react';
import { View, StyleSheet, Alert, Linking, ScrollView } from 'react-native';
import {
  Text,
  Card,
  List,
  useTheme,
  RadioButton,
  Divider,
  Portal,
  Dialog,
  Button,
  TextInput,
  HelperText,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../store/LanguageContext';
import { useAuth } from '../../store/AuthContext';
import { userApi } from '../../api/user';
import type { SupportedLanguage } from '../../localization/i18n';

// Public legal pages (host the static pages here in production).
const PRIVACY_URL = 'https://keynest.app/privacy-policy';
const TERMS_URL = 'https://keynest.app/terms-of-service';

const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { language, changeLanguage, supportedLanguages } = useLanguage();
  const { logout } = useAuth();

  const [dialogVisible, setDialogVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleLanguageChange = async (newLanguage: string) => {
    await changeLanguage(newLanguage as SupportedLanguage);
  };

  const getCurrentLanguageName = () => {
    const current = supportedLanguages.find((l) => l.code === language);
    return current?.nativeName || 'English';
  };

  // Step 1: warning. Step 2: password dialog.
  const handleDeletePress = () => {
    Alert.alert(
      t('settings.deleteWarningTitle'),
      t('settings.deleteWarningMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.continue'),
          style: 'destructive',
          onPress: () => {
            setPassword('');
            setError('');
            setDialogVisible(true);
          },
        },
      ],
    );
  };

  // Step 3 + 4: delete, then clear session and return to login.
  const handleConfirmDelete = async () => {
    if (!password.trim() || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await userApi.deleteAccount(password);
      setDialogVisible(false);
      // Clears tokens + React Query cache + user; the root navigator then
      // swaps to the auth stack (no back-navigation into the app).
      await logout();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || t('settings.deleteError'),
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={[]}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            {t('settings.title')}
          </Text>
        </View>

        {/* Language Section */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Icon name="translate" size={24} color={theme.colors.primary} />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {t('settings.language')}
              </Text>
            </View>

            <Text variant="bodySmall" style={styles.currentLabel}>
              {t('settings.currentLanguage')}: {getCurrentLanguageName()}
            </Text>

            <Divider style={styles.divider} />

            <RadioButton.Group onValueChange={handleLanguageChange} value={language}>
              {supportedLanguages.map((lang) => (
                <RadioButton.Item
                  key={lang.code}
                  label={lang.nativeName}
                  value={lang.code}
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                />
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>

        {/* Account Section */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Icon name="account-cog" size={24} color={theme.colors.primary} />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {t('settings.account')}
              </Text>
            </View>

            <Divider style={styles.divider} />

            <List.Item
              title={t('settings.privacyPolicy')}
              left={(props) => <List.Icon {...props} icon="shield-account" />}
              right={(props) => <List.Icon {...props} icon="open-in-new" />}
              onPress={() => Linking.openURL(PRIVACY_URL)}
            />
            <List.Item
              title={t('settings.termsOfService')}
              left={(props) => <List.Icon {...props} icon="file-document" />}
              right={(props) => <List.Icon {...props} icon="open-in-new" />}
              onPress={() => Linking.openURL(TERMS_URL)}
            />
            <List.Item
              title={t('settings.deleteAccount')}
              titleStyle={{ color: theme.colors.error }}
              left={(props) => (
                <List.Icon {...props} icon="delete-forever" color={theme.colors.error} />
              )}
              onPress={handleDeletePress}
            />
          </Card.Content>
        </Card>

        {/* App Info Section */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Icon name="information" size={24} color={theme.colors.primary} />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {t('settings.appInfo')}
              </Text>
            </View>

            <Divider style={styles.divider} />

            <List.Item
              title={t('settings.version')}
              description="1.0.0"
              left={(props) => <List.Icon {...props} icon="tag" />}
            />
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Re-authentication dialog (step 2 of delete) */}
      <Portal>
        <Dialog
          visible={dialogVisible}
          onDismiss={() => !deleting && setDialogVisible(false)}
        >
          <Dialog.Title>{t('settings.deleteConfirmTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogText}>
              {t('settings.deleteWarningMessage')}
            </Text>
            <TextInput
              label={t('settings.deletePasswordLabel')}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError('');
              }}
              mode="outlined"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              error={!!error}
            />
            <HelperText type="error" visible={!!error}>
              {error}
            </HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)} disabled={deleting}>
              {t('common.cancel')}
            </Button>
            <Button
              onPress={handleConfirmDelete}
              loading={deleting}
              disabled={deleting || !password.trim()}
              textColor={theme.colors.error}
            >
              {t('settings.deleteCta')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontWeight: 'bold',
  },
  card: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    marginLeft: 12,
  },
  currentLabel: {
    opacity: 0.7,
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  radioItem: {
    paddingVertical: 4,
  },
  radioLabel: {
    fontSize: 16,
  },
  dialogText: {
    marginBottom: 16,
  },
});

export default SettingsScreen;
