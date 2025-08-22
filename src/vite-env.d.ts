/// <reference types="vite/client" />

// (Optionnel mais explicite) déclare la/les variables que tu utilises :
interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
