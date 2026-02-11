/**
 * Burn Donation Page
 *
 * Page wrapper for the burn donation feature.
 * Requires authenticated user.
 *
 * Story: 9-2-3-burn-donation
 * ACs: 1, 2, 3, 4, 5
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { BurnDonation } from '@/components/BurnDonation';
import { TokenBalance } from '@/components/TokenBalance';
// Intentionally importing state utilities for potential future cleanup operations
// import { clearBurnPool, clearBurnHistory } from '@/stores';

interface UserData {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export default function BurnDonationPage() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user data from localStorage
    const storedData = localStorage.getItem('user_data');

    if (!storedData) {
      // Not logged in, redirect to login
      navigate('/login');
      return;
    }

    try {
      const data = JSON.parse(storedData) as UserData;
      setUserData(data);
    } catch (error) {
      console.error('Failed to parse user data:', error);
      navigate('/login');
      return;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Derive principal from user ID for token balance fetching
  const userPrincipal = userData?.userId ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return null; // Will redirect to login
  }

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
