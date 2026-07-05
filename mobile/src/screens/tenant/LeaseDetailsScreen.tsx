import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  useTheme,
  ActivityIndicator,
  Card,
  Chip,
  Divider,
} from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLease } from '../../hooks/useLeases';
import { formatCurrency } from '../../utils';
import type { RentalsStackParamList, LeaseStatus } from '../../types';

type LeaseDetailsRouteProp = RouteProp<RentalsStackParamList, 'LeaseDetails'>;

const LeaseDetailsScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<LeaseDetailsRouteProp>();
  const { t } = useTranslation();
  const { leaseId } = route.params;

  const { data: lease, isLoading, refetch, isRefetching } = useLease(leaseId);

  const getStatusColor = (status: LeaseStatus) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return t('common.notAvailable');
    return formatCurrency(amount);
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!lease) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <Icon name="alert-circle" size={64} color={theme.colors.error} />
        <Text variant="titleMedium" style={styles.errorTitle}>
          {t('rentals.leaseNotFound')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            {lease.property?.title}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {lease.property?.address}
          </Text>
        </View>

        {/* Property Information */}
        <Text variant="titleMedium" style={styles.sectionTitle}>{t('propertyInfo.title')}</Text>
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <View style={styles.infoRow}>
              <Icon name="home" size={20} color={theme.colors.primary} />
              <View style={styles.infoText}>
                <Text variant="labelMedium" style={styles.infoLabel}>{t('propertyInfo.property')}</Text>
                <Text variant="bodyMedium">{lease.property?.title}</Text>
              </View>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Icon name="map-marker" size={20} color={theme.colors.primary} />
              <View style={styles.infoText}>
                <Text variant="labelMedium" style={styles.infoLabel}>{t('propertyInfo.address')}</Text>
                <Text variant="bodyMedium">{lease.property?.address}</Text>
              </View>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Icon name="city" size={20} color={theme.colors.primary} />
              <View style={styles.infoText}>
                <Text variant="labelMedium" style={styles.infoLabel}>{t('propertyInfo.city')}</Text>
                <Text variant="bodyMedium">{lease.property?.city}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Lease Information */}
        <Text variant="titleMedium" style={styles.sectionTitle}>{t('leases.leaseInfo')}</Text>
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <View style={styles.infoRow}>
              <Icon name="file-document" size={20} color={theme.colors.secondary} />
              <View style={styles.infoText}>
                <Text variant="labelMedium" style={styles.infoLabel}>{t('leases.status')}</Text>
                <Chip
                  compact
                  style={{ backgroundColor: getStatusColor(lease.status) + '20', alignSelf: 'flex-start' }}
                  textStyle={{ color: getStatusColor(lease.status), fontSize: 12 }}
                >
                  {t(`leases.statuses.${lease.status}`)}
                </Chip>
              </View>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Icon name="calendar-start" size={20} color={theme.colors.secondary} />
              <View style={styles.infoText}>
                <Text variant="labelMedium" style={styles.infoLabel}>{t('leases.startDate')}</Text>
                <Text variant="bodyMedium">{formatDate(lease.startDate)}</Text>
              </View>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Icon name="calendar-end" size={20} color={theme.colors.secondary} />
              <View style={styles.infoText}>
                <Text variant="labelMedium" style={styles.infoLabel}>{t('leases.endDate')}</Text>
                <Text variant="bodyMedium">{formatDate(lease.endDate)}</Text>
              </View>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Icon name="cash" size={20} color={theme.colors.secondary} />
              <View style={styles.infoText}>
                <Text variant="labelMedium" style={styles.infoLabel}>{t('leases.monthlyRent')}</Text>
                <Text variant="bodyMedium">{formatAmount(lease.monthlyRent)}</Text>
              </View>
            </View>
            {lease.depositAmount && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.infoRow}>
                  <Icon name="bank" size={20} color={theme.colors.secondary} />
                  <View style={styles.infoText}>
                    <Text variant="labelMedium" style={styles.infoLabel}>{t('leases.depositAmount')}</Text>
                    <Text variant="bodyMedium">{formatAmount(lease.depositAmount)}</Text>
                  </View>
                </View>
              </>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    marginTop: 16,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontWeight: 'bold',
  },
  subtitle: {
    opacity: 0.7,
    marginTop: 4,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  card: {
    marginBottom: 16,
    marginHorizontal: 16,
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
});

export default LeaseDetailsScreen;
