/**
 * Type definitions for user-service canister
 * Generated from user_service.did
 */

// Address type variant
export type AddressType =
  | { Home: null }
  | { Work: null }
  | { Billing: null }
  | { Shipping: null }
  | { Other: string };

export interface AddressRequest {
  address_type: AddressType;
  country: string;
  state: [string] | [];
  city: string;
  postal_code: string;
  street_address: [string] | [];
  street_address2: [string] | [];
  is_primary: boolean;
}

export interface Address {
  id: string;
  individual_id: string;
  address_type: AddressType;
  country: string;
  state: [string] | [];
  city: string;
  postal_code: string;
  street_address: [string] | [];
  street_address2: [string] | [];
  is_primary: boolean;
  created_at: bigint;
  updated_at: bigint;
}

// Encryption type for interest form PII
export type EncryptionType = { Temporary: null } | { UserDerived: null };

export interface IndividualRequest {
  // Encrypted PII fields (base64-encoded)
  email_encrypted: string;
  first_name_encrypted: string;
  last_name_encrypted: string;

  // Email hash for lookup/audit (SHA-256 hex)
  email_hash: string;

  // Encryption metadata
  encryption_key_id: string;
  encryption_type: EncryptionType;

  // Plaintext email for verification only (not stored)
  email_plaintext_for_verification: string;

  // Optional location fields (submitted separately via address system)
  country?: string;
  state?: string;
  city?: string;
  postal_code?: string;
}

export interface IndividualRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  verification_token: string;
  verified: boolean;
  submitted_at: bigint;
  verified_at: [bigint] | [];
  ip_hash: [string] | [];
  ii_principal: [Principal] | [];
}

// Principal type from @dfinity/principal
import type { Principal } from '@dfinity/principal';

export interface IndividualResult {
  success: boolean;
  message: string;
  id: [string] | [];
}

export interface VerifyResult {
  success: boolean;
  message: string;
}

export interface Stats {
  total_individuals: bigint;
  verified_individuals: bigint;
  pending_verifications: bigint;
}

// Authentication types (Epic 2.2)
export type AuthMethodType =
  | { EmailPassword: null }
  | { InternetIdentity: null }
  | { Google: null }
  | { Apple: null }
  | { Microsoft: null }
  | { GitHub: null }
  | { Discord: null };

export interface RegisterEmailPasswordRequest {
  email_encrypted: string;
  first_name_encrypted: string;
  last_name_encrypted: string;
  email_hash: string;
  password: string;
  encryption_key_id: string;
  // Epic 2.5, Story 2-5-1: Recovery key envelope encryption
  encrypted_recovery_key: string; // Base64-encoded (IV || encrypted recovery key || tag)
  password_salt: string; // Base64-encoded 128-bit salt for PBKDF2
  email_plaintext_for_verification: string;
  ip_hash: [string] | [];
  // FOS-3.3.1: Optional CRM fields for lead tracking
  company?: string;
  job_title?: string;
  interest_area?: string;
  referral_source?: string;
}

/**
 * FOS-3.3.1: Interest area enum values for CRM lead tracking
 * - product: Product Management
 * - engineering: Engineering/Development
 * - marketing: Marketing
 * - sales: Sales
 * - other: Other
 */
export type InterestArea = 'product' | 'engineering' | 'marketing' | 'sales' | 'other';

/**
 * FOS-3.3.1: Referral source enum values for CRM lead tracking
 * - google: Google Search
 * - referral: Friend/Colleague
 * - social: Social Media
 * - event: Event/Conference
 * - other: Other
 */
export type ReferralSource = 'google' | 'referral' | 'social' | 'event' | 'other';

export interface AuthResponse {
  success: boolean;
  message: string;
  access_token: [string] | [];
  refresh_token: [string] | [];
  session_id: [string] | [];
  user_id: [string] | [];
  preferred_auth_method: [AuthMethodType] | [];
  // Epic 2.5, Story 2-5-1: Recovery key envelope and encrypted PII for client-side decryption
  encrypted_recovery_key: [Uint8Array] | []; // Master recovery key encrypted with password-derived key
  password_salt: [Uint8Array] | []; // PBKDF2 salt for password-derived key derivation
  email_encrypted: [Uint8Array] | []; // User's email encrypted with master recovery key
  first_name_encrypted: [Uint8Array] | []; // User's first name encrypted with master recovery key
  last_name_encrypted: [Uint8Array] | []; // User's last name encrypted with master recovery key
}

// KYC types (Epic 2.0)
export type KYCStatus =
  | { Pending: null }
  | { Verified: null }
  | { Failed: null }
  | { Expired: null }
  | { UnderReview: null };

export interface KYCSession {
  inquiry_id: string;
  session_url: string;
}

export interface KYCRecord {
  user_id: Principal;
  inquiry_id: string;
  status: KYCStatus;
  created_at: bigint;
  updated_at: bigint;
  verified_at: [bigint] | [];
  expiry_date: [bigint] | [];
  // Story 2.0.4: Admin review and appeal fields
  flagged_at: [bigint] | [];
  reviewer: [Principal] | [];
  review_notes: [string] | [];
  appeal_reason: [string] | [];
  appeal_submitted_at: [bigint] | [];
}

// Story 2.0.4: Admin review types
export type ReviewDecision = { Approved: null } | { Rejected: null };

export interface AuditEntry {
  timestamp: bigint;
  actor: Principal;
  action: string;
  target: string;
  decision: [ReviewDecision] | [];
  notes: string;
}

export interface UserServiceActor {
  submit_individual: (
    request: IndividualRequest,
    address?: [AddressRequest] | []
  ) => Promise<IndividualResult>;
  verify_email: (token: string) => Promise<VerifyResult>;
  get_current_user: () => Promise<[IndividualRecord] | []>;
  verify_code?: (
    email: string,
    code: string,
    firstName: string,
    lastName: string
  ) => Promise<VerifyResult>; // Epic 2.5.2
  resend_verification_code?: (email: string) => Promise<VerifyResult>;
  get_stats: () => Promise<Stats>;
  add_address: (
    individual_id: string,
    address: AddressRequest
  ) => Promise<{ Ok: string } | { Err: string }>;
  get_addresses_for_individual: (individual_id: string) => Promise<Address[]>;
  get_primary_address: (individual_id: string) => Promise<[Address] | []>;
  update_address: (
    address_id: string,
    address: AddressRequest
  ) => Promise<{ Ok: null } | { Err: string }>;
  set_primary_address: (
    individual_id: string,
    address_id: string
  ) => Promise<{ Ok: null } | { Err: string }>;
  delete_address: (address_id: string) => Promise<{ Ok: null } | { Err: string }>;
  register_email_password: (
    request: RegisterEmailPasswordRequest
  ) => Promise<{ Ok: AuthResponse } | { Err: string }>;
  // Epic 2.5, Story 2-5-1: Login with recovery key retrieval + device fingerprinting
  authenticate_with_password: (
    authRequest: { email: string; password: string },
    deviceFingerprint: string,
    ipAddress: [string] | [],
    timezone: [string] | [],
    userAgent: [string] | []
  ) => Promise<AuthResponse>;
  // Epic 2.5, Story 2-5-1: Password reset methods
  initiate_password_reset: (email: string) => Promise<{ Ok: string } | { Err: string }>;
  complete_password_reset: (
    email: string,
    resetCode: string,
    newPassword: string,
    encryptedRecoveryKeyBase64: string,
    passwordSaltBase64: string
  ) => Promise<{ Ok: string } | { Err: string }>;
  complete_password_reset_simple: (
    email: string,
    resetCode: string,
    newPassword: string,
    encryptedRecoveryKeyBase64: string,
    passwordSaltBase64: string
  ) => Promise<{ Ok: string } | { Err: string }>;
  // KYC methods (Epic 2.0)
  initiate_kyc: (user_id: Principal) => Promise<{ Ok: KYCSession } | { Err: string }>;
  get_kyc_status: (user_id: Principal) => Promise<{ Ok: KYCRecord } | { Err: string }>;
  // Story 2.0.4: Admin methods
  set_admins: (new_admins: Principal[]) => Promise<{ Ok: null } | { Err: string }>;
  get_admins: () => Promise<{ Ok: Principal[] } | { Err: string }>;
  admin_review_kyc: (
    inquiry_id: string,
    decision: ReviewDecision,
    notes: string
  ) => Promise<{ Ok: null } | { Err: string }>;
  get_audit_trail: (inquiry_id: string) => Promise<{ Ok: AuditEntry[] } | { Err: string }>;
  get_all_audit_entries: () => Promise<{ Ok: AuditEntry[] } | { Err: string }>;
  get_sla_report: () => Promise<{ Ok: KYCRecord[] } | { Err: string }>;
  get_sla_status: (user_id: Principal) => Promise<{ Ok: [bigint] | [] } | { Err: string }>;
  // Story 2.0.4: User methods
  submit_kyc_appeal: (reason: string) => Promise<{ Ok: null } | { Err: string }>;
  // Internet Identity link status
  get_ii_link_status?: (userId: string) => Promise<{ Ok: boolean } | { Err: string }>;
}
