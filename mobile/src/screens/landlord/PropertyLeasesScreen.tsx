import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  useTheme,
  ActivityIndicator,
  Card,
  Button,
  Chip,
  Divider,
} from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usePropertyLeases } from '../../hooks/useLeases';
import { formatCurrency } from '../../utils';
import type { PropertiesStackParamList, Lease, LeaseStatus } from '../../types';

type RouteType = RouteProp<PropertiesStackParamList, 'PropertyLeases'>;
type NavigationProp = NativeStackNavigationProp<PropertiesStackParamList>;

const PropertyLeasesScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { propertyId } = route.params;

  const { data: leases, isLoading, refetch, isRefetching } = usePropertyLeases(propertyId);

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

  const formatAmount = (amount?: number) => {
    if (!amount) return t('common.notAvailable');
    return formatCurrency(amount);
  };

  const handleShareCode = (lease: Lease) => {
    navigation.navigate('LeaseActivationCode', {
      leaseId: lease.id,
      code: lease.activationCode || '',
    });
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
      <Button
        mode="contained"
        onPress={() => navigation.navigate('CreateLease', { propertyId })}
        icon="plus"
        style={styles.createLeaseButton}
      >
        {t('leases.createNewLease')}
      </Button>

      {leases && leases.length > 0 ? (
        leases.map((lease: Lease) => (
          <Card key={lease.id} style={styles.itemCard} mode="outlined">
            <Card.Content>
              <View style={styles.leaseHeader}>
                <View style={styles.leaseTenant}>
                  <Icon
                    name={lease.tenant ? 'account' : 'account-question'}
                    size={24}
                    color={lease.tenant ? theme.colors.primary : theme.colors.outline}
                  />
                  <View style={styles.leaseTenantInfo}>
                    {lease.tenant ? (
                      <>
                        <Text variant="titleSmall">
                          {lease.tenant.firstName} {lease.tenant.lastName}
                        </Text>
                        <Text variant="bodySmall" style={styles.itemMeta}>
                          {lease.tenant.email}
                        </Text>
                      </>
                    ) : (
                      <Text variant="titleSmall" style={{ color: theme.colors.outline }}>
                        {t('leases.unassigned')}
                      </Text>
                    )}
                  </View>
                </View>
                <Chip
                  compact
                  style={{ backgroundColor: getLeaseStatusColor(lease.status) + '20' }}
                  textStyle={{ color: getLeaseStatusColor(lease.status), fontSize: 11 }}
                >
                  {t(`leases.statuses.${lease.status}`)}
                </Chip>
              </View>

              <Divider style={styles.leaseDivider} />

              <View style={styles.leaseDetails}>
                <View style={styles.leaseDetailRow}>
                  <Icon name="calendar-start" size={16} color={theme.colors.outline} />
                  <Text variant="bodySmall" style={styles.leaseDetailText}>
                    {t('rentals.start')}: {formatDate(lease.startDate)}
                  </Text>
                </View>
                <View style={styles.leaseDetailRow}>
                  <Icon name="calendar-end" size={16} color={theme.colors.outline} />
                  <Text variant="bodySmall" style={styles.leaseDetailText}>
                    {t('rentals.end')}: {formatDate(lease.endDate)}
                  </Text>
                </View>
                {lease.monthlyRent && (
                  <View style={styles.leaseDetailRow}>
                    <Icon name="cash" size={16} color={theme.colors.outline} />
                    <Text variant="bodySmall" style={styles.leaseDetailText}>
                      {t('rentals.rent')}: {formatAmount(lease.monthlyRent)}{t('rentals.perMonth')}
                    </Text>
                  </View>
                )}
                {lease.depositAmount && (
                  <View style={styles.leaseDetailRow}>
                    <Icon name="bank" size={16} color={theme.colors.outline} />
                    <Text variant="bodySmall" style={styles.leaseDetailText}>
                      {t('leases.depositAmount')}: {formatAmount(lease.depositAmount)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Unassigned lease: let the landlord share the activation code. */}
              {!lease.tenant && lease.activationCode && (
                <Button
                  mode="contained-tonal"
                  icon="ticket-confirmation-outline"
                  style={styles.shareCodeButton}
                  onPress={() => handleShareCode(lease)}
                >
                  {t('leases.shareCode')}
                </Button>
              )}
            </Card.Content>
          </Card>
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="file-document-outline" size={48} color={theme.colors.outline} />
          <Text variant="bodyMedium" style={styles.emptyText}>
            {t('leases.noLeases')}
          </Text>
          <Text variant="bodySmall" style={styles.emptySubtext}>
            {t('leases.createLeaseHint')}
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
  createLeaseButton: {
    marginBottom: 16,
  },
  itemCard: {
    marginBottom: 12,
  },
  itemMeta: {
    opacity: 0.7,
    marginTop: 2,
  },
  leaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leaseTenant: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  leaseTenantInfo: {
    marginLeft: 12,
    flex: 1,
  },
  leaseDivider: {
    marginVertical: 12,
  },
  leaseDetails: {
    gap: 6,
  },
  leaseDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leaseDetailText: {
    opacity: 0.7,
  },
  shareCodeButton: {
    marginTop: 12,
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
  emptySubtext: {
    opacity: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default PropertyLeasesScreen;
