import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme, Badge } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import type {
  MainTabParamList,
  PropertiesStackParamList,
  RentalsStackParamList,
  ProfileStackParamList,
} from '../types';
import { getSelectedExperience } from '../screens/ExperienceSelectionScreen';
import { useUnreadNotificationsCount } from '../hooks/useNotifications';

// Landlord screens
import DashboardScreen from '../screens/landlord/DashboardScreen';
import PropertyDetailsScreen from '../screens/landlord/PropertyDetailsScreen';
import PropertyLeasesScreen from '../screens/landlord/PropertyLeasesScreen';
import PropertyPhotosScreen from '../screens/landlord/PropertyPhotosScreen';
import PropertyDocumentsScreen from '../screens/landlord/PropertyDocumentsScreen';
import PropertyMaintenanceScreen from '../screens/landlord/PropertyMaintenanceScreen';
import CreatePropertyScreen from '../screens/landlord/CreatePropertyScreen';
import EditPropertyScreen from '../screens/landlord/EditPropertyScreen';
import LeaseActivationCodeScreen from '../screens/landlord/LeaseActivationCodeScreen';
import CreateLeaseScreen from '../screens/landlord/CreateLeaseScreen';

// Tenant screens
import MyRentalsScreen from '../screens/tenant/MyRentalsScreen';
import JoinPropertyScreen from '../screens/tenant/JoinPropertyScreen';
import TenantHomeScreen from '../screens/tenant/TenantHomeScreen';
import LeaseDetailsScreen from '../screens/tenant/LeaseDetailsScreen';
import TenantDocumentsScreen from '../screens/tenant/TenantDocumentsScreen';
import TenantGalleryScreen from '../screens/tenant/TenantGalleryScreen';
import TenantMaintenanceScreen from '../screens/tenant/TenantMaintenanceScreen';
import CreateMaintenanceScreen from '../screens/tenant/CreateMaintenanceScreen';

// Shared screens
import ProfileScreen from '../screens/shared/ProfileScreen';
import EditProfileScreen from '../screens/shared/EditProfileScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import MaintenanceDetailScreen from '../screens/shared/MaintenanceDetailScreen';
import PropertyMapScreen from '../screens/shared/PropertyMapScreen';

// Profile tab icon with notification badge
const ProfileTabIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => {
  const { data: unreadCount } = useUnreadNotificationsCount();
  const theme = useTheme();

  return (
    <View>
      <Icon name="account" color={color} size={size} />
      {unreadCount != null && unreadCount > 0 && (
        <Badge
          size={16}
          style={[
            styles.badge,
            { backgroundColor: theme.colors.error },
          ]}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </Badge>
      )}
    </View>
  );
};

// Stack navigators
const PropertiesStack = createNativeStackNavigator<PropertiesStackParamList>();
const RentalsStack = createNativeStackNavigator<RentalsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Properties Stack Navigator (Landlord experience)
const PropertiesNavigator: React.FC = () => {
  return (
    <PropertiesStack.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Back',
      }}
    >
      <PropertiesStack.Screen
        name="PropertiesList"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <PropertiesStack.Screen
        name="PropertyDetails"
        component={PropertyDetailsScreen}
        options={{ title: 'Property Details' }}
      />
      <PropertiesStack.Screen
        name="PropertyLeases"
        component={PropertyLeasesScreen}
        options={{ title: 'Leases' }}
      />
      <PropertiesStack.Screen
        name="PropertyPhotos"
        component={PropertyPhotosScreen}
        options={{ title: 'Photos' }}
      />
      <PropertiesStack.Screen
        name="PropertyDocuments"
        component={PropertyDocumentsScreen}
        options={{ title: 'Documents' }}
      />
      <PropertiesStack.Screen
        name="PropertyMaintenance"
        component={PropertyMaintenanceScreen}
        options={{ title: 'Maintenance' }}
      />
      <PropertiesStack.Screen
        name="CreateProperty"
        component={CreatePropertyScreen}
        options={{ title: 'Add Property' }}
      />
      <PropertiesStack.Screen
        name="EditProperty"
        component={EditPropertyScreen}
        options={{ title: 'Edit Property' }}
      />
      <PropertiesStack.Screen
        name="LeaseActivationCode"
        component={LeaseActivationCodeScreen}
        options={{ title: 'Activation Code' }}
      />
      <PropertiesStack.Screen
        name="CreateLease"
        component={CreateLeaseScreen}
        options={{ title: 'Create Lease' }}
      />
      <PropertiesStack.Screen
        name="MaintenanceDetail"
        component={MaintenanceDetailScreen}
        options={{ title: 'Maintenance' }}
      />
      <PropertiesStack.Screen
        name="PropertyMap"
        component={PropertyMapScreen}
        options={({ route }) => ({ title: route.params.address })}
      />
    </PropertiesStack.Navigator>
  );
};

// Rentals Stack Navigator (Tenant experience)
const RentalsNavigator: React.FC = () => {
  return (
    <RentalsStack.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Back',
      }}
    >
      <RentalsStack.Screen
        name="RentalsList"
        component={MyRentalsScreen}
        options={{ headerShown: false }}
      />
      <RentalsStack.Screen
        name="JoinProperty"
        component={JoinPropertyScreen}
        options={{ title: 'Join Property' }}
      />
      <RentalsStack.Screen
        name="TenantHome"
        component={TenantHomeScreen}
        options={{ title: 'My Home' }}
      />
      <RentalsStack.Screen
        name="LeaseDetails"
        component={LeaseDetailsScreen}
        options={{ title: 'Lease Details' }}
      />
      <RentalsStack.Screen
        name="TenantDocuments"
        component={TenantDocumentsScreen}
        options={{ title: 'Documents' }}
      />
      <RentalsStack.Screen
        name="TenantGallery"
        component={TenantGalleryScreen}
        options={{ title: 'Photos' }}
      />
      <RentalsStack.Screen
        name="TenantMaintenance"
        component={TenantMaintenanceScreen}
        options={{ title: 'Maintenance' }}
      />
      <RentalsStack.Screen
        name="CreateMaintenanceRequest"
        component={CreateMaintenanceScreen}
        options={{ title: 'Report Issue' }}
      />
      <RentalsStack.Screen
        name="MaintenanceDetail"
        component={MaintenanceDetailScreen}
        options={{ title: 'Maintenance' }}
      />
      <RentalsStack.Screen
        name="PropertyMap"
        component={PropertyMapScreen}
        options={({ route }) => ({ title: route.params.address })}
      />
    </RentalsStack.Navigator>
  );
};

// Profile Stack Navigator
const ProfileNavigator: React.FC = () => {
  const { t } = useTranslation();

  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Back',
      }}
    >
      <ProfileStack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: t('profile.editProfile.title') }}
      />
      <ProfileStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <ProfileStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
    </ProfileStack.Navigator>
  );
};

// Main Tab Navigator
export const MainNavigator: React.FC = () => {
  const theme = useTheme();
  const selectedExperience = getSelectedExperience();

  // Determine initial route based on selected experience
  const getInitialRouteName = (): keyof MainTabParamList => {
    if (selectedExperience === 'rentals') {
      return 'Rentals';
    }
    return 'Properties';
  };

  return (
    <Tab.Navigator
      initialRouteName={getInitialRouteName()}
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.outline,
        headerShown: false,
      }}
    >
      {/* Properties Tab - Always show (user can become landlord) */}
      <Tab.Screen
        name="Properties"
        component={PropertiesNavigator}
        options={{
          tabBarLabel: 'Properties',
          tabBarIcon: ({ color, size }) => (
            <Icon name="home-city" color={color} size={size} />
          ),
        }}
      />

      {/* Rentals Tab - Always show (user can join properties as tenant) */}
      <Tab.Screen
        name="Rentals"
        component={RentalsNavigator}
        options={{
          tabBarLabel: 'Rentals',
          tabBarIcon: ({ color, size }) => (
            <Icon name="key" color={color} size={size} />
          ),
        }}
      />

      {/* Profile Tab - Always show */}
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <ProfileTabIcon color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
  },
});
