# Settings and email confirmation release

This release changes the Expo app and adds an authenticated pending-photo-deletion count to the existing service. It changes no payment code or database schema.

## Email provider: configuration still required

Live Supabase Auth project: `fewhurddrzmnqabeelyi` (SightSaw). Email confirmation is enabled, the minimum new-password length is eight, and the redirect allowlist contains `buildly://auth/confirm` and `buildly://auth/callback`.

The project currently uses Supabase's default mail sender with **no custom SMTP configured**. Its confirmation subject is still **Confirm your email address**. On November 2, 2026 UTC, Supabase rejected the actual management-API template/subject update with HTTP 400: “Email template modification is not available for free tier projects using the default email provider. Please upgrade your plan or configure a custom SMTP provider.” It separately rejected the sender-name update because custom SMTP is absent. No plan was upgraded and no partial sender/template update was applied.

Configure the approved existing transactional provider in **Supabase → Authentication → Email → SMTP settings**:

| Setting | Required value |
| --- | --- |
| SMTP host | Provider's SMTP hostname (`smtp_host`) |
| SMTP port | Provider's supported TLS/STARTTLS port (`smtp_port`) |
| SMTP username | Provider's SMTP login (`smtp_user`) |
| SMTP password | Provider's SMTP credential, supplied securely (`smtp_pass`) |
| Sender email | A provider-verified From address, preferably `support@nomappsllc.com` if that address/domain is verified (`smtp_admin_email`) |
| Sender display name | `SightSaw` (`smtp_sender_name`) |

Google hosting the support inbox does not by itself provide a configured transactional SMTP sender. If the existing NomNom sender can send for this domain, reuse its verified sender and SMTP configuration. Otherwise verify the sender/domain with the chosen provider and publish its exact SPF/DKIM records (and the provider's recommended DMARC settings). DNS record values come from that provider; they cannot be inferred here. Do not paste credentials into source control or chat, purchase a new plan, or change another app's sender.

After SMTP is configured, set **Authentication → Email Templates → Confirm signup**:

- Subject: **Confirm your SightSaw account**.
- HTML: `supabase/templates/confirmation.html` in the service repository.
- Keep every `{{ .ConfirmationURL }}` expression intact. Supabase must generate the real verification URL; do not substitute a hardcoded app link or remove verification tokens.
- Sender display name: **SightSaw** through SMTP settings, not only the HTML.

The prepared template has the exact welcome copy, a prominent **Confirm email** button, a fallback confirmation URL and no Supabase promotional branding. It is **not yet active**. Live inbox appearance, From/Subject, spam delivery, confirmation and reset messages remain unverified until the sender is configured. The default provider currently allows only two email sends per hour project-wide and is unsuitable as a production sender. The app's 60-second resend cooldown does not override provider limits; it handles HTTP 429 without pretending a message was sent.

## App behavior

Successful signup with no authenticated session replaces the form with the dedicated confirmation screen. Pending email/cooldown survives restart; no password is persisted. Email correction deliberately returns to signup with the email prefilled and the password blank. Resend success is neutral, failures are explicit, and the cooldown survives returning to login. Open email launches an installed inbox app on supported native devices, with manual guidance when unavailable; web gives manual inbox guidance.

Confirmation accepts PKCE codes and signup token hashes, including expired-link errors in native URL fragments. A valid link/session is checked with Auth's server `getUser` before continuing. Resuming the app rechecks an existing session; confirmation elsewhere without a local session directs the user to sign in. Cross-device PKCE links can require signing in on the original device. Implicit session tokens and recovery links are not accepted as signup confirmation. Recovery continues to use its separate route.

Settings use native switches, explicit AI-provider disclosure before first opt-in, expandable privacy details, the existing consent version/timestamp and diagnostic metadata, Light/Dark selection and safe-area scrolling. `GET /api/projects/deletions` verifies the caller and counts only their tombstones. The secondary cleanup action appears only for a positive count and remains reachable above the tab bar.

## Verification and device acceptance

Automated checks cover signup, replacement waiting screen, email correction, persisted resend cooldown, success/500/429 feedback, expired links, PKCE and token confirmation, no-session sign-in guidance, session validation on resume, both themes, informed consent, privacy details, conditional cleanup and existing project/account flows. These use fixture accounts/HTTP boundaries; they do not send real messages or prove actual iPhone behavior.

On the signed iPhone build, verify fresh signup → inbox → link → app return, background/resume, sign-in after confirmation on another device, expired/used link + resend, corrected email, all available inbox launch choices, larger type/VoiceOver/safe areas in Light and Dark, consent/revocation, and pending cleanup. A real inbox and physical device are required to complete this acceptance.
