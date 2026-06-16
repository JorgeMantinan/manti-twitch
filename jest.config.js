module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|expo-router|@react-navigation|react-native-svg|react-native-gesture-handler|react-native-reanimated|react-native-safe-area-context|react-native-screens|react-native-web|@react-native-async-storage|expo-secure-store|socket.io-client|jwt-decode)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/helpers/'],
  moduleNameMapper: {
    '^test-renderer$': 'react-test-renderer',
    '^expo-secure-store$': '<rootDir>/__tests__/helpers/expoSecureStoreMock.js',
    '^expo-haptics$': '<rootDir>/__tests__/helpers/expoHapticsMock.js',
  },
  collectCoverageFrom: [
    'services/**/*.ts',
    'utils/**/*.ts',
    'components/**/*.tsx',
    '!**/node_modules/**',
  ],
};
