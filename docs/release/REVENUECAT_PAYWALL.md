# Sight Saw project purchases

Owner-approved launch offer: **US$2.99 for one project credit**, including the initial AI design/materials/plan and **three successful design revisions**. There is no subscription. The app displays the localized StoreKit price returned through RevenueCat, never a hardcoded checkout price.

## Implemented

- Native RevenueCat React Native SDK 10.16.0 in the active Expo app, not the archived Capacitor client. Checkout uses the authenticated account; account switches serialize with the store sheet. Cancellation, deferred/network-uncertain results, persistent purchase checks, restore, and server balance refresh are handled separately.
- A compact themed paywall appears before starting an unpaid design. Closing it preserves photos, optional inputs and description. Settings has Project credits. A definite HTTP 402 can resume the saved request with a fresh job ID after purchase; uncertain network retries preserve their original ID. Incomplete-plan retries use the same existing project access.
- Only verified server-side RevenueCat events add credits. Events are constrained by store, product, configured RevenueCat app, environment and a secret webhook authorization header. Duplicate purchases/refunds are idempotent. Deleted accounts do not regain credits from late notifications.
- Credit/revision reservations and refunds are atomic and service-role-only. A durable saved design finalizes its reservation before planning. Stale cleanup recognizes already-saved job results rather than creating free replacement credits. A refunded spent purchase blocks further generation on its project without removing unrelated unused credits or saved designs.
- RevenueCat customer email is synchronized from the signed-in account for **admin/customer lookup only**. Emails are metadata, never authorization or purchase IDs. No public people-search endpoint was added.
- In-app/public privacy and terms describe Apple/RevenueCat processing, one-time credits, revisions, failures, restoration and deletion. Account deletion warns about unused credits when purchases are enabled.

## Existing identities and configuration

- Apple app: `6827150277`, **Sight Saw: DIY**, installed label **Sight Saw**; original bundle `com.nomapps.buildly` retained.
- Apple consumable: `sightsaw.project.single`, App Store Connect product `6830388229`.
- US base price USD 2.99; Apple-managed price schedule and availability prepared for 175 territories. App distribution and public App Review were not changed. Product remains `MISSING_METADATA`; a genuine app review screenshot and Apple's remaining product/contract readiness must be completed/verified before public sale. No screenshot was fabricated or submitted for review.
- Backend project: existing Vercel/Supabase projects. `supabase/billing.sql` was applied atomically; all four billing tables have RLS and mutation RPCs are service-role-only. No live purchase credit was fabricated.
- Server: `REVENUECAT_PROJECT_PRODUCT_ID=sightsaw.project.single`, `REVENUECAT_APP_ID`, encrypted `REVENUECAT_WEBHOOK_SECRET`, public `NEXT_PUBLIC_REVENUECAT_IOS_KEY` (`appl_…`). Android checkout is not configured; no Play product/app has been created.
- Webhook URL: `https://sightsaw-diy.vercel.app/api/billing/webhook`, using an exact `Authorization: Bearer …` secret. Apple production purchases are accepted; sandbox receipts require explicit `BILLING_ALLOW_SANDBOX=true` for TestFlight checks. Sandbox/production transaction IDs remain distinct.

## Live RevenueCat connection still required

The connection draft declares `REVENUECAT_API_KEY` for `api.revenuecat.com`. At the last checked state, the environment reported **no saved key binding**, and the running process had no RevenueCat key. A draft save is not publication. The owner must save the RevenueCat **secret API key** securely in environment settings and publish; never paste it into chat or commit it. Preserve existing credentials and domains.

Once that connection is active, finish the API-supported provider steps: identify/create the Sight Saw project and iOS app; validate App Store credentials; import the Apple consumable; attach it to a custom `project` package in the current offering; obtain the public iOS SDK key; configure the secret webhook and validate delivery; retain purchases with the original app user when configuring restore/transfer behavior. Do not rename or alter another app's RevenueCat project. Report any provider step that requires the owner's dashboard/Apple access rather than claiming it was configured in frontend code.

`BILLING_ENABLED` remains off until the provider, native build and genuine sandbox transaction are verified. This keeps current installs usable while configuration is incomplete. Only server activation enforces paid generation; client state cannot grant access.

## Validation and delivery

Mobile typecheck/lint, 30 tests, server typecheck/lint and the financial/database tests pass. Browser flows cover the unpaid-generation gate, saved-draft close/reopen, using server credits and both themes, plus previous auth/confirmation/settings/project behavior. An iOS Hermes bundle export succeeds. These are fixture/native configuration checks, not a real StoreKit transaction.

Build 22, containing the rebrand/auth/keyboard changes, is already Apple VALID / IN_BETA_TESTING in SightSaw Testers. RevenueCat introduces a new native module and needs the subsequent native build; build 22 does not contain it. Record its exact build and delivery state in VERIFICATION.md.

Before enabling billing, verify on the new TestFlight binary: actual localized product/price, cancellation, a genuine sandbox purchase and webhook credit, one-time consumption, included/failed revisions, plan retry, restart/account switches, restore and a sandbox refund. Do not charge real money, claim a successful purchase from a fixture, activate another app's integration or submit public App Review as part of this setup.
