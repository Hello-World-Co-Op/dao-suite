/**
 * Member Directory Page
 *
 * Page wrapper for the member directory feature.
 * Allows browsing DAO members with search and filtering.
 *
 * Story: 9-3-1-member-directory
 * ACs: 1, 2, 3, 4, 5
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Home, Users } from 'lucide-react';
import { MemberDirectory } from '@/components/MemberDirectory';

interface UserData {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export default function MemberDirectoryPage() {
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

  // Derive principal from user ID
  const userPrincipal = userData?.userId ?? undefined;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
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

          {/* Page Title */}
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-7 w-7 text-teal-600" />
            <h1 className="text-2xl font-bold text-gray-900">Member Directory</h1>
          </div>
          <p className="text-gray-600">
            Browse and connect with fellow DAO members. Search by name, archetype, or interests.
          </p>
        </div>

        {/* Member Directory Component */}
        <MemberDirectory userPrincipal={userPrincipal} />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Members can control their profile visibility in Settings.</p>
          <p className="mt-1">Contact requests are subject to member approval.</p>
        </div>
      </div>
    </div>
  );
}
