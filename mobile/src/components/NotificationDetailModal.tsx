import React from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import {
  Text,
  useTheme,
  Button,
  Surface,
  IconButton,
} from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../utils';
import { getNotificationTarget } from '../utils/notificationNavigation';
import type { Notification, NotificationType } from '../types';

interface NotificationDetailModalProps {
  notification: Notification | null;
  visible: boolean;
  onDismiss: () => void;
  onMarkAsRead?: (id: string) => void;
  // Navigate to the screen the notification refers to (e.g. a lease or request).
  onNavigate?: (notification: Notification) => void;
}

const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  notification,
  visible,
  onDismiss,
  onMarkAsRead,
  onNavigate,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  if (!notification) return null;

  const getNotificationIcon = (type: NotificationType): string => {
    switch (type) {
      case 'LEASE_PENDING':
        return 'account-clock';
      case 'LEASE_APPROVED':
        return 'file-document-check';
      case 'LEASE_REJECTED':
        return 'file-document-remove';
      case 'MAINTENANCE_CREATED':
        return 'wrench';
      case 'MAINTENANCE_UPDATED':
        return 'progress-wrench';
      case 'MAINTENANCE_RESOLVED':
        return 'check-circle';
      case 'DOCUMENT_UPLOADED':
        return 'file-upload';
      default:
        return 'bell';
    }
  };

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case 'LEASE_PENDING':
        return theme.colors.tertiary;
      case 'LEASE_APPROVED':
        return theme.colors.secondary;
      case 'LEASE_REJECTED':
        return theme.colors.error;
      case 'MAINTENANCE_CREATED':
      case 'MAINTENANCE_UPDATED':
        return theme.colors.primary;
      case 'MAINTENANCE_RESOLVED':
        return theme.colors.secondary;
      case 'DOCUMENT_UPLOADED':
        return theme.colors.primary;
      default:
        return theme.colors.outline;
    }
  };

  // Exact date + HH:MM (no seconds).
  const formatDate = (dateString: string) => formatDateTime(dateString);

  const iconColor = getNotificationColor(notification.type);

  const handleMarkAsRead = () => {
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    onDismiss();
  };

  // Only offer "Move to" when the notification maps to a real destination.
  const canNavigate = onNavigate != null && getNotificationTarget(notification) != null;

  const handleMoveTo = () => {
    if (!notification) return;
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    onNavigate?.(notification);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Surface style={[styles.modal, { backgroundColor: theme.colors.surface }]} elevation={5}>
            <View style={styles.header}>
              <View style={styles.headerSpacer} />
              <IconButton
                icon="close"
                size={24}
                onPress={onDismiss}
              />
            </View>

            <View style={styles.content}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: iconColor + '20' },
                ]}
              >
                <Icon
                  name={getNotificationIcon(notification.type) as any}
                  size={40}
                  color={iconColor}
                />
              </View>

              <Text variant="headlineSmall" style={styles.title}>
                {notification.title}
              </Text>

              <Text variant="bodyMedium" style={styles.message}>
                {notification.message}
              </Text>

              <Text variant="labelSmall" style={styles.date}>
                {formatDate(notification.createdAt)}
              </Text>

              {!notification.isRead && (
                <View style={[styles.unreadBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Icon name="circle" size={8} color={theme.colors.primary} />
                  <Text variant="labelSmall" style={{ color: theme.colors.primary, marginLeft: 6 }}>
                    {t('notifications.unread')}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.actions}>
              {canNavigate && (
                <Button
                  mode="contained"
                  icon="arrow-right-circle"
                  onPress={handleMoveTo}
                  style={styles.button}
                >
                  {t('notifications.moveTo')}
                </Button>
              )}
              <Button
                mode={canNavigate ? 'outlined' : 'contained'}
                onPress={handleMarkAsRead}
                style={styles.button}
              >
                {notification.isRead ? t('common.close') : t('notifications.markAsReadAndClose')}
              </Button>
            </View>
          </Surface>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 8,
    paddingTop: 8,
  },
  headerSpacer: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 0,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 16,
  },
  date: {
    opacity: 0.5,
    marginBottom: 12,
  },
  unreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  actions: {
    padding: 16,
    paddingTop: 0,
    gap: 8,
  },
  button: {
    width: '100%',
  },
});

export default NotificationDetailModal;
