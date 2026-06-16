globalThis.expo = globalThis.expo || {
  modules: {},
  SharedObject: class {},
  SharedRef: class {},
};

function installExpoGlobalPolyfill() {
  if (!globalThis.expo) {
    globalThis.expo = { modules: {} };
  }
}

module.exports = { installExpoGlobalPolyfill };
