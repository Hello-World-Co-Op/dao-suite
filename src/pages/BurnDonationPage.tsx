/**
 * Burn Donation Page
 *
 * Page wrapper for the burn donation feature.
 * Requires authenticated user (via ProtectedRoute in App.tsx).
 *
 * Story: 9-2-3-burn-donation
 * ACs: 1, 2, 3, 4, 5
 */

import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { BurnDonation } from '@/components/BurnDonation';
import { TokenBalance } from '@/components/TokenBalance';
import { useMembership } from '@/hooks/useMembership';
// Intentionally importing state utilities for potential future cleanup operations
// import { clearBurnPool, clearBurnHistory } from '@/stores';

export default function BurnDonationPage() {
  const navigate = useNavigate();
  const { icPrincipal } = useMembership();

  // BL-027.3: Use real IC principal from session (via useMembership hook)
  const userPrincipal = icPrincipal;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Navigation Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="
                inline-flex items-center gap-1.5
                text-sm text-gray-600 hover:text-gray-900
                font-medium
                focus:outline-none focus:underline
                transition-colors duration-150
              "
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <Link
              to="/dashboard"
              className="
                inline-flex items-center gap-1.5
                text-sm text-gray-600 hover:text-gray-900
                font-medium
                focus:outline-none focus:underline
                transition-colors duration-150
              "
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </div>

        {/* Token Balance Summary */}
        <TokenBalance
          principal={userPrincipal}
          showBurnLink={false}
          compact={false}
          className="mb-6"
        />

        {/* Burn Donation Component */}
        <BurnDonation />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Token burns are final and irreversible.</p>
          <p className="mt-1">Burned tokens are permanently removed from circulation.</p>
        </div>
      </div>
    </div>
  );
}
