import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import {
  Text,
  useTheme,
  Card,
  ActivityIndicator,
  Button,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from '../../hooks/useNotifications';
import { useNavigation } from '@react-navigation/native';
import NotificationDetailModal from '../../components/NotificationDetailModal';
import { formatDateTime } from '../../utils';
import { getNotificationTarget } from '../../utils/notificationNavigation';
import type { Notification, NotificationType } from '../../types';

const NotificationsScreen: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { data: notifications, isLoading, refetch, isRefetching } = useNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const getNotificationIcon = (type: NotificationType): string => {
    switch (type) {
      case 'LEASE_PENDING':
        return 'account-clock';
      case 'LEASE_APPROVED':
        return 'file-document-check';
      case 'LEASE_REJECTED':
        return 'file-document-remove';
      case 'LEASE_TERMS_UPDATED':
        return 'cash-sync';
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
      case 'LEASE_TERMS_UPDATED':
        return theme.colors.primary;
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) {
      return t('notifications.justNow');
    } else if (hours < 24) {
      return t('notifications.hoursAgo', { count: hours });
    } else if (days < 7) {
      return t('notifications.daysAgo', { count: days });
    } else {
      return date.toLocaleDateString();
    }
  };

  // Exact date + HH:MM (no seconds).
  const formatExactDateTime = (dateString: string) => formatDateTime(dateString);

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const handleNotificationPress = (notification: Notification) => {
    setSelectedNotification(notification);
    setModalVisible(true);
  };

  const handleModalDismiss = () => {
    setModalVisible(false);
    setSelectedNotification(null);
  };

  // Jump to the screen a notification refers to. This screen lives in the
  // Profile tab's stack (or the root stack when opened from experience
  // selection), so we navigate through the bottom-tab navigator to reach the
  // target screen inside the Properties/Rentals stacks.
  const handleNavigateToEntity = (notification: Notification) => {
    const target = getNotificationTarget(notification);
    if (!target) return;

    const nested = {
      screen: target.tab,
      params: { screen: target.screen, params: target.params },
    };

    const parent = navigation.getParent?.();
    if (parent) {
      // In-app: parent is the bottom-tab navigator.
      parent.navigate(target.tab, { screen: target.screen, params: target.params });
    } else {
      // Opened from the experience-selection screen (root stack).
      navigation.navigate('Main', nested);
    }
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const renderNotificationCard = (notification: Notification) => {
    const iconColor = getNotificationColor(notification.type);
    const isUnread = !notification.isRead;

    return (
      <Pressable
        key={notification.id}
        onPress={() => handleNotificationPress(notification)}
      >
        <Card
          style={[
            styles.notificationCard,
            isUnread && { backgroundColor: theme.colors.primaryContainer + '30' },
          ]}
          mode="outlined"
        >
          <Card.Content style={styles.cardContent}>
            <View style={styles.iconContainer}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: iconColor + '20' },
                ]}
              >
                <Icon
                  name={getNotificationIcon(notification.type) as any}
                  size={24}
                  color={iconColor}
                />
              </View>
            </View>
            <View style={styles.textContainer}>
              <View style={styles.headerRow}>
                <Text
                  variant="titleSmall"
                  style={[styles.title, isUnread && styles.unreadTitle]}
                  numberOfLines={1}
                >
                  {notification.title}
                </Text>
                {isUnread && (
                  <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />
                )}
              </View>
              <Text variant="bodySmall" style={styles.message} numberOfLines={2}>
                {notification.message}
              </Text>
              <Text variant="labelSmall" style={styles.date}>
                {formatDate(notification.createdAt)}
                {'  ·  '}
                {formatExactDateTime(notification.createdAt)}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const hasNotifications = notifications && notifications.length > 0;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {hasNotifications ? (
        <>
          {unreadCount > 0 && (
            <View style={styles.headerActions}>
              <Button
                mode="text"
                compact
                onPress={handleMarkAllAsRead}
                loading={markAllAsRead.isPending}
                icon="check-all"
              >
                {t('notifications.markAllRead')}
              </Button>
            </View>
          )}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
            }
          >
            {notifications.map(renderNotificationCard)}
          </ScrollView>
        </>
      ) : (
        <View style={[styles.container, styles.emptyState]}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Icon name="bell-outline" size={48} color={theme.colors.primary} />
          </View>
          <Text variant="titleMedium" style={styles.emptyTitle}>
            {t('notifications.noNotifications')}
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {t('notifications.emptyMessage')}
          </Text>
        </View>
      )}

      <NotificationDetailModal
        notification={selectedNotification}
        visible={modalVisible}
        onDismiss={handleModalDismiss}
        onMarkAsRead={handleMarkAsRead}
        onNavigate={handleNavigateToEntity}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  notificationCard: {
    marginBottom: 12,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: '500',
    flex: 1,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  message: {
    opacity: 0.7,
    marginTop: 4,
    marginBottom: 8,
  },
  date: {
    opacity: 0.5,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    opacity: 0.6,
    textAlign: 'center',
  },
});

export default NotificationsScreen;
