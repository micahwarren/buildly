# Buildly

A functional, accessible DIY project MVP with **server-side AI photo editing and an explicit sample-plan mode**, built with Next.js App Router, React, TypeScript, and custom responsive CSS. Brand configuration is in `lib/project.ts`.

## Run locally

Requires Node.js 22 or newer and npm.

```sh
cd /path/to/buildly
npm ci
npm run dev
```

Open the local server on port 3000. For production:

```sh
npm run build
npm start
```

In the cloud workspace, use `npm ci --cache /workspace/.npm-cache` if your default npm cache directory is not writable. The development server listens on all interfaces. No database, credentials, or remote image hosts are required for demo mode. Fonts and illustrations are bundled locally.

## What works

- Responsive landing page, illustrated before/after example, five project categories.
- Photo selection, camera capture on supported devices, desktop drag-and-drop, file validation, and client-side resizing. JPG, PNG, WebP up to 15 MB.
- Guided Photo → Project → Details workflow with dimensions, budget, and experience; follow-up site details and explicit unknowns.
- Real photo edits through Gemini by default (or OpenAI Images Edits when selected): the original upload and project description are sent together, with instructions to preserve the property. The returned design displays at full size, with Original/Design/Compare views and real regeneration. Source and generated images retain the same dimensions. Requires an API key with image-model access.
- Request-driven AI materials and detailed instructions for live designs; category-based estimates only for explicit samples. Package quantities, manual supplier quotes, purchase tracking and a downloadable shopping worksheet.
- Tools checklist, guided preparation/build steps, completed-step tracking.
- Real Gemini project chat using scope, site details, materials, current step and conversation history. Saved design revisions preserve the previous version.
- Automatic project/progress saves and wizard drafts in IndexedDB; refresh recovery no longer depends on a manual Save button. Prior localStorage saves migrate without deleting the recovery copy. Clearing browser storage removes device-only copies.
- Email/password account creation, confirmation, sign-in, password reset, sign-out, and private cross-device project/photo sync through Supabase once configured.
- Downloadable/importable project backups and an explicit guest-project import into your account.
- Clear demo labels, assumptions, and understandable safety notes.

## What is demo or not connected

Image editing uses Gemini by default when `GEMINI_API_KEY` is set. The default image-editing model is `gemini-3.1-flash-image`. Set `IMAGE_PROVIDER=openai` and provide `OPENAI_API_KEY` to switch back to OpenAI. No fallback silently uses a different provider or billing account. The app never silently replaces failed AI edits with sample images. Without credentials, the normal photo-preview action displays a configuration error. A separate **Explore a sample plan instead (no photo edit)** action lets visitors test sample planning without using the API. Sample images appear separately, never in a misleading before/after slider.

Live plans use the homeowner request, site details, dimensions and both photos through Gemini. Chat is model-backed and never falls back to canned answers. Explicit sample plans still use illustrative estimates. Neither path supplies certified construction drawings. Prices are reference allowances or quotes entered by the user, not live retailer API prices.

Live Build Mode contains project-specific actions, material/tool references, checks and stop conditions; sample mode retains its preparation guide. Site-specific instructions, footings, spans, loads, fasteners, permits, and inspections need qualified verification.

Supabase email authentication and private cloud persistence are implemented in `lib/accounts/`, with an accessible account dialog in `components/AccountDialog.tsx`. They require your Supabase project settings, the SQL setup, and public connection variables. Follow [supabase/README.md](supabase/README.md). Without configuration the app clearly reports that account services are unavailable and keeps local saves working. Google/Apple sign-in and retailer connections remain future integrations. `prisma/schema.prisma` is an unused legacy reference; the active database setup is `supabase/setup.sql`.

## Environment variables

Create `.env.local` in the repository root using `.env.example` as a reference. Never commit credentials or use `NEXT_PUBLIC_` for secrets.

- `IMAGE_PROVIDER`: `gemini` (default) or `openai`. Switching this value and redeploying changes provider; saved projects stay intact.
- `GEMINI_API_KEY`: consumed server-side for Gemini photo edits, planning, revisions and chat. Requires Gemini API billing and access to the selected models. Never prefix this with `NEXT_PUBLIC_`.
- `GEMINI_IMAGE_MODEL`: optional; defaults to `gemini-3.1-flash-image`. Choose an available model supporting image output and uploaded-image editing. A text-only model cannot produce a preview.
- `GEMINI_PLANNING_MODEL`: optional explicit pin for the text/vision planner and chat. When unset, starts with `gemini-2.5-flash` and discovers an available stable numbered Flash model if the default returns 404. A pin is honored without discovery.
- `OPENAI_API_KEY`: only used when `IMAGE_PROVIDER=openai`. Requires OpenAI API billing and image-model access. A ChatGPT subscription does not supply API billing.
- `OPENAI_IMAGE_MODEL`: optional; defaults to `gpt-image-1.5`. Use an image-editing model available to your OpenAI project.
- `NEXT_PUBLIC_SUPABASE_URL`: your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public/publishable key; legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported. These public keys depend on the supplied row level security policies. Never use a service-role/secret key in a public variable.
- `DATABASE_URL`: unused legacy placeholder; Supabase browser persistence does not require it.

Only the explicit sample-plan mode works without the API key. The database variable may remain unset. Never paste API keys into chat, browser forms, or source code.

## Connect live services next

The server boundaries are separate in `lib/services/`: `image-analysis.ts`, `project-planning.ts`, `image-design.ts`, and `project-qa.ts`. API routes include `app/api/projects/route.ts`, `app/api/design/route.ts`, `app/api/config/route.ts`, and `app/api/ask/route.ts`.

1. Implement a server-side vision adapter with structured, validated output. Preserve the original photo; never treat pixel-derived dimensions as verified measurements.
2. Image editing is implemented. Validate actual output quality with a real API key and homeowner photos; model edits can still alter details, scale, and framing. Private object storage is implemented for signed-in Supabase accounts; confirm storage policies and cross-device behavior against the configured project.
3. Planning, revisions and Q&A are model-backed with validated output. Verify their actual output using production model access and the review cases in `docs/BUILDER_REVIEW.md`.
4. Apply `supabase/setup.sql`, configure URL/publishable key and Auth redirects, and verify live private storage and row level security. See the Supabase setup guide.
5. Verify real email confirmation/password reset delivery with production SMTP. Supabase email auth is implemented; Google/Apple OAuth remain future additions. Cloud operations verify the signed-in user and rely on per-user database/storage policies; no service-role key is used in the browser.
6. Connect real retailer APIs through `RetailerAdapter`, showing store, timestamp, actual prices, and availability. No approximate allowance should be presented as a retailer quote.

## Validation

```sh
npm test
npm run build
npm run lint
npm run typecheck
```

The end-to-end test needs a running app. On a development machine:

```sh
npx playwright install chromium
npm run dev
# in another terminal
npm run test:e2e
```

On this cloud machine, Chromium is already installed:

```sh
BROWSER_PATH=/usr/bin/chromium BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

The browser test never invokes the paid image provider. It exercises image upload, wizard choices, explicit sample generation, missing-key error UI, AI-result rendering and comparison using an intercepted response, shopping-list download, tool selection, build progress, Q&A, saved-state restoration after reload, mobile layouts, and invalid API requests. It writes screenshots to a temporary directory reported in its output. Camera hardware and print dialogs require device/manual verification.

## Deploy on Vercel and enable real photo previews

1. Import `micahwarren/buildly` with Next.js defaults and deploy the `main` branch.
2. In **Vercel → Project → Settings → Environment Variables**, add `GEMINI_API_KEY` using your Google AI Studio key and `IMAGE_PROVIDER` with value `gemini`. Select **Production** (and Preview only if desired). Save it securely; never share it in chat or commit it.
3. Confirm your Google AI Studio project has paid-tier billing enabled and access to `gemini-3.1-flash-image`. Optionally set `GEMINI_IMAGE_MODEL` to another compatible image-generation model. The Google Cloud $300 welcome credit excludes Gemini API usage, as the billing setup screen explains.
4. In **Deployments**, redeploy the latest deployment after changing environment variables.
5. Start a **new project**, upload the original backyard photo, describe the patio/deck, and choose **Show my project in my photo**. Old saved sample plans remain samples until you choose **Create a photo preview**.

Photo edits can take several minutes. Routes use the Node.js runtime and request a 300-second function duration; your Vercel plan must support that duration. Errors for missing keys, denied model access, usage limits, and timeouts remain visible instead of showing a fake design. The uploaded photo is sent to the selected provider for processing. Generated designs are visual concepts, not engineering, and may change scene details despite preservation instructions.

Each preview/regeneration incurs usage with the selected provider. A basic in-memory guard limits requests per IP to three per 15 minutes **per running instance**. This is not a global or abuse-resistant spending limit across serverless instances. Before broad public launch, configure Vercel Firewall/shared rate limiting and provider spending controls, plus account-based access if needed. No credentials are sent to the browser.

Provider contract tests use mocked HTTP responses and validate attached source image, prompt, model options, returned-image decoding, original-size normalization, and failure behavior. **A real paid provider response has not been tested in this workspace because no key is available. Mocked tests cover both providers; do not describe mocked output as a validated backyard rendering.**

### Change providers later

Keep `IMAGE_PROVIDER=gemini` and `GEMINI_API_KEY` for Google. To use OpenAI later, set `IMAGE_PROVIDER=openai`, add `OPENAI_API_KEY`, and redeploy. You can retain both keys securely in Vercel; only the selected provider is used. No source change is needed for this switch. Existing photos and saved projects are unaffected.

Gemini implementation follows the official [Google image-generation cookbook](https://github.com/google-gemini/cookbook/blob/main/quickstarts/Get_Started_Nano_Banana.ipynb). It sends inline photo bytes and the project prompt to the `generateContent` endpoint, requests image output, and rejects text-only or safety-blocked responses. `app/api/config` exposes only credential presence, never a key or proof of working model access.

## Account and recovery validation

`npm run test:e2e` also checks unfinished-wizard recovery, automatic result recovery before a manual Save, project backup export, and migration of old saves. It must run against a build without Supabase public variables for the unconfigured-account fallback check.

`tests/accounts.mjs` exercises the real Supabase browser SDK with isolated intercepted HTTP responses. To run it, start a separate development server with **test-only** public settings:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://buildly-auth-test.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_testonly npm run dev -- --port 3001
# another terminal
BROWSER_PATH=/usr/bin/chromium BASE_URL=http://127.0.0.1:3001 node tests/accounts.mjs
```

The test intercepts all auth requests and never creates real accounts. It verifies signup/confirmation messaging, login, private image uploads, metadata saving, progress sync, restoration in a fresh browser context, local preservation when cloud saving fails, and isolation after sign-out. Restart/rebuild without test settings afterward. Mock success does not validate your actual Supabase policies, email delivery, or cross-device access; these require live configuration.

### Preliminary materials and labor calculator

`lib/estimates.ts` calculates quantities separately for decks, open pergolas,
paver patios, straight panel fences and basic sheds. Dimensions and experience
change the labor allowance. Labor is total person-hours, with a stated crew and
six productive hours/person/day conversion; it excludes curing, weather and
administrative waiting. Labor coefficients are planning heuristics, not measured
contractor productivity data. Price inputs are reference USD allowances, not live
quotes; the displayed range is 80–140% of the itemized subtotal, not a statistical
confidence interval. Fasteners are listed explicitly; approved connector schedules
must replace the allowances before purchase. Do not substitute ordinary deck screws
for rated connector fasteners.

Each estimate discloses its assumed layout and missing scope in Project details.
The calculator does not infer height, spans, soil, gates, stairs, guards, roof loads
or custom features from an image or free text. These require a site-specific design
and supplier takeoff before this can become a purchase-ready bill of materials.
Custom project types show “Scope review needed” instead of an invented quote.
This calculator now supplies explicitly labeled sample plans only. Live and saved
AI designs use the photo-grounded planner described below.

### Plans grounded in the generated design

Live generation now sends the original site photo, generated concept, user description,
dimensions and experience to a separate Gemini vision/text planning request. The default
`GEMINI_PLANNING_MODEL` is `gemini-2.5-flash`; it uses the existing server-side
`GEMINI_API_KEY` (also required for planning if image generation is switched to OpenAI).
Each generation adds a paid text/vision request; no additional subscription is required,
but the configured account must have model access and quota. The default can be overridden
with a supported structured-output vision model and a redeploy.

The planner returns material purposes and quantity bases, unresolved questions, and
step-by-step actions, materials, tools, checks and stop conditions. Runtime validation
requires materials/tools referenced by steps to exist and every listed material to be
used in a step. It rejects malformed, truncated or incomplete plans. These checks enforce
internal consistency, not construction accuracy or engineering certification. Quantity or
price zero means unknown and displays as Verify/Not priced; unknown lines are excluded
from totals and the partial estimate is labeled. Real model output must still be reviewed
against site measurements, product specifications and structural requirements.

Category-based estimates are now only sample/demo content. Live planning failures retain
the generated image, clear generic materials/instructions and show a retry state. Existing
projects can use **Rebuild plan from this design** to replace old estimates without buying
another image; success resets step progress and persists the plan, while failure preserves
the saved project. New image variants also receive a new associated plan. The endpoint
`/api/plan` and `/api/ask` share a separate per-instance 20-request/15-minute guard; image generation and revisions retain the 3-request image guard. Automated tests mock Gemini;
production credentials are needed to verify actual model availability and output quality.

### Refinement, shopping and review

- Site answers persist in drafts, account projects and backups and are sent to image generation, planning and chat. Unknown answers remain unresolved.
- **Refine this project** interprets an explicit change, edits the current concept, then rebuilds its plan. It saves a separate project ID with `parentProjectId`, keeping the old version. Quotes, chat, completion progress and review notes do not carry into the new version. Ambiguous requests ask for clarification before buying another image.
- **Update details and rebuild plan only** keeps the image, replaces the plan and clears obsolete quotes/review notes on success. Failure leaves the old project unchanged.
- Package counts use `ceil(required quantity / package coverage)` in matching units, not an optimized cutting plan. Unknown coverage/quantities are not converted. Supplier links are searches, not confirmed products; quote totals use user-entered package prices and are labeled incomplete where needed. No live inventory/pricing integration is configured.
- The builder review packet is a standalone HTML download containing both photos and the complete plan; open it to print. Automated findings and user-recorded reviewer notes do not certify a plan or verify the reviewer's credentials. See `docs/BUILDER_REVIEW.md` for the pending human review procedure.
- Google failure messages include status/code and model without exposing raw provider text, credentials or photos. An unavailable unpinned default model can trigger bounded paginated discovery of stable numbered Flash releases (excluding omni, preview, image, audio and lite variants). Discovered output-token limits cap the requested output. Schema/JSON-mode rejections can retry a simpler response format with the same specification and runtime validation; no additional image is generated. All attempts share one deadline. Other errors remain explicit; billing or permissions failures still require account configuration.
- Run `BROWSER_PATH=/usr/bin/chromium BASE_URL=http://127.0.0.1:3000 node tests/upgrades.mjs` against the app for revision preservation, package quotes, review export, chat UI and mobile checks. Paid services are mocked in automated tests. No claim of live model or professional review is made from those tests.

Planning compatibility regression: `tests/gemini-compatibility.test.ts` reproduces
the unavailable-default/model-list sequence that previously selected
`gemini-omni-flash-preview`. Automatic discovery now excludes that model family.
Explicit `GEMINI_PLANNING_MODEL` pins are still respected; remove an incompatible
pin or choose a supported stable text/vision model in Vercel and redeploy.
These regression tests mock Google responses; production acceptance still requires
rebuilding a saved plan against the configured account.


## iPhone app and project purchases

See [the TestFlight release guide](docs/TESTFLIGHT.md) for native builds, App Store consumable purchases, the three-revision allowance, Supabase billing migration, and release checks. Billing is disabled until configured; do not submit an app with unverified purchases or failing live plan generation.
