/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly DISABLE_HMR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
