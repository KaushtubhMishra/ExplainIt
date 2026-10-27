-- ExplainIt: retry_job() reset status but not attempts, so a job that had already used up
-- its attempts (requeue_stale_jobs marks a job failed after 3 crashes) would be retried once
-- and then immediately fail again the first time it stalled, instead of getting a fresh set
-- of attempts. retry_job's signature is unchanged (still just a uuid, a stable built-in
-- type, not a recreated enum), so CREATE OR REPLACE is safe here and keeps its existing
-- grants in place — unlike reserve_llm_call's enum-driven recreation, no revoke/grant needs
-- reissuing (confirmed by testing).

create or replace function retry_job(p_job uuid) returns void
language plpgsql security definer set search_path = public as $$
declare j jobs;
begin
  select * into j from jobs where id = p_job and user_id = auth.uid() and status = 'failed';
  if not found then
    raise exception 'not_retryable';
  end if;
  if exists (select 1 from jobs where project_id = j.project_id
             and status in ('queued', 'voicing', 'rendering', 'uploading')) then
    raise exception 'job_active';
  end if;
  update jobs set status = 'queued', progress = 0, error = null, claimed_at = null, finished_at = null, attempts = 0
   where id = p_job;
end $$;
