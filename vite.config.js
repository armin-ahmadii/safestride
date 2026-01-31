/**
 * Vite Configuration
 * 
 * This file configures the Vite build tool for the SafeStride application.
 * It includes the React plugin for JSX transformation and fast refresh.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
