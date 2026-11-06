# Sign in with Apple account deletion

Apple's account-deletion guidance requires revoking Sign in with Apple authorization as well as deleting the local account: https://developer.apple.com/support/offering-account-deletion-in-your-app/.

The installed app reauthenticates with Apple, verifies the same Supabase account, and sends the short-lived authorization code only to authenticated `DELETE /api/account`. The server exchanges the code at Apple's fixed token endpoint, verifies the returned Apple JWT's signature, issuer, bundle audience, subject and expiry, then revokes the refresh token. It never accepts a client-supplied Apple subject or access/refresh token. Codes/tokens are not persisted or logged. Private file, RevenueCat and Supabase removal still must complete before success.

Production Vercel configuration:

- `APPLE_SIGN_IN_PRIVATE_KEY`: full unchanged .p8 PEM for a **Sign in with Apple** key enabled for the existing app, not an App Store Connect or In-App Purchase key.
- `APPLE_SIGN_IN_KEY_ID`: that key's 10-character Apple Key ID.
- `APPLE_SIGN_IN_TEAM_ID`: optional; defaults to the existing team `47LP6F2JXD`.
- Native client audience remains the existing bundle `com.nomapps.buildly`; no rename or new Apple app is required.

Add credentials directly in Vercel Production settings, then redeploy. Never put the key in the repository, public variables or chat. In Apple Developer → Certificates, Identifiers & Profiles → Keys, choose the Sign in with Apple capability and the app's primary App ID.

Missing configuration fails before setting the server's account deletion fence. Once deletion begins, upstream failure leaves the account fenced for a deliberate retry; it never falsely reports completion. Old mobile builds do not send an Apple authorization code and must update before deleting an Apple-linked account. Email/Google-only deletion does not require these credentials. Linked email + Apple accounts must also reauthenticate with Apple for deletion.

Regression tests cover identity mismatch, wrong audience, expiry, bad signature, absent code/key, provider errors and unaffected email deletion. Actual Apple code exchange/revocation still requires the production credential and a disposable Apple-linked account in the new signed build; mocks do not establish that live check.
