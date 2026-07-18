import React, { useEffect, useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, Button, HelperText, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { AuthStackParamList } from '../../types';
import { useAuth } from '../../store/AuthContext';
import { authApi } from '../../api/auth';
import { OtpInput } from '../../components/OtpInput';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'VerifyEmail'>;
type VerifyEmailRouteProp = RouteProp<AuthStackParamList, 'VerifyEmail'>;

// Matches the backend's OtpService resend cooldown (server/src/otp/otp.service.ts).
const RESEND_COOLDOWN_SECONDS = 60;

const VerifyEmailScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<VerifyEmailRouteProp>();
  const { email } = route.params;
  const { t } = useTranslation();
  const { completeEmailVerification } = useAuth();

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // The screen that navigated here (Register, or Login's "verify now" CTA)
  // already triggered the first/a fresh OTP send server-side, so resend
  // starts on cooldown rather than immediately available.
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleVerify = async () => {
    if (code.length !== 6) {
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      await completeEmailVerification(email, code);
      // Success falls through to MainNavigator automatically once
      // AuthContext.user is set — same mechanism login/register rely on.
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.verifyEmail.resendError'));
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);

    try {
      await authApi.resendOtp({ email });
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.verifyEmail.resendError'));
    } finally {
      setResending(false);
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
              {t('auth.verifyEmail.title')}
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              {t('auth.verifyEmail.subtitle', { email })}
            </Text>
          </View>

          <View style={styles.form}>
            <OtpInput value={code} onChange={setCode} error={!!error} autoFocus />

            {error && (
              <HelperText type="error" visible style={styles.error}>
                {error}
              </HelperText>
            )}

            <Button
              mode="contained"
              onPress={handleVerify}
              loading={verifying}
              disabled={verifying || code.length !== 6}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              {t('auth.verifyEmail.verifyButton')}
            </Button>

            <Button
              mode="text"
              onPress={handleResend}
              loading={resending}
              disabled={resending || cooldown > 0}
              style={styles.linkButton}
            >
              {cooldown > 0
                ? t('auth.verifyEmail.resendCooldown', { seconds: cooldown })
                : t('auth.verifyEmail.resendButton')}
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
    marginBottom: 32,
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
  error: {
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    width: '100%',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  linkButton: {
    marginTop: 8,
  },
});

export default VerifyEmailScreen;
