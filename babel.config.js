// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // 👇 Reanimated plugin moved here
      'react-native-worklets/plugin',
    ],
  };
};
