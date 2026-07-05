import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { IconButton, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import type { MediaType } from '../../types';

export interface GridItem {
  id: string;
  url: string;
  type: MediaType;
  fileName?: string;
}

interface Props {
  items: GridItem[];
  onPressItem: (index: number) => void;
  /** When provided, a delete button is shown on each thumbnail. */
  onDeleteItem?: (item: GridItem) => void;
  columns?: number;
}

/**
 * Responsive grid of media thumbnails. Images render directly; videos render
 * the thumbnail (poster falls back to a dark tile) with a play overlay.
 * Shared by the property gallery and maintenance attachments views.
 */
export const MediaGrid: React.FC<Props> = ({
  items,
  onPressItem,
  onDeleteItem,
  columns = 3,
}) => {
  const theme = useTheme();
  const widthPct = `${100 / columns}%` as const;

  return (
    <View style={styles.grid}>
      {items.map((item, index) => (
        <View key={item.id} style={[styles.cell, { width: widthPct }]}>
          <Pressable
            style={[styles.thumb, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={() => onPressItem(index)}
            accessibilityRole="imagebutton"
            accessibilityLabel={item.fileName || item.type}
          >
            <Image
              source={{ uri: item.url }}
              style={styles.image}
              contentFit="cover"
              transition={150}
            />
            {item.type === 'VIDEO' && (
              <View style={styles.videoOverlay}>
                <Icon name="play-circle" size={36} color="#fff" />
              </View>
            )}
            {onDeleteItem && (
              <IconButton
                icon="close-circle"
                size={20}
                iconColor="#fff"
                containerColor="rgba(0,0,0,0.45)"
                style={styles.deleteBtn}
                onPress={() => onDeleteItem(item)}
                accessibilityLabel="Delete"
              />
            )}
          </Pressable>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    padding: 4,
  },
  thumb: {
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  deleteBtn: {
    position: 'absolute',
    top: -2,
    right: -2,
    margin: 0,
  },
});

export default MediaGrid;
