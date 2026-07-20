import React from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Button, useTheme } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { PropertyLocationMap } from '../../components';
import type { PropertyMapParams } from '../../types';

type RouteType = RouteProp<{ PropertyMap: PropertyMapParams }, 'PropertyMap'>;

const PropertyMapScreen: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const route = useRoute<RouteType>();
  const { latitude, longitude } = route.params;

  const handleOpenInGoogleMaps = () => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PropertyLocationMap latitude={latitude} longitude={longitude} rounded={false} />
      <View style={[styles.footer, { backgroundColor: theme.colors.surface }]}>
        <Button mode="contained" icon="google-maps" onPress={handleOpenInGoogleMaps}>
          {t('propertyMap.openInGoogleMaps')}
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  footer: {
    padding: 16,
  },
});

export default PropertyMapScreen;
