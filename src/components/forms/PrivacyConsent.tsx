import React from 'react';
import { cn } from '../../utils/cn';

interface PrivacyConsentProps {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Callback when checkbox state changes */
  onChange: (checked: boolean) => void;
  /** Optional CSS class */
  className?: string;
  /** Optional ID for the checkbox */
  id?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * GDPR Privacy Consent Component (Story 2.0.5)
 *
 * Displays a checkbox for users to consent to KYC data processing.
 * Must be checked before initiating KYC verification.
 *
 * GDPR Compliance:
 * - Article 13-14: Transparency - clear information about data usage
 * - Article 7: Consent - user must explicitly consent before data processing
 * - Links to privacy policy with details about KYC provider and data retention
 *
 * @example
 * const [consent, setConsent] = useState(false);
 * <PrivacyConsent checked={consent} onChange={setConsent} />
 */
export default function PrivacyConsent({
  checked,
  onChange,
  className,
  id = 'privacy-consent',
  testId = 'privacy-consent',
}: PrivacyConsentProps) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      {/* Checkbox */}
      <input
        type="checkbox"
        id={id}
        data-testid={testId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          'mt-1 h-5 w-5 rounded border-gray-300',
          'text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'cursor-pointer transition-colors',
          'min-w-[20px] min-h-[20px]' // Touch target size
        )}
        aria-describedby={`${id}-description`}
      />

      {/* Label */}
      <label
        htmlFor={id}
        id={`${id}-description`}
        className="text-sm text-gray-700 leading-relaxed cursor-pointer select-none"
      >
        I consent to the processing of my personal data for identity verification purposes. I
        understand that my data will be processed by our KYC provider (Persona) and stored securely
        for up to 7 years as required by law.{' '}
        <a
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'text-blue-600 hover:text-blue-700 underline',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded',
            'inline-block min-h-[20px]' // Touch target
          )}
          onClick={(e) => e.stopPropagation()} // Prevent checkbox toggle when clicking link
        >
          Read our Privacy Policy
        </a>{' '}
        for more information.
      </label>
    </div>
  );
}
