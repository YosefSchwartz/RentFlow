import React from 'react';
import { StyleSheet } from 'react-native';
import { Text, Button, useTheme, Portal, Modal } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { takePhoto, recordVideo, pickFromLibrary, pickDocument, PickResult } from './mediaPicker';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** Called with the picker outcome (after the sheet closes). */
  onResult: (result: PickResult) => void;
  /** Allow selecting multiple items from the library. Default true. */
  allowMultiple?: boolean;
  /** Also offer a "Choose Document" (PDF/Word/Excel/CSV) action. Default false. */
  allowDocuments?: boolean;
}

/**
 * Bottom-sheet action menu offering the three upload sources required by the
 * spec: Take Photo, Record Video, Choose from Gallery. Shared by the property
 * gallery and the maintenance attachments flow.
 */
export const MediaSourceSheet: React.FC<Props> = ({
  visible,
  onDismiss,
  onResult,
  allowMultiple = true,
  allowDocuments = false,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const run = async (picker: () => Promise<PickResult>) => {
    onDismiss();
    const result = await picker();
    onResult(result);
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        style={styles.wrapper}
        contentContainerStyle={[styles.sheet, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleMedium" style={styles.title}>
          {t('gallery.addMedia')}
        </Text>
        <Button
          icon="camera"
          mode="contained-tonal"
          style={styles.button}
          onPress={() => run(takePhoto)}
        >
          {t('gallery.takePhoto')}
        </Button>
        <Button
          icon="video"
          mode="contained-tonal"
          style={styles.button}
          onPress={() => run(recordVideo)}
        >
          {t('gallery.recordVideo')}
        </Button>
        <Button
          icon="image-multiple"
          mode="contained-tonal"
          style={styles.button}
          onPress={() => run(() => pickFromLibrary(allowMultiple))}
        >
          {t('gallery.chooseFromGallery')}
        </Button>
        {allowDocuments && (
          <Button
            icon="file-document"
            mode="contained-tonal"
            style={styles.button}
            onPress={() => run(pickDocument)}
          >
            {t('gallery.chooseDocument')}
          </Button>
        )}
        <Button onPress={onDismiss} style={styles.button}>
          {t('common.cancel')}
        </Button>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'flex-end',
  },
  sheet: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
  },
  title: {
    marginBottom: 12,
    fontWeight: '600',
  },
  button: {
    marginBottom: 8,
  },
});

export default MediaSourceSheet;
