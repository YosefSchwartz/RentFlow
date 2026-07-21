import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
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

type PreviewKind = 'image' | 'pdf' | 'office' | 'other';

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'];
// Office/text types the Google Docs viewer can render inline.
const OFFICE_EXT = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];

/** Decide how to render a document from its mime type (with a name fallback). */
const resolveKind = (mimeType?: string | null, name?: string): PreviewKind => {
  const mime = (mimeType || '').toLowerCase();
  const ext = name?.split('.').pop()?.toLowerCase();

  if (mime.startsWith('image/') || (ext && IMAGE_EXT.includes(ext)))
    return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime === 'text/plain' ||
    mime === 'text/csv' ||
    (ext && OFFICE_EXT.includes(ext))
  )
    return 'office';
  return 'other';
};

/** Wrap a file URL in the Google Docs viewer so WebView can render it inline. */
const gviewUrl = (url: string): string =>
  `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;

/**
 * Source URI for the WebView.
 * - PDF on iOS: load the file directly — WKWebView renders PDFs natively and
 *   reliably (no dependency on Google being able to reach the file).
 * - PDF on Android and all Office files: use the Google Docs viewer, since the
 *   platform WebView can't render them on its own.
 */
const webviewUri = (url: string, kind: PreviewKind): string => {
  if (kind === 'pdf' && Platform.OS === 'ios') return url;
  return gviewUrl(url);
};

interface Props {
  document: Document | null;
  visible: boolean;
  onDismiss: () => void;
  onError?: (message: string) => void;
}

/**
 * Full-screen in-app preview. Images render via expo-image; PDFs render inline
 * (native WebView on iOS, Google viewer on Android); Office files use the
 * Google viewer. Anything unsupported — or a viewer that fails to load — falls
 * back to "open externally". Layout is RTL-safe (no hardcoded left/right).
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
  const [viewerFailed, setViewerFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (visible && document) {
      setLoading(true);
      setUrl(null);
      setViewerFailed(false);
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
  const canRenderInline = kind === 'image' || kind === 'pdf' || kind === 'office';

  const handleOpenExternally = async () => {
    if (!url) return;
    try {
      await downloadAndShare(url, document?.name, mimeType ?? undefined);
    } catch {
      onError?.(t('documents.preview.error'));
    }
  };

  const renderBody = () => {
    if (loading || !url) {
      return <ActivityIndicator size="large" color={theme.colors.primary} />;
    }
    if (kind === 'image') {
      return (
        <Image
          source={{ uri: url }}
          style={styles.image}
          contentFit="contain"
          transition={150}
        />
      );
    }
    if ((kind === 'pdf' || kind === 'office') && !viewerFailed) {
      return (
        <WebView
          source={{ uri: webviewUri(url, kind) }}
          style={styles.webview}
          originWhitelist={['*']}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webviewLoading}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          )}
          onError={() => setViewerFailed(true)}
          onHttpError={() => setViewerFailed(true)}
        />
      );
    }
    // Unsupported type, or the inline viewer could not load the file.
    return (
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
    );
  };

  // Footer external-open shortcut, shown only while an inline preview is up.
  const showFooterButton =
    !loading && !!url && canRenderInline && !viewerFailed;

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
          <IconButton
            icon="close"
            onPress={onDismiss}
            accessibilityLabel={t('common.close')}
          />
        </View>

        <View style={styles.body}>{renderBody()}</View>

        {showFooterButton && (
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
    backgroundColor: 'transparent',
  },
  webviewLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
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
