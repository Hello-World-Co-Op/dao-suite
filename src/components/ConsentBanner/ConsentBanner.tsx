import { useState } from 'react';
import { isConsentPending, grantConsent, denyConsent, isDNTEnabled } from '../../utils/consent';

/**
 * GDPR Consent Banner
 *
 * Shows a banner asking for analytics consent when:
 * - User hasn't made a consent choice yet
 * - Do Not Track is not enabled (if DNT is on, we skip the banner)
 */
export default function ConsentBanner() {
  // Use lazy initialization to check consent status on first render
  const [showBanner, setShowBanner] = useState(() => {
    // Only show banner if consent is pending and DNT is not enabled
    return isConsentPending() && !isDNTEnabled();
  });

  const handleAccept = () => {
    grantConsent();
    setShowBanner(false);
  };

  const handleDeny = () => {
    denyConsent();
    setShowBanner(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex-1 text-sm text-gray-700">
            <p>
              <strong>We value your privacy.</strong> We use analytics to improve your experience.
              You can choose to accept or decline analytics tracking.{' '}
              <a
                href="/privacy"
                className="text-primary-800 underline hover:text-primary-900 inline-block touch-target font-medium"
              >
                Learn more
              </a>
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={handleDeny}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-2 bg-primary-700 text-white rounded-md hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
