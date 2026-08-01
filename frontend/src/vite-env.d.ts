/// <reference types="vite/client" />

/**
 * Vite's own types: what `import.meta.env` holds, and the module declarations
 * that make `import '@/styles/dashboard.css'` type-check.
 */

interface ImportMetaEnv {
  /** Points the client at a backend somewhere other than same-origin. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
