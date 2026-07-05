import type { LocationData } from '../types';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// Types for Google Places API (New) responses
export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

// New Places API types
interface AutocompleteSuggestion {
  placePrediction?: {
    placeId: string;
    text: {
      text: string;
    };
    structuredFormat: {
      mainText: {
        text: string;
      };
      secondaryText: {
        text: string;
      };
    };
  };
}

interface AutocompleteNewResponse {
  suggestions?: AutocompleteSuggestion[];
  error?: {
    message: string;
  };
}

interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

interface PlaceDetailsNewResponse {
  id: string;
  formattedAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
  addressComponents: AddressComponent[];
  error?: {
    message: string;
  };
}

// Extract specific component from address_components
const getAddressComponent = (
  components: AddressComponent[],
  type: string
): string | undefined => {
  const component = components.find((c) => c.types.includes(type));
  return component?.longText;
};

export const googlePlacesApi = {
  /**
   * Search for place predictions based on input text
   * Uses Places API (New)
   * Restricted to Israel (IL)
   */
  autocomplete: async (input: string): Promise<PlacePrediction[]> => {
    if (!input.trim() || !GOOGLE_PLACES_API_KEY) {
      return [];
    }

    try {
      const response = await fetch(
        'https://places.googleapis.com/v1/places:autocomplete',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          },
          body: JSON.stringify({
            input,
            includedRegionCodes: ['IL'], // Restrict to Israel
            includedPrimaryTypes: ['street_address', 'subpremise', 'premise'],
            languageCode: 'he', // Prefer Hebrew results
          }),
        }
      );

      const data: AutocompleteNewResponse = await response.json();

      if (data.error) {
        console.error('Google Places Autocomplete error:', data.error.message);
        return [];
      }

      if (data.suggestions && data.suggestions.length > 0) {
        // Transform new API response to our expected format
        return data.suggestions
          .filter((s) => s.placePrediction)
          .map((s) => ({
            place_id: s.placePrediction!.placeId,
            description: s.placePrediction!.text.text,
            structured_formatting: {
              main_text: s.placePrediction!.structuredFormat.mainText.text,
              secondary_text: s.placePrediction!.structuredFormat.secondaryText.text,
            },
          }));
      }

      return [];
    } catch (error) {
      console.error('Google Places Autocomplete fetch error:', error);
      return [];
    }
  },

  /**
   * Get detailed place information including coordinates
   * Uses Places API (New)
   */
  getPlaceDetails: async (placeId: string): Promise<LocationData | null> => {
    if (!placeId || !GOOGLE_PLACES_API_KEY) {
      return null;
    }

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          method: 'GET',
          headers: {
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents',
          },
        }
      );

      const data: PlaceDetailsNewResponse = await response.json();

      if (data.error) {
        console.error('Google Places Details error:', data.error.message);
        return null;
      }

      if (data.formattedAddress && data.location) {
        const components = data.addressComponents || [];

        // Extract address components
        const city =
          getAddressComponent(components, 'locality') ||
          getAddressComponent(components, 'administrative_area_level_1') ||
          '';
        const street = getAddressComponent(components, 'route');
        const streetNumber = getAddressComponent(components, 'street_number');

        return {
          formattedAddress: data.formattedAddress,
          city,
          street,
          streetNumber,
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          placeId: data.id,
        };
      }

      return null;
    } catch (error) {
      console.error('Google Places Details fetch error:', error);
      return null;
    }
  },
};
