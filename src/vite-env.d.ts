/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_SECRET_TOKEN: string;
  readonly PUBLIC_APP_URL: string;
  // add others as needed...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
