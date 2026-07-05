import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import PropertyGallery from '../../components/media/PropertyGallery';
import type { PropertiesStackParamList } from '../../types';

type RouteType = RouteProp<PropertiesStackParamList, 'PropertyPhotos'>;

const PropertyPhotosScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<RouteType>();
  const { propertyId } = route.params;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* PropertyPhotos lives in the landlord stack, so the viewer is the owner. */}
      <PropertyGallery propertyId={propertyId} canManage />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
});

export default PropertyPhotosScreen;
