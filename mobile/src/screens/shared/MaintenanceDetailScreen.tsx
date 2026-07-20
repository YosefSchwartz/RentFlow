import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Text,
  useTheme,
  ActivityIndicator,
  Chip,
  TextInput,
  IconButton,
  Button,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  useMaintenanceRequest,
  useMaintenanceComments,
  useAddMaintenanceComment,
  useUpdateMaintenanceStatus,
  useMaintenanceAttachments,
  useUploadMaintenanceAttachment,
  useMaintenanceReceipts,
  useUploadMaintenanceReceipt,
  useMarkConversationRead,
} from '../../hooks/useMaintenance';
import { useAuth } from '../../store';
import { MediaGrid, GridItem } from '../../components/media/MediaGrid';
import { MediaViewerModal, ViewerItem } from '../../components/media/MediaViewerModal';
import { MediaSourceSheet } from '../../components/media/MediaSourceSheet';
import { DocumentAttachmentRow } from '../../components/media/DocumentAttachmentRow';
import type { PickResult } from '../../components/media/mediaPicker';
import type {
  RentalsStackParamList,
  MaintenanceStatus,
  MaintenanceComment,
  MaintenanceAttachment,
} from '../../types';

type DetailRoute = RouteProp<RentalsStackParamList, 'MaintenanceDetail'>;

// The next status in the open -> in progress -> resolved workflow.
const NEXT_STATUS: Partial<Record<MaintenanceStatus, MaintenanceStatus>> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'RESOLVED',
};

const MaintenanceDetailScreen: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const route = useRoute<DetailRoute>();
  const { requestId } = route.params;

  const { data: request, isLoading: requestLoading } = useMaintenanceRequest(requestId);
  const {
    data: comments,
    isLoading: commentsLoading,
    refetch: refetchComments,
  } = useMaintenanceComments(requestId);
  const { user: currentUser } = useAuth();
  const { data: attachments } = useMaintenanceAttachments(requestId);
  const { data: receipts } = useMaintenanceReceipts(requestId);
  const addComment = useAddMaintenanceComment(requestId);
  const updateStatus = useUpdateMaintenanceStatus();
  const uploadAttachment = useUploadMaintenanceAttachment();
  const uploadReceipt = useUploadMaintenanceReceipt();
  const markRead = useMarkConversationRead();

  const [message, setMessage] = useState('');
  const [viewerItem, setViewerItem] = useState<ViewerItem | null>(null);
  const [attachSheetVisible, setAttachSheetVisible] = useState(false);
  const [receiptSheetVisible, setReceiptSheetVisible] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<MaintenanceAttachment | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);

  const attachmentItems: GridItem[] = (attachments || []).map((a) => ({
    id: a.id,
    url: a.url,
    type: a.type,
    fileName: a.fileName,
  }));

  // Keep the thread fresh when returning to the screen (e.g. after a
  // notification) and mark the conversation read (clears its notifications and
  // resets the "recently active" window that suppresses comment alerts).
  useFocusEffect(
    useCallback(() => {
      refetchComments();
      markRead.mutate(requestId);
      // markRead.mutate is stable; intentionally excluded from deps.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestId, refetchComments]),
  );

  // The requester is the tenant; anyone else viewing (the property owner) may
  // advance the status. Permission is enforced again on the backend.
  const amOwner =
    !!currentUser && !!request && request.requesterId !== currentUser.id;

  const getStatusColor = (status: MaintenanceStatus) => {
    switch (status) {
      case 'OPEN':
        return theme.colors.tertiary;
      case 'IN_PROGRESS':
        return theme.colors.primary;
      case 'RESOLVED':
        return theme.colors.secondary;
      default:
        return theme.colors.outline;
    }
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed && !pendingAttachment) return;
    setMessage('');
    try {
      await addComment.mutateAsync({
        body: trimmed || undefined,
        attachmentId: pendingAttachment?.id,
      });
      setPendingAttachment(null);
    } catch {
      setMessage(trimmed); // restore on failure (the attachment stays uploaded, ready to retry)
    }
  };

  const handleAdvanceStatus = async () => {
    if (!request) return;
    const next = NEXT_STATUS[request.status];
    if (!next) return;
    await updateStatus.mutateAsync({ requestId, status: next });
  };

  const handleReopen = async () => {
    await updateStatus.mutateAsync({ requestId, status: 'IN_PROGRESS' });
  };

  const handlePickAttachment = async (result: PickResult) => {
    if (result.canceled || result.denied || result.files.length === 0) return;
    setIsAttaching(true);
    try {
      const uploaded = await uploadAttachment.mutateAsync({
        requestId,
        file: result.files[0],
      });
      setPendingAttachment(uploaded);
    } finally {
      setIsAttaching(false);
    }
  };

  const handlePickReceipt = async (result: PickResult) => {
    if (result.canceled || result.denied || result.files.length === 0) return;
    const file = result.files[0];
    await uploadReceipt.mutateAsync({ requestId, file, name: file.name });
  };

  if (requestLoading || !request) {
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const nextStatus = NEXT_STATUS[request.status];

  const renderComment = (comment: MaintenanceComment) => {
    const mine = comment.authorId === currentUser?.id;
    const authorName = comment.author
      ? `${comment.author.firstName} ${comment.author.lastName}`
      : '';
    const attachment = comment.attachment;
    return (
      <View
        key={comment.id}
        style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
      >
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: mine
                ? theme.colors.primaryContainer
                : theme.colors.surfaceVariant,
            },
          ]}
        >
          {!mine && (
            <Text variant="labelSmall" style={styles.bubbleAuthor}>
              {authorName}
            </Text>
          )}
          {comment.body && <Text variant="bodyMedium">{comment.body}</Text>}
          {attachment && attachment.type === 'IMAGE' && (
            <Pressable
              onPress={() =>
                setViewerItem({ url: attachment.url, type: attachment.type, fileName: attachment.fileName })
              }
              style={styles.bubbleImageWrap}
            >
              <Image source={{ uri: attachment.url }} style={styles.bubbleImage} contentFit="cover" />
            </Pressable>
          )}
          {attachment && attachment.type !== 'IMAGE' && (
            <DocumentAttachmentRow
              fileName={attachment.fileName}
              url={attachment.url}
              mimeType={attachment.mimeType}
            />
          )}
          <Text variant="labelSmall" style={styles.bubbleTime}>
            {new Date(comment.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Request header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text variant="titleLarge" style={styles.title}>
                {request.title}
              </Text>
              <Chip
                compact
                style={{ backgroundColor: getStatusColor(request.status) + '20' }}
                textStyle={{ color: getStatusColor(request.status) }}
              >
                {t(`maintenance.statuses.${request.status}`)}
              </Chip>
            </View>
            <Text variant="bodyMedium" style={styles.description}>
              {request.description}
            </Text>
            {request.requester && (
              <Text variant="labelSmall" style={styles.meta}>
                {t('maintenance.detail.reportedBy', {
                  name: `${request.requester.firstName} ${request.requester.lastName}`,
                })}
              </Text>
            )}

            {/* Status control - landlord only */}
            {amOwner && nextStatus && (
              <Button
                mode="contained-tonal"
                style={styles.statusButton}
                onPress={handleAdvanceStatus}
                loading={updateStatus.isPending}
                disabled={updateStatus.isPending}
              >
                {nextStatus === 'IN_PROGRESS'
                  ? t('maintenance.actions.start')
                  : t('maintenance.actions.complete')}
              </Button>
            )}
            {amOwner && request.status === 'RESOLVED' && (
              <Button
                mode="outlined"
                icon="restart"
                style={styles.statusButton}
                onPress={handleReopen}
                loading={updateStatus.isPending}
                disabled={updateStatus.isPending}
              >
                {t('maintenance.actions.reopen')}
              </Button>
            )}
          </View>

          {/* Attachments (evidence) — visible to both landlord and tenant */}
          {attachmentItems.length > 0 && (
            <View style={styles.attachmentsSection}>
              <Text variant="titleMedium" style={styles.attachmentsTitle}>
                {t('maintenanceAttachments.title')}
              </Text>
              <MediaGrid
                items={attachmentItems}
                onPressItem={(index) => setViewerItem(attachmentItems[index])}
              />
            </View>
          )}

          {/* Receipts — only once the request is completed; both parties may add */}
          {request.status === 'RESOLVED' && (
            <View style={styles.receiptsSection}>
              <View style={styles.receiptsHeader}>
                <Text variant="titleMedium" style={styles.attachmentsTitle}>
                  {t('maintenance.receipts.title')}
                </Text>
                <Button
                  compact
                  icon="receipt"
                  onPress={() => setReceiptSheetVisible(true)}
                  loading={uploadReceipt.isPending}
                  disabled={uploadReceipt.isPending}
                >
                  {t('maintenance.receipts.add')}
                </Button>
              </View>
              {receipts && receipts.length > 0 ? (
                <View style={styles.receiptsList}>
                  {receipts.map((r) => (
                    <DocumentAttachmentRow
                      key={r.id}
                      fileName={r.name}
                      url={r.fileUrl || ''}
                      mimeType={r.mimeType || undefined}
                      right={
                        <Chip compact style={{ backgroundColor: theme.colors.tertiaryContainer }}>
                          {t('maintenance.receipts.badge')}
                        </Chip>
                      }
                    />
                  ))}
                </View>
              ) : (
                <Text variant="bodySmall" style={styles.emptyComments}>
                  {t('maintenance.receipts.empty')}
                </Text>
              )}
            </View>
          )}

          <Divider />

          {/* Conversation */}
          <Text variant="titleMedium" style={styles.conversationTitle}>
            {t('maintenance.detail.conversation')}
          </Text>

          {commentsLoading ? (
            <ActivityIndicator style={styles.commentsLoader} color={theme.colors.primary} />
          ) : comments && comments.length > 0 ? (
            comments.map(renderComment)
          ) : (
            <Text variant="bodySmall" style={styles.emptyComments}>
              {t('maintenance.detail.noComments')}
            </Text>
          )}
        </ScrollView>

        {/* Pending attachment preview — cleared on send or removed manually */}
        {pendingAttachment && (
          <View style={[styles.pendingRow, { borderTopColor: theme.colors.outlineVariant }]}>
            {pendingAttachment.type === 'IMAGE' ? (
              <Image source={{ uri: pendingAttachment.url }} style={styles.pendingThumb} contentFit="cover" />
            ) : (
              <View style={styles.pendingDocIcon}>
                <DocumentAttachmentRow
                  fileName={pendingAttachment.fileName}
                  url={pendingAttachment.url}
                  mimeType={pendingAttachment.mimeType}
                />
              </View>
            )}
            <IconButton icon="close" size={18} onPress={() => setPendingAttachment(null)} />
          </View>
        )}

        {/* Composer */}
        <View style={[styles.composer, { borderTopColor: theme.colors.outlineVariant }]}>
          <IconButton
            icon="paperclip"
            disabled={isAttaching || !!pendingAttachment}
            loading={isAttaching}
            onPress={() => setAttachSheetVisible(true)}
          />
          <TextInput
            mode="outlined"
            style={styles.input}
            placeholder={t('maintenance.detail.messagePlaceholder')}
            value={message}
            onChangeText={setMessage}
            multiline
            dense
          />
          <IconButton
            icon="send"
            mode="contained"
            disabled={(!message.trim() && !pendingAttachment) || addComment.isPending}
            loading={addComment.isPending}
            onPress={handleSend}
          />
        </View>
      </KeyboardAvoidingView>

      <MediaViewerModal
        visible={!!viewerItem}
        item={viewerItem}
        onClose={() => setViewerItem(null)}
      />

      <MediaSourceSheet
        visible={attachSheetVisible}
        onDismiss={() => setAttachSheetVisible(false)}
        onResult={handlePickAttachment}
        allowMultiple={false}
        allowDocuments
      />

      <MediaSourceSheet
        visible={receiptSheetVisible}
        onDismiss={() => setReceiptSheetVisible(false)}
        onResult={handlePickReceipt}
        allowMultiple={false}
        allowDocuments
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },
  header: { marginBottom: 12 },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: { flex: 1, fontWeight: '600' },
  description: { marginTop: 8, opacity: 0.8 },
  meta: { marginTop: 8, opacity: 0.6 },
  statusButton: { marginTop: 16, alignSelf: 'flex-start' },
  attachmentsSection: { marginBottom: 12 },
  attachmentsTitle: { marginBottom: 8, fontWeight: '600' },
  conversationTitle: { marginTop: 16, marginBottom: 12, fontWeight: '600' },
  commentsLoader: { marginTop: 24 },
  emptyComments: { opacity: 0.6, textAlign: 'center', marginTop: 24 },
  bubbleRow: { marginBottom: 10, flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 14, padding: 10 },
  bubbleAuthor: { marginBottom: 2, opacity: 0.7 },
  bubbleTime: { marginTop: 4, opacity: 0.5 },
  bubbleImageWrap: { marginTop: 6, borderRadius: 10, overflow: 'hidden' },
  bubbleImage: { width: 180, height: 180 },
  receiptsSection: { marginBottom: 12 },
  receiptsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptsList: { gap: 8, marginTop: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  input: { flex: 1, maxHeight: 120 },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pendingThumb: { width: 48, height: 48, borderRadius: 8 },
  pendingDocIcon: { flex: 1 },
});

export default MaintenanceDetailScreen;
