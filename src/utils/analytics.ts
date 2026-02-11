/**
 * Analytics Tracking Utility
 *
 * Supports multiple analytics providers:
 * - Google Analytics (gtag)
 * - Mixpanel
 * - Custom backend endpoint
 */

// Type-safe property value types for analytics
type AnalyticsPropertyValue = string | number | boolean | null | undefined | Date;
type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

// Extend Window interface for analytics providers (posthog already declared by posthog-js)
interface MixpanelInstance {
  track: (event: string, properties?: AnalyticsProperties) => void;
  identify: (userId: string) => void;
  people: {
    set: (properties: AnalyticsProperties) => void;
  };
}

type GtagFunction = (command: string, targetOrEvent: string, config?: AnalyticsProperties) => void;

declare global {
  interface Window {
    gtag?: GtagFunction;
    mixpanel?: MixpanelInstance;
  }
}

export interface AnalyticsEvent {
  event: string;
  properties?: AnalyticsProperties;
}

/**
 * Track an analytics event
 */
export function trackEvent(event: string, properties?: AnalyticsProperties): void {
  const eventData = {
    ...properties,
    timestamp: new Date().toISOString(),
  };

  // Log to console in development
  if (import.meta.env.DEV) {
    console.log('📊 Analytics Event:', event, eventData);
  }

  // PostHog
  if (typeof window !== 'undefined' && window.posthog) {
    window.posthog.capture(event, eventData);
  }

  // Google Analytics (gtag)
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event, eventData);
  }

  // Mixpanel
  if (typeof window !== 'undefined' && window.mixpanel) {
    window.mixpanel.track(event, eventData);
  }

  // Custom backend endpoint (optional)
  sendToBackend(event, eventData);
}

/**
 * Track page view
 */
export function trackPageView(pageName: string): void {
  trackEvent('page_view', {
    page_name: pageName,
    page_path: window.location.pathname,
    page_url: window.location.href,
  });
}

/**
 * Track form submission
 */
export function trackFormSubmit(formType: string, success: boolean, errorMessage?: string): void {
  trackEvent('form_submit', {
    form_type: formType,
    success,
    error_message: errorMessage,
  });
}

/**
 * Track email verification
 */
export function trackEmailVerification(success: boolean, errorMessage?: string): void {
  trackEvent('email_verification', {
    success,
    error_message: errorMessage,
  });
}

/**
 * Track CTA button click
 */
export function trackCTAClick(buttonName: string, location: string): void {
  trackEvent('cta_click', {
    button_name: buttonName,
    location,
  });
}

/**
 * Track form field interaction
 */
export function trackFormFieldInteraction(fieldName: string): void {
  trackEvent('form_field_interaction', {
    field_name: fieldName,
  });
}

/**
 * Send event to custom backend endpoint
 */
async function sendToBackend(event: string, data: AnalyticsProperties): Promise<void> {
  // Optional: Send to your own analytics backend
  const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;

  if (!analyticsEndpoint) {
    return; // No custom endpoint configured
  }

  try {
    await fetch(analyticsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event,
        data,
        user_id: getUserId(),
      }),
    });
  } catch (error) {
    // Silently fail - don't break user experience for analytics
    if (import.meta.env.DEV) {
      console.error('Failed to send analytics to backend:', error);
    }
  }
}

/**
 * Get or create anonymous user ID for tracking
 */
function getUserId(): string {
  const USER_ID_KEY = 'analytics_user_id';

  let userId = localStorage.getItem(USER_ID_KEY);

  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }

  return userId;
}

/**
 * Set user properties (for when they verify email)
 */
export function setUserProperties(properties: AnalyticsProperties): void {
  // PostHog - use setPersonPropertiesForFlags for setting person properties
  // Note: With person_profiles: 'identified_only', properties are set via identify()
  if (typeof window !== 'undefined' && window.posthog) {
    try {
      // PostHog's correct method for setting person properties
      window.posthog.setPersonPropertiesForFlags(properties);
    } catch (error) {
      // Fallback: properties will be set via identify() call
      console.warn('PostHog setPersonPropertiesForFlags failed:', error);
    }
  }

  // Google Analytics
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('set', 'user_properties', properties);
  }

  // Mixpanel
  if (typeof window !== 'undefined' && window.mixpanel) {
    window.mixpanel.people.set(properties);
  }
}

/**
 * Identify user (call after email verification)
 */
export function identifyUser(email: string): void {
  const userId = getUserId();

  // PostHog
  if (typeof window !== 'undefined' && window.posthog) {
    window.posthog.identify(userId, {
      email: email,
      email_domain: email.split('@')[1],
    });
  }

  // Google Analytics
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', import.meta.env.VITE_GA_MEASUREMENT_ID as string, {
      user_id: userId,
    });
  }

  // Mixpanel
  if (typeof window !== 'undefined' && window.mixpanel) {
    window.mixpanel.identify(userId);
    window.mixpanel.people.set({
      $email: email,
      $last_login: new Date(),
    });
  }

  setUserProperties({
    verified_email: true,
    email_domain: email.split('@')[1],
  });
}

// ============================================================================
// Notification Analytics (Story 9-1-7)
// ============================================================================

/**
 * Track when a notification is received/created
 */
export function trackNotificationReceived(type: string, proposalId?: string): void {
  trackEvent('notification_received', {
    notification_type: type,
    proposal_id: proposalId,
  });
}

/**
 * Track when a notification is clicked
 */
export function trackNotificationClicked(
  type: string,
  proposalId?: string,
  wasRead: boolean = false
): void {
  trackEvent('notification_clicked', {
    notification_type: type,
    proposal_id: proposalId,
    was_read: wasRead,
  });
}

/**
 * Track when notification preferences are changed
 */
export function trackNotificationPreferencesChanged(setting: string, enabled: boolean): void {
  trackEvent('notification_preferences_changed', {
    setting,
    enabled,
  });
}

/**
 * Track when notifications are marked as read
 */
export function trackNotificationsMarkedRead(count: number, isMarkAll: boolean = false): void {
  trackEvent('notifications_marked_read', {
    count,
    is_mark_all: isMarkAll,
  });
}
