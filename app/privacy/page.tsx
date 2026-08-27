export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 prose prose-slate">
      <h1>Privacy Policy</h1>
      <p>Last updated: {new Date().toLocaleDateString("en-IN")}</p>
      <h2>1. What We Collect</h2>
      <ul>
        <li>Account information you provide: name, email, phone (optional), state, preferred language.</li>
        <li>Profile information you enter: rank, category, domicile, gender-eligibility pool, branch/institute preferences.</li>
        <li>Saved choice lists and generated reports linked to your account.</li>
        <li>Payment and donation records (amount, status, transaction ID) — never full card details, which are handled entirely by our payment gateway.</li>
        <li>Basic usage analytics (e.g. which pages are viewed, whether a report was generated) collected in a privacy-conscious way, without unnecessary personal identifiers.</li>
      </ul>
      <h2>2. How We Use It</h2>
      <p>
        We use your data to generate personalized recommendations, save your choice
        lists, process payments/donations, respond to support requests, and improve the
        platform. We do not sell your rank, category, or personal data to third parties.
      </p>
      <h2>3. Data Sharing</h2>
      <p>
        We share data only with service providers necessary to operate the platform
        (e.g. hosting, database, payment gateway, email delivery), each bound by their
        own confidentiality and data-protection obligations.
      </p>
      <h2>4. Your Rights</h2>
      <p>You may at any time:</p>
      <ul>
        <li>View the personal data associated with your account.</li>
        <li>Request deletion of your account and associated saved reports.</li>
        <li>Request a copy of your data.</li>
      </ul>
      <p>Contact us via the Contact page to exercise these rights.</p>
      <h2>5. Data Retention</h2>
      <p>
        We retain account and profile data for as long as your account is active, or as
        needed to comply with legal obligations, resolve disputes, and enforce our
        agreements.
      </p>
      <h2>6. Security</h2>
      <p>
        We use industry-standard security practices, including HTTPS, secure cookies,
        input validation, and access controls. No system is 100% secure, and we
        encourage you not to share sensitive information beyond what is required.
      </p>
      <h2>7. Children's Privacy</h2>
      <p>
        The platform is intended for students preparing for higher-education admissions
        and their parents/guardians. If you believe a minor has provided personal data
        without appropriate consent, contact us for removal.
      </p>
      <h2>8. Changes</h2>
      <p>We may update this policy periodically; material changes will be highlighted on this page.</p>
    </div>
  );
}
