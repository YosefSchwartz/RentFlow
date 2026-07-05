import React, { useEffect, useState } from 'react';
import { Modal, View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { MediaType } from '../../types';
import { downloadAndShare } from '../../lib/files';

export interface ViewerItem {
  url: string;
  type: MediaType;
  fileName?: string;
}

interface Props {
  visible: boolean;
  item: ViewerItem | null;
  onClose: () => void;
}

/**
 * Inner content rendered inside the modal's own SafeAreaProvider so that
 * useSafeAreaInsets resolves correctly (a RN Modal is a separate view tree;
 * without its own provider, insets are reported as zero on iOS and the close
 * control ends up under the notch / status bar and untappable).
 */
const ViewerContent: React.FC<{
  item: ViewerItem;
  isVideo: boolean;
  player: ReturnType<typeof useVideoPlayer>;
  onClose: () => void;
}> = ({ item, isVideo, player, onClose }) => {
  const insets = useSafeAreaInsets();
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await downloadAndShare(item.url, item.fileName);
    } catch {
      // Silently ignore (e.g. user dismissed the share sheet).
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.backdrop}>
      <StatusBar style="light" />

      {/* Media. Tapping an image dismisses; videos keep their controls. */}
      <View style={styles.content}>
        {isVideo ? (
          <VideoView
            player={player}
            style={styles.media}
            contentFit="contain"
            allowsFullscreen
            nativeControls
          />
        ) : (
          <Pressable style={styles.imagePress} onPress={onClose}>
            <Image
              source={{ uri: item.url }}
              style={styles.media}
              contentFit="contain"
              transition={150}
            />
          </Pressable>
        )}
      </View>

      {/* Filename caption */}
      {!!item.fileName && (
        <View style={[styles.caption, { bottom: insets.bottom + 16 }]}>
          <Text variant="bodySmall" style={styles.captionText} numberOfLines={1}>
            {item.fileName}
          </Text>
        </View>
      )}

      {/* Download / share button — leading edge */}
      <Pressable
        onPress={handleShare}
        disabled={sharing}
        hitSlop={16}
        style={({ pressed }) => [
          styles.actionButton,
          styles.shareButton,
          { top: insets.top + 12 },
          pressed && styles.actionButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Download"
      >
        {sharing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Icon name="download" size={24} color="#fff" />
        )}
      </Pressable>

      {/* Close button — circular, with generous hit area */}
      <Pressable
        onPress={onClose}
        hitSlop={16}
        style={({ pressed }) => [
          styles.actionButton,
          styles.closeButton,
          { top: insets.top + 12 },
          pressed && styles.actionButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Icon name="close" size={26} color="#fff" />
      </Pressable>
    </View>
  );
};

/**
 * Full-screen media viewer: image preview (expo-image) and video playback
 * (expo-video). Shared by the property gallery and maintenance attachments.
 */
export const MediaViewerModal: React.FC<Props> = ({ visible, item, onClose }) => {
  const isVideo = item?.type === 'VIDEO';

  // The hook must run unconditionally; pass null for images.
  const player = useVideoPlayer(isVideo ? item!.url : null, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (visible && isVideo) {
      player.play();
    } else {
      player.pause();
    }
  }, [visible, isVideo, player]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaProvider>
        {item && (
          <ViewerContent
            item={item}
            isVideo={isVideo}
            player={player}
            onClose={onClose}
          />
        )}
      </SafeAreaProvider>
    </Modal>
  );
};

const CLOSE_SIZE = 40;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePress: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  actionButton: {
    position: 'absolute',
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: CLOSE_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    end: 16,
  },
  shareButton: {
    start: 16,
  },
  actionButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  caption: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  captionText: {
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
});

export default MediaViewerModal;
