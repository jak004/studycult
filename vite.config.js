import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    // The default 'forks' pool hangs on this Windows setup (times out
    // starting worker processes); 'threads' works reliably.
    pool: 'threads',
    // The default 5000ms is too tight on this machine under load — component
    // tests that simulate several user.type()/click() interactions were
    // intermittently timing out (a different test each run) despite being
    // functionally correct, confirmed by re-running them in isolation with a
    // longer timeout and seeing a clean pass every time.
    testTimeout: 15000,
  },
})
