# Buildly iPhone release

The repository contains a Capacitor 8 iOS app, native camera/library access, native file sharing, a consumable Apple purchase paywall, and server-side project credits. The app loads the hosted Buildly application over HTTPS. It is not an offline app. Xcode compilation, signing, real StoreKit purchases, and Apple review cannot be verified on the Linux development machine.

## Offer to test

Start with **US $4.99 per project**, configured in App Store Connect, not hardcoded into the app. One purchase provides one initial design/plan and three design revisions of that project. Plan-only retries do not use revisions. A new project needs another credit. An image that succeeds while planning fails stays saved and permits a plan retry. A failed image request returns the reservation. Stale reservations from interrupted server executions release on the next request after ten minutes.

This is a pricing hypothesis, not a proven profitable price. Budget conservatively for Apple's applicable commission (up to 30%), four generated images per purchase, planning requests, storage, refunds, support, and taxes. At $4.99 less 30%, approximately $3.49 remains before those other costs. Measure provider costs on real projects before public launch. Do not advertise unlimited revisions. No subscription or automatic renewal.

Track the funnel during the beta: project-start → photo added → generate tapped → paywall → purchase → complete plan. Use App Store Connect and RevenueCat purchase reporting plus test-session feedback initially; no extra analytics tracker is installed. Optimize completed paid plans, not just checkout clicks. Test $4.99 against a higher price only after reliable plan generation and enough purchase volume. Do not promise a best conversion rate without data.

## 1. Supabase and hosted server

For the first TestFlight build **without purchases**, leave `BILLING_ENABLED=false` on the hosted app. In GitHub's `buildly test` environment, only BUILDLY_APP_URL and APPLE_TEAM_ID variables plus the three Apple signing secrets are required. Run the workflow with **Test App Store purchases unchecked**. RevenueCat setup can follow later. The preflight verifies that hosted billing is disabled and AI is configured. This does not disable billing inside a binary: the app uses the hosted server, so keep billing disabled for the duration of this test. For a local no-purchase build, set `TESTFLIGHT_PAYMENTS=false` before preflight.

1. Apply `supabase/setup.sql` (existing accounts) then `supabase/billing.sql` in Supabase SQL Editor. Billing tables have RLS and no client mutation policies. Only service-role RPCs may grant/spend credits.
2. In Vercel configure `SUPABASE_SERVICE_ROLE_KEY`, `REVENUECAT_WEBHOOK_SECRET` (a long random value), `REVENUECAT_PROJECT_PRODUCT_ID=buildly.project.single`, `NEXT_PUBLIC_PROJECT_PRODUCT_ID=buildly.project.single`, and `NEXT_PUBLIC_REVENUECAT_IOS_KEY` (RevenueCat's public iOS SDK key). Never expose the service-role key or webhook secret with a NEXT_PUBLIC prefix.
3. Set `BILLING_ENABLED=true` once the database and store integration are ready. This gates ALL live design, refinement, planning, and chat APIs for both web and iOS. Explicit sample plans remain free. This release leaves the existing website's billing off until configured.
4. For TestFlight set `BILLING_ALLOW_SANDBOX=true`; TestFlight purchases use Apple's sandbox. Use a separate Supabase/RevenueCat/Vercel staging environment for beta testing so sandbox credits cannot reach the eventual production account ledger. A public production backend should reject sandbox grants.
5. Redeploy. Verify `/api/config` reports `billingEnabled: true` and `imageGenerationAvailable: true`. Paywall purchase buttons do not load products while billing is off.
6. Check `/privacy` and `/terms` for your business and current providers. Verify `support@nomappsllc.com` is monitored. Account deletion removes private photos, project rows and unused credits; Apple/RevenueCat retain their transaction records under their own policies. Review these notices before submission.

## 2. Apple and RevenueCat

1. Use a paid Apple Developer membership. Register bundle ID **com.nomapps.buildly** (change in `capacitor.config.ts` AND Xcode if unavailable). Create the matching iOS application in App Store Connect.
2. Create **consumable** IAP `buildly.project.single`, display name **Buildly Project**, description **One project design and plan with three design revisions**. Set the introductory test price to **$4.99 USD** and Apple's regional equivalents. Complete agreements, banking, tax, product metadata and IAP review screenshot.
3. In RevenueCat create the iOS app for that bundle ID, connect App Store credentials, import the consumable product, and place it in the **current offering** as a custom package. No subscription entitlement is needed for this credit-based product.
4. Configure a RevenueCat webhook to `https://YOUR-STABLE-DOMAIN/api/billing/webhook` with authorization header `Bearer YOUR_REVENUECAT_WEBHOOK_SECRET`. Include NON_RENEWING_PURCHASE and CANCELLATION events. The server deduplicates transaction IDs and refunds; retry failed webhook delivery. Subscriber IDs must be Supabase user UUIDs. Do not enable anonymous purchases or automatic account transfers. Credits are owned by the Buildly account used at purchase.
5. Consumed consumables cannot be restored from the App Store. “Refresh purchases” reads the server balance for the signed-in account; it does not fabricate a restore. Unused credits and saved projects follow the same account across devices. Deleted accounts intentionally lose their credits.

## 3. Build on a Mac

Use Xcode compatible with Capacitor 8 (Xcode 26 or newer), Node 24, and a connected iPhone or simulator. The generated app uses Swift Package Manager.

```sh
npm ci
export BUILDLY_APP_URL=https://YOUR-STABLE-DOMAIN
export APPLE_TEAM_ID=YOUR_TEAM_ID
export NEXT_PUBLIC_REVENUECAT_IOS_KEY=YOUR_PUBLIC_IOS_SDK_KEY
export NEXT_PUBLIC_PROJECT_PRODUCT_ID=buildly.project.single
npm run ios:preflight
npm run ios:sync
npm run ios:open
```

In Xcode select the App target → Signing & Capabilities → your team, use automatic signing, and set version/build number. Run on a device first. Then choose **Product → Archive → Distribute App → App Store Connect → Upload**. Once processed, select the build in TestFlight. External testers may require Beta App Review. Apple's approval is not guaranteed; supply a working review account, access to sample functionality, and clear review notes explaining native camera, sharing, saved projects and purchases.

Alternatively, `.github/workflows/ios-testflight.yml` archives/uploads on manual dispatch only. Use GitHub environment `buildly test`; set variables BUILDLY_APP_URL, APPLE_TEAM_ID, REVENUECAT_IOS_KEY, PROJECT_PRODUCT_ID and secrets APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_PRIVATE_KEY (App Store Connect API key with appropriate app/signing access). The workflow has not been executed here. Confirm Apple's current SDK submission requirements and the selected GitHub runner's Xcode before running it.

## Release checks — must pass on a real device

- Sign up, confirm email, log in, recover a password, sign out and sign in as a different account. Email confirmation currently opens the website; return to the app and sign in.
- Take a photo, select one from the library, deny permissions, cancel the picker, and handle a lost internet connection.
- Purchase in sandbox. Check Apple's localized price, cancellation, pending confirmation, duplicate webhook delivery, cross-device credits and account isolation.
- Spend one credit on a real image AND plan. Confirm the full materials/steps generation succeeds. This remains a release blocker until tested against the live Gemini account, given previous planning timeouts.
- Use three revisions across a project and its descendants; fourth revision is blocked. Plan retry costs no revision. Failed generation returns access. Run two requests concurrently: only one reservation can spend credit.
- Refresh purchases after delayed webhook delivery; do not buy again while confirmation is pending.
- Save and reopen cloud projects, share a backup/shopping list using iOS share sheet, and delete a project.
- Delete an account from My account. Confirm photos, cloud data, local account copies and credits are removed. Verify the support and privacy links work.
- Complete App Store privacy labels: account/contact details, user photos and descriptions, identifiers, purchase history, and service providers. The included required-reason manifest is not a substitute for these disclosures or reviewing SDK privacy manifests.

## Operations

The billing ledger grants/spends credits atomically, limits accounts to 100 paid-service requests/day, and permits one pending paid request per account. A successful initial image with a failed plan consumes the project credit but permits plan retries. If a finalize call fails, logs include `buildly_billing_finalize_failed` and the reservation ID; reconcile before retrying or issuing a manual credit. Refunds remove an unused credit when available; consumed outputs cannot be taken back. App Store refund and fraud disputes may need manual support.
