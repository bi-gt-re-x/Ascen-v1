import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * The build lives at the repo root; the app it builds lives in frontend/.
 *
 * `root` points Vite at frontend/, where index.html is, so the tooling config
 * sits beside requirements.txt and run.py rather than a level down. `envDir`
 * brings it back out to the root, so there is one .env for the whole project
 * rather than one per half.
 *
 * The dev server runs on 5090 and the API on 5050. Everything the backend owns
 * is proxied rather than called cross-origin, so the session cookie is
 * same-origin in development exactly as it is in production. `/static` is
 * proxied too, because the old pages' assets — the avatars, the 80 calendar
 * icons, the logo — are served by the backend out of utils/, and the React app
 * uses the same ones.
 *
 * The last three are *pages*, not endpoints: the ones backend/routes/pages.py
 * still renders from Jinja, listed in backend/routes/spa.py as the half React
 * has not taken over. They have to be here because of how a dev server answers
 * an unknown path — it serves index.html, so React's catch-all route sees a
 * path it does not know and redirects to /home. That is silent: the link works
 * in production, where one server owns both halves, and in development it just
 * quietly goes somewhere else. The footer's Careers and Contact Support did
 * exactly that, and so did /engine at the end of the hidden chain, which is
 * how this was noticed. Anything moved out of pages.py should lose its line
 * here at the same time.
 */
const api = {
  target: 'http://127.0.0.1:5050',
  changeOrigin: false,
};

export default defineConfig({
  root: 'frontend',
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url)),
    },
  },
  server: {
    port: 5090,
    strictPort: true,
    proxy: {
      '/api': api,
      '/static': api,
      '/auth': api,
      '/verify': api,
      '/careers': api,
      '/contact-support': api,
      '/engine': api,
    },
  },
  build: {
    // Relative to `root`, so the bundle lands in frontend/dist.
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
