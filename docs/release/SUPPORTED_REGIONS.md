# Provider-region correction — November 9, 2026

The owner approved the necessary corrections after reviewing the seven unsupported-storefront findings. App Store app 6827150277 and all three existing consumable packs now select exactly **168** supported storefronts. Afghanistan, Belarus, China, Hong Kong, Macao, Myanmar and Russia were removed. Automatic new-country availability is off for the app and products. Prices in every remaining storefront were compared before/after and are unchanged. The selected build remains 57, all four review items remain, public review is unsubmitted and release is manual. No NomNom settings were changed.

The authoritative current Gemini list was read at https://aistudio.google.com/docs/available-regions . Its 230 region names were mapped completely to ISO country codes with a deliberate Kosovo alias (XK). The server snapshot records its source and check date in `lib/production/gemini-regions.json`; update it through reviewed source changes when the provider changes availability.

## Server enforcement

Storefront selection alone does not establish the current region of an installed app. Production AI entry uses Vercel's ingress country header, not a profile, project location or client body field. An unsupported country is rejected with a controlled 403. Missing/invalid location metadata fails closed with 503. No credit reservation, queue insertion or provider request follows that rejection. Saved-project reads, balances, refunds/reconciliation and account deletion are outside this AI gate.

The current service uses Gemini for planning/questions even if its image provider changes, so every current AI entry is gated. The Vercel deployment supplies the ingress metadata; this implementation must not be copied to an untrusted self-hosted proxy without an equivalent trusted-header boundary. No GPS permission or country/IP field is added to project/queue records. Hosting-provider request logging remains governed by its existing settings/contracts.

The durable worker resumes a previously accepted job without interpreting its server location as the phone's location. Local development has no Vercel country requirement; production remains closed when ingress metadata is unavailable. This is a country-level service control, not proof of a person's physical location or a sanctions/identity screening system.

## Checks and remaining scope

All **163 backend tests**, typecheck/lint and production build passed in [hosted checks 42663648106](https://github.com/micahwarren/buildly/actions/runs/42663648106) on exact source `b9ce04d3bd9d75dccfb5ab8e6d043b2029a5ca4f`. Five region regressions cover supported regions including EEA/UK/Switzerland/Kosovo, all seven excluded storefronts, missing/malformed metadata, rejection before account work, unchanged credits/empty queue on rejection, and worker completion after a supported client leaves.

The owner supplied a Paid 1 billing screenshot for Default Gemini Project and confirmed the production API key belongs to it. That is owner-confirmed paid-project evidence, not an independent Google billing-admin API inspection. No credit top-up or billing setting was changed. Trademark assessment and incorporated Google contract review remain separate. No new Expo build or paid model generation is needed for this server-only change.

READY production deployment `dpl_23bNGG53szkSCgV1C1b93Aqs9R28` and alias `site-ai-nomapps.vercel.app` were independently read back. Public unauthenticated normal/forged-unsupported/forged-unknown country requests all returned 401; they did not bypass authentication or reach an AI call. A request actually originating from an unsupported country was not performed. Temporary QA flags are absent. See [deployment receipt](provider-region-deployment.json). Later documentation-only commits do not change this runtime.
