-- ExplainIt: rows that point at a project must point at one of YOUR projects.
-- (Before this, messages and jobs only checked user_id, so a user who knew another
-- person's project id could attach rows to it, or queue a render that blocked theirs.)

-- messages: only on your own projects
drop policy add_own_messages on messages;
create policy add_own_messages on messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  );

-- llm_calls: project is optional, but if given it must be yours
drop policy add_own_llm on llm_calls;
create policy add_own_llm on llm_calls for insert to authenticated
  with check (
    user_id = auth.uid()
    and (project_id is null or exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()))
  );

-- jobs: no direct inserts any more. queue_render() checks ownership and the plan version,
-- and copies the plan from the project itself, so nobody can submit an arbitrary plan.
drop policy add_own_jobs on jobs;

create function queue_render(p_project uuid, p_expected integer) returns jobs
language plpgsql security definer set search_path = public as $$
declare
  pr projects;
  j jobs;
begin
  select * into pr from projects where id = p_project and user_id = auth.uid();
  if not found then
    raise exception 'not_found';
  end if;
  if pr.scene_plan is null or jsonb_typeof(pr.scene_plan -> 'scenes') is distinct from 'array' then
    raise exception 'no_plan';
  end if;
  if pr.plan_version <> p_expected then
    raise exception 'version_conflict';
  end if;
  begin
    insert into jobs (project_id, user_id, plan_version, scene_plan)
    values (pr.id, pr.user_id, pr.plan_version, pr.scene_plan)
    returning * into j;
  exception when unique_violation then
    raise exception 'job_active'; -- one active render per project
  end;
  return j;
end $$;

revoke execute on function queue_render(uuid, integer) from public, anon;
grant execute on function queue_render(uuid, integer) to authenticated, service_role;
