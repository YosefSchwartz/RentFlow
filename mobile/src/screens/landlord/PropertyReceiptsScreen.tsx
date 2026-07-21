import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import {
  Text,
  useTheme,
  ActivityIndicator,
  Card,
  Button,
  Chip,
  Divider,
  Snackbar,
  IconButton,
} from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import {
  useReceiptSummary,
  useReceipts,
  useUploadReceipt,
} from '../../hooks/useReceipts';
import { receiptsApi } from '../../api/receipts';
import { downloadAuthedAndShare } from '../../lib/files';
import DocumentPreviewModal from '../../components/media/DocumentPreviewModal';
import type { PropertiesStackParamList, Receipt } from '../../types';

type RouteType = RouteProp<PropertiesStackParamList, 'PropertyReceipts'>;

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/heic',
];

const receiptIcon = (name: string, mimeType?: string | null): string => {
  const ext = name.split('.').pop()?.toLowerCase();
  if ((mimeType || '').startsWith('image/') || ['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext || ''))
    return 'file-image';
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'file-pdf-box';
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return 'file-excel';
  if (['doc', 'docx'].includes(ext || '')) return 'file-word';
  return 'receipt';
};

const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const PropertyReceiptsScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<RouteType>();
  const { t } = useTranslation();
  const { propertyId } = route.params;

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);
  const [exporting, setExporting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; error: boolean }>({
    visible: false,
    message: '',
    error: false,
  });

  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
    isRefetching,
  } = useReceiptSummary(propertyId);
  const {
    data: receipts,
    isLoading: receiptsLoading,
    refetch: refetchReceipts,
  } = useReceipts(propertyId, selectedYear ?? undefined);
  const uploadReceipt = useUploadReceipt();

  const handleRefresh = () => {
    refetchSummary();
    refetchReceipts();
  };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_FILE_TYPES,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      await uploadReceipt.mutateAsync({
        propertyId,
        file: {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        },
      });
      setSnackbar({ visible: true, message: t('receipts.uploadSuccess'), error: false });
    } catch (err) {
      console.error('Failed to upload receipt', err);
      setSnackbar({ visible: true, message: t('receipts.uploadError'), error: true });
    }
  };

  const handleExport = async (kind: 'csv' | 'zip') => {
    setExporting(true);
    try {
      const url =
        kind === 'csv'
          ? receiptsApi.exportCsvUrl(propertyId, selectedYear ?? undefined)
          : receiptsApi.exportZipUrl(propertyId, selectedYear ?? undefined);
      const suffix = selectedYear ?? 'all';
      const filename = `receipts-${suffix}.${kind}`;
      const mime = kind === 'csv' ? 'text/csv' : 'application/zip';
      await downloadAuthedAndShare(url, filename, mime);
    } catch (err) {
      console.error('Export failed', err);
      setSnackbar({ visible: true, message: t('receipts.exportError'), error: true });
    } finally {
      setExporting(false);
    }
  };

  if (summaryLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const hasReceipts = (summary?.length ?? 0) > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        <View style={styles.actionRow}>
          <Button
            mode="contained"
            icon="upload"
            onPress={handleUpload}
            loading={uploadReceipt.isPending}
            disabled={uploadReceipt.isPending}
            style={styles.flexButton}
          >
            {t('receipts.upload')}
          </Button>
        </View>

        {hasReceipts && (
          <View style={styles.exportRow}>
            <Button
              mode="outlined"
              icon="file-delimited"
              compact
              onPress={() => handleExport('csv')}
              disabled={exporting}
            >
              {t('receipts.exportCsv')}
            </Button>
            <Button
              mode="outlined"
              icon="folder-zip"
              compact
              onPress={() => handleExport('zip')}
              disabled={exporting}
            >
              {t('receipts.exportZip')}
            </Button>
          </View>
        )}

        {!hasReceipts ? (
          <View style={styles.emptyContainer}>
            <Icon name="receipt" size={48} color={theme.colors.outline} />
            <Text variant="bodyMedium" style={styles.emptyText}>
              {t('receipts.empty')}
            </Text>
            <Button mode="contained-tonal" icon="upload" onPress={handleUpload} style={{ marginTop: 12 }}>
              {t('receipts.upload')}
            </Button>
          </View>
        ) : (
          <>
            {/* Year filter dashboard */}
            <View style={styles.yearRow}>
              <Chip
                compact
                mode={selectedYear === null ? 'flat' : 'outlined'}
                onPress={() => setSelectedYear(null)}
                style={styles.yearChip}
              >
                {t('receipts.allYears')}
              </Chip>
              {summary!.map((s) => (
                <Chip
                  key={s.taxYear}
                  compact
                  mode={selectedYear === s.taxYear ? 'flat' : 'outlined'}
                  onPress={() => setSelectedYear(s.taxYear)}
                  style={styles.yearChip}
                >
                  {s.taxYear}
                </Chip>
              ))}
            </View>

            {/* Summary cards for the visible years */}
            {summary!
              .filter((s) => selectedYear === null || s.taxYear === selectedYear)
              .map((s) => (
                <Card key={s.taxYear} style={styles.summaryCard} mode="contained">
                  <Card.Content style={styles.summaryContent}>
                    <View>
                      <Text variant="titleLarge">{s.taxYear}</Text>
                      <Text variant="bodySmall" style={styles.itemMeta}>
                        {t('receipts.count', { count: s.count })}
                      </Text>
                    </View>
                    <View style={styles.summaryStorage}>
                      <Icon name="database" size={16} color={theme.colors.outline} />
                      <Text variant="bodyMedium">{formatBytes(s.totalStorageBytes)}</Text>
                    </View>
                  </Card.Content>
                </Card>
              ))}

            <Divider style={styles.divider} />

            {/* Receipt list */}
            {receiptsLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} />
            ) : (
              receipts?.map((r: Receipt) => (
                <Card key={r.id} style={styles.itemCard} mode="outlined">
                  <Pressable onPress={() => setPreviewReceipt(r)}>
                    <Card.Content style={styles.receiptRow}>
                      <Icon
                        name={receiptIcon(r.name, r.mimeType) as any}
                        size={24}
                        color={theme.colors.primary}
                      />
                      <View style={styles.itemInfo}>
                        <Text variant="titleSmall" numberOfLines={1}>{r.name}</Text>
                        <Text variant="bodySmall" style={styles.itemMeta}>
                          {(r.receiptDate ? new Date(r.receiptDate) : new Date(r.createdAt)).toLocaleDateString()}
                          {r.fileSize ? ` • ${formatBytes(r.fileSize)}` : ''}
                        </Text>
                      </View>
                      <Chip compact style={styles.sourceChip} textStyle={styles.sourceChipText}>
                        {t(`receipts.source.${r.source}`)}
                      </Chip>
                      <IconButton icon="eye" size={20} onPress={() => setPreviewReceipt(r)} />
                    </Card.Content>
                  </Pressable>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>

      <DocumentPreviewModal
        document={
          previewReceipt
            ? {
                id: previewReceipt.documentId,
                name: previewReceipt.name,
                mimeType: previewReceipt.mimeType,
                fileUrl: previewReceipt.fileUrl,
              }
            : null
        }
        visible={previewReceipt !== null}
        onDismiss={() => setPreviewReceipt(null)}
        onError={(message) => setSnackbar({ visible: true, message, error: true })}
      />

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
  content: { padding: 16, flexGrow: 1 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  flexButton: { flex: 1 },
  exportRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  yearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  yearChip: { marginBottom: 4 },
  summaryCard: { marginBottom: 12 },
  summaryContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryStorage: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { marginVertical: 12 },
  itemCard: { marginBottom: 12 },
  receiptRow: { flexDirection: 'row', alignItems: 'center' },
  itemInfo: { flex: 1, marginHorizontal: 12 },
  itemMeta: { opacity: 0.7, marginTop: 2 },
  sourceChip: { backgroundColor: 'transparent' },
  sourceChipText: { fontSize: 11 },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { opacity: 0.7, marginTop: 8, textAlign: 'center' },
});

export default PropertyReceiptsScreen;
