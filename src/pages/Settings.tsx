import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthClient } from '@dfinity/auth-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useIdentityGateway,
  type DeviceRecord as _DeviceRecord,
} from '../hooks/useIdentityGateway';
import { useAuthService, type TrustedDevice as _TrustedDevice } from '../hooks/useAuthService';
import { useUserService } from '../hooks/useUserService';
import { withAuthErrorHandler, isAuthError, handleSessionExpired } from '../utils/authHelpers';
import { createLogger } from '../utils/logger';
import {
  Settings as SettingsIcon,
  Link as LinkIcon,
  Unlink,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import { NotificationSettings } from '@/features/settings/components/NotificationSettings';
import { VisibilitySettings } from '@/components/VisibilitySettings';

const log = createLogger('Settings');

interface UserData {
  userId: string;
  accessToken: string;
  email: string;
  firstName: string;
  lastName: string;
}

// Unified device interface for display
interface DisplayDevice {
  id: string;
  name: string;
  registeredAt: Date;
  lastUsedAt: Date;
  isActive: boolean;
  trustLevel?: string;
  userAgent?: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get initial tab from URL query param or default to 'identity'
  const initialTab = useMemo(() => {
    const tabParam = searchParams.get('tab');
    const validTabs = ['identity', 'custody', 'devices', 'notifications', 'privacy'];
    return tabParam && validTabs.includes(tabParam) ? tabParam : 'identity';
  }, [searchParams]);
  const identityGateway = useIdentityGateway();
  const authService = useAuthService();
  const userService = useUserService();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Internet Identity state
  const [iiLinked, setIiLinked] = useState(false);
  const [iiLinking, setIiLinking] = useState(false);
  const [iiMessage, setIiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Self-custody state
  const [selfCustodyStatus, setSelfCustodyStatus] = useState<
    'verified' | 'expired' | 'never' | 'loading'
  >('loading');
  const [selfCustodyVerifying, setSelfCustodyVerifying] = useState(false);
  const [selfCustodyMessage, setSelfCustodyMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Device management state
  const [devices, setDevices] = useState<DisplayDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deviceMessage, setDeviceMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    // Load user data from localStorage
    const storedData = localStorage.getItem('user_data');

    if (!storedData) {
      navigate('/login');
      return;
    }

    try {
      const data = JSON.parse(storedData) as UserData;
      setUserData(data);

      // Check II linking status from backend using user_id
      const checkIIStatus = async () => {
        try {
          const isLinked = await userService.getIILinkStatus(data.userId);
          setIiLinked(isLinked);
          // Sync with localStorage
          if (isLinked) {
            localStorage.setItem('ii_linked', 'true');
          } else {
            localStorage.removeItem('ii_linked');
          }
        } catch (error) {
          log.debug('Failed to check II status from backend:', error);
          // Fall back to localStorage only if backend fails
          const iiStatus = localStorage.getItem('ii_linked');
          setIiLinked(iiStatus === 'true');
        }
      };
      checkIIStatus();

      // Load self-custody status (would need to call user-service)
      // For now, mock it
      setSelfCustodyStatus('never');

      // Load devices
      loadDevices(data.userId);
    } catch (error) {
      console.error('Failed to parse user data:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadDevices intentionally excluded; runs once on mount
  }, [navigate]);

  const loadDevices = async (userId: string) => {
    setDevicesLoading(true);
    try {
      await withAuthErrorHandler(async () => {
        // For email/password logins, devices are tracked in auth-service
        const trustedDevices = await authService.getUserDevices(userId);

        // Convert TrustedDevice[] to DisplayDevice[]
        const displayDevices: DisplayDevice[] = trustedDevices.map((device): DisplayDevice => {
          // Extract trust level from variant
          const trustLevel = Object.keys(device.trust_level)[0] || 'Unknown';

          return {
            id: device.fingerprint,
            name:
              device.device_name.length > 0 && device.device_name[0]
                ? device.device_name[0]
                : 'Unknown Device',
            registeredAt: new Date(Number(device.first_seen) / 1000000), // Convert nanoseconds to milliseconds
            lastUsedAt: new Date(Number(device.last_seen) / 1000000),
            isActive: true, // All devices returned by get_user_devices are active
            trustLevel,
            userAgent:
              device.user_agent.length > 0 && device.user_agent[0]
                ? device.user_agent[0]
                : undefined,
          };
        });

        setDevices(displayDevices);
      }, '/settings');
    } catch (error) {
      // Auth errors are handled by withAuthErrorHandler
      if (!isAuthError(error)) {
        console.error('Error loading devices:', error);
      }
    } finally {
      setDevicesLoading(false);
    }
  };

  const handleLinkII = async () => {
    if (!userData) {
      setIiMessage({ type: 'error', text: 'User data not found. Please log in again.' });
      return;
    }

    if (!userData.accessToken) {
      setIiMessage({ type: 'error', text: 'Access token not found. Please log in again.' });
      console.error('Missing accessToken in userData:', userData);
      return;
    }

    setIiLinking(true);
    setIiMessage(null);

    try {
      // Create an auth client
      const authClient = await AuthClient.create();

      // Start II login
      await authClient.login({
        identityProvider: 'https://identity.ic0.app',
        onSuccess: async () => {
          try {
            await withAuthErrorHandler(async () => {
              // Get the principal for delegation
              const identity = authClient.getIdentity();
              const principal = identity.getPrincipal().toText();

              // Create delegation data in format: "challenge:principal:delegation_data"
              // For testing/simplified implementation as per identity-gateway lib.rs:241
              const timestamp = Date.now();
              const challenge = `ch-${timestamp}`;
              const delegationData = `${challenge}:${principal}:delegationData`;

              log.debug('Linking II with principal:', principal);
              log.debug('Using accessToken:', userData.accessToken ? 'present' : 'MISSING');
              log.debug('Delegation format:', delegationData);

              // Link to account
              const result = await identityGateway.linkInternetIdentity(
                userData.accessToken,
                delegationData
              );

              if (result.success) {
                setIiLinked(true);
                localStorage.setItem('ii_linked', 'true');
                setIiMessage({ type: 'success', text: 'Internet Identity linked successfully!' });
              } else {
                // Check if the error is a token expiration - redirect to login
                if (isAuthError(result.message)) {
                  handleSessionExpired(
                    'Your session has expired. Please sign in again.',
                    '/settings'
                  );
                  return;
                }
                setIiMessage({
                  type: 'error',
                  text: result.message || 'Failed to link Internet Identity',
                });
              }
            }, '/settings');
          } catch (linkError) {
            // Auth errors are handled by withAuthErrorHandler and will redirect
            if (!isAuthError(linkError)) {
              console.error('Error during II linking:', linkError);
              setIiMessage({ type: 'error', text: `Failed to link: ${linkError}` });
            }
          } finally {
            setIiLinking(false);
          }
        },
        onError: (error) => {
          console.error('II login error:', error);
          setIiMessage({ type: 'error', text: 'Failed to authenticate with Internet Identity' });
          setIiLinking(false);
        },
      });
    } catch (error) {
      console.error('Link II error:', error);
      setIiMessage({ type: 'error', text: `Error: ${error}` });
      setIiLinking(false);
    }
  };

  const handleUnlinkII = async () => {
    if (!userData) return;

    setIiLinking(true);
    setIiMessage(null);

    try {
      await withAuthErrorHandler(async () => {
        const result = await identityGateway.unlinkInternetIdentity(userData.accessToken);

        if (result.success) {
          setIiLinked(false);
          localStorage.removeItem('ii_linked');
          setIiMessage({ type: 'success', text: 'Internet Identity unlinked successfully' });
        } else {
          setIiMessage({
            type: 'error',
            text: result.message || 'Failed to unlink Internet Identity',
          });
        }
      }, '/settings');
    } catch (error) {
      // Auth errors are handled by withAuthErrorHandler
      if (!isAuthError(error)) {
        console.error('Unlink II error:', error);
        setIiMessage({ type: 'error', text: `Error: ${error}` });
      }
    } finally {
      setIiLinking(false);
    }
  };

  const handleVerifySelfCustody = async () => {
    if (!userData) return;

    setSelfCustodyVerifying(true);
    setSelfCustodyMessage(null);

    try {
      // IMPORTANT: Open II popup FIRST (synchronously with user click) to avoid popup blocker
      // Then get challenge and complete verification in onSuccess callback
      const authClient = await AuthClient.create();

      await authClient.login({
        identityProvider: 'https://identity.ic0.app',
        onSuccess: async () => {
          try {
            // Get the identity principal
            const identity = authClient.getIdentity();
            const principal = identity.getPrincipal().toText();

            // NOW get the challenge from the canister (after popup is open)
            const beginResult = await identityGateway.beginSelfCustodyVerification(
              userData.accessToken
            );

            if ('Err' in beginResult) {
              if (isAuthError(beginResult.Err)) {
                handleSessionExpired(
                  'Your session has expired. Please sign in again.',
                  '/settings'
                );
                return;
              }
              setSelfCustodyMessage({ type: 'error', text: beginResult.Err });
              setSelfCustodyVerifying(false);
              return;
            }

            const challenge = beginResult.Ok;

            // Create signature in delegation format (backend expects "challenge:principal:delegation_data")
            const signature = `${challenge}:${principal}:delegationData`;

            // Complete verification
            const completeResult = await identityGateway.completeSelfCustodyVerification(
              userData.accessToken,
              signature
            );

            if (completeResult.success) {
              setSelfCustodyStatus('verified');
              setSelfCustodyMessage({
                type: 'success',
                text: 'Self-custody verified! Your voting rights are now active.',
              });
            } else {
              // Check for auth errors
              if (isAuthError(completeResult.message)) {
                handleSessionExpired(
                  'Your session has expired. Please sign in again.',
                  '/settings'
                );
                return;
              }
              setSelfCustodyMessage({
                type: 'error',
                text: completeResult.message || 'Failed to verify self-custody',
              });
            }
          } catch (error) {
            setSelfCustodyMessage({ type: 'error', text: `Error: ${error}` });
          } finally {
            setSelfCustodyVerifying(false);
          }
        },
        onError: () => {
          setSelfCustodyMessage({ type: 'error', text: 'Failed to verify with Internet Identity' });
          setSelfCustodyVerifying(false);
        },
      });
    } catch (error) {
      setSelfCustodyMessage({ type: 'error', text: `Error: ${error}` });
      setSelfCustodyVerifying(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!userData) return;

    setDeviceMessage(null);

    try {
      // Note: Auth-service tracks sessions, not individual devices by fingerprint.
      // To revoke a specific device, we'd need the session_id, not the fingerprint.
      // For now, show a message that individual device revocation requires logging out all.
      log.debug('Attempting to revoke device:', deviceId);
      setDeviceMessage({
        type: 'error',
        text: 'Individual device revocation is not yet supported. Use "Revoke All Other Devices" to log out all sessions.',
      });
    } catch (error) {
      console.error('Revoke device error:', error);
      setDeviceMessage({ type: 'error', text: `Error: ${error}` });
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (!userData) return;

    setDeviceMessage(null);

    try {
      // Use auth-service removeOtherDevices to revoke all devices and sessions except current
      const removedCount = await authService.removeOtherDevices(userData.accessToken);
      setDeviceMessage({
        type: 'success',
        text: `Successfully removed ${removedCount} other device(s) and their sessions. Your current session remains active.`,
      });
      // Refresh devices list
      await loadDevices(userData.userId);
    } catch (error) {
      console.error('Remove other devices error:', error);
      setDeviceMessage({ type: 'error', text: `Error: ${error}` });
    }
  };

  if (loading || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-800">Account Settings</h1>
          </div>
          <p className="text-gray-600">Manage your Internet Identity and security settings</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="identity">Internet Identity</TabsTrigger>
            <TabsTrigger value="custody">Self-Custody</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
          </TabsList>

          {/* Internet Identity Tab */}
          <TabsContent value="identity">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Link Internet Identity
                </CardTitle>
                <CardDescription>
                  Connect your Internet Identity for seamless authentication across IC applications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {iiMessage && (
                  <Alert variant={iiMessage.type === 'error' ? 'destructive' : 'default'}>
                    {iiMessage.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>{iiMessage.text}</AlertDescription>
                  </Alert>
                )}

                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Status</p>
                      <p className="text-sm text-gray-600">
                        {iiLinked
                          ? 'Internet Identity is linked to your account'
                          : 'No Internet Identity linked'}
                      </p>
                    </div>
                    <div>
                      {iiLinked ? (
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                      ) : (
                        <XCircle className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  {!iiLinked ? (
                    <Button onClick={handleLinkII} disabled={iiLinking} className="w-full">
                      {iiLinking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Linking...
                        </>
                      ) : (
                        <>
                          <LinkIcon className="mr-2 h-4 w-4" />
                          Link Internet Identity
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleUnlinkII}
                      disabled={iiLinking}
                      variant="destructive"
                      className="w-full"
                    >
                      {iiLinking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Unlinking...
                        </>
                      ) : (
                        <>
                          <Unlink className="mr-2 h-4 w-4" />
                          Unlink Internet Identity
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Self-Custody Tab */}
          <TabsContent value="custody">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Self-Custody Verification
                </CardTitle>
                <CardDescription>
                  Verify self-custody of your wallet to enable full voting rights in governance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selfCustodyMessage && (
                  <Alert variant={selfCustodyMessage.type === 'error' ? 'destructive' : 'default'}>
                    {selfCustodyMessage.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>{selfCustodyMessage.text}</AlertDescription>
                  </Alert>
                )}

                {selfCustodyStatus !== 'verified' && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertTriangle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Self-custody verification is required for full voting rights. Verification
                      expires after 90 days.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Verification Status</p>
                      <p className="text-sm text-gray-600">
                        {selfCustodyStatus === 'verified' && 'Verified - voting rights active'}
                        {selfCustodyStatus === 'expired' && 'Expired - please re-verify'}
                        {selfCustodyStatus === 'never' && 'Not verified - voting rights inactive'}
                        {selfCustodyStatus === 'loading' && 'Loading...'}
                      </p>
                    </div>
                    <div>
                      {selfCustodyStatus === 'verified' && (
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                      )}
                      {selfCustodyStatus === 'expired' && (
                        <AlertTriangle className="h-8 w-8 text-yellow-600" />
                      )}
                      {selfCustodyStatus === 'never' && (
                        <XCircle className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleVerifySelfCustody}
                    disabled={selfCustodyVerifying}
                    className="w-full"
                  >
                    {selfCustodyVerifying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {selfCustodyStatus === 'verified'
                          ? 'Re-verify Self-Custody'
                          : 'Verify Self-Custody'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Devices Tab */}
          <TabsContent value="devices">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Device Management
                </CardTitle>
                <CardDescription>Manage devices that can access your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {deviceMessage && (
                  <Alert variant={deviceMessage.type === 'error' ? 'destructive' : 'default'}>
                    {deviceMessage.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>{deviceMessage.text}</AlertDescription>
                  </Alert>
                )}

                {devicesLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : devices.length === 0 ? (
                  <div className="text-center p-8 text-gray-500">No devices found</div>
                ) : (
                  <div className="space-y-3">
                    {devices.map((device) => (
                      <div
                        key={device.id}
                        className="p-4 border rounded-lg flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <Smartphone
                            className={`h-5 w-5 ${device.isActive ? 'text-green-600' : 'text-gray-400'}`}
                          />
                          <div>
                            <p className="font-medium">{device.name}</p>
                            <p className="text-sm text-gray-500">
                              Last used: {device.lastUsedAt.toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-400">
                              {device.isActive ? 'Active' : 'Revoked'}{' '}
                              {device.trustLevel && `• ${device.trustLevel}`}
                            </p>
                          </div>
                        </div>
                        {device.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeDevice(device.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {devices.length > 1 && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={handleRevokeOtherSessions}
                      className="w-full text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove All Other Devices
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy">
            <VisibilitySettings userPrincipal={userData?.userId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
