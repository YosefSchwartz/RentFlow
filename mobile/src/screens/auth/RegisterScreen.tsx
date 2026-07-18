import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, HelperText, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { AuthStackParamList } from '../../types';
import { useAuth } from '../../store/AuthContext';
import { validatePassword } from '../../utils/passwordValidation';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

const RegisterScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    // Validation
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim() || !password.trim()) {
      setError(t('auth.errors.fillRequiredFields'));
      return;
    }

    if (phone.trim().length < 7) {
      setError(t('auth.errors.phoneMinLength'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.errors.passwordsNoMatch'));
      return;
    }

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      setError(t(passwordErrors[0]));
      return;
    }

    if (password.length > 50) {
      setError(t('auth.errors.passwordMaxLength'));
      return;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('auth.errors.invalidEmail'));
      return;
    }

    // Validate name lengths
    if (firstName.length > 50 || lastName.length > 50) {
      setError(t('auth.errors.nameMaxLength'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const result = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: trimmedEmail,
        password,
      });

      if (result.requiresVerification) {
        navigation.navigate('VerifyEmail', { email: result.email });
      }
      // else: the (defensive-only) auto-authenticated path — RootNavigator
      // switches to MainNavigator once AuthContext.user is set.
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.errors.registerFailed'));
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
              {t('auth.createAccount')}
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              {t('auth.joinKeynest')}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.row}>
              <TextInput
                label={t('auth.firstName')}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                mode="outlined"
                style={[styles.input, styles.halfInput]}
                left={<TextInput.Icon icon="account" />}
              />
              <TextInput
                label={t('auth.lastName')}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                mode="outlined"
                style={[styles.input, styles.halfInput]}
              />
            </View>

            <TextInput
              label={t('profile.phone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="phone" />}
            />

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
              label={t('auth.confirmPassword')}
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
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              {t('auth.register')}
            </Button>

            <Button
              mode="text"
              onPress={() => navigation.navigate('Login')}
              style={styles.linkButton}
            >
              {t('auth.hasAccount')}
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
  },
  subtitle: {
    opacity: 0.7,
  },
  form: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    marginBottom: 16,
  },
  passwordInput: {
    marginBottom: 0,
  },
  passwordHint: {
    marginBottom: 16,
  },
  halfInput: {
    flex: 1,
  },
  error: {
    marginBottom: 16,
    textAlign: 'center',
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

export default RegisterScreen;
