import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import {
  Text,
  useTheme,
  ActivityIndicator,
  Card,
  Button,
  Chip,
} from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usePropertyMaintenance, useUpdateMaintenanceStatus } from '../../hooks/useMaintenance';
import type {
  PropertiesStackParamList,
  MaintenanceRequest,
  MaintenanceStatus,
} from '../../types';

type RouteType = RouteProp<PropertiesStackParamList, 'PropertyMaintenance'>;
type NavigationProp = NativeStackNavigationProp<PropertiesStackParamList>;

const PropertyMaintenanceScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { propertyId } = route.params;

  const { data: maintenance, isLoading, refetch, isRefetching } =
    usePropertyMaintenance(propertyId);
  const updateStatus = useUpdateMaintenanceStatus();

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

  const handleStatusChange = async (requestId: string, newStatus: MaintenanceStatus) => {
    try {
      await updateStatus.mutateAsync({ requestId, status: newStatus });
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {maintenance && maintenance.length > 0 ? (
        maintenance.map((request: MaintenanceRequest) => (
          <Pressable
            key={request.id}
            onPress={() => navigation.navigate('MaintenanceDetail', { requestId: request.id })}
          >
            <Card style={styles.itemCard} mode="outlined">
              <Card.Content>
                <View style={styles.maintenanceHeader}>
                  <Text variant="titleSmall">{request.title}</Text>
                  <Chip
                    compact
                    style={{ backgroundColor: getStatusColor(request.status) + '20' }}
                    textStyle={{ color: getStatusColor(request.status) }}
                  >
                    {t(`maintenance.statuses.${request.status}`)}
                  </Chip>
                </View>
                <Text variant="bodySmall" style={styles.maintenanceDesc}>
                  {request.description}
                </Text>
                <View style={styles.maintenanceActions}>
                  {request.status === 'OPEN' && (
                    <Button
                      mode="contained-tonal"
                      compact
                      onPress={() => handleStatusChange(request.id, 'IN_PROGRESS')}
                    >
                      {t('maintenance.actions.start')}
                    </Button>
                  )}
                  {request.status === 'IN_PROGRESS' && (
                    <Button
                      mode="contained-tonal"
                      compact
                      onPress={() => handleStatusChange(request.id, 'RESOLVED')}
                    >
                      {t('maintenance.actions.complete')}
                    </Button>
                  )}
                </View>
              </Card.Content>
            </Card>
          </Pressable>
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="wrench" size={48} color={theme.colors.outline} />
          <Text variant="bodyMedium" style={styles.emptyText}>
            {t('maintenance.noRequests')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    flexGrow: 1,
  },
  itemCard: {
    marginBottom: 12,
  },
  maintenanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  maintenanceDesc: {
    opacity: 0.7,
    marginBottom: 12,
  },
  maintenanceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    opacity: 0.7,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default PropertyMaintenanceScreen;
