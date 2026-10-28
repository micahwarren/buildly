# Simplified mobile project flow — deployment review

The Expo client in micahwarren/expo-starter now sends a free-form description, optional dimensions and optional inspiration/material images. This backend update is required before that client can generate projects without dimensions.

Changes:
- Preserve omitted dimensions as unknown (internal 0), including across revisions; never insert 12 × 16 defaults into these requests.
- Accept two inspiration and two material photos, validate their format/size, and label them separately from the actual site in both supported image providers and planning requests.
- Return design-specific suggested measurements as labeled concept guidance or a request to measure an existing opening. Do not treat image proportions as measured dimensions or unknown quantities as free materials.
- Preserve the existing billing and revision reservation checks. Old clients supplying measured dimensions and categories remain supported.
- Remove website home arrows from privacy and terms. The new mobile client also presents those documents within the app.

No database migration, dependency installation, provider change or new secret is needed. Request size stays below the Vercel function payload cap; the mobile client compresses photos and validates the combined request before sending it.

Validation: TypeScript/ESLint, production Next.js build and 62 unit/service tests pass. Tests use mocked AI responses; no real photos, customer accounts or paid generation are exercised. Native camera, live generation and real-device storage/revision flows still require testing after deployment and a new TestFlight binary.

Production deployment is pending user approval because the user requested a check before publishing. This branch has not been pushed or deployed. Deploy the backend before distributing the updated Expo app. The existing TestFlight binary does not update with source changes; see expo-starter/docs/TESTFLIGHT.md for build/submit instructions and the one-time correction to the remote iOS build number so the next build exceeds the old build 6.
