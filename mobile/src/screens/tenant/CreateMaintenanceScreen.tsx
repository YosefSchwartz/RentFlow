import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, useTheme, SegmentedButtons } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  useCreateMaintenanceRequest,
  useUploadMaintenanceAttachment,
} from '../../hooks/useMaintenance';
import type {
  RentalsStackParamList,
  MaintenancePriority,
  LocalMediaFile,
} from '../../types';
import { MediaSourceSheet } from '../../components/media/MediaSourceSheet';
import { MediaGrid, GridItem } from '../../components/media/MediaGrid';
import { MediaViewerModal } from '../../components/media/MediaViewerModal';
import KeyboardAwareScrollView from '../../components/KeyboardAwareScrollView';
import type { PickResult } from '../../components/media/mediaPicker';

const MAX_ATTACHMENTS = 20;

type RouteType = RouteProp<RentalsStackParamList, 'CreateMaintenanceRequest'>;
type NavigationProp = NativeStackNavigationProp<RentalsStackParamList>;

// Map priority strings to backend integer values
const priorityToNumber: Record<MaintenancePriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

const CreateMaintenanceScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { propertyId } = route.params;
  const createRequest = useCreateMaintenanceRequest();
  const uploadAttachment = useUploadMaintenanceAttachment();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MaintenancePriority>('MEDIUM');
  const [attachments, setAttachments] = useState<LocalMediaFile[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const attachmentItems: GridItem[] = attachments.map((file, index) => ({
    id: `${file.uri}-${index}`,
    url: file.uri,
    type: file.mediaType,
    fileName: file.name,
  }));

  const handlePicked = (result: PickResult) => {
    if (result.denied) {
      setError(t('gallery.permissionDenied'));
      return;
    }
    if (result.canceled || result.files.length === 0) return;

    setError(null);
    setAttachments((prev) => {
      const next = [...prev, ...result.files];
      return next.slice(0, MAX_ATTACHMENTS);
    });
  };

  const removeAttachment = (item: GridItem) => {
    setAttachments((prev) => prev.filter((_, i) => `${prev[i].uri}-${i}` !== item.id));
  };

  const submitting = createRequest.isPending || uploadAttachment.isPending;

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) {
      setError(t('maintenance.errors.fillRequired'));
      return;
    }

    if (title.length > 200) {
      setError(t('maintenance.errors.titleMaxLength'));
      return;
    }

    if (description.length > 2000) {
      setError(t('maintenance.errors.descriptionMaxLength'));
      return;
    }

    setError(null);

    try {
      const request = await createRequest.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        priority: priorityToNumber[priority],
        propertyId,
      });

      // Upload attachments after the request exists. A failed upload should
      // not discard the created request — surface it but still navigate back.
      for (const file of attachments) {
        try {
          await uploadAttachment.mutateAsync({ requestId: request.id, file });
        } catch (uploadErr) {
          console.error('Failed to upload attachment', uploadErr);
        }
      }

      navigation.goBack();
    } catch (err: any) {
      setError(err.response?.data?.message || t('maintenance.errors.createFailed'));
    }
  };

  return (
    <>
      <KeyboardAwareScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.form}>
          <TextInput
            label={`${t('maintenance.requestTitle')} *`}
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
            placeholder={t('maintenance.placeholders.title')}
            maxLength={200}
          />

          <TextInput
            label={`${t('maintenance.description')} *`}
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={4}
            placeholder={t('maintenance.placeholders.description')}
            maxLength={2000}
          />

          <View style={styles.prioritySection}>
            <Text variant="labelLarge" style={styles.priorityLabel}>
              {t('maintenance.priority')}
            </Text>
            <SegmentedButtons
              value={priority}
              onValueChange={(value) => setPriority(value as MaintenancePriority)}
              buttons={[
                { value: 'LOW', label: t('maintenance.priorityLevels.LOW') },
                { value: 'MEDIUM', label: t('maintenance.priorityLevels.MEDIUM') },
                { value: 'HIGH', label: t('maintenance.priorityLevels.HIGH') },
                { value: 'URGENT', label: t('maintenance.priorityLevels.URGENT') },
              ]}
              style={styles.priorityButtons}
            />
            <Text variant="bodySmall" style={styles.priorityHint}>
              {t(`maintenance.priorityHints.${priority}`)}
            </Text>
          </View>

          {/* Attachments (photos / videos as evidence) */}
          <View style={styles.attachmentsSection}>
            <Text variant="labelLarge" style={styles.attachmentsLabel}>
              {t('maintenanceAttachments.title')}
            </Text>
            <Button
              mode="outlined"
              icon="paperclip"
              onPress={() => setSheetVisible(true)}
              disabled={attachments.length >= MAX_ATTACHMENTS || submitting}
              style={styles.attachButton}
            >
              {t('maintenanceAttachments.add')}
            </Button>
            {attachments.length > 0 && (
              <>
                <Text variant="bodySmall" style={styles.attachmentsCount}>
                  {t('maintenanceAttachments.count', {
                    count: attachments.length,
                    max: MAX_ATTACHMENTS,
                  })}
                </Text>
                <MediaGrid
                  items={attachmentItems}
                  onPressItem={(index) => setViewerIndex(index)}
                  onDeleteItem={removeAttachment}
                />
              </>
            )}
          </View>

          {error && (
            <Text style={[styles.error, { color: theme.colors.error }]}>
              {error}
            </Text>
          )}

          <Button
            mode="contained"
            onPress={handleCreate}
            loading={submitting}
            disabled={submitting}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {t('maintenance.submitRequest')}
          </Button>
        </View>
      </KeyboardAwareScrollView>

      <MediaSourceSheet
        visible={sheetVisible}
        onDismiss={() => setSheetVisible(false)}
        onResult={handlePicked}
      />

      <MediaViewerModal
        visible={viewerIndex !== null}
        item={viewerIndex !== null ? attachmentItems[viewerIndex] ?? null : null}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  form: {
    flex: 1,
  },
  input: {
    marginBottom: 16,
  },
  prioritySection: {
    marginBottom: 24,
  },
  priorityLabel: {
    marginBottom: 12,
  },
  priorityButtons: {
    marginBottom: 8,
  },
  priorityHint: {
    opacity: 0.7,
    textAlign: 'center',
  },
  attachmentsSection: {
    marginBottom: 24,
  },
  attachmentsLabel: {
    marginBottom: 12,
  },
  attachButton: {
    marginBottom: 8,
  },
  attachmentsCount: {
    opacity: 0.6,
    marginBottom: 8,
  },
  error: {
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});

export default CreateMaintenanceScreen;
