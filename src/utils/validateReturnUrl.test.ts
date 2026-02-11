/**
 * validateReturnUrl Tests
 *
 * Tests for return URL validation to prevent open redirect vulnerabilities.
 *
 * @see FAS-6.1 - DAO Suite extraction
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateReturnUrl } from './validateReturnUrl';

describe('validateReturnUrl', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleWarnSpy: any;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('valid paths', () => {
    it('should allow dashboard root path', () => {
      expect(validateReturnUrl('/dashboard')).toBe('/dashboard');
    });

    it('should allow dashboard subpaths', () => {
      expect(validateReturnUrl('/dashboard/overview')).toBe('/dashboard/overview');
    });

    it('should allow settings path', () => {
      expect(validateReturnUrl('/settings')).toBe('/settings');
    });

    it('should allow kyc path', () => {
      expect(validateReturnUrl('/kyc')).toBe('/kyc');
    });

    it('should allow membership paths', () => {
      expect(validateReturnUrl('/membership/renewal')).toBe('/membership/renewal');
      expect(validateReturnUrl('/membership/payment-history')).toBe(
        '/membership/payment-history'
      );
    });

    it('should allow proposals paths', () => {
      expect(validateReturnUrl('/proposals')).toBe('/proposals');
      expect(validateReturnUrl('/proposals/create')).toBe('/proposals/create');
      expect(validateReturnUrl('/proposals/123')).toBe('/proposals/123');
    });

    it('should allow notifications path', () => {
      expect(validateReturnUrl('/notifications')).toBe('/notifications');
    });

    it('should allow burn-donation path', () => {
      expect(validateReturnUrl('/burn-donation')).toBe('/burn-donation');
    });

    it('should allow escrow path', () => {
      expect(validateReturnUrl('/escrow')).toBe('/escrow');
    });

    it('should allow members path', () => {
      expect(validateReturnUrl('/members')).toBe('/members');
    });

    it('should allow payment paths', () => {
      expect(validateReturnUrl('/payment/success')).toBe('/payment/success');
      expect(validateReturnUrl('/payment/cancel')).toBe('/payment/cancel');
    });

    it('should allow renewal paths', () => {
      expect(validateReturnUrl('/renewal/success')).toBe('/renewal/success');
      expect(validateReturnUrl('/renewal/cancel')).toBe('/renewal/cancel');
    });

    it('should redirect root path to dashboard', () => {
      expect(validateReturnUrl('/')).toBe('/dashboard');
    });
  });

  describe('absolute URLs', () => {
    it('should reject http:// URLs', () => {
      expect(validateReturnUrl('http://evil.com')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Rejected absolute redirect URL:',
        'http://evil.com'
      );
    });

    it('should reject https:// URLs', () => {
      expect(validateReturnUrl('https://evil.com/phishing')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Rejected absolute redirect URL:',
        'https://evil.com/phishing'
      );
    });
  });

  describe('protocol-relative URLs', () => {
    it('should reject protocol-relative URLs', () => {
      expect(validateReturnUrl('//evil.com')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Rejected protocol-relative redirect URL:',
        '//evil.com'
      );
    });

    it('should reject protocol-relative URLs with paths', () => {
      expect(validateReturnUrl('//evil.com/phishing/path')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Rejected protocol-relative redirect URL:',
        '//evil.com/phishing/path'
      );
    });
  });

  describe('dangerous URI schemes', () => {
    it('should reject javascript: URIs', () => {
      expect(validateReturnUrl('javascript:alert(1)')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Rejected dangerous URI scheme:',
        'javascript:alert(1)'
      );
    });

    it('should reject data: URIs', () => {
      expect(validateReturnUrl('data:text/html,<script>alert(1)</script>')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Rejected dangerous URI scheme:',
        'data:text/html,<script>alert(1)</script>'
      );
    });

    it('should reject case-insensitive javascript: URIs', () => {
      expect(validateReturnUrl('JaVaScRiPt:alert(1)')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Rejected dangerous URI scheme:',
        'JaVaScRiPt:alert(1)'
      );
    });
  });

  describe('URL encoding bypass attempts', () => {
    it('should decode and reject encoded http URLs', () => {
      expect(validateReturnUrl('http%3A%2F%2Fevil.com')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Rejected absolute redirect URL:',
        'http://evil.com'
      );
    });

    it('should decode and reject encoded protocol-relative URLs', () => {
      expect(validateReturnUrl('%2F%2Fevil.com')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Rejected protocol-relative redirect URL:',
        '//evil.com'
      );
    });

    it('should decode valid paths correctly', () => {
      expect(validateReturnUrl('/dashboard%2Foverview')).toBe('/dashboard/overview');
    });
  });

  describe('non-relative paths', () => {
    it('should reject paths not starting with /', () => {
      expect(validateReturnUrl('dashboard')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Rejected non-relative path:',
        'dashboard'
      );
    });

    it('should reject paths starting with text', () => {
      expect(validateReturnUrl('evil.com')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Rejected non-relative path:',
        'evil.com'
      );
    });
  });

  describe('allowlist validation', () => {
    it('should reject paths not in allowlist', () => {
      expect(validateReturnUrl('/admin')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Redirect path not in allowlist:',
        '/admin'
      );
    });

    it('should reject unknown paths', () => {
      expect(validateReturnUrl('/unknown/path')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Redirect path not in allowlist:',
        '/unknown/path'
      );
    });
  });

  describe('null/undefined handling', () => {
    it('should return default for null', () => {
      expect(validateReturnUrl(null)).toBe('/dashboard');
    });

    it('should return default for undefined', () => {
      expect(validateReturnUrl(undefined)).toBe('/dashboard');
    });

    it('should return default for empty string', () => {
      expect(validateReturnUrl('')).toBe('/dashboard');
    });
  });

  describe('malformed input', () => {
    it('should handle malformed URL encoding', () => {
      // Invalid percent encoding
      expect(validateReturnUrl('%')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Failed to decode return URL:',
        '%'
      );
    });

    it('should handle incomplete percent encoding', () => {
      expect(validateReturnUrl('%2')).toBe('/dashboard');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Failed to decode return URL:',
        '%2'
      );
    });
  });
});
