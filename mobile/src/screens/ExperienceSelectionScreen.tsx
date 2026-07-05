import React from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text, useTheme, Card, Button, IconButton, Badge } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../hooks/useDashboard';
import { useUnreadNotificationsCount } from '../hooks/useNotifications';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Store the selected experience for navigation
export type Experience = 'properties' | 'rentals';
let selectedExperience: Experience = 'properties';

export const getSelectedExperience = () => selectedExperience;
export const setSelectedExperience = (exp: Experience) => {
  selectedExperience = exp;
};

const ExperienceSelectionScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { data: dashboard, isLoading, error } = useDashboard();
  const { data: unreadCount } = useUnreadNotificationsCount();

  const handleSelectExperience = (experience: Experience) => {
    setSelectedExperience(experience);
    navigation.navigate('Main');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={styles.loadingText}>{t('experience.loadingDashboard')}</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <Icon name="alert-circle" size={48} color={theme.colors.error} />
        <Text variant="bodyLarge" style={[styles.errorText, { color: theme.colors.error }]}>
          {t('experience.failedLoadDashboard')}
        </Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          {t('common.goBack')}
        </Button>
      </SafeAreaView>
    );
  }

  const { user, canAccessLandlord, canAccessTenant, ownedPropertiesCount } = dashboard || {};
  const showBecomeOwner = !canAccessLandlord || ownedPropertiesCount === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.notificationButton}>
            <IconButton
              icon="bell-outline"
              size={24}
              onPress={() => navigation.navigate('Notifications')}
            />
            {unreadCount != null && unreadCount > 0 && (
              <Badge
                size={16}
                style={[styles.notificationBadge, { backgroundColor: theme.colors.error }]}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </View>
          <IconButton
            icon="cog"
            size={24}
            onPress={() => navigation.navigate('Settings')}
          />
        </View>

        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            {t('experience.welcome', { name: user?.firstName })}
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            {t('experience.chooseManage')}
          </Text>
        </View>

        <View style={styles.options}>
          {/* My Properties - Landlord Experience */}
          {(canAccessLandlord || showBecomeOwner) && (
            <Pressable onPress={() => handleSelectExperience('properties')}>
              <Card style={styles.card} mode="outlined">
                <Card.Content style={styles.cardContent}>
                  <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Icon name="home-city" size={48} color={theme.colors.primary} />
                  </View>
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    {showBecomeOwner && ownedPropertiesCount === 0 ? t('experience.becomeLandlord') : t('experience.myProperties')}
                  </Text>
                  <Text variant="bodyMedium" style={styles.cardDescription}>
                    {showBecomeOwner && ownedPropertiesCount === 0
                      ? t('experience.addFirstProperty')
                      : t('experience.manageApartments')}
                  </Text>
                  {canAccessLandlord && ownedPropertiesCount !== undefined && ownedPropertiesCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
                      <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
                        {ownedPropertiesCount} {ownedPropertiesCount === 1 ? t('experience.property') : t('experience.properties')}
                      </Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
            </Pressable>
          )}

          {/* My Rentals - Tenant Experience (always show) */}
          <Pressable onPress={() => handleSelectExperience('rentals')}>
            <Card style={styles.card} mode="outlined">
              <Card.Content style={styles.cardContent}>
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.secondaryContainer }]}>
                  <Icon name="key" size={48} color={theme.colors.secondary} />
                </View>
                <Text variant="titleLarge" style={styles.cardTitle}>
                  {t('experience.myRentals')}
                </Text>
                <Text variant="bodyMedium" style={styles.cardDescription}>
                  {canAccessTenant
                    ? t('experience.viewRentedApartments')
                    : t('experience.joinAsATenant')}
                </Text>
                {dashboard?.activeLeasesCount !== undefined && dashboard.activeLeasesCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: theme.colors.secondaryContainer }]}>
                    <Text variant="labelMedium" style={{ color: theme.colors.secondary }}>
                      {dashboard.activeLeasesCount} {dashboard.activeLeasesCount === 1 ? t('experience.activeLease') : t('experience.activeLeases')}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          </Pressable>
        </View>
      </View>
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
  content: {
    flex: 1,
    padding: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  header: {
    marginTop: 16,
    marginBottom: 48,
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    opacity: 0.7,
    textAlign: 'center',
  },
  options: {
    gap: 20,
  },
  card: {
    marginBottom: 4,
  },
  cardContent: {
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardDescription: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.7,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 16,
  },
});

export default ExperienceSelectionScreen;
