# Plan completion progress

The mobile Plan is a plain instruction list with one completion checkbox per step. PATCH /api/projects/progress authenticates the owner and atomically changes only progress fields on the owned, non-deleted project. A stale step title, invalid index, deletion fence or foreign project is rejected. Client roles cannot execute the service-only SQL RPC. Updates merge with current progress and preserve the plan, materials and cost. Legacy sequential completion is retained; newly generated/revised plans clear completion flags.

Migration `supabase/project-progress.sql` adds one function without rewriting project rows. Live verification confirmed unchanged project counts and server-only execution. No credit, purchase, AI-provider or account-deletion behavior is changed.

Validation: 132 backend tests, TypeScript, lint and production build pass. New tests cover owner isolation, concurrent/idempotent checks, reload persistence, stale-plan rejection, deleted projects and deletion fences. The Gemini payment block remains a separate launch issue; no paid AI call was made for this change.
