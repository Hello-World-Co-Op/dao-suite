export const ENV = {
  IC_HOST: import.meta.env.VITE_IC_HOST ?? 'http://127.0.0.1:4943',
  AUTH_CANISTER_ID: import.meta.env.VITE_AUTH_CANISTER_ID ?? '',
  AUTH_SERVICE_CANISTER_ID: import.meta.env.VITE_AUTH_SERVICE_CANISTER_ID ?? '',
  USER_CANISTER_ID: import.meta.env.VITE_USER_CANISTER_ID ?? '',
  FOUNDERY_OS_CORE_CANISTER_ID: import.meta.env.VITE_FOUNDERY_OS_CORE_CANISTER_ID ?? '',
  DAO_ADMIN_CANISTER_ID: import.meta.env.VITE_DAO_ADMIN_CANISTER_ID ?? '',
  DAO_FRONTEND_URL: import.meta.env.VITE_DAO_FRONTEND_URL ?? 'http://127.0.0.1:5173',
  FOUNDERY_OS_URL: import.meta.env.VITE_FOUNDERY_OS_URL ?? 'http://127.0.0.1:5174',
  AGENTS_SERVICE_URL: import.meta.env.VITE_AGENTS_SERVICE_URL ?? 'http://localhost:3001',
  ENVIRONMENT: import.meta.env.VITE_ENVIRONMENT ?? 'development',
} as const;
