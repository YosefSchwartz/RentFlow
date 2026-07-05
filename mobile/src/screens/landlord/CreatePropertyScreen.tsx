import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, useTheme, Checkbox } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useCreateProperty } from '../../hooks/useProperties';
import AddressAutocomplete from '../../components/AddressAutocomplete';
import KeyboardAwareScrollView from '../../components/KeyboardAwareScrollView';
import type { PropertiesStackParamList, LocationData } from '../../types';

type NavigationProp = NativeStackNavigationProp<PropertiesStackParamList>;

const CreatePropertyScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const createProperty = useCreateProperty();

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [squareMeters, setSquareMeters] = useState('');
  const [rooms, setRooms] = useState('');
  const [floor, setFloor] = useState('');
  const [hasBalcony, setHasBalcony] = useState(false);
  const [hasParking, setHasParking] = useState(false);
  const [hasStorage, setHasStorage] = useState(false);
  const [hasShelter, setHasShelter] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  const handleCreate = async () => {
    // Reset errors
    setError(null);
    setAddressError(null);

    // Validate required fields
    if (!title.trim()) {
      setError(t('properties.errors.fillRequired'));
      return;
    }

    // Validate address selection
    if (!location) {
      setAddressError(t('address.required'));
      return;
    }

    const sqm = parseInt(squareMeters, 10);
    if (isNaN(sqm) || sqm < 1 || sqm > 10000) {
      setError(t('properties.errors.squareMetersRange'));
      return;
    }

    const roomCount = parseInt(rooms, 10);
    if (isNaN(roomCount) || roomCount < 1 || roomCount > 50) {
      setError(t('properties.errors.roomsRange'));
      return;
    }

    let floorNumber: number | undefined;
    if (floor.trim()) {
      floorNumber = parseInt(floor, 10);
      if (isNaN(floorNumber) || floorNumber < -5 || floorNumber > 200) {
        setError(t('properties.errors.floorRange'));
        return;
      }
    }

    if (title.length > 100) {
      setError(t('properties.errors.titleMaxLength'));
      return;
    }

    if (notes.length > 1000) {
      setError(t('properties.errors.notesMaxLength'));
      return;
    }

    try {
      await createProperty.mutateAsync({
        title: title.trim(),
        location,
        squareMeters: sqm,
        rooms: roomCount,
        floor: floorNumber,
        hasBalcony,
        hasParking,
        hasStorage,
        hasShelter,
        notes: notes.trim() || undefined,
      });
      navigation.goBack();
    } catch (err: any) {
      setError(err.response?.data?.message || t('properties.errors.createFailed'));
    }
  };

  return (
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
        <View style={styles.form}>
          <TextInput
            label={`${t('properties.propertyTitle')} *`}
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
            placeholder={t('properties.placeholders.title')}
            maxLength={100}
          />

          <AddressAutocomplete
            value={location}
            onChange={(loc) => {
              setLocation(loc);
              if (loc) {
                setAddressError(null);
              }
            }}
            error={addressError || undefined}
          />

          <View style={styles.row}>
            <TextInput
              label={`${t('properties.squareMeters')} *`}
              value={squareMeters}
              onChangeText={setSquareMeters}
              mode="outlined"
              style={[styles.input, styles.halfInput]}
              keyboardType="numeric"
              placeholder={t('properties.placeholders.squareMeters')}
            />

            <TextInput
              label={`${t('properties.rooms')} *`}
              value={rooms}
              onChangeText={setRooms}
              mode="outlined"
              style={[styles.input, styles.halfInput]}
              keyboardType="numeric"
              placeholder={t('properties.placeholders.rooms')}
            />
          </View>

          <TextInput
            label={t('properties.floor')}
            value={floor}
            onChangeText={setFloor}
            mode="outlined"
            style={styles.input}
            keyboardType="numeric"
            placeholder={t('properties.placeholders.floor')}
          />

          <Text variant="titleSmall" style={styles.sectionTitle}>
            {t('properties.amenities')}
          </Text>

          <View style={styles.checkboxRow}>
            <Checkbox.Item
              label={t('properties.balcony')}
              status={hasBalcony ? 'checked' : 'unchecked'}
              onPress={() => setHasBalcony(!hasBalcony)}
              style={styles.checkbox}
            />
          </View>

          <View style={styles.checkboxRow}>
            <Checkbox.Item
              label={t('properties.parking')}
              status={hasParking ? 'checked' : 'unchecked'}
              onPress={() => setHasParking(!hasParking)}
              style={styles.checkbox}
            />
          </View>

          <View style={styles.checkboxRow}>
            <Checkbox.Item
              label={t('properties.storage')}
              status={hasStorage ? 'checked' : 'unchecked'}
              onPress={() => setHasStorage(!hasStorage)}
              style={styles.checkbox}
            />
          </View>

          <View style={styles.checkboxRow}>
            <Checkbox.Item
              label={t('properties.shelter')}
              status={hasShelter ? 'checked' : 'unchecked'}
              onPress={() => setHasShelter(!hasShelter)}
              style={styles.checkbox}
            />
          </View>

          <TextInput
            label={t('properties.notes')}
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={3}
            maxLength={1000}
          />

          {error && (
            <Text style={[styles.error, { color: theme.colors.error }]}>
              {error}
            </Text>
          )}

          <Button
            mode="contained"
            onPress={handleCreate}
            loading={createProperty.isPending}
            disabled={createProperty.isPending}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {t('properties.createProperty')}
          </Button>
        </View>
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  form: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    marginBottom: 16,
  },
  halfInput: {
    flex: 1,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 8,
    fontWeight: '600',
  },
  checkboxRow: {
    marginLeft: -8,
  },
  checkbox: {
    paddingVertical: 0,
  },
  error: {
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});

export default CreatePropertyScreen;
