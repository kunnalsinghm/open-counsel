export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <article className="card prose prose-slate max-w-none p-6 prose-headings:tracking-tight prose-a:text-brand-600 sm:p-10">
      <h1>Terms of Service</h1>
      <p>Last updated: {new Date().toLocaleDateString("en-IN")}</p>
      <h2>1. About OpenCounsel</h2>
      <p>
        OpenCounsel ("we", "us", "the platform") is an independent, educational
        decision-support tool that helps students explore historical admission
        counseling data (such as JoSAA/CSAB/NEET/State CET cutoff records) and build a
        personal choice list. OpenCounsel is not affiliated with, endorsed by, or
        operated by JoSAA, CSAB, MCC, NTA, or any government or state counseling
        authority.
      </p>
      <h2>2. No Guarantee of Admission</h2>
      <p>
        All recommendations, classifications (Dream/Target/Safe), and simulations are
        estimates derived from historical data. They do not guarantee admission to any
        institute, program, or seat. The official counseling authority's seat allocation
        process is the sole authoritative source. Always verify information against the
        latest official notification before making any decision.
      </p>
      <h2>3. Use of the Service</h2>
      <p>
        You may use OpenCounsel for personal, non-commercial educational purposes. You
        agree not to misuse the platform, attempt to extract data at scale without
        permission, or use it to provide unauthorized paid counseling services to third
        parties.
      </p>
      <h2>4. Free Service</h2>
      <p>
        OpenCounsel is free to use. We do not charge for any feature and we do not accept
        payments or donations through this platform.
      </p>
      <h2>5. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, OpenCounsel and its operators are not
        liable for any decisions made based on information provided by the platform,
        including but not limited to college choices, seat allocation outcomes, or
        financial loss. The platform is provided "as is" without warranties of any kind.
      </p>
      <h2>6. AI Counselor</h2>
      <p>
        The AI Admission Counselor is an assistive tool. It may occasionally be
        inaccurate or incomplete. It is not a substitute for official guidance. Always
        verify critical information independently.
      </p>
      <h2>7. Changes to These Terms</h2>
      <p>
        We may update these terms from time to time. Continued use of the platform
        after changes constitutes acceptance of the revised terms.
      </p>
      <h2>8. Contact</h2>
      <p>Questions about these terms can be sent via our Contact page.</p>
      </article>
    </div>
  );
}
