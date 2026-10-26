-- ExplainIt: hardening from the code review (issues 7, 9, 13).

-- (7) Signed-in users may create projects and rename or re-theme them, but nothing else.
-- scene_plan, stage, and plan_version change only through functions that check them.
revoke insert, update on projects from anon, authenticated;
grant insert (user_id, title, language, duration_target, theme, input_mode, input_text) on projects to authenticated;
grant update (title, theme) on projects to authenticated;

-- save_plan now runs with owner rights, checks that the project is yours, and checks the
-- plan's basic shape and that it keeps the project's language and length.
create or replace function save_plan(p_project uuid, p_plan jsonb, p_expected integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  pr projects;
  v integer;
  n integer;
begin
  select * into pr from projects where id = p_project and user_id = auth.uid();
  if not found then
    raise exception 'not_found';
  end if;
  if jsonb_typeof(p_plan -> 'scenes') is distinct from 'array' then
    raise exception 'invalid_plan';
  end if;
  n := jsonb_array_length(p_plan -> 'scenes');
  if n < 5 or n > 10
     or p_plan ->> 'language' is distinct from pr.language
     or (p_plan ->> 'durationTarget')::int is distinct from pr.duration_target then
    raise exception 'invalid_plan';
  end if;
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

-- (9) The AI limit is reserved BEFORE calling Gemini, under a per-user lock, so requests
-- sent at the same moment cannot all slip through. It counts real Gemini calls (attempts),
-- including repairs and fallback models. Rows start with ok = null while in progress.
alter table llm_calls alter column ok drop not null;
drop policy add_own_llm on llm_calls; -- all writes go through the two functions below

create function reserve_llm_call(p_kind llm_kind, p_project uuid, p_limit integer default 40)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  used integer;
  rid bigint;
begin
  if uid is null then
    raise exception 'unauthorized';
  end if;
  if p_project is not null and not exists (select 1 from projects where id = p_project and user_id = uid) then
    raise exception 'not_found';
  end if;
  perform pg_advisory_xact_lock(hashtext(uid::text)); -- one reservation at a time per user
  select coalesce(sum(greatest(attempts, 1)), 0) into used
    from llm_calls where user_id = uid and created_at > now() - interval '1 hour';
  if used + 1 > p_limit then
    raise exception 'rate_limited';
  end if;
  insert into llm_calls (user_id, project_id, kind, provider, ok, attempts, seconds)
  values (uid, p_project, p_kind, 'pending', null, 1, 0)
  returning id into rid;
  return rid;
end $$;

create function finish_llm_call(p_id bigint, p_ok boolean, p_provider text, p_attempts integer, p_seconds numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  update llm_calls
     set ok = p_ok, provider = p_provider, attempts = greatest(p_attempts, 1), seconds = p_seconds
   where id = p_id and user_id = auth.uid();
end $$;

revoke execute on function reserve_llm_call(llm_kind, uuid, integer), finish_llm_call(bigint, boolean, text, integer, numeric) from public, anon;
grant execute on function reserve_llm_call(llm_kind, uuid, integer), finish_llm_call(bigint, boolean, text, integer, numeric) to authenticated;

-- (13) A job that keeps crashing the worker is retried at most 3 times, then marked failed.
drop function requeue_stale_jobs(integer);

create function requeue_stale_jobs(p_minutes integer default 30, p_max_attempts integer default 3)
returns integer language plpgsql as $$
declare
  n integer;
begin
  with gave_up as (
    update jobs
       set status = 'failed', finished_at = now(),
           error = 'Stopped after ' || p_max_attempts || ' attempts: the renderer kept stopping on this video.'
     where status in ('voicing', 'rendering', 'uploading')
       and claimed_at < now() - make_interval(mins => p_minutes)
       and attempts >= p_max_attempts
    returning project_id
  )
  update projects set stage = 'storyboard' where id in (select project_id from gave_up);

  update jobs set status = 'queued'
   where status in ('voicing', 'rendering', 'uploading')
     and claimed_at < now() - make_interval(mins => p_minutes)
     and attempts < p_max_attempts;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function requeue_stale_jobs(integer, integer) from public, anon, authenticated;
grant execute on function requeue_stale_jobs(integer, integer) to service_role;
