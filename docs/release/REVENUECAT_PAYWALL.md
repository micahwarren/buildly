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

## Live RevenueCat configuration

The owner published a working V2 secret API key, and authenticated RevenueCat access is verified. Project `projff09f31d` is **Sight Saw: DIY**. Its App Store app `app0e2b28467b` uses the original `com.nomapps.buildly` bundle and the existing App Store Connect integration key. The default Test Store was preserved.

The existing Apple SKU was imported as `prod6fd19e2ebf` and attached to the custom `project` package `pkgeb4aed311ff` in current offering `ofrngd87ad3457e` (`default`). The public `appl_` SDK key and RevenueCat app ID were saved on the existing production backend. Webhook `whintgr9753d82933` sends purchase/refund events for this app to `/api/billing/webhook`, using the encrypted shared secret. An authenticated, harmless TEST event returned ignored successfully; no credits or purchases were fabricated. Actual RevenueCat purchase delivery remains unverified.

The required **In-App Purchase key** is still missing from the saved RevenueCat app configuration. This is a different Apple credential from the working App Store Connect integration key. The owner's upload reported an invalid key format. Use Apple's original unedited `SubscriptionKey_<KEY_ID>.p8` download from Users and Access → Integrations → In-App Purchase, with its Issuer ID, in the RevenueCat app's In-app purchase key configuration. RevenueCat must show valid credentials after saving. Private key contents must not be put in chat or source. The dashboard now labels its navigation **Apps**.

`BILLING_ENABLED` remains off until the provider, native build and genuine sandbox transaction are verified. This keeps current installs usable while configuration is incomplete. Only server activation enforces paid generation; client state cannot grant access.

## Validation and delivery

Mobile typecheck/lint, 30 tests, server typecheck/lint and the financial/database tests pass. Browser flows cover the unpaid-generation gate, saved-draft close/reopen, using server credits and both themes, plus previous auth/confirmation/settings/project behavior. An iOS Hermes bundle export succeeds. These are fixture/native configuration checks, not a real StoreKit transaction.

Build **24** contains the pinned RevenueCat native SDK and is Apple **VALID / IN_BETA_TESTING**, assigned to the existing **SightSaw Testers** group. EAS build `aaab3562-23b3-47e2-84e7-90134ab9cd88`, submission `31618da4-1474-4071-b1c9-2ebd995e8aec`, signed source `51a327bdd96716f1c0613854f88605f7ead01dec`. Native compilation and distribution are verified; StoreKit transactions are not. Follow-up profile-photo and estimate-recovery changes require the next binary.

Before enabling billing, verify on the new TestFlight binary: actual localized product/price, cancellation, a genuine sandbox purchase and webhook credit, one-time consumption, included/failed revisions, plan retry, restart/account switches, restore and a sandbox refund. Do not charge real money, claim a successful purchase from a fixture, activate another app's integration or submit public App Review as part of this setup.
