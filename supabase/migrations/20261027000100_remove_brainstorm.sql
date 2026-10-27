-- ExplainIt: Brainstorm (W9) is removed from V1. 'brainstorm' was never actually produced
-- by any code path (no UI, no route writes it), so this drops it from the three enums that
-- offered it. Postgres has no ALTER TYPE ... DROP VALUE, so each enum is recreated under
-- its old name; the USING cast fails loudly (instead of silently) if any row somehow still
-- has 'brainstorm', rather than guessing what to do with it.

alter type input_mode rename to input_mode_old;
create type input_mode as enum ('idea', 'notes');
alter table projects alter column input_mode type input_mode using input_mode::text::input_mode;
drop type input_mode_old;

alter type chat_stage rename to chat_stage_old;
create type chat_stage as enum ('storyboard', 'video');
alter table messages alter column stage type chat_stage using stage::text::chat_stage;
drop type chat_stage_old;

alter type llm_kind rename to llm_kind_old;
create type llm_kind as enum ('script', 'revise');
alter table llm_calls alter column kind type llm_kind using kind::text::llm_kind;

-- Recreating llm_kind gives it a new identity in Postgres (a function's argument types are
-- matched by that identity, not by name), so reserve_llm_call still depends on the old,
-- now-renamed type and must be dropped before that type can be dropped. It's then recreated
-- unchanged except for rebinding to the new llm_kind.
drop function reserve_llm_call(llm_kind_old, uuid, integer);
drop type llm_kind_old;

create function reserve_llm_call(p_kind llm_kind, p_project uuid, p_limit integer default 40)
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
