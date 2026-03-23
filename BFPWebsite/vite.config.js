import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build-time safety check: prevent production w/o API config
const validateConfig = () => {
  const mode = (process.env.VITE_API_ADAPTER_MODE || '').trim().toLowerCase()
  const baseUrl = (process.env.VITE_APPS_SCRIPT_BASE_URL || '').trim()

  if (mode === 'live' && !baseUrl) {
    throw new Error(
      `[Config Safety] Live mode enabled (VITE_API_ADAPTER_MODE=live) but VITE_APPS_SCRIPT_BASE_URL is not set. ` +
      `This prevents accidental production deployment without API configuration. ` +
      `Set VITE_APPS_SCRIPT_BASE_URL in .env.local or disable live mode.`
    )
  }
}

// Run validation during build
validateConfig()

export default defineConfig({
  plugins: [react()],
})
