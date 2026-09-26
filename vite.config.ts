import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Every build gets an id, baked into the app and published as /version.json,
// so a running copy can tell when a newer release is live (see autoUpdate.ts).
const BUILD_ID = String(Date.now())
function buildVersion() {
  return {
    name: 'build-version',
    generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), buildVersion()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
})
