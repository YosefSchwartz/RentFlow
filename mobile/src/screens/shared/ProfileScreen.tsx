import React from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import {
  Text,
  Card,
  Button,
  useTheme,
  Avatar,
  Divider,
  IconButton,
  Badge,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../store/AuthContext';
import { useDashboard } from '../../hooks/useDashboard';
import { useUnreadNotificationsCount } from '../../hooks/useNotifications';
import { getInitials } from '../../utils/userDisplay';
import type { RootStackParamList, ProfileStackParamList } from '../../types';

type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ProfileNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

const ProfileScreen: React.FC = () => {
  const theme = useTheme();
  const rootNavigation = useNavigation<RootNavigationProp>();
  const profileNavigation = useNavigation<ProfileNavigationProp>();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { data: dashboard } = useDashboard();
  const { data: unreadCount } = useUnreadNotificationsCount();

  const handleLogout = () => {
    Alert.alert(
      t('auth.logout'),
      t('auth.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.logout'),
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const handleSwitchExperience = () => {
    rootNavigation.navigate('ExperienceSelection');
  };

  const handleSettings = () => {
    profileNavigation.navigate('Settings');
  };

  const handleEditProfile = () => {
    profileNavigation.navigate('EditProfile');
  };

  const handleNotifications = () => {
    profileNavigation.navigate('Notifications');
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <ScrollView style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          <View style={styles.notificationButton}>
            <IconButton
              icon="bell-outline"
              size={24}
              onPress={handleNotifications}
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
            onPress={handleSettings}
          />
        </View>

        <View style={styles.header}>
          {user?.avatarUrl ? (
            <Avatar.Image size={80} source={{ uri: user.avatarUrl }} />
          ) : (
            <Avatar.Text
              size={80}
              label={getInitials(user)}
              style={{ backgroundColor: theme.colors.primary }}
            />
          )}
          <View style={styles.nameRow}>
            <Text variant="headlineSmall" style={styles.name}>
              {user?.firstName} {user?.lastName}
            </Text>
            <IconButton
              icon="pencil"
              size={18}
              onPress={handleEditProfile}
              accessibilityLabel={t('profile.editProfile.title')}
            />
          </View>
        </View>

        {/* User Info Card */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <View style={styles.infoRow}>
              <Icon name="email" size={20} color={theme.colors.primary} />
              <View style={styles.infoText}>
                <Text variant="labelMedium" style={styles.infoLabel}>{t('profile.email')}</Text>
                <Text variant="bodyMedium">{user?.email}</Text>
              </View>
            </View>

            {user?.phone && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.infoRow}>
                  <Icon name="phone" size={20} color={theme.colors.primary} />
                  <View style={styles.infoText}>
                    <Text variant="labelMedium" style={styles.infoLabel}>{t('profile.phone')}</Text>
                    <Text variant="bodyMedium">{user.phone}</Text>
                  </View>
                </View>
              </>
            )}

            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Icon name="calendar" size={20} color={theme.colors.primary} />
              <View style={styles.infoText}>
                <Text variant="labelMedium" style={styles.infoLabel}>{t('profile.memberSince')}</Text>
                <Text variant="bodyMedium">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : t('common.notAvailable')}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Statistics Card */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>{t('profile.statistics')}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Icon name="home-city" size={24} color={theme.colors.primary} />
                </View>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {dashboard?.ownedPropertiesCount ?? 0}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  {t('profile.ownedProperties')}
                </Text>
              </View>

              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
                  <Icon name="file-document" size={24} color={theme.colors.secondary} />
                </View>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {dashboard?.activeLeasesCount ?? 0}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  {t('profile.activeLeases')}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={handleSwitchExperience}
            icon="swap-horizontal"
            style={styles.switchButton}
          >
            {t('profile.switchExperience')}
          </Button>

          <Button
            mode="outlined"
            onPress={handleLogout}
            icon="logout"
            textColor={theme.colors.error}
            style={[styles.logoutButton, { borderColor: theme.colors.error }]}
          >
            {t('auth.logout')}
          </Button>
        </View>

        <View style={styles.footer}>
          <Text variant="bodySmall" style={styles.version}>
            {t('profile.appVersion', { version: '1.0.0' })}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  headerSpacer: {
    flex: 1,
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
    alignItems: 'center',
    marginBottom: 24,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  name: {
    fontWeight: 'bold',
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  infoText: {
    flex: 1,
    marginLeft: 16,
  },
  infoLabel: {
    opacity: 0.7,
    marginBottom: 2,
  },
  divider: {
    marginVertical: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontWeight: 'bold',
  },
  statLabel: {
    opacity: 0.7,
    textAlign: 'center',
  },
  actions: {
    marginTop: 'auto',
  },
  switchButton: {
    marginBottom: 12,
  },
  logoutButton: {
    marginBottom: 16,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  version: {
    opacity: 0.5,
  },
});

export default ProfileScreen;
