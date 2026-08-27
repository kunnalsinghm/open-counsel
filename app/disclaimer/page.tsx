export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 prose prose-slate">
      <h1>Disclaimer</h1>
      <p>Last updated: {new Date().toLocaleDateString("en-IN")}</p>
      <p>
        <strong>OpenCounsel is an independent, privately operated educational
        decision-support tool. It is not affiliated with, endorsed by, sponsored by, or
        in any way officially connected with the Joint Seat Allocation Authority
        (JoSAA), the Central Seat Allocation Board (CSAB), the Medical Counselling
        Committee (MCC), the National Testing Agency (NTA), any state Common Entrance
        Test (CET) authority, or any Indian government body.</strong>
      </p>
      <p>
        All institute names, branch names, and cutoff figures referenced on this
        platform are used solely for informational and educational comparison purposes.
      </p>
      <h2>Historical Data Limitations</h2>
      <p>
        Cutoff ranks and seat allocation outcomes vary every year based on factors that
        cannot be fully predicted, including the number of applicants, seat matrix
        changes, reservation policy changes, and candidate choice-filling behavior.
        Historical data is a reference point, not a forecast.
      </p>
      <h2>No Admission Guarantee</h2>
      <p>
        Nothing on this platform — including Dream/Target/Safe classifications, round
        simulations, or AI counselor responses — constitutes a guarantee, promise, or
        assurance of admission to any institute or program.
      </p>
      <h2>Official Source Remains Authoritative</h2>
      <p>
        Students and parents must always refer to the official counseling authority's
        website and official notifications for authoritative, up-to-date information
        before making any decision, including choice-filling, freeze/float/slide
        decisions, and fee payments.
      </p>
      <h2>Demo / Seed Data Notice</h2>
      <p>
        In development and demo environments, this application may use illustrative
        mock cutoff data for demonstration purposes. Such data is clearly tagged in our
        database as seed/mock data and must never be treated as verified official data.
      </p>
    </div>
  );
}
