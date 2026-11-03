# SightSaw identity

- Installed/home-screen name: **sight saw** (`name` and `CFBundleDisplayName`, lowercase and spaced as requested).
- Existing Apple/TestFlight record: **Sight Saw: DIY**, app ID `6827150277`.
- Settings version footer: **Sight Saw**, followed by the actual native version/build. Build 20 still displays the pre-rename text until a new native update is installed.
- Login/signup no longer have an app-name header or adjacent logo. Their existing backgrounds, form, provider buttons and keyboard handling remain.
- Existing internal group: **SightSaw Testers**; membership/access preserved.
- App UI, support links, policy text, descriptions, web title, downloadable filenames and the icon/launch mark use SightSaw. The former monogram was replaced with an S.
- Preferred native return scheme: `sightsaw://`; already-issued links using `buildly://` still work.
- Branded public/backend address: `https://sightsaw-diy.vercel.app`. Existing `https://buildly-ecru.vercel.app` remains attached to the same hosting project for installed versions.
- Supabase and hosting project display names changed; database/project IDs and credentials remain the same.

## Compatibility identities

The existing Apple bundle ID `com.nomapps.buildly` is immutable for the existing App Store app. Changing it would create a different app and invalidate the current Google/Apple configuration and access to existing installs' secure storage. It remains registered alongside the same Google client IDs and reversed Google URL scheme.

Legacy storage keys/databases, draft directories, backup imports, database tables/RPCs, existing product identifiers, source repository paths and environment/CI bindings remain where changing them would lose state or break existing deployments. New environment spellings are accepted with old bindings as aliases. These are technical compatibility identifiers, not user-facing branding. No account/project migration, purchase setup or deletion is performed. Both old and SightSaw backup formats import the same data.

## External settings

Apple's current app/localized name **Sight Saw: DIY** and tester-group rename were applied and read back from App Store Connect. Supabase project display name and auth redirect/site configuration were applied. The owner subsequently reported completing Google Cloud's consent-screen branding change to SightSaw; this is owner-reported, not independently verified through Google admin access. Existing OAuth IDs are retained.

The prepared confirmation template uses SightSaw and retains `{{ .ConfirmationURL }}`. Supabase rejected live custom subjects/templates because the free default mail provider requires custom SMTP (or a paid plan). Sender-name customization additionally requires SMTP_ADMIN_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS. No plan upgrade or SMTP credential invention occurred. Existing provider settings and sign-in security were preserved; delivery/custom-sender acceptance is not claimed.

## Delivery

The owner's prior binary-upload hold remains in effect. TestFlight metadata was renamed immediately; the installed home-screen label/icon changes when the owner resumes delivery and installs a new native build. Build 21's submission remains canceled. No new TestFlight/App Review/Play submission is authorized by this metadata/source update alone.

## Verification receipt — November 3, 2026

- Latest display-name/auth adjustment: Apple confirms `Sight Saw: DIY`; generated iOS config confirms `sight saw` and the original bundle/URL schemes. Mobile typecheck/lint, 26 tests and the browser regression/layout flow pass. Login/signup screenshots confirm the header/logo removal. These source changes require the next native update; no new binary was uploaded.

- Apple API reads confirm `SightSaw DIY`, the original bundle ID, `SightSaw Testers`, and SightSaw beta description/testing notes. Historical binaries are unchanged.
- Generated iOS Info.plist confirms `CFBundleDisplayName=SightSaw`, the original bundle ID, and both new and legacy return schemes. The iOS Hermes export succeeds.
- Mobile typecheck/lint and 26 tests pass. All four Chromium fixture suites pass in light/dark, including auth, confirmation, settings, projects and creation. The confirmation suite passed on rerun after its initial app-resume timing failure; this is browser-fixture evidence, not a physical-device authentication test.
- Backend typecheck/lint, 80 tests and production build pass, including old and SightSaw backup imports. Production health/database and policy/support pages pass via the retained address and show the SightSaw service/branding.
- Hosting API confirms the new branded domain and retained legacy domain are aliases of the same READY production deployment. This workspace cannot directly fetch the new hostname because its network allowlist excludes it; no claim of a direct new-host request is made.
- The owner subsequently reported completing Google branding. No usable Google Cloud admin credentials or browser-control connection are available here to verify it independently. Existing OAuth clients remain unchanged.
- Live email sender/subject/template activation remains blocked by Supabase's default-provider/custom-SMTP requirements described above. Source templates are prepared, not claimed as activated.
