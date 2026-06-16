const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8081/manti-twitch',
    supportFile: false,
  },
})
