import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { AuthStackParamList } from '../../types';
import { useAuth } from '../../store/AuthContext';
import { authApi } from '../../api/auth';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

const LoginScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError(t('auth.errors.fillAllFields'));
      return;
    }

    setLoading(true);
    setError(null);
    setUnverifiedEmail(null);

    try {
      await login({ email: email.trim(), password });
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(email.trim());
      } else {
        const errorMessage = err.response?.data?.message
          || err.message
          || t('auth.errors.loginFailed');
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyNow = async () => {
    if (!unverifiedEmail) return;
    try {
      await authApi.resendOtp({ email: unverifiedEmail });
    } catch {
      // Resend failure isn't fatal here — VerifyEmailScreen offers its own
      // resend action if this one silently failed (e.g. still in cooldown
      // from a prior send).
    }
    navigation.navigate('VerifyEmail', { email: unverifiedEmail });
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
            <Text variant="displaySmall" style={styles.title}>
              {t('common.appName')}
            </Text>
            <Text variant="bodyLarge" style={styles.subtitle}>
              {t('auth.tagline')}
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="email" />}
            />

            <TextInput
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />

            <Button
              mode="text"
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotPasswordLink}
              compact
            >
              {t('auth.forgotPassword.link')}
            </Button>

            {error && (
              <Text style={[styles.error, { color: theme.colors.error }]}>
                {error}
              </Text>
            )}

            {unverifiedEmail && (
              <View style={styles.unverifiedBanner}>
                <Text style={styles.unverifiedText}>
                  {t('auth.errors.emailNotVerified')}
                </Text>
                <Button mode="text" onPress={handleVerifyNow} compact>
                  {t('auth.verifyEmail.verifyNowCta')}
                </Button>
              </View>
            )}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              {t('auth.login')}
            </Button>

            <Button
              mode="text"
              onPress={() => navigation.navigate('Register')}
              style={styles.linkButton}
            >
              {t('auth.noAccount')}
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
    marginBottom: 48,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.7,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: 16,
  },
  error: {
    marginBottom: 16,
    textAlign: 'center',
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  unverifiedBanner: {
    alignItems: 'center',
    marginBottom: 16,
  },
  unverifiedText: {
    textAlign: 'center',
    opacity: 0.8,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  linkButton: {
    marginTop: 8,
  },
});

export default LoginScreen;
