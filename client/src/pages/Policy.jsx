import React from 'react';

export default function Policy() {
  return (
    <div className="page-shell page-card policy-page">
      <div className="policy-header">
        <h1>Marketplace Policy &amp; Terms of Service</h1>
        <p>Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <section className="policy-section">
        <h2>1. Escrow-only transactions</h2>
        <p>
          Every sale on this marketplace must go through our escrow service. The buyer pays into
          escrow, the seller transfers ownership under escrow supervision, and funds are only
          released to the seller once the buyer has confirmed the account or channel works as
          described. We never recommend, and will not mediate disputes for, deals completed
          outside of escrow.
        </p>
      </section>

      <section className="policy-section">
        <h2>2. No off-platform contact information</h2>
        <p>
          Listings, descriptions, and public profile fields may not contain phone numbers, emails,
          social handles, messaging app usernames, or links intended to move a conversation off
          this marketplace. This protects both sides from being scammed outside of escrow
          protection and keeps a verifiable paper trail for every deal. Once a transaction is
          completed through escrow, buyers and sellers may exchange contact details if they choose
          to.
        </p>
      </section>

      <section className="policy-section">
        <h2>3. Ownership verification</h2>
        <p>
          Before a listing goes live, sellers must confirm ownership by adding a one-time
          verification code to the channel or account's bio/description. Listings are not
          published until this check passes. Anyone can also flag a listing as their own account
          using the "This channel is mine" option on the listing page, which issues a matching
          verification code to reclaim it.
        </p>
      </section>

      <section className="policy-section">
        <h2>4. Fees</h2>
        <p>
          A service fee (typically 4-8%, minimum fee applies) is added to the purchase price and
          covers escrow verification, dispute handling, and secure fund transfer. Fees are shown
          before checkout and are non-negotiable outside of promotional periods.
        </p>
      </section>

      <section className="policy-section">
        <h2>5. Ownership transfer window</h2>
        <p>
          After the seller hands over credentials, escrow retains a supervisory role for 7 days
          (the minimum period most platforms require before a new primary owner can be assigned).
          During this window the buyer should confirm access and report any issues immediately.
        </p>
      </section>

      <section className="policy-section">
        <h2>6. Prohibited listings</h2>
        <ul>
          <li>Accounts or channels obtained through hacking, phishing, or stolen credentials</li>
          <li>Accounts used to promote hate speech, harassment, or illegal activity</li>
          <li>Listings with misleading follower counts, engagement stats, or monetization status</li>
          <li>Listings that link to payment outside of our escrow flow</li>
        </ul>
      </section>

      <section className="policy-section">
        <h2>7. Disputes and refunds</h2>
        <p>
          If a buyer reports that a listing was misrepresented, or a seller reports non-payment,
          escrow staff will review chat history, transaction details, and any evidence provided by
          both sides. Refunds are issued from the held escrow balance when a claim is substantiated.
          Decisions made by escrow staff following this review are final.
        </p>
      </section>

      <section className="policy-section">
        <h2>8. Account standing and bans</h2>
        <p>
          Violating these policies can result in a listing being removed, a warning, or an account
          ban. Banned accounts are signed out immediately and the associated network address is
          temporarily restricted from creating new accounts or logging in.
        </p>
      </section>

      <section className="policy-section">
        <h2>9. Changes to this policy</h2>
        <p>
          We may update this policy as the marketplace evolves. Continued use of the platform after
          an update means you accept the revised terms.
        </p>
      </section>
    </div>
  );
}
