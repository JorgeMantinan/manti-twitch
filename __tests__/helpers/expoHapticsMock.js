const Haptics = {
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
};

module.exports = Haptics;
module.exports.default = Haptics;
