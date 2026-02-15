/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IC_HOST: string;
  readonly VITE_GOVERNANCE_CANISTER_ID: string;
  readonly VITE_MEMBERSHIP_CANISTER_ID: string;
  readonly VITE_TREASURY_CANISTER_ID: string;
  readonly VITE_TOKEN_CANISTER_ID: string;
  readonly VITE_DOM_TOKEN_CANISTER_ID: string;
  readonly VITE_IDENTITY_GATEWAY_CANISTER_ID: string;
  readonly VITE_AUTH_SERVICE_CANISTER_ID: string;
  readonly VITE_USER_SERVICE_CANISTER_ID: string;
  readonly VITE_ORACLE_BRIDGE_URL: string;
  readonly VITE_FOUNDERY_OS_URL: string;
  readonly VITE_DEV_AUTH_BYPASS: string;
  readonly VITE_E2E_AUTH_BYPASS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// PostHog analytics type declarations
interface PostHogInstance {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, properties?: Record<string, unknown>) => void;
  setPersonPropertiesForFlags: (properties: Record<string, unknown>) => void;
  opt_in_capturing: () => void;
  opt_out_capturing: () => void;
}

interface Window {
  posthog?: PostHogInstance;
}
