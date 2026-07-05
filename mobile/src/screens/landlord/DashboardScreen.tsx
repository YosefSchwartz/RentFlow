import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, FAB, useTheme, ActivityIndicator, Portal, Dialog, Button, Menu, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useProperties, useDeleteProperty } from '../../hooks/useProperties';
import type { Property, PropertiesStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<PropertiesStackParamList>;

const DashboardScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { data: properties, isLoading, refetch, isRefetching } = useProperties();
  const deleteProperty = useDeleteProperty();

  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  const openMenu = (propertyId: string) => setMenuVisible(propertyId);
  const closeMenu = () => setMenuVisible(null);

  const handleEdit = (property: Property) => {
    closeMenu();
    navigation.navigate('EditProperty', { propertyId: property.id });
  };

  const handleDeletePress = (property: Property) => {
    closeMenu();
    setPropertyToDelete(property);
    setDeleteDialogVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (propertyToDelete) {
      try {
        await deleteProperty.mutateAsync(propertyToDelete.id);
      } catch (error) {
        console.error('Failed to delete property:', error);
      }
    }
    setDeleteDialogVisible(false);
    setPropertyToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogVisible(false);
    setPropertyToDelete(null);
  };

  const renderProperty = ({ item }: { item: Property }) => (
    <Card
      style={styles.card}
      mode="elevated"
      onPress={() => navigation.navigate('PropertyDetails', { propertyId: item.id })}
    >
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon name="home" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text variant="titleMedium" numberOfLines={1}>
              {item.title}
            </Text>
            <Text variant="bodySmall" style={styles.address} numberOfLines={1}>
              {item.address}, {item.city}
            </Text>
          </View>
          <Menu
            visible={menuVisible === item.id}
            onDismiss={closeMenu}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={24}
                onPress={() => openMenu(item.id)}
              />
            }
          >
            <Menu.Item
              onPress={() => handleEdit(item)}
              title={t('common.edit')}
              leadingIcon="pencil"
            />
            <Menu.Item
              onPress={() => handleDeletePress(item)}
              title={t('common.delete')}
              leadingIcon="trash-can"
              titleStyle={{ color: theme.colors.error }}
            />
          </Menu>
        </View>
      </Card.Content>
    </Card>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="home-plus" size={64} color={theme.colors.outline} />
      <Text variant="titleMedium" style={styles.emptyTitle}>
        {t('properties.noProperties')}
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        {t('properties.addFirstProperty')}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          {t('properties.title')}
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {t('properties.propertyCount', { count: properties?.length || 0 })}
        </Text>
      </View>

      <FlatList
        data={properties}
        renderItem={renderProperty}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate('CreateProperty')}
      />

      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={handleDeleteCancel}>
          <Dialog.Icon icon="alert" />
          <Dialog.Title style={styles.dialogTitle}>{t('properties.deleteProperty')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t('properties.deleteConfirm', { title: propertyToDelete?.title })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleDeleteCancel}>{t('common.cancel')}</Button>
            <Button
              onPress={handleDeleteConfirm}
              textColor={theme.colors.error}
              loading={deleteProperty.isPending}
            >
              {t('common.delete')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
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
  list: {
    padding: 16,
    paddingTop: 0,
    flexGrow: 1,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  address: {
    opacity: 0.7,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
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
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  dialogTitle: {
    textAlign: 'center',
  },
});

export default DashboardScreen;
