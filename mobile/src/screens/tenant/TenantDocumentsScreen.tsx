import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  useTheme,
  Card,
  ActivityIndicator,
  Divider,
  IconButton,
  Button,
  Chip,
  Snackbar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import {
  usePropertyDocuments,
  useLeaseDocuments,
  useFulfillDocument,
} from '../../hooks/useDocuments';
import type { RentalsStackParamList, Document, DocumentCategory } from '../../types';
import { downloadAndShare } from '../../lib/files';

// File types a tenant can upload to fulfill a request (mirrors the backend).
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

type RouteType = RouteProp<RentalsStackParamList, 'TenantDocuments'>;

// Get icon for document category
const getDocumentIcon = (category: DocumentCategory): string => {
  switch (category) {
    case 'INSURANCE':
      return 'shield-check';
    case 'WARRANTY':
      return 'certificate';
    case 'METER_READING':
      return 'counter';
    case 'PROPERTY_PHOTO':
      return 'image';
    case 'INVOICE':
      return 'receipt';
    case 'MANUAL':
      return 'book-open-page-variant';
    case 'LEASE_AGREEMENT':
    case 'SIGNED_LEASE':
      return 'file-sign';
    case 'GUARANTOR_DOCUMENT':
      return 'account-check';
    case 'ADDENDUM':
      return 'file-plus';
    case 'CONTRACT':
      return 'file-document';
    default:
      return 'file-document-outline';
  }
};

interface DocumentItemProps {
  document: Document;
  onOpen: () => void;
}

const DocumentItem: React.FC<DocumentItemProps> = ({ document, onOpen }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <View style={styles.documentItem}>
      <View style={[styles.documentIcon, { backgroundColor: theme.colors.primaryContainer }]}>
        <Icon
          name={getDocumentIcon(document.category) as any}
          size={24}
          color={theme.colors.primary}
        />
      </View>
      <View style={styles.documentInfo}>
        <Text variant="bodyLarge" style={styles.documentName} numberOfLines={1}>
          {document.name}
        </Text>
        <Text variant="bodySmall" style={styles.documentMeta}>
          {t(`documents.categories.${document.category}`)} • {formatDate(document.createdAt)}
        </Text>
      </View>
      <IconButton
        icon="download"
        mode="contained-tonal"
        size={20}
        onPress={onOpen}
      />
    </View>
  );
};

const TenantDocumentsScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<RouteType>();
  const { t } = useTranslation();
  const { propertyId, leaseId } = route.params;

  const {
    data: propertyDocs,
    isLoading: propertyDocsLoading,
    refetch: refetchPropertyDocs,
    isRefetching: propertyDocsRefetching,
  } = usePropertyDocuments(propertyId);

  const {
    data: leaseDocs,
    isLoading: leaseDocsLoading,
    refetch: refetchLeaseDocs,
    isRefetching: leaseDocsRefetching,
  } = useLeaseDocuments(leaseId || '');

  const fulfillDocument = useFulfillDocument();
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; error: boolean }>({
    visible: false,
    message: '',
    error: false,
  });

  const isLoading = propertyDocsLoading || (!!leaseId && leaseDocsLoading);
  const isRefetching = propertyDocsRefetching || leaseDocsRefetching;

  const handleRefresh = () => {
    refetchPropertyDocs();
    if (leaseId) refetchLeaseDocs();
  };

  const handleOpenDocument = async (document: Document) => {
    if (!document.fileUrl) return;
    try {
      await downloadAndShare(
        document.fileUrl,
        document.name,
        document.mimeType ?? undefined
      );
    } catch (error) {
      setSnackbar({ visible: true, message: t('requiredDocs.downloadError'), error: true });
    }
  };

  const handleUploadRequired = async (document: Document) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_FILE_TYPES,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const file = result.assets[0];
      setFulfillingId(document.id);
      await fulfillDocument.mutateAsync({
        documentId: document.id,
        leaseId: leaseId || undefined,
        file: {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        },
      });
      setSnackbar({ visible: true, message: t('requiredDocs.uploadSuccess'), error: false });
    } catch (err) {
      console.error('Failed to upload requested document', err);
      setSnackbar({ visible: true, message: t('requiredDocs.uploadError'), error: true });
    } finally {
      setFulfillingId(null);
    }
  };

  // Combine documents
  const allDocuments = [
    ...(propertyDocs || []),
    ...(leaseDocs || []),
  ];

  // Required documents (landlord-requested) are surfaced separately.
  const requiredDocuments = allDocuments.filter(
    doc => doc.status === 'REQUESTED' || doc.status === 'RECEIVED'
  );
  const regularDocuments = allDocuments.filter(
    doc => !doc.status || doc.status === 'OPTIONAL'
  );

  const leaseDocuments = regularDocuments.filter(doc =>
    ['LEASE_AGREEMENT', 'SIGNED_LEASE', 'GUARANTOR_DOCUMENT', 'ADDENDUM', 'CONTRACT'].includes(doc.category)
  );

  const propertyDocuments = regularDocuments.filter(doc =>
    !['LEASE_AGREEMENT', 'SIGNED_LEASE', 'GUARANTOR_DOCUMENT', 'ADDENDUM', 'CONTRACT'].includes(doc.category)
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const hasDocuments = allDocuments.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {hasDocuments ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
        >
          {/* Required Documents Section (landlord requests) */}
          {requiredDocuments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="clipboard-text-outline" size={20} color={theme.colors.tertiary} />
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  {t('requiredDocs.title')}
                </Text>
              </View>
              <Card mode="outlined" style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  {requiredDocuments.map((doc, index) => {
                    const received = doc.status === 'RECEIVED';
                    return (
                      <React.Fragment key={doc.id}>
                        <View style={styles.documentItem}>
                          <View style={[styles.documentIcon, { backgroundColor: theme.colors.tertiaryContainer }]}>
                            <Icon
                              name={received ? 'file-check' : 'file-clock'}
                              size={24}
                              color={theme.colors.tertiary}
                            />
                          </View>
                          <View style={styles.documentInfo}>
                            <Text variant="bodyLarge" style={styles.documentName} numberOfLines={1}>
                              {doc.name}
                            </Text>
                            <Text variant="bodySmall" style={styles.documentMeta}>
                              {t(`documents.categories.${doc.category}`)} •{' '}
                              {received
                                ? t('requiredDocs.status.RECEIVED')
                                : t('requiredDocs.status.PENDING')}
                            </Text>
                          </View>
                          {received ? (
                            <IconButton
                              icon="download"
                              mode="contained-tonal"
                              size={20}
                              onPress={() => handleOpenDocument(doc)}
                            />
                          ) : (
                            <Button
                              mode="contained-tonal"
                              compact
                              icon="upload"
                              loading={fulfillingId === doc.id}
                              disabled={fulfillingId === doc.id}
                              onPress={() => handleUploadRequired(doc)}
                            >
                              {t('requiredDocs.upload')}
                            </Button>
                          )}
                        </View>
                        {index < requiredDocuments.length - 1 && <Divider style={styles.divider} />}
                      </React.Fragment>
                    );
                  })}
                </Card.Content>
              </Card>
            </View>
          )}

          {/* Lease Documents Section */}
          {leaseDocuments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="file-sign" size={20} color={theme.colors.primary} />
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  {t('tenantDocuments.leaseDocuments')}
                </Text>
              </View>
              <Card mode="outlined" style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  {leaseDocuments.map((doc, index) => (
                    <React.Fragment key={doc.id}>
                      <DocumentItem document={doc} onOpen={() => handleOpenDocument(doc)} />
                      {index < leaseDocuments.length - 1 && <Divider style={styles.divider} />}
                    </React.Fragment>
                  ))}
                </Card.Content>
              </Card>
            </View>
          )}

          {/* Property Documents Section */}
          {propertyDocuments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="home-city" size={20} color={theme.colors.secondary} />
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  {t('tenantDocuments.propertyDocuments')}
                </Text>
              </View>
              <Card mode="outlined" style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  {propertyDocuments.map((doc, index) => (
                    <React.Fragment key={doc.id}>
                      <DocumentItem document={doc} onOpen={() => handleOpenDocument(doc)} />
                      {index < propertyDocuments.length - 1 && <Divider style={styles.divider} />}
                    </React.Fragment>
                  ))}
                </Card.Content>
              </Card>
            </View>
          )}

          {/* Info note */}
          <View style={styles.infoNote}>
            <Icon name="information-outline" size={16} color={theme.colors.outline} />
            <Text variant="bodySmall" style={styles.infoText}>
              {t('tenantDocuments.infoNote')}
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View style={[styles.container, styles.emptyState]}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Icon name="file-document-outline" size={48} color={theme.colors.outline} />
          </View>
          <Text variant="titleMedium" style={styles.emptyTitle}>
            {t('tenantDocuments.noDocuments')}
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {t('tenantDocuments.noDocumentsDescription')}
          </Text>
        </View>
      )}

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
        duration={3000}
        style={snackbar.error ? { backgroundColor: theme.colors.error } : undefined}
      >
        {snackbar.message}
      </Snackbar>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  card: {
    overflow: 'hidden',
  },
  cardContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontWeight: '500',
  },
  documentMeta: {
    opacity: 0.6,
    marginTop: 2,
  },
  divider: {
    marginVertical: 4,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 8,
    opacity: 0.7,
  },
  infoText: {
    flex: 1,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    opacity: 0.6,
    textAlign: 'center',
  },
});

export default TenantDocumentsScreen;
