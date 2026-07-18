import React from 'react';
import { StyleSheet } from 'react-native';
import { Text, Button, useTheme, Portal, Modal } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { takePhoto, pickFromLibrary, PickResult } from './media/mediaPicker';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** Called with the picker outcome (after the sheet closes). */
  onResult: (result: PickResult) => void;
}

/**
 * Single-select photo source sheet for avatars. A sibling of MediaSourceSheet
 * (not an extension of it) — that component is scoped/typed for
 * property/maintenance multi-select and video, neither of which applies to a
 * single profile photo. Reuses the same underlying takePhoto()/
 * pickFromLibrary() picking mechanics from mediaPicker.ts.
 */
export const AvatarSourceSheet: React.FC<Props> = ({ visible, onDismiss, onResult }) => {
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
          {t('profile.editProfile.changePhoto')}
        </Text>
        <Button
          icon="camera"
          mode="contained-tonal"
          style={styles.button}
          onPress={() => run(takePhoto)}
        >
          {t('profile.editProfile.takePhoto')}
        </Button>
        <Button
          icon="image-multiple"
          mode="contained-tonal"
          style={styles.button}
          onPress={() => run(() => pickFromLibrary(false, 1))}
        >
          {t('profile.editProfile.chooseFromLibrary')}
        </Button>
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

export default AvatarSourceSheet;
