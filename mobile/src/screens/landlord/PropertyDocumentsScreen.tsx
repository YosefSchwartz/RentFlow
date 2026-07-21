import React, { useState, useMemo } from 'react';
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
  Portal,
  Modal,
  RadioButton,
  TextInput,
  IconButton,
  Checkbox,
  Menu,
  Appbar,
  Dialog,
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
  useBulkDeleteDocuments,
  useBulkMoveDocuments,
} from '../../hooks/useDocuments';
import {
  usePropertyFolders,
  useCreateFolder,
  useDeleteFolder,
} from '../../hooks/useFolders';
import { usePropertyLeases } from '../../hooks/useLeases';
import DocumentPreviewModal from '../../components/media/DocumentPreviewModal';
import type {
  PropertiesStackParamList,
  Document,
  Folder,
  Lease,
  DocumentCategory,
  DocumentPermission,
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

const getDocumentIconColor = (fileName: string, primaryColor: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return '#E53935';
    case 'doc':
    case 'docx':
      return '#1976D2';
    case 'xls':
    case 'xlsx':
    case 'csv':
      return '#388E3C';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'heic':
      return '#7B1FA2';
    default:
      return primaryColor;
  }
};

// Flatten the folder tree into a single list for lookups / pickers.
const flattenFolders = (folders: Folder[]): Folder[] => {
  const out: Folder[] = [];
  const walk = (nodes: Folder[]) => {
    nodes.forEach((n) => {
      out.push(n);
      if (n.children?.length) walk(n.children);
    });
  };
  walk(folders);
  return out;
};

const folderDisplayName = (
  folder: Folder,
  t: (k: string) => string,
): string =>
  folder.isSystem && folder.systemKey
    ? t(`documents.folders.system.${folder.systemKey}`)
    : folder.name;

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

  // Folder navigation (null = property root)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  // Preview
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  // Upload modal state
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('OTHER');
  const [pendingFile, setPendingFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [documentName, setDocumentName] = useState('');
  const [uploadPermission, setUploadPermission] = useState<DocumentPermission>('LANDLORD_ONLY');

  // New folder modal
  const [newFolderVisible, setNewFolderVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

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
  const [editPermission, setEditPermission] = useState<DocumentPermission>('LANDLORD_ONLY');

  // Folder row menu
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);

  const { data: leases } = usePropertyLeases(propertyId);
  const {
    data: documents,
    isLoading,
    refetch: refetchDocuments,
    isRefetching,
  } = usePropertyDocuments(propertyId);
  const { data: folders, refetch: refetchFolders } = usePropertyFolders(propertyId);
  const { data: requiredDocs, refetch: refetchRequiredDocs } = useRequiredDocuments(propertyId);

  const uploadDocument = useUploadPropertyDocument();
  const updateDocument = useUpdateDocument();
  const requestDocument = useRequestDocument();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const bulkDelete = useBulkDeleteDocuments();
  const bulkMove = useBulkMoveDocuments();

  const allFolders = useMemo(() => flattenFolders(folders ?? []), [folders]);
  const folderById = useMemo(() => {
    const m = new Map<string, Folder>();
    allFolders.forEach((f) => m.set(f.id, f));
    return m;
  }, [allFolders]);

  // Subfolders + documents at the current level.
  const childFolders = allFolders.filter(
    (f) => (f.parentId ?? null) === currentFolderId,
  );
  // Regular (non-required) documents filed at the current folder level.
  const documentsHere = (documents ?? []).filter(
    (d) =>
      (!d.status || d.status === 'OPTIONAL') &&
      (d.folderId ?? null) === currentFolderId,
  );

  // Breadcrumb from root to current folder.
  const breadcrumb = useMemo(() => {
    const path: Folder[] = [];
    let cursor = currentFolderId;
    while (cursor) {
      const f = folderById.get(cursor);
      if (!f) break;
      path.unshift(f);
      cursor = f.parentId;
    }
    return path;
  }, [currentFolderId, folderById]);

  const activeLeases = leases?.filter((l: Lease) => l.status === 'ACTIVE') || [];

  const handleRefresh = () => {
    refetchDocuments();
    refetchFolders();
    refetchRequiredDocs();
  };

  // ---- Selection mode ----
  const enterSelection = (docId: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([docId]));
  };
  const toggleSelected = (docId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };
  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    setDeleteDialogVisible(false);
    const ids = Array.from(selectedIds);
    try {
      await bulkDelete.mutateAsync({ ids, propertyId });
      setSnackbar({ visible: true, message: t('documents.selection.deleteSuccess'), type: 'success' });
      exitSelection();
    } catch {
      setSnackbar({ visible: true, message: t('documents.selection.deleteError'), type: 'error' });
    }
  };

  const handleBulkMove = async (folderId: string | null) => {
    setMoveModalVisible(false);
    const ids = Array.from(selectedIds);
    try {
      await bulkMove.mutateAsync({ ids, folderId, propertyId });
      setSnackbar({ visible: true, message: t('documents.selection.moveSuccess'), type: 'success' });
      exitSelection();
    } catch {
      setSnackbar({ visible: true, message: t('documents.selection.moveError'), type: 'error' });
    }
  };

  // ---- Upload ----
  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_FILE_TYPES,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const file = result.assets[0];
      setPendingFile({
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      });
      setDocumentName(file.name);
      setSelectedCategory('OTHER');
      setUploadPermission('LANDLORD_ONLY');
      setCategoryModalVisible(true);
    } catch (err) {
      console.error('Failed to select document', err);
    }
  };

  const isDocumentNameTaken = (name: string, excludeId?: string): boolean => {
    if (!documents) return false;
    const normalizedName = name.trim().toLowerCase();
    return documents.some(
      (doc: Document) => doc.name.toLowerCase() === normalizedName && doc.id !== excludeId,
    );
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile) return;
    const nameToUse = documentName.trim() || pendingFile.name;
    if (isDocumentNameTaken(nameToUse)) {
      setSnackbar({ visible: true, message: t('documents.nameTaken'), type: 'error' });
      return;
    }
    setCategoryModalVisible(false);
    try {
      await uploadDocument.mutateAsync({
        propertyId,
        file: pendingFile,
        category: selectedCategory,
        name: nameToUse,
        permission: uploadPermission,
        folderId: currentFolderId,
      });
      setSnackbar({ visible: true, message: t('documents.uploadSuccess'), type: 'success' });
      refetchDocuments();
    } catch (err) {
      console.error('Failed to upload document', err);
      setSnackbar({ visible: true, message: t('documents.uploadError'), type: 'error' });
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

  // ---- Folders ----
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setNewFolderVisible(false);
    try {
      await createFolder.mutateAsync({
        propertyId,
        name: newFolderName.trim(),
        parentId: currentFolderId,
      });
      setSnackbar({ visible: true, message: t('documents.folders.createSuccess'), type: 'success' });
    } catch {
      setSnackbar({ visible: true, message: t('documents.folders.createError'), type: 'error' });
    } finally {
      setNewFolderName('');
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    setFolderMenuId(null);
    try {
      await deleteFolder.mutateAsync({ folderId: folder.id, propertyId });
      setSnackbar({ visible: true, message: t('documents.folders.deleteSuccess'), type: 'success' });
    } catch {
      setSnackbar({ visible: true, message: t('documents.folders.deleteError'), type: 'error' });
    }
  };

  // ---- Request document (required docs) ----
  const handleOpenRequest = () => {
    setRequestName('');
    setRequestCategory('IDENTIFICATION');
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
      setSnackbar({ visible: true, message: t('requiredDocs.requestSent'), type: 'success' });
    } catch {
      setSnackbar({ visible: true, message: t('requiredDocs.requestError'), type: 'error' });
    } finally {
      setRequestName('');
    }
  };

  const getDocStatusColor = (status: string) =>
    status === 'RECEIVED' ? theme.colors.secondary : theme.colors.tertiary;

  const tenantNameForLease = (leaseId?: string) => {
    const lease = activeLeases.find((l: Lease) => l.id === leaseId);
    return lease?.tenant ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : '';
  };

  // ---- Edit ----
  const handleEditDocument = (doc: Document) => {
    setEditingDocument(doc);
    setEditName(doc.name);
    setEditCategory(doc.category);
    setEditPermission(doc.permission);
    setEditModalVisible(true);
  };

  const handleConfirmEdit = async () => {
    if (!editingDocument) return;
    if (isDocumentNameTaken(editName, editingDocument.id)) {
      setSnackbar({ visible: true, message: t('documents.nameTaken'), type: 'error' });
      return;
    }
    setEditModalVisible(false);
    try {
      await updateDocument.mutateAsync({
        documentId: editingDocument.id,
        data: {
          name: editName.trim(),
          category: editCategory,
          permission: editPermission,
        },
        propertyId,
      });
      setSnackbar({ visible: true, message: t('documents.updateSuccess'), type: 'success' });
      refetchDocuments();
    } catch (err) {
      console.error('Failed to update document', err);
      setSnackbar({ visible: true, message: t('documents.updateError'), type: 'error' });
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

  // Permission badge (icon + short label).
  const PermissionBadge: React.FC<{ permission: DocumentPermission }> = ({ permission }) => {
    const isShared = permission === 'LANDLORD_AND_TENANT';
    const color = isShared ? theme.colors.secondary : theme.colors.outline;
    return (
      <Chip
        compact
        icon={isShared ? 'account-group' : 'lock'}
        style={{ backgroundColor: color + '20' }}
        textStyle={{ color, fontSize: 11 }}
      >
        {t(`documents.permission.${permission}`)}
      </Chip>
    );
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
      {/* Selection action bar */}
      {selectionMode && (
        <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.Action icon="close" onPress={exitSelection} />
          <Appbar.Content title={t('documents.selection.count', { count: selectedIds.size })} />
          <Appbar.Action
            icon="folder-move"
            disabled={selectedIds.size === 0}
            onPress={() => setMoveModalVisible(true)}
          />
          <Appbar.Action
            icon="delete"
            disabled={selectedIds.size === 0}
            onPress={() => setDeleteDialogVisible(true)}
          />
          {/* Room for future bulk actions (share, tag, download-all). */}
        </Appbar.Header>
      )}

      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        {/* Breadcrumb */}
        <View style={styles.breadcrumb}>
          <Chip
            compact
            mode={currentFolderId === null ? 'flat' : 'outlined'}
            icon="home"
            onPress={() => setCurrentFolderId(null)}
          >
            {t('documents.folders.root')}
          </Chip>
          {breadcrumb.map((f) => (
            <React.Fragment key={f.id}>
              <Icon name="chevron-right" size={18} color={theme.colors.outline} />
              <Chip
                compact
                mode={currentFolderId === f.id ? 'flat' : 'outlined'}
                onPress={() => setCurrentFolderId(f.id)}
              >
                {folderDisplayName(f, t)}
              </Chip>
            </React.Fragment>
          ))}
        </View>

        {!selectionMode && (
          <View style={styles.actionRow}>
            <Button
              mode="contained"
              onPress={handleSelectFile}
              icon="upload"
              loading={uploadDocument.isPending}
              disabled={uploadDocument.isPending}
              style={styles.flexButton}
            >
              {t('documents.uploadDocument')}
            </Button>
            <Button
              mode="outlined"
              onPress={() => {
                setNewFolderName('');
                setNewFolderVisible(true);
              }}
              icon="folder-plus"
            >
              {t('documents.folders.new')}
            </Button>
          </View>
        )}

        {/* Subfolders */}
        {childFolders.map((folder) => (
          <Card key={folder.id} style={styles.itemCard} mode="outlined">
            <Card.Content style={styles.documentRow}>
              <Pressable style={styles.folderPressable} onPress={() => setCurrentFolderId(folder.id)}>
                <Icon name="folder" size={24} color={theme.colors.primary} />
                <View style={styles.itemInfo}>
                  <Text variant="titleSmall">{folderDisplayName(folder, t)}</Text>
                  {folder.isSystem && (
                    <Text variant="bodySmall" style={styles.itemMeta}>
                      {t('documents.folders.systemLabel')}
                    </Text>
                  )}
                </View>
              </Pressable>
              {!folder.isSystem && !selectionMode && (
                <Menu
                  visible={folderMenuId === folder.id}
                  onDismiss={() => setFolderMenuId(null)}
                  anchor={
                    <IconButton
                      icon="dots-vertical"
                      size={20}
                      onPress={() => setFolderMenuId(folder.id)}
                    />
                  }
                >
                  <Menu.Item
                    leadingIcon="delete"
                    onPress={() => handleDeleteFolder(folder)}
                    title={t('documents.folders.delete')}
                  />
                </Menu>
              )}
            </Card.Content>
          </Card>
        ))}

        {/* Documents at this level */}
        {documentsHere.length > 0
          ? documentsHere.map((doc: Document) => {
              const selected = selectedIds.has(doc.id);
              return (
                <Card
                  key={doc.id}
                  style={[styles.itemCard, selected && { borderColor: theme.colors.primary }]}
                  mode="outlined"
                >
                  <Pressable
                    onPress={() => (selectionMode ? toggleSelected(doc.id) : setPreviewDoc(doc))}
                    onLongPress={() => !selectionMode && enterSelection(doc.id)}
                  >
                    <Card.Content style={styles.documentRow}>
                      {selectionMode ? (
                        <Checkbox status={selected ? 'checked' : 'unchecked'} />
                      ) : (
                        <Icon
                          name={getDocumentIcon(doc.name) as any}
                          size={24}
                          color={getDocumentIconColor(doc.name, theme.colors.primary)}
                        />
                      )}
                      <View style={styles.itemInfo}>
                        <Text variant="titleSmall">{doc.name}</Text>
                        <Text variant="bodySmall" style={styles.itemMeta}>
                          {t(`documents.categories.${doc.category}`)} •{' '}
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <PermissionBadge permission={doc.permission} />
                      {!selectionMode && (
                        <IconButton icon="pencil" size={18} onPress={() => handleEditDocument(doc)} />
                      )}
                    </Card.Content>
                  </Pressable>
                </Card>
              );
            })
          : childFolders.length === 0 && (
              <View style={styles.emptyContainer}>
                <Icon name="file-document-outline" size={48} color={theme.colors.outline} />
                <Text variant="bodyMedium" style={styles.emptyText}>
                  {t('documents.noDocuments')}
                </Text>
                <Button mode="contained-tonal" icon="upload" onPress={handleSelectFile} style={{ marginTop: 12 }}>
                  {t('documents.uploadDocument')}
                </Button>
              </View>
            )}

        {/* Required Documents (request from tenant) — shown at root only */}
        {currentFolderId === null && (
          <>
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
                        <IconButton icon="eye" size={20} onPress={() => setPreviewDoc(doc)} />
                      )}
                    </Card.Content>
                  </Card>
                ))
              : activeLeases.length > 0 && (
                  <Text variant="bodySmall" style={styles.emptyText}>
                    {t('requiredDocs.none')}
                  </Text>
                )}
          </>
        )}
      </ScrollView>

      <DocumentPreviewModal
        document={previewDoc}
        visible={previewDoc !== null}
        onDismiss={() => setPreviewDoc(null)}
        onError={(message) => setSnackbar({ visible: true, message, type: 'error' })}
      />

      <Portal>
        {/* Upload modal */}
        <Modal
          visible={categoryModalVisible}
          onDismiss={handleCancelUpload}
          contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
        >
          <ScrollView>
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
              {t('documents.permission.label')}
            </Text>
            <RadioButton.Group
              onValueChange={(value) => setUploadPermission(value as DocumentPermission)}
              value={uploadPermission}
            >
              <RadioButton.Item
                label={t('documents.permission.LANDLORD_ONLY')}
                value="LANDLORD_ONLY"
                style={styles.radioItem}
              />
              <RadioButton.Item
                label={t('documents.permission.LANDLORD_AND_TENANT')}
                value="LANDLORD_AND_TENANT"
                style={styles.radioItem}
              />
            </RadioButton.Group>
            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={handleCancelUpload}>
                {t('common.cancel')}
              </Button>
              <Button mode="contained" onPress={handleConfirmUpload} loading={uploadDocument.isPending}>
                {t('documents.upload')}
              </Button>
            </View>
          </ScrollView>
        </Modal>

        {/* Edit modal */}
        <Modal
          visible={editModalVisible}
          onDismiss={handleCancelEdit}
          contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
        >
          <ScrollView>
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
            <Text variant="labelMedium" style={styles.categoryLabel}>
              {t('documents.permission.label')}
            </Text>
            <RadioButton.Group
              onValueChange={(value) => setEditPermission(value as DocumentPermission)}
              value={editPermission}
            >
              <RadioButton.Item
                label={t('documents.permission.LANDLORD_ONLY')}
                value="LANDLORD_ONLY"
                style={styles.radioItem}
              />
              <RadioButton.Item
                label={t('documents.permission.LANDLORD_AND_TENANT')}
                value="LANDLORD_AND_TENANT"
                style={styles.radioItem}
              />
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
          </ScrollView>
        </Modal>

        {/* New folder modal */}
        <Modal
          visible={newFolderVisible}
          onDismiss={() => setNewFolderVisible(false)}
          contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            {t('documents.folders.newTitle')}
          </Text>
          <TextInput
            label={t('documents.folders.name')}
            value={newFolderName}
            onChangeText={setNewFolderName}
            mode="outlined"
            style={styles.nameInput}
          />
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setNewFolderVisible(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={handleCreateFolder}
              loading={createFolder.isPending}
              disabled={!newFolderName.trim()}
            >
              {t('common.create')}
            </Button>
          </View>
        </Modal>

        {/* Move-to-folder picker (selection mode) */}
        <Modal
          visible={moveModalVisible}
          onDismiss={() => setMoveModalVisible(false)}
          contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            {t('documents.selection.moveTitle')}
          </Text>
          <ScrollView style={styles.moveList}>
            <RadioButton.Item
              label={t('documents.folders.root')}
              value="__root__"
              status="unchecked"
              onPress={() => handleBulkMove(null)}
              style={styles.radioItem}
            />
            {allFolders.map((f) => (
              <RadioButton.Item
                key={f.id}
                label={folderDisplayName(f, t)}
                value={f.id}
                status="unchecked"
                onPress={() => handleBulkMove(f.id)}
                style={styles.radioItem}
              />
            ))}
          </ScrollView>
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setMoveModalVisible(false)}>
              {t('common.cancel')}
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
              <RadioButton.Group onValueChange={(v) => setRequestLeaseId(v)} value={requestLeaseId ?? ''}>
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
              {t('requiredDocs.requestingFrom', { name: tenantNameForLease(activeLeases[0].id) })}
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

        {/* Bulk delete confirmation */}
        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>{t('documents.selection.confirmDeleteTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t('documents.selection.confirmDelete', { count: selectedIds.size })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>{t('common.cancel')}</Button>
            <Button onPress={handleBulkDelete} loading={bulkDelete.isPending} textColor={theme.colors.error}>
              {t('documents.selection.delete')}
            </Button>
          </Dialog.Actions>
        </Dialog>
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
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  flexButton: {
    flex: 1,
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
  folderPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginHorizontal: 12,
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
    maxHeight: '85%',
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
  moveList: {
    maxHeight: 320,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
});

export default PropertyDocumentsScreen;
