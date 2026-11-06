# Project library and recovery update

Revisions stay in one logical project in the authenticated catalog. The latest leaf is displayed; older records remain intact. Deleting a project tombstones its entire owned family before cleaning files, under the existing operation lock. The additive SQL migrations are `supabase/project-families.sql` and `supabase/background-recovery-visibility.sql`; their RPCs are service-role only. Live migration verification found project, job and committed-reservation counts unchanged.

Recent failed requests remain visible until dismissed or reopened for editing. Active queue retries are reported as running even if an individual attempt failed. Dismissal hides a terminal request from the list without deleting its operation identity or credit ledger. Released reservations are reported accurately. Image-provider diagnostics record operational status/model codes, never credentials or images.

RevenueCat v2 DELETE queues customer deletion. Account deletion now polls the same authenticated customer URL until 404; it no longer requires a second password submission because an immediate deletion receipt is incomplete. Unknown/unconfirmed provider responses fail closed and preserve the account.

Validation: 130 backend tests, TypeScript, lint and production build passed. Tests cover delayed provider deletion, refusal to accept unconfirmed deletion, family grouping/pagination/ownership/deletion, and retry/dismissal/credit state. No real customer account was deleted for testing. Physical first-attempt deletion is still an acceptance check for the updated release.
