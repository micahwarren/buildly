# Buildly

A functional, accessible DIY project **demo MVP**, built with Next.js App Router, React, TypeScript, and custom responsive CSS. Brand configuration is in `lib/project.ts`.

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
- Server-side sample planning, staged generation screen, project results, comparison slider, alternate sample inspiration.
- Category-specific illustrative materials, quantities, dimensions, price totals, printable list, downloadable text shopping list.
- Tools checklist, guided preparation/build steps, completed-step tracking.
- Project questions with context and conversation persistence.
- Saved projects and progress in localStorage on the current browser/device; no account required. Save explicitly before leaving a new project. Clearing browser storage removes projects. Storage failures display an error.
- Clear demo labels, assumptions, and understandable safety notes.

## What is demo or not connected

**No live AI runs, even if an API key is added.** Image analysis is a stub, design images are local illustrations, and planning uses deterministic sample allowances. The uploaded photo is preserved separately; the sample image is **not** an edit of it. The alternate design button switches illustrative samples. Q&A uses topic-based sample guidance, not a language model. Budget and experience are retained, but do not drive an engineered design. Prices are not live retailer quotes; no purchasing links or carts are fabricated.

Build Mode is a seven-step preparation guide, not project-specific construction engineering. Site-specific instructions, footings, spans, loads, fasteners, permits, and inspections need qualified verification.

Authentication and cross-device database persistence are **not implemented**. The save flow honestly saves to this device rather than simulating an account. `lib/integrations.ts` defines email/Google/Apple authentication and Home Depot/Lowe's/Menards retailer adapter contracts. `prisma/schema.prisma` describes the future PostgreSQL user/project model; Prisma is not installed or connected and no migrations run.

## Environment variables

Create `.env.local` in the repository root using `.env.example` as a reference. Never commit credentials or use `NEXT_PUBLIC_` for secrets.

- `OPENAI_API_KEY`: reserved for a future server-side provider. Not currently consumed.
- `DATABASE_URL`: reserved for PostgreSQL/Prisma persistence. Not currently consumed.

Both may remain unset for this demo. Never paste API keys into chat, browser forms, or source code.

## Connect live services next

The server boundaries are separate in `lib/services/`: `image-analysis.ts`, `project-planning.ts`, `image-design.ts`, and `project-qa.ts`. API routes are `app/api/projects/route.ts` and `app/api/ask/route.ts`.

1. Implement a server-side vision adapter with structured, validated output. Preserve the original photo; never treat pixel-derived dimensions as verified measurements.
2. Implement image editing using that photo as the source, restricting changes to the requested area and retaining scene/perspective. Store source and generated images separately in private object storage.
3. Replace sample planning and Q&A with model-backed adapters, passing the project and conversation. Validate structured responses, keep safety constraints, handle failures, rate-limit requests, and only remove demo labels for actual live output.
4. Install Prisma, create and review migrations, provision PostgreSQL, and add secure object storage rather than storing photos in the database. Connect the model to server routes and enforce ownership.
5. Connect an authentication provider using `AuthAdapter`, secure cookies, and server-side session checks. Add email/Google/Apple only when real credentials and callback URLs are configured. Request sign-in on cloud save after showing the concept.
6. Connect real retailer APIs through `RetailerAdapter`, showing store, timestamp, actual prices, and availability. No approximate allowance should be presented as a retailer quote.

## Validation

```sh
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

The browser test exercises image upload, wizard choices, demo generation, comparison, shopping-list download, tool selection, build progress, Q&A, saved-state restoration after reload, mobile layouts, and invalid API requests. It writes screenshots to a temporary directory reported in its output. Camera hardware and print dialogs require device/manual verification.
