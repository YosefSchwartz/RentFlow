module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Transform private class properties for Hermes compatibility
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    ],
    // Ensure node_modules are also transformed
    overrides: [
      {
        test: /node_modules\/(react-native-paper|@tanstack|axios)/,
        plugins: [
          ['@babel/plugin-transform-private-methods', { loose: true }],
          ['@babel/plugin-transform-private-property-in-object', { loose: true }],
          ['@babel/plugin-transform-class-properties', { loose: true }],
        ],
      },
    ],
  };
};
