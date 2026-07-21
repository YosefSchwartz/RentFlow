import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import {
  Modal,
  Portal,
  Text,
  IconButton,
  Button,
  useTheme,
} from 'react-native-paper';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { usePreviewUrl } from '../../hooks/useDocuments';
import { downloadAndShare } from '../../lib/files';
import type { Document } from '../../types';

type PreviewKind = 'image' | 'pdf' | 'other';

/** Decide how to render a document from its mime type (with a name fallback). */
const resolveKind = (mimeType?: string | null, name?: string): PreviewKind => {
  const mime = (mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  // Fallback on extension when the mime type is missing/generic.
  const ext = name?.split('.').pop()?.toLowerCase();
  if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext))
    return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'other';
};

interface Props {
  document: Document | null;
  visible: boolean;
  onDismiss: () => void;
  onError?: (message: string) => void;
}

/**
 * Full-screen in-app preview. Images render via expo-image, PDFs via WebView,
 * and anything else offers "open externally" through the OS share sheet. Layout
 * is RTL-safe (no hardcoded left/right).
 */
const DocumentPreviewModal: React.FC<Props> = ({
  document,
  visible,
  onDismiss,
  onError,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const previewUrl = usePreviewUrl();
  const [url, setUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (visible && document) {
      setLoading(true);
      setUrl(null);
      previewUrl
        .mutateAsync(document.id)
        .then((res) => {
          if (cancelled) return;
          setUrl(res.url);
          setMimeType(res.mimeType);
        })
        .catch(() => {
          if (cancelled) return;
          onError?.(t('documents.preview.error'));
          onDismiss();
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, document?.id]);

  const kind = resolveKind(mimeType ?? document?.mimeType, document?.name);

  const handleOpenExternally = async () => {
    if (!url) return;
    try {
      await downloadAndShare(url, document?.name, mimeType ?? undefined);
    } catch {
      onError?.(t('documents.preview.error'));
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.container,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <View style={styles.header}>
          <Text variant="titleMedium" numberOfLines={1} style={styles.title}>
            {document?.name ?? ''}
          </Text>
          <IconButton icon="close" onPress={onDismiss} accessibilityLabel={t('common.close')} />
        </View>

        <View style={styles.body}>
          {loading || !url ? (
            <ActivityIndicator size="large" color={theme.colors.primary} />
          ) : kind === 'image' ? (
            <Image
              source={{ uri: url }}
              style={styles.image}
              contentFit="contain"
              transition={150}
            />
          ) : kind === 'pdf' ? (
            <WebView
              source={{ uri: url }}
              style={styles.webview}
              originWhitelist={['*']}
              startInLoadingState
            />
          ) : (
            <View style={styles.fallback}>
              <Text variant="bodyMedium" style={styles.fallbackText}>
                {t('documents.preview.cannotPreview')}
              </Text>
              <Button
                mode="contained"
                icon="open-in-new"
                onPress={handleOpenExternally}
              >
                {t('documents.preview.openExternally')}
              </Button>
            </View>
          )}
        </View>

        {/* Always allow opening externally for previewable types too. */}
        {!loading && url && kind !== 'other' && (
          <Button
            mode="text"
            icon="open-in-new"
            onPress={handleOpenExternally}
            style={styles.externalButton}
          >
            {t('documents.preview.openExternally')}
          </Button>
        )}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 0,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    flex: 1,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  webview: {
    flex: 1,
    width: '100%',
  },
  fallback: {
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  fallbackText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  externalButton: {
    marginVertical: 8,
  },
});

export default DocumentPreviewModal;
