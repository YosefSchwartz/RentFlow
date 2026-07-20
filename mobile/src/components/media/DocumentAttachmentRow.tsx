import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { downloadAndShare } from '../../lib/files';

interface Props {
  fileName: string;
  url: string;
  mimeType?: string;
  /** Optional trailing element, e.g. a "Receipt" chip. */
  right?: React.ReactNode;
}

// Icon + color by extension — same mapping used for the Documents screens.
const getIconName = (fileName: string): React.ComponentProps<typeof Icon>['name'] => {
  switch (fileName.split('.').pop()?.toLowerCase()) {
    case 'pdf':
      return 'file-pdf-box';
    case 'doc':
    case 'docx':
      return 'file-word';
    case 'xls':
    case 'xlsx':
    case 'csv':
      return 'file-excel';
    default:
      return 'file-document';
  }
};

const getIconColor = (fileName: string, fallback: string): string => {
  switch (fileName.split('.').pop()?.toLowerCase()) {
    case 'pdf':
      return '#E53935';
    case 'doc':
    case 'docx':
      return '#1976D2';
    case 'xls':
    case 'xlsx':
    case 'csv':
      return '#388E3C';
    default:
      return fallback;
  }
};

/** Icon + filename row for a non-image document attachment. Tap downloads/opens it. */
export const DocumentAttachmentRow: React.FC<Props> = ({ fileName, url, mimeType, right }) => {
  const theme = useTheme();

  const handlePress = () => {
    downloadAndShare(url, fileName, mimeType).catch(() => {
      // Silently ignored — this mirrors the existing Documents screens'
      // best-effort download behavior (no dedicated error UI for this action).
    });
  };

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: theme.colors.surfaceVariant }]}
      onPress={handlePress}
    >
      <Icon name={getIconName(fileName)} size={22} color={getIconColor(fileName, theme.colors.primary)} />
      <Text variant="bodyMedium" style={styles.name} numberOfLines={1}>
        {fileName}
      </Text>
      {right}
      <Icon name="download" size={18} color={theme.colors.onSurfaceVariant} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  name: {
    flex: 1,
  },
});
