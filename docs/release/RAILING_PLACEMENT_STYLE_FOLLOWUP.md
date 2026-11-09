# Railing placement and style — prepared, not deployed

November 9, 2026 UTC. The owner clarified that the reported railing picture had the wrong placement or style. This follow-up is on the local `railing-placement-style` branch; production still runs the previously documented material/revision audit. Paid generation tests and deployment remain paused.

The edit and refinement prompts now preserve requested railing sides, extent, openings, material, color and profile. Existing door/stair access and unrelated deck features remain anchors. An unspecified style uses a simple compatible concept rather than an invented ornate design. Contradictory requested placement requires clarification.

The final visual reviewer now receives the actual uploaded inspiration and material photos, separately labeled as style/finish references. Previously it only received the site, current design and candidate. It checks the requested side/opening and style feature, and returns concrete correction notes. An empty or whitespace-only rejection cannot authorize a blind paid image retry. The existing two-candidate bound, provider refusal handling and save/plan checkpoint remain unchanged.

Local validation: typecheck, lint, all 154 backend tests and production build passed. After tightening the blank-issue guard, typecheck/lint and all seven focused revision-audit tests passed again. The integrated mock rejects a wrong-edge white railing, includes both style/finish references, corrects from the same original design, and only saves/plans the accepted candidate. Empty and blank rejection messages stop without saving or generating a second image.

These are mocked provider responses, not evidence that a live model will always choose the correct style or placement. No new paid image was generated, customer project changed, token granted or deployment submitted. A real railing revision still needs acceptance before calling the visual issue resolved. Image review does not certify structural safety or building-code compliance.
