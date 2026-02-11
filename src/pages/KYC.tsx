import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Principal } from '@dfinity/principal';
import KYCVerification from '../components/forms/KYCVerification';
import type { KYCRecord } from '../types/user-service';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';
import { createLogger } from '../utils/logger';

const log = createLogger('KYC');

// Helper to initialize user state from localStorage
function initializeUserState(): {
  userId: Principal | null;
  error: string | null;
  shouldRedirect: boolean;
} {
  const storedData = localStorage.getItem('user_data');

  if (!storedData) {
    return { userId: null, error: null, shouldRedirect: true };
  }

  try {
    const data = JSON.parse(storedData);
    if (!data.userId) {
      return {
        userId: null,
        error: 'User ID not found. Please log in again.',
        shouldRedirect: false,
      };
    }

    // For email/password authentication, we use the anonymous principal for KYC
    // The backend will identify the user by their session
    // TODO: Once we integrate II or other IC auth, use the authenticated principal
    return { userId: Principal.anonymous(), error: null, shouldRedirect: false };
  } catch (err) {
    log.error('Failed to load user data:', err);
    return {
      userId: null,
      error: 'Failed to load user data. Please log in again.',
      shouldRedirect: false,
    };
  }
}

export default function KYC() {
  const navigate = useNavigate();

  // Use lazy initialization to check localStorage on first render
  const [initialState] = useState(() => initializeUserState());
  const { userId, error: initError, shouldRedirect } = initialState;

  // Separate state for verification errors that can occur after mount
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Combined error state
  const error = verificationError || initError;

  useEffect(() => {
    // Handle redirect to login if no stored data
    if (shouldRedirect) {
      navigate('/login');
    }
  }, [navigate, shouldRedirect]);

  const handleVerificationComplete = (record: KYCRecord) => {
    log.debug('Verification completed:', record);

    // Show success message and redirect to dashboard after 3 seconds
    setTimeout(() => {
      navigate('/dashboard');
    }, 3000);
  };

  const handleVerificationFailed = (errorMessage: string) => {
    log.error('Verification failed:', errorMessage);
    setVerificationError(errorMessage);
  };

  if (error || !userId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-6 w-6" />
                KYC Verification Error
              </CardTitle>
              <CardDescription>Unable to start identity verification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-800">
                  {error || 'User ID not found. Please log in again.'}
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button
                  onClick={() => navigate('/login')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Go to Login
                </Button>
                <Button onClick={() => navigate('/dashboard')} variant="outline">
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button onClick={() => navigate('/dashboard')} variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <ShieldCheck className="h-6 w-6" />
                Identity Verification (KYC)
              </CardTitle>
              <CardDescription className="text-blue-700">
                Complete your identity verification to access full DAO membership features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-blue-800">
                <p>
                  <strong>Why we need this:</strong> Identity verification helps us comply with
                  regulations and protect the DAO community.
                </p>
                <p>
                  <strong>What we'll collect:</strong> Basic identity information through our secure
                  partner, Persona.
                </p>
                <p>
                  <strong>Your privacy:</strong> All data is encrypted and stored securely. We never
                  sell your information.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KYC Verification Component */}
        <KYCVerification
          userId={userId}
          onVerificationComplete={handleVerificationComplete}
          onVerificationFailed={handleVerificationFailed}
        />
      </div>
    </div>
  );
}
