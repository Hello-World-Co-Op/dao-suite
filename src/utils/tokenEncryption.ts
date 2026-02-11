/**
 * Token Encryption Utility
 *
 * FOS-5.6.6: Frontend Token Security
 * Encrypts authentication tokens before storing in localStorage as a fallback
 * when httpOnly cookies are not available.
 *
 * @see AC-5.6.6.5 - Tokens encrypted with per-session key
 *
 * Security model:
 * - Encryption key is generated per-session using Web Crypto API
 * - Key is stored in sessionStorage (cleared when tab/browser closes)
 * - Encrypted tokens are stored in localStorage
 * - If key is lost (session ends), tokens are unreadable and cleared
 *
 * Usage:
 * ```typescript
 * import { encryptTokens, decryptTokens, clearEncryptedTokens } from './tokenEncryption';
 *
 * // Store encrypted tokens
 * await encryptTokens({
 *   accessToken: 'abc123',
 *   refreshToken: 'xyz789',
 *   accessExpiresAt: Date.now() + 900000,
 *   refreshExpiresAt: Date.now() + 604800000,
 *   userId: 'user-123',
 * });
 *
 * // Retrieve tokens (returns null if decryption fails)
 * const tokens = await decryptTokens();
 *
 * // Clear on logout
 * clearEncryptedTokens();
 * ```
 */

// =============================================================================
// Constants
// =============================================================================

const SESSION_KEY_NAME = 'fos_token_encryption_key';
const ENCRYPTED_TOKENS_KEY = 'fos_encrypted_tokens';

/**
 * Log error with appropriate detail level
 * In production, uses generic message to avoid leaking implementation details
 */
function logError(context: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`[tokenEncryption] ${context}:`, error);
  } else {
    console.error(`[tokenEncryption] ${context} failed`);
  }
}

/**
 * Log warning with appropriate detail level
 */
function logWarn(context: string, details?: string): void {
  if (import.meta.env.DEV && details) {
    console.warn(`[tokenEncryption] ${context}: ${details}`);
  } else {
    console.warn(`[tokenEncryption] ${context}`);
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Token data structure for encryption
 */
export interface TokenData {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  userId: string;
}

/**
 * Encrypted storage format
 */
interface EncryptedPayload {
  iv: string; // Base64 encoded IV
  ciphertext: string; // Base64 encoded ciphertext
  version: number; // Schema version for future migrations
}

// =============================================================================
// Key Management
// =============================================================================

/**
 * Generate a new 256-bit encryption key
 * Uses Web Crypto API for cryptographically secure random generation
 */
async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable for storage
    ['encrypt', 'decrypt']
  );
}

/**
 * Export key to base64 for sessionStorage
 */
async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return bytesToBase64(new Uint8Array(exported));
}

/**
 * Import key from base64 sessionStorage
 */
async function importKey(keyBase64: string): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(keyBase64);
  // Use slice to get a proper ArrayBuffer from the underlying buffer
  const buffer = keyBytes.buffer.slice(
    keyBytes.byteOffset,
    keyBytes.byteOffset + keyBytes.byteLength
  ) as ArrayBuffer;
  return crypto.subtle.importKey(
    'raw',
    buffer,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable after import
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create the session encryption key
 * Key is stored in sessionStorage and cleared when tab/browser closes
 */
async function getOrCreateSessionKey(): Promise<CryptoKey> {
  try {
    const storedKey = sessionStorage.getItem(SESSION_KEY_NAME);

    if (storedKey) {
      return importKey(storedKey);
    }

    // Generate new key for this session
    const key = await generateEncryptionKey();
    const exportedKey = await exportKey(key);
    sessionStorage.setItem(SESSION_KEY_NAME, exportedKey);

    return key;
  } catch (error) {
    logError('Failed to get/create session key', error);
    throw new Error('Failed to initialize token encryption');
  }
}

/**
 * Get existing session key (for decryption)
 * Returns null if no key exists (session expired)
 */
async function getSessionKey(): Promise<CryptoKey | null> {
  try {
    const storedKey = sessionStorage.getItem(SESSION_KEY_NAME);
    if (!storedKey) {
      return null;
    }
    return importKey(storedKey);
  } catch (error) {
    logError('Failed to get session key', error);
    return null;
  }
}

// =============================================================================
// Encryption/Decryption
// =============================================================================

/**
 * Encrypt token data and store in localStorage
 *
 * @param tokens - Token data to encrypt
 * @throws Error if encryption fails
 */
export async function encryptTokens(tokens: TokenData): Promise<void> {
  try {
    const key = await getOrCreateSessionKey();

    // Serialize token data to JSON
    const plaintext = JSON.stringify(tokens);
    const plaintextBytes = new TextEncoder().encode(plaintext);

    // Generate random 12-byte IV (recommended for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt with AES-256-GCM
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // 128-bit authentication tag
      },
      key,
      plaintextBytes
    );

    // Create encrypted payload
    const payload: EncryptedPayload = {
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
      version: 1,
    };

    // Store encrypted payload in localStorage
    localStorage.setItem(ENCRYPTED_TOKENS_KEY, JSON.stringify(payload));
  } catch (error) {
    logError('Encryption failed', error);
    throw new Error('Failed to encrypt tokens');
  }
}

/**
 * Decrypt tokens from localStorage
 *
 * @returns Token data or null if decryption fails (key lost, tampered, etc.)
 */
export async function decryptTokens(): Promise<TokenData | null> {
  try {
    // Get the session key (returns null if session expired)
    const key = await getSessionKey();
    if (!key) {
      logWarn('No session key found', 'session may have expired');
      clearEncryptedTokens();
      return null;
    }

    // Get encrypted payload from localStorage
    const storedData = localStorage.getItem(ENCRYPTED_TOKENS_KEY);
    if (!storedData) {
      return null;
    }

    const payload: EncryptedPayload = JSON.parse(storedData);

    // Validate version
    if (payload.version !== 1) {
      logWarn('Unknown payload version', `version ${payload.version}`);
      clearEncryptedTokens();
      return null;
    }

    // Decode IV and ciphertext
    const iv = base64ToBytes(payload.iv);
    const ciphertext = base64ToBytes(payload.ciphertext);

    // Use slice to get proper ArrayBuffers from the underlying buffers
    const ivBuffer = iv.buffer.slice(
      iv.byteOffset,
      iv.byteOffset + iv.byteLength
    ) as ArrayBuffer;
    const ciphertextBuffer = ciphertext.buffer.slice(
      ciphertext.byteOffset,
      ciphertext.byteOffset + ciphertext.byteLength
    ) as ArrayBuffer;

    // Decrypt with AES-256-GCM (authentication tag verified automatically)
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
        tagLength: 128,
      },
      key,
      ciphertextBuffer
    );

    // Parse decrypted JSON
    const decrypted = new TextDecoder().decode(plaintext);
    return JSON.parse(decrypted) as TokenData;
  } catch (error) {
    // Decryption failed - could be wrong key, tampered data, or corrupted storage
    logWarn('Decryption failed', import.meta.env.DEV ? String(error) : undefined);
    clearEncryptedTokens();
    return null;
  }
}

/**
 * Check if encrypted tokens exist
 * Does not validate if they can be decrypted
 */
export function hasEncryptedTokens(): boolean {
  return localStorage.getItem(ENCRYPTED_TOKENS_KEY) !== null;
}

/**
 * Clear encrypted tokens and session key
 * Call this on logout or when handling decryption failures
 */
export function clearEncryptedTokens(): void {
  localStorage.removeItem(ENCRYPTED_TOKENS_KEY);
  sessionStorage.removeItem(SESSION_KEY_NAME);
}

/**
 * Check if the session key exists (session is still active)
 */
export function hasSessionKey(): boolean {
  return sessionStorage.getItem(SESSION_KEY_NAME) !== null;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert byte array to base64 string
 */
function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
  return btoa(binString);
}

/**
 * Convert base64 string to byte array
 */
function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
}

// =============================================================================
// Feature Detection
// =============================================================================

/**
 * Check if Web Crypto API is available
 * Returns false in older browsers or insecure contexts (non-HTTPS)
 */
export function isEncryptionSupported(): boolean {
  try {
    return (
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle !== 'undefined' &&
      typeof crypto.subtle.generateKey === 'function' &&
      typeof crypto.subtle.encrypt === 'function' &&
      typeof crypto.subtle.decrypt === 'function'
    );
  } catch {
    return false;
  }
}
