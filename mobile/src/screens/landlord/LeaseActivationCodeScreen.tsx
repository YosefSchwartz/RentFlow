import React from 'react';
import { View, StyleSheet, Share, ScrollView } from 'react-native';
import { Text, Card, Button, useTheme, IconButton } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRegenerateLeaseCode } from '../../hooks/useLeases';
import type { PropertiesStackParamList } from '../../types';

type RouteType = RouteProp<PropertiesStackParamList, 'LeaseActivationCode'>;

const LeaseActivationCodeScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<RouteType>();
  const { t } = useTranslation();
  const { leaseId, code: initialCode } = route.params;

  const [code, setCode] = React.useState(initialCode);
  const [copied, setCopied] = React.useState(false);
  const regenerate = useRegenerateLeaseCode();

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: t('leaseCode.shareMessage', { code }) });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleRegenerate = async () => {
    try {
      const updated = await regenerate.mutateAsync(leaseId);
      if (updated.activationCode) setCode(updated.activationCode);
    } catch (error) {
      console.error('Error regenerating code:', error);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon name="ticket-confirmation" size={48} color={theme.colors.primary} />
          </View>
          <Text variant="headlineSmall" style={styles.title}>
            {t('leaseCode.title')}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {t('leaseCode.subtitle')}
          </Text>
        </View>

        <Card style={styles.codeCard} mode="outlined">
          <Card.Content style={styles.codeContent}>
            <Text variant="labelMedium" style={styles.codeLabel}>
              {t('leaseCode.label')}
            </Text>
            <View style={styles.codeRow}>
              <Text variant="titleLarge" style={styles.code}>
                {code}
              </Text>
              <IconButton
                icon={copied ? 'check' : 'content-copy'}
                mode="contained-tonal"
                onPress={handleCopy}
              />
            </View>
            {copied && (
              <Text style={[styles.copiedText, { color: theme.colors.primary }]}>
                {t('common.copied')}
              </Text>
            )}
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={handleShare}
          icon="share"
          style={styles.shareButton}
          contentStyle={styles.buttonContent}
        >
          {t('leaseCode.shareCode')}
        </Button>

        <Button
          mode="text"
          onPress={handleRegenerate}
          icon="refresh"
          loading={regenerate.isPending}
          disabled={regenerate.isPending}
        >
          {t('leaseCode.regenerate')}
        </Button>

        <Card style={styles.instructionsCard} mode="outlined">
          <Card.Content>
            <Text variant="titleSmall" style={styles.instructionsTitle}>
              {t('leaseCode.instructionsTitle')}
            </Text>
            {['step1', 'step2', 'step3'].map((step, i) => (
              <View key={step} style={styles.instruction}>
                <Text variant="bodyMedium" style={styles.stepNumber}>{i + 1}.</Text>
                <Text variant="bodyMedium" style={styles.stepText}>
                  {t(`leaseCode.${step}`)}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 32 },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { opacity: 0.7, textAlign: 'center' },
  codeCard: { marginBottom: 16 },
  codeContent: { alignItems: 'center', paddingVertical: 24 },
  codeLabel: { opacity: 0.7, marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontWeight: '600', letterSpacing: 2 },
  copiedText: { marginTop: 8, fontSize: 14 },
  shareButton: { marginBottom: 8 },
  buttonContent: { paddingVertical: 8 },
  instructionsCard: { marginTop: 16 },
  instructionsTitle: { fontWeight: '600', marginBottom: 16 },
  instruction: { flexDirection: 'row', marginBottom: 12 },
  stepNumber: { fontWeight: '600', marginRight: 8, opacity: 0.7 },
  stepText: { flex: 1 },
});

export default LeaseActivationCodeScreen;
