# Setup
1. Copy `.env.example` to `.env.local` and enter the VITE Supabase URL and publishable key.
2. Run the latest `supabase-schema.sql` in Supabase SQL Editor. Existing tables are preserved; the script adds any missing quiz structures.
3. Run `npm install` and `npm run dev`.

## Quiz behavior
- Each chapter has 240 available question records.
- Each attempt selects 20 from the larger chapter bank.
- Recent questions are avoided where possible, so retakes draw different records rather than merely shuffling the same 20.
- Students can take unlimited quizzes.
- Closing/backing out of an unfinished quiz automatically saves its question set, answers, and current question in browser storage.
- Reopening that chapter's quiz resumes the unfinished attempt.
- Finishing the attempt clears the draft and records the score in quiz history.
- Module status is binary: NOT COMPLETE until the student scores 70% or higher on a module quiz; then COMPLETE. Reading alone does not change status.
- Quiz history is retained and quizzes can be retaken without limit, even after completion.
