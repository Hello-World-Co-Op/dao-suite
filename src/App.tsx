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
import ErrorBoundary from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
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
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes - no authentication required */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/login" element={<LoginRedirect />} />

            {/* Protected routes - require authentication */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/kyc" element={<ProtectedRoute><KYC /></ProtectedRoute>} />
            <Route path="/membership/renewal" element={<ProtectedRoute><MembershipRenewal /></ProtectedRoute>} />
            <Route path="/membership/payment-history" element={<ProtectedRoute><PaymentHistory /></ProtectedRoute>} />
            <Route path="/renewal/success" element={<ProtectedRoute><RenewalSuccess /></ProtectedRoute>} />
            <Route path="/renewal/cancel" element={<ProtectedRoute><RenewalCancel /></ProtectedRoute>} />
            <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
            <Route path="/payment/cancel" element={<ProtectedRoute><PaymentCancel /></ProtectedRoute>} />
            {/* Proposal routes */}
            <Route path="/proposals" element={<ProtectedRoute><ProposalsPage /></ProtectedRoute>} />
            <Route path="/proposals/create" element={<ProtectedRoute><CreateProposalPage /></ProtectedRoute>} />
            <Route path="/proposals/draft/:draftId/edit" element={<ProtectedRoute><CreateProposalPage /></ProtectedRoute>} />
            <Route path="/proposals/draft/:draftId/confirm" element={<ProtectedRoute><SubmitConfirmation /></ProtectedRoute>} />
            <Route path="/proposals/:proposalId" element={<ProtectedRoute><ProposalDetailPage /></ProtectedRoute>} />
            {/* Notifications */}
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            {/* Burn Donation */}
            <Route path="/burn-donation" element={<ProtectedRoute><BurnDonationPage /></ProtectedRoute>} />
            {/* Escrow View */}
            <Route path="/escrow" element={<ProtectedRoute><EscrowViewPage /></ProtectedRoute>} />
            {/* Member Directory */}
            <Route path="/members" element={<ProtectedRoute><MemberDirectoryPage /></ProtectedRoute>} />
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
  );
}
