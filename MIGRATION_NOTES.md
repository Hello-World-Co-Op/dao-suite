# Migration Notes - DAO Suite Extraction (FAS-6.1)

## Overview

The dao-suite was extracted from the `frontend` monolith repository as part of the Frontend Architecture Sprint (FAS). This document captures what was extracted, from where, and key decisions made during the process.

## What Was Extracted

### From `frontend/app/www/src/`

The following modules were extracted from the frontend monolith:

**Pages** (from `pages/`):
- Dashboard, Settings, KYC, PrivacyPolicy
- MembershipRenewal, PaymentSuccess, PaymentCancel, RenewalSuccess, RenewalCancel, PaymentHistory
- ProposalsPage, ProposalDetailPage, NotificationsPage
- BurnDonationPage, EscrowViewPage, MemberDirectoryPage

**Features** (from `features/`):
- `proposal-creation/` - AI-assisted proposal wizard with Think Tank integration
- `proposals/` - Proposal listing, filtering, search, pagination
- `voting/` - Voting panel, tally display, countdown timers
- `settings/` - Notification preference management

**Components** (from `components/`):
- BurnDonation, CanisterUnavailable, ConsentBanner, ErrorBoundary
- EscrowView, MemberDirectory, NotificationBell, OfflineBanner
- ProtectedRoute, RetryButton, Toast, ToastContainer
- TokenBalance, TreasuryView, VisibilitySettings
- Payment components (PaymentStep)
- Form components (KYCVerification, PrivacyConsent)

**State Management** (from `stores/` or `@hwdao/state`):
- All nanostores atoms: drafts, proposals, votes, proposalList, toasts
- notifications, tokenBalance, treasury, burn, escrow, members, contacts

**Services** (from `services/`):
- authCookieClient, burnService, contactService, errorHandler
- escrowService, governanceCanister, memberService
- notificationPoller, thinkTank, tokenService, treasuryService

**Hooks** (from `hooks/`):
- useAuthService, useIdentityGateway, useMembershipService
- useNetworkStatus, useTreasuryService, useUserService

**Utilities** (from `utils/`):
- auth, authHelpers, analytics, cn, consent, csrf
- deviceFingerprint, env, logger, posthog, securityClear
- throttle, tokenEncryption, tokenRefreshQueue, validateReturnUrl

### UI Components (Bridge Pattern)

The following shadcn/ui-style components were copied locally rather than imported from `@hello-world-co-op/ui`:

| Local Component | Shared Package Has | Why Local |
|----------------|-------------------|-----------|
| `button.tsx` | Button (different API) | Shared has `loading` prop, different aria attrs |
| `card.tsx` | Card (different API) | Shared uses `<article>`, CardTitle uses headings |
| `alert.tsx` | Not exported | Not available in shared package |
| `tabs.tsx` | Not exported | Not available in shared package |
| `checkbox.tsx` | Checkbox (different API) | Different primitives and label integration |
| `input.tsx` | Input (different API) | Shared has built-in label and error display |
| `label.tsx` | Label (different API) | Shared has required indicator and size variants |

Each local component has a bridge pattern comment explaining why it is kept locally. Future work should converge the shadcn/ui components with the shared package API.

## Key Decisions

### 1. Local ProtectedRoute vs Shared Package

The dao-suite uses its own `ProtectedRoute` component rather than the one from `@hello-world-co-op/auth`. The local version handles:
- Token refresh with IC canister calls
- Device fingerprinting for session tracking
- localStorage-based token management

The shared package's ProtectedRoute uses a different auth context pattern (`useAuth` hook with `AuthProvider`). Migrating would require restructuring the authentication flow.

### 2. Login Redirect to FounderyOS

The dao-suite does not have its own login page. A `LoginRedirect` page was created that redirects to the FounderyOS login page (`/login`), passing the return URL so users are sent back after authentication. This mirrors the cross-suite authentication pattern.

### 3. State Management Kept Local

The nanostores state management was extracted into a local `stores/` directory rather than moved into a shared package. The state atoms are specific to the DAO dashboard features (proposals, voting, treasury, etc.) and would not be shared with other suites.

### 4. dfx.json Canister Name

The canister name was corrected from `foundery_os_suite_assets` (copy-paste from the reference implementation) to `dao_suite_assets`.

## Learnings

1. **shadcn/ui vs shared components**: The shared `@hello-world-co-op/ui` package uses different HTML semantics and API patterns than shadcn/ui. A future convergence effort should decide on one approach.

2. **Auth patterns diverge**: The monolith's auth pattern (localStorage tokens + IC canister refresh) differs from the shared `@hello-world-co-op/auth` package's pattern (context-based with `AuthProvider`). A unified auth approach should be established.

3. **Mock references**: Some test files referenced the old monolith module paths (e.g., `@hwdao/state`). These needed updating to the new local `@/stores` path.

4. **Cross-suite navigation**: Login redirects need to account for the multi-suite architecture where authentication happens in FounderyOS but the user needs to return to the originating suite.
