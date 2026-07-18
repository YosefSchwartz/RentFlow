import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, HelperText, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { AuthStackParamList } from '../../types';
import { useAuth } from '../../store/AuthContext';
import { validatePassword } from '../../utils/passwordValidation';
import { OtpInput } from '../../components/OtpInput';

type ResetPasswordRouteProp = RouteProp<AuthStackParamList, 'ResetPassword'>;

const ResetPasswordScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<ResetPasswordRouteProp>();
  const { email } = route.params;
  const { t } = useTranslation();
  const { completePasswordReset } = useAuth();

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (code.length !== 6) {
      setError(t('auth.verifyEmail.invalidCode'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.errors.passwordsNoMatch'));
      return;
    }

    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      setError(t(passwordErrors[0]));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await completePasswordReset(email, code, newPassword);
      // Success completes the session directly (reset-password returns a
      // fresh AuthResponse) — RootNavigator switches to MainNavigator once
      // AuthContext.user is set, same as login/register/verify-email.
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.errors.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text variant="headlineMedium" style={styles.title}>
              {t('auth.resetPassword.title')}
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              {t('auth.verifyEmail.subtitle', { email })}
            </Text>
          </View>

          <View style={styles.form}>
            <OtpInput value={code} onChange={setCode} autoFocus />

            <TextInput
              label={t('auth.resetPassword.newPassword')}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPassword}
              mode="outlined"
              style={styles.passwordInput}
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />
            <HelperText type="info" style={styles.passwordHint}>
              {t('auth.passwordPolicyHint')}
            </HelperText>

            <TextInput
              label={t('auth.resetPassword.confirmNewPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="lock-check" />}
            />

            {error && (
              <Text style={[styles.error, { color: theme.colors.error }]}>
                {error}
              </Text>
            )}

            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              {t('auth.resetPassword.saveButton')}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    opacity: 0.7,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    alignItems: 'center',
  },
  input: {
    marginBottom: 16,
    width: '100%',
  },
  passwordInput: {
    marginBottom: 0,
    width: '100%',
  },
  passwordHint: {
    marginBottom: 8,
    width: '100%',
  },
  error: {
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
    width: '100%',
  },
  buttonContent: {
    paddingVertical: 8,
  },
});

export default ResetPasswordScreen;
