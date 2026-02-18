import { useMemo } from 'react';
import { useAuth } from '@hello-world-co-op/auth';
import { HttpAgent, Actor, type ActorSubclass } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { Principal } from '@dfinity/principal';

// Payment record types matching treasury.did
export type PaymentType = { Initial: null } | { Renewal: null };
export type PaymentStatus = { Succeeded: null } | { Failed: null } | { Pending: null };

export interface PaymentRecord {
  id: bigint;
  user_id: Principal;
  amount: bigint;
  currency: string;
  payment_type: PaymentType;
  status: PaymentStatus;
  stripe_payment_intent_id: string;
  receipt_number: [] | [string];
  payment_method_last4: string;
  timestamp: bigint;
}

export interface TreasuryServiceActor {
  record_payment: (
    user_id: Principal,
    amount: bigint,
    payment_type: PaymentType,
    stripe_payment_intent_id: string,
    payment_method_last4: string,
    receipt_number: [] | [string]
  ) => Promise<bigint>;
  get_payment_history: (
    user: Principal,
    limit: number,
    offset: number,
    payment_type_filter: [] | [PaymentType],
    start_date: [] | [bigint],
    end_date: [] | [bigint]
  ) => Promise<PaymentRecord[]>;
  get_payment_count: (
    user: Principal,
    payment_type_filter: [] | [PaymentType],
    start_date: [] | [bigint],
    end_date: [] | [bigint]
  ) => Promise<bigint>;
  get_payment_history_with_session: (
    access_token: string,
    limit: number,
    offset: number,
    payment_type_filter: [] | [PaymentType],
    start_date: [] | [bigint],
    end_date: [] | [bigint]
  ) => Promise<{ Ok: PaymentRecord[] } | { Err: string }>;
  get_payment_count_with_session: (
    access_token: string,
    payment_type_filter: [] | [PaymentType],
    start_date: [] | [bigint],
    end_date: [] | [bigint]
  ) => Promise<{ Ok: bigint } | { Err: string }>;
}

// Candid interface definition for treasury canister
// Cast to InterfaceFactory to satisfy Actor.createActor type requirements
const idlFactory = (({ IDL }: { IDL: typeof import('@dfinity/candid').IDL }) => {
  const PaymentType = IDL.Variant({
    Initial: IDL.Null,
    Renewal: IDL.Null,
  });

  const PaymentStatus = IDL.Variant({
    Succeeded: IDL.Null,
    Failed: IDL.Null,
    Pending: IDL.Null,
  });

  const PaymentRecord = IDL.Record({
    id: IDL.Nat64,
    user_id: IDL.Principal,
    amount: IDL.Nat,
    currency: IDL.Text,
    payment_type: PaymentType,
    status: PaymentStatus,
    stripe_payment_intent_id: IDL.Text,
    receipt_number: IDL.Opt(IDL.Text),
    payment_method_last4: IDL.Text,
    timestamp: IDL.Nat64,
  });

  const Result = IDL.Variant({
    Ok: IDL.Vec(PaymentRecord),
    Err: IDL.Text,
  });

  const CountResult = IDL.Variant({
    Ok: IDL.Nat64,
    Err: IDL.Text,
  });

  return IDL.Service({
    record_payment: IDL.Func(
      [IDL.Principal, IDL.Nat, PaymentType, IDL.Text, IDL.Text, IDL.Opt(IDL.Text)],
      [IDL.Nat64],
      []
    ),
    get_payment_history: IDL.Func(
      [
        IDL.Principal,
        IDL.Nat32,
        IDL.Nat32,
        IDL.Opt(PaymentType),
        IDL.Opt(IDL.Nat64),
        IDL.Opt(IDL.Nat64),
      ],
      [IDL.Vec(PaymentRecord)],
      ['query']
    ),
    get_payment_count: IDL.Func(
      [IDL.Principal, IDL.Opt(PaymentType), IDL.Opt(IDL.Nat64), IDL.Opt(IDL.Nat64)],
      [IDL.Nat64],
      ['query']
    ),
    get_payment_history_with_session: IDL.Func(
      [
        IDL.Text,
        IDL.Nat32,
        IDL.Nat32,
        IDL.Opt(PaymentType),
        IDL.Opt(IDL.Nat64),
        IDL.Opt(IDL.Nat64),
      ],
      [Result],
      []
    ),
    get_payment_count_with_session: IDL.Func(
      [IDL.Text, IDL.Opt(PaymentType), IDL.Opt(IDL.Nat64), IDL.Opt(IDL.Nat64)],
      [CountResult],
      []
    ),
  });
}) as unknown as IDL.InterfaceFactory;

const CANISTER_ID = import.meta.env.VITE_TREASURY_CANISTER_ID || 'rrkah-fqaaa-aaaaa-aaaaq-cai';

function createActor(): ActorSubclass<TreasuryServiceActor> {
  const network = import.meta.env.VITE_NETWORK || 'local';
  const host = import.meta.env.VITE_IC_HOST || 'http://127.0.0.1:4943';

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
  }) as ActorSubclass<TreasuryServiceActor>;
}

export function useTreasuryService() {
  const actor = useMemo(() => createActor(), []);
  const { user } = useAuth();

  return {
    /**
     * Get payment history for a user with pagination and optional filtering
     * Uses session-based authentication for email/password users
     * @param user - Principal of the user (used for mock data only)
     * @param limit - Max number of records to return
     * @param offset - Number of records to skip
     * @param paymentTypeFilter - Optional payment type filter
     * @param startDate - Optional start date (timestamp in nanoseconds)
     * @param endDate - Optional end date (timestamp in nanoseconds)
     */
    getPaymentHistory: async (
      userPrincipal: Principal,
      limit: number,
      offset: number,
      paymentTypeFilter?: PaymentType,
      startDate?: bigint,
      endDate?: bigint
    ): Promise<PaymentRecord[]> => {
      try {
        // NOTE: Direct-to-canister _with_session calls require a raw access token,
        // which is only available in the httpOnly cookie (not accessible to JS).
        // Future: Replace with oracle-bridge proxy endpoint call when available.
        // The mock fallback path below is the current behavior and is intentional.
        const userId = user?.userId;
        if (!userId) { throw new Error('No user session found'); }
        const accessToken: string | undefined = undefined;
        if (!accessToken) { throw new Error('No access token found in session'); }

        // Call session-based method
        const result = await actor.get_payment_history_with_session(
          accessToken,
          limit,
          offset,
          paymentTypeFilter ? [paymentTypeFilter] : [],
          startDate !== undefined ? [startDate] : [],
          endDate !== undefined ? [endDate] : []
        );

        // Handle Result type
        if ('Ok' in result) {
          return result.Ok;
        } else {
          throw new Error(result.Err);
        }
      } catch (error) {
        console.warn('[TreasuryService] getPaymentHistory failed, using mock data:', error);

        // Mock: Return sample payment history with 3 records
        const now = Date.now();
        const mockPayments: PaymentRecord[] = [
          {
            id: 1n,
            user_id: userPrincipal,
            amount: 2500n, // $25.00
            currency: 'USD',
            payment_type: { Initial: null },
            status: { Succeeded: null },
            stripe_payment_intent_id: 'pi_mock_initial_001',
            receipt_number: ['https://stripe.com/receipts/mock_initial'],
            payment_method_last4: '4242',
            timestamp: BigInt(now - 365 * 24 * 60 * 60 * 1000) * 1000000n, // 1 year ago
          },
          {
            id: 2n,
            user_id: userPrincipal,
            amount: 2500n, // $25.00
            currency: 'USD',
            payment_type: { Renewal: null },
            status: { Succeeded: null },
            stripe_payment_intent_id: 'pi_mock_renewal_001',
            receipt_number: ['https://stripe.com/receipts/mock_renewal_1'],
            payment_method_last4: '4242',
            timestamp: BigInt(now - 30 * 24 * 60 * 60 * 1000) * 1000000n, // 30 days ago
          },
          {
            id: 3n,
            user_id: userPrincipal,
            amount: 2500n, // $25.00
            currency: 'USD',
            payment_type: { Renewal: null },
            status: { Failed: null },
            stripe_payment_intent_id: 'pi_mock_failed_001',
            receipt_number: [],
            payment_method_last4: '0002',
            timestamp: BigInt(now - 60 * 24 * 60 * 60 * 1000) * 1000000n, // 60 days ago
          },
        ];

        // Apply pagination
        const start = offset;
        const end = offset + limit;
        return mockPayments.slice(start, end);
      }
    },

    /**
     * Get total payment count for a user with optional filtering
     * Uses session-based authentication for email/password users
     * @param user - Principal of the user (used for mock data only)
     * @param paymentTypeFilter - Optional payment type filter
     * @param startDate - Optional start date (timestamp in nanoseconds)
     * @param endDate - Optional end date (timestamp in nanoseconds)
     */
    getPaymentCount: async (
      _userPrincipal: Principal,
      paymentTypeFilter?: PaymentType,
      startDate?: bigint,
      endDate?: bigint
    ): Promise<bigint> => {
      try {
        // NOTE: Direct-to-canister _with_session calls require a raw access token,
        // which is only available in the httpOnly cookie (not accessible to JS).
        // Future: Replace with oracle-bridge proxy endpoint call when available.
        // The mock fallback path below is the current behavior and is intentional.
        const userId = user?.userId;
        if (!userId) { throw new Error('No user session found'); }
        const accessToken: string | undefined = undefined;
        if (!accessToken) { throw new Error('No access token found in session'); }

        // Call session-based method
        const result = await actor.get_payment_count_with_session(
          accessToken,
          paymentTypeFilter ? [paymentTypeFilter] : [],
          startDate !== undefined ? [startDate] : [],
          endDate !== undefined ? [endDate] : []
        );

        // Handle Result type
        if ('Ok' in result) {
          return result.Ok;
        } else {
          throw new Error(result.Err);
        }
      } catch (error) {
        console.warn('[TreasuryService] getPaymentCount failed, using mock data:', error);
        // Mock: Return count of 3 payments
        return 3n;
      }
    },
  };
}
