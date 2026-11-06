# Background generation and project notifications

Apply `production.sql` and `billing.sql` before the additive migrations:
`background-jobs.sql`, `project-notifications.sql`, `background-worker-auth.sql`.
The private queue stores validated inputs before the create API acknowledges the
request. A worker leases each job for 320 seconds, longer than its 300-second
function limit. Up to three attempts recover transient errors; a saved image
resumes only its matching plan. Billing reservation reconciliation and the
existing request ID prevent duplicate charges. Once the design is checkpointed,
recovery completes its matching plan without regenerating that saved image.

On the existing Supabase project, enable pg_cron, pg_net and Vault. Save a dedicated
random credential in Vault as `siteai_background_worker_token` and as the Vercel
Production variable `SITEAI_JOB_WORKER_TOKEN`. Never use a user or Supabase API key.
Apply `background-scheduler.sql`, which deliberately leaves its named minute job
inactive. Deploy the worker, verify unsigned calls return 401 and a fresh signed
call returns 202, then enable `siteai-background-jobs` in `cron.job`.

The scheduler uses a fixed HTTPS URL and short-lived HMAC signatures with one-use
nonces. Its permanent credential never appears in pg_net's platform-managed
transport tables. Queue inputs, push registrations, delivery records and replay
records are RLS-enabled and inaccessible to app roles. The scheduler only calls
Vercel when work is due; the existing daily cleanup cron is unchanged.

Notifications require the signed native build, an APNs credential in the existing
Expo project and user permission. The app requests permission after a project is
accepted. Delivery is outbox-based, complete-plan-only and deduplicated. Generic
alerts contain no project photo, description or title. Notification taps verify
the current account owns the saved result before opening it. Android also needs
its own FCM configuration before real-device push delivery can be accepted.

Tests cover durable acceptance, concurrent leases, crash recovery, image/plan
checkpoints, billing, complete-only delivery, account switching/deletion, RLS,
HMAC expiry and one-use nonces. On TestFlight build 48, the owner confirmed that
the ready alert arrives after closing the app and the complete image, materials
and plan are available on reopening. This records owner-reported real-iPhone
acceptance, beyond successful Expo/APNs receipts. Notification-tap navigation and
physical Android delivery have not been separately confirmed.
