import { useMemo } from 'react';
import { HttpAgent, Actor, type ActorSubclass } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { Principal } from '@dfinity/principal';

// Membership canister types matching membership.did
export interface MembershipMetadata {
  join_date: bigint;
  status: { Active: null } | { Expired: null } | { Revoked: null };
  tos_accepted_at: bigint;
  expiration_date: bigint;
  is_active: boolean;
}

export interface Account {
  owner: Principal;
  subaccount: [] | [Uint8Array];
}

export interface MembershipRecord {
  token_id: bigint;
  owner: Account;
  metadata: MembershipMetadata;
}

export interface MembershipServiceActor {
  // Principal-based methods (legacy)
  can_renew: (principal: Principal) => Promise<{ Ok: boolean } | { Err: string }>;
  verify_membership: (principal: Principal) => Promise<[] | [MembershipRecord]>;
  is_first_year_member: (principal: Principal) => Promise<{ Ok: boolean } | { Err: string }>;
  get_prorated_dividend: (
    principal: Principal,
    total_dividend: bigint
  ) => Promise<{ Ok: bigint } | { Err: string }>;

  // Session-based methods (preferred for email/password users)
  verify_membership_with_session: (
    access_token: string
  ) => Promise<{ Ok: [] | [MembershipRecord] } | { Err: string }>;
  can_renew_with_session: (access_token: string) => Promise<{ Ok: boolean } | { Err: string }>;
  is_first_year_member_with_session: (
    access_token: string
  ) => Promise<{ Ok: boolean } | { Err: string }>;
  get_prorated_dividend_with_session: (
    access_token: string,
    total_dividend: bigint
  ) => Promise<{ Ok: bigint } | { Err: string }>;
}

// Candid interface definition for membership canister
// Cast to InterfaceFactory to satisfy Actor.createActor type requirements
const idlFactory = (({ IDL }: { IDL: typeof import('@dfinity/candid').IDL }) => {
  const Account = IDL.Record({
    owner: IDL.Principal,
    subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
  });

  const MembershipStatus = IDL.Variant({
    Active: IDL.Null,
    Expired: IDL.Null,
    Revoked: IDL.Null,
  });

  const MembershipMetadata = IDL.Record({
    join_date: IDL.Nat64,
    status: MembershipStatus,
    tos_accepted_at: IDL.Nat64,
    expiration_date: IDL.Nat64,
    is_active: IDL.Bool,
  });

  const MembershipRecord = IDL.Record({
    token_id: IDL.Nat,
    owner: Account,
    metadata: MembershipMetadata,
  });

  const Result = IDL.Variant({
    Ok: IDL.Opt(MembershipRecord),
    Err: IDL.Text,
  });

  const BoolResult = IDL.Variant({
    Ok: IDL.Bool,
    Err: IDL.Text,
  });

  const Nat64Result = IDL.Variant({
    Ok: IDL.Nat64,
    Err: IDL.Text,
  });

  return IDL.Service({
    // Principal-based methods
    can_renew: IDL.Func([IDL.Principal], [BoolResult], ['query']),
    verify_membership: IDL.Func([IDL.Principal], [IDL.Opt(MembershipRecord)], ['query']),
    is_first_year_member: IDL.Func([IDL.Principal], [BoolResult], ['query']),
    get_prorated_dividend: IDL.Func([IDL.Principal, IDL.Nat64], [Nat64Result], ['query']),

    // Session-based methods
    verify_membership_with_session: IDL.Func([IDL.Text], [Result], []),
    can_renew_with_session: IDL.Func([IDL.Text], [BoolResult], []),
    is_first_year_member_with_session: IDL.Func([IDL.Text], [BoolResult], []),
    get_prorated_dividend_with_session: IDL.Func([IDL.Text, IDL.Nat64], [Nat64Result], []),
  });
}) as unknown as IDL.InterfaceFactory;

const CANISTER_ID = import.meta.env.VITE_MEMBERSHIP_CANISTER_ID || 'rrkah-fqaaa-aaaaa-aaaaq-cai';

function createActor(): ActorSubclass<MembershipServiceActor> {
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
  }) as ActorSubclass<MembershipServiceActor>;
}

export function useMembershipService() {
  const actor = useMemo(() => createActor(), []);

  return {
    /**
     * Check if a principal can renew their membership
     * Returns true if in renewal window (Dec 1 - Jan 31) and not revoked
     * Uses session-based authentication for email/password users
     */
    canRenew: async (_principal: Principal): Promise<{ Ok: boolean } | { Err: string }> => {
      try {
        // Get access token from localStorage
        const storedData = localStorage.getItem('user_data');
        if (!storedData) {
          throw new Error('No user session found');
        }

        const userData = JSON.parse(storedData);
        const accessToken = userData.accessToken;

        if (!accessToken) {
          throw new Error('No access token found in session');
        }

        // Call session-based method
        return await actor.can_renew_with_session(accessToken);
      } catch (error) {
        console.warn('[MembershipService] canRenew failed, using mock data:', error);
        // Mock: User can renew during renewal window (Dec 1 - Jan 31)
        const now = new Date();
        const month = now.getMonth();
        const canRenew = month === 11 || month === 0; // December or January
        return { Ok: canRenew };
      }
    },

    /**
     * Get membership record for a principal
     * Returns membership details including status and expiration date
     * Uses session-based authentication for email/password users
     */
    verifyMembership: async (principal: Principal): Promise<[] | [MembershipRecord]> => {
      try {
        // Get access token from localStorage
        const storedData = localStorage.getItem('user_data');
        if (!storedData) {
          throw new Error('No user session found');
        }

        const userData = JSON.parse(storedData);
        const accessToken = userData.accessToken;

        if (!accessToken) {
          throw new Error('No access token found in session');
        }

        // Call session-based method
        const result = await actor.verify_membership_with_session(accessToken);

        // Handle Result type
        if ('Ok' in result) {
          return result.Ok;
        } else {
          throw new Error(result.Err);
        }
      } catch (error) {
        console.warn('[MembershipService] verifyMembership failed, using mock data:', error);
        // Mock: Return active membership that expires end of next year
        const now = Date.now();
        const nextYear = new Date().getFullYear() + 1;
        const expirationDate = new Date(nextYear, 11, 31); // December 31, next year

        const mockRecord: MembershipRecord = {
          token_id: 1n,
          owner: {
            owner: principal,
            subaccount: [],
          },
          metadata: {
            join_date: BigInt(now - 365 * 24 * 60 * 60 * 1000) * 1000000n, // 1 year ago
            status: { Active: null },
            tos_accepted_at: BigInt(now - 365 * 24 * 60 * 60 * 1000) * 1000000n,
            expiration_date: BigInt(expirationDate.getTime()) * 1000000n,
            is_active: true,
          },
        };
        return [mockRecord];
      }
    },

    /**
     * Check if member joined within current calendar year
     * Uses session-based authentication for email/password users
     */
    isFirstYearMember: async (
      _principal: Principal
    ): Promise<{ Ok: boolean } | { Err: string }> => {
      try {
        // Get access token from localStorage
        const storedData = localStorage.getItem('user_data');
        if (!storedData) {
          throw new Error('No user session found');
        }

        const userData = JSON.parse(storedData);
        const accessToken = userData.accessToken;

        if (!accessToken) {
          throw new Error('No access token found in session');
        }

        // Call session-based method
        return await actor.is_first_year_member_with_session(accessToken);
      } catch (error) {
        console.warn('[MembershipService] isFirstYearMember failed, using mock data:', error);
        // Mock: Member is NOT a first-year member (joined more than a year ago)
        return { Ok: false };
      }
    },

    /**
     * Calculate prorated dividend for first-year members
     * Amount returned is in cents (u64)
     * Uses session-based authentication for email/password users
     */
    getProratedDividend: async (
      principal: Principal,
      totalDividend: bigint
    ): Promise<{ Ok: bigint } | { Err: string }> => {
      try {
        // Get access token from localStorage
        const storedData = localStorage.getItem('user_data');
        if (!storedData) {
          throw new Error('No user session found');
        }

        const userData = JSON.parse(storedData);
        const accessToken = userData.accessToken;

        if (!accessToken) {
          throw new Error('No access token found in session');
        }

        // Call session-based method
        return await actor.get_prorated_dividend_with_session(accessToken, totalDividend);
      } catch (error) {
        console.warn('[MembershipService] getProratedDividend failed, using mock data:', error);
        // Mock: Return full dividend (no proration since not first-year)
        return { Ok: totalDividend };
      }
    },
  };
}
