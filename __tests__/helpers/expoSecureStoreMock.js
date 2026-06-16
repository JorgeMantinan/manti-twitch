const ExpoSecureStore = {
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
};

module.exports = ExpoSecureStore;
module.exports.default = ExpoSecureStore;
