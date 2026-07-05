import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  useTheme,
  HelperText,
  Card,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { useRedeemLease } from '../../hooks/useLeases';
import KeyboardAwareScrollView from '../../components/KeyboardAwareScrollView';
import type { RentalsStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RentalsStackParamList>;

const JoinPropertyScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();

  const [invitationCode, setInvitationCode] = useState('');
  const [error, setError] = useState('');

  const redeemLease = useRedeemLease();

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setInvitationCode(text.toUpperCase().trim());
      setError('');
    }
  };

  const validateForm = () => {
    if (!invitationCode.trim()) {
      setError(t('joinProperty.errors.codeRequired'));
      return false;
    }

    if (invitationCode.trim().length < 6) {
      setError(t('joinProperty.errors.codeMinLength'));
      return false;
    }

    setError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      await redeemLease.mutateAsync(invitationCode.trim());

      Alert.alert(
        t('common.success'),
        t('joinProperty.success'),
        [{ text: t('common.ok'), onPress: () => navigation.navigate('RentalsList') }]
      );
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || t('joinProperty.errors.joinFailed');
      Alert.alert(t('common.error'), errorMessage);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
        <View style={styles.headerSection}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Icon name="home-plus" size={48} color={theme.colors.secondary} />
          </View>
          <Text variant="headlineSmall" style={styles.title}>
            {t('joinProperty.title')}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {t('joinProperty.subtitle')}
          </Text>
        </View>

        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t('joinProperty.enterCode')}
            </Text>

            <TextInput
              label={t('joinProperty.invitationCode')}
              value={invitationCode}
              onChangeText={(text) => {
                setInvitationCode(text.toUpperCase());
                setError('');
              }}
              mode="outlined"
              autoCapitalize="characters"
              autoCorrect={false}
              error={!!error}
              style={styles.input}
              placeholder={t('joinProperty.codePlaceholder')}
              right={
                <TextInput.Icon
                  icon="content-paste"
                  onPress={handlePaste}
                />
              }
            />
            <HelperText type="error" visible={!!error}>
              {error}
            </HelperText>

            <View style={styles.buttonContainer}>
              <Button
                mode="outlined"
                onPress={() => navigation.goBack()}
                style={styles.button}
              >
                {t('common.cancel')}
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={redeemLease.isPending}
                disabled={redeemLease.isPending || !invitationCode.trim()}
                style={styles.button}
              >
                {t('joinProperty.join')}
              </Button>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.instructionsSection}>
          <Text variant="titleSmall" style={styles.instructionsTitle}>
            {t('joinProperty.howItWorks')}
          </Text>
          <View style={styles.instructionItem}>
            <View style={[styles.stepNumber, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text variant="labelMedium" style={{ color: theme.colors.primary }}>1</Text>
            </View>
            <Text variant="bodyMedium" style={styles.instructionText}>
              {t('joinProperty.step1')}
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <View style={[styles.stepNumber, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text variant="labelMedium" style={{ color: theme.colors.primary }}>2</Text>
            </View>
            <Text variant="bodyMedium" style={styles.instructionText}>
              {t('joinProperty.step2')}
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <View style={[styles.stepNumber, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text variant="labelMedium" style={{ color: theme.colors.primary }}>3</Text>
            </View>
            <Text variant="bodyMedium" style={styles.instructionText}>
              {t('joinProperty.step3')}
            </Text>
          </View>
        </View>
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
  },
  card: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
  },
  instructionsSection: {
    paddingHorizontal: 8,
  },
  instructionsTitle: {
    fontWeight: '600',
    marginBottom: 16,
    opacity: 0.8,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    flex: 1,
    opacity: 0.8,
  },
});

export default JoinPropertyScreen;
