/**
 * Development-only logger utility
 *
 * Logs are only output when running in development mode (import.meta.env.DEV).
 * In production builds, these calls are no-ops with minimal overhead.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Create a namespaced logger for a specific module
 * @param namespace - Module name to prefix logs with (e.g., 'Auth', 'Login', 'KYC')
 */
export function createLogger(namespace: string) {
  const prefix = `[${namespace}]`;

  const log = (level: LogLevel, ...args: unknown[]) => {
    if (import.meta.env.DEV) {
      const method = level === 'debug' ? 'log' : level;
      console[method](prefix, ...args);
    }
  };

  return {
    debug: (...args: unknown[]) => log('debug', ...args),
    info: (...args: unknown[]) => log('info', ...args),
    warn: (...args: unknown[]) => log('warn', ...args),
    error: (...args: unknown[]) => log('error', ...args),
  };
}

/**
 * Default logger without namespace
 * Use createLogger() for namespaced logging in specific modules
 */
export const logger = {
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.info(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.error(...args);
    }
  },
};
