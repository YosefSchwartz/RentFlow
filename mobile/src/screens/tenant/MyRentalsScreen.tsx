import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import {
  Text,
  useTheme,
  ActivityIndicator,
  Card,
  Chip,
  Button,
  FAB,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMyLeases } from '../../hooks/useLeases';
import { formatMoney, getCurrentLeaseRent } from '../../utils';
import type { RentalsStackParamList, Lease, LeaseStatus } from '../../types';

type NavigationProp = NativeStackNavigationProp<RentalsStackParamList>;

const MyRentalsScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { data: leases, isLoading, refetch, isRefetching } = useMyLeases();

  // Refresh whenever the tab regains focus (e.g. just after redeeming a code).
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const hasContent = !!leases && leases.length > 0;

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

  const renderLeaseCard = (lease: Lease) => {
    // Rent of the pricing period in effect today (legacy-rent fallback).
    const rent = getCurrentLeaseRent(lease);
    return (
    <Pressable key={lease.id} onPress={() => navigation.navigate('TenantHome', { leaseId: lease.id })}>
      <Card style={styles.leaseCard} mode="outlined">
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.propertyInfo}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                <Icon name="home" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.propertyText}>
                <Text variant="titleMedium" style={styles.propertyName}>
                  {lease.property?.title || 'Property'}
                </Text>
                <Text variant="bodySmall" style={styles.propertyAddress}>
                  {lease.property?.address}, {lease.property?.city}
                </Text>
              </View>
            </View>
            <Chip
              compact
              style={{ backgroundColor: getStatusColor(lease.status) + '20' }}
              textStyle={{ color: getStatusColor(lease.status), fontSize: 11 }}
            >
              {t(`leases.statuses.${lease.status}`)}
            </Chip>
          </View>

          <View style={styles.leaseDetails}>
            <View style={styles.detailRow}>
              <Icon name="calendar-start" size={16} color={theme.colors.outline} />
              <Text variant="bodySmall" style={styles.detailText}>
                {t('rentals.start')}: {formatDate(lease.startDate)}
              </Text>
            </View>
            {lease.endDate && (
              <View style={styles.detailRow}>
                <Icon name="calendar-end" size={16} color={theme.colors.outline} />
                <Text variant="bodySmall" style={styles.detailText}>
                  {t('rentals.end')}: {formatDate(lease.endDate)}
                </Text>
              </View>
            )}
            {rent && (
              <View style={styles.detailRow}>
                <Icon name="cash" size={16} color={theme.colors.outline} />
                <Text variant="bodySmall" style={styles.detailText}>
                  {t('rentals.rent')}: {formatMoney(rent.amount, rent.currency)}{t('rentals.perMonth')}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.cardFooter}>
            <Text variant="labelSmall" style={styles.viewDetails}>
              {t('rentals.viewMyHome')}
            </Text>
            <Icon name="chevron-right" size={20} color={theme.colors.primary} />
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

  const totalCount = leases?.length || 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          {t('rentals.title')}
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {t('rentals.propertyCount', { count: totalCount })}
        </Text>
      </View>

      {hasContent ? (
        <>
          <ScrollView
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
            }
          >
            {leases && leases.map(renderLeaseCard)}
          </ScrollView>
          <FAB
            icon="plus"
            label={t('joinProperty.joinAnother')}
            style={[styles.fab, { backgroundColor: theme.colors.secondary }]}
            onPress={() => navigation.navigate('JoinProperty')}
          />
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Icon name="home-plus" size={48} color={theme.colors.secondary} />
          </View>
          <Text variant="titleMedium" style={styles.emptyTitle}>
            {t('rentals.noActiveRentals')}
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {t('joinProperty.emptyStateMessage')}
          </Text>
          <Button
            mode="contained"
            icon="key-plus"
            onPress={() => navigation.navigate('JoinProperty')}
            style={styles.joinButton}
          >
            {t('joinProperty.enterCode')}
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
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  leaseCard: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  propertyInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  propertyText: {
    flex: 1,
    marginLeft: 12,
  },
  propertyName: {
    fontWeight: '600',
  },
  propertyAddress: {
    opacity: 0.7,
    marginTop: 2,
  },
  leaseDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    opacity: 0.7,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 12,
  },
  viewDetails: {
    color: '#2563EB',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 8,
    opacity: 0.7,
    textAlign: 'center',
  },
  joinButton: {
    marginTop: 24,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});

export default MyRentalsScreen;
