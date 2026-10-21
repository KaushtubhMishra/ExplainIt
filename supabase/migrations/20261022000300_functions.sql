-- ExplainIt V1: functions that keep multi-step changes atomic.

-- 23:59 today in India time, as a timestamp.
create function ist_day_end() returns timestamptz language sql stable as $$
  select (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '23 hours 59 minutes')
         at time zone 'Asia/Kolkata'
$$;

-- Called by the API as the user (row-level security applies): save a plan only if
-- nobody saved a newer version since it was loaded.
create function save_plan(p_project uuid, p_plan jsonb, p_expected integer)
returns integer language plpgsql as $$
declare v integer;
begin
  update projects
     set scene_plan = p_plan,
         plan_version = plan_version + 1,
         stage = case when stage = 'planning' then 'storyboard'::project_stage else stage end
   where id = p_project and plan_version = p_expected
  returning plan_version into v;
  if v is null then
    raise exception 'version_conflict';
  end if;
  return v;
end $$;

-- Called by the API as the user: cancel a job that has not started.
create function cancel_job(p_job uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update jobs set status = 'cancelled', finished_at = now()
   where id = p_job and user_id = auth.uid() and status = 'queued';
  if not found then
    raise exception 'not_cancellable';
  end if;
end $$;

-- Called by the API as the user: put a failed job back in the queue.
create function retry_job(p_job uuid) returns void
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
  update jobs set status = 'queued', progress = 0, error = null, claimed_at = null, finished_at = null
   where id = p_job;
end $$;

-- Worker: take the oldest queued job, safely even if two workers ever run.
create function claim_next_job() returns setof jobs language plpgsql as $$
declare j jobs;
begin
  update jobs set status = 'voicing', claimed_at = now(), attempts = attempts + 1
   where id = (select id from jobs where status = 'queued'
               order by created_at limit 1 for update skip locked)
  returning * into j;
  if j.id is null then
    return;
  end if;
  update projects set stage = 'rendering' where id = j.project_id;
  return next j;
end $$;

-- Worker: finish a job and record its video, with tonight's expiry.
create function complete_job(p_job uuid, p_key text, p_size bigint, p_duration numeric, p_metrics jsonb)
returns uuid language plpgsql as $$
declare j jobs; v uuid;
begin
  update jobs set status = 'done', progress = 100, finished_at = now(), metrics = metrics || p_metrics
   where id = p_job returning * into j;
  if j.id is null then
    raise exception 'job_not_found';
  end if;
  insert into videos (project_id, user_id, job_id, r2_key, size_bytes, duration_seconds, expires_at)
  values (j.project_id, j.user_id, j.id, p_key, p_size, p_duration, ist_day_end())
  returning id into v;
  update projects set stage = 'ready' where id = j.project_id;
  return v;
end $$;

-- Worker: mark a job failed with a plain-language reason.
create function fail_job(p_job uuid, p_error text, p_metrics jsonb default '{}')
returns void language plpgsql as $$
declare j jobs;
begin
  update jobs set status = 'failed', error = p_error, finished_at = now(), metrics = metrics || p_metrics
   where id = p_job returning * into j;
  if j.id is null then
    raise exception 'job_not_found';
  end if;
  update projects set stage = 'storyboard' where id = j.project_id;
end $$;

-- Worker, on start: requeue jobs stuck mid-render (for example after the laptop slept).
create function requeue_stale_jobs(p_minutes integer default 30) returns integer language plpgsql as $$
declare n integer;
begin
  update jobs set status = 'queued'
   where status in ('voicing', 'rendering', 'uploading')
     and claimed_at < now() - make_interval(mins => p_minutes);
  get diagnostics n = row_count;
  return n;
end $$;

-- Worker, every 30 seconds: "the kitchen is open".
create function worker_heartbeat(p_version text) returns void language sql as $$
  insert into worker_heartbeat (id, last_seen_at, worker_version) values (1, now(), p_version)
  on conflict (id) do update set last_seen_at = now(), worker_version = excluded.worker_version
$$;

-- The browser may call only save_plan, cancel_job, and retry_job.
revoke execute on function claim_next_job(), complete_job(uuid, text, bigint, numeric, jsonb),
  fail_job(uuid, text, jsonb), requeue_stale_jobs(integer), worker_heartbeat(text)
  from public, anon, authenticated;
grant execute on function claim_next_job(), complete_job(uuid, text, bigint, numeric, jsonb),
  fail_job(uuid, text, jsonb), requeue_stale_jobs(integer), worker_heartbeat(text)
  to service_role;
revoke execute on function save_plan(uuid, jsonb, integer), cancel_job(uuid), retry_job(uuid) from public, anon;
grant execute on function save_plan(uuid, jsonb, integer), cancel_job(uuid), retry_job(uuid) to authenticated, service_role;
