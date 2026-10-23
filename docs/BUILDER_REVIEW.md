# Builder review and live acceptance

Status: human review and real-model acceptance pending. Automated tests cover request
plumbing, validation, calculations, persistence and UI, not structural accuracy.

Generate the cases below with the configured live Gemini account. Download each
**builder review packet** from Project details. Have a qualified builder review scope,
missing measurements, material quantities, fastener compatibility, order of operations,
stop conditions and whether local engineering/permits are needed. Record findings in
Buildly, revise the input and repeat. Do not label a user-entered reviewer name as
independently verified approval.

| Case                                               | Expected result to review                                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Patio selected; request wooden platform + pergola  | Both wooden structures; no unrelated paver surface materials; connection/foundation questions             |
| Ground-level paver patio with sloping soil         | Paver system, drainage/base questions; no invented soil or retaining-wall specification                   |
| Elevated deck attached to house, stairs and guards | Ledger/flashing, stair/guard scope and structural verification; no generic freestanding plan              |
| Freestanding cedar pergola                         | Compatible timber, bracing and uplift/foundation questions; finish and connector quantities tied to steps |
| Fence with gate and slope change                   | Gate hardware and altered layout included; no simple straight-panel assumption hidden                     |
| Shed with door and window                          | Openings, roof and foundation scope explicit; no unrequested electrical installation                      |
| Make the platform two feet wider                   | New numeric width, revised image/plan and quantities; old version still available                         |
| Change material but keep dimensions                | Updated compatible fasteners/finish and quote reset; no stale procurement items                           |
| Unknown height / soil / attachment                 | Targeted questions and hold points, not fabricated construction specifications                            |
| Mixed or contradictory request                     | Clarification or explicit conflict, not silent substitution                                               |

For each case record the request, measurements, model configuration, date, reviewer
name/role, defects, required corrections and repeat-review outcome. Check local product
stock lengths and actual retailer quotes separately. Reject plans with unrelated items,
missing critical connectors, contradictory units, unsafe assumptions or instructions
that skip unresolved structural decisions. Automated clean findings are not acceptance.

Live setup smoke test: create a small concept, confirm a matching plan, ask a contextual
question, make one revision, refresh and sign in from another browser. If planning fails,
record the visible Google status/model code and inspect the `buildly_gemini_failure`
server log metadata. Never copy API keys, photo payloads or authorization headers into
an issue or review packet. Missing model access, billing and key restrictions must be
resolved on the configured Google project; rebuilding a saved plan does not regenerate
the image.
