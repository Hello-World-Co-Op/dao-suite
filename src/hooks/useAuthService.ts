import { useMemo } from 'react';
import { HttpAgent, Actor } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';

// Types for auth-service
export interface LoginResponse {
  success: boolean;
  message: string;
  access_token: [] | [string];
  refresh_token: [] | [string];
  access_expires_at: [] | [bigint];
  refresh_expires_at: [] | [bigint];
  user_id: [] | [string];
}

export interface RefreshTokenRequest {
  refresh_token: string;
  device_fingerprint: string;
  ip_address: [] | [string];
  timezone: [] | [string];
  user_agent: [] | [string];
}

export interface RefreshTokenResponse {
  success: boolean;
  access_token: [] | [string];
  refresh_token: [] | [string];
  access_expires_at: [] | [bigint];
  refresh_expires_at: [] | [bigint];
  message: string;
}

export type DeviceTrust = 'New' | 'Trusted' | 'Verified';

export interface TrustedDevice {
  fingerprint: string;
  first_seen: bigint;
  last_seen: bigint;
  device_name: [] | [string];
  trust_level: { [K in DeviceTrust]: null };
  user_agent: [] | [string];
}

export interface AuthServiceActor {
  login_email_password: (
    email: string,
    password: string,
    device_fingerprint: string,
    ip_address: [] | [string],
    timezone: [] | [string],
    user_agent: [] | [string]
  ) => Promise<LoginResponse>;

  refresh_tokens: (request: RefreshTokenRequest) => Promise<RefreshTokenResponse>;

  validate_access_token: (access_token: string) => Promise<{ Ok: string } | { Err: string }>;

  logout: (session_id: string) => Promise<{ Ok: null } | { Err: string }>;

  logout_all: (user_id: string) => Promise<{ Ok: bigint } | { Err: string }>;

  logout_other_sessions: (
    current_access_token: string
  ) => Promise<{ Ok: bigint } | { Err: string }>;

  remove_other_devices: (current_access_token: string) => Promise<{ Ok: bigint } | { Err: string }>;

  get_user_devices: (user_id: string) => Promise<TrustedDevice[]>;
}

// Candid interface definition for auth-service
// Cast to InterfaceFactory to satisfy Actor.createActor type requirements
const idlFactory = (({ IDL }: { IDL: typeof import('@dfinity/candid').IDL }) => {
  const LoginResponse = IDL.Record({
    success: IDL.Bool,
    message: IDL.Text,
    access_token: IDL.Opt(IDL.Text),
    refresh_token: IDL.Opt(IDL.Text),
    access_expires_at: IDL.Opt(IDL.Nat64),
    refresh_expires_at: IDL.Opt(IDL.Nat64),
    user_id: IDL.Opt(IDL.Text),
  });

  const RefreshTokenRequest = IDL.Record({
    refresh_token: IDL.Text,
    device_fingerprint: IDL.Text,
    ip_address: IDL.Opt(IDL.Text),
    timezone: IDL.Opt(IDL.Text),
    user_agent: IDL.Opt(IDL.Text),
  });

  const RefreshTokenResponse = IDL.Record({
    success: IDL.Bool,
    access_token: IDL.Opt(IDL.Text),
    refresh_token: IDL.Opt(IDL.Text),
    access_expires_at: IDL.Opt(IDL.Nat64),
    refresh_expires_at: IDL.Opt(IDL.Nat64),
    message: IDL.Text,
  });

  const DeviceTrust = IDL.Variant({
    New: IDL.Null,
    Trusted: IDL.Null,
    Verified: IDL.Null,
  });

  const TrustedDevice = IDL.Record({
    fingerprint: IDL.Text,
    first_seen: IDL.Nat64,
    last_seen: IDL.Nat64,
    device_name: IDL.Opt(IDL.Text),
    trust_level: DeviceTrust,
    user_agent: IDL.Opt(IDL.Text),
  });

  return IDL.Service({
    login_email_password: IDL.Func(
      [IDL.Text, IDL.Text, IDL.Text, IDL.Opt(IDL.Text), IDL.Opt(IDL.Text), IDL.Opt(IDL.Text)],
      [LoginResponse],
      []
    ),
    refresh_tokens: IDL.Func([RefreshTokenRequest], [RefreshTokenResponse], []),
    validate_access_token: IDL.Func(
      [IDL.Text],
      [IDL.Variant({ Ok: IDL.Text, Err: IDL.Text })],
      ['query']
    ),
    logout: IDL.Func([IDL.Text], [IDL.Variant({ Ok: IDL.Null, Err: IDL.Text })], []),
    logout_all: IDL.Func([IDL.Text], [IDL.Variant({ Ok: IDL.Nat64, Err: IDL.Text })], []),
    logout_other_sessions: IDL.Func(
      [IDL.Text],
      [IDL.Variant({ Ok: IDL.Nat64, Err: IDL.Text })],
      []
    ),
    remove_other_devices: IDL.Func([IDL.Text], [IDL.Variant({ Ok: IDL.Nat64, Err: IDL.Text })], []),
    get_user_devices: IDL.Func([IDL.Text], [IDL.Vec(TrustedDevice)], ['query']),
  });
}) as unknown as IDL.InterfaceFactory;

/**
 * Hook to interact with the auth-service canister
 */
export function useAuthService() {
  const actor = useMemo(() => {
    // Get canister ID from environment variables
    const canisterId = import.meta.env.VITE_AUTH_SERVICE_CANISTER_ID;

    if (!canisterId) {
      console.warn('VITE_AUTH_SERVICE_CANISTER_ID not set, using placeholder');
      // Return a mock actor for development
      return null;
    }

    // Create agent (local or IC mainnet based on environment)
    const isLocal = import.meta.env.VITE_DFX_NETWORK === 'local';
    const host = isLocal ? 'http://127.0.0.1:4943' : 'https://ic0.app';

    const agent = new HttpAgent({ host });

    // Fetch root key for local development (required for local testing)
    if (isLocal) {
      agent.fetchRootKey().catch((err) => {
        console.warn(
          'Unable to fetch root key. Check to ensure that your local replica is running'
        );
        console.error(err);
      });
    }

    // Create and return the actor
    return Actor.createActor<AuthServiceActor>(idlFactory, {
      agent,
      canisterId,
    });
  }, []);

  /**
   * Login with email and password
   */
  const loginEmailPassword = async (
    email: string,
    password: string,
    deviceFingerprint: string,
    ipAddress?: string,
    timezone?: string,
    userAgent?: string
  ): Promise<LoginResponse> => {
    if (!actor) {
      throw new Error('Auth service not configured');
    }

    try {
      const response = await actor.login_email_password(
        email,
        password,
        deviceFingerprint,
        ipAddress ? [ipAddress] : [],
        timezone ? [timezone] : [],
        userAgent ? [userAgent] : []
      );

      return response;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  /**
   * Refresh authentication tokens
   */
  const refreshTokens = async (
    refreshToken: string,
    deviceFingerprint: string,
    ipAddress?: string,
    timezone?: string,
    userAgent?: string
  ): Promise<RefreshTokenResponse> => {
    if (!actor) {
      throw new Error('Auth service not configured');
    }

    try {
      const response = await actor.refresh_tokens({
        refresh_token: refreshToken,
        device_fingerprint: deviceFingerprint,
        ip_address: ipAddress ? [ipAddress] : [],
        timezone: timezone ? [timezone] : [],
        user_agent: userAgent ? [userAgent] : [],
      });

      return response;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  };

  /**
   * Validate an access token
   */
  const validateAccessToken = async (accessToken: string): Promise<string> => {
    if (!actor) {
      throw new Error('Auth service not configured');
    }

    try {
      const response = await actor.validate_access_token(accessToken);

      if ('Ok' in response) {
        return response.Ok;
      } else {
        throw new Error(response.Err);
      }
    } catch (error) {
      console.error('Token validation failed:', error);
      throw error;
    }
  };

  /**
   * Logout (invalidate session)
   */
  const logout = async (sessionId: string): Promise<void> => {
    if (!actor) {
      throw new Error('Auth service not configured');
    }

    try {
      const response = await actor.logout(sessionId);

      if ('Err' in response) {
        throw new Error(response.Err);
      }
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  /**
   * Logout all devices
   */
  const logoutAll = async (userId: string): Promise<number> => {
    if (!actor) {
      throw new Error('Auth service not configured');
    }

    try {
      const response = await actor.logout_all(userId);

      if ('Ok' in response) {
        return Number(response.Ok);
      } else {
        throw new Error(response.Err);
      }
    } catch (error) {
      console.error('Logout all failed:', error);
      throw error;
    }
  };

  /**
   * Logout all other sessions except the current one
   */
  const logoutOtherSessions = async (currentAccessToken: string): Promise<number> => {
    if (!actor) {
      throw new Error('Auth service not configured');
    }

    try {
      const response = await actor.logout_other_sessions(currentAccessToken);

      if ('Ok' in response) {
        return Number(response.Ok);
      } else {
        throw new Error(response.Err);
      }
    } catch (error) {
      console.error('Logout other sessions failed:', error);
      throw error;
    }
  };

  /**
   * Remove all other devices except the current one
   */
  const removeOtherDevices = async (currentAccessToken: string): Promise<number> => {
    if (!actor) {
      throw new Error('Auth service not configured');
    }

    try {
      const response = await actor.remove_other_devices(currentAccessToken);

      if ('Ok' in response) {
        return Number(response.Ok);
      } else {
        throw new Error(response.Err);
      }
    } catch (error) {
      console.error('Remove other devices failed:', error);
      throw error;
    }
  };

  /**
   * Get user devices (for email/password authentication)
   */
  const getUserDevices = async (userId: string): Promise<TrustedDevice[]> => {
    if (!actor) {
      throw new Error('Auth service not configured');
    }

    try {
      const devices = await actor.get_user_devices(userId);
      return devices;
    } catch (error) {
      console.error('Get user devices failed:', error);
      throw error;
    }
  };

  return {
    actor,
    loginEmailPassword,
    refreshTokens,
    validateAccessToken,
    logout,
    logoutAll,
    logoutOtherSessions,
    removeOtherDevices,
    getUserDevices,
  };
}
