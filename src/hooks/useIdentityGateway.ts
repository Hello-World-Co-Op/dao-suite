import { useMemo } from 'react';
import { HttpAgent, Actor, type ActorSubclass } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';

// TypeScript types matching identity_gateway.did
export interface SessionTokens {
  access_token: string;
  refresh_token: string;
}

export interface DeviceRecord {
  device_id: string;
  device_name: string;
  registered_at: bigint;
  last_used_at: bigint;
  is_active: boolean;
}

export interface IdentityGatewayActor {
  // Health check
  health: () => Promise<string>;
  sessions_count: () => Promise<bigint>;

  // Internet Identity authentication (Story 2.2.1)
  ii_login_begin: () => Promise<{ Ok: string } | { Err: string }>;
  ii_login_complete: (delegation_chain: string) => Promise<{ Ok: SessionTokens } | { Err: string }>;

  // Internet Identity account linking (Story 2.2.2)
  link_internet_identity: (
    session_token: string,
    ii_delegation: string
  ) => Promise<{ Ok: null } | { Err: string }>;
  unlink_internet_identity: (session_token: string) => Promise<{ Ok: null } | { Err: string }>;

  // Self-custody verification (Story 2.2.3)
  begin_self_custody_verification: (
    session_token: string
  ) => Promise<{ Ok: string } | { Err: string }>;
  complete_self_custody_verification: (
    session_token: string,
    signature: string
  ) => Promise<{ Ok: null } | { Err: string }>;

  // Multi-device management (Story 2.2.4)
  get_user_devices: (user_id: string) => Promise<{ Ok: DeviceRecord[] } | { Err: string }>;
  revoke_device: (
    session_token: string,
    device_id: string
  ) => Promise<{ Ok: null } | { Err: string }>;
  revoke_all_devices_except: (
    session_token: string,
    current_device_id: string
  ) => Promise<{ Ok: null } | { Err: string }>;
}

// Candid interface definition for identity-gateway
// Cast to InterfaceFactory to satisfy Actor.createActor type requirements
const idlFactory = (({ IDL }: { IDL: typeof import('@dfinity/candid').IDL }) => {
  const SessionTokens = IDL.Record({
    access_token: IDL.Text,
    refresh_token: IDL.Text,
  });

  const IILoginBeginResult = IDL.Variant({
    Ok: IDL.Text,
    Err: IDL.Text,
  });

  const IILoginCompleteResult = IDL.Variant({
    Ok: SessionTokens,
    Err: IDL.Text,
  });

  const LinkResult = IDL.Variant({
    Ok: IDL.Null,
    Err: IDL.Text,
  });

  const DeviceRecord = IDL.Record({
    device_id: IDL.Text,
    device_name: IDL.Text,
    registered_at: IDL.Nat64,
    last_used_at: IDL.Nat64,
    is_active: IDL.Bool,
  });

  const GetDevicesResult = IDL.Variant({
    Ok: IDL.Vec(DeviceRecord),
    Err: IDL.Text,
  });

  return IDL.Service({
    // Health check
    health: IDL.Func([], [IDL.Text], ['query']),
    sessions_count: IDL.Func([], [IDL.Nat64], ['query']),

    // Internet Identity authentication
    ii_login_begin: IDL.Func([], [IILoginBeginResult], []),
    ii_login_complete: IDL.Func([IDL.Text], [IILoginCompleteResult], []),

    // Internet Identity account linking
    link_internet_identity: IDL.Func([IDL.Text, IDL.Text], [LinkResult], []),
    unlink_internet_identity: IDL.Func([IDL.Text], [LinkResult], []),

    // Self-custody verification
    begin_self_custody_verification: IDL.Func([IDL.Text], [IILoginBeginResult], []),
    complete_self_custody_verification: IDL.Func([IDL.Text, IDL.Text], [LinkResult], []),

    // Multi-device management
    get_user_devices: IDL.Func([IDL.Text], [GetDevicesResult], ['query']),
    revoke_device: IDL.Func([IDL.Text, IDL.Text], [LinkResult], []),
    revoke_all_devices_except: IDL.Func([IDL.Text, IDL.Text], [LinkResult], []),
  });
}) as unknown as IDL.InterfaceFactory;

const CANISTER_ID =
  import.meta.env.VITE_IDENTITY_GATEWAY_CANISTER_ID || 'akngw-faaaa-aaaal-qsyyq-cai';

function createActor(): ActorSubclass<IdentityGatewayActor> {
  const network = import.meta.env.VITE_NETWORK || 'local';
  const host =
    network === 'ic' ? 'https://ic0.app' : import.meta.env.VITE_IC_HOST || 'http://127.0.0.1:4943';

  const agent = HttpAgent.createSync({ host });

  // Fetch root key in development mode
  if (network === 'local' || !network) {
    agent.fetchRootKey().catch((err) => {
      console.warn('Unable to fetch root key. Check that the local replica is running');
      console.error(err);
    });
  }

  return Actor.createActor(idlFactory, {
    agent,
    canisterId: CANISTER_ID,
  }) as ActorSubclass<IdentityGatewayActor>;
}

/**
 * React hook for Internet Identity integration (Epic 2.2)
 * Provides access to II authentication, account linking, self-custody verification, and device management
 */
export function useIdentityGateway() {
  const actor = useMemo(() => createActor(), []);

  return {
    /**
     * Start Internet Identity login flow (Story 2.2.1)
     * Returns a challenge that must be signed with II delegation
     */
    iiLoginBegin: async (): Promise<{ Ok: string } | { Err: string }> => {
      try {
        return await actor.ii_login_begin();
      } catch (error) {
        console.error('[IdentityGateway] ii_login_begin failed:', error);
        return { Err: `Failed to start II login: ${error}` };
      }
    },

    /**
     * Complete Internet Identity login flow (Story 2.2.1)
     * Validates delegation chain and returns session tokens
     */
    iiLoginComplete: async (
      delegationChain: string
    ): Promise<{ Ok: SessionTokens } | { Err: string }> => {
      try {
        return await actor.ii_login_complete(delegationChain);
      } catch (error) {
        console.error('[IdentityGateway] ii_login_complete failed:', error);
        return { Err: `Failed to complete II login: ${error}` };
      }
    },

    /**
     * Link Internet Identity to existing email account (Story 2.2.2)
     * Requires valid session token from email/password login
     */
    linkInternetIdentity: async (
      sessionToken: string,
      iiDelegation: string
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        const result = await actor.link_internet_identity(sessionToken, iiDelegation);
        if ('Ok' in result) {
          return { success: true };
        } else {
          return { success: false, message: result.Err };
        }
      } catch (error) {
        console.error('[IdentityGateway] link_internet_identity failed:', error);
        return { success: false, message: `Failed to link II: ${error}` };
      }
    },

    /**
     * Unlink Internet Identity from account (Story 2.2.2)
     * Requires valid session token
     */
    unlinkInternetIdentity: async (
      sessionToken: string
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        const result = await actor.unlink_internet_identity(sessionToken);
        if ('Ok' in result) {
          return { success: true };
        } else {
          return { success: false, message: result.Err };
        }
      } catch (error) {
        console.error('[IdentityGateway] unlink_internet_identity failed:', error);
        return { success: false, message: `Failed to unlink II: ${error}` };
      }
    },

    /**
     * Begin self-custody verification process (Story 2.2.3)
     * Returns a challenge to sign with self-custody wallet
     */
    beginSelfCustodyVerification: async (
      sessionToken: string
    ): Promise<{ Ok: string } | { Err: string }> => {
      try {
        return await actor.begin_self_custody_verification(sessionToken);
      } catch (error) {
        console.error('[IdentityGateway] begin_self_custody_verification failed:', error);
        return { Err: `Failed to begin self-custody verification: ${error}` };
      }
    },

    /**
     * Complete self-custody verification (Story 2.2.3)
     * Validates signed challenge and updates user self-custody status
     */
    completeSelfCustodyVerification: async (
      sessionToken: string,
      signature: string
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        const result = await actor.complete_self_custody_verification(sessionToken, signature);
        if ('Ok' in result) {
          return { success: true };
        } else {
          return { success: false, message: result.Err };
        }
      } catch (error) {
        console.error('[IdentityGateway] complete_self_custody_verification failed:', error);
        return {
          success: false,
          message: `Failed to complete self-custody verification: ${error}`,
        };
      }
    },

    /**
     * Get list of user's registered devices (Story 2.2.4)
     * Returns all devices with their status
     */
    getUserDevices: async (userId: string): Promise<{ Ok: DeviceRecord[] } | { Err: string }> => {
      try {
        return await actor.get_user_devices(userId);
      } catch (error) {
        console.error('[IdentityGateway] get_user_devices failed:', error);
        return { Err: `Failed to get devices: ${error}` };
      }
    },

    /**
     * Revoke a specific device (Story 2.2.4)
     * Prevents device from authenticating in the future
     */
    revokeDevice: async (
      sessionToken: string,
      deviceId: string
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        const result = await actor.revoke_device(sessionToken, deviceId);
        if ('Ok' in result) {
          return { success: true };
        } else {
          return { success: false, message: result.Err };
        }
      } catch (error) {
        console.error('[IdentityGateway] revoke_device failed:', error);
        return { success: false, message: `Failed to revoke device: ${error}` };
      }
    },

    /**
     * Revoke all devices except current one (Story 2.2.4)
     * Security feature for compromised accounts
     */
    revokeAllDevicesExcept: async (
      sessionToken: string,
      currentDeviceId: string
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        const result = await actor.revoke_all_devices_except(sessionToken, currentDeviceId);
        if ('Ok' in result) {
          return { success: true };
        } else {
          return { success: false, message: result.Err };
        }
      } catch (error) {
        console.error('[IdentityGateway] revoke_all_devices_except failed:', error);
        return { success: false, message: `Failed to revoke devices: ${error}` };
      }
    },
  };
}
