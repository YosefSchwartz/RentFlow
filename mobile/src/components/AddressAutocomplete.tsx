import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  ScrollView,
} from 'react-native';
import {
  TextInput,
  Text,
  useTheme,
  ActivityIndicator,
  HelperText,
} from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { googlePlacesApi, PlacePrediction } from '../api/googlePlaces';
import type { LocationData } from '../types';

interface AddressAutocompleteProps {
  value: LocationData | null;
  onChange: (location: LocationData | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

const DEBOUNCE_DELAY = 250;

// Format display address (shorter, cleaner version)
const formatDisplayAddress = (location: LocationData): string => {
  const parts: string[] = [];
  if (location.street) {
    parts.push(location.street);
    if (location.streetNumber) {
      parts[0] = `${location.street} ${location.streetNumber}`;
    }
  }
  if (location.city) {
    parts.push(location.city);
  }
  return parts.length > 0 ? parts.join(', ') : location.formattedAddress;
};

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  label,
  placeholder,
  error,
  disabled = false,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState(
    value ? formatDisplayAddress(value) : ''
  );
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search function
  const searchPlaces = useCallback(async (text: string) => {
    if (text.length < 2) {
      setPredictions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    setFetchError(null);

    try {
      const results = await googlePlacesApi.autocomplete(text);
      setPredictions(results);
      setShowSuggestions(results.length > 0);
    } catch (err) {
      setFetchError(t('address.searchError'));
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const handleChangeText = useCallback(
    (text: string) => {
      setInputValue(text);

      // Clear selected location if user is typing
      if (value) {
        onChange(null);
      }

      // Debounce the search
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        searchPlaces(text);
      }, DEBOUNCE_DELAY);
    },
    [value, onChange, searchPlaces]
  );

  const handleSelectPrediction = useCallback(
    async (prediction: PlacePrediction) => {
      Keyboard.dismiss();
      setShowSuggestions(false);
      setIsLoading(true);

      try {
        const locationData = await googlePlacesApi.getPlaceDetails(
          prediction.place_id
        );

        if (locationData) {
          setInputValue(formatDisplayAddress(locationData));
          onChange(locationData);
          setFetchError(null);
        } else {
          setFetchError(t('address.detailsError'));
        }
      } catch (err) {
        setFetchError(t('address.detailsError'));
      } finally {
        setIsLoading(false);
      }
    },
    [onChange, t]
  );

  const handleClear = useCallback(() => {
    setInputValue('');
    setPredictions([]);
    setShowSuggestions(false);
    onChange(null);
  }, [onChange]);

  const handleFocus = useCallback(() => {
    if (predictions.length > 0 && !value) {
      setShowSuggestions(true);
    }
  }, [predictions.length, value]);

  const handleBlur = useCallback(() => {
    // Delay hiding to allow tap on suggestion
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  }, []);

  const renderPrediction = (item: PlacePrediction, index: number) => (
    <TouchableOpacity
      key={item.place_id}
      style={[
        styles.predictionItem,
        { borderBottomColor: theme.colors.outlineVariant },
        index === predictions.length - 1 && styles.lastPredictionItem,
      ]}
      onPress={() => handleSelectPrediction(item)}
      activeOpacity={0.7}
    >
      <Icon
        name="map-marker"
        size={20}
        color={theme.colors.primary}
        style={styles.predictionIcon}
      />
      <View style={styles.predictionText}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {item.structured_formatting.main_text}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
          numberOfLines={1}
        >
          {item.structured_formatting.secondary_text}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        label={label || t('address.label')}
        value={inputValue}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        mode="outlined"
        placeholder={placeholder || t('address.placeholder')}
        disabled={disabled}
        error={!!error}
        right={
          isLoading ? (
            <TextInput.Icon icon={() => <ActivityIndicator size={20} />} />
          ) : inputValue ? (
            <TextInput.Icon icon="close" onPress={handleClear} />
          ) : (
            <TextInput.Icon icon="magnify" />
          )
        }
        left={
          value ? (
            <TextInput.Icon
              icon="check-circle"
              color={theme.colors.primary}
            />
          ) : undefined
        }
      />

      {error && (
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
      )}

      {fetchError && (
        <HelperText type="error" visible={!!fetchError}>
          {fetchError}
        </HelperText>
      )}

      {showSuggestions && predictions.length > 0 && (
        <View
          style={[
            styles.suggestionsContainer,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline,
            },
          ]}
        >
          <ScrollView
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {predictions.map((item, index) => renderPrediction(item, index))}
          </ScrollView>
        </View>
      )}

      {value && (
        <View style={styles.selectedInfo}>
          <Icon
            name="check-circle"
            size={16}
            color={theme.colors.primary}
            style={styles.selectedIcon}
          />
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t('address.selected')}: {value.city}
            {value.street && `, ${value.street}`}
            {value.streetNumber && ` ${value.streetNumber}`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 16,
    zIndex: 1000,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 1001,
  },
  suggestionsList: {
    borderRadius: 8,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  lastPredictionItem: {
    borderBottomWidth: 0,
  },
  predictionIcon: {
    marginRight: 12,
  },
  predictionText: {
    flex: 1,
  },
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  selectedIcon: {
    marginRight: 6,
  },
});

export default AddressAutocomplete;
