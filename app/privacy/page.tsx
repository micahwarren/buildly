export default function Privacy() {
  return (
    <main className="legal-page">
      <h1>Privacy</h1>
      <p>
        Buildly uses your email address to manage your account and stores the
        projects and photos you save. Your project photos and descriptions are
        sent to our AI provider to generate designs, plans, and answers.
      </p>
      <p>
        Supabase provides account and private project storage. Google Gemini
        processes AI requests; an alternative configured image provider may
        process image requests. Apple and RevenueCat process in-app purchases.
        Buildly receives purchase identifiers and credit balances, not your card
        details.
      </p>
      <p>
        Project data remains in your account until you remove it or delete your
        account. Your device also keeps local drafts and saved copies. Deleting
        the app or clearing browser data removes local storage; use account
        deletion to remove cloud data. Apple and payment processors may retain
        transaction records under their own policies and legal requirements.
      </p>
      <p>
        Delete your account from My account → Delete my account. You can
        download a project backup before deleting. Purchase data may need to be
        retained by processors for tax, fraud prevention, or legal requirements.
      </p>
      <p>
        Buildly does not sell your personal information or use advertising
        trackers. For privacy and support requests:{" "}
        <a href="mailto:support@nomappsllc.com">support@nomappsllc.com</a>.
      </p>
    </main>
  );
}
