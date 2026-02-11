import { useMemo } from 'react';
import { HttpAgent, Actor, type ActorSubclass } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import type {
  UserServiceActor,
  IndividualRequest,
  IndividualRecord,
  AddressRequest,
  IndividualResult,
  VerifyResult,
  Stats,
  RegisterEmailPasswordRequest,
  AuthResponse,
} from '../types/user-service';

// Candid interface definition for user-service
// This should match src/user_service.did from the canister
// Note: IDL.Opt(T) in Candid maps to [T] | [] tuple format in TypeScript at runtime
const idlFactory = (({ IDL }: { IDL: typeof import('@dfinity/candid').IDL }) => {
  const AddressType = IDL.Variant({
    Home: IDL.Null,
    Work: IDL.Null,
    Billing: IDL.Null,
    Shipping: IDL.Null,
    Other: IDL.Text,
  });

  const AddressRequest = IDL.Record({
    address_type: AddressType,
    country: IDL.Text,
    state: IDL.Opt(IDL.Text),
    city: IDL.Text,
    postal_code: IDL.Text,
    street_address: IDL.Opt(IDL.Text),
    street_address2: IDL.Opt(IDL.Text),
    is_primary: IDL.Bool,
  });

  const Address = IDL.Record({
    id: IDL.Text,
    individual_id: IDL.Text,
    address_type: AddressType,
    country: IDL.Text,
    state: IDL.Opt(IDL.Text),
    city: IDL.Text,
    postal_code: IDL.Text,
    street_address: IDL.Opt(IDL.Text),
    street_address2: IDL.Opt(IDL.Text),
    is_primary: IDL.Bool,
    created_at: IDL.Nat64,
    updated_at: IDL.Nat64,
  });

  // Fixed variant order to match deployed canister
  const EncryptionType = IDL.Variant({
    UserDerived: IDL.Null,
    Temporary: IDL.Null,
  });

  const IndividualRequest = IDL.Record({
    email_encrypted: IDL.Text,
    first_name_encrypted: IDL.Text,
    last_name_encrypted: IDL.Text,
    email_hash: IDL.Text,
    encryption_key_id: IDL.Text,
    encryption_type: EncryptionType,
    email_plaintext_for_verification: IDL.Text,
  });

  const IndividualResult = IDL.Record({
    success: IDL.Bool,
    message: IDL.Text,
    id: IDL.Opt(IDL.Text),
  });

  // IndividualRecord for get_current_user
  const AuthMethodType = IDL.Variant({
    EmailPassword: IDL.Null,
    InternetIdentity: IDL.Null,
    Google: IDL.Null,
    Apple: IDL.Null,
    Microsoft: IDL.Null,
    GitHub: IDL.Null,
    Discord: IDL.Null,
  });

  const Credential = IDL.Variant({
    PasswordHash: IDL.Vec(IDL.Nat8),
    OidcToken: IDL.Record({
      provider: IDL.Text,
      subject: IDL.Text,
      email: IDL.Text,
      email_verified: IDL.Bool,
      issued_at: IDL.Nat64,
    }),
    Principal: IDL.Principal,
  });

  const AuthMethod = IDL.Record({
    method_type: AuthMethodType,
    identifier: IDL.Text,
    credential: IDL.Opt(Credential),
    verified: IDL.Bool,
    linked_at: IDL.Nat64,
    last_used: IDL.Opt(IDL.Nat64),
  });

  const IndividualRecord = IDL.Record({
    id: IDL.Text,
    first_name: IDL.Text,
    last_name: IDL.Text,
    email: IDL.Text,
    verification_token: IDL.Text,
    verified: IDL.Bool,
    submitted_at: IDL.Nat64,
    verified_at: IDL.Opt(IDL.Nat64),
    ip_hash: IDL.Opt(IDL.Text),
    ii_principal: IDL.Opt(IDL.Principal),
    auth_methods: IDL.Vec(AuthMethod),
    preferred_auth_method: IDL.Opt(AuthMethodType),
  });

  const VerifyResult = IDL.Record({
    success: IDL.Bool,
    message: IDL.Text,
  });

  const Stats = IDL.Record({
    total_individuals: IDL.Nat64,
    verified_individuals: IDL.Nat64,
    pending_verifications: IDL.Nat64,
  });

  // AuthMethodType already defined above for IndividualRecord

  const AuthRequest = IDL.Record({
    email: IDL.Text,
    password: IDL.Text,
  });

  const RegisterEmailPasswordRequest = IDL.Record({
    email_encrypted: IDL.Text,
    first_name_encrypted: IDL.Text,
    last_name_encrypted: IDL.Text,
    email_hash: IDL.Text,
    password: IDL.Text,
    encryption_key_id: IDL.Text,
    encrypted_recovery_key: IDL.Text, // Epic 2.5: Base64-encoded recovery key envelope
    password_salt: IDL.Text, // Epic 2.5: Base64-encoded PBKDF2 salt
    email_plaintext_for_verification: IDL.Text,
    ip_hash: IDL.Opt(IDL.Text),
    // FOS-3.3.1: Optional CRM fields for lead tracking
    company: IDL.Opt(IDL.Text),
    job_title: IDL.Opt(IDL.Text),
    interest_area: IDL.Opt(IDL.Text),
    referral_source: IDL.Opt(IDL.Text),
  });

  const AuthResponse = IDL.Record({
    success: IDL.Bool,
    message: IDL.Text,
    access_token: IDL.Opt(IDL.Text),
    refresh_token: IDL.Opt(IDL.Text),
    session_id: IDL.Opt(IDL.Text),
    user_id: IDL.Opt(IDL.Text),
    preferred_auth_method: IDL.Opt(AuthMethodType),
    encrypted_recovery_key: IDL.Opt(IDL.Vec(IDL.Nat8)),
    password_salt: IDL.Opt(IDL.Vec(IDL.Nat8)),
    email_encrypted: IDL.Opt(IDL.Vec(IDL.Nat8)),
    first_name_encrypted: IDL.Opt(IDL.Vec(IDL.Nat8)),
    last_name_encrypted: IDL.Opt(IDL.Vec(IDL.Nat8)),
  });

  return IDL.Service({
    submit_individual: IDL.Func(
      [IndividualRequest, IDL.Opt(AddressRequest)],
      [IndividualResult],
      []
    ),
    verify_email: IDL.Func([IDL.Text], [VerifyResult], []),
    verify_code: IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Text], [VerifyResult], []), // Epic 2.5.2: Added first_name, last_name for database sync
    resend_verification_code: IDL.Func([IDL.Text], [VerifyResult], []),
    get_stats: IDL.Func([], [Stats], ['query']),
    get_current_user: IDL.Func([], [IDL.Opt(IndividualRecord)], ['query']),
    add_address: IDL.Func(
      [IDL.Text, AddressRequest],
      [IDL.Variant({ Ok: IDL.Text, Err: IDL.Text })],
      []
    ),
    get_addresses_for_individual: IDL.Func([IDL.Text], [IDL.Vec(Address)], ['query']),
    get_primary_address: IDL.Func([IDL.Text], [IDL.Opt(Address)], ['query']),
    update_address: IDL.Func(
      [IDL.Text, AddressRequest],
      [IDL.Variant({ Ok: IDL.Null, Err: IDL.Text })],
      []
    ),
    set_primary_address: IDL.Func(
      [IDL.Text, IDL.Text],
      [IDL.Variant({ Ok: IDL.Null, Err: IDL.Text })],
      []
    ),
    delete_address: IDL.Func([IDL.Text], [IDL.Variant({ Ok: IDL.Null, Err: IDL.Text })], []),
    register_email_password: IDL.Func(
      [RegisterEmailPasswordRequest],
      [IDL.Variant({ Ok: AuthResponse, Err: IDL.Text })],
      []
    ),
    authenticate_with_password: IDL.Func(
      [AuthRequest, IDL.Text, IDL.Opt(IDL.Text), IDL.Opt(IDL.Text), IDL.Opt(IDL.Text)],
      [AuthResponse],
      []
    ),
    // Parameters: (AuthRequest, device_fingerprint, ip_address?, timezone?, user_agent?)
    initiate_password_reset: IDL.Func(
      [IDL.Text],
      [IDL.Variant({ Ok: IDL.Text, Err: IDL.Text })],
      []
    ),
    complete_password_reset: IDL.Func(
      [IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Text],
      [IDL.Variant({ Ok: IDL.Text, Err: IDL.Text })],
      []
    ),
    complete_password_reset_simple: IDL.Func(
      [IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Text],
      [IDL.Variant({ Ok: IDL.Text, Err: IDL.Text })],
      []
    ),
    get_ii_link_status: IDL.Func(
      [IDL.Text],
      [IDL.Variant({ Ok: IDL.Bool, Err: IDL.Text })],
      ['query']
    ),
  });
}) as unknown as IDL.InterfaceFactory;

// Canister ID - this should be set via environment variable in production
const CANISTER_ID = import.meta.env.VITE_USER_SERVICE_CANISTER_ID || 'rrkah-fqaaa-aaaaa-aaaaq-cai';

// Host configuration based on environment
const getHost = () => {
  const network = import.meta.env.VITE_NETWORK || 'local';
  if (network === 'ic') {
    return 'https://ic0.app'; // IC mainnet
  }
  return 'http://127.0.0.1:4943'; // Local PocketIC server
};

/**
 * Custom hook for interacting with the user-service canister
 * Provides methods for submitting individual requests, verifying emails, and fetching stats
 */
export function useUserService() {
  const actor = useMemo(() => {
    // Use HttpAgent.createSync instead of deprecated constructor
    const agent = HttpAgent.createSync({
      host: getHost(),
    });

    // Fetch root key for certificate validation when using local network
    // WARNING: This is insecure and should NEVER be done in production
    const network = import.meta.env.VITE_NETWORK || 'local';
    if (network === 'local') {
      agent.fetchRootKey().catch((err) => {
        console.warn('Unable to fetch root key. Check your local replica is running.');
        console.error(err);
      });
    }

    return Actor.createActor(idlFactory, {
      agent,
      canisterId: CANISTER_ID,
    }) as ActorSubclass<UserServiceActor>;
  }, []);

  /**
   * Submit an individual request to join the interest list
   * @param request - Individual data including name and email
   * @param address - Optional address data
   * @returns Promise with submission result including success status and ID
   */
  const submitIndividual = async (
    request: IndividualRequest,
    address?: AddressRequest
  ): Promise<IndividualResult> => {
    // Convert address to Candid optional format: undefined -> [], value -> [value]
    const addressOpt: [AddressRequest] | [] = address ? [address] : [];
    return await actor.submit_individual(request, addressOpt);
  };

  /**
   * Verify an email address using a token
   * @param token - Verification token sent to user's email
   * @returns Promise with verification result
   */
  const verifyEmail = async (token: string): Promise<VerifyResult> => {
    return await actor.verify_email(token);
  };

  /**
   * Verify an email address using a 6-digit code
   * Epic 2.5.2: Requires first_name and last_name for database sync
   * @param email - User's email address
   * @param code - 6-digit verification code
   * @param firstName - User's first name (for database sync). Optional for interest form flow.
   * @param lastName - User's last name (for database sync). Optional for interest form flow.
   * @returns Promise with verification result
   */
  const verifyCode = async (
    email: string,
    code: string,
    firstName: string = '',
    lastName: string = ''
  ): Promise<VerifyResult> => {
    if (!actor.verify_code) {
      throw new Error('verify_code method not available on canister');
    }
    return await actor.verify_code(email, code, firstName, lastName);
  };

  /**
   * Resend verification code to user's email
   * @param email - User's email address
   * @returns Promise with result
   */
  const resendVerificationCode = async (email: string): Promise<VerifyResult> => {
    if (!actor.resend_verification_code) {
      throw new Error('resend_verification_code method not available on canister');
    }
    return await actor.resend_verification_code(email);
  };

  /**
   * Fetch statistics about individuals in the system
   * @returns Promise with stats including total, verified, and pending counts
   */
  const getStats = async (): Promise<Stats> => {
    return await actor.get_stats();
  };

  /**
   * Register a new user account with email/password authentication (Story 2.1.2)
   * @param request - Registration data including encrypted PII and password
   * @returns Promise with authentication response or error
   */
  const registerEmailPassword = async (
    request: RegisterEmailPasswordRequest
  ): Promise<{ Ok: AuthResponse } | { Err: string }> => {
    if (!actor.register_email_password) {
      throw new Error('register_email_password method not available on canister');
    }
    return await actor.register_email_password(request);
  };

  /**
   * Authenticate with email and password, retrieving recovery keys for PII decryption
   * Epic 2.5, Story 2-5-1: Returns encrypted recovery key envelope for client-side PII decryption
   * @param email - User's email address
   * @param password - User's password
   * @returns Promise with authentication response including recovery keys
   */
  const authenticateWithPassword = async (
    email: string,
    password: string
  ): Promise<AuthResponse> => {
    if (!actor.authenticate_with_password) {
      throw new Error('authenticate_with_password method not available on canister');
    }

    // Generate device fingerprint (browser fingerprint for session tracking)
    const deviceFingerprint = [
      navigator.userAgent,
      navigator.language,
      new Date().getTimezoneOffset(),
      screen.width + 'x' + screen.height,
    ].join('|');

    // Gather browser metadata
    const ipAddress: [] = []; // IP address not available client-side
    const timezone: [string] = [Intl.DateTimeFormat().resolvedOptions().timeZone];
    const userAgent: [string] = [navigator.userAgent];

    const authRequest = {
      email,
      password,
    };

    return await actor.authenticate_with_password(
      authRequest,
      deviceFingerprint,
      ipAddress,
      timezone,
      userAgent
    );
  };

  /**
   * Initiate password reset by sending a reset code to user's email
   * Epic 2.5, Story 2-5-1: Part of password reset flow
   * @param email - User's email address
   * @returns Promise with success message or error
   */
  const initiatePasswordReset = async (
    email: string
  ): Promise<{ Ok: string } | { Err: string }> => {
    if (!actor.initiate_password_reset) {
      throw new Error('initiate_password_reset method not available on canister');
    }
    return await actor.initiate_password_reset(email);
  };

  /**
   * Complete password reset with new password and re-encrypted recovery key
   * Epic 2.5, Story 2-5-1: Re-encrypts recovery key envelope with new password
   * @param email - User's email address
   * @param resetCode - 6-digit reset code from email
   * @param newPassword - New password
   * @param encryptedRecoveryKeyBase64 - Recovery key re-encrypted with new password
   * @param passwordSaltBase64 - New PBKDF2 salt
   * @returns Promise with success message or error
   */
  const completePasswordReset = async (
    email: string,
    resetCode: string,
    newPassword: string,
    encryptedRecoveryKeyBase64: string,
    passwordSaltBase64: string
  ): Promise<{ Ok: string } | { Err: string }> => {
    if (!actor.complete_password_reset) {
      throw new Error('complete_password_reset method not available on canister');
    }
    return await actor.complete_password_reset(
      email,
      resetCode,
      newPassword,
      encryptedRecoveryKeyBase64,
      passwordSaltBase64
    );
  };

  /**
   * Complete password reset without recovery key - clears encrypted PII
   * This is a fallback for users who lost both their password and recovery key
   * @param email - User's email address
   * @param resetCode - 6-digit reset code from email
   * @param newPassword - New password
   * @param encryptedRecoveryKeyBase64 - New recovery key encrypted with new password
   * @param passwordSaltBase64 - New PBKDF2 salt
   * @returns Promise with success message or error
   */
  const completePasswordResetSimple = async (
    email: string,
    resetCode: string,
    newPassword: string,
    encryptedRecoveryKeyBase64: string,
    passwordSaltBase64: string
  ): Promise<{ Ok: string } | { Err: string }> => {
    if (!actor.complete_password_reset_simple) {
      throw new Error('complete_password_reset_simple method not available on canister');
    }
    return await actor.complete_password_reset_simple(
      email,
      resetCode,
      newPassword,
      encryptedRecoveryKeyBase64,
      passwordSaltBase64
    );
  };

  /**
   * Get the current authenticated user's profile
   * Uses ic_cdk::caller() on the backend to identify the user
   * @returns Promise with the user's IndividualRecord or null if not authenticated
   */
  const getCurrentUser = async (): Promise<IndividualRecord | null> => {
    if (!actor.get_current_user) {
      throw new Error('get_current_user method not available on canister');
    }
    const result = await actor.get_current_user();
    // Candid opt returns [value] or []
    return result.length > 0 ? (result[0] as IndividualRecord) : null;
  };

  /**
   * Check if Internet Identity is linked for a user
   * @param userId - The user's ID
   * @returns Promise with true if II is linked, false otherwise
   */
  const getIILinkStatus = async (userId: string): Promise<boolean> => {
    if (!actor.get_ii_link_status) {
      throw new Error('get_ii_link_status method not available on canister');
    }
    const result = await actor.get_ii_link_status(userId);
    if ('Ok' in result) {
      return result.Ok;
    }
    throw new Error(result.Err);
  };

  return {
    submitIndividual,
    verifyEmail,
    verifyCode,
    resendVerificationCode,
    getStats,
    getCurrentUser,
    getIILinkStatus,
    registerEmailPassword,
    authenticateWithPassword,
    initiatePasswordReset,
    completePasswordReset,
    completePasswordResetSimple,
  };
}
