# Materials and revision review — November 9, 2026 UTC

## Reported screw estimate

The saved railing revision mixed a **$32 box price** with a **350-piece package coverage** and a quantity already expressed as two purchases. The existing purchase calculation consequently produced **$11,200**. The arithmetic regression now requires a coherent representation: two boxes at $32, or 700 screws at $32/350 with 350 screws per box, both produce **$64**. That is a consistency check of the supplied purchase intent, not a verified supplier quote or an independently measured fastener requirement.

Every newly completed plan now receives a final model review of all materials, including homeowner scope, reference/design photos, quantities, formulas, package coverage, prices and rounded purchase totals. Broad deterministic checks reject obvious ordinary-fastener and package/unit outliers. Corrections must retain stable material references, match their formulas and pass the complete plan validator. An unsuccessful audit cannot publish an apparently complete materials list. Full-plan correction is bounded; a provider safety refusal is not retried as a quality correction.

Successful plans carry `materialsAuditVersion: unit-price-review-v1`. Existing plans can use the app's **Update estimates** action to review the same saved design without generating another image or using a design revision.

## Revision pictures and history

Revision generation now uses the current saved concept plus the original site as separately labeled anchors. Rail-only requests explicitly preserve unrelated footprint, levels, stairs, access and materials. Before saving, a visual model checks that the requested change is visible, the existing site/design is preserved and railing geometry is visually plausible. At most one corrective candidate is made from the same prior concept. Rejected candidates do not replace the saved design; the existing reservation cleanup releases unsuccessful revision work.

These are visual consistency checks, not a structural engineering assessment. A bad subjective result can still occur. Original and later snapshots remain available through the authenticated, owner-scoped `/api/projects/history` endpoint. Reading versions does not start generation or consume a token. Deleted or other owners' projects are excluded; the library continues to show one card per family.

## Verification

Backend runtime source: `fb5d5a7f62bc0ad96e879ee556de20b2df7713e4`. [Backend checks 42550423384](https://github.com/micahwarren/buildly/actions/runs/42550423384) passed. Regressions cover the reported package error, invalid/rubber-stamped corrections, formula and reference mismatches, provider refusals, bounded visual correction, history ownership and deletion boundaries. The normal production alias `site-ai-nomapps.vercel.app` resolves to READY deployment `dpl_74jvs39yeQSoGu9hZd9ePUZZTMc4` on that source.

An isolated live-model check on the preceding implementation commit (`618c521`) processed the reported saved railing design through the real complete planner and final material audit. It returned nine materials and twelve plan steps, with $138 in matching fastener allowances and a total range of $1,471–$2,573, in approximately 78 seconds. It generated no new picture, changed no customer data and charged no customer credit. Temporary QA flags were removed; its deployment was not assigned the production alias. The later commit only adds refusal handling and its regressions.

The live visual review **accepted the existing revision image**. It therefore does not establish that the review would catch the owner's specific visual complaint. Source anchoring, a bounded correction path and access to prior versions improve recovery; a new physical-device railing revision remains an acceptance check.

Mobile swipe delivery and native-device limits are documented separately in the mobile repository. No new TestFlight binary or public App Review was submitted as part of this backend verification. Customer photographs, identifiers, credentials and full prompts are excluded from this report and the regression fixtures.
