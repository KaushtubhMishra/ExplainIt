-- ExplainIt: review round 3 fixes (on top of 20261025000200_hardening.sql).

-- (2) finish_llm_call can only finish a row that is still pending. Each row can then be
-- finished once; a second call (for example from the browser) is refused outright rather
-- than silently accepted, so it can never lower the real usage count.
create or replace function finish_llm_call(p_id bigint, p_ok boolean, p_provider text, p_attempts integer, p_seconds numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  update llm_calls
     set ok = p_ok, provider = p_provider, attempts = greatest(p_attempts, 1), seconds = p_seconds
   where id = p_id and user_id = auth.uid() and ok is null;
  if not found then
    raise exception 'not_pending';
  end if;
end $$;

-- (5) A single request can use up to 6 Gemini calls (2 models x (1 + 2 repairs)). A row
-- still pending (ok is null) is counted as that worst case, so the hourly allowance is a
-- hard cap rather than one that can be exceeded by calls still in flight.
create or replace function reserve_llm_call(p_kind llm_kind, p_project uuid, p_limit integer default 40)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  worst_case constant integer := 6; -- 2 models x (1 attempt + 2 repairs); mirrored in apps/web/lib/api.ts
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
  select coalesce(sum(case when ok is null then worst_case else greatest(attempts, 1) end), 0) into used
    from llm_calls where user_id = uid and created_at > now() - interval '1 hour';
  if used + worst_case > p_limit then
    raise exception 'rate_limited';
  end if;
  insert into llm_calls (user_id, project_id, kind, provider, ok, attempts, seconds)
  values (uid, p_project, p_kind, 'pending', null, 1, 0)
  returning id into rid;
  return rid;
end $$;

-- (6) save_plan can set the project's title and/or theme in the SAME write as the plan,
-- so the plan and the project can never disagree. p_title and p_theme are optional.
drop function save_plan(uuid, jsonb, integer);

create function save_plan(p_project uuid, p_plan jsonb, p_expected integer, p_title text default null, p_theme text default null)
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
     or (p_plan ->> 'durationTarget')::int is distinct from pr.duration_target
     or (p_theme is not null and p_theme not in ('sky', 'forest', 'sunset', 'night')) then
    raise exception 'invalid_plan';
  end if;
  update projects
     set scene_plan = p_plan,
         plan_version = plan_version + 1,
         stage = case when stage = 'planning' then 'storyboard'::project_stage else stage end,
         title = case when p_title is not null then left(p_title, 70) else title end,
         theme = coalesce(p_theme, theme)
   where id = p_project and plan_version = p_expected
  returning plan_version into v;
  if v is null then
    raise exception 'version_conflict';
  end if;
  return v;
end $$;

revoke execute on function save_plan(uuid, jsonb, integer, text, text) from public, anon;
grant execute on function save_plan(uuid, jsonb, integer, text, text) to authenticated, service_role;
