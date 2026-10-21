-- ExplainIt V1: row-level security. Every policy checks that the row belongs to the signed-in user.
-- The worker uses the service role key, which bypasses these policies.

alter table projects         enable row level security;
alter table messages         enable row level security;
alter table jobs             enable row level security;
alter table videos           enable row level security;
alter table llm_calls        enable row level security;
alter table worker_heartbeat enable row level security;

-- projects: full control of your own
create policy own_projects on projects for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- messages and llm_calls: read and add your own
create policy read_own_messages on messages for select to authenticated using (user_id = auth.uid());
create policy add_own_messages  on messages for insert to authenticated with check (user_id = auth.uid());
create policy read_own_llm      on llm_calls for select to authenticated using (user_id = auth.uid());
create policy add_own_llm       on llm_calls for insert to authenticated with check (user_id = auth.uid());

-- jobs: read your own; create only fresh queued jobs; no direct updates
-- (cancel and retry go through cancel_job() and retry_job())
create policy read_own_jobs on jobs for select to authenticated using (user_id = auth.uid());
create policy add_own_jobs  on jobs for insert to authenticated
  with check (user_id = auth.uid() and status = 'queued' and progress = 0 and attempts = 0);

-- videos: read your own; the worker writes them
create policy read_own_videos on videos for select to authenticated using (user_id = auth.uid());

-- heartbeat: any signed-in user may read it
create policy read_heartbeat on worker_heartbeat for select to authenticated using (true);
