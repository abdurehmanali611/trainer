// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
config.transformer.inlineRem = 16;

// Bind to lowercase function variable to map NativeWind v5 compilation
module.exports = withNativewind(config);
