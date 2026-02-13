/**
 * DAO Suite - Root Application Component
 *
 * Wraps the router with ErrorBoundary for consistent error handling.
 * Uses route-based code splitting for optimal performance.
 * Protected routes require authentication via ProtectedRoute wrapper.
 *
 * @see FAS-6.1 - Create and Deploy dao-suite
 */

import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@hello-world-co-op/auth';
import ErrorBoundary from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout';
import { ToastContainer } from './components/ToastContainer';
import { OfflineBannerStandalone } from './components/OfflineBanner';

// Route-based code splitting - each page loads on demand
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const KYC = lazy(() => import('./pages/KYC'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const MembershipRenewal = lazy(() => import('./pages/MembershipRenewal'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentCancel = lazy(() => import('./pages/PaymentCancel'));
const RenewalSuccess = lazy(() => import('./pages/RenewalSuccess'));
const RenewalCancel = lazy(() => import('./pages/RenewalCancel'));
const PaymentHistory = lazy(() => import('./pages/PaymentHistory'));
const LoginRedirect = lazy(() => import('./pages/LoginRedirect'));

// Proposal routes (Governance)
const ProposalsPage = lazy(() => import('./pages/ProposalsPage'));
const CreateProposalPage = lazy(
  () => import('./features/proposal-creation/components/CreateProposalPage')
);
const SubmitConfirmation = lazy(
  () => import('./features/proposal-creation/components/SubmitConfirmation')
);
const ProposalDetailPage = lazy(() => import('./pages/ProposalDetailPage'));

// Notifications
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));

// Burn Donation
const BurnDonationPage = lazy(() => import('./pages/BurnDonationPage'));

// Escrow View
const EscrowViewPage = lazy(() => import('./pages/EscrowViewPage'));

// Member Directory
const MemberDirectoryPage = lazy(() => import('./pages/MemberDirectoryPage'));

// Loading fallback for lazy-loaded routes
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider config={{ apiBaseUrl: import.meta.env.VITE_ORACLE_BRIDGE_URL }}>
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes - no authentication required */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/login" element={<LoginRedirect />} />

            {/* Protected routes - require authentication, wrapped with AppLayout (PageHeader + Outlet) */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/kyc" element={<KYC />} />
              <Route path="/membership/renewal" element={<MembershipRenewal />} />
              <Route path="/membership/payment-history" element={<PaymentHistory />} />
              <Route path="/renewal/success" element={<RenewalSuccess />} />
              <Route path="/renewal/cancel" element={<RenewalCancel />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/payment/cancel" element={<PaymentCancel />} />
              {/* Proposal routes */}
              <Route path="/proposals" element={<ProposalsPage />} />
              <Route path="/proposals/create" element={<CreateProposalPage />} />
              <Route path="/proposals/draft/:draftId/edit" element={<CreateProposalPage />} />
              <Route path="/proposals/draft/:draftId/confirm" element={<SubmitConfirmation />} />
              <Route path="/proposals/:proposalId" element={<ProposalDetailPage />} />
              {/* Notifications */}
              <Route path="/notifications" element={<NotificationsPage />} />
              {/* Burn Donation */}
              <Route path="/burn-donation" element={<BurnDonationPage />} />
              {/* Escrow View */}
              <Route path="/escrow" element={<EscrowViewPage />} />
              {/* Member Directory */}
              <Route path="/members" element={<MemberDirectoryPage />} />
            </Route>
          </Routes>
        </Suspense>
        {/* Global toast container for notifications */}
        <ToastContainer position="top-right" />
        {/* Global offline indicator */}
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-auto max-w-md pointer-events-none">
          <div className="pointer-events-auto">
            <OfflineBannerStandalone />
          </div>
        </div>
      </ErrorBoundary>
    </BrowserRouter>
    </AuthProvider>
  );
}
