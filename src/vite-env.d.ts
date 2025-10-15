/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVACY_CF_WEB_ANALYTICS?: string
  readonly VITE_PRIVACY_COMPANY_NAME?: string
  readonly VITE_PRIVACY_COMPANY_PARENTHESES_VALUE?: string
  readonly VITE_PRIVACY_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
