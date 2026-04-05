import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
const buildDate = new Date().toISOString().split('T')[0]

// Update this string when making notable changes
const changelog = "Växtdetaljer med Wikipedia-info, delat state"

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(`v${pkg.version} – ${buildDate}`),
    __APP_CHANGELOG__: JSON.stringify(changelog),
  },
})
