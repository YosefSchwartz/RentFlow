import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RentalsStackParamList } from '../../types';
import PropertyGallery from '../../components/media/PropertyGallery';

type RouteType = RouteProp<RentalsStackParamList, 'TenantGallery'>;

/**
 * Read-only property gallery for tenants. Tenants can view media but the
 * gallery is rendered with canManage=false (no upload / delete).
 */
const TenantGalleryScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<RouteType>();
  const { propertyId } = route.params;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <PropertyGallery propertyId={propertyId} canManage={false} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
});

export default TenantGalleryScreen;
