import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import {
  Text,
  useTheme,
  Card,
  Chip,
  Button,
  ActivityIndicator,
  FAB,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usePropertyMaintenance } from '../../hooks/useMaintenance';
import { numberToPriority } from '../../utils/maintenancePriority';
import type { RentalsStackParamList, MaintenanceRequest, MaintenanceStatus, MaintenancePriority } from '../../types';

type NavigationProp = NativeStackNavigationProp<RentalsStackParamList>;
type RouteType = RouteProp<RentalsStackParamList, 'TenantMaintenance'>;

const TenantMaintenanceScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { t } = useTranslation();
  const { propertyId, leaseId } = route.params;

  const { data: requests, isLoading, refetch, isRefetching } = usePropertyMaintenance(propertyId);

  const getStatusColor = (status: MaintenanceStatus) => {
    switch (status) {
      case 'OPEN':
        return theme.colors.tertiary;
      case 'IN_PROGRESS':
        return theme.colors.primary;
      case 'RESOLVED':
        return theme.colors.secondary;
      default:
        return theme.colors.outline;
    }
  };

  const getStatusIcon = (status: MaintenanceStatus): string => {
    switch (status) {
      case 'OPEN':
        return 'clock-outline';
      case 'IN_PROGRESS':
        return 'progress-wrench';
      case 'RESOLVED':
        return 'check-circle';
      default:
        return 'help-circle';
    }
  };

  const getPriorityColor = (priority: MaintenancePriority) => {
    switch (priority) {
      case 'LOW':
        return theme.colors.outline;
      case 'MEDIUM':
        return theme.colors.primary;
      case 'HIGH':
        return theme.colors.tertiary;
      case 'URGENT':
        return theme.colors.error;
      default:
        return theme.colors.outline;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleCreateRequest = () => {
    navigation.navigate('CreateMaintenanceRequest', { propertyId, leaseId });
  };

  // Group requests by status
  const openRequests = requests?.filter(r => r.status === 'OPEN' || r.status === 'IN_PROGRESS') || [];
  const closedRequests = requests?.filter(r => r.status === 'RESOLVED') || [];

  const renderRequestCard = (request: MaintenanceRequest) => {
    const priority = numberToPriority(request.priority);
    return (
      <Pressable
        key={request.id}
        onPress={() => navigation.navigate('MaintenanceDetail', { requestId: request.id })}
      >
        <Card style={styles.requestCard} mode="outlined">
          <Card.Content>
            <View style={styles.requestHeader}>
              <View style={styles.requestTitleRow}>
                <Icon
                  name={getStatusIcon(request.status) as any}
                  size={20}
                  color={getStatusColor(request.status)}
                />
                <Text variant="titleSmall" style={styles.requestTitle} numberOfLines={1}>
                  {request.title}
                </Text>
              </View>
              <Chip
                compact
                style={{ backgroundColor: getPriorityColor(priority) + '20' }}
                textStyle={{ color: getPriorityColor(priority), fontSize: 10 }}
              >
                {t(`maintenance.priorityLevels.${priority}`)}
              </Chip>
            </View>

            <Text variant="bodySmall" style={styles.requestDescription} numberOfLines={2}>
              {request.description}
            </Text>

            <View style={styles.requestFooter}>
              <Chip
                compact
                mode="flat"
                style={{ backgroundColor: getStatusColor(request.status) + '20' }}
                textStyle={{ color: getStatusColor(request.status), fontSize: 11 }}
              >
                {t(`maintenance.statuses.${request.status}`)}
              </Chip>
              <Text variant="labelSmall" style={styles.requestDate}>
                {formatDate(request.createdAt)}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const hasRequests = (requests?.length || 0) > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {hasRequests ? (
        <>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          >
            {/* Open Requests */}
            {openRequests.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Icon name="clock-outline" size={16} color={theme.colors.primary} />
                  </View>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    {t('tenantMaintenance.openRequests')}
                  </Text>
                  <Chip compact>{openRequests.length}</Chip>
                </View>
                {openRequests.map(renderRequestCard)}
              </View>
            )}

            {/* Resolved Requests */}
            {closedRequests.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
                    <Icon name="check-circle" size={16} color={theme.colors.secondary} />
                  </View>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    {t('tenantMaintenance.resolvedRequests')}
                  </Text>
                  <Chip compact>{closedRequests.length}</Chip>
                </View>
                {closedRequests.map(renderRequestCard)}
              </View>
            )}
          </ScrollView>

          <FAB
            icon="plus"
            label={t('tenantMaintenance.reportIssue')}
            style={[styles.fab, { backgroundColor: theme.colors.primary }]}
            onPress={handleCreateRequest}
          />
        </>
      ) : (
        <View style={[styles.container, styles.emptyState]}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Icon name="check-circle" size={48} color={theme.colors.secondary} />
          </View>
          <Text variant="titleMedium" style={styles.emptyTitle}>
            {t('tenantMaintenance.noIssues')}
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {t('tenantMaintenance.allGood')}
          </Text>
          <Button
            mode="contained"
            icon="wrench"
            onPress={handleCreateRequest}
            style={styles.reportButton}
          >
            {t('tenantMaintenance.reportIssue')}
          </Button>
        </View>
      )}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: '600',
    flex: 1,
  },
  requestCard: {
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  requestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  requestTitle: {
    fontWeight: '600',
    flex: 1,
  },
  requestDescription: {
    opacity: 0.7,
    marginBottom: 12,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestDate: {
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
    marginBottom: 24,
  },
  reportButton: {
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});

export default TenantMaintenanceScreen;
