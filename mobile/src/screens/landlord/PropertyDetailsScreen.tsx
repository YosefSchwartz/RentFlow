import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  useTheme,
  ActivityIndicator,
  Card,
  Chip,
  Divider,
  Surface,
} from 'react-native-paper';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useProperty } from '../../hooks/useProperties';
import { usePropertyLeases } from '../../hooks/useLeases';
import type {
  PropertiesStackParamList,
  Lease,
  LeaseStatus,
} from '../../types';

type RouteType = RouteProp<PropertiesStackParamList, 'PropertyDetails'>;
type NavigationProp = NativeStackNavigationProp<PropertiesStackParamList>;

// Quick Action Button (mirrors the tenant home screen).
interface QuickActionProps {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, onPress, color }) => {
  const theme = useTheme();
  const actionColor = color || theme.colors.primary;

  return (
    <Surface style={styles.quickAction} elevation={1} onTouchEnd={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: actionColor + '15' }]}>
        <Icon name={icon as any} size={24} color={actionColor} />
      </View>
      <Text variant="labelMedium" style={styles.quickActionLabel} numberOfLines={2}>
        {label}
      </Text>
    </Surface>
  );
};

const PropertyDetailsScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { propertyId } = route.params;

  const { data: property, isLoading, refetch, isRefetching } = useProperty(propertyId);
  const { data: leases, refetch: refetchLeases } = usePropertyLeases(propertyId);

  // Refresh property data (incl. lease status/tenant) when returning to the
  // screen — e.g. after a tenant redeems an activation code on their device.
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchLeases();
    }, [refetch, refetchLeases]),
  );

  const handleRefresh = useCallback(() => {
    refetch();
    refetchLeases();
  }, [refetch, refetchLeases]);

  const getLeaseStatusColor = (status: LeaseStatus) => {
    switch (status) {
      case 'ACTIVE':
        return theme.colors.secondary;
      case 'PENDING':
        return theme.colors.tertiary;
      case 'EXPIRED':
        return theme.colors.outline;
      case 'TERMINATED':
        return theme.colors.error;
      default:
        return theme.colors.outline;
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <Text>{t('common.notAvailable')}</Text>
      </View>
    );
  }

  const activeLeases = leases?.filter((l: Lease) => l.status === 'ACTIVE') || [];

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon name="home-city" size={32} color={theme.colors.primary} />
        </View>
        <Text variant="headlineSmall" style={styles.title}>
          {property.title}
        </Text>
        <Text variant="bodyMedium" style={styles.address}>
          {property.address}, {property.city}
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {t('tenantHome.quickActions')}
        </Text>
        <View style={styles.quickActionsGrid}>
          <QuickAction
            icon="file-sign"
            label={t('tabs.leases')}
            onPress={() => navigation.navigate('PropertyLeases', { propertyId })}
          />
          <QuickAction
            icon="image-multiple"
            label={t('tabs.photos')}
            color={theme.colors.secondary}
            onPress={() => navigation.navigate('PropertyPhotos', { propertyId })}
          />
          <QuickAction
            icon="file-document-multiple"
            label={t('documents.docs')}
            onPress={() => navigation.navigate('PropertyDocuments', { propertyId })}
          />
          <QuickAction
            icon="wrench"
            label={t('tabs.requests')}
            color={theme.colors.tertiary}
            onPress={() => navigation.navigate('PropertyMaintenance', { propertyId })}
          />
        </View>
      </View>

      {/* Property Information */}
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <View style={styles.infoRow}>
            <Icon name="map-marker" size={20} color={theme.colors.primary} />
            <View style={styles.infoText}>
              <Text variant="labelMedium" style={styles.infoLabel}>{t('propertyInfo.address')}</Text>
              <Text variant="bodyMedium">{property.address}</Text>
            </View>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Icon name="city" size={20} color={theme.colors.primary} />
            <View style={styles.infoText}>
              <Text variant="labelMedium" style={styles.infoLabel}>{t('propertyInfo.city')}</Text>
              <Text variant="bodyMedium">{property.city}</Text>
            </View>
          </View>
          {property.notes && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.infoRow}>
                <Icon name="text" size={20} color={theme.colors.primary} />
                <View style={styles.infoText}>
                  <Text variant="labelMedium" style={styles.infoLabel}>{t('propertyInfo.notes')}</Text>
                  <Text variant="bodyMedium">{property.notes}</Text>
                </View>
              </View>
            </>
          )}
        </Card.Content>
      </Card>

      {/* Current Tenants (glance) */}
      <Card style={styles.card} mode="outlined">
        <Card.Title title={t('leases.currentTenants')} />
        <Card.Content>
          {activeLeases.length > 0 ? (
            activeLeases.map((lease: Lease) => (
              <View key={lease.id} style={styles.tenantRow}>
                <Icon name="account" size={20} color={theme.colors.secondary} />
                <View style={styles.tenantInfo}>
                  <Text variant="bodyMedium" style={styles.tenantName}>
                    {lease.tenant?.firstName} {lease.tenant?.lastName}
                  </Text>
                  <Text variant="bodySmall" style={styles.leaseInfo}>
                    {t('leases.endDate')}: {formatDate(lease.endDate)}
                  </Text>
                </View>
                <Chip
                  compact
                  style={{ backgroundColor: getLeaseStatusColor(lease.status) + '20' }}
                  textStyle={{ color: getLeaseStatusColor(lease.status), fontSize: 11 }}
                >
                  {t(`leases.statuses.${lease.status}`)}
                </Chip>
              </View>
            ))
          ) : (
            <Text variant="bodyMedium" style={styles.emptyText}>
              {t('leases.noActiveTenants')}
            </Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  address: {
    opacity: 0.7,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAction: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    textAlign: 'center',
  },
  card: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    opacity: 0.7,
    marginBottom: 2,
  },
  divider: {
    marginVertical: 4,
  },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tenantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tenantName: {
    fontWeight: '500',
  },
  leaseInfo: {
    opacity: 0.7,
    marginTop: 2,
  },
  emptyText: {
    opacity: 0.7,
    textAlign: 'center',
  },
});

export default PropertyDetailsScreen;
