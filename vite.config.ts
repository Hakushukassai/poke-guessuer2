import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages (project site): https://<user>.github.io/poke-guessuer2/
export default defineConfig({
  base: '/poke-guessuer2/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
