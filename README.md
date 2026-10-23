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
- Guided Photo → Project → Details workflow with dimensions, budget, and experience; one details question per screen.
- Real photo edits through Gemini by default (or OpenAI Images Edits when selected): the original upload and project description are sent together, with instructions to preserve the property. The returned design displays at full size, with Original/Design/Compare views and real regeneration. Source and generated images retain the same dimensions. Requires an API key with image-model access.
- Category-specific illustrative materials, quantities, dimensions, price totals, printable list, downloadable text shopping list.
- Tools checklist, guided preparation/build steps, completed-step tracking.
- Project questions with context and conversation persistence.
- Saved projects and progress in localStorage on the current browser/device; no account required. Save explicitly before leaving a new project. Clearing browser storage removes projects. Storage failures display an error.
- Clear demo labels, assumptions, and understandable safety notes.

## What is demo or not connected

Image editing uses Gemini by default when `GEMINI_API_KEY` is set. The default image-editing model is `gemini-3.1-flash-image`. Set `IMAGE_PROVIDER=openai` and provide `OPENAI_API_KEY` to switch back to OpenAI. No fallback silently uses a different provider or billing account. The app never silently replaces failed AI edits with sample images. Without credentials, the normal photo-preview action displays a configuration error. A separate **Explore a sample plan instead (no photo edit)** action lets visitors test sample planning without using the API. Sample images appear separately, never in a misleading before/after slider.

Materials, costs, time estimates, tools, build steps, and Q&A are still **illustrative/demo**. Budget and experience are retained but do not drive an engineered design. Prices are not live retailer quotes. A real photo visualization does not turn these sample allowances into a construction-ready plan. Dedicated image analysis is still a stub; the image editing model itself sees the attached photo.

Build Mode is a seven-step preparation guide, not project-specific construction engineering. Site-specific instructions, footings, spans, loads, fasteners, permits, and inspections need qualified verification.

Authentication and cross-device database persistence are **not implemented**. The save flow honestly saves to this device rather than simulating an account. `lib/integrations.ts` defines email/Google/Apple authentication and Home Depot/Lowe's/Menards retailer adapter contracts. `prisma/schema.prisma` describes the future PostgreSQL user/project model; Prisma is not installed or connected and no migrations run.

## Environment variables

Create `.env.local` in the repository root using `.env.example` as a reference. Never commit credentials or use `NEXT_PUBLIC_` for secrets.

- `IMAGE_PROVIDER`: `gemini` (default) or `openai`. Switching this value and redeploying changes provider; saved projects stay intact.
- `GEMINI_API_KEY`: consumed server-side for Gemini photo edits. Requires Gemini API billing and image-model access. Never prefix this with `NEXT_PUBLIC_`.
- `GEMINI_IMAGE_MODEL`: optional; defaults to `gemini-3.1-flash-image`. Choose an available model supporting image output and uploaded-image editing. A text-only model cannot produce a preview.
- `OPENAI_API_KEY`: only used when `IMAGE_PROVIDER=openai`. Requires OpenAI API billing and image-model access. A ChatGPT subscription does not supply API billing.
- `OPENAI_IMAGE_MODEL`: optional; defaults to `gpt-image-1.5`. Use an image-editing model available to your OpenAI project.
- `DATABASE_URL`: reserved for PostgreSQL/Prisma persistence. Not currently consumed.

Only the explicit sample-plan mode works without the API key. The database variable may remain unset. Never paste API keys into chat, browser forms, or source code.

## Connect live services next

The server boundaries are separate in `lib/services/`: `image-analysis.ts`, `project-planning.ts`, `image-design.ts`, and `project-qa.ts`. API routes include `app/api/projects/route.ts`, `app/api/design/route.ts`, `app/api/config/route.ts`, and `app/api/ask/route.ts`.

1. Implement a server-side vision adapter with structured, validated output. Preserve the original photo; never treat pixel-derived dimensions as verified measurements.
2. Image editing is implemented. Validate actual output quality with a real API key and homeowner photos; model edits can still alter details, scale, and framing. Move image persistence from browser storage to private object storage when adding accounts.
3. Replace sample planning and Q&A with model-backed adapters, passing the project and conversation. Validate structured responses, keep safety constraints, handle failures, rate-limit requests, and only remove demo labels for actual live output.
4. Install Prisma, create and review migrations, provision PostgreSQL, and add secure object storage rather than storing photos in the database. Connect the model to server routes and enforce ownership.
5. Connect an authentication provider using `AuthAdapter`, secure cookies, and server-side session checks. Add email/Google/Apple only when real credentials and callback URLs are configured. Request sign-in on cloud save after showing the concept.
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
