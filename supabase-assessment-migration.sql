-- CVHS Flight School standardized assessment migration
-- Run ONCE in the Supabase SQL Editor for the existing project before deploying this build.

-- Keep permanent per-module completion in student_progress.module_progress.
alter table public.student_progress
  add column if not exists module_progress jsonb not null default '{}'::jsonb;

-- Expand quiz_attempts so each submitted assessment can be reconstructed exactly.
alter table public.quiz_attempts add column if not exists attempt_uuid uuid;
alter table public.quiz_attempts add column if not exists quiz_version text not null default 'legacy';
alter table public.quiz_attempts add column if not exists responses jsonb not null default '[]'::jsonb;
alter table public.quiz_attempts add column if not exists reflection_prompt text not null default '';
alter table public.quiz_attempts add column if not exists reflection_answer text not null default '';
alter table public.quiz_attempts add column if not exists reflection_model text not null default '';
alter table public.quiz_attempts alter column question_count set default 30;

create unique index if not exists quiz_attempts_attempt_uuid_unique
  on public.quiz_attempts (attempt_uuid);

alter table public.student_progress enable row level security;
alter table public.quiz_attempts enable row level security;

-- Upsert requires UPDATE permission as well as INSERT permission.
drop policy if exists "Students can update their own quiz attempts" on public.quiz_attempts;
create policy "Students can update their own quiz attempts"
on public.quiz_attempts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Re-create the core policies defensively so an older project has the full set.
drop policy if exists "Students can read their own quiz attempts" on public.quiz_attempts;
create policy "Students can read their own quiz attempts"
on public.quiz_attempts for select
using (auth.uid() = user_id);

drop policy if exists "Students can create their own quiz attempts" on public.quiz_attempts;
create policy "Students can create their own quiz attempts"
on public.quiz_attempts for insert
with check (auth.uid() = user_id);

drop policy if exists "Students can read their own progress" on public.student_progress;
create policy "Students can read their own progress"
on public.student_progress for select
using (auth.uid() = user_id);

drop policy if exists "Students can create their own progress" on public.student_progress;
create policy "Students can create their own progress"
on public.student_progress for insert
with check (auth.uid() = user_id);

drop policy if exists "Students can update their own progress" on public.student_progress;
create policy "Students can update their own progress"
on public.student_progress for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
