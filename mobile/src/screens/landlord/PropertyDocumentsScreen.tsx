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
  TextInput,
  IconButton,
} from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import {
  usePropertyDocuments,
  useUploadPropertyDocument,
  useUpdateDocument,
  useRequiredDocuments,
  useRequestDocument,
} from '../../hooks/useDocuments';
import { usePropertyLeases } from '../../hooks/useLeases';
import { downloadAndShare } from '../../lib/files';
import type {
  PropertiesStackParamList,
  Document,
  Lease,
  DocumentCategory,
  DocumentVisibility,
} from '../../types';
import {
  PROPERTY_DOCUMENT_CATEGORIES,
  REQUESTABLE_DOCUMENT_CATEGORIES,
} from '../../types';

type RouteType = RouteProp<PropertiesStackParamList, 'PropertyDocuments'>;

// Allowed file types for document upload
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
];

// Get icon name based on file extension or mime type
const getDocumentIcon = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return 'file-pdf-box';
    case 'doc':
    case 'docx':
      return 'file-word';
    case 'xls':
    case 'xlsx':
      return 'file-excel';
    case 'csv':
      return 'file-delimited';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'heic':
      return 'file-image';
    default:
      return 'file-document';
  }
};

// Get icon color based on file type
const getDocumentIconColor = (fileName: string, primaryColor: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return '#E53935'; // Red for PDF
    case 'doc':
    case 'docx':
      return '#1976D2'; // Blue for Word
    case 'xls':
    case 'xlsx':
    case 'csv':
      return '#388E3C'; // Green for Excel/CSV
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'heic':
      return '#7B1FA2'; // Purple for images
    default:
      return primaryColor;
  }
};

const PropertyDocumentsScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<RouteType>();
  const { t } = useTranslation();
  const { propertyId } = route.params;

  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('OTHER');
  const [pendingFile, setPendingFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [documentName, setDocumentName] = useState('');
  const [uploadVisibility, setUploadVisibility] = useState<DocumentVisibility>('PRIVATE');

  // Request-document (required documents) modal state
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestCategory, setRequestCategory] = useState<DocumentCategory>('IDENTIFICATION');
  const [requestLeaseId, setRequestLeaseId] = useState<string | null>(null);

  // Edit document state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategory>('OTHER');

  const { data: leases } = usePropertyLeases(propertyId);
  const {
    data: documents,
    isLoading,
    refetch: refetchDocuments,
    isRefetching,
  } = usePropertyDocuments(propertyId);
  const { data: requiredDocs, refetch: refetchRequiredDocs } = useRequiredDocuments(propertyId);
  const uploadDocument = useUploadPropertyDocument();
  const updateDocument = useUpdateDocument();
  const requestDocument = useRequestDocument();

  // Get active leases for the request-document modal
  const activeLeases = leases?.filter((l: Lease) => l.status === 'ACTIVE') || [];

  const handleRefresh = () => {
    refetchDocuments();
    refetchRequiredDocs();
  };

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_FILE_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      const fileData = {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      };

      setPendingFile(fileData);
      setDocumentName(file.name);
      setSelectedCategory('OTHER');
      setUploadVisibility('PRIVATE');
      setCategoryModalVisible(true);
    } catch (err) {
      console.error('Failed to select document', err);
    }
  };

  const isDocumentNameTaken = (name: string, excludeId?: string): boolean => {
    if (!documents) return false;
    const normalizedName = name.trim().toLowerCase();
    return documents.some(
      (doc: Document) =>
        doc.name.toLowerCase() === normalizedName && doc.id !== excludeId
    );
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile) return;

    const nameToUse = documentName.trim() || pendingFile.name;

    if (isDocumentNameTaken(nameToUse)) {
      setSnackbar({
        visible: true,
        message: t('documents.nameTaken'),
        type: 'error',
      });
      return;
    }

    setCategoryModalVisible(false);

    try {
      await uploadDocument.mutateAsync({
        propertyId,
        file: pendingFile,
        category: selectedCategory,
        name: nameToUse,
        visibility: uploadVisibility,
      });

      setSnackbar({
        visible: true,
        message: t('documents.uploadSuccess'),
        type: 'success',
      });
      refetchDocuments();
    } catch (err) {
      console.error('Failed to upload document', err);
      setSnackbar({
        visible: true,
        message: t('documents.uploadError'),
        type: 'error',
      });
    } finally {
      setPendingFile(null);
      setDocumentName('');
    }
  };

  const handleCancelUpload = () => {
    setCategoryModalVisible(false);
    setPendingFile(null);
    setDocumentName('');
  };

  const handleOpenRequest = () => {
    setRequestName('');
    setRequestCategory('IDENTIFICATION');
    // Default to the single active lease when there is exactly one.
    setRequestLeaseId(activeLeases.length === 1 ? activeLeases[0].id : null);
    setRequestModalVisible(true);
  };

  const handleConfirmRequest = async () => {
    if (!requestName.trim() || !requestLeaseId) return;
    setRequestModalVisible(false);
    try {
      await requestDocument.mutateAsync({
        leaseId: requestLeaseId,
        propertyId,
        name: requestName.trim(),
        category: requestCategory,
      });
      setSnackbar({
        visible: true,
        message: t('requiredDocs.requestSent'),
        type: 'success',
      });
    } catch (err) {
      setSnackbar({
        visible: true,
        message: t('requiredDocs.requestError'),
        type: 'error',
      });
    } finally {
      setRequestName('');
    }
  };

  // Status chip color for a required document.
  const getDocStatusColor = (status: string) =>
    status === 'RECEIVED' ? theme.colors.secondary : theme.colors.tertiary;

  const tenantNameForLease = (leaseId?: string) => {
    const lease = activeLeases.find((l: Lease) => l.id === leaseId);
    return lease?.tenant ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : '';
  };

  const handleOpenDocument = async (doc: Document) => {
    if (!doc.fileUrl) return;
    try {
      await downloadAndShare(doc.fileUrl, doc.name, doc.mimeType ?? undefined);
    } catch (err) {
      setSnackbar({
        visible: true,
        message: t('documents.openError'),
        type: 'error',
      });
    }
  };

  const handleEditDocument = (doc: Document) => {
    setEditingDocument(doc);
    setEditName(doc.name);
    setEditCategory(doc.category);
    setEditModalVisible(true);
  };

  const handleConfirmEdit = async () => {
    if (!editingDocument) return;

    if (isDocumentNameTaken(editName, editingDocument.id)) {
      setSnackbar({
        visible: true,
        message: t('documents.nameTaken'),
        type: 'error',
      });
      return;
    }

    setEditModalVisible(false);

    try {
      await updateDocument.mutateAsync({
        documentId: editingDocument.id,
        data: {
          name: editName.trim(),
          category: editCategory,
        },
        propertyId,
      });

      setSnackbar({
        visible: true,
        message: t('documents.updateSuccess'),
        type: 'success',
      });
      refetchDocuments();
    } catch (err) {
      console.error('Failed to update document', err);
      setSnackbar({
        visible: true,
        message: t('documents.updateError'),
        type: 'error',
      });
    } finally {
      setEditingDocument(null);
      setEditName('');
    }
  };

  const handleCancelEdit = () => {
    setEditModalVisible(false);
    setEditingDocument(null);
    setEditName('');
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        <Button
          mode="contained"
          onPress={handleSelectFile}
          icon="upload"
          loading={uploadDocument.isPending}
          disabled={uploadDocument.isPending}
          style={styles.uploadButton}
        >
          {t('documents.uploadDocument')}
        </Button>

        {documents && documents.length > 0 ? (
          documents.map((doc: Document) => (
            <Card key={doc.id} style={styles.itemCard} mode="outlined">
              <Card.Content style={styles.documentRow}>
                <Icon name={getDocumentIcon(doc.name) as any} size={24} color={getDocumentIconColor(doc.name, theme.colors.primary)} />
                <View style={styles.itemInfo}>
                  <Text variant="titleSmall">{doc.name}</Text>
                  <Text variant="bodySmall" style={styles.itemMeta}>
                    {t(`documents.categories.${doc.category}`)} • {new Date(doc.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                {doc.fileUrl && (
                  <IconButton
                    icon="download"
                    size={20}
                    onPress={() => handleOpenDocument(doc)}
                  />
                )}
                <IconButton
                  icon="pencil"
                  size={20}
                  onPress={() => handleEditDocument(doc)}
                />
              </Card.Content>
            </Card>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="file-document-outline" size={48} color={theme.colors.outline} />
            <Text variant="bodyMedium" style={styles.emptyText}>
              {t('documents.noDocuments')}
            </Text>
          </View>
        )}

        {/* Required Documents (request from tenant) */}
        <Divider style={styles.sectionDivider} />
        <View style={styles.requiredHeader}>
          <Text variant="titleSmall">{t('requiredDocs.title')}</Text>
        </View>
        <Button
          mode="outlined"
          icon="file-document-plus-outline"
          onPress={handleOpenRequest}
          disabled={activeLeases.length === 0}
          style={styles.uploadButton}
        >
          {t('requiredDocs.requestButton')}
        </Button>
        {activeLeases.length === 0 && (
          <Text variant="bodySmall" style={styles.emptyText}>
            {t('requiredDocs.noTenants')}
          </Text>
        )}
        {requiredDocs && requiredDocs.length > 0
          ? requiredDocs.map((doc) => (
              <Card key={doc.id} style={styles.itemCard} mode="outlined">
                <Card.Content style={styles.documentRow}>
                  <Icon
                    name={doc.status === 'RECEIVED' ? 'file-check' : 'file-clock'}
                    size={24}
                    color={getDocStatusColor(doc.status)}
                  />
                  <View style={styles.itemInfo}>
                    <Text variant="titleSmall">{doc.name}</Text>
                    <Text variant="bodySmall" style={styles.itemMeta}>
                      {t(`documents.categories.${doc.category}`)}
                      {doc.lease?.tenant
                        ? ` • ${doc.lease.tenant.firstName} ${doc.lease.tenant.lastName}`
                        : ''}
                    </Text>
                  </View>
                  <Chip
                    compact
                    style={{ backgroundColor: getDocStatusColor(doc.status) + '20' }}
                    textStyle={{ color: getDocStatusColor(doc.status), fontSize: 11 }}
                  >
                    {t(`requiredDocs.status.${doc.status}`)}
                  </Chip>
                  {doc.status === 'RECEIVED' && doc.fileUrl && (
                    <IconButton
                      icon="download"
                      size={20}
                      onPress={() => handleOpenDocument(doc)}
                    />
                  )}
                </Card.Content>
              </Card>
            ))
          : activeLeases.length > 0 && (
              <Text variant="bodySmall" style={styles.emptyText}>
                {t('requiredDocs.none')}
              </Text>
            )}
      </ScrollView>

      <Portal>
        <Modal
          visible={categoryModalVisible}
          onDismiss={handleCancelUpload}
          contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            {t('documents.uploadDocument')}
          </Text>
          {pendingFile && (
            <Text variant="bodySmall" style={styles.modalFileName}>
              {pendingFile.name}
            </Text>
          )}
          <TextInput
            label={t('documents.documentName')}
            value={documentName}
            onChangeText={setDocumentName}
            mode="outlined"
            style={styles.nameInput}
          />
          <Text variant="labelMedium" style={styles.categoryLabel}>
            {t('documents.selectCategory')}
          </Text>
          <RadioButton.Group
            onValueChange={(value) => setSelectedCategory(value as DocumentCategory)}
            value={selectedCategory}
          >
            {PROPERTY_DOCUMENT_CATEGORIES.map((category) => (
              <RadioButton.Item
                key={category}
                label={t(`documents.categories.${category}`)}
                value={category}
                style={styles.radioItem}
              />
            ))}
          </RadioButton.Group>
          <Text variant="labelMedium" style={styles.categoryLabel}>
            {t('documents.visibility.label')}
          </Text>
          <RadioButton.Group
            onValueChange={(value) => setUploadVisibility(value as DocumentVisibility)}
            value={uploadVisibility}
          >
            <RadioButton.Item
              label={t('documents.visibility.PRIVATE')}
              value="PRIVATE"
              style={styles.radioItem}
            />
            <RadioButton.Item
              label={t('documents.visibility.SHARED')}
              value="SHARED"
              style={styles.radioItem}
            />
          </RadioButton.Group>
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={handleCancelUpload}>
              {t('common.cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={handleConfirmUpload}
              loading={uploadDocument.isPending}
            >
              {t('documents.upload')}
            </Button>
          </View>
        </Modal>

        <Modal
          visible={editModalVisible}
          onDismiss={handleCancelEdit}
          contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            {t('documents.editDocument')}
          </Text>
          <TextInput
            label={t('documents.documentName')}
            value={editName}
            onChangeText={setEditName}
            mode="outlined"
            style={styles.nameInput}
          />
          <Text variant="labelMedium" style={styles.categoryLabel}>
            {t('documents.selectCategory')}
          </Text>
          <RadioButton.Group
            onValueChange={(value) => setEditCategory(value as DocumentCategory)}
            value={editCategory}
          >
            {PROPERTY_DOCUMENT_CATEGORIES.map((category) => (
              <RadioButton.Item
                key={category}
                label={t(`documents.categories.${category}`)}
                value={category}
                style={styles.radioItem}
              />
            ))}
          </RadioButton.Group>
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={handleCancelEdit}>
              {t('common.cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={handleConfirmEdit}
              loading={updateDocument.isPending}
              disabled={!editName.trim()}
            >
              {t('common.save')}
            </Button>
          </View>
        </Modal>

        {/* Request document from tenant */}
        <Modal
          visible={requestModalVisible}
          onDismiss={() => setRequestModalVisible(false)}
          contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            {t('requiredDocs.requestTitle')}
          </Text>
          <TextInput
            label={t('requiredDocs.documentName')}
            value={requestName}
            onChangeText={setRequestName}
            mode="outlined"
            placeholder={t('requiredDocs.namePlaceholder')}
            style={styles.nameInput}
          />
          <Text variant="labelMedium" style={styles.categoryLabel}>
            {t('documents.selectCategory')}
          </Text>
          <RadioButton.Group
            onValueChange={(v) => setRequestCategory(v as DocumentCategory)}
            value={requestCategory}
          >
            {REQUESTABLE_DOCUMENT_CATEGORIES.map((category) => (
              <RadioButton.Item
                key={category}
                label={t(`documents.categories.${category}`)}
                value={category}
                style={styles.radioItem}
              />
            ))}
          </RadioButton.Group>
          {activeLeases.length > 1 ? (
            <>
              <Text variant="labelMedium" style={styles.categoryLabel}>
                {t('requiredDocs.selectTenant')}
              </Text>
              <RadioButton.Group
                onValueChange={(v) => setRequestLeaseId(v)}
                value={requestLeaseId ?? ''}
              >
                {activeLeases.map((lease: Lease) => (
                  <RadioButton.Item
                    key={lease.id}
                    label={`${lease.tenant?.firstName} ${lease.tenant?.lastName}`}
                    value={lease.id}
                    style={styles.radioItem}
                  />
                ))}
              </RadioButton.Group>
            </>
          ) : activeLeases.length === 1 ? (
            <Text variant="bodySmall" style={styles.modalFileName}>
              {t('requiredDocs.requestingFrom', {
                name: tenantNameForLease(activeLeases[0].id),
              })}
            </Text>
          ) : null}
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setRequestModalVisible(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={handleConfirmRequest}
              loading={requestDocument.isPending}
              disabled={!requestName.trim() || !requestLeaseId}
            >
              {t('requiredDocs.send')}
            </Button>
          </View>
        </Modal>
      </Portal>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
        duration={3000}
        style={snackbar.type === 'error' ? { backgroundColor: theme.colors.error } : undefined}
      >
        {snackbar.message}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    flexGrow: 1,
  },
  uploadButton: {
    marginBottom: 16,
  },
  itemCard: {
    marginBottom: 12,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemMeta: {
    opacity: 0.7,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    opacity: 0.7,
    marginTop: 8,
    textAlign: 'center',
  },
  sectionDivider: {
    marginVertical: 16,
  },
  requiredHeader: {
    marginBottom: 12,
  },
  modalContent: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    marginBottom: 8,
    fontWeight: '600',
  },
  modalFileName: {
    opacity: 0.7,
    marginBottom: 12,
  },
  nameInput: {
    marginBottom: 16,
  },
  categoryLabel: {
    marginBottom: 8,
    opacity: 0.7,
  },
  radioItem: {
    paddingVertical: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
});

export default PropertyDocumentsScreen;
