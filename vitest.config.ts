import { defineConfig, mergeConfig } from 'vitest/config'
import { createVitestConfig } from '@lynx-js/react/testing-library/vitest-config'

const defaultConfig = await createVitestConfig()
const config = defineConfig({
  resolve: {
    alias: {
      react: "/src/react-shim.js",
    },
  },
  test: {},
})

export default mergeConfig(defaultConfig, config)
