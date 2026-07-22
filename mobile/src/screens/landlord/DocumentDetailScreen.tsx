import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  useTheme,
  ActivityIndicator,
  Card,
  Button,
  Chip,
  Divider,
  Snackbar,
  Portal,
  Modal,
  RadioButton,
} from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useDocument } from '../../hooks/useDocuments';
import { useDocumentAi, useRetryAi, useSetAiCategory } from '../../hooks/useAi';
import DocumentPreviewModal from '../../components/media/DocumentPreviewModal';
import type {
  PropertiesStackParamList,
  DocumentCategory,
  AiJobStatus,
} from '../../types';

type RouteType = RouteProp<PropertiesStackParamList, 'DocumentDetail'>;

// Categories offered when replacing the AI suggestion.
const CATEGORY_CHOICES: DocumentCategory[] = [
  'RECEIPT',
  'INVOICE',
  'INSURANCE',
  'LEASE_AGREEMENT',
  'SIGNED_LEASE',
  'PROPERTY_PLAN',
  'IDENTIFICATION',
  'LEGAL',
  'PROPERTY_INFO',
  'TENANT_DOCUMENT',
  'WARRANTY',
  'METER_READING',
  'MANUAL',
  'OTHER',
];

const DocumentDetailScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<RouteType>();
  const { t } = useTranslation();
  const { documentId, propertyId } = route.params;

  const { data: document } = useDocument(documentId);
  const { data: ai, isLoading, refetch, isRefetching } = useDocumentAi(documentId);
  const retryAi = useRetryAi();
  const setCategory = useSetAiCategory();

  const [previewVisible, setPreviewVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [pickedCategory, setPickedCategory] = useState<DocumentCategory>('OTHER');
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; error: boolean }>({
    visible: false,
    message: '',
    error: false,
  });

  const statusMeta = (status: AiJobStatus) => {
    switch (status) {
      case 'QUEUED':
        return { key: 'PENDING', icon: 'clock-outline', color: theme.colors.tertiary };
      case 'PROCESSING':
        return { key: 'PROCESSING', icon: 'progress-clock', color: theme.colors.tertiary };
      case 'COMPLETED':
        return { key: 'COMPLETED', icon: 'check-circle', color: theme.colors.secondary };
      case 'FAILED':
        return { key: 'FAILED', icon: 'alert-circle', color: theme.colors.error };
      default:
        return { key: 'NONE', icon: 'robot-outline', color: theme.colors.outline };
    }
  };

  const handleAccept = async (category: DocumentCategory) => {
    setCategoryModalVisible(false);
    try {
      await setCategory.mutateAsync({ documentId, category, propertyId });
      setSnackbar({ visible: true, message: t('ai.categorySaved'), error: false });
    } catch {
      setSnackbar({ visible: true, message: t('ai.categoryError'), error: true });
    }
  };

  const handleRetry = async () => {
    try {
      await retryAi.mutateAsync(documentId);
      setSnackbar({ visible: true, message: t('ai.retryQueued'), error: false });
    } catch {
      setSnackbar({ visible: true, message: t('ai.retryError'), error: true });
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const status = ai?.status ?? 'NONE';
  const meta = statusMeta(status);
  const classification = ai?.classification;
  const confidencePct = classification
    ? Math.round(classification.confidence * 100)
    : 0;
  const inProgress = status === 'QUEUED' || status === 'PROCESSING';

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Document header */}
        <Card style={styles.card} mode="outlined">
          <Card.Content style={styles.headerRow}>
            <Icon name="file-document" size={28} color={theme.colors.primary} />
            <View style={styles.headerInfo}>
              <Text variant="titleMedium" numberOfLines={2}>
                {document?.name ?? ''}
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                {document ? t(`documents.categories.${document.category}`) : ''}
              </Text>
            </View>
          </Card.Content>
          {document?.fileUrl && (
            <Card.Actions>
              <Button icon="eye" onPress={() => setPreviewVisible(true)}>
                {t('ai.preview')}
              </Button>
            </Card.Actions>
          )}
        </Card>

        {/* AI status */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <View style={styles.statusHeader}>
              <Text variant="titleSmall">{t('ai.title')}</Text>
              <Chip
                icon={meta.icon}
                compact
                style={{ backgroundColor: meta.color + '20' }}
                textStyle={{ color: meta.color, fontSize: 12 }}
              >
                {t(`ai.status.${meta.key}`)}
              </Chip>
            </View>
            {inProgress && (
              <Text variant="bodySmall" style={[styles.muted, styles.spaced]}>
                {t('ai.inProgressHint')}
              </Text>
            )}
            {status === 'FAILED' && ai?.latestJob?.errorMessage && (
              <Text variant="bodySmall" style={[styles.spaced, { color: theme.colors.error }]}>
                {ai.latestJob.errorMessage}
              </Text>
            )}
            {ai?.analyzedByAI && (
              <Chip icon="robot" compact style={styles.analyzedChip}>
                {t('ai.analyzedByAI')}
              </Chip>
            )}
          </Card.Content>
          {(status === 'FAILED' || status === 'COMPLETED' || status === 'NONE') && (
            <Card.Actions>
              <Button
                icon="refresh"
                onPress={handleRetry}
                loading={retryAi.isPending}
                disabled={inProgress}
              >
                {t('ai.retry')}
              </Button>
            </Card.Actions>
          )}
        </Card>

        {/* AI summary */}
        {ai?.summary && (
          <Card style={styles.card} mode="outlined">
            <Card.Content>
              <Text variant="titleSmall" style={styles.spaced}>
                {t('ai.summary')}
              </Text>
              <Text variant="bodyMedium">{ai.summary}</Text>
            </Card.Content>
          </Card>
        )}

        {/* Suggested category */}
        {classification && (
          <Card style={styles.card} mode="outlined">
            <Card.Content>
              <Text variant="titleSmall" style={styles.spaced}>
                {t('ai.suggestedCategory')}
              </Text>
              <View style={styles.suggestionRow}>
                <Chip icon="robot" compact>
                  {t(`documents.categories.${classification.predictedCategory}`)} ({confidencePct}%)
                </Chip>
              </View>
              {classification.approvedCategory && (
                <Text variant="bodySmall" style={[styles.muted, styles.spaced]}>
                  {t('ai.currentCategory', {
                    category: t(`documents.categories.${ai!.effectiveCategory}`),
                  })}
                </Text>
              )}
            </Card.Content>
            <Card.Actions>
              <Button
                onPress={() => handleAccept(classification.predictedCategory)}
                loading={setCategory.isPending}
                disabled={classification.approvedCategory === classification.predictedCategory}
              >
                {t('ai.accept')}
              </Button>
              <Button
                mode="outlined"
                onPress={() => {
                  setPickedCategory(ai!.effectiveCategory);
                  setCategoryModalVisible(true);
                }}
              >
                {t('ai.replace')}
              </Button>
            </Card.Actions>
          </Card>
        )}

        {/* Extracted metadata */}
        {ai && ai.fields.length > 0 && (
          <Card style={styles.card} mode="outlined">
            <Card.Content>
              <Text variant="titleSmall" style={styles.spaced}>
                {t('ai.extracted')}
              </Text>
              {ai.fields.map((f, i) => (
                <React.Fragment key={`${f.key}-${i}`}>
                  {i > 0 && <Divider style={styles.fieldDivider} />}
                  <View style={styles.fieldRow}>
                    <Text variant="bodySmall" style={styles.fieldKey}>
                      {f.key}
                    </Text>
                    <Text variant="bodyMedium" style={styles.fieldValue}>
                      {f.valueText ??
                        (f.valueNumber != null ? String(f.valueNumber) : '') ??
                        ''}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {document && (
        <DocumentPreviewModal
          document={previewVisible ? document : null}
          visible={previewVisible}
          onDismiss={() => setPreviewVisible(false)}
          onError={(message) => setSnackbar({ visible: true, message, error: true })}
        />
      )}

      <Portal>
        <Modal
          visible={categoryModalVisible}
          onDismiss={() => setCategoryModalVisible(false)}
          contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleMedium" style={styles.spaced}>
            {t('ai.replaceTitle')}
          </Text>
          <ScrollView style={styles.categoryList}>
            <RadioButton.Group
              onValueChange={(v) => setPickedCategory(v as DocumentCategory)}
              value={pickedCategory}
            >
              {CATEGORY_CHOICES.map((c) => (
                <RadioButton.Item
                  key={c}
                  label={t(`documents.categories.${c}`)}
                  value={c}
                />
              ))}
            </RadioButton.Group>
          </ScrollView>
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setCategoryModalVisible(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={() => handleAccept(pickedCategory)}
              loading={setCategory.isPending}
            >
              {t('common.save')}
            </Button>
          </View>
        </Modal>
      </Portal>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
        duration={3000}
        style={snackbar.error ? { backgroundColor: theme.colors.error } : undefined}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  card: { marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerInfo: { flex: 1, marginHorizontal: 12 },
  muted: { opacity: 0.7 },
  spaced: { marginBottom: 8 },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  analyzedChip: { alignSelf: 'flex-start', marginTop: 12 },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  fieldKey: { opacity: 0.7, flexShrink: 1 },
  fieldValue: { flex: 1, textAlign: 'right' },
  fieldDivider: { marginVertical: 2 },
  modalContent: { margin: 20, padding: 20, borderRadius: 12, maxHeight: '80%' },
  categoryList: { maxHeight: 360 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
});

export default DocumentDetailScreen;
