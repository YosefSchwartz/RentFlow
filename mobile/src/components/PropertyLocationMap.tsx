import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

interface PropertyLocationMapProps {
  latitude: number;
  longitude: number;
  /** Fixed height for an embedded preview. Omit for a full-screen map (fills its container). */
  height?: number;
  /** Rounds the corners to match card styling. Set false for edge-to-edge full-screen use. */
  rounded?: boolean;
  /** Fired on a tap that isn't a drag/pinch (Leaflet distinguishes this natively). */
  onPress?: () => void;
  style?: ViewStyle;
}

// Leaflet + OpenStreetMap tiles, loaded from the public CDN — free, no API key,
// no Google dependency. Pinch-zoom/pan are Leaflet's own touch handling; a
// genuine tap (not a drag) is bridged back out via postMessage so the
// WebView doesn't have to fight React Native's gesture responder system.
function buildMapHtml(latitude: number, longitude: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #e8e8e8; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      center: [${latitude}, ${longitude}],
      zoom: 15,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    L.marker([${latitude}, ${longitude}]).addTo(map);
    map.on('click', function () {
      window.ReactNativeWebView.postMessage('map-tapped');
    });
  </script>
</body>
</html>`;
}

export const PropertyLocationMap: React.FC<PropertyLocationMapProps> = ({
  latitude,
  longitude,
  height,
  rounded = true,
  onPress,
  style,
}) => {
  const html = useMemo(() => buildMapHtml(latitude, longitude), [latitude, longitude]);

  return (
    <View
      style={[
        styles.container,
        rounded && styles.rounded,
        height ? { height } : styles.flexFill,
        style,
      ]}
    >
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        onMessage={(event) => {
          if (event.nativeEvent.data === 'map-tapped') {
            onPress?.();
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  rounded: {
    borderRadius: 12,
  },
  flexFill: {
    flex: 1,
  },
  webview: {
    backgroundColor: 'transparent',
  },
});
