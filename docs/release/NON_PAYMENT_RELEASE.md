# Service release for the Expo iPhone app

The active mobile client is `micahwarren/expo-starter`, using Expo/EAS and Apple app 6827150277. This repository supplies its backend. The ios-native SwiftUI/Capacitor sources and manual legacy build workflow are retained for reference; do not upload them as this release.

## Deployment prerequisites

Do not deploy this service change before the reviewed SQL migration. In the existing Supabase project, back up data and apply setup.sql (only if needed) followed by **supabase/production.sql**, with owner approval for the production change. The latter is transactional/repeatable and changes no payment table. It adds durable job claims, account-deletion fences, project tombstones and minimal diagnostics. Read access remains account-scoped; service-role RPCs enforce shared limits. Never rerun the older setup policies alone afterward.

Required server configuration: existing Supabase URL, publishable key, **SUPABASE_SERVICE_ROLE_KEY**, and the approved existing AI credentials/models. Both image providers still use Gemini for plans. `BUILDLY_GENERATION_ENABLED=false` pauses new work without denying saved-project reads. Defaults are 20 starts/account/day, 50/service/day, six/account/15 minutes, one active/account and five active/service. These limits do not represent charges or guarantee a dollar budget.

Add a random BUILDLY_MAINTENANCE_TOKEN in host secrets and the repository Actions secret; configure Actions variables BUILDLY_API_URL and BUILDLY_MAINTENANCE_ENABLED=true after a successful manual check. The workflow is initially disabled. It retries project file deletion, removes eligible failed uploads, expires stalled requests and prunes eligible diagnostics/history after 30 days. Confirm job logs/failure notifications; do not claim retention is working before scheduling and verifying it. Saved-result idempotency records remain with their accounts; unknown legacy folders need manual review.

After the approved service deployment, run:

```sh
BUILDLY_API_URL=https://buildly-ecru.vercel.app node scripts/check-production.mjs
```

This is read-only and makes no AI call. Verify the returned release/commit, then test with disposable real accounts. The next mobile binary needs `/api/jobs`, the new consent configuration, `/api/account`, deletion/maintenance/diagnostic APIs and updated policies/support. Older clients without consent need the new app; no public generation bypass is retained. Explicit demo mode still avoids paid AI.

Supabase Auth owner actions: production mail sender/SMTP and SPF/DKIM, email-confirmation/password policy/rate limits, and allowed redirects `buildly://auth/confirm` and `buildly://auth/callback`. Test fresh PKCE links on the requesting phone. Configure backups/log retention to match the policy. No security setting was changed remotely by this branch.

## Validation and remaining owner work

Local checks: TypeScript, ESLint, production build, existing service tests and new PGlite SQL/HTTP-boundary tests. They exercise repeatable SQL, duplicate/conflicting requests, ownership, limits, private-image paths, image checkpointing, failed plan retry, deletion fences and diagnostic constraints. Fixtures do not verify live Supabase, provider access, real email, deployed RLS, native behavior or costs.

The Expo repository contains the complete coordinated release runbook, device acceptance record, App Store listing draft and privacy worksheet under docs/release. Finish these before public launch. Actual builder/legal review, private key handling, backup restore drill, host/API quota review, native acceptance, screenshots, Apple metadata and App Review remain owner-controlled checks. Nothing in this branch publishes the app.

Compatible PostCSS override fixes its high advisory. Three moderate audit advisories remain through the archived Capacitor CLI/xcode/uuid chain; review official fixes before launch. Existing purchase dependencies/configuration/schema remain unchanged. Do not run billing.sql or enable/configure payment products as part of this task.

For incidents, pause generation if needed and roll back to a compatible service deployment. Keep additive data/migration in place; do not delete customer tables to roll back code. Record the app commit, service commit and Apple build number together.
