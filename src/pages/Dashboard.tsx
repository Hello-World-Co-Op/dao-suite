import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  User,
  CreditCard,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Settings,
  Wallet,
  Users,
  Rocket,
  ExternalLink,
} from 'lucide-react';
import { useNotificationPoller } from '@/services/notificationPoller';
import { TokenBalance } from '@/components/TokenBalance';
import { TreasuryView } from '@/components/TreasuryView';
import { clearTokenBalance, clearTreasury, clearBurnPool, clearEscrow } from '@/stores';
import { PageHeader } from '@/components/layout';

interface UserData {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [kycVerified, setKycVerified] = useState(false);

  // Initialize notification polling for authenticated members
  // TODO: Replace with actual membership status check when membership canister is ready
  const isAuthenticated = !!userData;
  const isMember = true; // Placeholder until membership verification is implemented
  useNotificationPoller(isAuthenticated, isMember);

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

      // KYC verification is NOT yet implemented (Epic 2.0)
      // Always show as not verified until the KYC flow is complete
      // TODO: Query backend get_kyc_status() when KYC is implemented
      setKycVerified(false);
      // Clear any stale localStorage from testing
      localStorage.removeItem('kyc_status');
    } catch (error) {
      console.error('Failed to parse user data:', error);
      navigate('/login');
      return;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Derive principal from user ID for token balance fetching
  // In production, this would be the user's IC principal from Internet Identity
  // For now, we use the userId as a placeholder
  const userPrincipal = userData?.userId ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header with suite switcher - BL-010.2 */}
      <PageHeader />

      <div className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Welcome message */}
          <div className="mb-8">
            <div className="mb-4">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Welcome back, {userData.firstName}!
              </h1>
              <p className="text-gray-600">Your DAO Dashboard</p>
            </div>

            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your account is active and your data is securely encrypted.
              </AlertDescription>
            </Alert>
          </div>

          {/* Token Balance Section - Story 9-2-1 */}
          <TokenBalance principal={userPrincipal} showBurnLink={true} className="mb-6" />

          {/* Treasury View Section - Story 9-2-2 */}
          <TreasuryView className="mb-6" />

          {/* User Info Card */}
          <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>Your personal information (securely decrypted)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Name</p>
              <p className="text-lg">
                {userData.firstName} {userData.lastName}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Email</p>
              <p className="text-lg">{userData.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">User ID</p>
              <p className="text-sm font-mono text-gray-600">{userData.userId}</p>
            </div>
          </CardContent>
          </Card>

          {/* Quick Actions Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* FounderyOS Card (Story FOS-1.2.7) */}
            <Card
              className="hover:shadow-lg transition-shadow cursor-pointer md:col-span-2 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200"
              onClick={() => {
                const founderyOsUrl = import.meta.env.VITE_FOUNDERY_OS_URL || 'http://127.0.0.1:5174';
                window.location.href = founderyOsUrl;
              }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-indigo-600" />
                  FounderyOS
                  <ExternalLink className="h-4 w-4 text-indigo-400 ml-auto" />
                </CardTitle>
                <CardDescription>
                  Access your productivity suite - captures, sprints, workspaces, and AI agents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700">Open FounderyOS</Button>
              </CardContent>
            </Card>

            {/* Membership Card */}
            <Card
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/membership/renewal')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-green-600" />
                  Membership
                </CardTitle>
                <CardDescription>Manage your DAO membership and renewals</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-green-600 hover:bg-green-700">View Membership</Button>
              </CardContent>
            </Card>

            {/* Payment History Card */}
            <Card
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/membership/payment-history')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  Payment History
                </CardTitle>
                <CardDescription>View your payment records and transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  View Payments
                </Button>
              </CardContent>
            </Card>

            {/* Escrow View Card (Story 9-2-4) */}
            <Card
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/escrow')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-teal-600" />
                  My Escrows
                </CardTitle>
                <CardDescription>View escrows, milestones, and pending releases</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full border-teal-200 text-teal-700 hover:bg-teal-50"
                >
                  View Escrows
                </Button>
              </CardContent>
            </Card>

            {/* Member Directory Card (Story 9-3-1) */}
            <Card
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/members')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-teal-600" />
                Member Directory
                </CardTitle>
                <CardDescription>Browse and connect with fellow DAO members</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full border-teal-200 text-teal-700 hover:bg-teal-50"
                >
                  Browse Members
                </Button>
              </CardContent>
            </Card>

            {/* KYC Verification Card */}
            <Card
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/kyc')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck
                    className={`h-5 w-5 ${kycVerified ? 'text-green-600' : 'text-indigo-600'}`}
                  />
                  Identity Verification (KYC)
                </CardTitle>
                <CardDescription>
                  {kycVerified
                    ? 'Your identity has been verified'
                    : 'Complete KYC to unlock full membership features'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {kycVerified ? (
                  <div className="flex items-center justify-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-green-700 font-medium">Verified</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  >
                    Start KYC
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Privacy Policy Card */}
            <Card
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/privacy-policy')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  Privacy Policy
                </CardTitle>
                <CardDescription>Review our privacy practices and data handling</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Read Policy
                </Button>
              </CardContent>
            </Card>

            {/* Account Settings Card (Epic 2.2) */}
            <Card
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/settings')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-indigo-600" />
                  Account Settings
                </CardTitle>
                <CardDescription>
                  Internet Identity, self-custody, and device management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  Manage Settings
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Your data is encrypted with industry-standard AES-256-GCM encryption</p>
            <p className="mt-1">Only you can decrypt your personal information with your password</p>
          </div>
        </div>
      </div>
    </div>
  );
}
