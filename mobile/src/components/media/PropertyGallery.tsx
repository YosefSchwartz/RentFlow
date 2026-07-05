import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Text,
  Button,
  useTheme,
  ActivityIndicator,
  Portal,
  Dialog,
  Snackbar,
} from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  usePropertyMedia,
  useUploadPropertyMedia,
  useDeletePropertyMedia,
} from '../../hooks/usePropertyMedia';
import type { PropertyMedia } from '../../types';
import { MediaGrid, GridItem } from './MediaGrid';
import { MediaViewerModal } from './MediaViewerModal';
import { MediaSourceSheet } from './MediaSourceSheet';
import { PickResult } from './mediaPicker';

const MAX_MEDIA = 100;

interface Props {
  propertyId: string;
  /** Owners can upload/delete; tenants view only. */
  canManage: boolean;
}

type Snack = { visible: boolean; message: string; error: boolean };

/**
 * Property gallery: grid of photos/videos with full-screen preview and
 * (for owners) upload + delete. Composes the shared media components.
 */
export const PropertyGallery: React.FC<Props> = ({ propertyId, canManage }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const { data: media, isLoading } = usePropertyMedia(propertyId);
  const uploadMedia = useUploadPropertyMedia();
  const deleteMedia = useDeletePropertyMedia();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PropertyMedia | null>(null);
  const [snack, setSnack] = useState<Snack>({ visible: false, message: '', error: false });

  const items: GridItem[] = (media || []).map((m) => ({
    id: m.id,
    url: m.url,
    type: m.type,
    fileName: m.fileName,
  }));

  const showSnack = (message: string, error = false) =>
    setSnack({ visible: true, message, error });

  const handlePicked = async (result: PickResult) => {
    if (result.denied) {
      showSnack(t('gallery.permissionDenied'), true);
      return;
    }
    if (result.canceled || result.files.length === 0) return;

    const remaining = MAX_MEDIA - (media?.length || 0);
    if (remaining <= 0) {
      showSnack(t('gallery.limitReached', { max: MAX_MEDIA }), true);
      return;
    }
    const files = result.files.slice(0, remaining);
    if (files.length < result.files.length) {
      showSnack(t('gallery.limitReached', { max: MAX_MEDIA }), true);
    }

    let failed = 0;
    for (const file of files) {
      try {
        await uploadMedia.mutateAsync({ propertyId, file });
      } catch (err: any) {
        failed += 1;
        const message = err?.response?.data?.message;
        showSnack(
          Array.isArray(message) ? message[0] : message || t('gallery.uploadError'),
          true,
        );
      }
    }
    if (failed === 0) showSnack(t('gallery.uploadSuccess'));
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteMedia.mutateAsync({ mediaId: target.id, propertyId });
      showSnack(t('gallery.deleted'));
    } catch {
      showSnack(t('gallery.deleteError'), true);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  const count = media?.length || 0;
  const uploading = uploadMedia.isPending;

  return (
    <View>
      {canManage && (
        <Button
          mode="contained"
          icon="camera-plus"
          onPress={() => setSheetVisible(true)}
          loading={uploading}
          disabled={uploading}
          style={styles.addButton}
        >
          {t('gallery.addMedia')}
        </Button>
      )}

      {count > 0 ? (
        <>
          {canManage && (
            <Text variant="bodySmall" style={styles.count}>
              {t('gallery.count', { count, max: MAX_MEDIA })}
            </Text>
          )}
          <MediaGrid
            items={items}
            onPressItem={(index) => setViewerIndex(index)}
            onDeleteItem={
              canManage
                ? (item) =>
                    setPendingDelete(media?.find((m) => m.id === item.id) || null)
                : undefined
            }
          />
        </>
      ) : (
        <View style={styles.empty}>
          <Icon name="image-multiple-outline" size={48} color={theme.colors.outline} />
          <Text variant="bodyMedium" style={styles.emptyText}>
            {canManage ? t('gallery.noMediaOwner') : t('gallery.noMediaTenant')}
          </Text>
        </View>
      )}

      {/* Full-screen viewer */}
      <MediaViewerModal
        visible={viewerIndex !== null}
        item={viewerIndex !== null ? items[viewerIndex] ?? null : null}
        onClose={() => setViewerIndex(null)}
      />

      {/* Upload source action sheet */}
      <MediaSourceSheet
        visible={sheetVisible}
        onDismiss={() => setSheetVisible(false)}
        onResult={handlePicked}
      />

      <Portal>
        {/* Delete confirmation */}
        <Dialog
          visible={!!pendingDelete}
          onDismiss={() => setPendingDelete(null)}
        >
          <Dialog.Title>{t('gallery.deleteConfirmTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('gallery.deleteConfirmMessage')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onPress={confirmDelete}
              textColor={theme.colors.error}
              loading={deleteMedia.isPending}
            >
              {t('common.delete')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack({ ...snack, visible: false })}
        duration={3000}
        style={snack.error ? { backgroundColor: theme.colors.error } : undefined}
      >
        {snack.message}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  loading: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  addButton: {
    marginBottom: 12,
  },
  count: {
    opacity: 0.6,
    marginBottom: 8,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    opacity: 0.7,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default PropertyGallery;
