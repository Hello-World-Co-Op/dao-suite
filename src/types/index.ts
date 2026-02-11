// FounderyOS suite-specific type definitions

export interface SuiteConfig {
  name: string;
  environment: 'development' | 'staging' | 'production';
}

/**
 * FounderyOS user (extends shared auth User)
 */
export interface FounderyUser {
  id: string;
  principal?: string;
  name?: string;
}

/**
 * Authentication error
 */
export interface AuthError {
  message: string;
  code?: string;
}
