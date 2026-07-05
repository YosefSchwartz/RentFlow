const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Get the default polyfills and add our custom ones FIRST
const defaultGetPolyfills = config.serializer.getPolyfills;
config.serializer.getPolyfills = (options) => {
  const polyfills = defaultGetPolyfills ? defaultGetPolyfills(options) : [];
  return [
    // Our polyfills must come first
    path.resolve(__dirname, 'src/polyfills.js'),
    ...polyfills,
  ];
};

module.exports = config;
