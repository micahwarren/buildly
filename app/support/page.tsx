export default function Support() {
  return (
    <main className="legal-document">
      <header>
        <span className="legal-brand">SITE AI</span>
        <h1>How can we help?</h1>
        <p className="legal-intro">
          Email <a href="mailto:support@nomappsllc.com">support@nomappsllc.com</a>
          {" "}with your app version from Settings and a short description.
          Keep passwords, confirmation links and private documents out of your message.
        </p>
      </header>
      <section>
        <h2>A project is still generating</h2>
        <p>
          Designs and matching plans can take several minutes. Return to My projects
          to reopen an active request. New projects and revisions wait for their
          matching materials and plan; recovery reuses the saved image when possible.
        </p>
        <p>
          Follow any recovery message before starting another project. Repeating a
          new generation can use another token or revision.
        </p>
      </section>
      <section>
        <h2>Tokens and purchases</h2>
        <p>
          One token starts one project. Packs contain 1, 2 or 4 tokens and are
          one-time purchases. You can buy more while tokens remain.
        </p>
        <p>
          Open Settings → Project tokens to check your balance. Let purchase
          confirmation finish; if Check purchase appears, use it before buying again.
          Restore purchases checks App Store purchases but does not turn used tokens
          into new tokens. Contact support if a purchase is still missing.
        </p>
        <p>
          Apple handles refund requests at{" "}
          <a href="https://reportaproblem.apple.com/">reportaproblem.apple.com</a>.
          Deleting an account does not request a refund.
        </p>
      </section>
      <section>
        <h2>Signing in</h2>
        <p>
          Use the same email or Apple/Google account you used to create your account.
          For an email account, use Forgot password on the login screen. Open
          confirmation and reset links on the phone where you use Site AI. Check
          spam if a message is missing, and use Resend confirmation email when available.
        </p>
      </section>
      <section>
        <h2>Deleting projects or your account</h2>
        <p>
          Touch and hold a project to delete it, or open its settings button.
          For permanent account deletion, open Settings → Delete my account,
          confirm ownership and type DELETE. This removes saved projects, private
          files, unused tokens and the RevenueCat customer profile.
        </p>
        <p>
          If cleanup cannot finish, follow the retry message or contact support.
          Finish pending photo deletions appears in Settings only when photo cleanup
          is pending. Apple may retain its own transaction records.
        </p>
      </section>
      <section>
        <h2>An incorrect design or plan</h2>
        <p>
          Stop if a result is unsafe or unclear. Verify measurements, quantities,
          product instructions and site conditions before buying or building.
          Follow the plan’s checks and get qualified help for regulated or hazardous work.
          Send support a brief description of an incorrect result.
        </p>
      </section>
      <footer>
        <a href="/privacy">Privacy Policy</a>{" · "}
        <a href="/terms">Terms &amp; Conditions</a>
      </footer>
    </main>
  );
}
