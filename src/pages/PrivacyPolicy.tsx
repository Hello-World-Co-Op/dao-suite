import React from 'react';
import { cn } from '../utils/cn';

/**
 * Privacy Policy Page (Story 2.0.5 - Task 7)
 *
 * GDPR Compliance:
 * - Article 13-14: Transparency - provides clear information about data processing
 * - Article 5: Data minimization - explains what data is collected and why
 * - Article 17: Right to erasure - explains deletion rights
 * - Article 15-20: User rights - explains how to exercise rights
 *
 * Accessible via /privacy-policy route (linked from PrivacyConsent component)
 */
export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-600">Last updated: November 23, 2025</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Introduction */}
        <section className="prose prose-slate max-w-none">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
          <p className="text-gray-700 leading-relaxed">
            Hello World Co-Op DAO ("we", "our", or "us") is committed to protecting your privacy and
            personal data. This Privacy Policy explains how we collect, use, store, and protect your
            information when you use our services, particularly regarding identity verification
            (KYC).
          </p>
        </section>

        {/* What Data We Collect */}
        <section className="prose prose-slate max-w-none">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">What Data We Collect</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>KYC Verification Data:</strong> When you complete identity verification, we
            collect:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>Full name</li>
            <li>Date of birth</li>
            <li>Government-issued ID information (passport, driver's license, etc.)</li>
            <li>Photograph (selfie for identity matching)</li>
            <li>Residential address</li>
            <li>Email address</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-4">
            <strong>Technical Data:</strong> We also collect technical information including:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>IP address (hashed for privacy)</li>
            <li>Device information and browser type</li>
            <li>Session data and authentication tokens</li>
            <li>Internet Computer Principal ID</li>
          </ul>
        </section>

        {/* How We Use Your Data */}
        <section className="prose prose-slate max-w-none">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Data</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We process your personal data for the following purposes:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>
              <strong>Identity Verification:</strong> To verify your identity and prevent fraud
            </li>
            <li>
              <strong>Regulatory Compliance:</strong> To comply with Know Your Customer (KYC) and
              Anti-Money Laundering (AML) regulations
            </li>
            <li>
              <strong>Service Provision:</strong> To provide you access to DAO membership and
              governance features
            </li>
            <li>
              <strong>Security:</strong> To protect against unauthorized access and maintain system
              security
            </li>
          </ul>
        </section>

        {/* KYC Provider */}
        <section
          className={cn(
            'bg-blue-50 border border-blue-200 rounded-lg p-6',
            'prose prose-slate max-w-none'
          )}
        >
          <h2 className="text-2xl font-semibold text-blue-900 mb-4">Third-Party KYC Provider</h2>
          <p className="text-blue-800 leading-relaxed">
            <strong>Identity verification is performed by Persona</strong>, a third-party KYC
            service provider. When you initiate KYC verification, your data is shared with Persona
            for processing. Persona has its own privacy policy and data protection measures. You can
            learn more at{' '}
            <a
              href="https://withpersona.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              Persona's Privacy Policy
            </a>
            .
          </p>
          <p className="text-blue-800 leading-relaxed mt-4">
            <strong>Important:</strong> Once verification is complete, Persona stores your KYC
            documents and photos according to their retention policy. We only store a reference ID
            and verification status in our system.
          </p>
        </section>

        {/* Data Retention */}
        <section className="prose prose-slate max-w-none">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Retention</h2>
          <p className="text-gray-700 leading-relaxed">
            In accordance with GDPR Article 5 (data minimization and storage limitation):
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-4">
            <li>
              <strong>KYC Records:</strong> Retained for <strong>7 years</strong> from verification
              date to comply with legal obligations and regulatory requirements
            </li>
            <li>
              <strong>Automatic Deletion:</strong> After 7 years, KYC records are automatically
              deleted from our system via an automated cleanup process
            </li>
            <li>
              <strong>Data Minimization:</strong> We only store the minimum necessary data - your
              verification status and reference ID. Actual identity documents are stored by Persona.
            </li>
          </ul>
        </section>

        {/* Data Security */}
        <section className="prose prose-slate max-w-none">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Security</h2>
          <p className="text-gray-700 leading-relaxed">
            We implement industry-standard security measures to protect your data:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-4">
            <li>
              <strong>Encryption:</strong> All data is encrypted at rest using AES-256 encryption
              provided by the Internet Computer platform's stable memory
            </li>
            <li>
              <strong>IP Hashing:</strong> IP addresses are hashed (one-way encrypted) before
              storage
            </li>
            <li>
              <strong>Access Control:</strong> Strict access controls limit who can view KYC data
            </li>
            <li>
              <strong>Audit Trail:</strong> All data access and modifications are logged for
              security monitoring
            </li>
          </ul>
        </section>

        {/* Your Rights */}
        <section
          className={cn(
            'bg-green-50 border border-green-200 rounded-lg p-6',
            'prose prose-slate max-w-none'
          )}
        >
          <h2 className="text-2xl font-semibold text-green-900 mb-4">
            Your Rights (GDPR Articles 15-20)
          </h2>
          <p className="text-green-800 leading-relaxed mb-4">
            Under GDPR, you have the following rights regarding your personal data:
          </p>
          <ul className="list-disc pl-6 space-y-3 text-green-800">
            <li>
              <strong>Right to Access (Article 15):</strong> Request a copy of your personal data we
              hold
            </li>
            <li>
              <strong>Right to Rectification (Article 16):</strong> Request correction of inaccurate
              data
            </li>
            <li>
              <strong>Right to Erasure (Article 17):</strong> Request deletion of your data with a
              30-day grace period for withdrawal
            </li>
            <li>
              <strong>Right to Restrict Processing (Article 18):</strong> Request limitation on how
              we use your data
            </li>
            <li>
              <strong>Right to Data Portability (Article 20):</strong> Receive your data in a
              structured, machine-readable format
            </li>
            <li>
              <strong>Right to Object (Article 21):</strong> Object to processing of your personal
              data
            </li>
            <li>
              <strong>Right to Withdraw Consent:</strong> Withdraw your consent at any time (this
              may affect your ability to use certain features)
            </li>
          </ul>
          <p className="text-green-800 leading-relaxed mt-6">
            <strong>To exercise these rights,</strong> please contact us at{' '}
            <a
              href="mailto:privacy@helloworlddao.com"
              className="text-green-700 hover:text-green-800 underline"
            >
              privacy@helloworlddao.com
            </a>
          </p>
        </section>

        {/* Data Deletion */}
        <section className="prose prose-slate max-w-none">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Data Deletion Process (Right to Erasure)
          </h2>
          <p className="text-gray-700 leading-relaxed">
            You can request deletion of your KYC data at any time. Here's how it works:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-gray-700 mt-4">
            <li>
              <strong>Request Deletion:</strong> Submit a deletion request through your account
              settings or by emailing privacy@helloworlddao.com
            </li>
            <li>
              <strong>30-Day Grace Period:</strong> Your request enters a 30-day grace period during
              which you can cancel the deletion if you change your mind
            </li>
            <li>
              <strong>Automatic Processing:</strong> After 30 days, your KYC data is automatically
              and permanently deleted from our system
            </li>
            <li>
              <strong>Third-Party Data:</strong> Note that you must separately request deletion from
              Persona for data stored with them
            </li>
          </ol>
          <p className="text-gray-700 leading-relaxed mt-4">
            <strong>Important:</strong> Deleting your KYC data will revoke your verified status and
            may affect your ability to participate in certain DAO activities that require
            verification.
          </p>
        </section>

        {/* International Transfers */}
        <section className="prose prose-slate max-w-none">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            International Data Transfers
          </h2>
          <p className="text-gray-700 leading-relaxed">
            Our services operate on the Internet Computer Protocol (ICP), a decentralized blockchain
            network with nodes worldwide. Your data may be processed in multiple jurisdictions. We
            ensure adequate safeguards are in place for international transfers in compliance with
            GDPR Chapter V.
          </p>
        </section>

        {/* Contact */}
        <section
          className={cn(
            'bg-slate-100 border border-slate-300 rounded-lg p-6',
            'prose prose-slate max-w-none'
          )}
        >
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">Contact Us</h2>
          <p className="text-slate-700 leading-relaxed">
            If you have questions about this Privacy Policy or how we handle your data, please
            contact:
          </p>
          <div className="mt-4 text-slate-700">
            <p>
              <strong>Email:</strong>{' '}
              <a
                href="mailto:privacy@helloworlddao.com"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                privacy@helloworlddao.com
              </a>
            </p>
            <p className="mt-2">
              <strong>Data Protection Officer:</strong> dpo@helloworlddao.com
            </p>
          </div>
        </section>

        {/* Changes to Policy */}
        <section className="prose prose-slate max-w-none">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
          <p className="text-gray-700 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any material
            changes by posting the new policy on this page and updating the "Last updated" date. We
            encourage you to review this policy periodically.
          </p>
        </section>

        {/* Back Button */}
        <div className="pt-8 border-t border-gray-200">
          <button
            onClick={() => window.history.back()}
            className={cn(
              'px-6 py-3 bg-blue-600 text-white rounded-md font-medium',
              'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              'transition-colors duration-200'
            )}
          >
            ← Back
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-slate-600">
          <p>© {new Date().getFullYear()} Hello World Co-Op DAO. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
