import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Linking } from 'react-native';
import {
  Text,
  useTheme,
  Card,
  Chip,
  ActivityIndicator,
  Surface,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLease } from '../../hooks/useLeases';
import { formatCurrency, formatMoney, getCurrentLeaseRent } from '../../utils';
import type { RentalsStackParamList, LeaseStatus } from '../../types';

type NavigationProp = NativeStackNavigationProp<RentalsStackParamList>;
type RouteType = RouteProp<RentalsStackParamList, 'TenantHome'>;

// Quick Action Button Component
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

// Info Row Component
interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value }) => {
  const theme = useTheme();
  return (
    <View style={styles.infoRow}>
      <Icon name={icon as any} size={20} color={theme.colors.outline} />
      <View style={styles.infoRowText}>
        <Text variant="labelSmall" style={styles.infoLabel}>{label}</Text>
        <Text variant="bodyMedium">{value}</Text>
      </View>
    </View>
  );
};

const TenantHomeScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { t } = useTranslation();

  const { leaseId } = route.params;

  const { data: lease, isLoading, refetch: refetchLease } = useLease(leaseId);
  // Rent of the pricing period in effect today (legacy-rent fallback).
  const currentRent = lease ? getCurrentLeaseRent(lease) : null;
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchLease();
    setRefreshing(false);
  };

  const property = lease?.property;
  const owner = property?.owner;

  const getStatusColor = (status: LeaseStatus) => {
    switch (status) {
      case 'ACTIVE': return theme.colors.secondary;
      case 'PENDING': return theme.colors.tertiary;
      case 'EXPIRED': return theme.colors.outline;
      case 'TERMINATED': return theme.colors.error;
      default: return theme.colors.outline;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleContactLandlord = () => {
    if (owner?.email) {
      Linking.openURL(`mailto:${owner.email}`);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <Icon name="home-alert" size={64} color={theme.colors.outline} />
        <Text variant="titleMedium" style={styles.errorText}>{t('tenantHome.propertyNotFound')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header Section - Property Name & Status */}
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon name="home" size={32} color={theme.colors.primary} />
          </View>
          <Text variant="headlineSmall" style={styles.propertyTitle}>
            {property.title}
          </Text>
          <Text variant="bodyMedium" style={styles.propertyAddress}>
            {property.address}, {property.city}
          </Text>

          {lease && (
            <Chip
              mode="flat"
              style={[styles.statusChip, { backgroundColor: getStatusColor(lease.status) + '20' }]}
              textStyle={{ color: getStatusColor(lease.status) }}
            >
              {t(`leases.statuses.${lease.status}`)}
            </Chip>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t('tenantHome.quickActions')}
          </Text>
          <View style={styles.quickActionsGrid}>
            <QuickAction
              icon="file-document-multiple"
              label={t('tenantHome.documents')}
              onPress={() => navigation.navigate('TenantDocuments', {
                propertyId: property.id,
                leaseId: lease?.id
              })}
            />
            <QuickAction
              icon="image-multiple"
              label={t('tenantHome.photos')}
              onPress={() => navigation.navigate('TenantGallery', {
                propertyId: property.id,
              })}
              color={theme.colors.secondary}
            />
            {lease && (
              <QuickAction
                icon="file-sign"
                label={t('tenantHome.leaseDetails')}
                onPress={() => navigation.navigate('LeaseDetails', { leaseId: lease.id })}
              />
            )}
            <QuickAction
              icon="wrench"
              label={t('tenantHome.reportIssue')}
              onPress={() => navigation.navigate('TenantMaintenance', {
                propertyId: property.id,
                leaseId: lease?.id
              })}
              color={theme.colors.tertiary}
            />
            <QuickAction
              icon="email"
              label={t('tenantHome.contactLandlord')}
              onPress={handleContactLandlord}
              color={theme.colors.secondary}
            />
          </View>
        </View>

        {/* Lease Information (if active) */}
        {lease && (
          <Card style={styles.card} mode="outlined">
            <Card.Content>
              <View style={styles.cardHeader}>
                <Icon name="calendar-check" size={20} color={theme.colors.primary} />
                <Text variant="titleMedium" style={styles.cardTitle}>
                  {t('tenantHome.leaseInfo')}
                </Text>
              </View>
              <View style={styles.leaseInfoGrid}>
                <View style={styles.leaseInfoItem}>
                  <Text variant="labelSmall" style={styles.leaseInfoLabel}>
                    {t('leases.startDate')}
                  </Text>
                  <Text variant="bodyMedium">{formatDate(lease.startDate)}</Text>
                </View>
                {lease.endDate && (
                  <View style={styles.leaseInfoItem}>
                    <Text variant="labelSmall" style={styles.leaseInfoLabel}>
                      {t('leases.endDate')}
                    </Text>
                    <Text variant="bodyMedium">{formatDate(lease.endDate)}</Text>
                  </View>
                )}
                {currentRent && (
                  <View style={styles.leaseInfoItem}>
                    <Text variant="labelSmall" style={styles.leaseInfoLabel}>
                      {t('leases.monthlyRent')}
                    </Text>
                    <Text variant="bodyMedium">
                      {formatMoney(currentRent.amount, currentRent.currency)}
                    </Text>
                  </View>
                )}
                {lease.depositAmount && (
                  <View style={styles.leaseInfoItem}>
                    <Text variant="labelSmall" style={styles.leaseInfoLabel}>
                      {t('leases.depositAmount')}
                    </Text>
                    <Text variant="bodyMedium">{formatCurrency(lease.depositAmount)}</Text>
                  </View>
                )}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Contact Information */}
        {owner && (
          <Card style={styles.card} mode="outlined">
            <Card.Content>
              <View style={styles.cardHeader}>
                <Icon name="account-box" size={20} color={theme.colors.secondary} />
                <Text variant="titleMedium" style={styles.cardTitle}>
                  {t('tenantHome.contactInfo')}
                </Text>
              </View>
              <InfoRow
                icon="account"
                label={t('tenantHome.landlord')}
                value={`${owner.firstName} ${owner.lastName}`}
              />
              <Divider style={styles.divider} />
              <InfoRow
                icon="email"
                label={t('tenantHome.email')}
                value={owner.email}
              />
            </Card.Content>
          </Card>
        )}

        {/* Building Information */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <View style={styles.cardHeader}>
              <Icon name="office-building" size={20} color={theme.colors.tertiary} />
              <Text variant="titleMedium" style={styles.cardTitle}>
                {t('tenantHome.buildingInfo')}
              </Text>
            </View>

            {(property.squareMeters || property.rooms || property.floor !== undefined) ? (
              <>
                {property.squareMeters && (
                  <>
                    <InfoRow
                      icon="ruler-square"
                      label={t('properties.squareMeters')}
                      value={`${property.squareMeters} m²`}
                    />
                    <Divider style={styles.divider} />
                  </>
                )}
                {property.rooms && (
                  <>
                    <InfoRow
                      icon="door"
                      label={t('properties.rooms')}
                      value={`${property.rooms}`}
                    />
                    <Divider style={styles.divider} />
                  </>
                )}
                {property.floor !== undefined && property.floor !== null && (
                  <>
                    <InfoRow
                      icon="stairs"
                      label={t('tenantHome.floor')}
                      value={`${property.floor}`}
                    />
                    <Divider style={styles.divider} />
                  </>
                )}
              </>
            ) : null}

            {/* Amenities */}
            <Text variant="labelSmall" style={styles.amenitiesLabel}>
              {t('properties.amenities')}
            </Text>
            <View style={styles.amenitiesRow}>
              {property.hasBalcony && (
                <Chip compact icon="balcony" style={styles.amenityChip}>
                  {t('properties.balcony')}
                </Chip>
              )}
              {property.hasParking && (
                <Chip compact icon="car" style={styles.amenityChip}>
                  {t('properties.parking')}
                </Chip>
              )}
              {property.hasStorage && (
                <Chip compact icon="archive" style={styles.amenityChip}>
                  {t('properties.storage')}
                </Chip>
              )}
              {property.hasShelter && (
                <Chip compact icon="shield-home" style={styles.amenityChip}>
                  {t('properties.shelter')}
                </Chip>
              )}
              {!property.hasBalcony && !property.hasParking && !property.hasStorage && !property.hasShelter && (
                <Text variant="bodySmall" style={styles.noAmenities}>
                  {t('tenantHome.noAmenities')}
                </Text>
              )}
            </View>

            {/* Notes */}
            {property.notes && (
              <>
                <Divider style={styles.divider} />
                <InfoRow
                  icon="note-text"
                  label={t('tenantHome.buildingNotes')}
                  value={property.notes}
                />
              </>
            )}
          </Card.Content>
        </Card>

        {/* Payments Coming Soon */}
        <Card style={[styles.card, styles.comingSoonCard]} mode="outlined">
          <Card.Content style={styles.comingSoonContent}>
            <Icon name="cash-clock" size={32} color={theme.colors.outline} />
            <View style={styles.comingSoonText}>
              <Text variant="titleSmall" style={styles.comingSoonTitle}>
                {t('tenantHome.payments')}
              </Text>
              <Text variant="bodySmall" style={styles.comingSoonSubtitle}>
                {t('tenantHome.comingSoon')}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
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
  propertyTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  propertyAddress: {
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 12,
  },
  statusChip: {
    marginTop: 8,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: '600',
  },
  leaseInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  leaseInfoItem: {
    minWidth: '45%',
  },
  leaseInfoLabel: {
    opacity: 0.6,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  infoRowText: {
    flex: 1,
  },
  infoLabel: {
    opacity: 0.6,
    marginBottom: 2,
  },
  divider: {
    marginVertical: 4,
  },
  amenitiesLabel: {
    opacity: 0.6,
    marginTop: 8,
    marginBottom: 8,
  },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    marginBottom: 4,
  },
  noAmenities: {
    opacity: 0.5,
    fontStyle: 'italic',
  },
  comingSoonCard: {
    opacity: 0.7,
  },
  comingSoonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  comingSoonText: {
    flex: 1,
  },
  comingSoonTitle: {
    fontWeight: '600',
  },
  comingSoonSubtitle: {
    opacity: 0.6,
  },
  errorText: {
    marginTop: 16,
    opacity: 0.7,
  },
});

export default TenantHomeScreen;
