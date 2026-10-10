# Assessment history and reflection update (work in progress)

This package adds an ungraded written reflection after the 30 multiple-choice questions; stores question snapshots, selections, answer keys, explanations, reflection and model response per attempt; supports opening historical attempts; and saves attempts locally before trying Supabase sync.

**Before deploying:** Run `supabase-assessment-migration.sql` in the Supabase SQL editor. Build with `npm ci && npm run build`. This environment could not complete dependency installation/build verification.

**Important limitations:** The 17 banks have not yet been rewritten as 510 unique validated questions. Reflection prompts and model rubrics are currently generic chapter placeholders, not final chapter-specific model answers. Offline pending sync retries on the next authenticated session initialization, not continuously. Older attempts without response snapshots cannot show per-question review. Guest history is browser-local only. This is a work-in-progress engineering package, not a production release.
