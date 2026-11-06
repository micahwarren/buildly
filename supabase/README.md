# Activate SightSaw accounts

Use the Supabase project you created. Connecting a GitHub repository does not automatically apply this database setup or configure Vercel.

1. In **Supabase → SQL Editor → New query**, paste the complete contents of `supabase/setup.sql` and run it. It creates a projects table, private image bucket, and per-user access policies. Do not disable row level security. If resources named `projects` or `project-images` already contain unrelated data, review their schema/policies before running this setup.
2. In **Supabase → Authentication → Sign In / Providers**, enable **Email**. Email confirmation is supported and recommended. Configure production SMTP for reliable confirmation and password-reset delivery; Supabase's default mail service has restrictions and rate limits.
3. In **Authentication → URL Configuration**, set **Site URL** to your exact production SightSaw URL (for example `https://sightsaw-diy.vercel.app`) and add that same URL to allowed Redirect URLs. Add `http://localhost:3000` only for local development. Add specific preview URLs only if you use them. Email confirmation and reset links must return to an allowed URL.
4. In **Project Settings → API / API Keys** (or the project's Connect panel), copy the project URL and **publishable key**. A legacy `anon` key also works. Never put a `service_role` or secret key into a `NEXT_PUBLIC_` variable.
5. In **Vercel → SightSaw → Settings → Environment Variables**, add for Production:
   - `NEXT_PUBLIC_SUPABASE_URL`: your Supabase project URL.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: your publishable key. Alternatively use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the legacy anon key.
6. Redeploy the latest SightSaw deployment. Public configuration is bundled at build time, so a redeploy is required.
7. Test: Create account → confirm email if required → Sign in → save a project → sign in on another browser/device → My projects. Test password reset and sign out. To bring projects created while signed out into your account, select **Copy this device’s guest projects to my account** on My projects. Guest originals remain on the original device.

## Privacy and behavior

- Supabase Auth handles email/password credentials; SightSaw never implements or stores its own password database. Sessions persist through the Supabase browser client.
- Projects and image objects are accessible only to their owner through row level security and storage policies. The frontend uses the public/publishable key and the user's session. No service-role key is needed.
- Original and generated photos are uploaded to a private bucket. Metadata stores private object references. Images are downloaded with the signed-in user's session for display.
- Image files are versioned by content hash. Step-progress saves reuse existing files. Historical image versions may remain after redesigns or project removal; add a scheduled orphan-file cleanup before a broader launch.
- Browser copies and drafts use IndexedDB, partitioned by guest/user. Prior localStorage projects migrate into the guest library without deleting the old recovery copy. Browser storage may still be cleared or evicted; cloud saving is the durable cross-device option after a successful sync.
- Local saves continue on cloud failure. The UI shows an error and does not call a failed sync a cloud save. Download a project backup for an additional copy.
- If an earlier project was never saved before the old app refreshed, this update cannot reconstruct its photo or generated result. Browser storage from explicit old saves can migrate.

Live signup, email delivery, database/storage policies, and cross-device sync must be verified against your actual configured Supabase project. Automated local tests use isolated service mocks and do not establish live service readiness.

After billing setup, apply `receipt-fingerprints.sql`. It preserves deployed reservation upgrades, backfills one-way receipt/account bindings without changing balances, and prevents receipt reuse after account deletion. Its private RLS table intentionally has no client policies. Do not remove this binding during account deletion.

### One-time free starter projects

After the billing and receipt-fingerprint migrations, apply `starter-tokens.sql` once. It fixes the launch-account cutoff, creates private RLS-protected grant/identity tables and service-only claim functions, and does not change balances by itself. Keep the stable `STARTER_TOKEN_HASH_KEY`, DeviceCheck P-256 key/Key ID and Apple team configured only on the server. Do not rotate the hash key without a migration plan.

Deploy the Store-only receipt counters before running the explicitly gated `SITEAI_SEED_STARTERS=1` maintenance build. The seed adds exactly one complimentary token to each account at the fixed cutoff; reruns are idempotent and create no Apple/RevenueCat transactions. Then enable `STARTER_TOKENS_ENABLED=true` when the signed native DeviceCheck client is delivered. DeviceCheck bit 0 is reserved for this app's offer; leave the developer's bit 1 unchanged. The API fails closed on Apple/configuration errors and limits repeated attempts. A free token uses the existing reservation, failed-image recovery and three-revision logic.

Verify a fresh physical iPhone claim and same-device second-account rejection before public release. Identity/device protection limits repeated offers; it cannot establish one human across every possible device and identity. Claim fingerprints remain after deletion with the readable account link cleared, as disclosed in the privacy policy. Native iOS is the supported future-account claim path; do not promise web/Android starter claims.
